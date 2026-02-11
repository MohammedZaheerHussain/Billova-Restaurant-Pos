// Purchase Requests API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

router.use(authMiddleware);

// Get all purchase requests
router.get('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const { status } = req.query;

        let query = sb
            .from('purchase_requests')
            .select('*, purchase_request_items (*, inventory_items (name, unit))')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (status) query = query.eq('status', status);

        const { data: requests, error } = await query;
        if (error) throw error;

        res.json(requests || []);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Create purchase request
router.post('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { items, notes, priority } = req.body;

        // Get next request number
        const { data: lastRequests } = await sb
            .from('purchase_requests')
            .select('request_number')
            .eq('branch_id', branchId)
            .order('request_number', { ascending: false })
            .limit(1);

        const requestNumber = (lastRequests?.[0]?.request_number || 0) + 1;

        const { data: request, error } = await sb
            .from('purchase_requests')
            .insert({
                branch_id: branchId,
                request_number: requestNumber,
                requested_by: userId,
                notes,
                priority: priority || 'NORMAL',
            })
            .select()
            .single();

        if (error) throw error;

        // Create request items
        if (items && items.length > 0) {
            await sb.from('purchase_request_items').insert(
                items.map((item: any) => ({
                    request_id: request.id,
                    inventory_item_id: item.inventoryItemId,
                    quantity: item.quantity,
                    notes: item.notes,
                }))
            );
        }

        const { data: fullRequest } = await sb
            .from('purchase_requests')
            .select('*, purchase_request_items (*)')
            .eq('id', request.id)
            .single();

        res.status(201).json(fullRequest);
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Update request status
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED' || status === 'REJECTED') {
            updateData.approved_by = userId;
            updateData.approved_at = new Date().toISOString();
        }

        const { data: request, error } = await sb
            .from('purchase_requests')
            .update(updateData)
            .eq('id', id)
            .select('*, purchase_request_items (*)')
            .single();

        if (error) throw error;

        res.json(request);
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// Delete request
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Delete items first
        await sb.from('purchase_request_items').delete().eq('request_id', id);
        await sb.from('purchase_requests').delete().eq('id', id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ error: 'Failed to delete request' });
    }
});

export default router;
