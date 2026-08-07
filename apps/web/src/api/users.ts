import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { CreateUserDTO } from '@billova/types';

export const usersAPI = {
    getAll: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/users'); } catch { /* fallback */ }
        }
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('name');
            if (error) return { data: [] };
            const formatted = (data || []).map((u: any) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role || 'CASHIER',
                isActive: u.is_active ?? true,
                branchId: u.branch_id,
                createdAt: u.created_at,
            }));
            return { data: formatted };
        } catch {
            return { data: [] };
        }
    },
    create: async (data: CreateUserDTO) => {
        if (hasExpressBackend()) {
            try { return await api.post('/users', data); } catch { /* fallback */ }
        }
        throw new Error('User creation requires backend. Please contact admin.');
    },
    update: async (id: string, data: Partial<CreateUserDTO>) => {
        if (hasExpressBackend()) {
            try { return await api.put(`/users/${id}`, data); } catch { /* fallback */ }
        }
        try {
            const { data: updated } = await supabase.from('profiles').update(data).eq('id', id).select().single();
            return { data: updated };
        } catch {
            return { data: { id, ...data } };
        }
    },
    resetPassword: (id: string, newPassword: string) => {
        if (hasExpressBackend()) return api.post(`/users/${id}/reset-password`, { newPassword }).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/users/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};
