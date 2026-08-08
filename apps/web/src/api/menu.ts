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
    extractMenuCard: async (imageData: string) => {
        if (hasExpressBackend()) {
            try {
                return await api.post('/menu/extract-menu-card', { imageData });
            } catch { /* fallback to client extraction */ }
        }

        try {
            // 1. Resolve current branch_id from user profile
            let branchId: string | null = null;
            const userRes = await supabase.auth.getUser();
            if (userRes.data?.user?.id) {
                const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userRes.data.user.id).maybeSingle();
                if (profile?.branch_id) branchId = profile.branch_id;
            }

            // 2. Fetch existing categories
            let catQuery = supabase.from('categories').select('*');
            if (branchId) catQuery = catQuery.eq('branch_id', branchId);
            const { data: dbCategories } = await catQuery;
            let categories = dbCategories || [];

            // 3. Try Groq AI Vision extraction first
            const groqKey = import.meta.env.VITE_GROQ_API_KEY;
            if (groqKey) {
                try {
                    logger.info('[extractMenuCard] Using Groq AI Vision for extraction...');
                    const items = await extractWithGroqVision(imageData, groqKey, categories, branchId);
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
                } catch (groqErr) {
                    logger.warn('[extractMenuCard] Groq AI Vision failed, will use fallback:', groqErr);
                }
            }

            // 4. Fallback: return empty with message
            return {
                data: {
                    items: [],
                    message: 'AI extraction requires Groq API key. Please configure VITE_GROQ_API_KEY.'
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

/**
 * Extract menu items using Groq AI Vision (qwen/qwen3.6-27b)
 * Flow: Upload base64 → Supabase Storage → public URL → Groq Vision → parsed items
 */
async function extractWithGroqVision(
    imageData: string,
    groqApiKey: string,
    existingCategories: any[],
    branchId: string | null
): Promise<any[]> {

    try {
        // Build the image URL — Groq qwen/qwen3.6-27b accepts base64 data URIs directly
        const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;

        logger.info('[extractWithGroqVision] Sending image to Groq AI Vision...');

        // Call Groq AI Vision
        const existingCatNames = existingCategories.map((c: any) => c.name).join(', ');

        const prompt = `You are a restaurant menu OCR extraction AI. Analyze this restaurant menu card image and extract ALL menu items visible in the image.

Return ONLY a valid JSON object (no markdown, no code blocks, no explanation, JUST the JSON):
{
  "categories": [
    {"name": "Category Name", "icon": "emoji"}
  ],
  "items": [
    {"name": "Item Name", "price": 100, "isVeg": true, "categoryName": "Category Name"}
  ]
}

STRICT RULES:
1. Extract EVERY single item visible in the menu with their EXACT names and EXACT prices
2. Group items into logical categories based on the section headers visible in the menu
3. Use appropriate food emoji icons for each category (🍗🍔🥪🌯🥟🍟🥤🍹🍱 etc.)
4. Set isVeg to true for vegetarian items (no meat/fish/egg), false for non-veg
5. Price must be a number without currency symbols (e.g., 120 not ₹120)
6. If an item has size variants (Small/Large/Regular), create separate entries for each
7. Include ALL sections: main items, sides, drinks, combos, add-ons, everything
8. Be extremely thorough - extract every single item, don't skip any
9. Item names should be clean and properly capitalized
${existingCatNames ? `10. Existing categories in the system: ${existingCatNames}. Reuse these category names when they match.` : ''}`;

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
                temperature: 0.1,
                max_tokens: 8192,
            }),
        });

        if (!groqResponse.ok) {
            const errBody = await groqResponse.text();
            throw new Error(`Groq API error ${groqResponse.status}: ${errBody}`);
        }

        const groqData = await groqResponse.json();
        const responseText = groqData.choices?.[0]?.message?.content || '';

        logger.info('[extractWithGroqVision] Groq AI response received, parsing...');

        // Parse the JSON response
        let cleanJson = responseText.trim();
        // Remove thinking tags if present (Qwen3 model outputs <think>...</think>)
        cleanJson = cleanJson.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        // Remove markdown code blocks if present
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
        cleanJson = cleanJson.trim();

        const extractedData = JSON.parse(cleanJson);

        if (!extractedData.items || !Array.isArray(extractedData.items)) {
            throw new Error('Invalid AI response: no items array');
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
