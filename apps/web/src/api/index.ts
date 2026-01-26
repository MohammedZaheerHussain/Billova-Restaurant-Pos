// API Client
import axios from 'axios';
import { useAuthStore } from '../store';
import { supabase } from '../lib/supabase';
import { FeatureFlags, isDualAuthMode, isSupabaseAuthOnly } from '../lib/feature-flags';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests (supports dual-auth mode)
api.interceptors.request.use(async (config) => {
    // Node JWT token (existing auth)
    const nodeToken = useAuthStore.getState().token;

    // If Supabase auth only mode, use Supabase token
    if (isSupabaseAuthOnly()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
            config.headers['X-Auth-Provider'] = 'supabase';
        }
    }
    // Dual auth mode - send both tokens
    else if (isDualAuthMode()) {
        if (nodeToken) {
            config.headers.Authorization = `Bearer ${nodeToken}`;
        }
        // Also send Supabase token as secondary header
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers['X-Supabase-Token'] = session.access_token;
        }
    }
    // Legacy mode - Node JWT only
    else if (nodeToken) {
        config.headers.Authorization = `Bearer ${nodeToken}`;
    }

    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Sign out from both auth systems
            useAuthStore.getState().logout();
            if (FeatureFlags.SUPABASE_CONFIGURED) {
                supabase.auth.signOut();
            }
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);


// Auth API
export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    me: () => api.get('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.post('/auth/change-password', { currentPassword, newPassword }),
    register: (data: { name: string; email: string; password: string; phone?: string }) =>
        api.post('/auth/register', data),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, newPassword: string) =>
        api.post('/auth/reset-password', { token, newPassword }),
};

// Menu API
export const menuAPI = {
    getAll: (branchId?: string, categoryId?: string) =>
        api.get('/menu', { params: { branchId, categoryId } }),
    getOne: (id: string) => api.get(`/menu/${id}`),
    create: (data: any) => api.post('/menu', data),
    update: (id: string, data: any) => api.put(`/menu/${id}`, data),
    toggleAvailability: (id: string) => api.patch(`/menu/${id}/toggle-availability`),
    delete: (id: string) => api.delete(`/menu/${id}`),
    extractMenuCard: (imageData: string) => api.post('/menu/extract-menu-card', { imageData }),
};

// Categories API
export const categoriesAPI = {
    getAll: (branchId?: string) => api.get('/categories', { params: { branchId } }),
    create: (data: any) => api.post('/categories', data),
    update: (id: string, data: any) => api.put(`/categories/${id}`, data),
    delete: (id: string) => api.delete(`/categories/${id}`),
};

// Orders API
export const ordersAPI = {
    getAll: (params?: any) => api.get('/orders', { params }),
    getOne: (id: string) => api.get(`/orders/${id}`),
    create: (data: any, options?: { dailyReset?: boolean }) =>
        api.post('/orders', data, {
            headers: options?.dailyReset ? { 'X-Daily-Order-Reset': 'true' } : {}
        }),
    addPayment: (id: string, data: any) => api.post(`/orders/${id}/payment`, data),
    updateStatus: (id: string, status: string) =>
        api.patch(`/orders/${id}/status`, { status }),
    cancel: (id: string) => api.post(`/orders/${id}/cancel`),
    addItems: (id: string, items: any[]) => api.post(`/orders/${id}/add-items`, { items }),
    // Offline sync
    offlineSync: (data: { localId: string; orderHash: string; order: any }) =>
        api.post('/orders/offline-sync', data),
};

// Tables API
export const tablesAPI = {
    getAll: () => api.get('/tables'),
    create: (data: any) => api.post('/tables', data),
    updateStatus: (id: string, status: string) =>
        api.patch(`/tables/${id}/status`, { status }),
    delete: (id: string) => api.delete(`/tables/${id}`),
    generateQRToken: (id: string) => api.post(`/tables/${id}/qr-token`),
    removeQRToken: (id: string) => api.delete(`/tables/${id}/qr-token`),
};

// Reports API
export const reportsAPI = {
    dailySales: (date?: string) => api.get('/reports/daily-sales', { params: { date } }),
    itemSales: (startDate?: string, endDate?: string) =>
        api.get('/reports/item-sales', { params: { startDate, endDate } }),
    categorySales: (startDate?: string, endDate?: string) =>
        api.get('/reports/category-sales', { params: { startDate, endDate } }),
    hourlySales: () => api.get('/reports/hourly-sales'),
    weeklySummary: () => api.get('/reports/weekly-summary'),
    monthlySummary: () => api.get('/reports/monthly-summary'),
    salesTrend: (days?: number) => api.get('/reports/sales-trend', { params: { days } }),
};

// Users API
export const usersAPI = {
    getAll: () => api.get('/users'),
    create: (data: any) => api.post('/users', data),
    update: (id: string, data: any) => api.put(`/users/${id}`, data),
    resetPassword: (id: string, newPassword: string) =>
        api.post(`/users/${id}/reset-password`, { newPassword }),
    delete: (id: string) => api.delete(`/users/${id}`),
};

// Combos API
export const combosAPI = {
    getAll: (branchId?: string) => api.get('/combos', { params: { branchId } }),
    create: (data: any) => api.post('/combos', data),
    update: (id: string, data: any) => api.put(`/combos/${id}`, data),
    delete: (id: string) => api.delete(`/combos/${id}`),
};

// Super Admin API
export const superAdminAPI = {
    dashboard: () => api.get('/super-admin/dashboard'),
    getRestaurants: () => api.get('/super-admin/restaurants'),
    createRestaurant: (data: any) => api.post('/super-admin/restaurants', data),
    updateRestaurant: (id: string, data: any) => api.patch(`/super-admin/restaurants/${id}`, data),
    deleteRestaurant: (id: string) => api.delete(`/super-admin/restaurants/${id}`),
    updateLicense: (branchId: string, data: any) => api.patch(`/super-admin/licenses/${branchId}`, data),
    // Password reset requests
    getPasswordResets: () => api.get('/super-admin/password-resets'),
    completePasswordReset: (id: string, newPassword: string) =>
        api.post(`/super-admin/password-resets/${id}/complete`, { newPassword }),
    resetUserPassword: (userId: string, newPassword: string) =>
        api.post(`/super-admin/users/${userId}/reset-password`, { newPassword }),
    // Support tickets
    getSupportTickets: () => api.get('/super-admin/support-tickets'),
    updateSupportTicket: (id: string, data: any) => api.patch(`/super-admin/support-tickets/${id}`, data),
};

// Support API (customer-facing)
export const supportAPI = {
    submitTicket: (subject: string, message: string, priority?: string) =>
        api.post('/auth/support-ticket', { subject, message, priority }),
    getMyTickets: () => api.get('/auth/my-tickets'),
};

// Inventory API
export const inventoryAPI = {
    getAll: (params?: any) => api.get('/inventory', { params }),
    getOne: (id: string) => api.get(`/inventory/${id}`),
    create: (data: any) => api.post('/inventory', data),
    update: (id: string, data: any) => api.put(`/inventory/${id}`, data),
    delete: (id: string) => api.delete(`/inventory/${id}`),
    checkStock: (items: any[]) => api.post('/inventory/check-stock', { items }),
    consume: (orderId: string, items: any[]) => api.post('/inventory/consume', { orderId, items }),
    requestAdjustment: (id: string, data: any) => api.post(`/inventory/${id}/adjust`, data),
    batchImport: (data: { items: any[]; fileName: string }) => api.post('/inventory/batch-import', data),
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
    getAuditLogs: (params?: any) => api.get('/inventory/audit-logs/list', { params }),
    getPendingApprovals: () => api.get('/inventory/approval-requests/pending'),
    processApproval: (id: string, action: string, rejectionReason?: string) =>
        api.post(`/inventory/approval-requests/${id}/process`, { action, rejectionReason }),
};

// Inventory Reports API
export const inventoryReportsAPI = {
    consumption: (params?: any) => api.get('/inventory-reports/consumption', { params }),
    branchLevels: () => api.get('/inventory-reports/branch-levels'),
    reorderSuggestions: () => api.get('/inventory-reports/reorder-suggestions'),
    forecast: (days: number) => api.get('/inventory-reports/forecast', { params: { days } }),
    wastageRatio: (params?: any) => api.get('/inventory-reports/wastage-ratio', { params }),
    movementTimeline: (inventoryItemId: string, days?: number) =>
        api.get('/inventory-reports/movement-timeline', { params: { inventoryItemId, days } }),
    dashboardWidget: () => api.get('/inventory-reports/dashboard-widget'),
    inventorySalesTrend: (days?: number) => api.get('/inventory-reports/inventory-sales-trend', { params: { days } }),
};

// Addons API (Extras like cheese, toppings)
export const addonsAPI = {
    getAll: () => api.get('/addons'),
    create: (data: { name: string; price: number; category?: string }) =>
        api.post('/addons', data),
    update: (id: string, data: any) => api.put(`/addons/${id}`, data),
    delete: (id: string) => api.delete(`/addons/${id}`),
    // Link addons to menu items
    getForMenuItem: (menuItemId: string) => api.get(`/addons/menu-item/${menuItemId}`),
    linkToMenuItem: (menuItemId: string, addonIds: string[]) =>
        api.post(`/addons/menu-item/${menuItemId}`, { addonIds }),
};

export default api;

