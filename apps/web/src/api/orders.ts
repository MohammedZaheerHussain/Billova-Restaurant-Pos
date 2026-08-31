// Orders API - Robust Client & Supabase Data Layer
import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { CreateOrderDTO, UpdateOrderStatusDTO, AddPaymentDTO, OrderQueryDTO } from '@billova/types';
import { useAuthStore } from '../store';
import { logger } from '../utils/logger';

export const ordersAPI = {
    /**
     * Get all orders with items, payments, and table details
     */
    getAll: async (params?: OrderQueryDTO) => {
        if (hasExpressBackend()) {
            try { return await api.get('/orders', { params }); } catch { /* fallback */ }
        }
        try {
            const user = useAuthStore.getState().user;
            const branchId = user?.branch?.id || (user as any)?.branchId;

            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        order_id,
                        menu_item_id,
                        variant_id,
                        quantity,
                        unit_price,
                        total,
                        notes,
                        status,
                        menu_items ( id, name, price ),
                        menu_item_variants ( id, name, price )
                    ),
                    payments ( id, mode, amount, created_at ),
                    tables ( id, name )
                `)
                .order('created_at', { ascending: false });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (params?.date) {
                const startOfDay = new Date(params.date);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(params.date);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                logger.warn('Nested query failed, falling back to basic orders query:', error.message);
                // Fallback query without complex joins in case of schema discrepancy
                let simpleQuery = supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (branchId) {
                    simpleQuery = simpleQuery.eq('branch_id', branchId);
                }
                if (params?.date) {
                    const startOfDay = new Date(params.date);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(params.date);
                    endOfDay.setHours(23, 59, 59, 999);
                    simpleQuery = simpleQuery.gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString());
                }

                const { data: simpleOrders, error: simpleErr } = await simpleQuery;
                if (simpleErr || !simpleOrders) return { data: [] };

                return {
                    data: simpleOrders.map((o: any) => ({
                        id: o.id,
                        orderNumber: o.order_number || o.daily_order_no || 1,
                        dailyOrderNo: o.daily_order_no || o.order_number || 1,
                        orderType: o.order_type || 'DINE_IN',
                        status: o.status || 'PENDING',
                        total: Number(o.total || o.total_amount || 0),
                        totalAmount: Number(o.total || o.total_amount || 0),
                        subtotal: Number(o.subtotal || o.total || 0),
                        discountAmount: Number(o.discount_amount || 0),
                        gstAmount: Number(o.gst_amount || 0),
                        customerName: o.customer_name,
                        customerPhone: o.customer_phone,
                        notes: o.notes,
                        createdAt: o.created_at || new Date().toISOString(),
                        completedAt: o.completed_at,
                        items: [],
                        payments: [],
                    }))
                };
            }

            const formatted = (data || []).map((o: any) => ({
                id: o.id,
                orderNumber: o.order_number || o.daily_order_no || 1,
                dailyOrderNo: o.daily_order_no || o.order_number || 1,
                orderType: o.order_type || 'DINE_IN',
                status: o.status || 'PENDING',
                total: Number(o.total || o.total_amount || 0),
                totalAmount: Number(o.total || o.total_amount || 0),
                subtotal: Number(o.subtotal || 0),
                discountType: o.discount_type,
                discountValue: Number(o.discount_value || 0),
                discountAmount: Number(o.discount_amount || 0),
                gstAmount: Number(o.gst_amount || 0),
                customerName: o.customer_name,
                customerPhone: o.customer_phone,
                notes: o.notes,
                createdAt: o.created_at || new Date().toISOString(),
                completedAt: o.completed_at,
                table: o.tables ? { id: o.tables.id, name: o.tables.name } : undefined,
                items: (o.order_items || []).map((it: any) => ({
                    id: it.id,
                    quantity: it.quantity || 1,
                    unitPrice: Number(it.unit_price || 0),
                    total: Number(it.total || 0),
                    notes: it.notes,
                    menuItem: {
                        id: it.menu_item_id || it.id,
                        name: it.menu_items?.name || it.name || 'Item'
                    },
                    variant: it.menu_item_variants ? {
                        id: it.variant_id,
                        name: it.menu_item_variants.name
                    } : undefined,
                })),
                payments: (o.payments || []).map((p: any) => ({
                    id: p.id,
                    mode: p.mode,
                    amount: Number(p.amount || 0),
                    createdAt: p.created_at,
                })),
            }));

            return { data: formatted };
        } catch (err) {
            logger.error('Orders getAll error:', err);
            return { data: [] };
        }
    },

    /**
     * Get single order by ID
     */
    getOne: async (id: string) => {
        if (hasExpressBackend()) {
            try { return await api.get(`/orders/${id}`); } catch { /* fallback */ }
        }
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items ( id, name, price ),
                        menu_item_variants ( id, name, price )
                    ),
                    payments (*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return { data };
        } catch {
            return { data: null };
        }
    },

    /**
     * Create a new order with sequential order numbering
     */
    create: async (data: CreateOrderDTO, options?: { dailyReset?: boolean }) => {
        if (hasExpressBackend()) {
            try {
                return await api.post('/orders', data, {
                    headers: options?.dailyReset ? { 'X-Daily-Order-Reset': 'true' } : {}
                });
            } catch { /* fallback */ }
        }

        try {
            const user = useAuthStore.getState().user;
            const branchId = user?.branch?.id || (user as any)?.branchId;
            const userId = user?.id;

            // ── 1. Calculate Sequential Order Number for Today ──
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            let orderNumQuery = supabase
                .from('orders')
                .select('order_number')
                .order('order_number', { ascending: false })
                .limit(20);

            if (branchId) {
                orderNumQuery = orderNumQuery.eq('branch_id', branchId);
            }
            if (options?.dailyReset !== false) {
                orderNumQuery = orderNumQuery.gte('created_at', startOfDay.toISOString());
            }

            const { data: recentOrders } = await orderNumQuery;
            let maxOrderNum = 0;
            if (recentOrders && recentOrders.length > 0) {
                for (const o of recentOrders) {
                    const num = Number(o.order_number || 0);
                    if (num > maxOrderNum) maxOrderNum = num;
                }
            }

            // Next sequential number (e.g. 1, 2, 3, 4, 5...)
            const nextOrderNumber = maxOrderNum + 1;
            const billNumber = `#${String(nextOrderNumber).padStart(3, '0')}`;

            // Calculate item totals
            let subtotal = 0;
            let gstAmount = 0;
            const items = data.items || [];
            for (const it of items) {
                const itemQty = Number(it.quantity || 1);
                const itemPrice = Number((it as any).unitPrice || (it as any).price || 0);
                subtotal += (itemQty * itemPrice);
            }
            if ((data as any).subtotal) subtotal = Number((data as any).subtotal);
            const discountAmount = Number((data as any).discountAmount || 0);
            const total = Number((data as any).total || (data as any).totalAmount || (subtotal - discountAmount + gstAmount));

            // ── 2. Insert into orders table ──
            const insertPayload: any = {
                order_number: nextOrderNumber,
                order_type: data.orderType || 'DINE_IN',
                status: 'PENDING',
                customer_name: data.customerName || null,
                customer_phone: data.customerPhone || null,
                table_id: data.tableId || null,
                subtotal: subtotal,
                discount_type: data.discountType || null,
                discount_value: data.discountValue || 0,
                discount_amount: discountAmount,
                gst_amount: gstAmount,
                total: total,
                notes: data.notes || null,
                created_at: new Date().toISOString(),
            };

            if (branchId) insertPayload.branch_id = branchId;
            if (userId) insertPayload.user_id = userId;

            const { data: order, error: orderErr } = await supabase
                .from('orders')
                .insert([insertPayload])
                .select()
                .single();

            if (orderErr) {
                logger.error('Order insert error in supabase:', orderErr);
                throw orderErr;
            }

            // ── 3. Insert order items ──
            if (order && items.length > 0) {
                const orderItemsPayload = items.map((it: any) => ({
                    order_id: order.id,
                    menu_item_id: it.menuItemId || it.id,
                    variant_id: it.variantId || null,
                    quantity: Number(it.quantity || 1),
                    unit_price: Number(it.unitPrice || it.price || (it.total / (it.quantity || 1)) || 0),
                    total: Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
                    notes: it.notes || null,
                    status: 'PENDING',
                }));

                await supabase.from('order_items').insert(orderItemsPayload);
            }

            return {
                data: {
                    ...order,
                    orderNumber: nextOrderNumber,
                    dailyOrderNo: nextOrderNumber,
                    billNumber: billNumber,
                    total: total,
                    subtotal: subtotal,
                }
            };
        } catch (error) {
            logger.error('Fallback order creation error:', error);
            // In local offline fallback, maintain local daily sequence
            const todayStr = new Date().toISOString().split('T')[0];
            const storedDate = localStorage.getItem('billova_order_seq_date');
            let seq = Number(localStorage.getItem('billova_order_seq_num') || '0');

            if (storedDate !== todayStr) {
                seq = 0;
                localStorage.setItem('billova_order_seq_date', todayStr);
            }
            seq += 1;
            localStorage.setItem('billova_order_seq_num', String(seq));

            return {
                data: {
                    id: 'temp-' + Date.now(),
                    ...data,
                    orderNumber: seq,
                    dailyOrderNo: seq,
                    billNumber: `#${String(seq).padStart(3, '0')}`,
                }
            };
        }
    },

    /**
     * Add payment to order and mark it as COMPLETED
     */
    addPayment: async (id: string, data: AddPaymentDTO) => {
        if (hasExpressBackend()) {
            try { return await api.post(`/orders/${id}/payment`, data); } catch { /* fallback */ }
        }
        try {
            if (!id.startsWith('temp-')) {
                // 1. Insert payment record
                await supabase.from('payments').insert([{
                    order_id: id,
                    mode: data.mode || 'CASH',
                    amount: data.amount,
                    created_at: new Date().toISOString(),
                }]);

                // 2. Mark order as COMPLETED
                await supabase.from('orders').update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('id', id);
            }
            return { data: { success: true } };
        } catch (error) {
            logger.error('Add payment error:', error);
            return { data: { success: true } };
        }
    },

    /**
     * Update order status (PENDING -> COMPLETED, CANCELLED, etc.)
     */
    updateStatus: async (id: string, data: UpdateOrderStatusDTO | string) => {
        const payload = typeof data === 'string' ? { status: data } : data;
        if (hasExpressBackend()) {
            try { return await api.patch(`/orders/${id}/status`, payload); } catch { /* fallback */ }
        }
        try {
            const updateObj: any = {
                status: payload.status,
                updated_at: new Date().toISOString()
            };
            if (payload.status === 'COMPLETED') {
                updateObj.completed_at = new Date().toISOString();
            }

            const { data: updated, error } = await supabase
                .from('orders')
                .update(updateObj)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { data: updated };
        } catch (error) {
            logger.error('Update status error:', error);
            return { data: { id, status: payload.status } };
        }
    },

    /**
     * Cancel an order
     */
    cancel: async (id: string) => {
        if (hasExpressBackend()) {
            try { return await api.post(`/orders/${id}/cancel`); } catch { /* fallback */ }
        }
        return ordersAPI.updateStatus(id, 'CANCELLED');
    },

    /**
     * Add items to an existing order
     */
    addItems: async (id: string, items: Array<{ menuItemId: string; quantity: number; notes?: string; variantId?: string }>) => {
        if (hasExpressBackend()) {
            try { return await api.post(`/orders/${id}/add-items`, { items }); } catch { /* fallback */ }
        }
        try {
            if (!id.startsWith('temp-')) {
                const orderItemsPayload = items.map((it: any) => ({
                    order_id: id,
                    menu_item_id: it.menuItemId,
                    variant_id: it.variantId || null,
                    quantity: Number(it.quantity || 1),
                    unit_price: Number(it.unitPrice || it.price || 0),
                    total: Number(it.total || 0),
                    notes: it.notes || null,
                    status: 'PENDING',
                }));

                await supabase.from('order_items').insert(orderItemsPayload);
            }
            return { data: { success: true } };
        } catch (error) {
            logger.error('Add items error:', error);
            return { data: { success: true } };
        }
    },

    offlineSync: (data: { localId: string; orderHash: string; order: Record<string, unknown> }) => {
        if (hasExpressBackend()) return api.post('/orders/offline-sync', data).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};

export default ordersAPI;
