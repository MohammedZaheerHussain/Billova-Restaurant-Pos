// Addons API Routes (Supabase)
import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// Get all addons for the branch
router.get('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user?.branchId;

        const { data: addons, error } = await sb
            .from('menu_item_addons')
            .select('*')
            .eq('branch_id', branchId)
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        res.json((addons || []).map((a: any) => ({
            id: a.id,
            branchId: a.branch_id,
            name: a.name,
            price: a.price,
            category: a.category,
            isActive: a.is_active,
        })));
    } catch (error) {
        next(error);
    }
});

// Create new addon
router.post('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user?.branchId;
        const { name, price, category } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Addon name is required' });
        }

        const { data: addon, error } = await sb
            .from('menu_item_addons')
            .insert({
                branch_id: branchId,
                name,
                price: parseFloat(price) || 0,
                category: category || 'Extras',
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            id: addon.id,
            branchId: addon.branch_id,
            name: addon.name,
            price: addon.price,
            category: addon.category,
            isActive: addon.is_active,
        });
    } catch (error) {
        next(error);
    }
});

// Update addon
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, price, category, isActive } = req.body;

        const { data: addon, error } = await sb
            .from('menu_item_addons')
            .update({
                name,
                price: parseFloat(price) || 0,
                category,
                is_active: isActive,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: addon.id,
            branchId: addon.branch_id,
            name: addon.name,
            price: addon.price,
            category: addon.category,
            isActive: addon.is_active,
        });
    } catch (error) {
        next(error);
    }
});

// Delete addon
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { error } = await sb.from('menu_item_addons').delete().eq('id', id);
        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Get addons linked to a menu item
router.get('/menu-item/:menuItemId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { menuItemId } = req.params;

        const { data: links, error } = await sb
            .from('menu_item_addon_links')
            .select('*, menu_item_addons (*)')
            .eq('menu_item_id', menuItemId);

        if (error) throw error;

        res.json((links || []).map((l: any) => l.menu_item_addons));
    } catch (error) {
        next(error);
    }
});

// Link addons to a menu item
router.post('/menu-item/:menuItemId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { menuItemId } = req.params;
        const { addonIds } = req.body;

        if (!Array.isArray(addonIds)) {
            return res.status(400).json({ error: 'addonIds must be an array' });
        }

        // Delete existing links
        await sb.from('menu_item_addon_links').delete().eq('menu_item_id', menuItemId);

        // Create new links
        if (addonIds.length > 0) {
            await sb.from('menu_item_addon_links').insert(
                addonIds.map((addonId: string) => ({
                    menu_item_id: menuItemId,
                    addon_id: addonId,
                }))
            );
        }

        // Fetch updated links
        const { data: links } = await sb
            .from('menu_item_addon_links')
            .select('*, menu_item_addons (*)')
            .eq('menu_item_id', menuItemId);

        res.json((links || []).map((l: any) => l.menu_item_addons));
    } catch (error) {
        next(error);
    }
});

export default router;
