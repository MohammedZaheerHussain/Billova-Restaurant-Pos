import api from './client';

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

export const supportAPI = {
    submitTicket: (subject: string, message: string, priority?: string) =>
        api.post('/auth/support-ticket', { subject, message, priority }),
    getMyTickets: () => api.get('/auth/my-tickets'),
};
