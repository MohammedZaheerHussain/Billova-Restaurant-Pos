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
            };

            // Schema uses image_url, not image
            if (data.image) insertPayload.image_url = data.image;
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
            if (data.image !== undefined) updatePayload.image_url = data.image || null;
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
            return { data: null };
        }
    },
    delete: async (id: string) => {
        if (hasExpressBackend()) {
            try { return await api.delete(`/menu/${id}`); } catch { /* fallback */ }
        }
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', id);
            if (error) throw error;
            return { data: { success: true } };
        } catch (err) {
            logger.error('[menuAPI.delete] Failed:', err);
            throw err;
        }
    },
    extractMenuCard: async (imageData: string, branchId?: string | null) => {
        try {
            logger.info('[extractMenuCard] Starting AI Vision menu extraction...');

            // 1. Fetch existing categories
            let dbCategories: any[] = [];
            try {
                const catRes = await categoriesAPI.getAll(branchId || undefined);
                dbCategories = catRes.data || [];
            } catch (catErr) {
                logger.warn('[extractMenuCard] Could not fetch categories from DB:', catErr);
            }
            let categories = dbCategories || [];

            // 2. Try Groq AI Vision extraction
            const groqKey = import.meta.env.VITE_GROQ_API_KEY;
            if (groqKey) {
                try {
                    logger.info('[extractMenuCard] Using Groq AI Vision for extraction...');
                    const items = await extractWithGroqVision(imageData, groqKey, categories, branchId || null);
                    if (items.length >= 1) {
                        // Refresh categories (Groq may have created new ones)
                        const { data: refreshedCats } = await supabase.from('categories').select('*').eq('branch_id', branchId || '');
                        return {
                            data: {
                                items,
                                categories: refreshedCats || categories,
                                message: `🤖 Groq AI Vision extracted ${items.length} items from your menu card!`
                            }
                        };
                    }
                } catch (groqErr: any) {
                    logger.error('[extractMenuCard] Groq AI Vision failed:', groqErr);
                    return {
                        data: {
                            items: [],
                            message: `AI Vision Error: ${groqErr?.message || 'Failed to process image'}`
                        }
                    };
                }
            }

            // 3. Fallback: return empty with message
            return {
                data: {
                    items: [],
                    message: 'AI extraction requires a valid Groq API key in Vercel environment variables.'
                }
            };
        } catch (err: any) {
            logger.error('[extractMenuCard] Client extraction error:', err);
            return {
                data: {
                    items: [],
                    message: err?.message || 'Failed to extract items from menu card.'
                }
            };
        }
    },
};

/**
 * Downscale and compress image to optimal resolution for Groq Vision (1080px max dimension, quality 0.85)
 */
async function compressImageForGroq(imageData: string, maxDimension = 1080, quality = 0.85): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(imageData);
            }
        };
        img.onerror = () => resolve(imageData);
        img.src = imageData;
    });
}

/**
 * Extract menu items using Groq AI Vision (qwen/qwen3.6-27b)
 */
async function extractWithGroqVision(
    imageData: string,
    groqApiKey: string,
    existingCategories: any[],
    branchId: string | null
): Promise<any[]> {

    try {
        // Downscale image to max 1080px and compress to JPEG for sharp text under Groq 8000 TPM limit
        const compressedImage = await compressImageForGroq(imageData, 1080, 0.85);
        const imageUrl = compressedImage.startsWith('data:') ? compressedImage : `data:image/jpeg;base64,${compressedImage}`;

        logger.info('[extractWithGroqVision] Sending high-resolution image to Groq AI Vision...');

        // Call Groq AI Vision
        const existingCatNames = existingCategories.map((c: any) => c.name).join(', ');

        const prompt = `You are a high-precision restaurant menu OCR extraction AI.
Carefully inspect this restaurant menu card image from top to bottom, left to right, and extract EVERY single menu item with EXACT names and EXACT prices.

CRITICAL EXTRACTION RULES:
1. MULTI-PRICE / SIZE / VARIANT ITEMS:
   If an item has multiple sizes or price tiers (e.g. Normal/Special, 150G/250G, Small/Medium/Large, Half/Full), create a SEPARATE entry for EACH variant:
   - Example: "French Fries (150G)" with price 69, and "French Fries (250G)" with price 130
   - Example: "Peri Peri French Fries (150G)" with price 79, and "Peri Peri French Fries (250G)" with price 140
   - Example: "Classic Shawarma (Normal)" with price 90, and "Classic Shawarma (Special)" with price 120
   - Example: "Mexican Shawarma (Normal)" with price 100, and "Mexican Shawarma (Special)" with price 130
   - Example: "Labonese Shawarma (Normal)" with price 110, and "Labonese Shawarma (Special)" with price 140
2. EXACT PRICES: Read every single number carefully. Do NOT approximate or round prices. Look at the exact printed price (e.g., 79 is 79 not 76, 179 is 179 not 176, 259 is 259, 349 is 349, 649 is 649, 729 is 729). Strip currency symbols ('₹', '/-').
3. ALL SECTIONS & HEADERS: Scan every section thoroughly:
   - Quick Bites, Fries, Loaded Fries
   - Shawarma, Rolls, Wraps, Plate Shawarma
   - Mojitos, Beverages, Coolers, Water
   - Add Ons, Dips, Sauces, Bread, Kubus
   - Combos, Family Packs, Meals, Treats
   - Desserts, Ice Creams, Shakes
   - Burgers, Fried Chicken, Momos, Sandwiches
4. VEG / NON-VEG:
   - Set isVeg to true for vegetarian items, drinks, mojitos, shakes, fries, dips, and desserts.
   - Set isVeg to false for chicken, meat, shawarma, seafood, and bacon items.
5. CATEGORIES:
   - Group items into clear categories based on section headers (e.g., "Quick Bites", "Shawarma", "Mojito", "Add Ons", "DFC Combo").
   - Use matching food emojis (🍟, 🌯, 🍹, 🧀, 🍱, 🍗, 🍔, 🥤, 🍰, 🥟).
   ${existingCatNames ? `Existing categories: ${existingCatNames}. Reuse them when matching.` : ''}

Return ONLY valid JSON (no markdown, no other text):
{
  "categories": [
    {"name": "Category Name", "icon": "emoji"}
  ],
  "items": [
    {"name": "Item Name (Variant)", "price": 100, "isVeg": true, "categoryName": "Category Name"}
  ]
}`;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'qwen/qwen3.6-27b',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } },
                    ],
                }],
                temperature: 0.05,
                max_tokens: 4096,
            }),
        });

        if (!groqResponse.ok) {
            const errBody = await groqResponse.text();
            throw new Error(`Groq API error ${groqResponse.status}: ${errBody}`);
        }

        const groqData = await groqResponse.json();
        const responseText = groqData.choices?.[0]?.message?.content || '';

        logger.info('[extractWithGroqVision] Groq AI response received, parsing...');

        // Parse the JSON response with multi-layer fallback
        let cleanJson = responseText.trim();

        // 1. Strip think tags if present
        cleanJson = cleanJson.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (cleanJson.includes('<think>')) {
            const parts = cleanJson.split('</think>');
            cleanJson = (parts[parts.length - 1] || '').trim();
        }

        // 2. Strip markdown backticks
        cleanJson = cleanJson.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 3. Extract JSON object substring if surrounded by other text
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        }

        const extractedData = JSON.parse(cleanJson);

        if (!extractedData.items || !Array.isArray(extractedData.items)) {
            throw new Error('Invalid AI response: no items array found in JSON');
        }

        // Create any new categories that AI discovered
        const aiCategories = extractedData.categories || [];
        for (const aiCat of aiCategories) {
            const exists = existingCategories.some((c: any) =>
                c.name.trim().toLowerCase() === aiCat.name.trim().toLowerCase()
            );
            if (!exists) {
                const { data: created } = await supabase
                    .from('categories')
                    .insert([{ name: aiCat.name, icon: aiCat.icon || '🍽️', branch_id: branchId }])
                    .select()
                    .single();
                if (created) existingCategories.push(created);
            }
        }

        // Map AI items to category IDs
        const items = extractedData.items.map((item: any) => {
            const catMatch = existingCategories.find((c: any) =>
                c.name.trim().toLowerCase() === (item.categoryName || '').trim().toLowerCase()
            );
            return {
                name: item.name,
                price: Number(item.price) || 0,
                isVeg: item.isVeg ?? false,
                categoryId: catMatch?.id || existingCategories[0]?.id || '',
            };
        }).filter((item: any) => item.name && item.price > 0);

        logger.info(`[extractWithGroqVision] Successfully extracted ${items.length} items via Groq AI Vision!`);
        return items;

    } catch (err) {
        logger.error('[extractWithGroqVision] Error:', err);
        throw err;
    }
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
