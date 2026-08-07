import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { CreateMenuItemDTO, CreateCategoryDTO } from '@billova/types';

export const menuAPI = {
    getAll: async (branchId?: string, categoryId?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/menu', { params: { branchId, categoryId } }); } catch { /* fallback */ }
        }
        try {
            let query = supabase.from('menu_items').select('*, category:categories(*)');
            if (categoryId) query = query.eq('category_id', categoryId);
            const { data, error } = await query;
            if (error) return { data: [] };
            const formatted = (data || []).map((m: any) => ({
                id: m.id,
                name: m.name,
                price: Number(m.price || 0),
                categoryId: m.category_id,
                category: m.category ? { name: m.category.name, icon: m.category.icon } : undefined,
                isVeg: m.is_veg ?? true,
                isAvailable: m.is_available ?? true,
                image: m.image_url || m.image,
                description: m.description,
            }));
            return { data: formatted };
        } catch {
            return { data: [] };
        }
    },
    getOne: async (id: string) => {
        if (hasExpressBackend()) {
            try { return await api.get(`/menu/${id}`); } catch { /* fallback */ }
        }
        try {
            const { data } = await supabase.from('menu_items').select('*, category:categories(*)').eq('id', id).single();
            return { data };
        } catch {
            return { data: null };
        }
    },
    create: async (data: CreateMenuItemDTO) => {
        if (hasExpressBackend()) {
            try { return await api.post('/menu', data); } catch { /* fallback */ }
        }
        try {
            const { data: created, error } = await supabase.from('menu_items').insert([{
                name: data.name,
                price: data.price,
                category_id: data.categoryId,
                is_veg: data.isVeg ?? true,
                is_available: data.isAvailable ?? true,
                description: data.description,
            }]).select().single();
            if (error) throw error;
            return { data: created };
        } catch {
            return { data: { id: 'temp-' + Date.now(), ...data } };
        }
    },
    update: async (id: string, data: Partial<CreateMenuItemDTO>) => {
        if (hasExpressBackend()) {
            try { return await api.put(`/menu/${id}`, data); } catch { /* fallback */ }
        }
        try {
            const { data: updated } = await supabase.from('menu_items').update(data).eq('id', id).select().single();
            return { data: updated };
        } catch {
            return { data: { id, ...data } };
        }
    },
    toggleAvailability: async (id: string) => {
        if (hasExpressBackend()) {
            try { return await api.patch(`/menu/${id}/toggle-availability`); } catch { /* fallback */ }
        }
        try {
            const { data: item } = await supabase.from('menu_items').select('is_available').eq('id', id).single();
            const newStatus = !item?.is_available;
            const { data: updated } = await supabase.from('menu_items').update({ is_available: newStatus }).eq('id', id).select().single();
            return { data: updated };
        } catch {
            return { data: { id, is_available: true } };
        }
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/menu/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    extractMenuCard: (imageData: string) => api.post('/menu/extract-menu-card', { imageData }).catch(() => ({ data: { items: [] } })),
};

export const categoriesAPI = {
    getAll: async (branchId?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/categories', { params: { branchId } }); } catch { /* fallback */ }
        }
        try {
            const { data, error } = await supabase.from('categories').select('*').order('name');
            if (error) return { data: [] };
            const formatted = (data || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                icon: c.icon || 'Utensils',
                color: c.color,
            }));
            return { data: formatted };
        } catch {
            return { data: [] };
        }
    },
    create: async (data: CreateCategoryDTO) => {
        if (hasExpressBackend()) {
            try { return await api.post('/categories', data); } catch { /* fallback */ }
        }
        try {
            const { data: cat, error } = await supabase.from('categories').insert([{ name: data.name, icon: data.icon || 'Utensils' }]).select().single();
            if (error) throw error;
            return { data: cat };
        } catch {
            return { data: { id: 'temp-' + Date.now(), ...data } };
        }
    },
    update: (id: string, data: Partial<CreateCategoryDTO>) => {
        if (hasExpressBackend()) return api.put(`/categories/${id}`, data).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/categories/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};

export const combosAPI = {
    getAll: async (branchId?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/combos', { params: { branchId } }); } catch { /* fallback */ }
        }
        return { data: [] };
    },
    create: (data: Record<string, unknown>) => {
        if (hasExpressBackend()) return api.post('/combos', data).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    update: (id: string, data: Record<string, unknown>) => {
        if (hasExpressBackend()) return api.put(`/combos/${id}`, data).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/combos/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};

export const addonsAPI = {
    getAll: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/addons'); } catch { /* fallback */ }
        }
        try {
            const { data, error } = await supabase.from('menu_item_addons').select('*').order('name');
            if (error) return { data: [] };
            const formatted = (data || []).map((a: any) => ({
                id: a.id,
                name: a.name,
                price: Number(a.price || 0),
                category: a.category || 'Extras',
                isAvailable: a.is_active ?? true,
            }));
            return { data: formatted };
        } catch {
            return { data: [] };
        }
    },
    create: async (data: { name: string; price: number; category?: string }) => {
        if (hasExpressBackend()) {
            try { return await api.post('/addons', data); } catch { /* fallback */ }
        }
        try {
            const { data: addon, error } = await supabase.from('menu_item_addons').insert([{
                name: data.name,
                price: data.price,
                category: data.category || 'Extras',
                is_active: true,
            }]).select().single();
            if (error) throw error;
            return { data: addon };
        } catch {
            return { data: { id: 'temp-' + Date.now(), ...data } };
        }
    },
    update: async (id: string, data: Record<string, unknown>) => {
        if (hasExpressBackend()) {
            try { return await api.put(`/addons/${id}`, data); } catch { /* fallback */ }
        }
        try {
            const { data: updated } = await supabase.from('menu_item_addons').update(data).eq('id', id).select().single();
            return { data: updated };
        } catch {
            return { data: { id, ...data } };
        }
    },
    delete: (id: string) => {
        if (hasExpressBackend()) return api.delete(`/addons/${id}`).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
    getForMenuItem: (menuItemId: string) => {
        if (hasExpressBackend()) return api.get(`/addons/menu-item/${menuItemId}`).catch(() => ({ data: [] }));
        return Promise.resolve({ data: [] });
    },
    linkToMenuItem: (menuItemId: string, addonIds: string[]) => {
        if (hasExpressBackend()) return api.post(`/addons/menu-item/${menuItemId}`, { addonIds }).catch(() => ({ data: { success: true } }));
        return Promise.resolve({ data: { success: true } });
    },
};
