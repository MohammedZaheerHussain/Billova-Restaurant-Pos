// Supplier Management API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// Transform supplier for frontend
const transformSupplier = (s: any) => ({
    id: s.id,
    branchId: s.branch_id,
    name: s.name,
    code: s.code,
    phone: s.phone,
    email: s.email,
    address: s.address,
    gstNumber: s.gst_number,
    paymentTerms: s.payment_terms,
    rating: s.rating,
    isActive: s.is_active,
    createdAt: s.created_at,
});

// Get all suppliers
router.get('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        const { data: suppliers, error } = await sb
            .from('suppliers')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        res.json((suppliers || []).map(transformSupplier));
    } catch (error) {
        logger.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
});

// Get single supplier
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: supplier, error } = await sb
            .from('suppliers')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Get recent purchase orders
        const { data: purchaseOrders } = await sb
            .from('purchase_orders')
            .select('*')
            .eq('supplier_id', id)
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({ ...transformSupplier(supplier), purchaseOrders: purchaseOrders || [] });
    } catch (error) {
        logger.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Failed to fetch supplier' });
    }
});

// Create supplier
router.post('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const { name, code, phone, email, address, gstNumber, paymentTerms } = req.body;

        const { data: supplier, error } = await sb
            .from('suppliers')
            .insert({
                branch_id: branchId,
                name,
                code,
                phone,
                email,
                address,
                gst_number: gstNumber,
                payment_terms: paymentTerms,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(transformSupplier(supplier));
    } catch (error) {
        logger.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Failed to create supplier' });
    }
});

// Update supplier
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, code, phone, email, address, gstNumber, paymentTerms, rating, isActive } = req.body;

        const { data: supplier, error } = await sb
            .from('suppliers')
            .update({
                name,
                code,
                phone,
                email,
                address,
                gst_number: gstNumber,
                payment_terms: paymentTerms,
                rating,
                is_active: isActive,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(transformSupplier(supplier));
    } catch (error) {
        logger.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Failed to update supplier' });
    }
});

// Delete supplier (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        await sb.from('suppliers').update({ is_active: false }).eq('id', id);

        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
        logger.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Failed to delete supplier' });
    }
});

export default router;
