import api from './client';
import { CreateOrderDTO, UpdateOrderStatusDTO, AddPaymentDTO, OrderQueryDTO } from '@billova/types';

export const ordersAPI = {
    getAll: (params?: OrderQueryDTO) => api.get('/orders', { params }),
    getOne: (id: string) => api.get(`/orders/${id}`),
    create: (data: CreateOrderDTO, options?: { dailyReset?: boolean }) =>
        api.post('/orders', data, {
            headers: options?.dailyReset ? { 'X-Daily-Order-Reset': 'true' } : {}
        }),
    addPayment: (id: string, data: AddPaymentDTO) => api.post(`/orders/${id}/payment`, data),
    updateStatus: (id: string, data: UpdateOrderStatusDTO | string) => {
        const payload = typeof data === 'string' ? { status: data } : data;
        return api.patch(`/orders/${id}/status`, payload);
    },
    cancel: (id: string) => api.post(`/orders/${id}/cancel`),
    addItems: (id: string, items: Array<{ menuItemId: string; quantity: number; notes?: string }>) =>
        api.post(`/orders/${id}/add-items`, { items }),
    offlineSync: (data: { localId: string; orderHash: string; order: Record<string, unknown> }) =>
        api.post('/orders/offline-sync', data),
};
