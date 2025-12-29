// Category Routes
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Get all categories
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { branchId } = req.query;

        const categories = await prisma.category.findMany({
            where: branchId ? { branchId: branchId as string } : undefined,
            include: {
                _count: { select: { menuItems: true } },
            },
            orderBy: { sortOrder: 'asc' },
        });

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

// Create category
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { name, icon, color, sortOrder } = req.body;
        const branchId = req.user!.branchId;

        const category = await prisma.category.create({
            data: {
                branchId,
                name,
                icon,
                color,
                sortOrder: sortOrder || 0,
            },
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { name, icon, color, sortOrder, isActive } = req.body;

        const category = await prisma.category.update({
            where: { id },
            data: { name, icon, color, sortOrder, isActive },
        });

        res.json(category);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Check if category has menu items
        const count = await prisma.menuItem.count({ where: { categoryId: id } });
        if (count > 0) {
            return res.status(400).json({ error: 'Cannot delete category with menu items' });
        }

        await prisma.category.delete({ where: { id } });

        res.json({ message: 'Category deleted' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
