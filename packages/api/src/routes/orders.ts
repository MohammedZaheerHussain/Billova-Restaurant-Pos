// Order Routes - Create, Update, Complete orders
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { shadowWriteOrder, createOrderEvent, syncInventoryItem, createInventoryLog } from '../lib/supabase';

const router = Router();

// Get all orders
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { status, orderType, date, tableId } = req.query;

        const where: any = { branchId: req.user!.branchId };
        if (status) where.status = status;
        if (orderType) where.orderType = orderType;
        if (tableId) where.tableId = tableId;
        if (date) {
            const startOfDay = new Date(date as string);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date as string);
            endOfDay.setHours(23, 59, 59, 999);
            where.createdAt = { gte: startOfDay, lte: endOfDay };
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                items: { include: { menuItem: true, variant: true } },
                payments: true,
                table: true,
                user: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        res.json(orders);
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders' });
    }
});

// Get single order
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: { include: { menuItem: true, variant: true } },
                payments: true,
                table: true,
                user: { select: { name: true } },
                kotItems: true,
            },
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// Create new order
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const {
            orderType,
            tableId,
            customerName,
            customerPhone,
            items,
            discountType,
            discountValue,
            notes,
            onlineOrderId,
            onlinePlatform,
        } = req.body;

        const branchId = req.user!.branchId;
        const userId = req.user!.id;

        // Calculate totals
        let subtotal = 0;
        let gstAmount = 0;

        const orderItems: any[] = [];

        for (const item of items) {
            const menuItem = await prisma.menuItem.findUnique({
                where: { id: item.menuItemId },
            });

            if (!menuItem) continue;

            let unitPrice = Number(menuItem.price);

            // Check for variant price
            if (item.variantId) {
                const variant = await prisma.menuItemVariant.findUnique({
                    where: { id: item.variantId },
                });
                if (variant) {
                    unitPrice = Number(variant.price);
                }
            }

            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;

            if (menuItem.hasGST) {
                gstAmount += itemTotal * (Number(menuItem.gstPercent) / 100);
            }

            orderItems.push({
                menuItemId: item.menuItemId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (discountType === 'PERCENTAGE' && discountValue) {
            discountAmount = subtotal * (discountValue / 100);
        } else if (discountType === 'FIXED' && discountValue) {
            discountAmount = discountValue;
        }

        const total = subtotal - discountAmount + gstAmount;

        // Check if daily order reset is enabled (passed from frontend)
        const dailyReset = req.headers['x-daily-order-reset'] === 'true';

        // Get next order number for this branch
        let lastOrder;
        if (dailyReset) {
            // Only count orders from today
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            lastOrder = await prisma.order.findFirst({
                where: {
                    branchId,
                    createdAt: { gte: startOfDay }
                },
                orderBy: { orderNumber: 'desc' },
                select: { orderNumber: true },
            });
        } else {
            // Count all orders (legacy behavior)
            lastOrder = await prisma.order.findFirst({
                where: { branchId },
                orderBy: { orderNumber: 'desc' },
                select: { orderNumber: true },
            });
        }
        const orderNumber = (lastOrder?.orderNumber || 0) + 1;


        // Create order
        const order = await prisma.order.create({
            data: {
                orderNumber,
                branchId,
                userId,
                tableId: tableId || null,
                orderType: orderType || 'DINE_IN',
                status: 'CONFIRMED',
                customerName,
                customerPhone,
                subtotal,
                discountType,
                discountValue,
                discountAmount,
                gstAmount,
                total,
                notes,
                onlineOrderId,
                onlinePlatform,
                items: { create: orderItems },
            },
            include: {
                items: { include: { menuItem: true, variant: true } },
                table: true,
            },
        });

        // Update table status if dine-in
        if (tableId && orderType === 'DINE_IN') {
            await prisma.table.update({
                where: { id: tableId },
                data: { status: 'OCCUPIED' },
            });
        }

        // ========== AUTO CONSUME INVENTORY ==========
        // Deduct stock for each menu item based on linked ingredients
        try {
            for (const item of items) {
                // Get ingredient mappings for this menu item
                const ingredients = await prisma.itemIngredient.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { inventoryItem: true },
                });

                for (const ing of ingredients) {
                    const consumeQty = Number(ing.quantityUsed) * item.quantity;
                    const previousQty = Number(ing.inventoryItem.quantity);
                    const newQty = Math.max(0, previousQty - consumeQty);

                    // Calculate new status
                    const minStock = Number(ing.inventoryItem.minStock);
                    const safetyStock = Number(ing.inventoryItem.safetyStock);
                    let stockStatus = 'SUFFICIENT';
                    if (newQty <= 0) stockStatus = 'OUT_OF_STOCK';
                    else if (newQty <= minStock * 0.5) stockStatus = 'CRITICAL';
                    else if (newQty <= minStock) stockStatus = 'LOW_STOCK';

                    // Update inventory
                    await prisma.inventoryItem.update({
                        where: { id: ing.inventoryItem.id },
                        data: { quantity: newQty, stockStatus },
                    });

                    // Create transaction log
                    await prisma.stockTransaction.create({
                        data: {
                            inventoryItemId: ing.inventoryItem.id,
                            type: 'CONSUMPTION',
                            quantity: -consumeQty,
                            previousQty,
                            newQty,
                            reason: `Order #${orderNumber}`,
                            orderId: order.id,
                            performedById: userId,
                        },
                    });

                    // Create alert if low stock
                    if (stockStatus !== 'SUFFICIENT') {
                        const existingAlert = await prisma.stockAlert.findFirst({
                            where: {
                                inventoryItemId: ing.inventoryItem.id,
                                alertType: stockStatus,
                                isRead: false,
                            },
                        });
                        if (!existingAlert) {
                            await prisma.stockAlert.create({
                                data: {
                                    branchId,
                                    inventoryItemId: ing.inventoryItem.id,
                                    alertType: stockStatus,
                                    message: `${ing.inventoryItem.name} is ${stockStatus.replace('_', ' ').toLowerCase()}! Qty: ${newQty} ${ing.inventoryItem.unit}`,
                                },
                            });
                        }
                    }
                }
            }
        } catch (invError) {
            console.error('Inventory consumption error (non-blocking):', invError);
            // Don't fail the order, just log the error
        }
        // ========== END INVENTORY CONSUMPTION ==========

        // ========== SUPABASE SHADOW WRITE ==========
        // Async, non-blocking - write order to cloud for realtime
        setImmediate(async () => {
            try {
                await shadowWriteOrder({
                    id: order.id,
                    branchId: order.branchId,
                    orderNumber: order.orderNumber,
                    billNumber: order.billNumber,
                    orderType: order.orderType,
                    status: order.status,
                    tableNumber: order.table?.number,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    items: order.items,
                    subtotal: order.subtotal,
                    discountAmount: order.discountAmount,
                    gstAmount: order.gstAmount,
                    total: order.total,
                    createdBy: order.userId,
                    createdAt: order.createdAt,
                });
                await createOrderEvent(order.id, 'CREATED', {
                    orderType,
                    itemCount: items.length,
                    total: order.total
                }, order.userId);
            } catch (e) {
                console.error('[Supabase] Shadow write failed:', e);
            }
        });
        // ========== END SHADOW WRITE ==========

        res.status(201).json(order);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Add payment to order
router.post('/:id/payment', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { mode, amount, reference } = req.body;

        const payment = await prisma.payment.create({
            data: {
                orderId: id,
                mode,
                amount,
                reference,
            },
        });

        // Check if order is fully paid
        const order = await prisma.order.findUnique({
            where: { id },
            include: { payments: true },
        });

        const totalPaid = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        if (totalPaid >= Number(order.total)) {
            await prisma.order.update({
                where: { id },
                data: { status: 'COMPLETED', completedAt: new Date() },
            });

            // Free up table
            if (order.tableId) {
                await prisma.table.update({
                    where: { id: order.tableId },
                    data: { status: 'CLEANING' },
                });
            }
        }

        // Shadow write payment to Supabase
        setImmediate(async () => {
            try {
                await shadowWriteOrder({
                    id: order.id,
                    branchId: order.branchId,
                    orderNumber: order.orderNumber,
                    billNumber: order.billNumber,
                    orderType: order.orderType,
                    status: order.status,
                    tableNumber: null,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    items: [],
                    subtotal: order.subtotal,
                    discountAmount: order.discountAmount,
                    gstAmount: order.gstAmount,
                    total: order.total,
                    createdBy: order.userId,
                    createdAt: order.createdAt,
                    updatedAt: new Date().toISOString(),
                });
                await createOrderEvent(order.id, 'PAID', {
                    amount,
                    method: mode,
                    totalPaid,
                    isComplete: totalPaid >= Number(order.total)
                });
            } catch (e) {
                console.error('[Supabase] Payment shadow write failed:', e);
            }
        });

        res.json(payment);
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({ error: 'Failed to add payment' });
    }
});

// Update order status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { status } = req.body;

        const order = await prisma.order.update({
            where: { id },
            data: {
                status,
                completedAt: status === 'COMPLETED' ? new Date() : undefined,
            },
        });

        res.json(order);
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Cancel order
router.post('/:id/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const branchId = req.user!.branchId;
        const userId = req.user!.id;

        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        await prisma.order.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });

        // Free up table
        if (order.tableId) {
            await prisma.table.update({
                where: { id: order.tableId },
                data: { status: 'EMPTY' },
            });
        }

        // ========== RESTORE INVENTORY ==========
        // Add back stock that was consumed by this order
        try {
            for (const item of order.items) {
                const ingredients = await prisma.itemIngredient.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { inventoryItem: true },
                });

                for (const ing of ingredients) {
                    const restoreQty = Number(ing.quantityUsed) * item.quantity;
                    const previousQty = Number(ing.inventoryItem.quantity);
                    const newQty = previousQty + restoreQty;

                    // Recalculate status
                    const minStock = Number(ing.inventoryItem.minStock);
                    let stockStatus = 'SUFFICIENT';
                    if (newQty <= 0) stockStatus = 'OUT_OF_STOCK';
                    else if (newQty <= minStock * 0.5) stockStatus = 'CRITICAL';
                    else if (newQty <= minStock) stockStatus = 'LOW_STOCK';

                    await prisma.inventoryItem.update({
                        where: { id: ing.inventoryItem.id },
                        data: { quantity: newQty, stockStatus },
                    });

                    await prisma.stockTransaction.create({
                        data: {
                            inventoryItemId: ing.inventoryItem.id,
                            type: 'ADJUSTMENT',
                            quantity: restoreQty,
                            previousQty,
                            newQty,
                            reason: `Order #${order.orderNumber} cancelled - stock restored`,
                            orderId: id,
                            performedById: userId,
                        },
                    });
                }
            }
        } catch (invError) {
            console.error('Inventory restore error (non-blocking):', invError);
        }
        // ========== END RESTORE ==========

        res.json({ message: 'Order cancelled' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// Add items to existing order
router.post('/:id/add-items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { items } = req.body;

        // Get current order
        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
            return res.status(400).json({ error: 'Cannot edit completed or cancelled orders' });
        }

        // Calculate new items
        let additionalSubtotal = 0;
        let additionalGst = 0;
        const newItems: any[] = [];

        for (const item of items) {
            const menuItem = await prisma.menuItem.findUnique({
                where: { id: item.menuItemId },
            });

            if (!menuItem) continue;

            let unitPrice = Number(menuItem.price);

            if (item.variantId) {
                const variant = await prisma.menuItemVariant.findUnique({
                    where: { id: item.variantId },
                });
                if (variant) {
                    unitPrice = Number(variant.price);
                }
            }

            const itemTotal = unitPrice * item.quantity;
            additionalSubtotal += itemTotal;

            if (menuItem.hasGST) {
                additionalGst += itemTotal * (Number(menuItem.gstPercent) / 100);
            }

            newItems.push({
                orderId: id,
                menuItemId: item.menuItemId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Add new items
        await prisma.orderItem.createMany({ data: newItems });

        // Recalculate order totals
        const newSubtotal = Number(order.subtotal) + additionalSubtotal;
        const newGstAmount = Number(order.gstAmount) + additionalGst;

        // Recalculate discount if percentage
        let discountAmount = Number(order.discountAmount);
        if (order.discountType === 'PERCENTAGE' && order.discountValue) {
            discountAmount = newSubtotal * (Number(order.discountValue) / 100);
        }

        const newTotal = newSubtotal - discountAmount + newGstAmount;

        // Update order
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                subtotal: newSubtotal,
                gstAmount: newGstAmount,
                discountAmount,
                total: newTotal,
            },
            include: {
                items: { include: { menuItem: true, variant: true } },
                payments: true,
            },
        });

        res.json(updatedOrder);
    } catch (error) {
        console.error('Add items to order error:', error);
        res.status(500).json({ error: 'Failed to add items to order' });
    }
});

// ==================== OFFLINE SYNC ENDPOINT ====================
// Sync orders created offline - idempotent with hash-based duplicate detection
router.post('/offline-sync', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { localId, orderHash, order } = req.body;
        const branchId = req.user!.branchId;
        const userId = req.user!.id;

        console.log(`[OfflineSync] Processing order localId=${localId}, hash=${orderHash?.substring(0, 20)}...`);

        // Check for duplicate using hash
        if (orderHash) {
            const existingSync = await prisma.offlineSyncLog.findFirst({
                where: { orderHash },
            });

            if (existingSync) {
                console.log(`[OfflineSync] Duplicate detected, returning existing serverId=${existingSync.serverId}`);
                return res.json({
                    success: true,
                    isDuplicate: true,
                    serverId: existingSync.serverId,
                    billNumber: existingSync.billNumber,
                    message: 'Order already synced',
                });
            }
        }

        // Validate order data
        if (!order || !order.items || order.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order data: items are required',
            });
        }

        // Calculate totals (recalculate to ensure accuracy)
        let subtotal = 0;
        let gstAmount = 0;
        const orderItems: any[] = [];

        for (const item of order.items) {
            const menuItem = await prisma.menuItem.findUnique({
                where: { id: item.menuItemId },
            });

            if (!menuItem) {
                console.warn(`[OfflineSync] Menu item not found: ${item.menuItemId}, using offline data`);
                // Use offline data if menu item not found (deleted item)
                const itemTotal = Number(item.unitPrice || item.total / item.quantity) * item.quantity;
                subtotal += itemTotal;
                orderItems.push({
                    menuItemId: item.menuItemId,
                    variantId: item.variantId || null,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice || item.total / item.quantity),
                    total: itemTotal,
                    notes: item.notes || null,
                });
                continue;
            }

            let unitPrice = Number(menuItem.price);

            // Check for variant price
            if (item.variantId) {
                const variant = await prisma.menuItemVariant.findUnique({
                    where: { id: item.variantId },
                });
                if (variant) {
                    unitPrice = Number(variant.price);
                }
            }

            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;

            if (menuItem.hasGST) {
                gstAmount += itemTotal * (Number(menuItem.gstPercent) / 100);
            }

            orderItems.push({
                menuItemId: item.menuItemId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice,
                total: itemTotal,
                notes: item.notes || null,
            });
        }

        // Calculate discount
        let discountAmount = 0;
        if (order.discountType === 'PERCENTAGE' && order.discountValue) {
            discountAmount = subtotal * (Number(order.discountValue) / 100);
        } else if (order.discountType === 'FIXED' && order.discountValue) {
            discountAmount = Number(order.discountValue);
        }

        const total = subtotal - discountAmount + gstAmount;

        // Get next order number
        const lastOrder = await prisma.order.findFirst({
            where: { branchId },
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
        });
        const orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Create order
        const createdOrder = await prisma.order.create({
            data: {
                orderNumber,
                branchId,
                userId,
                tableId: order.tableId || null,
                orderType: order.orderType || 'DINE_IN',
                status: 'CONFIRMED',
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                subtotal,
                discountType: order.discountType,
                discountValue: order.discountValue,
                discountAmount,
                gstAmount,
                total,
                notes: order.notes,
                // Mark as offline-created
                offlineCreatedAt: order.createdAt ? new Date(order.createdAt) : undefined,
                offlineTempBillNumber: order.tempBillNumber,
                items: { create: orderItems },
            },
            include: {
                items: { include: { menuItem: true, variant: true } },
                table: true,
            },
        });

        // Update table status if dine-in
        if (order.tableId && order.orderType === 'DINE_IN') {
            await prisma.table.update({
                where: { id: order.tableId },
                data: { status: 'OCCUPIED' },
            }).catch(() => {
                // Table might not exist anymore, ignore
            });
        }

        // Log sync for duplicate detection
        await prisma.offlineSyncLog.create({
            data: {
                localId,
                orderHash: orderHash || '',
                serverId: createdOrder.id,
                billNumber: `ORD-${String(orderNumber).padStart(4, '0')}`,
                branchId,
                userId,
                syncedAt: new Date(),
            },
        });

        // ========== AUTO CONSUME INVENTORY (non-blocking) ==========
        try {
            for (const item of order.items) {
                const ingredients = await prisma.itemIngredient.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { inventoryItem: true },
                });

                for (const ing of ingredients) {
                    const consumeQty = Number(ing.quantityUsed) * item.quantity;
                    const previousQty = Number(ing.inventoryItem.quantity);
                    // Allow negative stock for offline orders, flag for review
                    const newQty = previousQty - consumeQty;

                    const minStock = Number(ing.inventoryItem.minStock);
                    let stockStatus = 'SUFFICIENT';
                    if (newQty <= 0) stockStatus = 'OUT_OF_STOCK';
                    else if (newQty <= minStock * 0.5) stockStatus = 'CRITICAL';
                    else if (newQty <= minStock) stockStatus = 'LOW_STOCK';

                    await prisma.inventoryItem.update({
                        where: { id: ing.inventoryItem.id },
                        data: { quantity: Math.max(0, newQty), stockStatus },
                    });

                    await prisma.stockTransaction.create({
                        data: {
                            inventoryItemId: ing.inventoryItem.id,
                            type: 'CONSUMPTION',
                            quantity: -consumeQty,
                            previousQty,
                            newQty: Math.max(0, newQty),
                            reason: `Offline Order #${orderNumber} (synced)`,
                            orderId: createdOrder.id,
                            performedById: userId,
                        },
                    });

                    // Create alert if negative stock (needs admin attention)
                    if (newQty < 0) {
                        await prisma.stockAlert.create({
                            data: {
                                branchId,
                                inventoryItemId: ing.inventoryItem.id,
                                alertType: 'OUT_OF_STOCK',
                                message: `OFFLINE SYNC: ${ing.inventoryItem.name} went negative. Actual: ${newQty}, shown: 0. Needs review.`,
                            },
                        });
                    }
                }
            }
        } catch (invError) {
            console.error('[OfflineSync] Inventory consumption error (non-blocking):', invError);
        }
        // ========== END INVENTORY CONSUMPTION ==========

        console.log(`[OfflineSync] Successfully synced order, serverId=${createdOrder.id}`);

        res.json({
            success: true,
            isDuplicate: false,
            serverId: createdOrder.id,
            billNumber: `ORD-${String(orderNumber).padStart(4, '0')}`,
            orderNumber,
            message: 'Order synced successfully',
        });
    } catch (error) {
        console.error('[OfflineSync] Sync error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to sync order',
        });
    }
});

export default router;
