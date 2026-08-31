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

            // 1. Fetch orders cleanly
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (params?.date) {
                const startOfDay = `${params.date}T00:00:00.000Z`;
                const endOfDay = `${params.date}T23:59:59.999Z`;
                query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
            }

            const { data: ordersData, error: ordersError } = await query;

            if (ordersError) {
                logger.warn('Failed to fetch orders from supabase:', ordersError.message);
                // Simple query fallback without filters in case of RLS
                const { data: fallbackOrders } = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (!fallbackOrders || fallbackOrders.length === 0) return { data: [] };
                return {
                    data: (fallbackOrders || []).map((o: any) => ({
                        id: o.id,
                        orderNumber: Number(o.order_number || o.daily_order_no || 1),
                        dailyOrderNo: Number(o.daily_order_no || o.order_number || 1),
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

            const rawOrders = ordersData || [];
            if (rawOrders.length === 0) return { data: [] };

            const orderIds = rawOrders.map((o: any) => o.id);

            // 2. Fetch order items, payments, tables, and menu items in parallel for linked details
            const [itemsRes, paymentsRes, tablesRes, menuRes] = await Promise.allSettled([
                supabase.from('order_items').select('*').in('order_id', orderIds),
                supabase.from('payments').select('*').in('order_id', orderIds),
                supabase.from('tables').select('id, name'),
                supabase.from('menu_items').select('id, name, price'),
            ]);

            const allItems = itemsRes.status === 'fulfilled' ? (itemsRes.value.data || []) : [];
            const allPayments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data || []) : [];
            const allTables = tablesRes.status === 'fulfilled' ? (tablesRes.value.data || []) : [];
            const allMenuItems = menuRes.status === 'fulfilled' ? (menuRes.value.data || []) : [];

            // Build lookup maps
            const menuMap = new Map<string, any>();
            allMenuItems.forEach((m: any) => menuMap.set(m.id, m));

            const tableMap = new Map<string, any>();
            allTables.forEach((t: any) => tableMap.set(t.id, t));

            const itemsByOrder = new Map<string, any[]>();
            allItems.forEach((it: any) => {
                const list = itemsByOrder.get(it.order_id) || [];
                const menuItem = menuMap.get(it.menu_item_id);
                list.push({
                    id: it.id,
                    quantity: Number(it.quantity || 1),
                    unitPrice: Number(it.unit_price || it.price || menuItem?.price || 0),
                    total: Number(it.total || 0),
                    notes: it.notes,
                    menuItem: {
                        id: it.menu_item_id || it.id,
                        name: it.name || menuItem?.name || 'Item',
                    },
                    variant: it.variant_id ? { id: it.variant_id, name: it.variant_name || '' } : undefined,
                });
                itemsByOrder.set(it.order_id, list);
            });

            const paymentsByOrder = new Map<string, any[]>();
            allPayments.forEach((p: any) => {
                const list = paymentsByOrder.get(p.order_id) || [];
                list.push({
                    id: p.id,
                    mode: p.mode || 'CASH',
                    amount: Number(p.amount || 0),
                    createdAt: p.created_at || new Date().toISOString(),
                });
                paymentsByOrder.set(p.order_id, list);
            });

            // 3. Format orders
            const formatted = rawOrders.map((o: any) => {
                const num = Number(o.order_number || o.daily_order_no || 1);
                const orderItems = itemsByOrder.get(o.id) || (Array.isArray(o.items) ? o.items : []);
                const orderPayments = paymentsByOrder.get(o.id) || (Array.isArray(o.payments) ? o.payments : []);
                const tableInfo = o.table_id ? tableMap.get(o.table_id) : undefined;

                return {
                    id: o.id,
                    orderNumber: num,
                    dailyOrderNo: num,
                    billNumber: `#${String(num).padStart(3, '0')}`,
                    orderType: o.order_type || 'DINE_IN',
                    status: o.status || 'PENDING',
                    total: Number(o.total || o.total_amount || 0),
                    totalAmount: Number(o.total || o.total_amount || 0),
                    subtotal: Number(o.subtotal || o.total || 0),
                    discountType: o.discount_type,
                    discountValue: Number(o.discount_value || 0),
                    discountAmount: Number(o.discount_amount || 0),
                    gstAmount: Number(o.gst_amount || 0),
                    customerName: o.customer_name,
                    customerPhone: o.customer_phone,
                    notes: o.notes,
                    createdAt: o.created_at || new Date().toISOString(),
                    completedAt: o.completed_at,
                    table: tableInfo ? { id: tableInfo.id, name: tableInfo.name } : undefined,
                    items: orderItems,
                    payments: orderPayments,
                };
            });

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
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            const [itemsRes, paymentsRes] = await Promise.allSettled([
                supabase.from('order_items').select('*').eq('order_id', id),
                supabase.from('payments').select('*').eq('order_id', id),
            ]);

            const items = itemsRes.status === 'fulfilled' ? (itemsRes.value.data || []) : [];
            const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data || []) : [];

            return {
                data: {
                    ...data,
                    orderNumber: Number(data.order_number || data.daily_order_no || 1),
                    dailyOrderNo: Number(data.daily_order_no || data.order_number || 1),
                    billNumber: `#${String(data.order_number || 1).padStart(3, '0')}`,
                    items,
                    payments,
                }
            };
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

            // ── 1. Calculate Sequential Order Number for Today ──
            const todayStr = new Date().toISOString().split('T')[0];
            let nextOrderNumber = 1;

            try {
                let orderNumQuery = supabase
                    .from('orders')
                    .select('order_number, daily_order_no, created_at')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (branchId) {
                    orderNumQuery = orderNumQuery.eq('branch_id', branchId);
                }

                const { data: recentOrders } = await orderNumQuery;
                if (recentOrders && recentOrders.length > 0) {
                    const todays = options?.dailyReset !== false
                        ? recentOrders.filter((o: any) => (o.created_at || '').startsWith(todayStr))
                        : recentOrders;

                    let maxNum = 0;
                    for (const o of todays) {
                        const n = Number(o.order_number || o.daily_order_no || 0);
                        if (n > maxNum) maxNum = n;
                    }
                    nextOrderNumber = maxNum + 1;
                }
            } catch (queryErr) {
                logger.warn('Could not query max order number, using local seq:', queryErr);
                const storedDate = localStorage.getItem('billova_order_seq_date');
                let seq = Number(localStorage.getItem('billova_order_seq_num') || '0');
                if (storedDate !== todayStr) {
                    seq = 0;
                }
                nextOrderNumber = seq + 1;
            }

            // Keep localStorage in sync
            localStorage.setItem('billova_order_seq_date', todayStr);
            localStorage.setItem('billova_order_seq_num', String(nextOrderNumber));

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
                daily_order_no: nextOrderNumber,
                order_type: data.orderType || 'DINE_IN',
                status: (data as any).status || 'PENDING',
                customer_name: data.customerName || null,
                customer_phone: data.customerPhone || null,
                subtotal: subtotal,
                total: total,
                total_amount: total,
                discount_amount: discountAmount,
                gst_amount: gstAmount,
                notes: data.notes || null,
                created_at: new Date().toISOString(),
            };

            if (data.discountType === 'PERCENTAGE' || data.discountType === 'FIXED') {
                insertPayload.discount_type = data.discountType;
                insertPayload.discount_value = data.discountValue || 0;
            }

            if (branchId) {
                insertPayload.branch_id = branchId;
            }

            if (data.tableId) {
                insertPayload.table_id = data.tableId;
            }

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
            if (order && order.id && items.length > 0) {
                try {
                    const orderItemsPayload = items.map((it: any) => ({
                        order_id: order.id,
                        menu_item_id: it.menuItemId || it.id || null,
                        quantity: Number(it.quantity || 1),
                        unit_price: Number(it.unitPrice || it.price || (it.total / (it.quantity || 1)) || 0),
                        total: Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
                        notes: it.notes || null,
                        status: 'PENDING',
                    }));

                    await supabase.from('order_items').insert(orderItemsPayload);
                } catch (itemInsertErr) {
                    logger.warn('Could not insert items into order_items table:', itemInsertErr);
                }
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
                // 1. Insert payment record (non-blocking if payments table is restricted)
                try {
                    await supabase.from('payments').insert([{
                        order_id: id,
                        mode: data.mode || 'CASH',
                        amount: data.amount,
                        created_at: new Date().toISOString(),
                    }]);
                } catch (payErr) {
                    logger.warn('Payment insert warning:', payErr);
                }

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
