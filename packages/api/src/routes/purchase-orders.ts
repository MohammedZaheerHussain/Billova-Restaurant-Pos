// Purchase Orders & GRN API Routes (Supabase)
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// Get all purchase orders
router.get('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;

        const { data: orders, error } = await sb
            .from('supplier_purchase_orders')
            .select(`
                *,
                suppliers (id, name, code),
                supplier_po_items (*, inventory_items (id, name, unit))
            `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        res.json(orders || []);
    } catch (error) {
        logger.error('Error fetching purchase orders:', error);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});

// Get single purchase order
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: order, error } = await sb
            .from('supplier_purchase_orders')
            .select(`
                *,
                suppliers (*),
                supplier_po_items (*, inventory_items (id, name, unit, sku)),
                goods_receipts (*, goods_receipt_items (*, inventory_items (name)))
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        res.json(order);
    } catch (error) {
        logger.error('Error fetching purchase order:', error);
        res.status(500).json({ error: 'Failed to fetch purchase order' });
    }
});

// Create purchase order
router.post('/', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { supplierId, expectedDate, notes, items } = req.body;

        // Get next PO number
        const { data: lastPOs } = await sb
            .from('supplier_purchase_orders')
            .select('po_number')
            .eq('branch_id', branchId)
            .order('po_number', { ascending: false })
            .limit(1);

        const poNumber = (lastPOs?.[0]?.po_number || 0) + 1;

        // Calculate total amount
        const totalAmount = items.reduce((sum: number, item: any) =>
            sum + (item.orderedQty * item.unitPrice), 0);

        const { data: order, error } = await sb
            .from('supplier_purchase_orders')
            .insert({
                branch_id: branchId,
                supplier_id: supplierId,
                po_number: poNumber,
                expected_date: expectedDate || null,
                notes,
                total_amount: totalAmount,
                created_by: userId,
            })
            .select()
            .single();

        if (error) throw error;

        // Create PO items
        if (items && items.length > 0) {
            await sb.from('supplier_po_items').insert(
                items.map((item: any) => ({
                    purchase_order_id: order.id,
                    inventory_item_id: item.inventoryItemId,
                    ordered_qty: item.orderedQty,
                    unit_price: item.unitPrice,
                    notes: item.notes,
                }))
            );
        }

        res.status(201).json(order);
    } catch (error) {
        logger.error('Error creating purchase order:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});

// Update purchase order status
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED') {
            updateData.approved_by = userId;
            updateData.approved_at = new Date().toISOString();
        }

        const { data: order, error } = await sb
            .from('supplier_purchase_orders')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(order);
    } catch (error) {
        logger.error('Error updating PO status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Receive goods (Create GRN)
router.post('/:id/receive', async (req: Request, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id: purchaseOrderId } = req.params;
        const userId = (req as any).user.id;
        const { warehouseId, binId, batchNumber, notes, items } = req.body;

        // Get PO details
        const { data: po, error: poError } = await sb
            .from('supplier_purchase_orders')
            .select('*, supplier_po_items (*)')
            .eq('id', purchaseOrderId)
            .single();

        if (poError || !po) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        // Get next GRN number
        const { data: lastGRNs } = await sb
            .from('goods_receipts')
            .select('grn_number')
            .eq('purchase_order_id', purchaseOrderId)
            .order('grn_number', { ascending: false })
            .limit(1);

        const grnNumber = (lastGRNs?.[0]?.grn_number || 0) + 1;

        // Create GRN
        const { data: grn, error: grnError } = await sb
            .from('goods_receipts')
            .insert({
                purchase_order_id: purchaseOrderId,
                grn_number: grnNumber,
                warehouse_id: warehouseId,
                bin_id: binId,
                batch_number: batchNumber,
                received_by: userId,
                notes,
            })
            .select()
            .single();

        if (grnError) throw grnError;

        // Create GRN items
        await sb.from('goods_receipt_items').insert(
            items.map((item: any) => ({
                grn_id: grn.id,
                inventory_item_id: item.inventoryItemId,
                quantity: item.quantity,
                accepted_qty: item.acceptedQty || item.quantity,
                rejected_qty: item.rejectedQty || 0,
                rejection_reason: item.rejectionReason,
            }))
        );

        // Update PO item received quantities and inventory
        for (const item of items) {
            const poItem = po.supplier_po_items?.find((pi: any) => pi.inventory_item_id === item.inventoryItemId);
            if (poItem) {
                await sb
                    .from('supplier_po_items')
                    .update({ received_qty: (Number(poItem.received_qty) || 0) + (item.acceptedQty || item.quantity) })
                    .eq('id', poItem.id);
            }

            const acceptedQty = item.acceptedQty || item.quantity;

            // Update warehouse stock
            const { data: stock } = await sb
                .from('warehouse_stocks')
                .select('quantity')
                .eq('warehouse_id', warehouseId)
                .eq('inventory_item_id', item.inventoryItemId)
                .single();

            if (stock) {
                await sb
                    .from('warehouse_stocks')
                    .update({
                        quantity: Number(stock.quantity) + acceptedQty,
                        batch_number: batchNumber,
                        bin_id: binId,
                    })
                    .eq('warehouse_id', warehouseId)
                    .eq('inventory_item_id', item.inventoryItemId);
            } else {
                await sb.from('warehouse_stocks').insert({
                    warehouse_id: warehouseId,
                    inventory_item_id: item.inventoryItemId,
                    quantity: acceptedQty,
                    batch_number: batchNumber,
                    bin_id: binId,
                });
            }

            // Update main inventory
            const { data: invItem } = await sb
                .from('inventory_items')
                .select('quantity')
                .eq('id', item.inventoryItemId)
                .single();

            if (invItem) {
                await sb
                    .from('inventory_items')
                    .update({ quantity: Number(invItem.quantity) + acceptedQty })
                    .eq('id', item.inventoryItemId);
            }

            // Create stock transaction
            await sb.from('stock_transactions').insert({
                inventory_item_id: item.inventoryItemId,
                type: 'GRN_RECEIPT',
                quantity: acceptedQty,
                reason: `GRN #${grnNumber} from PO #${po.po_number}`,
                batch_id: grn.id,
                performed_by_id: userId,
            });
        }

        // Check if all items received - update PO status
        const { data: updatedPO } = await sb
            .from('supplier_purchase_orders')
            .select('*, supplier_po_items (*)')
            .eq('id', purchaseOrderId)
            .single();

        const allReceived = updatedPO?.supplier_po_items?.every(
            (item: any) => Number(item.received_qty) >= Number(item.ordered_qty)
        );
        const someReceived = updatedPO?.supplier_po_items?.some(
            (item: any) => Number(item.received_qty) > 0
        );

        await sb
            .from('supplier_purchase_orders')
            .update({ status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIAL_RECEIVED' : 'ORDERED' })
            .eq('id', purchaseOrderId);

        res.status(201).json(grn);
    } catch (error) {
        logger.error('Error receiving goods:', error);
        res.status(500).json({ error: 'Failed to receive goods' });
    }
});

export default router;
