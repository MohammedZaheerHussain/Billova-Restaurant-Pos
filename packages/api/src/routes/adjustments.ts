// Stock Adjustments API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// Get all stock adjustments
router.get('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const { status, type } = req.query;

        let query = sb
            .from('stock_adjustments')
            .select('*, inventory_items (id, name, unit, sku)')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (status) query = query.eq('status', status);
        if (type) query = query.eq('adjustment_type', type);

        const { data: adjustments, error } = await query;
        if (error) throw error;

        res.json(adjustments || []);
    } catch (error) {
        logger.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Failed to fetch adjustments' });
    }
});

// Create stock adjustment
router.post('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { inventoryItemId, warehouseId, fromBinId, toBinId, adjustmentType, quantity, reason, notes, batchNumber } = req.body;

        const { data: adjustment, error } = await sb
            .from('stock_adjustments')
            .insert({
                branch_id: branchId,
                inventory_item_id: inventoryItemId,
                warehouse_id: warehouseId,
                from_bin_id: fromBinId,
                to_bin_id: toBinId,
                adjustment_type: adjustmentType,
                quantity,
                reason,
                notes,
                batch_number: batchNumber,
                performed_by: userId,
            })
            .select('*, inventory_items (name, unit)')
            .single();

        if (error) throw error;

        res.status(201).json(adjustment);
    } catch (error) {
        logger.error('Error creating adjustment:', error);
        res.status(500).json({ error: 'Failed to create adjustment' });
    }
});

// Approve stock adjustment
router.put('/:id/approve', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const userId = (req as any).user.id;

        const { data: adjustment, error: fetchError } = await sb
            .from('stock_adjustments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !adjustment) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ error: 'Adjustment already processed' });
        }

        // Update adjustment status
        const { data: updated, error: updateError } = await sb
            .from('stock_adjustments')
            .update({
                status: 'APPROVED',
                approved_by: userId,
                processed_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Determine transaction type
        let transactionType = 'ADJUSTMENT';
        if (['DAMAGE', 'EXPIRED', 'WASTAGE', 'PRODUCTION_USE'].includes(adjustment.adjustment_type)) {
            transactionType = adjustment.adjustment_type;
        }

        // Update warehouse stock
        if (adjustment.warehouse_id) {
            const { data: warehouseStock } = await sb
                .from('warehouse_stocks')
                .select('quantity')
                .eq('warehouse_id', adjustment.warehouse_id)
                .eq('inventory_item_id', adjustment.inventory_item_id)
                .single();

            if (warehouseStock) {
                await sb
                    .from('warehouse_stocks')
                    .update({ quantity: Math.max(0, Number(warehouseStock.quantity) - Number(adjustment.quantity)) })
                    .eq('warehouse_id', adjustment.warehouse_id)
                    .eq('inventory_item_id', adjustment.inventory_item_id);
            }
        }

        // Update main inventory
        const { data: invItem } = await sb
            .from('inventory_items')
            .select('quantity')
            .eq('id', adjustment.inventory_item_id)
            .single();

        if (invItem) {
            await sb
                .from('inventory_items')
                .update({ quantity: Math.max(0, Number(invItem.quantity) - Number(adjustment.quantity)) })
                .eq('id', adjustment.inventory_item_id);
        }

        // Create stock transaction for audit
        await sb.from('stock_transactions').insert({
            inventory_item_id: adjustment.inventory_item_id,
            type: transactionType,
            quantity: Number(adjustment.quantity),
            reason: adjustment.reason,
            performed_by_id: adjustment.performed_by,
            approved_by_id: userId,
        });

        res.json(updated);
    } catch (error) {
        logger.error('Error approving adjustment:', error);
        res.status(500).json({ error: 'Failed to approve adjustment' });
    }
});

// Reject stock adjustment
router.put('/:id/reject', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { reason } = req.body;

        const { data: adjustment, error } = await sb
            .from('stock_adjustments')
            .update({
                status: 'REJECTED',
                approved_by: userId,
                processed_at: new Date().toISOString(),
                notes: reason,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(adjustment);
    } catch (error) {
        logger.error('Error rejecting adjustment:', error);
        res.status(500).json({ error: 'Failed to reject adjustment' });
    }
});

// Get adjustment summary stats
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        // Supabase doesn't have groupBy, so we fetch all and aggregate in JS
        const { data: adjustments, error } = await sb
            .from('stock_adjustments')
            .select('adjustment_type, status, quantity')
            .eq('branch_id', branchId);

        if (error) throw error;

        // Aggregate stats
        const stats: Record<string, { count: number; totalQty: number }> = {};
        for (const adj of adjustments || []) {
            const key = `${adj.adjustment_type}-${adj.status}`;
            if (!stats[key]) {
                stats[key] = { count: 0, totalQty: 0 };
            }
            stats[key].count++;
            stats[key].totalQty += Number(adj.quantity) || 0;
        }

        res.json(Object.entries(stats).map(([key, value]) => {
            const [adjustmentType, status] = key.split('-');
            return { adjustmentType, status, _count: value.count, _sum: { quantity: value.totalQty } };
        }));
    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
