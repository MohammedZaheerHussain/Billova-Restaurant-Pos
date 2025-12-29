// Inventory Routes - Advanced Inventory Management System
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Helper: Update stock status based on quantity
const calculateStockStatus = (quantity: number, minStock: number, safetyStock: number) => {
    if (quantity <= 0) return 'OUT_OF_STOCK';
    if (quantity <= minStock * 0.5) return 'CRITICAL';
    if (quantity <= minStock) return 'LOW_STOCK';
    return 'SUFFICIENT';
};

// Helper: Create stock alert if needed
const createStockAlertIfNeeded = async (
    prisma: any,
    item: any,
    branchId: string
) => {
    const quantity = Number(item.quantity);
    const minStock = Number(item.minStock);

    let alertType: string | null = null;
    let message = '';

    if (quantity <= 0) {
        alertType = 'OUT_OF_STOCK';
        message = `${item.name} is out of stock!`;
    } else if (quantity <= minStock * 0.5) {
        alertType = 'CRITICAL';
        message = `${item.name} stock is critical! Only ${quantity} ${item.unit} remaining.`;
    } else if (quantity <= minStock) {
        alertType = 'LOW_STOCK';
        message = `${item.name} is running low. Current: ${quantity} ${item.unit}, Min: ${minStock} ${item.unit}`;
    }

    if (alertType) {
        // Check if unread alert already exists
        const existingAlert = await prisma.stockAlert.findFirst({
            where: {
                inventoryItemId: item.id,
                alertType,
                isRead: false,
            },
        });

        if (!existingAlert) {
            await prisma.stockAlert.create({
                data: {
                    branchId,
                    inventoryItemId: item.id,
                    alertType,
                    message,
                },
            });
        }
    }
};

// Get all inventory items
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { category, stockStatus, search, showInactive } = req.query;

        const where: any = { branchId: req.user!.branchId };

        if (!showInactive) {
            where.isActive = true;
        }
        if (category) {
            where.category = category;
        }
        if (stockStatus) {
            where.stockStatus = stockStatus;
        }
        if (search) {
            where.OR = [
                { name: { contains: search as string } },
                { sku: { contains: search as string } },
            ];
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            include: {
                ingredients: {
                    include: { menuItem: { select: { id: true, name: true } } },
                },
                _count: { select: { transactions: true, alerts: true } },
            },
            orderBy: { name: 'asc' },
        });

        res.json(items);
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to get inventory' });
    }
});

// Dashboard widget summary - MUST be before /:id route
router.get('/dashboard-summary', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const branchId = req.user!.branchId;

        const [
            totalItems,
            outOfStock,
            critical,
            lowStock,
            unreadAlerts,
            pendingApprovals,
        ] = await Promise.all([
            prisma.inventoryItem.count({ where: { branchId, isActive: true } }),
            prisma.inventoryItem.count({ where: { branchId, isActive: true, stockStatus: 'OUT_OF_STOCK' } }),
            prisma.inventoryItem.count({ where: { branchId, isActive: true, stockStatus: 'CRITICAL' } }),
            prisma.inventoryItem.count({ where: { branchId, isActive: true, stockStatus: 'LOW_STOCK' } }),
            prisma.stockAlert.count({ where: { branchId, isRead: false } }),
            prisma.stockApprovalRequest.count({
                where: { status: 'PENDING', inventoryItem: { branchId } },
            }),
        ]);

        res.json({
            totalItems,
            outOfStock,
            critical,
            lowStock,
            sufficient: totalItems - outOfStock - critical - lowStock,
            unreadAlerts,
            pendingApprovals,
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
});

// Get single inventory item with transactions
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { transactionLimit = 50 } = req.query;

        const item = await prisma.inventoryItem.findUnique({
            where: { id },
            include: {
                ingredients: {
                    include: { menuItem: { select: { id: true, name: true } } },
                },
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: Number(transactionLimit),
                },
                alerts: {
                    where: { isRead: false },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        res.json(item);
    } catch (error) {
        console.error('Get inventory item error:', error);
        res.status(500).json({ error: 'Failed to get inventory item' });
    }
});

// Create new inventory item
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const {
            sku,
            name,
            category,
            unit,
            quantity,
            minStock,
            safetyStock,
            costPerUnit,
            expiryDate,
        } = req.body;

        const branchId = req.user!.branchId;

        // Calculate initial stock status
        const stockStatus = calculateStockStatus(
            Number(quantity || 0),
            Number(minStock || 0),
            Number(safetyStock || 0)
        );

        const item = await prisma.inventoryItem.create({
            data: {
                branchId,
                sku,
                name,
                category: category || 'INGREDIENT',
                unit,
                quantity: quantity || 0,
                minStock: minStock || 0,
                safetyStock: safetyStock || 0,
                costPerUnit: costPerUnit || 0,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                stockStatus,
            },
        });

        // Create initial stock transaction
        if (quantity > 0) {
            await prisma.stockTransaction.create({
                data: {
                    inventoryItemId: item.id,
                    type: 'PURCHASE',
                    quantity: quantity,
                    previousQty: 0,
                    newQty: quantity,
                    reason: 'Initial stock entry',
                    performedById: req.user!.id,
                },
            });
        }

        // Check if alert needed
        await createStockAlertIfNeeded(prisma, item, branchId);

        res.status(201).json(item);
    } catch (error) {
        console.error('Create inventory item error:', error);
        res.status(500).json({ error: 'Failed to create inventory item' });
    }
});

// Update inventory item
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const {
            sku,
            name,
            category,
            unit,
            minStock,
            safetyStock,
            costPerUnit,
            expiryDate,
            isActive,
        } = req.body;

        const existingItem = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!existingItem) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Recalculate stock status
        const stockStatus = calculateStockStatus(
            Number(existingItem.quantity),
            Number(minStock ?? existingItem.minStock),
            Number(safetyStock ?? existingItem.safetyStock)
        );

        const item = await prisma.inventoryItem.update({
            where: { id },
            data: {
                sku,
                name,
                category,
                unit,
                minStock,
                safetyStock,
                costPerUnit,
                expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                isActive,
                stockStatus,
            },
        });

        // Check if alert needed
        await createStockAlertIfNeeded(prisma, item, req.user!.branchId);

        res.json(item);
    } catch (error) {
        console.error('Update inventory item error:', error);
        res.status(500).json({ error: 'Failed to update inventory item' });
    }
});

// Delete inventory item
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Check if item has ingredient mappings
        const ingredientCount = await prisma.itemIngredient.count({
            where: { inventoryItemId: id },
        });

        if (ingredientCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete item with menu mappings. Remove mappings first.',
            });
        }

        await prisma.inventoryItem.delete({ where: { id } });
        res.json({ message: 'Inventory item deleted' });
    } catch (error) {
        console.error('Delete inventory item error:', error);
        res.status(500).json({ error: 'Failed to delete inventory item' });
    }
});

// Check stock availability for items (used by POS before order)
router.post('/check-stock', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { items } = req.body; // [{ menuItemId, quantity, variantId? }]

        const branchId = req.user!.branchId;
        const insufficientItems: any[] = [];
        const stockDetails: any[] = [];

        for (const orderItem of items) {
            // Get ingredient mappings for this menu item
            const ingredients = await prisma.itemIngredient.findMany({
                where: { menuItemId: orderItem.menuItemId },
                include: { inventoryItem: true },
            });

            for (const ing of ingredients) {
                const requiredQty = Number(ing.quantityUsed) * orderItem.quantity;
                const availableQty = Number(ing.inventoryItem.quantity) - Number(ing.inventoryItem.reservedQty);

                const detail = {
                    inventoryItemId: ing.inventoryItem.id,
                    inventoryItemName: ing.inventoryItem.name,
                    menuItemId: orderItem.menuItemId,
                    requiredQty,
                    availableQty,
                    unit: ing.inventoryItem.unit,
                    isSufficient: availableQty >= requiredQty,
                };

                stockDetails.push(detail);

                if (!detail.isSufficient) {
                    insufficientItems.push({
                        ...detail,
                        shortfall: requiredQty - availableQty,
                    });
                }
            }
        }

        res.json({
            isAvailable: insufficientItems.length === 0,
            insufficientItems,
            stockDetails,
        });
    } catch (error) {
        console.error('Check stock error:', error);
        res.status(500).json({ error: 'Failed to check stock' });
    }
});

// Consume stock (called after order is created)
router.post('/consume', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { orderId, items } = req.body; // items: [{ menuItemId, quantity }]

        const branchId = req.user!.branchId;
        const consumedItems: any[] = [];

        for (const orderItem of items) {
            const ingredients = await prisma.itemIngredient.findMany({
                where: { menuItemId: orderItem.menuItemId },
                include: { inventoryItem: true },
            });

            for (const ing of ingredients) {
                const consumeQty = Number(ing.quantityUsed) * orderItem.quantity;
                const previousQty = Number(ing.inventoryItem.quantity);
                const newQty = previousQty - consumeQty;

                // Update inventory
                const updatedItem = await prisma.inventoryItem.update({
                    where: { id: ing.inventoryItem.id },
                    data: {
                        quantity: Math.max(0, newQty),
                        stockStatus: calculateStockStatus(
                            Math.max(0, newQty),
                            Number(ing.inventoryItem.minStock),
                            Number(ing.inventoryItem.safetyStock)
                        ),
                    },
                });

                // Create transaction log
                await prisma.stockTransaction.create({
                    data: {
                        inventoryItemId: ing.inventoryItem.id,
                        type: 'CONSUMPTION',
                        quantity: -consumeQty,
                        previousQty,
                        newQty: Math.max(0, newQty),
                        reason: `Order #${orderId}`,
                        orderId,
                        performedById: req.user!.id,
                    },
                });

                // Check for alerts
                await createStockAlertIfNeeded(prisma, updatedItem, branchId);

                consumedItems.push({
                    inventoryItemId: ing.inventoryItem.id,
                    name: ing.inventoryItem.name,
                    consumed: consumeQty,
                    remaining: Math.max(0, newQty),
                });
            }
        }

        res.json({ success: true, consumedItems });
    } catch (error) {
        console.error('Consume stock error:', error);
        res.status(500).json({ error: 'Failed to consume stock' });
    }
});

// Request manual stock adjustment (needs approval for non-owners)
router.post('/:id/adjust', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { adjustmentType, quantity, reason } = req.body;
        const userRole = req.user!.role;

        const item = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        // Owners and Super Admins can adjust directly
        if (['OWNER', 'SUPER_ADMIN'].includes(userRole)) {
            const previousQty = Number(item.quantity);
            const adjustQty = Number(quantity);
            const newQty = adjustmentType === 'INCREASE'
                ? previousQty + adjustQty
                : Math.max(0, previousQty - adjustQty);

            const updatedItem = await prisma.inventoryItem.update({
                where: { id },
                data: {
                    quantity: newQty,
                    stockStatus: calculateStockStatus(newQty, Number(item.minStock), Number(item.safetyStock)),
                },
            });

            await prisma.stockTransaction.create({
                data: {
                    inventoryItemId: id,
                    type: 'ADJUSTMENT',
                    quantity: adjustmentType === 'INCREASE' ? adjustQty : -adjustQty,
                    previousQty,
                    newQty,
                    reason,
                    performedById: req.user!.id,
                    approvedById: req.user!.id,
                },
            });

            await createStockAlertIfNeeded(prisma, updatedItem, req.user!.branchId);

            return res.json({ approved: true, item: updatedItem });
        }

        // Other roles need to submit approval request
        const request = await prisma.stockApprovalRequest.create({
            data: {
                inventoryItemId: id,
                requestedById: req.user!.id,
                adjustmentType,
                adjustmentQty: quantity,
                reason,
            },
        });

        res.json({ approved: false, message: 'Adjustment request submitted for approval', request });
    } catch (error) {
        console.error('Adjust stock error:', error);
        res.status(500).json({ error: 'Failed to adjust stock' });
    }
});

// Get pending approval requests (for owners/admins)
router.get('/approval-requests/pending', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const requests = await prisma.stockApprovalRequest.findMany({
            where: {
                status: 'PENDING',
                inventoryItem: { branchId: req.user!.branchId },
            },
            include: {
                inventoryItem: { select: { name: true, quantity: true, unit: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(requests);
    } catch (error) {
        console.error('Get approval requests error:', error);
        res.status(500).json({ error: 'Failed to get approval requests' });
    }
});

// Approve/Reject stock adjustment request
router.post('/approval-requests/:id/process', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { action, rejectionReason } = req.body; // action: 'APPROVE' | 'REJECT'
        const userRole = req.user!.role;

        if (!['OWNER', 'SUPER_ADMIN', 'MANAGER'].includes(userRole)) {
            return res.status(403).json({ error: 'Not authorized to process approval requests' });
        }

        const request = await prisma.stockApprovalRequest.findUnique({
            where: { id },
            include: { inventoryItem: true },
        });

        if (!request) {
            return res.status(404).json({ error: 'Approval request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request already processed' });
        }

        if (action === 'APPROVE') {
            const previousQty = Number(request.inventoryItem.quantity);
            const adjustQty = Number(request.adjustmentQty);
            const newQty = request.adjustmentType === 'INCREASE'
                ? previousQty + adjustQty
                : Math.max(0, previousQty - adjustQty);

            // Update inventory
            const updatedItem = await prisma.inventoryItem.update({
                where: { id: request.inventoryItemId },
                data: {
                    quantity: newQty,
                    stockStatus: calculateStockStatus(newQty, Number(request.inventoryItem.minStock), Number(request.inventoryItem.safetyStock)),
                },
            });

            // Create transaction
            await prisma.stockTransaction.create({
                data: {
                    inventoryItemId: request.inventoryItemId,
                    type: 'ADJUSTMENT',
                    quantity: request.adjustmentType === 'INCREASE' ? adjustQty : -adjustQty,
                    previousQty,
                    newQty,
                    reason: request.reason,
                    performedById: request.requestedById,
                    approvedById: req.user!.id,
                },
            });

            await createStockAlertIfNeeded(prisma, updatedItem, req.user!.branchId);

            // Update request status
            await prisma.stockApprovalRequest.update({
                where: { id },
                data: { status: 'APPROVED', approvedById: req.user!.id, processedAt: new Date() },
            });

            return res.json({ success: true, message: 'Adjustment approved' });
        }

        // Reject
        await prisma.stockApprovalRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectionReason, processedAt: new Date() },
        });

        res.json({ success: true, message: 'Adjustment rejected' });
    } catch (error) {
        console.error('Process approval request error:', error);
        res.status(500).json({ error: 'Failed to process approval request' });
    }
});

// Get stock alerts
router.get('/alerts/list', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { unreadOnly = 'true' } = req.query;

        const where: any = { branchId: req.user!.branchId };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }

        const alerts = await prisma.stockAlert.findMany({
            where,
            include: {
                inventoryItem: { select: { id: true, name: true, quantity: true, unit: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        res.json(alerts);
    } catch (error) {
        console.error('Get stock alerts error:', error);
        res.status(500).json({ error: 'Failed to get stock alerts' });
    }
});

// Mark alert as read
router.patch('/alerts/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        await prisma.stockAlert.update({
            where: { id },
            data: { isRead: true },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Mark alert read error:', error);
        res.status(500).json({ error: 'Failed to mark alert as read' });
    }
});

// Mark all alerts as read
router.post('/alerts/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        await prisma.stockAlert.updateMany({
            where: { branchId: req.user!.branchId, isRead: false },
            data: { isRead: true },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Mark all alerts read error:', error);
        res.status(500).json({ error: 'Failed to mark all alerts as read' });
    }
});

// Reserve stock for online order
router.post('/:id/reserve', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { quantity, orderId } = req.body;

        const item = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        const previousReserved = Number(item.reservedQty);
        const newReserved = previousReserved + Number(quantity);

        await prisma.inventoryItem.update({
            where: { id },
            data: { reservedQty: newReserved },
        });

        await prisma.stockTransaction.create({
            data: {
                inventoryItemId: id,
                type: 'RESERVATION',
                quantity: Number(quantity),
                reason: `Reserved for online order ${orderId}`,
                orderId,
                performedById: req.user!.id,
            },
        });

        res.json({ success: true, reservedQty: newReserved });
    } catch (error) {
        console.error('Reserve stock error:', error);
        res.status(500).json({ error: 'Failed to reserve stock' });
    }
});

// Release reserved stock
router.post('/:id/release', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { quantity, orderId, reason } = req.body;

        const item = await prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ error: 'Inventory item not found' });
        }

        const previousReserved = Number(item.reservedQty);
        const newReserved = Math.max(0, previousReserved - Number(quantity));

        await prisma.inventoryItem.update({
            where: { id },
            data: { reservedQty: newReserved },
        });

        await prisma.stockTransaction.create({
            data: {
                inventoryItemId: id,
                type: 'RELEASE',
                quantity: -Number(quantity),
                reason: reason || `Released from order ${orderId}`,
                orderId,
                performedById: req.user!.id,
            },
        });

        res.json({ success: true, reservedQty: newReserved });
    } catch (error) {
        console.error('Release stock error:', error);
        res.status(500).json({ error: 'Failed to release stock' });
    }
});

// Batch import stock (CSV data)
router.post('/batch-import', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { items, fileName } = req.body;
        // items: [{ sku, name, category, unit, quantity, minStock, costPerUnit }]

        const branchId = req.user!.branchId;
        const userId = req.user!.id;

        // Create batch record
        const batch = await prisma.stockBatch.create({
            data: {
                branchId,
                uploadedById: userId,
                fileName: fileName || 'batch_import.csv',
                totalItems: items.length,
                status: 'PROCESSING',
            },
        });

        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                if (!item.name || !item.unit) {
                    throw new Error(`Row ${i + 1}: Name and unit are required`);
                }

                const quantity = Number(item.quantity) || 0;
                const minStock = Number(item.minStock) || 0;

                const created = await prisma.inventoryItem.create({
                    data: {
                        branchId,
                        sku: item.sku || null,
                        name: item.name,
                        category: item.category || 'INGREDIENT',
                        unit: item.unit,
                        quantity,
                        minStock,
                        safetyStock: Number(item.safetyStock) || 0,
                        costPerUnit: Number(item.costPerUnit) || 0,
                        stockStatus: calculateStockStatus(quantity, minStock, 0),
                    },
                });

                // Create transaction
                if (quantity > 0) {
                    await prisma.stockTransaction.create({
                        data: {
                            inventoryItemId: created.id,
                            type: 'BATCH_IMPORT',
                            quantity,
                            previousQty: 0,
                            newQty: quantity,
                            reason: `Batch import: ${fileName}`,
                            batchId: batch.id,
                            performedById: userId,
                        },
                    });
                }

                successCount++;
            } catch (err: any) {
                failedCount++;
                errors.push(err.message || `Row ${i + 1}: Unknown error`);
            }
        }

        // Update batch record
        await prisma.stockBatch.update({
            where: { id: batch.id },
            data: {
                successCount,
                failedCount,
                status: failedCount === items.length ? 'FAILED' : 'COMPLETED',
                errorLog: errors.length > 0 ? errors.join('\n') : null,
            },
        });

        res.json({
            batchId: batch.id,
            totalItems: items.length,
            successCount,
            failedCount,
            errors: errors.slice(0, 10), // Return first 10 errors
        });
    } catch (error) {
        console.error('Batch import error:', error);
        res.status(500).json({ error: 'Failed to process batch import' });
    }
});

// Get audit logs
router.get('/audit-logs/list', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { inventoryItemId, type, startDate, endDate, limit = 100 } = req.query;

        const where: any = {
            inventoryItem: { branchId: req.user!.branchId },
        };

        if (inventoryItemId) {
            where.inventoryItemId = inventoryItemId;
        }
        if (type) {
            where.type = type;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const logs = await prisma.stockTransaction.findMany({
            where,
            include: {
                inventoryItem: { select: { id: true, name: true, sku: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
        });

        res.json(logs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// Link menu item to inventory (ingredient mapping)
router.post('/link-menu-item', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { menuItemId, inventoryItemId, quantityUsed } = req.body;

        const link = await prisma.itemIngredient.upsert({
            where: {
                menuItemId_inventoryItemId: { menuItemId, inventoryItemId },
            },
            update: { quantityUsed },
            create: { menuItemId, inventoryItemId, quantityUsed },
        });

        res.json(link);
    } catch (error) {
        console.error('Link menu item error:', error);
        res.status(500).json({ error: 'Failed to link menu item' });
    }
});

// Unlink menu item from inventory
router.delete('/link/:menuItemId/:inventoryItemId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { menuItemId, inventoryItemId } = req.params;

        await prisma.itemIngredient.delete({
            where: {
                menuItemId_inventoryItemId: { menuItemId, inventoryItemId },
            },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Unlink menu item error:', error);
        res.status(500).json({ error: 'Failed to unlink menu item' });
    }
});

export default router;

