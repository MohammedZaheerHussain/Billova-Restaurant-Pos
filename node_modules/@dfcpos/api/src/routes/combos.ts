// Combo Routes
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Get all combos
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { branchId } = req.query;

        const combos = await prisma.combo.findMany({
            where: branchId ? { branchId: branchId as string, isActive: true } : { isActive: true },
            include: { items: true },
            orderBy: { name: 'asc' },
        });

        res.json(combos);
    } catch (error) {
        console.error('Get combos error:', error);
        res.status(500).json({ error: 'Failed to get combos' });
    }
});

// Create combo
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { name, description, price, image, items } = req.body;

        const combo = await prisma.combo.create({
            data: {
                branchId: req.user!.branchId,
                name,
                description,
                price,
                image,
                items: {
                    create: items.map((item: string) => ({ itemName: item })),
                },
            },
            include: { items: true },
        });

        res.status(201).json(combo);
    } catch (error) {
        console.error('Create combo error:', error);
        res.status(500).json({ error: 'Failed to create combo' });
    }
});

// Update combo
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { name, description, price, image, isActive } = req.body;

        const combo = await prisma.combo.update({
            where: { id },
            data: { name, description, price, image, isActive },
            include: { items: true },
        });

        res.json(combo);
    } catch (error) {
        console.error('Update combo error:', error);
        res.status(500).json({ error: 'Failed to update combo' });
    }
});

// Delete combo
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        await prisma.combo.delete({ where: { id } });

        res.json({ message: 'Combo deleted' });
    } catch (error) {
        console.error('Delete combo error:', error);
        res.status(500).json({ error: 'Failed to delete combo' });
    }
});

export default router;
