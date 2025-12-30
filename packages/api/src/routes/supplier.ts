// Supplier Management API Routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Apply auth to all routes
router.use(authMiddleware);

// Get all suppliers
router.get('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;

        const suppliers = await prisma.supplier.findMany({
            where: { branchId, isActive: true },
            orderBy: { name: 'asc' }
        });

        res.json(suppliers);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
});

// Get single supplier
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: {
                purchaseOrders: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        res.json(supplier);
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Failed to fetch supplier' });
    }
});

// Create supplier
router.post('/', async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branchId;
        const { name, code, phone, email, address, gstNumber, paymentTerms } = req.body;

        const supplier = await prisma.supplier.create({
            data: {
                branchId,
                name,
                code,
                phone,
                email,
                address,
                gstNumber,
                paymentTerms
            }
        });

        res.status(201).json(supplier);
    } catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Failed to create supplier' });
    }
});

// Update supplier
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, code, phone, email, address, gstNumber, paymentTerms, rating, isActive } = req.body;

        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name,
                code,
                phone,
                email,
                address,
                gstNumber,
                paymentTerms,
                rating,
                isActive
            }
        });

        res.json(supplier);
    } catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Failed to update supplier' });
    }
});

// Delete supplier (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.supplier.update({
            where: { id },
            data: { isActive: false }
        });

        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Failed to delete supplier' });
    }
});

export default router;
