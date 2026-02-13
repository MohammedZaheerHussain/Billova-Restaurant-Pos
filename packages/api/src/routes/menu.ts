// Menu Routes - CRUD for menu items (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import Groq from 'groq-sdk';
import { logger } from '../lib/logger';

const router = Router();

// Initialize Groq AI
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Get all menu items (with categories and variants)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { branchId, categoryId, isAvailable } = req.query;

        let query = sb
            .from('menu_items')
            .select(`
                *,
                categories (*),
                menu_item_variants (*)
            `)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (branchId) query = query.eq('branch_id', branchId);
        if (categoryId) query = query.eq('category_id', categoryId);
        if (isAvailable !== undefined) query = query.eq('is_available', isAvailable === 'true');

        const { data: items, error } = await query;

        if (error) throw error;

        // Transform to camelCase for frontend compatibility
        const transformed = items.map((item: any) => ({
            id: item.id,
            branchId: item.branch_id,
            categoryId: item.category_id,
            name: item.name,
            description: item.description,
            price: item.price,
            image: item.image,
            isVeg: item.is_veg,
            isAvailable: item.is_available,
            hasGST: item.has_gst,
            gstPercent: item.gst_percent,
            sortOrder: item.sort_order,
            category: item.categories,
            variants: item.menu_item_variants,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));

        res.json(transformed);
    } catch (error) {
        logger.error('Get menu error:', error);
        res.status(500).json({ error: 'Failed to get menu' });
    }
});

// Get single menu item
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: item, error } = await sb
            .from('menu_items')
            .select(`
                *,
                categories (*),
                menu_item_variants (*)
            `)
            .eq('id', id)
            .single();

        if (error || !item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // Transform to camelCase
        const transformed = {
            id: item.id,
            branchId: item.branch_id,
            categoryId: item.category_id,
            name: item.name,
            description: item.description,
            price: item.price,
            image: item.image,
            isVeg: item.is_veg,
            isAvailable: item.is_available,
            hasGST: item.has_gst,
            gstPercent: item.gst_percent,
            category: item.categories,
            variants: item.menu_item_variants,
        };

        res.json(transformed);
    } catch (error) {
        logger.error('Get menu item error:', error);
        res.status(500).json({ error: 'Failed to get menu item' });
    }
});

// Create menu item
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { name, description, price, categoryId, isVeg, image, variants, hasGST, gstPercent } = req.body;
        const branchId = req.user!.branchId;

        // Create menu item
        const { data: item, error } = await sb
            .from('menu_items')
            .insert({
                branch_id: branchId,
                category_id: categoryId,
                name,
                description,
                price,
                is_veg: isVeg || false,
                image,
                has_gst: hasGST !== false,
                gst_percent: gstPercent || 5,
            })
            .select(`
                *,
                categories (*)
            `)
            .single();

        if (error) throw error;

        // Create variants if provided
        if (variants && variants.length > 0) {
            const variantData = variants.map((v: any) => ({
                menu_item_id: item.id,
                name: v.name,
                price: v.price,
                is_default: v.isDefault || false,
            }));

            await sb.from('menu_item_variants').insert(variantData);
        }

        // Fetch complete item with variants
        const { data: completeItem } = await sb
            .from('menu_items')
            .select(`
                *,
                categories (*),
                menu_item_variants (*)
            `)
            .eq('id', item.id)
            .single();

        res.status(201).json({
            id: completeItem.id,
            branchId: completeItem.branch_id,
            categoryId: completeItem.category_id,
            name: completeItem.name,
            description: completeItem.description,
            price: completeItem.price,
            image: completeItem.image,
            isVeg: completeItem.is_veg,
            isAvailable: completeItem.is_available,
            hasGST: completeItem.has_gst,
            gstPercent: completeItem.gst_percent,
            category: completeItem.categories,
            variants: completeItem.menu_item_variants,
        });
    } catch (error) {
        logger.error('Create menu item error:', error);
        res.status(500).json({ error: 'Failed to create menu item' });
    }
});

// Update menu item
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, description, price, categoryId, isVeg, isAvailable, image, hasGST, gstPercent } = req.body;

        const { data: item, error } = await sb
            .from('menu_items')
            .update({
                name,
                description,
                price,
                category_id: categoryId,
                is_veg: isVeg,
                is_available: isAvailable,
                image,
                has_gst: hasGST,
                gst_percent: gstPercent,
            })
            .eq('id', id)
            .select(`
                *,
                categories (*),
                menu_item_variants (*)
            `)
            .single();

        if (error) throw error;

        res.json({
            id: item.id,
            branchId: item.branch_id,
            categoryId: item.category_id,
            name: item.name,
            description: item.description,
            price: item.price,
            image: item.image,
            isVeg: item.is_veg,
            isAvailable: item.is_available,
            hasGST: item.has_gst,
            gstPercent: item.gst_percent,
            category: item.categories,
            variants: item.menu_item_variants,
        });
    } catch (error) {
        logger.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update menu item' });
    }
});

// Toggle availability
router.patch('/:id/toggle-availability', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Get current state
        const { data: current, error: fetchError } = await sb
            .from('menu_items')
            .select('is_available')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // Toggle
        const { data: updated, error } = await sb
            .from('menu_items')
            .update({ is_available: !current.is_available })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: updated.id,
            isAvailable: updated.is_available,
        });
    } catch (error) {
        logger.error('Toggle availability error:', error);
        res.status(500).json({ error: 'Failed to toggle availability' });
    }
});

// Delete menu item
router.delete('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Check if item exists
        const { data: item, error: fetchError } = await sb
            .from('menu_items')
            .select('id')
            .eq('id', id)
            .single();

        if (fetchError || !item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // Delete related order items first (cascade should handle this, but just in case)
        await sb.from('order_items').delete().eq('menu_item_id', id);

        // Delete variants
        await sb.from('menu_item_variants').delete().eq('menu_item_id', id);

        // Delete the menu item
        const { error } = await sb
            .from('menu_items')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Menu item deleted' });
    } catch (error: any) {
        logger.error('Delete menu item error:', error);
        if (error.code === '23503') { // Foreign key violation
            res.status(400).json({ error: 'Cannot delete item - it is used in existing orders' });
        } else {
            res.status(500).json({ error: 'Failed to delete menu item' });
        }
    }
});

// Extract items from menu card image using AI Vision
router.post('/extract-menu-card', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { imageData } = req.body;
        const branchId = req.user!.branchId;

        if (!imageData) {
            return res.status(400).json({ error: 'Image data is required' });
        }

        // Get existing categories for this branch
        const { data: existingCategories } = await sb
            .from('categories')
            .select('*')
            .eq('branch_id', branchId);

        let categoriesList = existingCategories || [];

        let extractedData: { categories: Array<{ name: string, icon: string }>, items: Array<{ name: string, price: number, isVeg: boolean, categoryName: string }> };

        // Use Groq AI Vision if available
        if (groq && GROQ_API_KEY) {
            try {
                const imageSizeBytes = Buffer.byteLength(imageData, 'utf8');
                const imageSizeMB = imageSizeBytes / (1024 * 1024);

                if (imageSizeMB > 4) {
                    return res.status(400).json({
                        error: 'Image too large. Please use an image smaller than 4MB.',
                        size: `${imageSizeMB.toFixed(2)} MB`
                    });
                }

                const prompt = `Analyze this restaurant menu image and extract ALL menu items. 

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, just pure JSON):
{
  "categories": [
    {"name": "Category Name", "icon": "emoji"}
  ],
  "items": [
    {"name": "Item Name", "price": 100, "isVeg": true, "categoryName": "Category Name"}
  ]
}

Rules:
1. Extract EVERY item visible in the menu with their exact names and prices
2. Group items into logical categories based on the menu structure
3. Use appropriate food emoji icons for categories
4. Set isVeg to true for vegetarian items (no meat/fish), false for non-veg
5. Price should be a number without currency symbols
6. If price has variants (like Small/Large), use the lowest price
7. Include ALL sections: main items, sides, drinks, combos, addons, etc.
8. Be thorough - don't miss any items visible in the image`;

                const response = await groq.chat.completions.create({
                    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: imageData } },
                            ],
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 4096,
                });

                const responseText = response.choices[0]?.message?.content || '';

                let cleanJson = responseText.trim();
                if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
                if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
                if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
                cleanJson = cleanJson.trim();

                extractedData = JSON.parse(cleanJson);

            } catch (aiError: any) {
                logger.error('AI extraction failed:', aiError);
                return res.status(500).json({
                    error: 'AI extraction failed. ' + (aiError.message || 'Please try again.'),
                });
            }
        } else {
            return res.status(400).json({
                error: 'AI Menu Extraction requires a Groq API key.',
            });
        }

        // Create any new categories that don't exist
        const categoryMap: Record<string, string> = {};

        for (const cat of extractedData.categories) {
            let existing = categoriesList.find((c: any) =>
                c.name.toLowerCase() === cat.name.toLowerCase()
            );

            if (!existing) {
                const { data: newCat } = await sb
                    .from('categories')
                    .insert({
                        branch_id: branchId,
                        name: cat.name,
                        icon: cat.icon || '🍽️',
                    })
                    .select()
                    .single();

                if (newCat) {
                    categoriesList.push(newCat);
                    existing = newCat;
                }
            }
            if (existing) categoryMap[cat.name] = existing.id;
        }

        // Map items with category IDs
        const itemsWithCategoryIds = extractedData.items.map(item => ({
            name: item.name,
            price: String(item.price),
            isVeg: item.isVeg,
            categoryId: categoryMap[item.categoryName] || categoriesList[0]?.id || '',
            categoryName: item.categoryName,
        }));

        res.json({
            success: true,
            categories: extractedData.categories,
            items: itemsWithCategoryIds,
            message: `✨ AI extracted ${itemsWithCategoryIds.length} items in ${extractedData.categories.length} categories`,
        });
    } catch (error) {
        logger.error('Extract menu error:', error);
        res.status(500).json({ error: 'Failed to extract menu items' });
    }
});

export default router;
