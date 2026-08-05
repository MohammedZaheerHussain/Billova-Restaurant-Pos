import api from './client';

export const inventoryAPI = {
    getAll: (params?: Record<string, unknown>) => api.get('/inventory', { params }),
    getOne: (id: string) => api.get(`/inventory/${id}`),
    create: (data: Record<string, unknown>) => api.post('/inventory', data),
    update: (id: string, data: Record<string, unknown>) => api.put(`/inventory/${id}`, data),
    delete: (id: string) => api.delete(`/inventory/${id}`),
    checkStock: (items: Array<{ id: string; quantity: number }>) => api.post('/inventory/check-stock', { items }),
    consume: (orderId: string, items: Array<{ id: string; quantity: number }>) => api.post('/inventory/consume', { orderId, items }),
    requestAdjustment: (id: string, data: Record<string, unknown>) => api.post(`/inventory/${id}/adjust`, data),
    batchImport: (data: { items: Array<Record<string, unknown>>; fileName: string }) => api.post('/inventory/batch-import', data),
    getAlerts: () => api.get('/inventory/alerts/list'),
    markAlertRead: (id: string) => api.patch(`/inventory/alerts/${id}/read`),
    markAllAlertsRead: () => api.post('/inventory/alerts/read-all'),
    getDashboardSummary: () => api.get('/inventory/dashboard-summary'),
    reserve: (id: string, quantity: number, orderId: string) =>
        api.post(`/inventory/${id}/reserve`, { quantity, orderId }),
    release: (id: string, quantity: number, orderId: string) =>
        api.post(`/inventory/${id}/release`, { quantity, orderId }),
    linkMenuItem: (data: { menuItemId: string; inventoryItemId: string; quantityUsed: number }) =>
        api.post('/inventory/link-menu-item', data),
    unlinkMenuItem: (menuItemId: string, inventoryItemId: string) =>
        api.delete(`/inventory/link/${menuItemId}/${inventoryItemId}`),
    getAuditLogs: (params?: Record<string, unknown>) => api.get('/inventory/audit-logs/list', { params }),
    getPendingApprovals: () => api.get('/inventory/approval-requests/pending'),
    processApproval: (id: string, action: string, rejectionReason?: string) =>
        api.post(`/inventory/approval-requests/${id}/process`, { action, rejectionReason }),
};

export const inventoryReportsAPI = {
    consumption: (params?: Record<string, unknown>) => api.get('/inventory-reports/consumption', { params }),
    branchLevels: () => api.get('/inventory-reports/branch-levels'),
    reorderSuggestions: () => api.get('/inventory-reports/reorder-suggestions'),
    forecast: (days: number) => api.get('/inventory-reports/forecast', { params: { days } }),
    wastageRatio: (params?: Record<string, unknown>) => api.get('/inventory-reports/wastage-ratio', { params }),
    movementTimeline: (inventoryItemId: string, days?: number) =>
        api.get('/inventory-reports/movement-timeline', { params: { inventoryItemId, days } }),
    dashboardWidget: () => api.get('/inventory-reports/dashboard-widget'),
    inventorySalesTrend: (days?: number) => api.get('/inventory-reports/inventory-sales-trend', { params: { days } }),
};
