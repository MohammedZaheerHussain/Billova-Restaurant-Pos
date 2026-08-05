import api from './client';

export const superAdminAPI = {
    dashboard: () => api.get('/super-admin/dashboard'),
    getRestaurants: () => api.get('/super-admin/restaurants'),
    getRestaurant: (id: string) => api.get(`/super-admin/restaurants/${id}`),
    createRestaurant: (data: Record<string, unknown>) => api.post('/super-admin/restaurants', data),
    updateRestaurant: (id: string, data: Record<string, unknown>) => api.patch(`/super-admin/restaurants/${id}`, data),
    deleteRestaurant: (id: string) => api.delete(`/super-admin/restaurants/${id}`),
    forceDeactivate: (id: string) => api.post(`/super-admin/restaurants/${id}/force-deactivate`),
    upgradePlan: (id: string, data: { plan: string; durationMonths?: number; isLifetime?: boolean }) =>
        api.post(`/super-admin/restaurants/${id}/upgrade-plan`, data),
    reactivate: (id: string) => api.post(`/super-admin/restaurants/${id}/reactivate`),
    updateLicense: (branchId: string, data: Record<string, unknown>) => api.patch(`/super-admin/licenses/${branchId}`, data),
    getPasswordResets: () => api.get('/super-admin/password-resets'),
    completePasswordReset: (id: string, newPassword: string) =>
        api.post(`/super-admin/password-resets/${id}/complete`, { newPassword }),
    resetUserPassword: (userId: string, newPassword: string) =>
        api.post(`/super-admin/users/${userId}/reset-password`, { newPassword }),
    getSupportTickets: () => api.get('/super-admin/support-tickets'),
    updateSupportTicket: (id: string, data: Record<string, unknown>) => api.patch(`/super-admin/support-tickets/${id}`, data),
};
