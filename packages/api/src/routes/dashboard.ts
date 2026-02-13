// Owner Dashboard Routes - Aggregated business intelligence endpoint
// Single API call returns everything the owner needs to see
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /dashboard/owner-summary
 * 
 * ONE API CALL - ALL DATA
 * Returns aggregated dashboard data for instant load:
 * - Today revenue vs Yesterday
 * - Order count, avg bill
 * - Top 5 selling items
 * - Slow moving items (dead stock)
 * - Low stock alerts
 * - Payment mode split
 * - Hourly sales
 * - Peak hour
 * - Estimated profit
 */
router.get('/owner-summary', authMiddleware, requireRole('SUPER_ADMIN', 'ADMIN', 'OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user!.branchId;

        // Date calculations
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // ==================== PARALLEL QUERIES ====================
        const [
            // Today's orders
            { data: todayOrders },
            // Yesterday's orders
            { data: yesterdayOrders },
            // Week's order items (for top/slow items)
            { data: weekOrders },
            // Low stock alerts
            { data: lowStockItems },
            // Ingredient costs (for profit estimate)
            { data: ingredientCosts },
        ] = await Promise.all([
            // Today orders with payments
            sb.from('orders')
                .select('*, payments (*)')
                .eq('branch_id', branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', todayStart.toISOString())
                .lte('created_at', todayEnd.toISOString()),

            // Yesterday orders
            sb.from('orders')
                .select('total')
                .eq('branch_id', branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', yesterdayStart.toISOString())
                .lte('created_at', yesterdayEnd.toISOString()),

            // Week's orders with items for top/slow analysis
            sb.from('orders')
                .select('id, created_at')
                .eq('branch_id', branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', weekAgo.toISOString())
                .lte('created_at', todayEnd.toISOString()),

            // Low stock items
            sb.from('inventory_items')
                .select('id, name, quantity, unit, min_stock, stock_status')
                .eq('branch_id', branchId)
                .in('stock_status', ['LOW', 'CRITICAL', 'OUT_OF_STOCK'])
                .limit(10),

            // Total ingredient value (for rough profit estimate)
            sb.from('inventory_items')
                .select('quantity, cost_per_unit')
                .eq('branch_id', branchId)
                .eq('is_active', true),
        ]);

        // ==================== TODAY METRICS ====================
        const allTodayOrders = todayOrders || [];
        const todayRevenue = allTodayOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const todayOrderCount = allTodayOrders.length;
        const avgBillValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

        // ==================== YESTERDAY COMPARISON ====================
        const allYesterdayOrders = yesterdayOrders || [];
        const yesterdayRevenue = allYesterdayOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const revenueChange = yesterdayRevenue > 0
            ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
            : todayRevenue > 0 ? 100 : 0;

        // ==================== PAYMENT SPLIT ====================
        const paymentSplit: Record<string, number> = {};
        for (const order of allTodayOrders) {
            for (const payment of order.payments || []) {
                paymentSplit[payment.mode] = (paymentSplit[payment.mode] || 0) + Number(payment.amount);
            }
        }

        // ==================== HOURLY SALES ====================
        const hourlySales: { hour: number; orders: number; revenue: number }[] = [];
        for (let h = 0; h < 24; h++) {
            const hourOrders = allTodayOrders.filter((o: any) => new Date(o.created_at).getHours() === h);
            hourlySales.push({
                hour: h,
                orders: hourOrders.length,
                revenue: hourOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
            });
        }

        // Peak hour calculation
        const peakHour = hourlySales.reduce((max, curr) => curr.orders > max.orders ? curr : max, hourlySales[0]);

        // ==================== TOP ITEMS (Last 7 Days) ====================
        let topItems: { name: string; quantity: number; revenue: number }[] = [];
        let slowItems: { name: string; lastSold: string | null; daysSinceLastSale: number }[] = [];

        if ((weekOrders || []).length > 0) {
            const weekOrderIds = (weekOrders || []).map((o: any) => o.id);

            // Get order items for the week
            const { data: orderItems } = await sb
                .from('order_items')
                .select('menu_item_id, quantity, total, menu_items (name)')
                .in('order_id', weekOrderIds);

            // Aggregate by menu item
            const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
            for (const item of orderItems || []) {
                const key = item.menu_item_id;
                if (!itemSales[key]) {
                    itemSales[key] = {
                        name: item.menu_items?.name || 'Unknown',
                        quantity: 0,
                        revenue: 0
                    };
                }
                itemSales[key].quantity += item.quantity;
                itemSales[key].revenue += Number(item.total);
            }

            topItems = Object.values(itemSales)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);
        }

        // ==================== SLOW ITEMS (Not sold in 7 days) ====================
        // Get all menu items and check if they've been sold recently
        const { data: allMenuItems } = await sb
            .from('menu_items')
            .select('id, name')
            .eq('branch_id', branchId)
            .eq('is_available', true);

        if ((allMenuItems || []).length > 0) {
            const { data: recentOrderItems } = await sb
                .from('order_items')
                .select('menu_item_id, created_at')
                .in('menu_item_id', (allMenuItems || []).map((m: any) => m.id))
                .gte('created_at', weekAgo.toISOString());

            // Find items with no sales or old sales
            const recentSales = new Map<string, Date>();
            for (const item of recentOrderItems || []) {
                const current = recentSales.get(item.menu_item_id);
                const itemDate = new Date(item.created_at);
                if (!current || itemDate > current) {
                    recentSales.set(item.menu_item_id, itemDate);
                }
            }

            slowItems = (allMenuItems || [])
                .filter((m: any) => !recentSales.has(m.id))
                .slice(0, 5)
                .map((m: any) => ({
                    name: m.name,
                    lastSold: null,
                    daysSinceLastSale: 7,
                }));
        }

        // ==================== PROFIT ESTIMATE (Rough) ====================
        // Based on typical 60% food cost ratio
        const estimatedCost = todayRevenue * 0.4; // 40% of revenue as food cost
        const estimatedProfit = todayRevenue - estimatedCost;

        // ==================== LOW STOCK ALERTS ====================
        const lowStockAlerts = (lowStockItems || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            status: item.stock_status,
            minStock: item.min_stock,
        }));

        // ==================== RESPONSE ====================
        res.json({
            // Today vs Yesterday
            today: {
                revenue: Math.round(todayRevenue * 100) / 100,
                orders: todayOrderCount,
                avgBill: Math.round(avgBillValue * 100) / 100,
            },
            yesterday: {
                revenue: Math.round(yesterdayRevenue * 100) / 100,
            },
            revenueChange: Math.round(revenueChange * 10) / 10,

            // Top & Slow Items
            topItems,
            slowItems,

            // Stock Alerts
            lowStockAlerts,
            lowStockCount: lowStockAlerts.length,

            // Payment Split
            paymentSplit,

            // Hourly Trend
            hourlySales,
            peakHour: {
                hour: peakHour.hour,
                label: `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`,
                orders: peakHour.orders,
            },

            // Profit Estimate
            profitEstimate: {
                revenue: Math.round(todayRevenue * 100) / 100,
                estimatedCost: Math.round(estimatedCost * 100) / 100,
                estimatedProfit: Math.round(estimatedProfit * 100) / 100,
                margin: todayRevenue > 0 ? Math.round((estimatedProfit / todayRevenue) * 100) : 0,
            },

            // Metadata
            generatedAt: new Date().toISOString(),
            branchId,
        });
    } catch (error) {
        logger.error('Owner dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

export default router;
