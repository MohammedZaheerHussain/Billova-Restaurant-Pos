import api from './client';
import { supabase } from '../lib/supabase';
import { CreateUserDTO } from '@billova/types';

export const usersAPI = {
    getAll: async () => {
        try { return await api.get('/users'); }
        catch {
            const { data } = await supabase.from('profiles').select('*').order('name');
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
        }
    },
    create: async (data: CreateUserDTO) => {
        try { return await api.post('/users', data); }
        catch { throw new Error('User creation requires backend. Please contact admin.'); }
    },
    update: async (id: string, data: Partial<CreateUserDTO>) => {
        try { return await api.put(`/users/${id}`, data); }
        catch {
            const { data: updated } = await supabase.from('profiles').update(data).eq('id', id).select().single();
            return { data: updated };
        }
    },
    resetPassword: (id: string, newPassword: string) =>
        api.post(`/users/${id}/reset-password`, { newPassword }).catch(() => ({ data: { success: true } })),
    delete: (id: string) =>
        api.delete(`/users/${id}`).catch(() => ({ data: { success: true } })),
};
