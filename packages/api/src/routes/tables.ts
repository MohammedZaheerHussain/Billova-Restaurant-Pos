// Table Routes (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import crypto from 'crypto';

const router = Router();

// Get all tables
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: tables, error } = await sb
            .from('tables')
            .select('*')
            .eq('branch_id', req.user!.branchId)
            .order('name', { ascending: true });

        if (error) throw error;

        // Get active orders for each table
        const tablesWithOrders = await Promise.all((tables || []).map(async (table: any) => {
            const { data: orders } = await sb
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('table_id', table.id)
                .in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'])
                .order('created_at', { ascending: false })
                .limit(1);

            return {
                id: table.id,
                branchId: table.branch_id,
                name: table.name,
                capacity: table.capacity,
                status: table.status,
                qrToken: table.qr_token,
                createdAt: table.created_at,
                orders: orders || [],
            };
        }));

        res.json(tablesWithOrders);
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: 'Failed to get tables' });
    }
});

// Update table status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { status } = req.body;

        const { data: table, error } = await sb
            .from('tables')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: table.id,
            branchId: table.branch_id,
            name: table.name,
            capacity: table.capacity,
            status: table.status,
        });
    } catch (error) {
        console.error('Update table status error:', error);
        res.status(500).json({ error: 'Failed to update table status' });
    }
});

// Create table
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { name, capacity } = req.body;

        const { data: table, error } = await sb
            .from('tables')
            .insert({
                branch_id: req.user!.branchId,
                name,
                capacity: capacity || 4,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            id: table.id,
            branchId: table.branch_id,
            name: table.name,
            capacity: table.capacity,
            status: table.status,
        });
    } catch (error) {
        console.error('Create table error:', error);
        res.status(500).json({ error: 'Failed to create table' });
    }
});

// Delete table
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { error } = await sb
            .from('tables')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Table deleted' });
    } catch (error) {
        console.error('Delete table error:', error);
        res.status(500).json({ error: 'Failed to delete table' });
    }
});

// Generate QR token for table
router.post('/:id/qr-token', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Generate unique token
        const qrToken = crypto.randomBytes(8).toString('hex');

        const { data: table, error } = await sb
            .from('tables')
            .update({ qr_token: qrToken })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Build QR URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const qrUrl = `${frontendUrl}/order/${qrToken}`;

        res.json({
            qrToken,
            qrUrl,
            table: { id: table.id, name: table.name }
        });
    } catch (error) {
        console.error('Generate QR token error:', error);
        res.status(500).json({ error: 'Failed to generate QR token' });
    }
});

// Remove QR token from table
router.delete('/:id/qr-token', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { error } = await sb
            .from('tables')
            .update({ qr_token: null })
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'QR token removed' });
    } catch (error) {
        console.error('Remove QR token error:', error);
        res.status(500).json({ error: 'Failed to remove QR token' });
    }
});

export default router;
