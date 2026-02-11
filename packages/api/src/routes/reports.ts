// Reports Routes (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// Daily sales summary
router.get('/daily-sales', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { date } = req.query;

        const targetDate = date ? new Date(date as string) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: orders, error } = await sb
            .from('orders')
            .select('*, payments (*)')
            .eq('branch_id', req.user!.branchId)
            .eq('status', 'COMPLETED')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());

        if (error) throw error;

        const totalSales = orders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Payment mode breakdown
        const paymentBreakdown: Record<string, number> = {};
        for (const order of orders) {
            for (const payment of order.payments || []) {
                paymentBreakdown[payment.mode] = (paymentBreakdown[payment.mode] || 0) + Number(payment.amount);
            }
        }

        // Order type breakdown
        const orderTypeBreakdown: Record<string, { count: number; total: number }> = {};
        for (const order of orders) {
            if (!orderTypeBreakdown[order.order_type]) {
                orderTypeBreakdown[order.order_type] = { count: 0, total: 0 };
            }
            orderTypeBreakdown[order.order_type].count++;
            orderTypeBreakdown[order.order_type].total += Number(order.total);
        }

        res.json({
            date: targetDate.toISOString().split('T')[0],
            totalSales,
            totalOrders,
            avgOrderValue,
            paymentBreakdown,
            orderTypeBreakdown,
        });
    } catch (error) {
        console.error('Daily sales error:', error);
        res.status(500).json({ error: 'Failed to get daily sales' });
    }
});

// Item-wise sales
router.get('/item-sales', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Get completed orders in date range
        const { data: orders } = await sb
            .from('orders')
            .select('id')
            .eq('branch_id', req.user!.branchId)
            .eq('status', 'COMPLETED')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        const orderIds = (orders || []).map((o: any) => o.id);

        if (orderIds.length === 0) {
            return res.json({ startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0], items: [] });
        }

        // Get order items
        const { data: orderItems } = await sb
            .from('order_items')
            .select('*, menu_items (name)')
            .in('order_id', orderIds);

        // Aggregate by menu item
        const itemSales: Record<string, { name: string; quantity: number; total: number }> = {};
        for (const item of orderItems || []) {
            const key = item.menu_item_id;
            if (!itemSales[key]) {
                itemSales[key] = { name: item.menu_items?.name || 'Unknown', quantity: 0, total: 0 };
            }
            itemSales[key].quantity += item.quantity;
            itemSales[key].total += Number(item.total);
        }

        const sorted = Object.values(itemSales).sort((a, b) => b.total - a.total);

        res.json({
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            items: sorted,
        });
    } catch (error) {
        console.error('Item sales error:', error);
        res.status(500).json({ error: 'Failed to get item sales' });
    }
});

// Category-wise sales
router.get('/category-sales', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();

        // Get completed orders
        const { data: orders } = await sb
            .from('orders')
            .select('id')
            .eq('branch_id', req.user!.branchId)
            .eq('status', 'COMPLETED')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        const orderIds = (orders || []).map((o: any) => o.id);

        if (orderIds.length === 0) {
            return res.json([]);
        }

        // Get order items with menu item and category
        const { data: orderItems } = await sb
            .from('order_items')
            .select('*, menu_items (category_id, categories (name))')
            .in('order_id', orderIds);

        // Aggregate by category
        const categorySales: Record<string, { name: string; quantity: number; total: number }> = {};
        for (const item of orderItems || []) {
            const key = item.menu_items?.category_id || 'uncategorized';
            const catName = item.menu_items?.categories?.name || 'Uncategorized';
            if (!categorySales[key]) {
                categorySales[key] = { name: catName, quantity: 0, total: 0 };
            }
            categorySales[key].quantity += item.quantity;
            categorySales[key].total += Number(item.total);
        }

        res.json(Object.values(categorySales).sort((a, b) => b.total - a.total));
    } catch (error) {
        console.error('Category sales error:', error);
        res.status(500).json({ error: 'Failed to get category sales' });
    }
});

// Hourly sales (for today)
router.get('/hourly-sales', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: orders } = await sb
            .from('orders')
            .select('*')
            .eq('branch_id', req.user!.branchId)
            .eq('status', 'COMPLETED')
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString());

        // Aggregate by hour
        const hourlyData: { hour: number; orders: number; total: number }[] = [];
        for (let h = 0; h < 24; h++) {
            const hourOrders = (orders || []).filter((o: any) => new Date(o.created_at).getHours() === h);
            hourlyData.push({
                hour: h,
                orders: hourOrders.length,
                total: hourOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
            });
        }

        res.json(hourlyData);
    } catch (error) {
        console.error('Hourly sales error:', error);
        res.status(500).json({ error: 'Failed to get hourly sales' });
    }
});

// Weekly summary
router.get('/weekly-summary', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setMilliseconds(-1);
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekStart.getDate() - 6);
        prevWeekStart.setHours(0, 0, 0, 0);

        const [{ data: currentOrders }, { data: prevOrders }] = await Promise.all([
            sb.from('orders').select('*')
                .eq('branch_id', req.user!.branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', weekStart.toISOString())
                .lte('created_at', today.toISOString()),
            sb.from('orders').select('*')
                .eq('branch_id', req.user!.branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', prevWeekStart.toISOString())
                .lte('created_at', prevWeekEnd.toISOString()),
        ]);

        const allCurrentOrders = currentOrders || [];
        const allPrevOrders = prevOrders || [];

        // Daily breakdown
        const days: { date: string; dayName: string; sales: number; orders: number }[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayOrders = allCurrentOrders.filter((o: any) =>
                new Date(o.created_at).toISOString().split('T')[0] === dateStr
            );
            days.push({
                date: dateStr,
                dayName: dayNames[date.getDay()],
                sales: dayOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
                orders: dayOrders.length,
            });
        }

        const totalSales = allCurrentOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const prevTotalSales = allPrevOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const trend = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

        res.json({
            startDate: weekStart.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0],
            days,
            totalSales,
            totalOrders: allCurrentOrders.length,
            avgDaily: totalSales / 7,
            trend: Math.round(trend * 10) / 10,
        });
    } catch (error) {
        console.error('Weekly summary error:', error);
        res.status(500).json({ error: 'Failed to get weekly summary' });
    }
});

// Monthly summary
router.get('/monthly-summary', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        const prevMonthEnd = new Date(monthStart);
        prevMonthEnd.setMilliseconds(-1);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

        const [{ data: currentOrders }, { data: prevOrders }] = await Promise.all([
            sb.from('orders').select('*')
                .eq('branch_id', req.user!.branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', monthStart.toISOString())
                .lte('created_at', today.toISOString()),
            sb.from('orders').select('*')
                .eq('branch_id', req.user!.branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', prevMonthStart.toISOString())
                .lte('created_at', prevMonthEnd.toISOString()),
        ]);

        const allCurrentOrders = currentOrders || [];
        const allPrevOrders = prevOrders || [];

        const totalSales = allCurrentOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const prevTotalSales = allPrevOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const trend = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

        const daysInMonth = today.getDate();

        res.json({
            month: today.toLocaleString('default', { month: 'long' }),
            year: today.getFullYear(),
            totalSales,
            totalOrders: allCurrentOrders.length,
            avgDaily: totalSales / daysInMonth,
            trend: Math.round(trend * 10) / 10,
            daysElapsed: daysInMonth,
        });
    } catch (error) {
        console.error('Monthly summary error:', error);
        res.status(500).json({ error: 'Failed to get monthly summary' });
    }
});

// Sales trend (for charts)
router.get('/sales-trend', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { days: daysParam } = req.query;
        const numDays = parseInt(daysParam as string) || 7;

        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - numDays + 1);
        startDate.setHours(0, 0, 0, 0);

        const { data: orders } = await sb
            .from('orders')
            .select('*')
            .eq('branch_id', req.user!.branchId)
            .eq('status', 'COMPLETED')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', today.toISOString());

        // Aggregate by date
        const trend: { date: string; sales: number; orders: number }[] = [];
        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayOrders = (orders || []).filter((o: any) =>
                new Date(o.created_at).toISOString().split('T')[0] === dateStr
            );
            trend.push({
                date: dateStr,
                sales: dayOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
                orders: dayOrders.length,
            });
        }

        res.json(trend);
    } catch (error) {
        console.error('Sales trend error:', error);
        res.status(500).json({ error: 'Failed to get sales trend' });
    }
});

export default router;
