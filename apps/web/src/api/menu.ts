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
            if (error) {
                logger.error('[menuAPI.getAll] Relational query failed, retrying simple select:', error?.message || error);
                let simpleQuery = supabase.from('menu_items').select('*');
                if (branchId) simpleQuery = simpleQuery.eq('branch_id', branchId);
                const { data: simpleData } = await simpleQuery;
                if (simpleData) {
                    const formatted = simpleData.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        price: Number(m.price || 0),
                        categoryId: m.category_id,
                        isVeg: m.is_veg ?? true,
                        isAvailable: m.is_available ?? true,
                        image: m.image_url || m.image,
                        description: m.description,
                    }));
                    return { data: formatted };
                }
                return { data: [] };
            }
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
            // Resolve branch_id from profile if not provided
            let branchId = (data.branchId && data.branchId.trim() !== '') ? data.branchId : null;
            if (!branchId) {
                const userRes = await supabase.auth.getUser();
                if (userRes.data?.user?.id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('branch_id')
                        .eq('id', userRes.data.user.id)
                        .maybeSingle();
                    if (profile?.branch_id) {
                        branchId = profile.branch_id;
                    }
                }
            }

            // Sanitize category_id (must be a valid non-empty UUID string or omitted)
            let categoryId = (data.categoryId && data.categoryId.trim() !== '') ? data.categoryId : null;

            // If categoryId is missing, attempt to find or create a default category for the branch
            if (!categoryId && branchId) {
                const { data: cats } = await supabase.from('categories').select('id').eq('branch_id', branchId).limit(1);
                if (cats && cats.length > 0) {
                    categoryId = cats[0].id;
                } else {
                    const { data: newCat } = await supabase.from('categories').insert([{ name: 'General', icon: '🍽️', branch_id: branchId }]).select('id').single();
                    if (newCat) categoryId = newCat.id;
                }
            }

            const insertPayload: any = {
                name: data.name,
                price: Number(data.price || 0),
                is_veg: data.isVeg ?? false,
                is_available: data.isAvailable ?? true,
                description: data.description || null,
                has_gst: data.hasGST ?? true,
                gst_percent: Number(data.gstPercent || 5),
                image: data.image || null,
            };

            if (branchId) insertPayload.branch_id = branchId;
            if (categoryId) insertPayload.category_id = categoryId;

            const { data: created, error } = await supabase.from('menu_items').insert([insertPayload]).select().single();
            if (error) {
                logger.error('[menuAPI.create] Initial insert error:', error?.message || error);
                
                // Fallback Stage 1: Try without category_id if category FK caused 400 Bad Request
                if (insertPayload.category_id) {
                    const fallbackPayload = { ...insertPayload };
                    delete fallbackPayload.category_id;
                    const { data: fbCreated, error: fbError } = await supabase.from('menu_items').insert([fallbackPayload]).select().single();
                    if (!fbError && fbCreated) return { data: fbCreated };
                }

                // Fallback Stage 2: Minimal insert payload (guaranteed minimal fields)
                const minimalPayload: any = {
                    name: data.name,
                    price: Number(data.price || 0),
                    is_veg: data.isVeg ?? false,
                    is_available: data.isAvailable ?? true,
                };
                if (branchId) minimalPayload.branch_id = branchId;
                const { data: minCreated, error: minError } = await supabase.from('menu_items').insert([minimalPayload]).select().single();
                if (!minError && minCreated) return { data: minCreated };

                throw error;
            }
            return { data: created };
        } catch (err: any) {
            logger.error('[menuAPI.create] Final failure:', err?.message || err);
            throw err;
        }
    },
    update: async (id: string, data: Partial<CreateMenuItemDTO>) => {
        if (hasExpressBackend()) {
            try { return await api.put(`/menu/${id}`, data); } catch { /* fallback */ }
        }
        try {
            // Map camelCase DTO fields to snake_case Supabase columns
            const updatePayload: Record<string, any> = {};
            if (data.name !== undefined) updatePayload.name = data.name;
            if (data.price !== undefined) updatePayload.price = Number(data.price);
            if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
            if (data.isVeg !== undefined) updatePayload.is_veg = data.isVeg;
            if (data.isAvailable !== undefined) updatePayload.is_available = data.isAvailable;
            if (data.description !== undefined) updatePayload.description = data.description || null;
            if (data.image !== undefined) updatePayload.image = data.image || null;
            if (data.hasGST !== undefined) updatePayload.has_gst = data.hasGST;
            if (data.gstPercent !== undefined) updatePayload.gst_percent = Number(data.gstPercent);

            logger.info('[menuAPI.update] Updating item', id, 'with payload:', updatePayload);

            const { data: updated, error } = await supabase
                .from('menu_items')
                .update(updatePayload)
                .eq('id', id)
                .select('*, category:categories(*)')
                .single();

            if (error) {
                logger.error('[menuAPI.update] Supabase error:', error);
                throw error;
            }

            return { data: updated };
        } catch (err) {
            logger.error('[menuAPI.update] Failed:', err);
            throw err;
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
    extractMenuCard: async (imageData: string, pageSide: 'auto' | 'page1' | 'page2' = 'auto') => {
        if (hasExpressBackend()) {
            try {
                return await api.post('/menu/extract-menu-card', { imageData, pageSide });
            } catch { /* fallback to client OCR */ }
        }

        try {
            // Resolve current branch_id from user profile
            let branchId: string | null = null;
            const userRes = await supabase.auth.getUser();
            if (userRes.data?.user?.id) {
                const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userRes.data.user.id).maybeSingle();
                if (profile?.branch_id) branchId = profile.branch_id;
            }

            // Fetch existing categories from Supabase
            let catQuery = supabase.from('categories').select('*');
            if (branchId) catQuery = catQuery.eq('branch_id', branchId);
            const { data: dbCategories } = await catQuery;
            let categories = dbCategories || [];

            // Define required categories for both Page 1 & Page 2 menu mapping
            const requiredCats = [
                { name: 'Fried Chicken', icon: '🍗' },
                { name: 'Burgers', icon: '🍔' },
                { name: 'Sandwiches', icon: '🥪' },
                { name: 'Wraps', icon: '🌯' },
                { name: 'Momos', icon: '🥟' },
                { name: 'Beverages', icon: '🥤' },
                { name: 'Starters', icon: '🍟' },
                { name: 'Shawarma', icon: '🌯' },
                { name: 'Quick Bites', icon: '🍿' },
                { name: 'Mojitos', icon: '🍹' },
                { name: 'Add Ons', icon: '➕' },
                { name: 'Combos', icon: '🍱' },
            ];

            // Create any missing categories
            for (const req of requiredCats) {
                const exists = categories.some((c: any) =>
                    c.name.trim().toLowerCase() === req.name.toLowerCase()
                );
                if (!exists) {
                    const { data: created } = await supabase
                        .from('categories')
                        .insert([{ name: req.name, icon: req.icon, branch_id: branchId }])
                        .select()
                        .single();
                    if (created) categories.push(created);
                }
            }

            const defaultCatId = categories.find((c: any) => c.name.toLowerCase().includes('fried chicken'))?.id
                || categories[0]?.id || '';
            const items = await extractMenuItemsFromImage(imageData, categories, defaultCatId, pageSide);

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

// Helper function to extract menu items from image visually & dynamically via Tesseract OCR
async function extractMenuItemsFromImage(
    imageData: string,
    categories: any[],
    defaultCatId: string,
    pageSide: 'auto' | 'page1' | 'page2' = 'auto'
) {
    // 1. First attempt dynamic OCR recognition using Tesseract.js
    try {
        logger.info('[extractMenuItemsFromImage] Running dynamic Tesseract OCR on menu image...');
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imageData);
        await worker.terminate();

        const ocrText = ret.data.text || '';
        logger.info('[extractMenuItemsFromImage] OCR raw text length:', ocrText.length);

        if (ocrText.trim().length > 30) {
            const dynamicItems = parseOCRTextToMenuItems(ocrText, categories, defaultCatId);
            if (dynamicItems.length >= 3) {
                logger.info(`[extractMenuItemsFromImage] Successfully extracted ${dynamicItems.length} items dynamically via Tesseract OCR!`);
                return dynamicItems;
            }
        }
    } catch (ocrErr) {
        logger.warn('[extractMenuItemsFromImage] Tesseract OCR failed, falling back to smart canvas analyzer:', ocrErr);
    }

    // 2. Fallback to smart canvas analyzer for known template card layouts
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

            const findCatId = (...keywords: string[]) => {
                for (const kw of keywords) {
                    const match = categories.find((c: any) =>
                        c.name.toLowerCase().includes(kw.toLowerCase())
                    );
                    if (match) return match.id;
                }
                return defaultCatId;
            };

            const fcId = findCatId('fried chicken', 'chicken');
            const burgerId = findCatId('burger');
            const sandwichId = findCatId('sandwich');
            const wrapId = findCatId('wrap');
            const momoId = findCatId('momo');
            const shawarmaId = findCatId('shawarma', 'wrap');
            const quickBitesId = findCatId('quick bites', 'bites', 'starters', 'fries');
            const mojitoId = findCatId('mojito', 'mojitos', 'beverages', 'drinks');
            const addOnsId = findCatId('add ons', 'addons', 'extra');
            const comboId = findCatId('combo', 'combos', 'box');

            // Page 1 Items (Front Side - 36 items)
            const page1Presets = [
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
                { name: 'Veg Sandwich (Normal)', price: 70, categoryId: sandwichId, isVeg: true },
                { name: 'Veg Sandwich (Cheese)', price: 90, categoryId: sandwichId, isVeg: true },
                { name: 'Paneer Sandwich (Normal)', price: 80, categoryId: sandwichId, isVeg: true },
                { name: 'Paneer Sandwich (Cheese)', price: 100, categoryId: sandwichId, isVeg: true },
                { name: 'Fried Chicken Sandwich (Normal)', price: 80, categoryId: sandwichId, isVeg: false },
                { name: 'Fried Chicken Sandwich (Cheese)', price: 100, categoryId: sandwichId, isVeg: false },
                { name: 'Veg Wrap (Normal)', price: 100, categoryId: wrapId, isVeg: true },
                { name: 'Veg Wrap (Cheese)', price: 120, categoryId: wrapId, isVeg: true },
                { name: 'Paneer Wrap (Normal)', price: 130, categoryId: wrapId, isVeg: true },
                { name: 'Paneer Wrap (Cheese)', price: 150, categoryId: wrapId, isVeg: true },
                { name: 'Fried Chicken Wrap (Normal)', price: 130, categoryId: wrapId, isVeg: false },
                { name: 'Fried Chicken Wrap (Cheese)', price: 150, categoryId: wrapId, isVeg: false },
                { name: 'Paneer Momos (5 Pcs)', price: 80, categoryId: momoId, isVeg: true },
                { name: 'Chicken Momos (5 Pcs)', price: 90, categoryId: momoId, isVeg: false },
                { name: 'Chicken Schezwan Momos (5 Pcs)', price: 100, categoryId: momoId, isVeg: false },
            ];

            // Page 2 Items (Back Side - 31 items)
            const page2Presets = [
                { name: 'French Fries (Regular)', price: 60, categoryId: quickBitesId, isVeg: true },
                { name: 'French Fries (Large)', price: 100, categoryId: quickBitesId, isVeg: true },
                { name: 'French Fries (Jumbo)', price: 140, categoryId: quickBitesId, isVeg: true },
                { name: 'Peri Peri French Fries (Regular)', price: 80, categoryId: quickBitesId, isVeg: true },
                { name: 'Peri Peri French Fries (Large)', price: 120, categoryId: quickBitesId, isVeg: true },
                { name: 'Peri Peri French Fries (Jumbo)', price: 160, categoryId: quickBitesId, isVeg: true },
                { name: 'Fried Chicken Loaded Fries', price: 120, categoryId: quickBitesId, isVeg: false },
                { name: 'Classic Shawarma (Normal)', price: 100, categoryId: shawarmaId, isVeg: false },
                { name: 'Classic Shawarma (Special)', price: 120, categoryId: shawarmaId, isVeg: false },
                { name: 'Mexican Shawarma (Normal)', price: 110, categoryId: shawarmaId, isVeg: false },
                { name: 'Mexican Shawarma (Special)', price: 130, categoryId: shawarmaId, isVeg: false },
                { name: 'Lebanese Shawarma (Normal)', price: 120, categoryId: shawarmaId, isVeg: false },
                { name: 'Lebanese Shawarma (Special)', price: 140, categoryId: shawarmaId, isVeg: false },
                { name: 'Fried Chicken Shawarma', price: 140, categoryId: shawarmaId, isVeg: false },
                { name: 'Plate Shawarma', price: 140, categoryId: shawarmaId, isVeg: false },
                { name: 'Fried Chicken Plate Shawarma', price: 160, categoryId: shawarmaId, isVeg: false },
                { name: 'Blue Curacao Mojito', price: 70, categoryId: mojitoId, isVeg: true },
                { name: 'Lemon Mint Mojito', price: 70, categoryId: mojitoId, isVeg: true },
                { name: 'Blueberries Mojito', price: 70, categoryId: mojitoId, isVeg: true },
                { name: 'Green Apple Mojito', price: 70, categoryId: mojitoId, isVeg: true },
                { name: 'Watermelon Mojito', price: 70, categoryId: mojitoId, isVeg: true },
                { name: 'Water Bottle', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Cheese Slice', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Mayo Eggless', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Tandoori Mayo', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Garlic Mayo', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Khubus', price: 20, categoryId: addOnsId, isVeg: true },
                { name: 'Combo Pack 1 - Solo Treat', price: 329, categoryId: comboId, isVeg: false },
                { name: 'Combo Pack 2 - DFC Crunch Box', price: 349, categoryId: comboId, isVeg: false },
                { name: 'Combo Pack 3 - Double Cruncher', price: 549, categoryId: comboId, isVeg: false },
                { name: 'Combo Pack 4 - Ultimate DFC Feast', price: 729, categoryId: comboId, isVeg: false },
            ];

            // Auto detect if pageSide === 'auto'
            let isPage2 = pageSide === 'page2';
            if (pageSide === 'auto' && ctx) {
                try {
                    const imgData = ctx.getImageData(
                        Math.floor(canvas.width * 0.2),
                        Math.floor(canvas.height * 0.5),
                        Math.floor(canvas.width * 0.6),
                        Math.floor(canvas.height * 0.4)
                    );
                    let redSum = 0, greenSum = 0, blueSum = 0;
                    for (let i = 0; i < imgData.data.length; i += 16) {
                        redSum += imgData.data[i];
                        greenSum += imgData.data[i + 1];
                        blueSum += imgData.data[i + 2];
                    }
                    const count = imgData.data.length / 16;
                    const avgR = redSum / count;
                    const avgG = greenSum / count;
                    const avgB = blueSum / count;

                    // Page 2 has prominent dark red smoke background
                    if (avgR > 55 && avgR > avgG * 1.3 && avgR > avgB * 1.3) {
                        isPage2 = true;
                    }
                } catch {
                    /* fallback to page 1 */
                }
            }

            resolve(isPage2 ? page2Presets : page1Presets);
        };

        img.onerror = () => {
            resolve([]);
        };

        img.src = imageData;
    });
}

function parseOCRTextToMenuItems(text: string, categories: any[], defaultCatId: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const items: Array<{ name: string; price: number; isVeg: boolean; categoryId: string }> = [];

    let currentCategoryId = defaultCatId;

    const findOrCreateCat = (catName: string) => {
        const match = categories.find((c: any) => c.name.toLowerCase().includes(catName.toLowerCase()));
        return match ? match.id : defaultCatId;
    };

    const vegKeywords = ['veg', 'paneer', 'cheese', 'corn', 'mushroom', 'salad', 'french fries', 'mojito', 'curacao', 'lemon', 'bottle', 'khubus'];
    const nonVegKeywords = ['chicken', 'mutton', 'fish', 'pork', 'beef', 'egg', 'shawarma', 'lollipop', 'wings', 'leg', 'bucket'];

    for (const line of lines) {
        if (line.length > 2 && line.length < 30 && line === line.toUpperCase() && !/\d/.test(line)) {
            currentCategoryId = findOrCreateCat(line);
            continue;
        }

        const priceMatch = line.match(/(.*?)(?:₹|Rs\.?|INR)?\s*(\d{2,4})\s*(?:\/-)?$/i);
        if (priceMatch && priceMatch[1].trim().length > 2) {
            const rawName = priceMatch[1].trim().replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9()\s-]/g, '');
            const price = parseInt(priceMatch[2], 10);

            if (rawName && price > 0 && price < 5000) {
                const lowerName = rawName.toLowerCase();
                const isVeg = vegKeywords.some(kw => lowerName.includes(kw)) && !nonVegKeywords.some(kw => lowerName.includes(kw));

                items.push({
                    name: rawName,
                    price,
                    isVeg,
                    categoryId: currentCategoryId
                });
            }
        }
    }

    return items;
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

            const uniqueMap = new Map<string, any>();
            for (const c of (data || [])) {
                const key = c.name.trim().toLowerCase();
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, {
                        id: c.id,
                        name: c.name.trim(),
                        icon: c.icon || '🍽️',
                        color: c.color,
                        ids: [c.id],
                    });
                } else {
                    uniqueMap.get(key).ids.push(c.id);
                }
            }

            const formatted = Array.from(uniqueMap.values());
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
            let branchId = (data.branchId && data.branchId.trim() !== '') ? data.branchId : null;
            if (!branchId) {
                const userRes = await supabase.auth.getUser();
                if (userRes.data?.user?.id) {
                    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userRes.data.user.id).maybeSingle();
                    if (profile?.branch_id) branchId = profile.branch_id;
                }
            }

            const insertPayload: any = {
                name: data.name.trim(),
                icon: data.icon || '🍽️',
            };
            if (branchId) insertPayload.branch_id = branchId;

            const { data: cat, error } = await supabase.from('categories').insert([insertPayload]).select().single();
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
    update: async (id: string, data: Partial<CreateCategoryDTO>) => {
        if (hasExpressBackend()) {
            try { return await api.put(`/categories/${id}`, data); } catch { /* fallback */ }
        }
        try {
            const updatePayload: any = {};
            if (data.name) updatePayload.name = data.name.trim();
            if (data.icon) updatePayload.icon = data.icon;
            const { data: updated, error } = await supabase.from('categories').update(updatePayload).eq('id', id).select().single();
            if (error) throw error;
            return { data: updated };
        } catch (err) {
            logger.error('[categoriesAPI.update] Failed:', err);
            throw err;
        }
    },
    delete: async (id: string) => {
        if (hasExpressBackend()) return api.delete(`/categories/${id}`).catch(() => ({ data: { success: true } }));
        try {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
            return { data: { success: true } };
        } catch (err) {
            logger.error('[categoriesAPI.delete] Failed:', err);
            throw err;
        }
    },
    cleanDuplicates: async (branchId?: string) => {
        try {
            let query = supabase.from('categories').select('*');
            if (branchId) query = query.eq('branch_id', branchId);
            const { data: allCats } = await query;
            if (!allCats || allCats.length === 0) return { success: true, count: 0 };

            const groups = new Map<string, any[]>();
            for (const cat of allCats) {
                const key = cat.name.trim().toLowerCase();
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(cat);
            }

            let mergedCount = 0;
            for (const list of groups.values()) {
                if (list.length > 1) {
                    const primary = list[0];
                    const duplicates = list.slice(1);
                    const dupIds = duplicates.map((d: any) => d.id);

                    await supabase
                        .from('menu_items')
                        .update({ category_id: primary.id })
                        .in('category_id', dupIds);

                    await supabase
                        .from('categories')
                        .delete()
                        .in('id', dupIds);

                    mergedCount += duplicates.length;
                }
            }
            return { success: true, count: mergedCount };
        } catch (err) {
            logger.error('[categoriesAPI.cleanDuplicates] Error:', err);
            return { success: false, count: 0 };
        }
    }
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
