// Order Routes - Create, Update, Complete orders (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, orderPaymentSchema } from '../middleware/schemas';
import { supabase } from '../lib/supabase';

const router = Router();

// Helper to transform order for frontend compatibility
function transformOrder(order: any) {
    return {
        id: order.id,
        orderNumber: order.order_number,
        branchId: order.branch_id,
        tableId: order.table_id,
        userId: order.user_id,
        orderType: order.order_type,
        status: order.status,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        subtotal: order.subtotal,
        discountType: order.discount_type,
        discountValue: order.discount_value,
        discountAmount: order.discount_amount,
        gstAmount: order.gst_amount,
        total: order.total,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        completedAt: order.completed_at,
        items: order.order_items?.map((item: any) => ({
            id: item.id,
            menuItemId: item.menu_item_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.total,
            notes: item.notes,
            status: item.status,
            menuItem: item.menu_items,
            variant: item.menu_item_variants,
        })) || [],
        payments: order.payments || [],
    };
}

// Get all orders
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { status, orderType, date, tableId } = req.query;

        let query = sb
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (id, name, price),
                    menu_item_variants (id, name, price)
                ),
                payments (*)
            `)
            .eq('branch_id', req.user!.branchId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (status) query = query.eq('status', status);
        if (orderType) query = query.eq('order_type', orderType);
        if (tableId) query = query.eq('table_id', tableId);
        if (date) {
            const startOfDay = new Date(date as string);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date as string);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        res.json((orders || []).map(transformOrder));
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders' });
    }
});

// Get single order
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: order, error } = await sb
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items (id, name, price),
                    menu_item_variants (id, name, price)
                ),
                payments (*),
                kot_items (*)
            `)
            .eq('id', id)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(transformOrder(order));
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// Create new order
router.post('/', authMiddleware, validate(createOrderSchema), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const {
            orderType,
            tableId,
            customerName,
            customerPhone,
            items,
            discountType,
            discountValue,
            notes,
            onlineOrderId,
            onlinePlatform,
        } = req.body;

        const branchId = req.user!.branchId;
        const userId = req.user!.id;

        // Calculate totals
        let subtotal = 0;
        let gstAmount = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const { data: menuItem } = await sb
                .from('menu_items')
                .select('*')
                .eq('id', item.menuItemId)
                .single();

            if (!menuItem) continue;

            let unitPrice = Number(menuItem.price);

            // Check for variant price
            if (item.variantId) {
                const { data: variant } = await sb
                    .from('menu_item_variants')
                    .select('price')
                    .eq('id', item.variantId)
                    .single();
                if (variant) {
                    unitPrice = Number(variant.price);
                }
            }

            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;

            if (menuItem.has_gst) {
                gstAmount += itemTotal * (Number(menuItem.gst_percent) / 100);
            }

            orderItems.push({
                menu_item_id: item.menuItemId,
                variant_id: item.variantId || null,
                name: menuItem.name,
                quantity: item.quantity,
                unit_price: unitPrice,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (discountType === 'PERCENTAGE' && discountValue) {
            discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'FIXED' && discountValue) {
            discountAmount = discountValue;
        }

        const total = subtotal - discountAmount + gstAmount;

        // Check if daily order reset is enabled
        const dailyReset = req.headers['x-daily-order-reset'] === 'true';

        // Get next order number
        let orderQuery = sb
            .from('orders')
            .select('order_number')
            .eq('branch_id', branchId)
            .order('order_number', { ascending: false })
            .limit(1);

        if (dailyReset) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            orderQuery = orderQuery.gte('created_at', startOfDay.toISOString());
        }

        const { data: lastOrders } = await orderQuery;
        const orderNumber = (lastOrders?.[0]?.order_number || 0) + 1;

        // Create order
        const { data: order, error: orderError } = await sb
            .from('orders')
            .insert({
                order_number: orderNumber,
                branch_id: branchId,
                user_id: userId,
                table_id: tableId || null,
                order_type: orderType || 'DINE_IN',
                status: 'CONFIRMED',
                customer_name: customerName,
                customer_phone: customerPhone,
                subtotal,
                discount_type: discountType,
                discount_value: discountValue,
                discount_amount: discountAmount,
                gst_amount: gstAmount,
                total,
                notes,
                online_order_id: onlineOrderId,
                online_platform: onlinePlatform,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // Create order items
        if (orderItems.length > 0) {
            const itemsWithOrderId = orderItems.map(item => ({
                ...item,
                order_id: order.id,
            }));

            await sb.from('order_items').insert(itemsWithOrderId);
        }

        // Update table status if dine-in
        if (tableId && orderType === 'DINE_IN') {
            await sb
                .from('tables')
                .update({ status: 'OCCUPIED' })
                .eq('id', tableId);
        }

        // Create order event
        await sb.from('order_events').insert({
            order_id: order.id,
            event: 'CREATED',
            payload: { orderType, itemCount: items.length, total },
            created_by: userId,
        });

        // Fetch complete order
        const { data: completeOrder } = await sb
            .from('orders')
            .select(`
                *,
                order_items (*, menu_items (id, name, price)),
                tables (id, name)
            `)
            .eq('id', order.id)
            .single();

        res.status(201).json(transformOrder(completeOrder || order));
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Add payment to order
router.post('/:id/payment', authMiddleware, validate(orderPaymentSchema), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { mode, amount, reference } = req.body;

        const { data: payment, error: paymentError } = await sb
            .from('payments')
            .insert({
                order_id: id,
                mode,
                amount,
                reference,
            })
            .select()
            .single();

        if (paymentError) throw paymentError;

        // Check if order is fully paid
        const { data: order } = await sb
            .from('orders')
            .select('*, payments (*)')
            .eq('id', id)
            .single();

        const totalPaid = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        if (totalPaid >= Number(order.total)) {
            await sb
                .from('orders')
                .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                .eq('id', id);

            // Free up table
            if (order.table_id) {
                await sb
                    .from('tables')
                    .update({ status: 'EMPTY' })
                    .eq('id', order.table_id);
            }

            // Create order event
            await sb.from('order_events').insert({
                order_id: id,
                event: 'COMPLETED',
                payload: { totalPaid, paymentMode: mode },
            });
        }

        res.status(201).json({
            id: payment.id,
            orderId: payment.order_id,
            mode: payment.mode,
            amount: payment.amount,
            reference: payment.reference,
        });
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

// Update order status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { status } = req.body;

        const updateData: any = { status };
        if (status === 'COMPLETED') {
            updateData.completed_at = new Date().toISOString();
        }

        const { data: order, error } = await sb
            .from('orders')
            .update(updateData)
            .eq('id', id)
            .select('*, tables (id, name)')
            .single();

        if (error) throw error;

        // Free up table if completed or cancelled
        if (['COMPLETED', 'CANCELLED'].includes(status) && order.table_id) {
            await sb
                .from('tables')
                .update({ status: 'EMPTY' })
                .eq('id', order.table_id);
        }

        // Create order event
        await sb.from('order_events').insert({
            order_id: id,
            event: `STATUS_${status}`,
            payload: { previousStatus: order.status, newStatus: status },
        });

        res.json(transformOrder(order));
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Update order items
router.put('/:id/items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { items } = req.body;

        // Get current order
        const { data: order } = await sb
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Delete existing items
        await sb.from('order_items').delete().eq('order_id', id);

        // Recalculate and add new items
        let subtotal = 0;
        let gstAmount = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const { data: menuItem } = await sb
                .from('menu_items')
                .select('*')
                .eq('id', item.menuItemId)
                .single();

            if (!menuItem) continue;

            let unitPrice = Number(menuItem.price);
            if (item.variantId) {
                const { data: variant } = await sb
                    .from('menu_item_variants')
                    .select('price')
                    .eq('id', item.variantId)
                    .single();
                if (variant) unitPrice = Number(variant.price);
            }

            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;

            if (menuItem.has_gst) {
                gstAmount += itemTotal * (Number(menuItem.gst_percent) / 100);
            }

            orderItems.push({
                order_id: id,
                menu_item_id: item.menuItemId,
                variant_id: item.variantId || null,
                name: menuItem.name,
                quantity: item.quantity,
                unit_price: unitPrice,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Insert new items
        if (orderItems.length > 0) {
            await sb.from('order_items').insert(orderItems);
        }

        // Calculate discount
        let discountAmount = 0;
        if (order.discount_type === 'PERCENTAGE' && order.discount_value) {
            discountAmount = subtotal * (order.discount_value / 100);
        } else if (order.discount_type === 'FIXED' && order.discount_value) {
            discountAmount = order.discount_value;
        }

        const total = subtotal - discountAmount + gstAmount;

        // Update order totals
        const { data: updatedOrder, error } = await sb
            .from('orders')
            .update({ subtotal, gst_amount: gstAmount, discount_amount: discountAmount, total })
            .eq('id', id)
            .select(`
                *,
                order_items (*, menu_items (id, name, price)),
                tables (id, name)
            `)
            .single();

        if (error) throw error;

        res.json(transformOrder(updatedOrder));
    } catch (error) {
        console.error('Update order items error:', error);
        res.status(500).json({ error: 'Failed to update order items' });
    }
});

// Cancel order
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: order } = await sb
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Update status to cancelled instead of deleting
        await sb
            .from('orders')
            .update({ status: 'CANCELLED' })
            .eq('id', id);

        // Free up table
        if (order.table_id) {
            await sb
                .from('tables')
                .update({ status: 'EMPTY' })
                .eq('id', order.table_id);
        }

        res.json({ message: 'Order cancelled' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// ==================== OFFLINE SYNC ENDPOINTS ====================

// Sync single order (with idempotency)
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const {
            idempotency_key,
            local_id,
            branch_id,
            table_id,
            order_type,
            customer_name,
            customer_phone,
            items,
            subtotal,
            discount_type,
            discount_value,
            discount_amount,
            gst_amount,
            total,
            notes,
            created_at,
        } = req.body;

        // Check idempotency - if exists, return existing
        const { data: existingSync } = await sb
            .from('sync_events')
            .select('entity_id')
            .eq('idempotency_key', idempotency_key)
            .eq('status', 'success')
            .single();

        if (existingSync?.entity_id) {
            const { data: existingOrder } = await sb
                .from('orders')
                .select('id, order_number')
                .eq('id', existingSync.entity_id)
                .single();

            return res.json({
                id: existingOrder?.id,
                bill_number: existingOrder?.order_number,
                already_synced: true,
            });
        }

        // Get next order number
        const { data: lastOrders } = await sb
            .from('orders')
            .select('order_number')
            .eq('branch_id', branch_id || req.user!.branchId)
            .order('order_number', { ascending: false })
            .limit(1);

        const orderNumber = (lastOrders?.[0]?.order_number || 0) + 1;

        // Create order
        const { data: order, error } = await sb
            .from('orders')
            .insert({
                order_number: orderNumber,
                branch_id: branch_id || req.user!.branchId,
                user_id: req.user!.id,
                table_id,
                order_type: order_type || 'TAKEAWAY',
                status: 'CONFIRMED',
                customer_name,
                customer_phone,
                subtotal,
                discount_type,
                discount_value,
                discount_amount,
                gst_amount,
                total,
                notes,
                synced_from_offline: true,
                offline_local_id: local_id,
                created_at: created_at || new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        // Create order items
        if (items?.length > 0) {
            const orderItems = items.map((item: any) => ({
                order_id: order.id,
                menu_item_id: item.menuItemId,
                variant_id: item.variantId || null,
                name: item.menuItemName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total: item.total,
                notes: item.notes,
            }));
            await sb.from('order_items').insert(orderItems);
        }

        // Record success
        await sb.from('sync_events').upsert({
            branch_id: branch_id || req.user!.branchId,
            entity_type: 'ORDER',
            entity_id: order.id,
            local_id,
            idempotency_key,
            status: 'success',
            processed_at: new Date().toISOString(),
        }, { onConflict: 'idempotency_key' });

        res.status(201).json({
            id: order.id,
            bill_number: order.order_number,
            synced: true,
        });
    } catch (error) {
        console.error('Sync order error:', error);
        res.status(500).json({ error: 'Failed to sync order' });
    }
});

// Sync payment
router.post('/sync-payment', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { idempotency_key, order_id, mode, amount, reference } = req.body;

        // Check idempotency
        const { data: existing } = await sb
            .from('sync_events')
            .select('entity_id')
            .eq('idempotency_key', idempotency_key)
            .eq('status', 'success')
            .single();

        if (existing?.entity_id) {
            return res.json({ id: existing.entity_id, already_synced: true });
        }

        // Create payment
        const { data: payment, error } = await sb
            .from('payments')
            .insert({ order_id, mode, amount, reference })
            .select()
            .single();

        if (error) throw error;

        // Check if order is fully paid
        const { data: order } = await sb
            .from('orders')
            .select('*, payments (*)')
            .eq('id', order_id)
            .single();

        const totalPaid = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        if (totalPaid >= Number(order.total)) {
            await sb.from('orders')
                .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
                .eq('id', order_id);
        }

        // Record sync event
        await sb.from('sync_events').upsert({
            branch_id: req.user!.branchId,
            entity_type: 'PAYMENT',
            entity_id: payment.id,
            local_id: idempotency_key.split(':')[1],
            idempotency_key,
            status: 'success',
            processed_at: new Date().toISOString(),
        }, { onConflict: 'idempotency_key' });

        res.status(201).json({ id: payment.id, synced: true });
    } catch (error) {
        console.error('Sync payment error:', error);
        res.status(500).json({ error: 'Failed to sync payment' });
    }
});

// Sync KOT
router.post('/sync-kot', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { idempotency_key, order_id, kot_number, items, status } = req.body;

        // Check idempotency
        const { data: existing } = await sb
            .from('sync_events')
            .select('entity_id')
            .eq('idempotency_key', idempotency_key)
            .eq('status', 'success')
            .single();

        if (existing?.entity_id) {
            return res.json({ id: existing.entity_id, already_synced: true });
        }

        // Create KOT items
        const kotItems = items.map((item: any) => ({
            order_id,
            menu_item_id: item.menuItemId,
            name: item.menuItemName,
            quantity: item.quantity,
            notes: item.notes,
            kot_number,
            status: status || 'PENDING',
        }));

        const { data: insertedItems, error } = await sb
            .from('kot_items')
            .insert(kotItems)
            .select();

        if (error) throw error;

        // Record sync event
        await sb.from('sync_events').upsert({
            branch_id: req.user!.branchId,
            entity_type: 'KOT',
            entity_id: insertedItems?.[0]?.id,
            local_id: idempotency_key.split(':')[1],
            idempotency_key,
            status: 'success',
            processed_at: new Date().toISOString(),
        }, { onConflict: 'idempotency_key' });

        res.status(201).json({ synced: true, items_count: kotItems.length });
    } catch (error) {
        console.error('Sync KOT error:', error);
        res.status(500).json({ error: 'Failed to sync KOT' });
    }
});

// Order status intent (server-authoritative)
router.post('/status-intent', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { order_id, intended_status, changed_by, changed_at } = req.body;

        // Get current server state
        const { data: order, error: fetchError } = await sb
            .from('orders')
            .select('status')
            .eq('id', order_id)
            .single();

        if (fetchError || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Server-authoritative: only update if intent is valid progression
        const validTransitions: Record<string, string[]> = {
            'CONFIRMED': ['PREPARING', 'COMPLETED', 'CANCELLED'],
            'PREPARING': ['READY', 'COMPLETED', 'CANCELLED'],
            'READY': ['SERVED', 'COMPLETED', 'CANCELLED'],
            'SERVED': ['COMPLETED'],
        };

        const currentStatus = order.status;
        const allowed = validTransitions[currentStatus] || [];

        if (!allowed.includes(intended_status)) {
            return res.json({
                accepted: false,
                server_status: currentStatus,
                message: `Cannot transition from ${currentStatus} to ${intended_status}`,
            });
        }

        // Apply the status change
        const updateData: any = { status: intended_status };
        if (intended_status === 'COMPLETED') {
            updateData.completed_at = new Date().toISOString();
        }

        await sb.from('orders').update(updateData).eq('id', order_id);

        // Record event
        await sb.from('order_events').insert({
            order_id,
            event: `STATUS_${intended_status}`,
            payload: { previousStatus: currentStatus, changedBy: changed_by, changedAt: changed_at },
        });

        res.json({ accepted: true, server_status: intended_status });
    } catch (error) {
        console.error('Status intent error:', error);
        res.status(500).json({ error: 'Failed to process status intent' });
    }
});

// Sync cancelled items
router.post('/sync-cancellation', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { idempotency_key, order_id, menu_item_id, quantity, reason, cancelled_by, cancelled_at } = req.body;

        // Check idempotency
        const { data: existing } = await sb
            .from('sync_events')
            .select('entity_id')
            .eq('idempotency_key', idempotency_key)
            .eq('status', 'success')
            .single();

        if (existing?.entity_id) {
            return res.json({ id: existing.entity_id, already_synced: true });
        }

        // Record cancellation in order_events
        const { data: event, error } = await sb
            .from('order_events')
            .insert({
                order_id,
                event: 'ITEM_CANCELLED',
                payload: {
                    menu_item_id,
                    quantity,
                    reason,
                    cancelled_by,
                    cancelled_at,
                },
            })
            .select()
            .single();

        if (error) throw error;

        // Record sync event
        await sb.from('sync_events').upsert({
            branch_id: req.user!.branchId,
            entity_type: 'CANCELLED_ITEM',
            entity_id: event.id,
            local_id: idempotency_key.split(':').slice(1).join(':'),
            idempotency_key,
            status: 'success',
            processed_at: new Date().toISOString(),
        }, { onConflict: 'idempotency_key' });

        res.status(201).json({ id: event.id, synced: true });
    } catch (error) {
        console.error('Sync cancellation error:', error);
        res.status(500).json({ error: 'Failed to sync cancellation' });
    }
});

export default router;

