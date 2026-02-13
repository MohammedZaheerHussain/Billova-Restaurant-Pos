// Delivery API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

router.use(authMiddleware);

// Get delivery orders for driver
router.get('/orders', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const userId = (req as any).user.id;
        const branchId = (req as any).user.branchId;
        const { status } = req.query;

        let query = sb
            .from('delivery_assignments')
            .select(`
                *,
                orders (id, order_number, customer_name, customer_phone, notes, total, created_at, status),
                users!driver_id (id, name, phone)
            `)
            .order('created_at', { ascending: false });

        // If driver, show only assigned orders
        if ((req as any).user.role === 'DRIVER' || (req as any).user.role === 'driver') {
            query = query.eq('driver_id', userId);
        }

        if (status) query = query.eq('status', status);

        const { data: assignments, error } = await query;

        // Gracefully handle missing table (table may not exist yet in some deployments)
        if (error) {
            if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                logger.warn('[Delivery] delivery_assignments table not found — returning empty array');
                return res.json([]);
            }
            throw error;
        }

        res.json(assignments || []);
    } catch (error) {
        logger.error('Error fetching delivery orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Assign driver to order
router.post('/assign', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { orderId, driverId } = req.body;

        // Check if assignment exists
        const { data: existing } = await sb
            .from('delivery_assignments')
            .select('id')
            .eq('order_id', orderId)
            .single();

        let assignment;
        if (existing) {
            const { data, error } = await sb
                .from('delivery_assignments')
                .update({ driver_id: driverId })
                .eq('order_id', orderId)
                .select()
                .single();
            if (error) throw error;
            assignment = data;
        } else {
            const { data, error } = await sb
                .from('delivery_assignments')
                .insert({ order_id: orderId, driver_id: driverId, status: 'ASSIGNED' })
                .select()
                .single();
            if (error) throw error;
            assignment = data;
        }

        res.json(assignment);
    } catch (error) {
        logger.error('Error assigning driver:', error);
        res.status(500).json({ error: 'Failed to assign driver' });
    }
});

// Update delivery status (for driver app)
router.put('/orders/:id/status', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { status, notes } = req.body;

        const updateData: any = { status };

        if (status === 'PICKED_UP') {
            updateData.picked_up_at = new Date().toISOString();
        } else if (status === 'DELIVERED') {
            updateData.delivered_at = new Date().toISOString();

            // Get assignment to update order
            const { data: assignment } = await sb
                .from('delivery_assignments')
                .select('order_id')
                .eq('id', id)
                .single();

            if (assignment) {
                await sb
                    .from('orders')
                    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                    .eq('id', assignment.order_id);
            }
        }

        if (notes) updateData.notes = notes;

        const { data: updated, error } = await sb
            .from('delivery_assignments')
            .update(updateData)
            .eq('id', id)
            .select('*, orders (order_number, customer_name)')
            .single();

        if (error) throw error;

        res.json(updated);
    } catch (error) {
        logger.error('Error updating delivery:', error);
        res.status(500).json({ error: 'Failed to update delivery' });
    }
});

// Get available drivers
router.get('/drivers', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        const { data: drivers, error } = await sb
            .from('profiles')
            .select('id, name, phone')
            .eq('branch_id', branchId)
            .eq('role', 'driver')
            .eq('is_active', true);

        if (error) throw error;

        res.json(drivers || []);
    } catch (error) {
        logger.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

export default router;
