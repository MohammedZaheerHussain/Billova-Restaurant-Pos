// Table Routes
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all tables
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const tables = await prisma.table.findMany({
            where: { branchId: req.user!.branchId },
            include: {
                orders: {
                    where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] } },
                    include: {
                        items: { include: { menuItem: true } },
                    },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { name: 'asc' },
        });

        res.json(tables);
    } catch (error) {
        console.error('Get tables error:', error);
        res.status(500).json({ error: 'Failed to get tables' });
    }
});

// Update table status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { status } = req.body;

        const table = await prisma.table.update({
            where: { id },
            data: { status },
        });

        res.json(table);
    } catch (error) {
        console.error('Update table status error:', error);
        res.status(500).json({ error: 'Failed to update table status' });
    }
});

// Create table
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { name, capacity } = req.body;

        const table = await prisma.table.create({
            data: {
                branchId: req.user!.branchId,
                name,
                capacity: capacity || 4,
            },
        });

        res.status(201).json(table);
    } catch (error) {
        console.error('Create table error:', error);
        res.status(500).json({ error: 'Failed to create table' });
    }
});

// Delete table
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        await prisma.table.delete({ where: { id } });

        res.json({ message: 'Table deleted' });
    } catch (error) {
        console.error('Delete table error:', error);
        res.status(500).json({ error: 'Failed to delete table' });
    }
});

// Generate QR token for table
router.post('/:id/qr-token', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Generate unique token
        const qrToken = require('crypto').randomBytes(8).toString('hex');

        const table = await prisma.table.update({
            where: { id },
            data: { qrToken }
        });

        // Build QR URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const qrUrl = `${frontendUrl}/order/${qrToken}`;

        res.json({
            qrToken,
            qrUrl,
            table: { id: table.id, name: table.name }
        });
    } catch (error) {
        console.error('Generate QR token error:', error);
        res.status(500).json({ error: 'Failed to generate QR token' });
    }
});

// Remove QR token from table
router.delete('/:id/qr-token', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        await prisma.table.update({
            where: { id },
            data: { qrToken: null }
        });

        res.json({ message: 'QR token removed' });
    } catch (error) {
        console.error('Remove QR token error:', error);
        res.status(500).json({ error: 'Failed to remove QR token' });
    }
});

export default router;

