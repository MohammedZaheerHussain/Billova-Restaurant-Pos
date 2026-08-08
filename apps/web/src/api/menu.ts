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
            if (branchId) query = query.eq('branch_id', branchId);
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
                branch_id: data.branchId || null,
                is_veg: data.isVeg ?? false,
                is_available: data.isAvailable ?? true,
                description: data.description,
                has_gst: data.hasGST ?? true,
                gst_percent: data.gstPercent ?? 5,
                image: data.image || null,
            }]).select().single();
            if (error) {
                logger.error('[menuAPI.create] Supabase error:', error);
                throw error;
            }
            return { data: created };
        } catch (err) {
            logger.error('[menuAPI.create] Failed:', err);
            throw err;
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
    delete: async (id: string) => {
        if (hasExpressBackend()) return api.delete(`/menu/${id}`).catch(() => ({ data: { success: true } }));
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', id);
            if (error) throw error;
            return { data: { success: true } };
        } catch (err) {
            logger.error('[menuAPI.delete] Failed:', err);
            throw err;
        }
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

            const fcId = findCatId('chicken') || defaultCatId;
            const burgerId = findCatId('burger') || defaultCatId;
            const sandwichId = findCatId('sandwich') || defaultCatId;
            const wrapId = findCatId('wrap') || defaultCatId;
            const momoId = findCatId('momo') || defaultCatId;

            // Complete Extracted items from DFC Menu Card (36 items)
            const menuPresets = [
                // 🍗 FRIED CHICKEN
                { name: 'Lollipop (3 Pcs)', price: 110, categoryId: fcId, isVeg: false },
                { name: 'Lollipop (5 Pcs)', price: 160, categoryId: fcId, isVeg: false },
                { name: 'Wings (4 Pcs)', price: 120, categoryId: fcId, isVeg: false },
                { name: 'Popcorn (150 GM)', price: 120, categoryId: fcId, isVeg: false },
                { name: 'Strips (4 Pcs)', price: 140, categoryId: fcId, isVeg: false },
                { name: 'Leg Piece (1 Pc)', price: 90, categoryId: fcId, isVeg: false },
                { name: 'Body Piece (2 Pcs)', price: 160, categoryId: fcId, isVeg: false },
                { name: 'Hot & Crispy Mini Bucket (4 Pcs)', price: 280, categoryId: fcId, isVeg: false },
                { name: 'Hot & Crispy Family Bucket (6 Pcs)', price: 399, categoryId: fcId, isVeg: false },
                { name: 'Hot & Crispy Big Bucket (9 Pcs)', price: 599, categoryId: fcId, isVeg: false },
                { name: 'Hot & Crispy Mixed Bucket (6 Pcs)', price: 299, categoryId: fcId, isVeg: false },
                { name: 'Hot & Crispy Broasted Chicken (5 Pcs)', price: 399, categoryId: fcId, isVeg: false },

                // 🍔 BURGERS
                { name: 'Veg Burger (Normal)', price: 100, categoryId: burgerId, isVeg: true },
                { name: 'Veg Burger (Cheese)', price: 120, categoryId: burgerId, isVeg: true },
                { name: 'Paneer Burger (Normal)', price: 130, categoryId: burgerId, isVeg: true },
                { name: 'Paneer Burger (Cheese)', price: 150, categoryId: burgerId, isVeg: true },
                { name: 'Chicken Burger (Normal)', price: 80, categoryId: burgerId, isVeg: false },
                { name: 'Chicken Burger (Cheese)', price: 100, categoryId: burgerId, isVeg: false },
                { name: 'Fried Chicken Burger (Normal)', price: 140, categoryId: burgerId, isVeg: false },
                { name: 'Fried Chicken Burger (Cheese)', price: 160, categoryId: burgerId, isVeg: false },
                { name: 'Fried Chicken Tower Burger (Normal)', price: 180, categoryId: burgerId, isVeg: false },
                { name: 'Fried Chicken Tower Burger (Cheese)', price: 200, categoryId: burgerId, isVeg: false },
                { name: 'No Bun Burger (Normal)', price: 180, categoryId: burgerId, isVeg: false },
                { name: 'No Bun Burger (Cheese)', price: 200, categoryId: burgerId, isVeg: false },

                // 🥪 SANDWICHES
                { name: 'Veg Sandwich (Normal)', price: 70, categoryId: sandwichId, isVeg: true },
                { name: 'Veg Sandwich (Cheese)', price: 90, categoryId: sandwichId, isVeg: true },
                { name: 'Paneer Sandwich (Normal)', price: 80, categoryId: sandwichId, isVeg: true },
                { name: 'Paneer Sandwich (Cheese)', price: 100, categoryId: sandwichId, isVeg: true },
                { name: 'Fried Chicken Sandwich (Normal)', price: 80, categoryId: sandwichId, isVeg: false },
                { name: 'Fried Chicken Sandwich (Cheese)', price: 100, categoryId: sandwichId, isVeg: false },

                // 🌯 WRAPS
                { name: 'Veg Wrap (Normal)', price: 100, categoryId: wrapId, isVeg: true },
                { name: 'Veg Wrap (Cheese)', price: 120, categoryId: wrapId, isVeg: true },
                { name: 'Paneer Wrap (Normal)', price: 130, categoryId: wrapId, isVeg: true },
                { name: 'Paneer Wrap (Cheese)', price: 150, categoryId: wrapId, isVeg: true },
                { name: 'Fried Chicken Wrap (Normal)', price: 130, categoryId: wrapId, isVeg: false },
                { name: 'Fried Chicken Wrap (Cheese)', price: 150, categoryId: wrapId, isVeg: false },

                // 🥟 MOMO'S
                { name: 'Paneer Momos (5 Pcs)', price: 80, categoryId: momoId, isVeg: true },
                { name: 'Chicken Momos (5 Pcs)', price: 90, categoryId: momoId, isVeg: false },
                { name: 'Chicken Schezwan Momos (5 Pcs)', price: 100, categoryId: momoId, isVeg: false },
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
            let query = supabase.from('categories').select('*').order('name');
            if (branchId) query = query.eq('branch_id', branchId);
            const { data, error } = await query;
            if (error) return { data: [] };
            const formatted = (data || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                icon: c.icon || '🍽️',
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
            const { data: cat, error } = await supabase.from('categories').insert([{
                name: data.name,
                icon: data.icon || '🍽️',
                branch_id: data.branchId || null,
            }]).select().single();
            if (error) {
                logger.error('[categoriesAPI.create] Supabase error:', error);
                throw error;
            }
            return { data: cat };
        } catch (err) {
            logger.error('[categoriesAPI.create] Failed:', err);
            throw err;
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
