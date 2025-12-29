// Menu Routes - CRUD for menu items
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import Groq from 'groq-sdk';

const router = Router();

// Initialize Groq AI (you'll need to set GROQ_API_KEY in your .env)
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

// Get all menu items (with categories and variants)
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { branchId, categoryId, isAvailable } = req.query;

        const where: any = {};
        if (branchId) where.branchId = branchId;
        if (categoryId) where.categoryId = categoryId;
        if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';

        const items = await prisma.menuItem.findMany({
            where,
            include: {
                category: true,
                variants: true,
            },
            orderBy: [
                { category: { sortOrder: 'asc' } },
                { sortOrder: 'asc' },
                { name: 'asc' },
            ],
        });

        res.json(items);
    } catch (error) {
        console.error('Get menu error:', error);
        res.status(500).json({ error: 'Failed to get menu' });
    }
});

// Get single menu item
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        const item = await prisma.menuItem.findUnique({
            where: { id },
            include: {
                category: true,
                variants: true,
                ingredients: {
                    include: { inventoryItem: true },
                },
            },
        });

        if (!item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        res.json(item);
    } catch (error) {
        console.error('Get menu item error:', error);
        res.status(500).json({ error: 'Failed to get menu item' });
    }
});

// Create menu item
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { name, description, price, categoryId, isVeg, image, variants, hasGST, gstPercent } = req.body;
        const branchId = req.user!.branchId;

        const item = await prisma.menuItem.create({
            data: {
                branchId,
                categoryId,
                name,
                description,
                price,
                isVeg: isVeg || false,
                image,
                hasGST: hasGST !== false,
                gstPercent: gstPercent || 5,
                variants: variants ? { create: variants } : undefined,
            },
            include: {
                category: true,
                variants: true,
            },
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({ error: 'Failed to create menu item' });
    }
});

// Update menu item
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { name, description, price, categoryId, isVeg, isAvailable, image, hasGST, gstPercent } = req.body;

        const item = await prisma.menuItem.update({
            where: { id },
            data: {
                name,
                description,
                price,
                categoryId,
                isVeg,
                isAvailable,
                image,
                hasGST,
                gstPercent,
            },
            include: {
                category: true,
                variants: true,
            },
        });

        res.json(item);
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ error: 'Failed to update menu item' });
    }
});

// Toggle availability
router.patch('/:id/toggle-availability', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        const item = await prisma.menuItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        const updated = await prisma.menuItem.update({
            where: { id },
            data: { isAvailable: !item.isAvailable },
        });

        res.json(updated);
    } catch (error) {
        console.error('Toggle availability error:', error);
        res.status(500).json({ error: 'Failed to toggle availability' });
    }
});

// Delete menu item
router.delete('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Check if item exists
        const item = await prisma.menuItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Menu item not found' });
        }

        // Delete related order items first (if any exist)
        await prisma.orderItem.deleteMany({ where: { menuItemId: id } });

        // Delete the menu item
        await prisma.menuItem.delete({ where: { id } });

        res.json({ message: 'Menu item deleted' });
    } catch (error: any) {
        console.error('Delete menu item error:', error);
        // Check for foreign key constraint error
        if (error.code === 'P2003') {
            res.status(400).json({ error: 'Cannot delete item - it is used in existing orders' });
        } else {
            res.status(500).json({ error: 'Failed to delete menu item' });
        }
    }
});

// Extract items from menu card image using AI Vision
router.post('/extract-menu-card', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { imageData } = req.body;
        const branchId = req.user!.branchId;

        if (!imageData) {
            return res.status(400).json({ error: 'Image data is required' });
        }

        // Get existing categories for this branch
        let existingCategories = await prisma.category.findMany({
            where: { branchId },
        });

        let extractedData: { categories: Array<{ name: string, icon: string }>, items: Array<{ name: string, price: number, isVeg: boolean, categoryName: string }> };

        // Use Groq AI Vision if available
        if (groq && GROQ_API_KEY) {
            try {
                // Check image size (Groq has 4MB limit)
                const imageSizeBytes = Buffer.byteLength(imageData, 'utf8');
                const imageSizeMB = imageSizeBytes / (1024 * 1024);
                console.log(`Image size: ${imageSizeMB.toFixed(2)} MB`);

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

                console.log('Calling Groq API with model: meta-llama/llama-4-scout-17b-16e-instruct');

                const response = await groq.chat.completions.create({
                    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt,
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageData,
                                    },
                                },
                            ],
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 4096,
                });

                console.log('Groq API response received');
                const responseText = response.choices[0]?.message?.content || '';
                console.log('Response text length:', responseText.length);

                // Clean up the response - remove markdown code blocks if present
                let cleanJson = responseText.trim();
                if (cleanJson.startsWith('```json')) {
                    cleanJson = cleanJson.slice(7);
                }
                if (cleanJson.startsWith('```')) {
                    cleanJson = cleanJson.slice(3);
                }
                if (cleanJson.endsWith('```')) {
                    cleanJson = cleanJson.slice(0, -3);
                }
                cleanJson = cleanJson.trim();

                extractedData = JSON.parse(cleanJson);
                console.log('AI extracted:', extractedData.items.length, 'items in', extractedData.categories.length, 'categories');

            } catch (aiError: any) {
                console.error('AI extraction failed:', aiError);
                console.error('Error details:', JSON.stringify(aiError, null, 2));
                return res.status(500).json({
                    error: 'AI extraction failed. ' + (aiError.message || 'Please try again.'),
                    details: aiError.error?.message || String(aiError)
                });
            }
        } else {
            // No AI API key - return error
            return res.status(400).json({
                error: 'AI Menu Extraction requires a Groq API key. Please add GROQ_API_KEY to your .env file.',
                setupInstructions: 'Get your free API key from https://console.groq.com/keys'
            });
        }

        // Create any new categories that don't exist
        const categoryMap: Record<string, string> = {};

        for (const cat of extractedData.categories) {
            let existing = existingCategories.find((c: any) =>
                c.name.toLowerCase() === cat.name.toLowerCase()
            );

            if (!existing) {
                existing = await prisma.category.create({
                    data: {
                        branchId,
                        name: cat.name,
                        icon: cat.icon || '🍽️',
                    },
                });
                existingCategories.push(existing);
            }
            categoryMap[cat.name] = existing.id;
        }

        // Map items with category IDs
        const itemsWithCategoryIds = extractedData.items.map(item => ({
            name: item.name,
            price: String(item.price),
            isVeg: item.isVeg,
            categoryId: categoryMap[item.categoryName] || existingCategories[0]?.id || '',
            categoryName: item.categoryName,
        }));

        res.json({
            success: true,
            categories: extractedData.categories,
            items: itemsWithCategoryIds,
            message: `✨ AI extracted ${itemsWithCategoryIds.length} items in ${extractedData.categories.length} categories`,
        });
    } catch (error) {
        console.error('Extract menu error:', error);
        res.status(500).json({ error: 'Failed to extract menu items' });
    }
});

export default router;

