// Inventory Reports Routes - Analytics & Forecasting
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Item-wise consumption logs
router.get('/consumption', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { startDate, endDate, inventoryItemId } = req.query;

        const branchId = req.user!.branchId;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        end.setHours(23, 59, 59, 999);

        const where: any = {
            type: 'CONSUMPTION',
            createdAt: { gte: start, lte: end },
            inventoryItem: { branchId },
        };

        if (inventoryItemId) {
            where.inventoryItemId = inventoryItemId;
        }

        const transactions = await prisma.stockTransaction.findMany({
            where,
            include: {
                inventoryItem: { select: { id: true, name: true, unit: true, sku: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Aggregate by item
        const itemConsumption: Record<string, any> = {};
        for (const tx of transactions) {
            const id = tx.inventoryItemId;
            if (!itemConsumption[id]) {
                itemConsumption[id] = {
                    inventoryItemId: id,
                    name: tx.inventoryItem.name,
                    sku: tx.inventoryItem.sku,
                    unit: tx.inventoryItem.unit,
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
            totalTransactions: transactions.length,
        });
    } catch (error) {
        console.error('Consumption report error:', error);
        res.status(500).json({ error: 'Failed to get consumption report' });
    }
});

// Branch-wise stock levels
router.get('/branch-levels', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const branchId = req.user!.branchId;

        const items = await prisma.inventoryItem.findMany({
            where: { branchId, isActive: true },
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                quantity: true,
                minStock: true,
                safetyStock: true,
                reservedQty: true,
                costPerUnit: true,
                stockStatus: true,
            },
            orderBy: { name: 'asc' },
        });

        // Calculate totals
        const summary = {
            totalItems: items.length,
            totalValue: items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.costPerUnit), 0),
            byCategory: {} as Record<string, number>,
            byStatus: {
                SUFFICIENT: 0,
                LOW_STOCK: 0,
                CRITICAL: 0,
                OUT_OF_STOCK: 0,
            } as Record<string, number>,
        };

        for (const item of items) {
            summary.byCategory[item.category] = (summary.byCategory[item.category] || 0) + 1;
            summary.byStatus[item.stockStatus] = (summary.byStatus[item.stockStatus] || 0) + 1;
        }

        res.json({ items, summary });
    } catch (error) {
        console.error('Branch levels error:', error);
        res.status(500).json({ error: 'Failed to get branch stock levels' });
    }
});

// Reorder suggestions
router.get('/reorder-suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const branchId = req.user!.branchId;

        // Get items below minStock or low stock status
        const items = await prisma.inventoryItem.findMany({
            where: {
                branchId,
                isActive: true,
                OR: [
                    { stockStatus: 'LOW_STOCK' },
                    { stockStatus: 'CRITICAL' },
                    { stockStatus: 'OUT_OF_STOCK' },
                ],
            },
            orderBy: { stockStatus: 'asc' },
        });

        const suggestions = items.map((item: any) => {
            const currentQty = Number(item.quantity);
            const minStock = Number(item.minStock);
            const safetyStock = Number(item.safetyStock);

            // Suggest ordering up to minStock + safetyStock
            const suggestedQty = Math.max(0, minStock + safetyStock - currentQty);
            const estimatedCost = suggestedQty * Number(item.costPerUnit);

            return {
                inventoryItemId: item.id,
                name: item.name,
                sku: item.sku,
                unit: item.unit,
                currentQty,
                minStock,
                safetyStock,
                stockStatus: item.stockStatus,
                suggestedOrderQty: Math.ceil(suggestedQty),
                estimatedCost: Math.round(estimatedCost * 100) / 100,
                priority: item.stockStatus === 'OUT_OF_STOCK' ? 'HIGH' : item.stockStatus === 'CRITICAL' ? 'MEDIUM' : 'LOW',
            };
        });

        res.json(suggestions);
    } catch (error) {
        console.error('Reorder suggestions error:', error);
        res.status(500).json({ error: 'Failed to get reorder suggestions' });
    }
});

// AI-based stock forecast
router.get('/forecast', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { days = 7, inventoryItemId } = req.query;
        const branchId = req.user!.branchId;
        const forecastDays = Number(days);

        // Get historical consumption for last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const where: any = {
            type: 'CONSUMPTION',
            createdAt: { gte: thirtyDaysAgo },
            inventoryItem: { branchId },
        };

        if (inventoryItemId) {
            where.inventoryItemId = inventoryItemId;
        }

        const transactions = await prisma.stockTransaction.findMany({
            where,
            include: {
                inventoryItem: { select: { id: true, name: true, quantity: true, minStock: true, unit: true } },
            },
        });

        // Aggregate consumption by item
        const consumption: Record<string, any> = {};
        for (const tx of transactions) {
            const id = tx.inventoryItemId;
            if (!consumption[id]) {
                consumption[id] = {
                    inventoryItemId: id,
                    name: tx.inventoryItem.name,
                    currentQty: Number(tx.inventoryItem.quantity),
                    minStock: Number(tx.inventoryItem.minStock),
                    unit: tx.inventoryItem.unit,
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

        // Sort by urgency
        forecasts.sort((a: any, b: any) => a.daysUntilStockout - b.daysUntilStockout);

        res.json({
            forecastDays,
            basedOnDays: 30,
            items: forecasts,
        });
    } catch (error) {
        console.error('Forecast error:', error);
        res.status(500).json({ error: 'Failed to generate forecast' });
    }
});

// Wastage & consumption ratio
router.get('/wastage-ratio', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { startDate, endDate } = req.query;
        const branchId = req.user!.branchId;

        const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate as string) : new Date();
        end.setHours(23, 59, 59, 999);

        const transactions = await prisma.stockTransaction.findMany({
            where: {
                type: { in: ['CONSUMPTION', 'WASTAGE'] },
                createdAt: { gte: start, lte: end },
                inventoryItem: { branchId },
            },
            include: {
                inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true } },
            },
        });

        // Aggregate
        const itemStats: Record<string, any> = {};
        for (const tx of transactions) {
            const id = tx.inventoryItemId;
            if (!itemStats[id]) {
                itemStats[id] = {
                    inventoryItemId: id,
                    name: tx.inventoryItem.name,
                    unit: tx.inventoryItem.unit,
                    costPerUnit: Number(tx.inventoryItem.costPerUnit),
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

        // Sort by wastage ratio
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
        console.error('Wastage ratio error:', error);
        res.status(500).json({ error: 'Failed to get wastage ratio' });
    }
});

// Stock movement timeline
router.get('/movement-timeline', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { inventoryItemId, days = 30 } = req.query;
        const branchId = req.user!.branchId;

        if (!inventoryItemId) {
            return res.status(400).json({ error: 'inventoryItemId is required' });
        }

        const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

        const transactions = await prisma.stockTransaction.findMany({
            where: {
                inventoryItemId: inventoryItemId as string,
                createdAt: { gte: startDate },
                inventoryItem: { branchId },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Group by day
        const timeline: Record<string, any> = {};
        for (const tx of transactions) {
            const date = tx.createdAt.toISOString().split('T')[0];
            if (!timeline[date]) {
                timeline[date] = {
                    date,
                    inflow: 0,
                    outflow: 0,
                    transactions: [],
                };
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
                time: tx.createdAt.toISOString(),
            });
        }

        res.json({
            inventoryItemId,
            days: Number(days),
            timeline: Object.values(timeline),
        });
    } catch (error) {
        console.error('Movement timeline error:', error);
        res.status(500).json({ error: 'Failed to get movement timeline' });
    }
});

// Dashboard widget data
router.get('/dashboard-widget', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const branchId = req.user!.branchId;

        // Get today's consumption
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [stockCounts, todayConsumption, weekConsumption] = await Promise.all([
            // Stock status counts
            prisma.inventoryItem.groupBy({
                by: ['stockStatus'],
                where: { branchId, isActive: true },
                _count: true,
            }),
            // Today's consumption
            prisma.stockTransaction.aggregate({
                where: {
                    type: 'CONSUMPTION',
                    createdAt: { gte: today },
                    inventoryItem: { branchId },
                },
                _sum: { quantity: true },
                _count: true,
            }),
            // Last 7 days consumption
            prisma.stockTransaction.aggregate({
                where: {
                    type: 'CONSUMPTION',
                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    inventoryItem: { branchId },
                },
                _sum: { quantity: true },
                _count: true,
            }),
        ]);

        // Get top consumed items today
        const topConsumed = await prisma.stockTransaction.groupBy({
            by: ['inventoryItemId'],
            where: {
                type: 'CONSUMPTION',
                createdAt: { gte: today },
                inventoryItem: { branchId },
            },
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'asc' } }, // Most negative = most consumed
            take: 5,
        });

        // Get item names
        const itemIds = topConsumed.map((t: any) => t.inventoryItemId);
        const items = await prisma.inventoryItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, name: true },
        });
        const itemMap = Object.fromEntries(items.map((i: any) => [i.id, i.name]));

        res.json({
            stockSummary: Object.fromEntries(stockCounts.map((s: any) => [s.stockStatus, s._count])),
            todayConsumption: {
                totalQty: Math.abs(Number(todayConsumption._sum.quantity || 0)),
                transactions: todayConsumption._count,
            },
            weekConsumption: {
                totalQty: Math.abs(Number(weekConsumption._sum.quantity || 0)),
                transactions: weekConsumption._count,
                avgDaily: Math.abs(Number(weekConsumption._sum.quantity || 0)) / 7,
            },
            topConsumedToday: topConsumed.map((t: any) => ({
                inventoryItemId: t.inventoryItemId,
                name: itemMap[t.inventoryItemId] || 'Unknown',
                consumed: Math.abs(Number(t._sum.quantity || 0)),
            })),
        });
    } catch (error) {
        console.error('Dashboard widget error:', error);
        res.status(500).json({ error: 'Failed to get dashboard widget data' });
    }
});

// Inventory vs Sales trend
router.get('/inventory-sales-trend', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { days = 14 } = req.query;
        const branchId = req.user!.branchId;

        const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);

        // Get daily orders and consumption
        const dailyData: any[] = [];

        for (let i = 0; i < Number(days); i++) {
            const dayStart = new Date(startDate);
            dayStart.setDate(dayStart.getDate() + i);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const [orderTotal, consumptionTotal] = await Promise.all([
                prisma.order.aggregate({
                    where: {
                        branchId,
                        status: 'COMPLETED',
                        createdAt: { gte: dayStart, lte: dayEnd },
                    },
                    _sum: { total: true },
                    _count: true,
                }),
                prisma.stockTransaction.aggregate({
                    where: {
                        type: 'CONSUMPTION',
                        createdAt: { gte: dayStart, lte: dayEnd },
                        inventoryItem: { branchId },
                    },
                    _sum: { quantity: true },
                }),
            ]);

            dailyData.push({
                date: dayStart.toISOString().split('T')[0],
                sales: Number(orderTotal._sum.total || 0),
                orders: orderTotal._count,
                consumption: Math.abs(Number(consumptionTotal._sum.quantity || 0)),
            });
        }

        res.json({
            days: Number(days),
            trend: dailyData,
        });
    } catch (error) {
        console.error('Inventory sales trend error:', error);
        res.status(500).json({ error: 'Failed to get inventory sales trend' });
    }
});

export default router;
