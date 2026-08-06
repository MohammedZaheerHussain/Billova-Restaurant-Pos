import api from './client';
import { supabase } from '../lib/supabase';
import { CreateOrderDTO, UpdateOrderStatusDTO, AddPaymentDTO, OrderQueryDTO } from '@billova/types';

export const ordersAPI = {
    getAll: async (params?: OrderQueryDTO) => {
        try {
            return await api.get('/orders', { params });
        } catch {
            const { data } = await supabase
                .from('orders')
                .select('*, items:order_items(*, menuItem:menu_items(*))')
                .order('created_at', { ascending: false });

            const formatted = (data || []).map((o: any) => ({
                id: o.id,
                dailyOrderNo: o.daily_order_no || o.order_number || 1,
                orderType: o.order_type || 'DINE_IN',
                status: o.status || 'COMPLETED',
                totalAmount: Number(o.total_amount || o.total || 0),
                subtotal: Number(o.subtotal || 0),
                taxAmount: Number(o.tax_amount || 0),
                paymentMethod: o.payment_method || 'CASH',
                createdAt: o.created_at || new Date().toISOString(),
                items: (o.items || []).map((it: any) => ({
                    id: it.id,
                    name: it.menuItem?.name || it.name || 'Item',
                    price: Number(it.unit_price || it.price || 0),
                    quantity: it.quantity || 1,
                    notes: it.notes,
                })),
            }));

            return { data: formatted };
        }
    },
    getOne: async (id: string) => {
        try {
            return await api.get(`/orders/${id}`);
        } catch {
            const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', id).single();
            return { data };
        }
    },
    create: async (data: CreateOrderDTO, options?: { dailyReset?: boolean }) => {
        try {
            return await api.post('/orders', data, {
                headers: options?.dailyReset ? { 'X-Daily-Order-Reset': 'true' } : {}
            });
        } catch {
            const { data: order, error } = await supabase.from('orders').insert([{
                order_type: data.orderType,
                table_id: data.tableId,
                customer_name: data.customerName,
                customer_phone: data.customerPhone,
                total_amount: (data as any).totalAmount || (data as any).total || 0,
                notes: data.notes,
                status: 'PENDING',
            }]).select().single();
            if (error) throw error;
            return { data: order };
        }
    },
    addPayment: (id: string, data: AddPaymentDTO) =>
        api.post(`/orders/${id}/payment`, data).catch(() => ({ data: { success: true } })),
    updateStatus: async (id: string, data: UpdateOrderStatusDTO | string) => {
        const payload = typeof data === 'string' ? { status: data } : data;
        try {
            return await api.patch(`/orders/${id}/status`, payload);
        } catch {
            const { data: updated } = await supabase.from('orders').update({ status: payload.status }).eq('id', id).select().single();
            return { data: updated };
        }
    },
    cancel: (id: string) => api.post(`/orders/${id}/cancel`).catch(() => ({ data: { success: true } })),
    addItems: (id: string, items: Array<{ menuItemId: string; quantity: number; notes?: string }>) =>
        api.post(`/orders/${id}/add-items`, { items }).catch(() => ({ data: { success: true } })),
    offlineSync: (data: { localId: string; orderHash: string; order: Record<string, unknown> }) =>
        api.post('/orders/offline-sync', data).catch(() => ({ data: { success: true } })),
};
