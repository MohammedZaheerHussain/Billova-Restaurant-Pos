// Addons API Routes
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// ==================== ADDON MANAGEMENT ====================

// Get all addons for the branch
router.get('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const branchId = req.user?.branchId;

        const addons = await prisma.menuItemAddon.findMany({
            where: { branchId },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });

        res.json(addons);
    } catch (error) {
        next(error);
    }
});

// Create new addon
router.post('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const branchId = req.user?.branchId;
        const { name, price, category } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Addon name is required' });
        }

        const addon = await prisma.menuItemAddon.create({
            data: {
                branchId: branchId!,
                name,
                price: parseFloat(price) || 0,
                category: category || 'Extras',
            },
        });

        res.status(201).json(addon);
    } catch (error) {
        next(error);
    }
});

// Update addon
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, price, category, isActive } = req.body;

        const addon = await prisma.menuItemAddon.update({
            where: { id },
            data: {
                name,
                price: parseFloat(price) || 0,
                category,
                isActive,
            },
        });

        res.json(addon);
    } catch (error) {
        next(error);
    }
});

// Delete addon
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        await prisma.menuItemAddon.delete({
            where: { id },
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ==================== LINK ADDONS TO MENU ITEMS ====================

// Get addons linked to a menu item
router.get('/menu-item/:menuItemId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { menuItemId } = req.params;

        const links = await prisma.menuItemAddonLink.findMany({
            where: { menuItemId },
            include: { addon: true },
        });

        res.json(links.map(l => l.addon));
    } catch (error) {
        next(error);
    }
});

// Link addons to a menu item
router.post('/menu-item/:menuItemId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { menuItemId } = req.params;
        const { addonIds } = req.body; // Array of addon IDs

        if (!Array.isArray(addonIds)) {
            return res.status(400).json({ error: 'addonIds must be an array' });
        }

        // Delete existing links
        await prisma.menuItemAddonLink.deleteMany({
            where: { menuItemId },
        });

        // Create new links
        if (addonIds.length > 0) {
            await prisma.menuItemAddonLink.createMany({
                data: addonIds.map((addonId: string) => ({
                    menuItemId,
                    addonId,
                })),
            });
        }

        // Fetch updated links
        const links = await prisma.menuItemAddonLink.findMany({
            where: { menuItemId },
            include: { addon: true },
        });

        res.json(links.map(l => l.addon));
    } catch (error) {
        next(error);
    }
});

export default router;
