// Purchase Orders & GRN API Routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Apply auth to all routes
router.use(authMiddleware);

// Get all purchase orders
router.get('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const orders = await prisma.supplierPurchaseOrder.findMany({
            where: { branchId },
            include: {
                supplier: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, unit: true } }
                    }
                },
                _count: { select: { receipts: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});

// Get single purchase order
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const order = await prisma.supplierPurchaseOrder.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, unit: true, sku: true } }
                    }
                },
                receipts: {
                    include: {
                        items: {
                            include: {
                                inventoryItem: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching purchase order:', error);
        res.status(500).json({ error: 'Failed to fetch purchase order' });
    }
});

// Create purchase order
router.post('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { supplierId, expectedDate, notes, items } = req.body;

        // Get next PO number
        const lastPO = await prisma.supplierPurchaseOrder.findFirst({
            where: { branchId },
            orderBy: { poNumber: 'desc' }
        });
        const poNumber = (lastPO?.poNumber || 0) + 1;

        // Calculate total amount
        const totalAmount = items.reduce((sum: number, item: any) =>
            sum + (item.orderedQty * item.unitPrice), 0);

        const order = await prisma.supplierPurchaseOrder.create({
            data: {
                branchId,
                supplierId,
                poNumber,
                expectedDate: expectedDate ? new Date(expectedDate) : null,
                notes,
                totalAmount,
                createdBy: userId,
                items: {
                    create: items.map((item: any) => ({
                        inventoryItemId: item.inventoryItemId,
                        orderedQty: item.orderedQty,
                        unitPrice: item.unitPrice,
                        notes: item.notes
                    }))
                }
            },
            include: {
                supplier: { select: { name: true } },
                items: true
            }
        });

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating purchase order:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});

// Update purchase order status
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED') {
            updateData.approvedBy = userId;
            updateData.approvedAt = new Date();
        }

        const order = await prisma.supplierPurchaseOrder.update({
            where: { id },
            data: updateData
        });

        res.json(order);
    } catch (error) {
        console.error('Error updating PO status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Receive goods (Create GRN)
router.post('/:id/receive', async (req: Request, res: Response) => {
    try {
        const { id: purchaseOrderId } = req.params;
        const userId = (req as any).user.id;
        const { warehouseId, binId, batchNumber, notes, items } = req.body;

        // Get PO details
        const po = await prisma.supplierPurchaseOrder.findUnique({
            where: { id: purchaseOrderId },
            include: { items: true }
        });

        if (!po) {
            return res.status(404).json({ error: 'Purchase order not found' });
        }

        // Get next GRN number
        const lastGRN = await prisma.goodsReceipt.findFirst({
            where: { purchaseOrderId },
            orderBy: { grnNumber: 'desc' }
        });
        const grnNumber = (lastGRN?.grnNumber || 0) + 1;

        // Create GRN with transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create GRN
            const grn = await tx.goodsReceipt.create({
                data: {
                    purchaseOrderId,
                    grnNumber,
                    warehouseId,
                    binId,
                    batchNumber,
                    receivedBy: userId,
                    notes,
                    items: {
                        create: items.map((item: any) => ({
                            inventoryItemId: item.inventoryItemId,
                            quantity: item.quantity,
                            acceptedQty: item.acceptedQty || item.quantity,
                            rejectedQty: item.rejectedQty || 0,
                            rejectionReason: item.rejectionReason
                        }))
                    }
                }
            });

            // Update PO item received quantities
            for (const item of items) {
                const poItem = po.items.find(pi => pi.inventoryItemId === item.inventoryItemId);
                if (poItem) {
                    await tx.supplierPOItem.update({
                        where: { id: poItem.id },
                        data: {
                            receivedQty: {
                                increment: item.acceptedQty || item.quantity
                            }
                        }
                    });
                }

                // Update warehouse stock
                const acceptedQty = item.acceptedQty || item.quantity;
                await tx.warehouseStock.upsert({
                    where: {
                        warehouseId_inventoryItemId: {
                            warehouseId,
                            inventoryItemId: item.inventoryItemId
                        }
                    },
                    update: {
                        quantity: { increment: acceptedQty },
                        batchNumber,
                        binId
                    },
                    create: {
                        warehouseId,
                        inventoryItemId: item.inventoryItemId,
                        quantity: acceptedQty,
                        batchNumber,
                        binId
                    }
                });

                // Update main inventory quantity
                await tx.inventoryItem.update({
                    where: { id: item.inventoryItemId },
                    data: {
                        quantity: { increment: acceptedQty }
                    }
                });

                // Create stock transaction
                await tx.stockTransaction.create({
                    data: {
                        inventoryItemId: item.inventoryItemId,
                        type: 'GRN_RECEIPT',
                        quantity: acceptedQty,
                        reason: `GRN #${grnNumber} from PO #${po.poNumber}`,
                        batchId: grn.id,
                        performedById: userId
                    }
                });
            }

            // Check if all items received - update PO status
            const updatedPO = await tx.supplierPurchaseOrder.findUnique({
                where: { id: purchaseOrderId },
                include: { items: true }
            });

            const allReceived = updatedPO?.items.every(
                item => Number(item.receivedQty) >= Number(item.orderedQty)
            );
            const someReceived = updatedPO?.items.some(
                item => Number(item.receivedQty) > 0
            );

            await tx.supplierPurchaseOrder.update({
                where: { id: purchaseOrderId },
                data: {
                    status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIAL_RECEIVED' : 'ORDERED'
                }
            });

            return grn;
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error receiving goods:', error);
        res.status(500).json({ error: 'Failed to receive goods' });
    }
});

export default router;
