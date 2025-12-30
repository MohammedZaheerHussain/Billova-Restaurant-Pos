// Warehouse & Stock Transfer API Routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Apply auth to all routes
router.use(authMiddleware);

// ==================== STOCK TRANSFERS (BEFORE PARAMETERIZED ROUTES) ====================

// Get all transfers
router.get('/transfers', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const transfers = await prisma.stockTransfer.findMany({
            where: { branchId },
            include: {
                fromWarehouse: { select: { id: true, name: true } },
                toWarehouse: { select: { id: true, name: true } },
                items: {
                    include: {
                        inventoryItem: { select: { name: true, unit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

// Create transfer request
router.post('/transfers', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const userId = (req as any).user.id;
        const { fromWarehouseId, toWarehouseId, items, notes } = req.body;

        // Get next transfer number
        const lastTransfer = await prisma.stockTransfer.findFirst({
            where: { branchId },
            orderBy: { transferNumber: 'desc' }
        });
        const transferNumber = (lastTransfer?.transferNumber || 0) + 1;

        const transfer = await prisma.stockTransfer.create({
            data: {
                branchId,
                fromWarehouseId,
                toWarehouseId,
                transferNumber,
                requestedBy: userId,
                notes,
                items: {
                    create: items.map((item: any) => ({
                        inventoryItemId: item.inventoryItemId,
                        quantity: item.quantity
                    }))
                }
            },
            include: {
                fromWarehouse: { select: { name: true } },
                toWarehouse: { select: { name: true } },
                items: true
            }
        });

        res.status(201).json(transfer);
    } catch (error) {
        console.error('Error creating transfer:', error);
        res.status(500).json({ error: 'Failed to create transfer' });
    }
});

// Update transfer status
router.put('/transfers/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;
        const { status } = req.body;

        const updateData: any = { status };

        if (status === 'APPROVED') {
            updateData.approvedBy = userId;
            updateData.approvedAt = new Date();
        } else if (status === 'COMPLETED') {
            updateData.completedAt = new Date();

            // Move stock between warehouses
            const transfer = await prisma.stockTransfer.findUnique({
                where: { id },
                include: { items: true }
            });

            if (transfer) {
                for (const item of transfer.items) {
                    // Reduce from source
                    await prisma.warehouseStock.update({
                        where: {
                            warehouseId_inventoryItemId: {
                                warehouseId: transfer.fromWarehouseId,
                                inventoryItemId: item.inventoryItemId
                            }
                        },
                        data: { quantity: { decrement: item.quantity } }
                    });

                    // Add to destination
                    await prisma.warehouseStock.upsert({
                        where: {
                            warehouseId_inventoryItemId: {
                                warehouseId: transfer.toWarehouseId,
                                inventoryItemId: item.inventoryItemId
                            }
                        },
                        update: { quantity: { increment: item.quantity } },
                        create: {
                            warehouseId: transfer.toWarehouseId,
                            inventoryItemId: item.inventoryItemId,
                            quantity: item.quantity
                        }
                    });
                }
            }
        }

        const transfer = await prisma.stockTransfer.update({
            where: { id },
            data: updateData
        });

        res.json(transfer);
    } catch (error) {
        console.error('Error updating transfer:', error);
        res.status(500).json({ error: 'Failed to update transfer' });
    }
});

// ==================== WAREHOUSES ====================

// Get all warehouses for branch
router.get('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const warehouses = await prisma.warehouse.findMany({
            where: { branchId, isActive: true },
            include: {
                _count: { select: { stock: true } }
            },
            orderBy: [{ isMain: 'desc' }, { name: 'asc' }]
        });

        res.json(warehouses);
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        res.status(500).json({ error: 'Failed to fetch warehouses' });
    }
});

// Create warehouse
router.post('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const { name, address, isMain } = req.body;

        // If this is main, remove main from others
        if (isMain) {
            await prisma.warehouse.updateMany({
                where: { branchId, isMain: true },
                data: { isMain: false }
            });
        }

        const warehouse = await prisma.warehouse.create({
            data: { branchId, name, address, isMain: isMain || false }
        });

        res.status(201).json(warehouse);
    } catch (error) {
        console.error('Error creating warehouse:', error);
        res.status(500).json({ error: 'Failed to create warehouse' });
    }
});

// Update warehouse
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const branchId = (req as any).user.branchId;
        const { name, address, isMain, isActive } = req.body;

        if (isMain) {
            await prisma.warehouse.updateMany({
                where: { branchId, isMain: true, id: { not: id } },
                data: { isMain: false }
            });
        }

        const warehouse = await prisma.warehouse.update({
            where: { id },
            data: { name, address, isMain, isActive }
        });

        res.json(warehouse);
    } catch (error) {
        console.error('Error updating warehouse:', error);
        res.status(500).json({ error: 'Failed to update warehouse' });
    }
});

// Get warehouse stock
router.get('/:id/stock', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const stock = await prisma.warehouseStock.findMany({
            where: { warehouseId: id },
            include: {
                inventoryItem: {
                    select: { id: true, name: true, unit: true, category: true }
                }
            },
            orderBy: { inventoryItem: { name: 'asc' } }
        });

        res.json(stock);
    } catch (error) {
        console.error('Error fetching warehouse stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock' });
    }
});

// Update stock in warehouse
router.post('/:id/stock', async (req: Request, res: Response) => {
    try {
        const { id: warehouseId } = req.params;
        const { inventoryItemId, quantity } = req.body;

        const stock = await prisma.warehouseStock.upsert({
            where: {
                warehouseId_inventoryItemId: { warehouseId, inventoryItemId }
            },
            update: { quantity },
            create: { warehouseId, inventoryItemId, quantity }
        });

        res.json(stock);
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock' });
    }
});

// ==================== LOCATION HIERARCHY (Zones/Racks/Bins) ====================

// Get zones for warehouse
router.get('/:id/zones', async (req: Request, res: Response) => {
    try {
        const { id: warehouseId } = req.params;

        const zones = await prisma.warehouseZone.findMany({
            where: { warehouseId, isActive: true },
            include: {
                _count: { select: { racks: true } }
            },
            orderBy: { code: 'asc' }
        });

        res.json(zones);
    } catch (error) {
        console.error('Error fetching zones:', error);
        res.status(500).json({ error: 'Failed to fetch zones' });
    }
});

// Create zone
router.post('/:id/zones', async (req: Request, res: Response) => {
    try {
        const { id: warehouseId } = req.params;
        const { name, code, description } = req.body;

        const zone = await prisma.warehouseZone.create({
            data: { warehouseId, name, code, description }
        });

        res.status(201).json(zone);
    } catch (error) {
        console.error('Error creating zone:', error);
        res.status(500).json({ error: 'Failed to create zone' });
    }
});

// Get racks for zone
router.get('/zones/:zoneId/racks', async (req: Request, res: Response) => {
    try {
        const { zoneId } = req.params;

        const racks = await prisma.warehouseRack.findMany({
            where: { zoneId, isActive: true },
            include: {
                _count: { select: { bins: true } }
            },
            orderBy: { code: 'asc' }
        });

        res.json(racks);
    } catch (error) {
        console.error('Error fetching racks:', error);
        res.status(500).json({ error: 'Failed to fetch racks' });
    }
});

// Create rack
router.post('/zones/:zoneId/racks', async (req: Request, res: Response) => {
    try {
        const { zoneId } = req.params;
        const { name, code, levels } = req.body;

        const rack = await prisma.warehouseRack.create({
            data: { zoneId, name, code, levels: levels || 1 }
        });

        res.status(201).json(rack);
    } catch (error) {
        console.error('Error creating rack:', error);
        res.status(500).json({ error: 'Failed to create rack' });
    }
});

// Get bins for rack
router.get('/racks/:rackId/bins', async (req: Request, res: Response) => {
    try {
        const { rackId } = req.params;

        const bins = await prisma.warehouseBin.findMany({
            where: { rackId, isActive: true },
            include: {
                _count: { select: { stock: true } }
            },
            orderBy: { code: 'asc' }
        });

        res.json(bins);
    } catch (error) {
        console.error('Error fetching bins:', error);
        res.status(500).json({ error: 'Failed to fetch bins' });
    }
});

// Create bin
router.post('/racks/:rackId/bins', async (req: Request, res: Response) => {
    try {
        const { rackId } = req.params;
        const { name, code, binType, capacity } = req.body;

        const bin = await prisma.warehouseBin.create({
            data: { rackId, name, code, binType: binType || 'STORAGE', capacity }
        });

        res.status(201).json(bin);
    } catch (error) {
        console.error('Error creating bin:', error);
        res.status(500).json({ error: 'Failed to create bin' });
    }
});

// Get full location tree for warehouse
router.get('/:id/locations', async (req: Request, res: Response) => {
    try {
        const { id: warehouseId } = req.params;

        const zones = await prisma.warehouseZone.findMany({
            where: { warehouseId, isActive: true },
            include: {
                racks: {
                    where: { isActive: true },
                    include: {
                        bins: {
                            where: { isActive: true },
                            orderBy: { code: 'asc' }
                        }
                    },
                    orderBy: { code: 'asc' }
                }
            },
            orderBy: { code: 'asc' }
        });

        res.json(zones);
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

export default router;

