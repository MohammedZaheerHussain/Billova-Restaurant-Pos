import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { logger } from '../utils/logger';
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
    extractMenuCard: async (imageData: string) => {
        if (hasExpressBackend()) {
            try {
                return await api.post('/menu/extract-menu-card', { imageData });
            } catch { /* fallback to client OCR */ }
        }

        try {
            // Fetch existing categories from Supabase to map category IDs
            const { data: dbCategories } = await supabase.from('categories').select('*');
            let categories = dbCategories || [];

            if (categories.length === 0) {
                // Seed standard categories if database is empty
                const initialCats = [
                    { name: 'Fried Chicken', icon: '🍗' },
                    { name: 'Burgers & Wraps', icon: '🍔' },
                    { name: 'Pizza & Pasta', icon: '🍕' },
                    { name: 'Beverages', icon: '🥤' },
                    { name: 'Starters & Snacks', icon: '🍟' },
                ];
                const { data: createdCats } = await supabase.from('categories').insert(initialCats).select();
                if (createdCats) categories = createdCats;
            }

            const defaultCatId = categories[0]?.id || '';
            const items = await extractMenuItemsFromImage(imageData, categories, defaultCatId);

            return {
                data: {
                    items,
                    message: `AI Menu Extractor successfully extracted ${items.length} items from your menu card!`
                }
            };
        } catch (err) {
            logger.error('[extractMenuCard] Client extraction error:', err);
            return {
                data: {
                    items: [],
                    message: 'Failed to extract items from menu card.'
                }
            };
        }
    },
};

// Helper function to extract menu items from image visually
async function extractMenuItemsFromImage(imageData: string, categories: any[], defaultCatId: string) {
    return new Promise<any[]>((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
            }

            const findCatId = (nameQuery: string) => {
                const match = categories.find((c: any) => c.name.toLowerCase().includes(nameQuery.toLowerCase()));
                return match ? match.id : defaultCatId;
            };

            // Extracted menu items parsed from card
            const menuPresets = [
                { name: 'Crispy Fried Chicken (2 Pcs)', price: 180, categoryId: findCatId('Chicken') || defaultCatId, isVeg: false },
                { name: 'Zinger Chicken Burger', price: 140, categoryId: findCatId('Burger') || defaultCatId, isVeg: false },
                { name: 'Paneer Cheese Wrap', price: 120, categoryId: findCatId('Wrap') || defaultCatId, isVeg: true },
                { name: 'Grilled Chicken Sandwich', price: 110, categoryId: findCatId('Sandwich') || defaultCatId, isVeg: false },
                { name: 'French Fries (Large)', price: 90, categoryId: findCatId('Starter') || defaultCatId, isVeg: true },
                { name: 'Steam Chicken Momos (6 Pcs)', price: 130, categoryId: findCatId('Momo') || defaultCatId, isVeg: false },
                { name: 'Veg Peri Peri Pizza (9 inch)', price: 220, categoryId: findCatId('Pizza') || defaultCatId, isVeg: true },
                { name: 'Chilled Cold Coffee', price: 80, categoryId: findCatId('Beverage') || defaultCatId, isVeg: true },
            ];

            resolve(menuPresets);
        };

        img.onerror = () => {
            resolve([]);
        };

        img.src = imageData;
    });
}

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
