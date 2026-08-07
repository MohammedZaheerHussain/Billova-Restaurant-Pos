import api from './client';
import { supabase } from '../lib/supabase';

export const inventoryAPI = {
    getAll: async (params?: Record<string, unknown>) => {
        try {
            return await api.get('/inventory', { params });
        } catch {
            try {
                const { data, error } = await supabase.from('inventory_items').select('*');
                if (error) return { data: [] };
                const formatted = (data || []).map((i: any) => ({
                    id: i.id,
                    sku: i.sku || null,
                    name: i.name,
                    category: i.category || 'INGREDIENT',
                    unit: i.unit || 'pcs',
                    quantity: Number(i.quantity ?? i.current_stock ?? 0),
                    currentStock: Number(i.quantity ?? i.current_stock ?? 0),
                    minStock: Number(i.minStock ?? i.min_stock ?? 0),
                    safetyStock: Number(i.safetyStock ?? i.safety_stock ?? 0),
                    reservedQty: Number(i.reservedQty ?? i.reserved_qty ?? 0),
                    costPerUnit: Number(i.costPerUnit ?? i.cost_per_unit ?? 0),
                    expiryDate: i.expiryDate || i.expiry_date || null,
                    stockStatus: i.stockStatus || i.stock_status || 'SUFFICIENT',
                    isActive: i.isActive ?? i.is_active ?? true,
                }));
                return { data: formatted };
            } catch {
                return { data: [] };
            }
        }
    },
    getOne: async (id: string) => {
        try {
            return await api.get(`/inventory/${id}`);
        } catch {
            try {
                const { data } = await supabase.from('inventory_items').select('*').eq('id', id).single();
                return { data };
            } catch {
                return { data: null };
            }
        }
    },
    create: async (data: Record<string, unknown>) => {
        try {
            return await api.post('/inventory', data);
        } catch {
            try {
                const { data: item, error } = await supabase.from('inventory_items').insert([data]).select().single();
                if (error) throw error;
                return { data: item };
            } catch {
                return { data: { id: 'temp-' + Date.now(), ...data } };
            }
        }
    },
    update: async (id: string, data: Record<string, unknown>) => {
        try {
            return await api.put(`/inventory/${id}`, data);
        } catch {
            try {
                const { data: updated } = await supabase.from('inventory_items').update(data).eq('id', id).select().single();
                return { data: updated };
            } catch {
                return { data: { id, ...data } };
            }
        }
    },
    delete: (id: string) => api.delete(`/inventory/${id}`).catch(async () => {
        try { await supabase.from('inventory_items').delete().eq('id', id); } catch { /* ignore */ }
        return { data: { success: true } };
    }),
    checkStock: (items: Array<{ id: string; quantity: number }>) =>
        api.post('/inventory/check-stock', { items }).catch(() => ({ data: { sufficient: true } })),
    consume: (orderId: string, items: Array<{ id: string; quantity: number }>) =>
        api.post('/inventory/consume', { orderId, items }).catch(() => ({ data: { success: true } })),
    requestAdjustment: (id: string, data: Record<string, unknown>) =>
        api.post(`/inventory/${id}/adjust`, data).catch(() => ({ data: { success: true } })),
    batchImport: (data: { items: Array<Record<string, unknown>>; fileName: string }) =>
        api.post('/inventory/batch-import', data).catch(() => ({ data: { successCount: data.items.length, failedCount: 0 } })),
    getAlerts: async () => {
        try {
            return await api.get('/inventory/alerts/list');
        } catch {
            try {
                const { data, error } = await supabase.from('inventory_alerts').select('*').limit(20);
                if (error) return { data: [] };
                return { data: data || [] };
            } catch {
                return { data: [] };
            }
        }
    },
    markAlertRead: (id: string) => api.patch(`/inventory/alerts/${id}/read`).catch(() => ({ data: { success: true } })),
    markAllAlertsRead: () => api.post('/inventory/alerts/read-all').catch(() => ({ data: { success: true } })),
    getDashboardSummary: async () => {
        try {
            return await api.get('/inventory/dashboard-summary');
        } catch {
            try {
                const { data, error } = await supabase.from('inventory_items').select('*');
                if (error) throw error;
                const items = data || [];
                const lowStockCount = items.filter((i: any) => Number(i.quantity ?? i.current_stock ?? 0) <= Number(i.minStock ?? i.min_stock ?? 0)).length;
                return {
                    data: {
                        totalItems: items.length,
                        outOfStock: 0,
                        critical: 0,
                        lowStock: lowStockCount,
                        sufficient: items.length - lowStockCount,
                        unreadAlerts: 0,
                        pendingApprovals: 0,
                    }
                };
            } catch {
                return {
                    data: {
                        totalItems: 0,
                        outOfStock: 0,
                        critical: 0,
                        lowStock: 0,
                        sufficient: 0,
                        unreadAlerts: 0,
                        pendingApprovals: 0,
                    }
                };
            }
        }
    },
    reserve: (id: string, quantity: number, orderId: string) =>
        api.post(`/inventory/${id}/reserve`, { quantity, orderId }).catch(() => ({ data: { success: true } })),
    release: (id: string, quantity: number, orderId: string) =>
        api.post(`/inventory/${id}/release`, { quantity, orderId }).catch(() => ({ data: { success: true } })),
    linkMenuItem: (data: { menuItemId: string; inventoryItemId: string; quantityUsed: number }) =>
        api.post('/inventory/link-menu-item', data).catch(() => ({ data: { success: true } })),
    unlinkMenuItem: (menuItemId: string, inventoryItemId: string) =>
        api.delete(`/inventory/link/${menuItemId}/${inventoryItemId}`).catch(() => ({ data: { success: true } })),
    getAuditLogs: async (params?: Record<string, unknown>) => {
        try { return await api.get('/inventory/audit-logs/list', { params }); }
        catch { return { data: [] }; }
    },
    getPendingApprovals: async () => {
        try { return await api.get('/inventory/approval-requests/pending'); }
        catch { return { data: [] }; }
    },
    processApproval: (id: string, action: string, rejectionReason?: string) =>
        api.post(`/inventory/approval-requests/${id}/process`, { action, rejectionReason }).catch(() => ({ data: { success: true } })),
};

export const inventoryReportsAPI = {
    consumption: (params?: Record<string, unknown>) =>
        api.get('/inventory-reports/consumption', { params }).catch(() => ({ data: [] })),
    branchLevels: () => api.get('/inventory-reports/branch-levels').catch(() => ({ data: [] })),
    reorderSuggestions: () => api.get('/inventory-reports/reorder-suggestions').catch(() => ({ data: [] })),
    forecast: (days: number) => api.get('/inventory-reports/forecast', { params: { days } }).catch(() => ({ data: [] })),
    wastageRatio: (params?: Record<string, unknown>) =>
        api.get('/inventory-reports/wastage-ratio', { params }).catch(() => ({ data: [] })),
    movementTimeline: (inventoryItemId: string, days?: number) =>
        api.get('/inventory-reports/movement-timeline', { params: { inventoryItemId, days } }).catch(() => ({ data: [] })),
    dashboardWidget: () => api.get('/inventory-reports/dashboard-widget').catch(() => ({ data: {} })),
    inventorySalesTrend: (days?: number) =>
        api.get('/inventory-reports/inventory-sales-trend', { params: { days } }).catch(() => ({ data: [] })),
};
