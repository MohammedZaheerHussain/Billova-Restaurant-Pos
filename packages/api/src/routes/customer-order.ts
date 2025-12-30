// Customer Self-Order API Routes (Public - No Auth Required)
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Generate unique session token
const generateToken = () => crypto.randomBytes(16).toString('hex');

// ==================== PUBLIC ENDPOINTS (No Auth) ====================

// Get menu for QR session
router.get('/menu/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        // Find table by QR token
        const table = await prisma.table.findFirst({
            where: { qrToken: token },
            include: {
                branch: {
                    select: { id: true, name: true, phone: true }
                }
            }
        });

        if (!table) {
            return res.status(404).json({ error: 'Invalid QR code' });
        }

        // Fetch menu items for this branch
        const categories = await prisma.category.findMany({
            where: { branchId: table.branchId, isActive: true },
            orderBy: { sortOrder: 'asc' }
        });

        const menuItems = await prisma.menuItem.findMany({
            where: { branchId: table.branchId, isAvailable: true },
            include: {
                variants: true,
                category: { select: { name: true } }
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.json({
            table: { id: table.id, name: table.name },
            branch: table.branch,
            categories,
            menuItems
        });
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ error: 'Failed to load menu' });
    }
});

// ==================== PUBLIC MENU (Online Menu Feature) ====================

// Get branch info by ID (for public menu)
router.get('/branch/:branchId', async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;

        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: {
                id: true,
                name: true,
                phone: true,
                address: true,
                gstNumber: true
            }
        });

        if (!branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json(branch);
    } catch (error) {
        console.error('Error fetching branch:', error);
        res.status(500).json({ error: 'Failed to load restaurant info' });
    }
});

// Get full menu for a branch (public access)
router.get('/menu-full/:branchId', async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;

        // Verify branch exists
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: { id: true, name: true, phone: true, address: true }
        });

        if (!branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Fetch categories
        const categories = await prisma.category.findMany({
            where: { branchId, isActive: true },
            orderBy: { sortOrder: 'asc' }
        });

        // Fetch menu items
        const menuItems = await prisma.menuItem.findMany({
            where: { branchId, isAvailable: true },
            include: {
                variants: true,
                category: { select: { id: true, name: true, icon: true } }
            },
            orderBy: [
                { category: { sortOrder: 'asc' } },
                { sortOrder: 'asc' }
            ]
        });

        res.json({
            branch,
            categories,
            menuItems
        });
    } catch (error) {
        console.error('Error fetching full menu:', error);
        res.status(500).json({ error: 'Failed to load menu' });
    }
});

// ==================== ORDER TRACKING ====================

// Get order status for tracking
router.get('/order-status/:orderId', async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        menuItem: { select: { name: true } }
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            orderNumber: order.orderNumber,
            status: order.status,
            orderType: order.orderType,
            customerName: order.customerName || 'Guest',
            total: Number(order.total),
            createdAt: order.createdAt,
            items: order.items.map(item => ({
                name: item.menuItem.name,
                quantity: item.quantity
            }))
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

// Submit customer order
router.post('/order', async (req: Request, res: Response) => {
    try {
        const { token, customerName, items } = req.body;

        if (!token || !items || items.length === 0) {
            return res.status(400).json({ error: 'Token and items are required' });
        }

        // Find table by QR token
        const table = await prisma.table.findFirst({
            where: { qrToken: token },
            include: { branch: true }
        });

        if (!table) {
            return res.status(404).json({ error: 'Invalid QR code' });
        }

        // Calculate order totals
        let subtotal = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const menuItem = await prisma.menuItem.findUnique({
                where: { id: item.menuItemId },
                include: { variants: true }
            });

            if (!menuItem) continue;

            const price = item.variantId
                ? menuItem.variants.find(v => v.id === item.variantId)?.price || menuItem.price
                : menuItem.price;

            const itemTotal = Number(price) * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                menuItemId: item.menuItemId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice: price,
                total: itemTotal,
                notes: item.notes || null
            });
        }

        // Get or create a system user for customer orders
        let systemUser = await prisma.user.findFirst({
            where: { branchId: table.branchId, email: 'self-order@system.local' }
        });

        if (!systemUser) {
            systemUser = await prisma.user.create({
                data: {
                    branchId: table.branchId,
                    name: 'Self Order',
                    email: 'self-order@system.local',
                    password: 'SYSTEM_USER_NO_LOGIN',
                    role: 'CASHIER'
                }
            });
        }

        // Get next order number
        const lastOrder = await prisma.order.findFirst({
            where: { branchId: table.branchId },
            orderBy: { orderNumber: 'desc' }
        });
        const orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Create order
        const order = await prisma.order.create({
            data: {
                branchId: table.branchId,
                tableId: table.id,
                userId: systemUser.id,
                orderNumber,
                orderType: 'DINE_IN',
                status: 'PENDING',
                customerName: customerName || 'Guest',
                notes: 'Self-order via QR',
                subtotal,
                discountAmount: 0,
                gstAmount: 0,
                total: subtotal, // No discount for self-order
                items: {
                    create: orderItems
                }
            },
            include: { items: true }
        });

        // Create QR session record
        await prisma.qRSession.create({
            data: {
                tableId: table.id,
                sessionToken: generateToken(),
                customerName: customerName || 'Guest',
                status: 'ORDERED',
                orderId: order.id,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
            }
        });

        // Update table status
        await prisma.table.update({
            where: { id: table.id },
            data: { status: 'OCCUPIED' }
        });

        // Create KOT items for kitchen
        await prisma.kOTItem.createMany({
            data: order.items.map((item: any, index: number) => ({
                orderId: order.id,
                kotNumber: orderNumber,
                itemName: `Item ${index + 1}`,
                quantity: item.quantity,
                notes: item.notes,
                status: 'PENDING'
            }))
        });

        res.status(201).json({
            success: true,
            orderNumber,
            message: 'Order placed successfully! Your order will be prepared shortly.'
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// ==================== ONLINE ORDERING (Delivery/Takeaway) ====================

// Submit online order (delivery/takeaway)
router.post('/online-order', async (req: Request, res: Response) => {
    try {
        const { branchId, orderType, customerName, customerPhone, customerAddress, items } = req.body;

        if (!branchId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Branch and items are required' });
        }

        if (!customerName || !customerPhone) {
            return res.status(400).json({ error: 'Customer name and phone are required' });
        }

        // Verify branch exists
        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Calculate order totals
        let subtotal = 0;
        const orderItems: any[] = [];

        for (const item of items) {
            const menuItem = await prisma.menuItem.findUnique({
                where: { id: item.menuItemId },
                include: { variants: true }
            });

            if (!menuItem) continue;

            const price = item.variantId
                ? menuItem.variants.find(v => v.id === item.variantId)?.price || menuItem.price
                : menuItem.price;

            const itemTotal = Number(price) * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                menuItemId: item.menuItemId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice: price,
                total: itemTotal,
                notes: item.notes || null
            });
        }

        // Get or create a system user for online orders
        let systemUser = await prisma.user.findFirst({
            where: { branchId, email: 'online-order@system.local' }
        });

        if (!systemUser) {
            systemUser = await prisma.user.create({
                data: {
                    branchId,
                    name: 'Online Order',
                    email: 'online-order@system.local',
                    password: 'SYSTEM_USER_NO_LOGIN',
                    role: 'CASHIER'
                }
            });
        }

        // Get next order number
        const lastOrder = await prisma.order.findFirst({
            where: { branchId },
            orderBy: { orderNumber: 'desc' }
        });
        const orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Create the order
        const order = await prisma.order.create({
            data: {
                branchId,
                userId: systemUser.id,
                orderNumber,
                orderType: orderType || 'DELIVERY',
                status: 'PENDING',
                subtotal,
                discountAmount: 0,
                gstAmount: 0,
                total: subtotal,
                customerName,
                customerPhone,
                notes: customerAddress ? `Delivery: ${customerAddress}` : null,
                items: { create: orderItems }
            },
            include: { items: true }
        });

        res.status(201).json({
            success: true,
            orderId: order.id,
            orderNumber,
            message: orderType === 'DELIVERY'
                ? 'Order placed! We will call you for delivery updates.'
                : 'Order placed! We will call you when ready for pickup.'
        });
    } catch (error) {
        console.error('Error creating online order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

export default router;
