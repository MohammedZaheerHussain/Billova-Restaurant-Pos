// Category Routes (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Get all categories
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { branchId } = req.query;

        let query = sb
            .from('categories')
            .select(`
                *,
                menu_items (id)
            `)
            .order('sort_order', { ascending: true });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data: categories, error } = await query;

        if (error) throw error;

        // Transform with item count
        const transformed = (categories || []).map((cat: any) => ({
            id: cat.id,
            branchId: cat.branch_id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            sortOrder: cat.sort_order,
            isActive: cat.is_active,
            createdAt: cat.created_at,
            updatedAt: cat.updated_at,
            _count: {
                menuItems: cat.menu_items?.length || 0,
            },
        }));

        res.json(transformed);
    } catch (error) {
        logger.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

// Create category
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { name, icon, color, sortOrder } = req.body;
        const branchId = req.user!.branchId;

        const { data: category, error } = await sb
            .from('categories')
            .insert({
                branch_id: branchId,
                name,
                icon,
                color,
                sort_order: sortOrder || 0,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            id: category.id,
            branchId: category.branch_id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            sortOrder: category.sort_order,
            isActive: category.is_active,
        });
    } catch (error) {
        logger.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, icon, color, sortOrder, isActive } = req.body;

        const { data: category, error } = await sb
            .from('categories')
            .update({
                name,
                icon,
                color,
                sort_order: sortOrder,
                is_active: isActive,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: category.id,
            branchId: category.branch_id,
            name: category.name,
            icon: category.icon,
            color: category.color,
            sortOrder: category.sort_order,
            isActive: category.is_active,
        });
    } catch (error) {
        logger.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Check if category has menu items
        const { count } = await sb
            .from('menu_items')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id);

        if (count && count > 0) {
            return res.status(400).json({ error: 'Cannot delete category with menu items' });
        }

        const { error } = await sb
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Category deleted' });
    } catch (error) {
        logger.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
