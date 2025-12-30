// Stock Adjustments API Routes (Damage/Expired/Wastage)
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Apply auth to all routes
router.use(authMiddleware);

// Get all stock adjustments
router.get('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const { status, type } = req.query;

        const where: any = { branchId };
        if (status) where.status = status;
        if (type) where.adjustmentType = type;

        const adjustments = await prisma.stockAdjustment.findMany({
            where,
            include: {
                inventoryItem: {
                    select: { id: true, name: true, unit: true, sku: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(adjustments);
    } catch (error) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Failed to fetch adjustments' });
    }
});

// Create stock adjustment
router.post('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const {
            inventoryItemId,
            warehouseId,
            fromBinId,
            toBinId,
            adjustmentType,
            quantity,
            reason,
            notes,
            batchNumber
        } = req.body;

        const adjustment = await prisma.stockAdjustment.create({
            data: {
                branchId,
                inventoryItemId,
                warehouseId,
                fromBinId,
                toBinId,
                adjustmentType,
                quantity,
                reason,
                notes,
                batchNumber,
                performedBy: userId
            },
            include: {
                inventoryItem: { select: { name: true, unit: true } }
            }
        });

        res.status(201).json(adjustment);
    } catch (error) {
        console.error('Error creating adjustment:', error);
        res.status(500).json({ error: 'Failed to create adjustment' });
    }
});

// Approve stock adjustment
router.put('/:id/approve', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const adjustment = await prisma.stockAdjustment.findUnique({
            where: { id }
        });

        if (!adjustment) {
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ error: 'Adjustment already processed' });
        }

        // Process the adjustment with transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update adjustment status
            const updated = await tx.stockAdjustment.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedBy: userId,
                    processedAt: new Date()
                }
            });

            // Determine transaction type based on adjustment type
            let transactionType: string;
            switch (adjustment.adjustmentType) {
                case 'DAMAGE':
                    transactionType = 'DAMAGE';
                    break;
                case 'EXPIRED':
                    transactionType = 'EXPIRED';
                    break;
                case 'WASTAGE':
                    transactionType = 'WASTAGE';
                    break;
                case 'PRODUCTION_USE':
                    transactionType = 'PRODUCTION_USE';
                    break;
                default:
                    transactionType = 'ADJUSTMENT';
            }

            // Deduct from warehouse stock
            await tx.warehouseStock.updateMany({
                where: {
                    warehouseId: adjustment.warehouseId,
                    inventoryItemId: adjustment.inventoryItemId
                },
                data: {
                    quantity: { decrement: Number(adjustment.quantity) }
                }
            });

            // Deduct from main inventory
            await tx.inventoryItem.update({
                where: { id: adjustment.inventoryItemId },
                data: {
                    quantity: { decrement: Number(adjustment.quantity) }
                }
            });

            // Create stock transaction for audit
            await tx.stockTransaction.create({
                data: {
                    inventoryItemId: adjustment.inventoryItemId,
                    type: transactionType as any,
                    quantity: Number(adjustment.quantity),
                    reason: adjustment.reason,
                    performedById: adjustment.performedBy,
                    approvedById: userId
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Error approving adjustment:', error);
        res.status(500).json({ error: 'Failed to approve adjustment' });
    }
});

// Reject stock adjustment
router.put('/:id/reject', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { reason } = req.body;

        const adjustment = await prisma.stockAdjustment.update({
            where: { id },
            data: {
                status: 'REJECTED',
                approvedBy: userId,
                processedAt: new Date(),
                notes: reason
            }
        });

        res.json(adjustment);
    } catch (error) {
        console.error('Error rejecting adjustment:', error);
        res.status(500).json({ error: 'Failed to reject adjustment' });
    }
});

// Get adjustment summary stats
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const stats = await prisma.stockAdjustment.groupBy({
            by: ['adjustmentType', 'status'],
            where: { branchId },
            _count: true,
            _sum: { quantity: true }
        });

        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
