import api from './client';
import { supabase } from '../lib/supabase';

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }).catch(() => ({ data: null })),
    me: () => api.get('/auth/me').catch(() => ({ data: null })),
    changePassword: async (currentPassword: string, newPassword: string) => {
        try { return await api.post('/auth/change-password', { currentPassword, newPassword }); }
        catch {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            return { data: { success: true } };
        }
    },
    register: (data: { name: string; email: string; password: string; phone?: string }) =>
        api.post('/auth/register', data).catch(() => ({ data: null })),
    forgotPassword: async (email: string) => {
        try { return await api.post('/auth/forgot-password', { email }); }
        catch {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return { data: { success: true } };
        }
    },
    resetPassword: (token: string, newPassword: string) =>
        api.post('/auth/reset-password', { token, newPassword }).catch(() => ({ data: null })),
};

export const supportAPI = {
    submitTicket: async (subject: string, message: string, priority?: string) => {
        try { return await api.post('/auth/support-ticket', { subject, message, priority }); }
        catch {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            const { data, error } = await supabase.from('support_tickets').insert([{
                user_id: user.id,
                subject,
                message,
                priority: priority || 'NORMAL',
                status: 'OPEN',
            }]).select().single();
            if (error) throw error;
            return { data };
        }
    },
    getMyTickets: async () => {
        try { return await api.get('/auth/my-tickets'); }
        catch {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { data: [] };
            const { data } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            return { data: data || [] };
        }
    },
};
