// Inventory Routes - Supabase Version
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();

// Helper: Update stock status based on quantity
const calculateStockStatus = (quantity: number, minStock: number, safetyStock: number) => {
    if (quantity <= 0) return 'OUT_OF_STOCK';
    if (quantity <= minStock * 0.5) return 'CRITICAL';
    if (quantity <= minStock) return 'LOW_STOCK';
    return 'SUFFICIENT';
};

// Helper: Create stock alert if needed
const createStockAlertIfNeeded = async (
    sb: any,
    item: any,
    branchId: string
) => {
    const quantity = Number(item.quantity);
    const minStock = Number(item.min_stock);
    let alertType: string | null = null;
    let message = '';

    if (quantity <= 0) {
        alertType = 'OUT_OF_STOCK';
        message = `${item.name} is out of stock!`;
    } else if (quantity <= minStock * 0.5) {
        alertType = 'CRITICAL';
        message = `${item.name} stock is critical! Only ${quantity} ${item.unit} remaining.`;
    } else if (quantity <= minStock) {
        alertType = 'LOW_STOCK';
        message = `${item.name} is running low. Current: ${quantity} ${item.unit}`;
    }

    if (alertType) {
        const { data: existing } = await sb
            .from('stock_alerts')
            .select('id')
            .eq('inventory_item_id', item.id)
            .eq('alert_type', alertType)
            .eq('is_read', false)
            .limit(1)
            .single();

        if (!existing) {
            await sb.from('stock_alerts').insert({
                branch_id: branchId,
                inventory_item_id: item.id,
                alert_type: alertType,
                message,
            });
        }
    }
};

// Helper: Transform inventory item for frontend
const transformItem = (item: any) => ({
    id: item.id,
    branchId: item.branch_id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    minStock: item.min_stock,
    safetyStock: item.safety_stock,
    reservedQty: item.reserved_qty,
    costPerUnit: item.cost_per_unit,
    expiryDate: item.expiry_date,
    stockStatus: item.stock_status,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    ingredients: item.item_ingredients,
    _count: {
        transactions: item.stock_transactions?.length || 0,
        alerts: item.stock_alerts?.length || 0,
    },
});

// Get all inventory items
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { category, stockStatus, search, showInactive } = req.query;

        let query = sb
            .from('inventory_items')
            .select('*')
            .eq('branch_id', req.user!.branchId)
            .order('name', { ascending: true });

        if (!showInactive) query = query.eq('is_active', true);
        if (category) query = query.eq('category', category);
        if (stockStatus) query = query.eq('stock_status', stockStatus);
        if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);

        const { data: items, error } = await query;
        if (error) throw error;

        res.json((items || []).map(transformItem));
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to get inventory' });
    }
});

// Dashboard widget summary
router.get('/dashboard-summary', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = req.user!.branchId;

        const [totalRes, outRes, critRes, lowRes, alertsRes] = await Promise.all([
            sb.from('inventory_items').select('*', { count: 'exact', head: true })
                .eq('branch_id', branchId).eq('is_active', true),
            sb.from('inventory_items').select('*', { count: 'exact', head: true })
                .eq('branch_id', branchId).eq('is_active', true).eq('stock_status', 'OUT_OF_STOCK'),
            sb.from('inventory_items').select('*', { count: 'exact', head: true })
                .eq('branch_id', branchId).eq('is_active', true).eq('stock_status', 'CRITICAL'),
            sb.from('inventory_items').select('*', { count: 'exact', head: true })
                .eq('branch_id', branchId).eq('is_active', true).eq('stock_status', 'LOW_STOCK'),
            sb.from('stock_alerts').select('*', { count: 'exact', head: true })
                .eq('branch_id', branchId).eq('is_read', false),
        ]);

        const totalItems = totalRes.count || 0;
        const outOfStock = outRes.count || 0;
        const critical = critRes.count || 0;
        const lowStock = lowRes.count || 0;

        res.json({
            totalItems,
            outOfStock,
            critical,
            lowStock,
            sufficient: totalItems - outOfStock - critical - lowStock,
            unreadAlerts: alertsRes.count || 0,
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
});

// Get single inventory item
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: item, error } = await sb
            .from('inventory_items')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Get transactions
        const { data: transactions } = await sb
            .from('stock_transactions')
            .select('*')
            .eq('inventory_item_id', id)
            .order('created_at', { ascending: false })
            .limit(50);

        // Get alerts
        const { data: alerts } = await sb
            .from('stock_alerts')
            .select('*')
            .eq('inventory_item_id', id)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({
            ...transformItem(item),
            transactions: transactions || [],
            alerts: alerts || [],
        });
    } catch (error) {
        console.error('Get inventory item error:', error);
        res.status(500).json({ error: 'Failed to get inventory item' });
    }
});

// Create new inventory item
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { sku, name, category, unit, quantity, minStock, safetyStock, costPerUnit, expiryDate } = req.body;
        const branchId = req.user!.branchId;

        const stockStatus = calculateStockStatus(
            Number(quantity || 0),
            Number(minStock || 0),
            Number(safetyStock || 0)
        );

        const { data: item, error } = await sb
            .from('inventory_items')
            .insert({
                branch_id: branchId,
                sku,
                name,
                category: category || 'INGREDIENT',
                unit,
                quantity: quantity || 0,
                min_stock: minStock || 0,
                safety_stock: safetyStock || 0,
                cost_per_unit: costPerUnit || 0,
                expiry_date: expiryDate || null,
                stock_status: stockStatus,
            })
            .select()
            .single();

        if (error) throw error;

        // Create initial stock transaction
        if (quantity > 0) {
            await sb.from('stock_transactions').insert({
                inventory_item_id: item.id,
                type: 'PURCHASE',
                quantity: quantity,
                previous_qty: 0,
                new_qty: quantity,
                reason: 'Initial stock entry',
                performed_by_id: req.user!.id,
            });
        }

        await createStockAlertIfNeeded(sb, item, branchId);

        res.status(201).json(transformItem(item));
    } catch (error) {
        console.error('Create inventory item error:', error);
        res.status(500).json({ error: 'Failed to create inventory item' });
    }
});

// Update inventory item
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { sku, name, category, unit, minStock, safetyStock, costPerUnit, expiryDate, isActive } = req.body;

        const { data: existing } = await sb
            .from('inventory_items')
            .select('*')
            .eq('id', id)
            .single();

        if (!existing) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        const stockStatus = calculateStockStatus(
            Number(existing.quantity),
            Number(minStock ?? existing.min_stock),
            Number(safetyStock ?? existing.safety_stock)
        );

        const { data: item, error } = await sb
            .from('inventory_items')
            .update({
                sku,
                name,
                category,
                unit,
                min_stock: minStock,
                safety_stock: safetyStock,
                cost_per_unit: costPerUnit,
                expiry_date: expiryDate || null,
                is_active: isActive,
                stock_status: stockStatus,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await createStockAlertIfNeeded(sb, item, req.user!.branchId);

        res.json(transformItem(item));
    } catch (error) {
        console.error('Update inventory item error:', error);
        res.status(500).json({ error: 'Failed to update inventory item' });
    }
});

// Delete inventory item
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { count } = await sb
            .from('item_ingredients')
            .select('*', { count: 'exact', head: true })
            .eq('inventory_item_id', id);

        if (count && count > 0) {
            return res.status(400).json({
                error: 'Cannot delete item with menu mappings. Remove mappings first.',
            });
        }

        const { error } = await sb.from('inventory_items').delete().eq('id', id);
        if (error) throw error;

        res.json({ message: 'Inventory item deleted' });
    } catch (error) {
        console.error('Delete inventory item error:', error);
        res.status(500).json({ error: 'Failed to delete inventory item' });
    }
});

// Adjust stock
router.post('/:id/adjust', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { adjustmentType, quantity, reason } = req.body;
        const userRole = req.user!.role;

        const { data: item, error: fetchError } = await sb
            .from('inventory_items')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Direct adjustment for owners
        if (['OWNER', 'SUPER_ADMIN', 'owner'].includes(userRole)) {
            const previousQty = Number(item.quantity);
            const adjustQty = Number(quantity);
            const newQty = adjustmentType === 'INCREASE'
                ? previousQty + adjustQty
                : Math.max(0, previousQty - adjustQty);

            const { data: updatedItem, error } = await sb
                .from('inventory_items')
                .update({
                    quantity: newQty,
                    stock_status: calculateStockStatus(newQty, Number(item.min_stock), Number(item.safety_stock)),
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            await sb.from('stock_transactions').insert({
                inventory_item_id: id,
                type: 'ADJUSTMENT',
                quantity: adjustmentType === 'INCREASE' ? adjustQty : -adjustQty,
                previous_qty: previousQty,
                new_qty: newQty,
                reason,
                performed_by_id: req.user!.id,
                approved_by_id: req.user!.id,
            });

            await createStockAlertIfNeeded(sb, updatedItem, req.user!.branchId);

            return res.json({ approved: true, item: transformItem(updatedItem) });
        }

        // Others need approval
        const { data: request, error: reqError } = await sb
            .from('stock_approval_requests')
            .insert({
                inventory_item_id: id,
                requested_by_id: req.user!.id,
                adjustment_type: adjustmentType,
                adjustment_qty: quantity,
                reason,
            })
            .select()
            .single();

        if (reqError) throw reqError;

        res.json({ approved: false, message: 'Adjustment request submitted for approval', request });
    } catch (error) {
        console.error('Adjust stock error:', error);
        res.status(500).json({ error: 'Failed to adjust stock' });
    }
});

// Get stock alerts
router.get('/alerts/list', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { unreadOnly = 'true' } = req.query;

        let query = sb
            .from('stock_alerts')
            .select(`
                *,
                inventory_items (id, name, quantity, unit)
            `)
            .eq('branch_id', req.user!.branchId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (unreadOnly === 'true') query = query.eq('is_read', false);

        const { data: alerts, error } = await query;
        if (error) throw error;

        res.json(alerts || []);
    } catch (error) {
        console.error('Get stock alerts error:', error);
        res.status(500).json({ error: 'Failed to get stock alerts' });
    }
});

// Mark alert as read
router.patch('/alerts/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        await sb.from('stock_alerts').update({ is_read: true }).eq('id', id);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark alert read error:', error);
        res.status(500).json({ error: 'Failed to mark alert as read' });
    }
});

// Mark all alerts as read
router.post('/alerts/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        await sb
            .from('stock_alerts')
            .update({ is_read: true })
            .eq('branch_id', req.user!.branchId)
            .eq('is_read', false);

        res.json({ success: true });
    } catch (error) {
        console.error('Mark all alerts read error:', error);
        res.status(500).json({ error: 'Failed to mark all alerts as read' });
    }
});

// Consume stock (called after order is created)
router.post('/consume', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { orderId, items } = req.body;
        const branchId = req.user!.branchId;
        const consumedItems: any[] = [];

        for (const orderItem of items) {
            const { data: ingredients } = await sb
                .from('item_ingredients')
                .select('*, inventory_items (*)')
                .eq('menu_item_id', orderItem.menuItemId);

            for (const ing of ingredients || []) {
                const consumeQty = Number(ing.quantity_used) * orderItem.quantity;
                const previousQty = Number(ing.inventory_items.quantity);
                const newQty = Math.max(0, previousQty - consumeQty);

                await sb
                    .from('inventory_items')
                    .update({
                        quantity: newQty,
                        stock_status: calculateStockStatus(newQty, Number(ing.inventory_items.min_stock), Number(ing.inventory_items.safety_stock)),
                    })
                    .eq('id', ing.inventory_items.id);

                await sb.from('stock_transactions').insert({
                    inventory_item_id: ing.inventory_items.id,
                    type: 'CONSUMPTION',
                    quantity: -consumeQty,
                    previous_qty: previousQty,
                    new_qty: newQty,
                    reason: `Order #${orderId}`,
                    order_id: orderId,
                    performed_by_id: req.user!.id,
                });

                consumedItems.push({
                    inventoryItemId: ing.inventory_items.id,
                    name: ing.inventory_items.name,
                    consumed: consumeQty,
                    remaining: newQty,
                });
            }
        }

        res.json({ success: true, consumedItems });
    } catch (error) {
        console.error('Consume stock error:', error);
        res.status(500).json({ error: 'Failed to consume stock' });
    }
});

// Link menu item to inventory (item ingredient mapping)
router.post('/link-menu-item', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { menuItemId, inventoryItemId, quantityUsed, unit } = req.body;

        const { data: link, error } = await sb
            .from('item_ingredients')
            .insert({
                menu_item_id: menuItemId,
                inventory_item_id: inventoryItemId,
                quantity_used: quantityUsed,
                unit,
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(link);
    } catch (error) {
        console.error('Link menu item error:', error);
        res.status(500).json({ error: 'Failed to link menu item' });
    }
});

// Remove menu item link
router.delete('/link/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        await sb.from('item_ingredients').delete().eq('id', id);

        res.json({ message: 'Link removed' });
    } catch (error) {
        console.error('Remove link error:', error);
        res.status(500).json({ error: 'Failed to remove link' });
    }
});

export default router;
