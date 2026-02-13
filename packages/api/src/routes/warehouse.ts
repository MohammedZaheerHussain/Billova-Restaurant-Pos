// Warehouse & Stock Transfer API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// ==================== STOCK TRANSFERS ====================

// Get all transfers
router.get('/transfers', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        const { data: transfers, error } = await sb
            .from('stock_transfers')
            .select(`
                *,
                from_warehouse:warehouses!from_warehouse_id (id, name),
                to_warehouse:warehouses!to_warehouse_id (id, name),
                stock_transfer_items (*, inventory_items (name, unit))
            `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json(transfers || []);
    } catch (error) {
        logger.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

// Create transfer request
router.post('/transfers', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { fromWarehouseId, toWarehouseId, items, notes } = req.body;

        // Get next transfer number
        const { data: lastTransfers } = await sb
            .from('stock_transfers')
            .select('transfer_number')
            .eq('branch_id', branchId)
            .order('transfer_number', { ascending: false })
            .limit(1);

        const transferNumber = (lastTransfers?.[0]?.transfer_number || 0) + 1;

        const { data: transfer, error } = await sb
            .from('stock_transfers')
            .insert({
                branch_id: branchId,
                from_warehouse_id: fromWarehouseId,
                to_warehouse_id: toWarehouseId,
                transfer_number: transferNumber,
                requested_by: userId,
                notes,
            })
            .select()
            .single();

        if (error) throw error;

        // Create transfer items
        if (items && items.length > 0) {
            await sb.from('stock_transfer_items').insert(
                items.map((item: any) => ({
                    transfer_id: transfer.id,
                    inventory_item_id: item.inventoryItemId,
                    quantity: item.quantity,
                }))
            );
        }

        res.status(201).json(transfer);
    } catch (error) {
        logger.error('Error creating transfer:', error);
        res.status(500).json({ error: 'Failed to create transfer' });
    }
});

// Update transfer status
router.put('/transfers/:id/status', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED') {
            updateData.approved_by = userId;
            updateData.approved_at = new Date().toISOString();
        } else if (status === 'COMPLETED') {
            updateData.completed_at = new Date().toISOString();

            // Get transfer with items
            const { data: transfer } = await sb
                .from('stock_transfers')
                .select('*, stock_transfer_items (*)')
                .eq('id', id)
                .single();

            if (transfer) {
                for (const item of transfer.stock_transfer_items || []) {
                    // Reduce from source
                    const { data: sourceStock } = await sb
                        .from('warehouse_stocks')
                        .select('quantity')
                        .eq('warehouse_id', transfer.from_warehouse_id)
                        .eq('inventory_item_id', item.inventory_item_id)
                        .single();

                    if (sourceStock) {
                        await sb
                            .from('warehouse_stocks')
                            .update({ quantity: Math.max(0, Number(sourceStock.quantity) - item.quantity) })
                            .eq('warehouse_id', transfer.from_warehouse_id)
                            .eq('inventory_item_id', item.inventory_item_id);
                    }

                    // Add to destination (upsert)
                    const { data: destStock } = await sb
                        .from('warehouse_stocks')
                        .select('quantity')
                        .eq('warehouse_id', transfer.to_warehouse_id)
                        .eq('inventory_item_id', item.inventory_item_id)
                        .single();

                    if (destStock) {
                        await sb
                            .from('warehouse_stocks')
                            .update({ quantity: Number(destStock.quantity) + item.quantity })
                            .eq('warehouse_id', transfer.to_warehouse_id)
                            .eq('inventory_item_id', item.inventory_item_id);
                    } else {
                        await sb.from('warehouse_stocks').insert({
                            warehouse_id: transfer.to_warehouse_id,
                            inventory_item_id: item.inventory_item_id,
                            quantity: item.quantity,
                        });
                    }
                }
            }
        }

        const { data: updated, error } = await sb
            .from('stock_transfers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(updated);
    } catch (error) {
        logger.error('Error updating transfer:', error);
        res.status(500).json({ error: 'Failed to update transfer' });
    }
});

// ==================== WAREHOUSES ====================

// Get all warehouses
router.get('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        const { data: warehouses, error } = await sb
            .from('warehouses')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .order('is_main', { ascending: false })
            .order('name', { ascending: true });

        if (error) throw error;

        res.json(warehouses || []);
    } catch (error) {
        logger.error('Error fetching warehouses:', error);
        res.status(500).json({ error: 'Failed to fetch warehouses' });
    }
});

// Create warehouse
router.post('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const { name, address, isMain } = req.body;

        if (isMain) {
            await sb
                .from('warehouses')
                .update({ is_main: false })
                .eq('branch_id', branchId)
                .eq('is_main', true);
        }

        const { data: warehouse, error } = await sb
            .from('warehouses')
            .insert({ branch_id: branchId, name, address, is_main: isMain || false })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(warehouse);
    } catch (error) {
        logger.error('Error creating warehouse:', error);
        res.status(500).json({ error: 'Failed to create warehouse' });
    }
});

// Update warehouse
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const branchId = (req as any).user.branchId;
        const { name, address, isMain, isActive } = req.body;

        if (isMain) {
            await sb
                .from('warehouses')
                .update({ is_main: false })
                .eq('branch_id', branchId)
                .eq('is_main', true)
                .neq('id', id);
        }

        const { data: warehouse, error } = await sb
            .from('warehouses')
            .update({ name, address, is_main: isMain, is_active: isActive })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(warehouse);
    } catch (error) {
        logger.error('Error updating warehouse:', error);
        res.status(500).json({ error: 'Failed to update warehouse' });
    }
});

// Get warehouse stock
router.get('/:id/stock', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: stock, error } = await sb
            .from('warehouse_stocks')
            .select('*, inventory_items (id, name, unit, category)')
            .eq('warehouse_id', id)
            .order('inventory_items(name)', { ascending: true });

        if (error) throw error;

        res.json(stock || []);
    } catch (error) {
        logger.error('Error fetching warehouse stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock' });
    }
});

// Update stock in warehouse
router.post('/:id/stock', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id: warehouseId } = req.params;
        const { inventoryItemId, quantity } = req.body;

        // Check if exists
        const { data: existing } = await sb
            .from('warehouse_stocks')
            .select('id')
            .eq('warehouse_id', warehouseId)
            .eq('inventory_item_id', inventoryItemId)
            .single();

        let stock;
        if (existing) {
            const { data, error } = await sb
                .from('warehouse_stocks')
                .update({ quantity })
                .eq('warehouse_id', warehouseId)
                .eq('inventory_item_id', inventoryItemId)
                .select()
                .single();
            if (error) throw error;
            stock = data;
        } else {
            const { data, error } = await sb
                .from('warehouse_stocks')
                .insert({ warehouse_id: warehouseId, inventory_item_id: inventoryItemId, quantity })
                .select()
                .single();
            if (error) throw error;
            stock = data;
        }

        res.json(stock);
    } catch (error) {
        logger.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock' });
    }
});

// ==================== LOCATION HIERARCHY ====================

// Get zones for warehouse
router.get('/:id/zones', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id: warehouseId } = req.params;

        const { data: zones, error } = await sb
            .from('warehouse_zones')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) throw error;

        res.json(zones || []);
    } catch (error) {
        logger.error('Error fetching zones:', error);
        res.status(500).json({ error: 'Failed to fetch zones' });
    }
});

// Create zone
router.post('/:id/zones', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id: warehouseId } = req.params;
        const { name, code, description } = req.body;

        const { data: zone, error } = await sb
            .from('warehouse_zones')
            .insert({ warehouse_id: warehouseId, name, code, description })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(zone);
    } catch (error) {
        logger.error('Error creating zone:', error);
        res.status(500).json({ error: 'Failed to create zone' });
    }
});

// Get racks for zone
router.get('/zones/:zoneId/racks', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { zoneId } = req.params;

        const { data: racks, error } = await sb
            .from('warehouse_racks')
            .select('*')
            .eq('zone_id', zoneId)
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) throw error;

        res.json(racks || []);
    } catch (error) {
        logger.error('Error fetching racks:', error);
        res.status(500).json({ error: 'Failed to fetch racks' });
    }
});

// Create rack
router.post('/zones/:zoneId/racks', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { zoneId } = req.params;
        const { name, code, levels } = req.body;

        const { data: rack, error } = await sb
            .from('warehouse_racks')
            .insert({ zone_id: zoneId, name, code, levels: levels || 1 })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(rack);
    } catch (error) {
        logger.error('Error creating rack:', error);
        res.status(500).json({ error: 'Failed to create rack' });
    }
});

// Get bins for rack
router.get('/racks/:rackId/bins', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { rackId } = req.params;

        const { data: bins, error } = await sb
            .from('warehouse_bins')
            .select('*')
            .eq('rack_id', rackId)
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) throw error;

        res.json(bins || []);
    } catch (error) {
        logger.error('Error fetching bins:', error);
        res.status(500).json({ error: 'Failed to fetch bins' });
    }
});

// Create bin
router.post('/racks/:rackId/bins', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { rackId } = req.params;
        const { name, code, binType, capacity } = req.body;

        const { data: bin, error } = await sb
            .from('warehouse_bins')
            .insert({ rack_id: rackId, name, code, bin_type: binType || 'STORAGE', capacity })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(bin);
    } catch (error) {
        logger.error('Error creating bin:', error);
        res.status(500).json({ error: 'Failed to create bin' });
    }
});

// Get full location tree
router.get('/:id/locations', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id: warehouseId } = req.params;

        const { data: zones, error } = await sb
            .from('warehouse_zones')
            .select(`
                *,
                warehouse_racks (
                    *,
                    warehouse_bins (*)
                )
            `)
            .eq('warehouse_id', warehouseId)
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) throw error;

        res.json(zones || []);
    } catch (error) {
        logger.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

export default router;
