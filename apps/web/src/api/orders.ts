// Orders API - Ultra-Resilient Cloud (Supabase) + Local Cache Dual-Sync Layer
import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { CreateOrderDTO, UpdateOrderStatusDTO, AddPaymentDTO, OrderQueryDTO } from '@billova/types';
import { useAuthStore } from '../store';
import { logger } from '../utils/logger';

const LOCAL_ORDERS_KEY = 'billova_local_orders_v2';

const isValidUUID = (str?: string | null): boolean => Boolean(str && typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

export function getStoredLocalOrders(): any[] {
    try {
        const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveLocalOrder(order: any) {
    try {
        const list = getStoredLocalOrders();
        const existingIdx = list.findIndex(o => o.id === order.id || o.orderNumber === order.orderNumber);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...order };
        } else {
            list.unshift(order);
        }
        // Keep last 300 orders locally
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(list.slice(0, 300)));
    } catch (e) {
        logger.warn('Failed to save order to localStorage:', e);
    }
}

export function updateLocalOrderStatus(id: string, status: string) {
    try {
        const list = getStoredLocalOrders();
        const updated = list.map(o => o.id === id ? { ...o, status, completedAt: status === 'COMPLETED' ? new Date().toISOString() : o.completedAt } : o);
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
    } catch (e) {
        logger.warn('Failed to update local order status:', e);
    }
}

/**
 * Auto-syncs any offline/unsynced orders to Supabase backend in the background
 */
export async function syncLocalOrdersToSupabase() {
    const list = getStoredLocalOrders();
    const unsynced = list.filter(o => o.id && (o.id.startsWith('ord-') || o.id.startsWith('temp-')));
    if (unsynced.length === 0) return;

    const user = useAuthStore.getState().user;
    const branchId = user?.branch?.id || (user as any)?.branchId;

    for (const localOrd of unsynced) {
        try {
            const syncOrderUuid = (localOrd.id && isValidUUID(localOrd.id))
                ? localOrd.id
                : ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined);

            const insertPayload: any = {
                ...(syncOrderUuid ? { id: syncOrderUuid } : {}),
                order_number: localOrd.orderNumber || 1,
                daily_order_no: localOrd.dailyOrderNo || localOrd.orderNumber || 1,
                order_type: localOrd.orderType || 'DINE_IN',
                status: localOrd.status || 'PENDING',
                customer_name: localOrd.customerName || null,
                customer_phone: localOrd.customerPhone || null,
                subtotal: Number(localOrd.subtotal || 0),
                total: Number(localOrd.total || 0),
                total_amount: Number(localOrd.total || 0),
                discount_amount: Number(localOrd.discountAmount || 0),
                gst_amount: Number(localOrd.gstAmount || 0),
                notes: localOrd.notes || null,
                online_platform: localOrd.onlinePlatform || null,
                online_order_id: localOrd.onlineOrderId || null,
                created_at: localOrd.createdAt || new Date().toISOString(),
                completed_at: localOrd.completedAt || (localOrd.status === 'COMPLETED' ? localOrd.createdAt : null),
            };

            if (isValidUUID(branchId)) insertPayload.branch_id = branchId;

            const { data: serverOrder, error: orderErr } = await supabase
                .from('orders')
                .insert([insertPayload])
                .select()
                .single();

            if (!orderErr && serverOrder) {
                // Update local storage with real Supabase UUID
                localOrd.id = serverOrder.id;
                saveLocalOrder(localOrd);

                // Insert items
                if (localOrd.items && localOrd.items.length > 0) {
                    const itemsPayload = localOrd.items.map((it: any) => {
                        const itemUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
                            const rawMenuId = it.menuItem?.id || it.menuItemId || it.id;
                            return {
                                ...(itemUuid ? { id: itemUuid } : {}),
                                order_id: serverOrder.id,
                                menu_item_id: isValidUUID(rawMenuId) ? rawMenuId : null,
                                quantity: Number(it.quantity || 1),
                            unit_price: Number(it.unitPrice || 0),
                            total: Number(it.total || 0),
                            notes: it.notes || null,
                            status: 'PENDING',
                        };
                    });
                    await supabase.from('order_items').insert(itemsPayload);
                }

                // Insert payments
                if (localOrd.payments && localOrd.payments.length > 0) {
                    const paymentsPayload = localOrd.payments.map((p: any) => {
                        const payUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
                        return {
                            ...(payUuid ? { id: payUuid } : {}),
                            order_id: serverOrder.id,
                            mode: p.mode || 'CASH',
                            amount: Number(p.amount || localOrd.total || 0),
                            created_at: p.createdAt || new Date().toISOString(),
                        };
                    });
                    await supabase.from('payments').insert(paymentsPayload);
                }
                logger.info(`[Sync] Order #${localOrd.orderNumber} successfully synced to Supabase:`, serverOrder.id);
            }
        } catch (syncErr) {
            logger.warn(`[Sync] Failed to sync order #${localOrd.orderNumber}:`, syncErr);
        }
    }
}

export const ordersAPI = {
    /**
     * Get all orders with items, payments, and table details
     */
    getAll: async (params?: OrderQueryDTO) => {
        // Trigger background sync for any unsynced local orders
        syncLocalOrdersToSupabase().catch(() => {});

        if (hasExpressBackend()) {
            try { return await api.get('/orders', { params }); } catch { /* fallback */ }
        }
        try {
            const user = useAuthStore.getState().user;
            const branchId = user?.branch?.id || (user as any)?.branchId;

            // 1. Fetch orders from Supabase
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (branchId) {
                query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
            }

            if (params?.date) {
                const [y, m, d] = params.date.split('-').map(Number);
                const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
                const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
                query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
            }

            const { data: ordersData, error: ordersError } = await query;
            let rawOrders: any[] = [];

            if (!ordersError && ordersData) {
                rawOrders = ordersData;
            } else {
                logger.warn('Supabase orders fetch warning:', ordersError?.message);
            }

            // 2. Fetch order items, payments, tables, and menu items in parallel
            const orderIds = rawOrders.map((o: any) => o.id);
            const [itemsRes, paymentsRes, tablesRes, menuRes] = await Promise.allSettled([
                orderIds.length > 0 ? supabase.from('order_items').select('*').in('order_id', orderIds) : Promise.resolve({ data: [] }),
                orderIds.length > 0 ? supabase.from('payments').select('*').in('order_id', orderIds) : Promise.resolve({ data: [] }),
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

            // 3. Format remote orders
            const formattedRemote = rawOrders.map((o: any) => {
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
                    onlinePlatform: o.online_platform || o.onlinePlatform,
                    onlineOrderId: o.online_order_id || o.onlineOrderId,
                    createdAt: o.created_at || new Date().toISOString(),
                    completedAt: o.completed_at,
                    table: tableInfo ? { id: tableInfo.id, name: tableInfo.name } : undefined,
                    items: orderItems,
                    payments: orderPayments,
                };
            });

            // 4. Merge with local cached orders
            const localOrders = getStoredLocalOrders();
            const dateFilter = params?.date;

            const filteredLocal = dateFilter
                ? localOrders.filter(o => {
                    if (!o.createdAt) return false;
                    const d = new Date(o.createdAt);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}` === dateFilter;
                })
                : localOrders;

            // Combine and deduplicate
            const seenIds = new Set<string>();
            const seenOrderNums = new Set<number>();
            const combined: any[] = [];

            // Add remote orders first
            for (const ord of formattedRemote) {
                seenIds.add(ord.id);
                seenOrderNums.add(ord.orderNumber);
                combined.push(ord);
            }

            // Add local orders that are not yet in remote response
            for (const ord of filteredLocal) {
                if (!seenIds.has(ord.id) && !seenOrderNums.has(ord.orderNumber)) {
                    combined.push(ord);
                }
            }

            // Sort descending by creation date
            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return { data: combined };
        } catch (err) {
            logger.error('Orders getAll error:', err);
            const localOrders = getStoredLocalOrders();
            return { data: localOrders };
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
            const local = getStoredLocalOrders().find(o => o.id === id);
            return { data: local || null };
        }
    },

    /**
     * Create a new order with sequential order numbering and guaranteed Supabase persistence
     */
    create: async (data: CreateOrderDTO, options?: { dailyReset?: boolean }) => {
        if (hasExpressBackend()) {
            try {
                return await api.post('/orders', data, {
                    headers: options?.dailyReset ? { 'X-Daily-Order-Reset': 'true' } : {}
                });
            } catch { /* fallback */ }
        }

        const user = useAuthStore.getState().user;
        const branchId = user?.branch?.id || (user as any)?.branchId;
        const todayLocal = new Date();
        const y = todayLocal.getFullYear();
        const m = String(todayLocal.getMonth() + 1).padStart(2, '0');
        const d = String(todayLocal.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // ── 1. Calculate Sequential Order Number for Today ──
        let nextOrderNumber = 1;

        try {
            const startOfDay = new Date(y, todayLocal.getMonth(), todayLocal.getDate(), 0, 0, 0, 0).toISOString();
            const { data: recentOrders } = await supabase
                .from('orders')
                .select('order_number, daily_order_no, created_at')
                .gte('created_at', startOfDay)
                .order('created_at', { ascending: false })
                .limit(100);

            if (recentOrders && recentOrders.length > 0) {
                let maxNum = 0;
                for (const o of recentOrders) {
                    const n = Number(o.order_number || o.daily_order_no || 0);
                    if (n > maxNum) maxNum = n;
                }
                nextOrderNumber = maxNum + 1;
            }
        } catch (queryErr) {
            logger.warn('Could not query max order number from Supabase, using local:', queryErr);
            const storedDate = localStorage.getItem('billova_order_seq_date');
            let seq = Number(localStorage.getItem('billova_order_seq_num') || '0');
            if (storedDate !== todayStr) {
                seq = 0;
            }
            nextOrderNumber = seq + 1;
        }

        // Check local storage max for today
        const localList = getStoredLocalOrders().filter(o => {
            if (!o.createdAt) return false;
            const od = new Date(o.createdAt);
            return `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, '0')}-${String(od.getDate()).padStart(2, '0')}` === todayStr;
        });
        for (const lo of localList) {
            if (Number(lo.orderNumber || 0) >= nextOrderNumber) {
                nextOrderNumber = Number(lo.orderNumber || 0) + 1;
            }
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

        // Format Items for return & local cache
        const formattedItems = items.map((it: any, idx: number) => ({
            id: it.id || `item-${Date.now()}-${idx}`,
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || it.price || (it.total / (it.quantity || 1)) || 0),
            total: Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
            notes: it.notes || undefined,
            menuItem: {
                id: it.menuItemId || it.id,
                name: (it as any).name || (it as any).menuItem?.name || 'Item',
            },
            variant: it.variantId ? { id: it.variantId, name: (it as any).variant?.name || '' } : undefined,
        }));

        let assignedOrderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const baseOrder = {
            id: assignedOrderId,
            orderNumber: nextOrderNumber,
            dailyOrderNo: nextOrderNumber,
            billNumber: billNumber,
            orderType: data.orderType || 'DINE_IN',
            status: (data as any).status || 'PENDING',
            customerName: data.customerName || undefined,
            customerPhone: data.customerPhone || undefined,
            notes: data.notes || undefined,
            onlinePlatform: (data as any).onlinePlatform || undefined,
            onlineOrderId: (data as any).onlineOrderId || undefined,
            subtotal: subtotal,
            discountType: data.discountType || undefined,
            discountValue: data.discountValue || 0,
            discountAmount: discountAmount,
            gstAmount: gstAmount,
            total: total,
            totalAmount: total,
            items: formattedItems,
            payments: [],
            createdAt: new Date().toISOString(),
        };

        // ── 2. Insert into Supabase table (PRIMARY PERSISTENCE) ──
        try {
            const clientGeneratedOrderId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;

            const insertPayload: any = {
                ...(clientGeneratedOrderId ? { id: clientGeneratedOrderId } : {}),
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
                online_platform: (data as any).onlinePlatform || null,
                online_order_id: (data as any).onlineOrderId || null,
                created_at: new Date().toISOString(),
            };

            if (data.discountType === 'PERCENTAGE' || data.discountType === 'FIXED') {
                insertPayload.discount_type = data.discountType;
                insertPayload.discount_value = data.discountValue || 0;
            }

            if (isValidUUID(branchId)) {
                insertPayload.branch_id = branchId;
            }

            if (isValidUUID(data.tableId)) {
                insertPayload.table_id = data.tableId;
            }

            const { data: serverOrder, error: orderErr } = await supabase
                .from('orders')
                .insert([insertPayload])
                .select()
                .single();

            const finalOrderId = serverOrder?.id || clientGeneratedOrderId || assignedOrderId;

            if (!orderErr && finalOrderId) {
                assignedOrderId = finalOrderId;
                baseOrder.id = finalOrderId;

                // Insert items into Supabase
                if (items.length > 0) {
                    try {
                        const orderItemsPayload = items.map((it: any) => {
                            const itemUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
                            const rawMenuId = it.menuItemId || it.id || (it as any).menuItem?.id;
                            return {
                                ...(itemUuid ? { id: itemUuid } : {}),
                                order_id: finalOrderId,
                                menu_item_id: isValidUUID(rawMenuId) ? rawMenuId : null,
                                quantity: Number(it.quantity || 1),
                                unit_price: Number(it.unitPrice || it.price || (it.total / (it.quantity || 1)) || 0),
                                total: Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
                                notes: it.notes || null,
                                status: 'PENDING',
                            };
                        });

                        await supabase.from('order_items').insert(orderItemsPayload);
                    } catch (itemInsertErr) {
                        logger.warn('Could not insert items into order_items table:', itemInsertErr);
                    }
                }
                logger.info(`[POS] Order #${nextOrderNumber} saved to Supabase:`, finalOrderId);
            } else if (orderErr) {
                logger.error('[POS] Supabase order insert error:', orderErr);
            }
        } catch (supErr) {
            logger.error('[POS] Supabase order insert exception:', supErr);
        }

        // Save order with latest ID to local cache as backup
        saveLocalOrder(baseOrder);

        return { data: baseOrder };
    },

    /**
     * Add payment to order and mark it as COMPLETED
     */
    addPayment: async (id: string, data: AddPaymentDTO) => {
        // Update local order state immediately
        updateLocalOrderStatus(id, 'COMPLETED');

        const localList = getStoredLocalOrders();
        const ord = localList.find(o => o.id === id);
        if (ord) {
            ord.payments = [{
                id: `pay-${Date.now()}`,
                mode: data.mode || 'CASH',
                amount: data.amount,
                createdAt: new Date().toISOString(),
            }];
            ord.status = 'COMPLETED';
            ord.completedAt = new Date().toISOString();
            saveLocalOrder(ord);
        }

        if (hasExpressBackend()) {
            try { return await api.post(`/orders/${id}/payment`, data); } catch { /* fallback */ }
        }

        try {
            if (!id.startsWith('ord-') && !id.startsWith('temp-')) {
                try {
                    const payUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
                    await supabase.from('payments').insert([{
                        ...(payUuid ? { id: payUuid } : {}),
                        order_id: id,
                        mode: data.mode || 'CASH',
                        amount: data.amount,
                        created_at: new Date().toISOString(),
                    }]);
                } catch (payErr) {
                    logger.warn('Payment insert warning:', payErr);
                }

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
        updateLocalOrderStatus(id, payload.status);

        if (hasExpressBackend()) {
            try { return await api.patch(`/orders/${id}/status`, payload); } catch { /* fallback */ }
        }
        try {
            if (!id.startsWith('ord-') && !id.startsWith('temp-')) {
                const updateObj: any = {
                    status: payload.status,
                    updated_at: new Date().toISOString()
                };
                if (payload.status === 'COMPLETED') {
                    updateObj.completed_at = new Date().toISOString();
                }

                const { data: updated } = await supabase
                    .from('orders')
                    .update(updateObj)
                    .eq('id', id)
                    .select()
                    .single();

                return { data: updated || { id, status: payload.status } };
            }
            return { data: { id, status: payload.status } };
        } catch (error) {
            logger.error('Update status error:', error);
            return { data: { id, status: payload.status } };
        }
    },

    /**
     * Update an existing order (e.g. adding items to a pending order)
     */
    updateOrder: async (id: string, data: any) => {
        const localList = getStoredLocalOrders();
        const existing = localList.find(o => o.id === id);
        if (existing) {
            Object.assign(existing, data, { updatedAt: new Date().toISOString() });
            saveLocalOrder(existing);
        }

        if (isValidUUID(id)) {
            try {
                const updatePayload: any = {
                    subtotal: Number(data.subtotal || 0),
                    total: Number(data.total || 0),
                    total_amount: Number(data.total || 0),
                    discount_amount: Number(data.discountAmount || 0),
                    gst_amount: Number(data.gstAmount || 0),
                    notes: data.notes || null,
                    updated_at: new Date().toISOString(),
                };
                if (data.customerName) updatePayload.customer_name = data.customerName;
                if (data.customerPhone) updatePayload.customer_phone = data.customerPhone;
                if (data.discountType) updatePayload.discount_type = data.discountType;
                if (data.discountValue) updatePayload.discount_value = Number(data.discountValue);

                await supabase.from('orders').update(updatePayload).eq('id', id);

                // Update items in order_items table
                if (data.items && data.items.length > 0) {
                    await supabase.from('order_items').delete().eq('order_id', id);
                    const orderItemsPayload = data.items.map((it: any) => {
                        const itemUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : undefined;
                        const rawMenuId = it.menuItemId || it.id || it.menuItem?.id;
                        return {
                            ...(itemUuid ? { id: itemUuid } : {}),
                            order_id: id,
                            menu_item_id: isValidUUID(rawMenuId) ? rawMenuId : null,
                            quantity: Number(it.quantity || 1),
                            unit_price: Number(it.unitPrice || it.price || 0),
                            total: Number(it.total || (Number(it.unitPrice || 0) * Number(it.quantity || 1))),
                            notes: it.notes || null,
                            status: 'PENDING',
                        };
                    });
                    await supabase.from('order_items').insert(orderItemsPayload);
                }
            } catch (err) {
                logger.error('Update order error:', err);
            }
        }

        return { data: { id, ...data } };
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
            if (!id.startsWith('ord-') && !id.startsWith('temp-')) {
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
