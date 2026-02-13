// Combo Routes (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Get all combos
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { branchId } = req.query;

        let query = sb
            .from('combos')
            .select('*, combo_items (*)')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data: combos, error } = await query;
        if (error) throw error;

        res.json((combos || []).map((c: any) => ({
            id: c.id,
            branchId: c.branch_id,
            name: c.name,
            description: c.description,
            price: c.price,
            image: c.image,
            isActive: c.is_active,
            items: c.combo_items,
        })));
    } catch (error) {
        logger.error('Get combos error:', error);
        res.status(500).json({ error: 'Failed to get combos' });
    }
});

// Create combo
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { name, description, price, image, items } = req.body;

        const { data: combo, error } = await sb
            .from('combos')
            .insert({
                branch_id: req.user!.branchId,
                name,
                description,
                price,
                image,
            })
            .select()
            .single();

        if (error) throw error;

        // Create combo items
        if (items && items.length > 0) {
            await sb.from('combo_items').insert(
                items.map((item: string) => ({
                    combo_id: combo.id,
                    item_name: item,
                }))
            );
        }

        const { data: comboWithItems } = await sb
            .from('combos')
            .select('*, combo_items (*)')
            .eq('id', combo.id)
            .single();

        res.status(201).json({
            id: comboWithItems.id,
            branchId: comboWithItems.branch_id,
            name: comboWithItems.name,
            description: comboWithItems.description,
            price: comboWithItems.price,
            image: comboWithItems.image,
            isActive: comboWithItems.is_active,
            items: comboWithItems.combo_items,
        });
    } catch (error) {
        logger.error('Create combo error:', error);
        res.status(500).json({ error: 'Failed to create combo' });
    }
});

// Update combo
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, description, price, image, isActive } = req.body;

        const { data: combo, error } = await sb
            .from('combos')
            .update({
                name,
                description,
                price,
                image,
                is_active: isActive,
            })
            .eq('id', id)
            .select('*, combo_items (*)')
            .single();

        if (error) throw error;

        res.json({
            id: combo.id,
            branchId: combo.branch_id,
            name: combo.name,
            description: combo.description,
            price: combo.price,
            image: combo.image,
            isActive: combo.is_active,
            items: combo.combo_items,
        });
    } catch (error) {
        logger.error('Update combo error:', error);
        res.status(500).json({ error: 'Failed to update combo' });
    }
});

// Delete combo
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { error } = await sb.from('combos').delete().eq('id', id);
        if (error) throw error;

        res.json({ message: 'Combo deleted' });
    } catch (error) {
        logger.error('Delete combo error:', error);
        res.status(500).json({ error: 'Failed to delete combo' });
    }
});

export default router;
