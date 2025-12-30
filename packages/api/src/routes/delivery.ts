// Delivery API Routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Get delivery orders for driver
router.get('/orders', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const branchId = (req as any).user.branchId;
        const { status } = req.query;

        const where: any = {};

        // If driver, show only assigned orders
        if ((req as any).user.role === 'DRIVER') {
            where.driverId = userId;
        } else {
            // Managers can see all
            where.order = { branchId };
        }

        if (status) {
            where.status = status;
        }

        const assignments = await prisma.deliveryAssignment.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customerName: true,
                        customerPhone: true,
                        notes: true,
                        total: true,
                        createdAt: true,
                        status: true
                    }
                },
                driver: {
                    select: { id: true, name: true, phone: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(assignments);
    } catch (error) {
        console.error('Error fetching delivery orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Assign driver to order
router.post('/assign', async (req: Request, res: Response) => {
    try {
        const { orderId, driverId } = req.body;

        const assignment = await prisma.deliveryAssignment.upsert({
            where: { orderId },
            update: { driverId },
            create: { orderId, driverId, status: 'ASSIGNED' }
        });

        res.json(assignment);
    } catch (error) {
        console.error('Error assigning driver:', error);
        res.status(500).json({ error: 'Failed to assign driver' });
    }
});

// Update delivery status (for driver app)
router.put('/orders/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const updateData: any = { status };

        if (status === 'PICKED_UP') {
            updateData.pickedUpAt = new Date();
        } else if (status === 'DELIVERED') {
            updateData.deliveredAt = new Date();

            // Also mark order as completed
            const assignment = await prisma.deliveryAssignment.findUnique({
                where: { id }
            });
            if (assignment) {
                await prisma.order.update({
                    where: { id: assignment.orderId },
                    data: { status: 'COMPLETED', completedAt: new Date() }
                });
            }
        }

        if (notes) updateData.notes = notes;

        const assignment = await prisma.deliveryAssignment.update({
            where: { id },
            data: updateData,
            include: {
                order: { select: { orderNumber: true, customerName: true } }
            }
        });

        res.json(assignment);
    } catch (error) {
        console.error('Error updating delivery:', error);
        res.status(500).json({ error: 'Failed to update delivery' });
    }
});

// Get available drivers
router.get('/drivers', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const drivers = await prisma.user.findMany({
            where: { branchId, role: 'DRIVER', isActive: true },
            select: { id: true, name: true, phone: true }
        });

        res.json(drivers);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
});

export default router;
