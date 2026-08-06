import api from './client';
import { supabase } from '../lib/supabase';
import { CreateTableDTO, TableStatus } from '@billova/types';

export const tablesAPI = {
    getAll: async () => {
        try {
            return await api.get('/tables');
        } catch {
            const { data } = await supabase.from('tables').select('*').order('name');
            const formatted = (data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                status: t.status || 'EMPTY',
                capacity: t.capacity || 4,
            }));
            return { data: formatted };
        }
    },
    create: async (data: CreateTableDTO) => {
        try {
            return await api.post('/tables', data);
        } catch {
            const { data: created, error } = await supabase.from('tables').insert([{
                name: data.name,
                capacity: data.capacity || 4,
                status: 'EMPTY',
            }]).select().single();
            if (error) throw error;
            return { data: created };
        }
    },
    updateStatus: async (id: string, status: TableStatus | string) => {
        try {
            return await api.patch(`/tables/${id}/status`, { status });
        } catch {
            const { data: updated } = await supabase.from('tables').update({ status }).eq('id', id).select().single();
            return { data: updated };
        }
    },
    delete: (id: string) => api.delete(`/tables/${id}`).catch(() => ({ data: { success: true } })),
    generateQRToken: (id: string) => api.post(`/tables/${id}/qr-token`).catch(() => ({ data: { token: 'qr-demo' } })),
    removeQRToken: (id: string) => api.delete(`/tables/${id}/qr-token`).catch(() => ({ data: { success: true } })),
};
