// Inventory Reports Routes (Supabase) - Analytics & Forecasting
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Item-wise consumption logs
router.get('/consumption', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { startDate, endDate, inventoryItemId } = req.query;
        const branchId = req.user!.branchId;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        end.setHours(23, 59, 59, 999);

        let query = sb
            .from('stock_transactions')
            .select('*, inventory_items (id, name, unit, sku, branch_id)')
            .eq('type', 'CONSUMPTION')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });

        if (inventoryItemId) query = query.eq('inventory_item_id', inventoryItemId);

        const { data: transactions, error } = await query;
        if (error) throw error;

        // Filter by branch
        const filtered = (transactions || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);

        // Aggregate by item
        const itemConsumption: Record<string, any> = {};
        for (const tx of filtered) {
            const id = tx.inventory_item_id;
            if (!itemConsumption[id]) {
                itemConsumption[id] = {
                    inventoryItemId: id,
                    name: tx.inventory_items?.name,
                    sku: tx.inventory_items?.sku,
                    unit: tx.inventory_items?.unit,
                    totalConsumed: 0,
                    transactionCount: 0,
                };
            }
            itemConsumption[id].totalConsumed += Math.abs(Number(tx.quantity));
            itemConsumption[id].transactionCount++;
        }

        const sorted = Object.values(itemConsumption).sort((a: any, b: any) => b.totalConsumed - a.totalConsumed);

        res.json({
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            items: sorted,
            totalTransactions: filtered.length,
        });
    } catch (error) {
        logger.error('Consumption report error:', error);
        res.status(500).json({ error: 'Failed to get consumption report' });
    }
});

// Branch-wise stock levels
router.get('/branch-levels', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user!.branchId;

        const { data: items, error } = await sb
            .from('inventory_items')
            .select('id, name, sku, category, unit, quantity, min_stock, safety_stock, reserved_qty, cost_per_unit, stock_status')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        // Calculate totals
        const summary = {
            totalItems: (items || []).length,
            totalValue: (items || []).reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.cost_per_unit || 0), 0),
            byCategory: {} as Record<string, number>,
            byStatus: { SUFFICIENT: 0, LOW_STOCK: 0, CRITICAL: 0, OUT_OF_STOCK: 0 } as Record<string, number>,
        };

        for (const item of items || []) {
            summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
            if (item.stock_status) {
                summary.byStatus[item.stock_status] = (summary.byStatus[item.stock_status] || 0) + 1;
            }
        }

        res.json({ items: items || [], summary });
    } catch (error) {
        logger.error('Branch levels error:', error);
        res.status(500).json({ error: 'Failed to get branch stock levels' });
    }
});

// Reorder suggestions
router.get('/reorder-suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user!.branchId;

        const { data: items, error } = await sb
            .from('inventory_items')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .in('stock_status', ['LOW_STOCK', 'CRITICAL', 'OUT_OF_STOCK'])
            .order('stock_status', { ascending: true });

        if (error) throw error;

        const suggestions = (items || []).map((item: any) => {
            const currentQty = Number(item.quantity);
            const minStock = Number(item.min_stock);
            const safetyStock = Number(item.safety_stock);
            const suggestedQty = Math.max(0, minStock + safetyStock - currentQty);
            const estimatedCost = suggestedQty * Number(item.cost_per_unit || 0);

            return {
                inventoryItemId: item.id,
                name: item.name,
                sku: item.sku,
                unit: item.unit,
                currentQty,
                minStock,
                safetyStock,
                stockStatus: item.stock_status,
                suggestedOrderQty: Math.ceil(suggestedQty),
                estimatedCost: Math.round(estimatedCost * 100) / 100,
                priority: item.stock_status === 'OUT_OF_STOCK' ? 'HIGH' : item.stock_status === 'CRITICAL' ? 'MEDIUM' : 'LOW',
            };
        });

        res.json(suggestions);
    } catch (error) {
        logger.error('Reorder suggestions error:', error);
        res.status(500).json({ error: 'Failed to get reorder suggestions' });
    }
});

// AI-based stock forecast
router.get('/forecast', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { days = 7, inventoryItemId } = req.query;
        const branchId = req.user!.branchId;
        const forecastDays = Number(days);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        let query = sb
            .from('stock_transactions')
            .select('*, inventory_items (id, name, quantity, min_stock, unit, branch_id)')
            .eq('type', 'CONSUMPTION')
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (inventoryItemId) query = query.eq('inventory_item_id', inventoryItemId);

        const { data: transactions, error } = await query;
        if (error) throw error;

        // Filter by branch
        const filtered = (transactions || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);

        // Aggregate consumption by item
        const consumption: Record<string, any> = {};
        for (const tx of filtered) {
            const id = tx.inventory_item_id;
            if (!consumption[id]) {
                consumption[id] = {
                    inventoryItemId: id,
                    name: tx.inventory_items?.name,
                    currentQty: Number(tx.inventory_items?.quantity),
                    minStock: Number(tx.inventory_items?.min_stock),
                    unit: tx.inventory_items?.unit,
                    totalConsumed30Days: 0,
                };
            }
            consumption[id].totalConsumed30Days += Math.abs(Number(tx.quantity));
        }

        // Calculate forecast
        const forecasts = Object.values(consumption).map((item: any) => {
            const avgDailyConsumption = item.totalConsumed30Days / 30;
            const forecastedConsumption = avgDailyConsumption * forecastDays;
            const projectedStock = item.currentQty - forecastedConsumption;
            const daysUntilStockout = avgDailyConsumption > 0 ? Math.floor(item.currentQty / avgDailyConsumption) : 999;

            return {
                ...item,
                avgDailyConsumption: Math.round(avgDailyConsumption * 100) / 100,
                forecastedConsumption: Math.round(forecastedConsumption * 100) / 100,
                projectedStock: Math.round(projectedStock * 100) / 100,
                daysUntilStockout,
                needsReorder: projectedStock < item.minStock,
                status: projectedStock <= 0 ? 'WILL_STOCKOUT' : projectedStock < item.minStock ? 'WILL_BE_LOW' : 'SAFE',
            };
        });

        forecasts.sort((a: any, b: any) => a.daysUntilStockout - b.daysUntilStockout);

        res.json({ forecastDays, basedOnDays: 30, items: forecasts });
    } catch (error) {
        logger.error('Forecast error:', error);
        res.status(500).json({ error: 'Failed to generate forecast' });
    }
});

// Wastage & consumption ratio
router.get('/wastage-ratio', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { startDate, endDate } = req.query;
        const branchId = req.user!.branchId;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        end.setHours(23, 59, 59, 999);

        const { data: transactions, error } = await sb
            .from('stock_transactions')
            .select('*, inventory_items (id, name, unit, cost_per_unit, branch_id)')
            .in('type', ['CONSUMPTION', 'WASTAGE'])
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        if (error) throw error;

        // Filter by branch
        const filtered = (transactions || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);

        // Aggregate
        const itemStats: Record<string, any> = {};
        for (const tx of filtered) {
            const id = tx.inventory_item_id;
            if (!itemStats[id]) {
                itemStats[id] = {
                    inventoryItemId: id,
                    name: tx.inventory_items?.name,
                    unit: tx.inventory_items?.unit,
                    costPerUnit: Number(tx.inventory_items?.cost_per_unit || 0),
                    consumed: 0,
                    wasted: 0,
                };
            }

            const qty = Math.abs(Number(tx.quantity));
            if (tx.type === 'CONSUMPTION') {
                itemStats[id].consumed += qty;
            } else {
                itemStats[id].wasted += qty;
            }
        }

        // Calculate ratios
        const items = Object.values(itemStats).map((item: any) => {
            const total = item.consumed + item.wasted;
            const wastageRatio = total > 0 ? (item.wasted / total) * 100 : 0;
            const wastageCost = item.wasted * item.costPerUnit;

            return {
                ...item,
                total,
                wastageRatio: Math.round(wastageRatio * 100) / 100,
                wastageCost: Math.round(wastageCost * 100) / 100,
            };
        });

        items.sort((a: any, b: any) => b.wastageRatio - a.wastageRatio);

        const totalConsumed = items.reduce((sum: number, i: any) => sum + i.consumed, 0);
        const totalWasted = items.reduce((sum: number, i: any) => sum + i.wasted, 0);
        const totalWastageCost = items.reduce((sum: number, i: any) => sum + i.wastageCost, 0);

        res.json({
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            summary: {
                totalConsumed,
                totalWasted,
                overallWastageRatio: totalConsumed + totalWasted > 0 ? Math.round((totalWasted / (totalConsumed + totalWasted)) * 100 * 100) / 100 : 0,
                totalWastageCost: Math.round(totalWastageCost * 100) / 100,
            },
            items,
        });
    } catch (error) {
        logger.error('Wastage ratio error:', error);
        res.status(500).json({ error: 'Failed to get wastage ratio' });
    }
});

// Stock movement timeline
router.get('/movement-timeline', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { inventoryItemId, days = 30 } = req.query;
        const branchId = req.user!.branchId;

        if (!inventoryItemId) {
            return res.status(400).json({ error: 'inventoryItemId is required' });
        }

        const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

        const { data: transactions, error } = await sb
            .from('stock_transactions')
            .select('*, inventory_items (branch_id)')
            .eq('inventory_item_id', inventoryItemId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Filter by branch
        const filtered = (transactions || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);

        // Group by day
        const timeline: Record<string, any> = {};
        for (const tx of filtered) {
            const date = new Date(tx.created_at).toISOString().split('T')[0];
            if (!timeline[date]) {
                timeline[date] = { date, inflow: 0, outflow: 0, transactions: [] };
            }

            const qty = Number(tx.quantity);
            if (qty > 0) {
                timeline[date].inflow += qty;
            } else {
                timeline[date].outflow += Math.abs(qty);
            }

            timeline[date].transactions.push({
                type: tx.type,
                quantity: qty,
                reason: tx.reason,
                time: tx.created_at,
            });
        }

        res.json({ inventoryItemId, days: Number(days), timeline: Object.values(timeline) });
    } catch (error) {
        logger.error('Movement timeline error:', error);
        res.status(500).json({ error: 'Failed to get movement timeline' });
    }
});

// Dashboard widget data
router.get('/dashboard-widget', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user!.branchId;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get inventory items grouped by status
        const { data: items } = await sb
            .from('inventory_items')
            .select('stock_status')
            .eq('branch_id', branchId)
            .eq('is_active', true);

        const stockSummary: Record<string, number> = {};
        for (const item of items || []) {
            stockSummary[item.stock_status] = (stockSummary[item.stock_status] || 0) + 1;
        }

        // Get today's consumption
        const { data: todayTx } = await sb
            .from('stock_transactions')
            .select('quantity, inventory_items (branch_id)')
            .eq('type', 'CONSUMPTION')
            .gte('created_at', today.toISOString());

        const todayFiltered = (todayTx || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);
        const todayConsumption = {
            totalQty: Math.abs(todayFiltered.reduce((sum: number, tx: any) => sum + Number(tx.quantity), 0)),
            transactions: todayFiltered.length,
        };

        // Get week consumption
        const { data: weekTx } = await sb
            .from('stock_transactions')
            .select('quantity, inventory_item_id, inventory_items (branch_id, name)')
            .eq('type', 'CONSUMPTION')
            .gte('created_at', sevenDaysAgo.toISOString());

        const weekFiltered = (weekTx || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);
        const weekConsumption = {
            totalQty: Math.abs(weekFiltered.reduce((sum: number, tx: any) => sum + Number(tx.quantity), 0)),
            transactions: weekFiltered.length,
            avgDaily: Math.abs(weekFiltered.reduce((sum: number, tx: any) => sum + Number(tx.quantity), 0)) / 7,
        };

        // Top consumed today
        const todayItemConsumption: Record<string, { name: string; consumed: number }> = {};
        for (const tx of todayFiltered) {
            const id = tx.inventory_item_id;
            if (!todayItemConsumption[id]) {
                todayItemConsumption[id] = { name: tx.inventory_items?.name || 'Unknown', consumed: 0 };
            }
            todayItemConsumption[id].consumed += Math.abs(Number(tx.quantity));
        }

        const topConsumedToday = Object.entries(todayItemConsumption)
            .map(([id, data]) => ({ inventoryItemId: id, ...data }))
            .sort((a, b) => b.consumed - a.consumed)
            .slice(0, 5);

        res.json({ stockSummary, todayConsumption, weekConsumption, topConsumedToday });
    } catch (error) {
        logger.error('Dashboard widget error:', error);
        res.status(500).json({ error: 'Failed to get dashboard widget data' });
    }
});

// Inventory vs Sales trend
router.get('/inventory-sales-trend', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { days = 14 } = req.query;
        const branchId = req.user!.branchId;

        const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);

        const dailyData: any[] = [];

        for (let i = 0; i < Number(days); i++) {
            const dayStart = new Date(startDate);
            dayStart.setDate(dayStart.getDate() + i);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            // Get orders for this day
            const { data: orders } = await sb
                .from('orders')
                .select('total')
                .eq('branch_id', branchId)
                .eq('status', 'COMPLETED')
                .gte('created_at', dayStart.toISOString())
                .lte('created_at', dayEnd.toISOString());

            // Get consumption for this day
            const { data: consumptionTx } = await sb
                .from('stock_transactions')
                .select('quantity, inventory_items (branch_id)')
                .eq('type', 'CONSUMPTION')
                .gte('created_at', dayStart.toISOString())
                .lte('created_at', dayEnd.toISOString());

            const filteredConsumption = (consumptionTx || []).filter((tx: any) => tx.inventory_items?.branch_id === branchId);

            dailyData.push({
                date: dayStart.toISOString().split('T')[0],
                sales: (orders || []).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0),
                orders: (orders || []).length,
                consumption: Math.abs(filteredConsumption.reduce((sum: number, tx: any) => sum + Number(tx.quantity), 0)),
            });
        }

        res.json({ days: Number(days), trend: dailyData });
    } catch (error) {
        logger.error('Inventory sales trend error:', error);
        res.status(500).json({ error: 'Failed to get inventory sales trend' });
    }
});

export default router;
