// Purchase Request (Intent Request) API Routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get all purchase requests
router.get('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const { status } = req.query;

        const where: any = { branchId };
        if (status) where.status = status;

        const requests = await prisma.purchaseRequest.findMany({
            where,
            include: {
                items: {
                    include: {
                        inventoryItem: { select: { name: true, unit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Create purchase request
router.post('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { items, notes, priority } = req.body;

        // Get next request number
        const lastRequest = await prisma.purchaseRequest.findFirst({
            where: { branchId },
            orderBy: { requestNumber: 'desc' }
        });
        const requestNumber = (lastRequest?.requestNumber || 0) + 1;

        const request = await prisma.purchaseRequest.create({
            data: {
                branchId,
                requestNumber,
                requestedBy: userId,
                notes,
                priority: priority || 'NORMAL',
                items: {
                    create: items.map((item: any) => ({
                        inventoryItemId: item.inventoryItemId,
                        quantity: item.quantity,
                        notes: item.notes
                    }))
                }
            },
            include: { items: true }
        });

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Update request status (approve/reject)
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED' || status === 'REJECTED') {
            updateData.approvedBy = userId;
            updateData.approvedAt = new Date();
        }

        const request = await prisma.purchaseRequest.update({
            where: { id },
            data: updateData,
            include: { items: true }
        });

        res.json(request);
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// Delete request
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.purchaseRequest.delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ error: 'Failed to delete request' });
    }
});

export default router;
