import api from './client';
import { supabase } from '../lib/supabase';
import { CreateMenuItemDTO, CreateCategoryDTO } from '@billova/types';

export const menuAPI = {
    getAll: async (branchId?: string, categoryId?: string) => {
        try {
            return await api.get('/menu', { params: { branchId, categoryId } });
        } catch {
            let query = supabase.from('menu_items').select('*, category:categories(*)');
            if (categoryId) query = query.eq('category_id', categoryId);
            const { data } = await query;
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
        }
    },
    getOne: async (id: string) => {
        try {
            return await api.get(`/menu/${id}`);
        } catch {
            const { data } = await supabase.from('menu_items').select('*, category:categories(*)').eq('id', id).single();
            return { data };
        }
    },
    create: async (data: CreateMenuItemDTO) => {
        try {
            return await api.post('/menu', data);
        } catch {
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
        }
    },
    update: async (id: string, data: Partial<CreateMenuItemDTO>) => {
        try {
            return await api.put(`/menu/${id}`, data);
        } catch {
            const { data: updated } = await supabase.from('menu_items').update(data).eq('id', id).select().single();
            return { data: updated };
        }
    },
    toggleAvailability: async (id: string) => {
        try {
            return await api.patch(`/menu/${id}/toggle-availability`);
        } catch {
            const { data: item } = await supabase.from('menu_items').select('is_available').eq('id', id).single();
            const newStatus = !item?.is_available;
            const { data: updated } = await supabase.from('menu_items').update({ is_available: newStatus }).eq('id', id).select().single();
            return { data: updated };
        }
    },
    delete: (id: string) => api.delete(`/menu/${id}`).catch(async () => {
        await supabase.from('menu_items').delete().eq('id', id);
        return { data: { success: true } };
    }),
    extractMenuCard: (imageData: string) => api.post('/menu/extract-menu-card', { imageData }),
};

export const categoriesAPI = {
    getAll: async (branchId?: string) => {
        try {
            return await api.get('/categories', { params: { branchId } });
        } catch {
            const { data } = await supabase.from('categories').select('*').order('name');
            const formatted = (data || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                icon: c.icon || 'Utensils',
                color: c.color,
            }));
            return { data: formatted };
        }
    },
    create: async (data: CreateCategoryDTO) => {
        try {
            return await api.post('/categories', data);
        } catch {
            const { data: cat, error } = await supabase.from('categories').insert([{ name: data.name, icon: data.icon || 'Utensils' }]).select().single();
            if (error) throw error;
            return { data: cat };
        }
    },
    update: (id: string, data: Partial<CreateCategoryDTO>) => api.put(`/categories/${id}`, data).catch(() => ({ data: { success: true } })),
    delete: (id: string) => api.delete(`/categories/${id}`).catch(() => ({ data: { success: true } })),
};

export const combosAPI = {
    getAll: async (branchId?: string) => {
        try { return await api.get('/combos', { params: { branchId } }); }
        catch { return { data: [] }; }
    },
    create: (data: Record<string, unknown>) => api.post('/combos', data).catch(() => ({ data: { success: true } })),
    update: (id: string, data: Record<string, unknown>) => api.put(`/combos/${id}`, data).catch(() => ({ data: { success: true } })),
    delete: (id: string) => api.delete(`/combos/${id}`).catch(() => ({ data: { success: true } })),
};

export const addonsAPI = {
    getAll: async () => {
        try {
            return await api.get('/addons');
        } catch {
            const { data } = await supabase.from('menu_item_addons').select('*').order('name');
            const formatted = (data || []).map((a: any) => ({
                id: a.id,
                name: a.name,
                price: Number(a.price || 0),
                category: a.category || 'Extras',
                isAvailable: a.is_active ?? true,
            }));
            return { data: formatted };
        }
    },
    create: async (data: { name: string; price: number; category?: string }) => {
        try {
            return await api.post('/addons', data);
        } catch {
            const { data: addon, error } = await supabase.from('menu_item_addons').insert([{
                name: data.name,
                price: data.price,
                category: data.category || 'Extras',
                is_active: true,
            }]).select().single();
            if (error) throw error;
            return { data: addon };
        }
    },
    update: async (id: string, data: Record<string, unknown>) => {
        try {
            return await api.put(`/addons/${id}`, data);
        } catch {
            const { data: updated } = await supabase.from('menu_item_addons').update(data).eq('id', id).select().single();
            return { data: updated };
        }
    },
    delete: (id: string) => api.delete(`/addons/${id}`).catch(async () => {
        await supabase.from('menu_item_addons').delete().eq('id', id);
        return { data: { success: true } };
    }),
    getForMenuItem: (menuItemId: string) => api.get(`/addons/menu-item/${menuItemId}`).catch(() => ({ data: [] })),
    linkToMenuItem: (menuItemId: string, addonIds: string[]) =>
        api.post(`/addons/menu-item/${menuItemId}`, { addonIds }).catch(() => ({ data: { success: true } })),
};
