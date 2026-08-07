import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { CreateTableDTO, TableStatus } from '@billova/types';

export const tablesAPI = {
    getAll: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/tables'); } catch { /* fallback */ }
        }
        try {
            const { data, error } = await supabase.from('tables').select('*').order('name');
            if (error) return { data: [] };
            const formatted = (data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                status: t.status || 'EMPTY',
                capacity: t.capacity || 4,
            }));
            return { data: formatted };
        } catch {
            return { data: [] };
        }
    },
    create: async (data: CreateTableDTO) => {
        if (hasExpressBackend()) {
            try { return await api.post('/tables', data); } catch { /* fallback */ }
        }
        try {
            const { data: created, error } = await supabase.from('tables').insert([{
                name: data.name,
                capacity: data.capacity || 4,
                status: 'EMPTY',
            }]).select().single();
            if (error) throw error;
            return { data: created };
        } catch {
            return { data: { id: 'temp-' + Date.now(), ...data } };
        }
    },
    updateStatus: async (id: string, status: TableStatus | string) => {
        if (hasExpressBackend()) {
            try { return await api.patch(`/tables/${id}/status`, { status }); } catch { /* fallback */ }
        }
        try {
            const { data: updated } = await supabase.from('tables').update({ status }).eq('id', id).select().single();
            return { data: updated };
        } catch {
            return { data: { id, status } };
        }
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/tables/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    generateQRToken: (id: string) => {
        if (hasExpressBackend()) return api.post(`/tables/${id}/qr-token`).catch(() => ({ data: { token: 'qr-demo' } }));
        return Promise.resolve({ data: { token: 'qr-demo' } });
    },
    removeQRToken: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/tables/${id}/qr-token`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};
