// Super Admin Routes - Multi-tenant Management
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Middleware to require SUPER_ADMIN role
const requireSuperAdmin = requireRole('SUPER_ADMIN');

// Generate unique license key
const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'DFC-';
    for (let i = 0; i < 4; i++) {
        if (i > 0) key += '-';
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return key;
};

// Dashboard stats
router.get('/dashboard', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const [totalBranches, activeLicenses, expiredLicenses, allOrders, pendingResets, openTickets] = await Promise.all([
            prisma.branch.count(),
            prisma.license.count({ where: { status: 'ACTIVE' } }),
            prisma.license.count({ where: { status: { in: ['EXPIRED', 'SUSPENDED'] } } }),
            prisma.order.findMany({
                where: { status: 'COMPLETED' },
                select: { total: true },
            }),
            prisma.passwordResetRequest.count({ where: { status: 'PENDING' } }),
            prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ]);

        const totalRevenue = allOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);

        res.json({
            totalCustomers: totalBranches,
            activeLicenses,
            expiredLicenses,
            totalRevenue,
            pendingResets,
            openTickets,
        });
    } catch (error) {
        console.error('Super admin dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// List all restaurants
router.get('/restaurants', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const restaurants = await prisma.branch.findMany({
            include: {
                license: true,
                users: {
                    where: { role: 'OWNER' },
                    select: { id: true, name: true, email: true, phone: true, lastLoginAt: true },
                },
                _count: {
                    select: { orders: true, users: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(restaurants);
    } catch (error) {
        console.error('Get restaurants error:', error);
        res.status(500).json({ error: 'Failed to get restaurants' });
    }
});

// Create new restaurant with owner
router.post('/restaurants', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const {
            restaurantName,
            address,
            phone,
            gstNumber,
            ownerName,
            ownerEmail,
            ownerPassword,
            plan,
            licenseDuration // months
        } = req.body;

        // Validate required fields
        if (!restaurantName || !ownerName || !ownerEmail || !ownerPassword) {
            return res.status(400).json({
                error: 'Restaurant name, owner name, email, and password are required'
            });
        }

        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
        if (existing) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(ownerPassword, 10);

        // Calculate license expiry
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + (licenseDuration || 12));

        // Create everything in a transaction
        const result = await prisma.$transaction(async (tx: any) => {
            // Create branch with subscription plan
            const branch = await tx.branch.create({
                data: {
                    name: restaurantName,
                    address,
                    phone,
                    gstNumber,
                    subscriptionPlan: plan || 'BASIC',
                },
            });

            // Create owner user
            const owner = await tx.user.create({
                data: {
                    branchId: branch.id,
                    name: ownerName,
                    email: ownerEmail,
                    password: hashedPassword,
                    role: 'OWNER',
                    isActive: true,
                },
            });

            // Create license
            const license = await tx.license.create({
                data: {
                    branchId: branch.id,
                    licenseKey: generateLicenseKey(),
                    plan: plan || 'BASIC',
                    status: 'ACTIVE',
                    expiresAt,
                },
            });

            // Create default categories
            const defaultCategories = [
                { name: 'Starters', icon: '🍗' },
                { name: 'Main Course', icon: '🍛' },
                { name: 'Beverages', icon: '🥤' },
            ];

            for (const cat of defaultCategories) {
                await tx.category.create({
                    data: {
                        branchId: branch.id,
                        name: cat.name,
                        icon: cat.icon,
                    },
                });
            }

            return { branch, owner, license };
        });

        res.status(201).json({
            message: 'Restaurant created successfully!',
            restaurant: {
                id: result.branch.id,
                name: result.branch.name,
                owner: {
                    name: result.owner.name,
                    email: result.owner.email,
                },
                license: {
                    key: result.license.licenseKey,
                    plan: result.license.plan,
                    expiresAt: result.license.expiresAt,
                },
            },
        });
    } catch (error) {
        console.error('Create restaurant error:', error);
        res.status(500).json({ error: 'Failed to create restaurant' });
    }
});

// Update restaurant / toggle status
router.patch('/restaurants/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { isActive, name, address, phone, gstNumber } = req.body;

        const branch = await prisma.branch.update({
            where: { id },
            data: {
                isActive: isActive !== undefined ? isActive : undefined,
                name: name || undefined,
                address: address || undefined,
                phone: phone || undefined,
                gstNumber: gstNumber || undefined,
            },
        });

        res.json(branch);
    } catch (error) {
        console.error('Update restaurant error:', error);
        res.status(500).json({ error: 'Failed to update restaurant' });
    }
});

// Update license
router.patch('/licenses/:branchId', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { branchId } = req.params;
        const { status, plan, extendMonths } = req.body;

        const license = await prisma.license.findUnique({ where: { branchId } });
        if (!license) {
            return res.status(404).json({ error: 'License not found' });
        }

        const updateData: any = {};
        if (status) updateData.status = status;
        if (plan) updateData.plan = plan;
        if (extendMonths) {
            const newExpiry = new Date(license.expiresAt);
            newExpiry.setMonth(newExpiry.getMonth() + extendMonths);
            updateData.expiresAt = newExpiry;
        }

        const updated = await prisma.license.update({
            where: { branchId },
            data: updateData,
        });

        res.json(updated);
    } catch (error) {
        console.error('Update license error:', error);
        res.status(500).json({ error: 'Failed to update license' });
    }
});

// Delete restaurant (soft delete - just deactivate)
router.delete('/restaurants/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Deactivate branch and suspend license
        await prisma.$transaction([
            prisma.branch.update({
                where: { id },
                data: { isActive: false },
            }),
            prisma.license.update({
                where: { branchId: id },
                data: { status: 'SUSPENDED' },
            }),
        ]);

        res.json({ message: 'Restaurant deactivated' });
    } catch (error) {
        console.error('Delete restaurant error:', error);
        res.status(500).json({ error: 'Failed to deactivate restaurant' });
    }
});

// ==================== PASSWORD RESET REQUESTS ====================

// Get all password reset requests
router.get('/password-resets', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const requests = await prisma.passwordResetRequest.findMany({
            include: {
                user: {
                    select: { name: true, email: true, branch: { select: { name: true } } },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });

        res.json(requests);
    } catch (error) {
        console.error('Get password resets error:', error);
        res.status(500).json({ error: 'Failed to get password reset requests' });
    }
});

// Complete password reset (set new password)
router.post('/password-resets/:id/complete', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const request = await prisma.passwordResetRequest.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password and request status
        await prisma.$transaction([
            prisma.user.update({
                where: { id: request.userId },
                data: { password: hashedPassword },
            }),
            prisma.passwordResetRequest.update({
                where: { id },
                data: { status: 'COMPLETED', completedAt: new Date(), newPassword },
            }),
        ]);

        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Complete password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Admin reset password directly for a user
router.post('/users/:userId/reset-password', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ==================== SUPPORT TICKETS ====================

// Get all support tickets
router.get('/support-tickets', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const tickets = await prisma.supportTicket.findMany({
            include: {
                user: {
                    select: { name: true, email: true, branch: { select: { name: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(tickets);
    } catch (error) {
        console.error('Get support tickets error:', error);
        res.status(500).json({ error: 'Failed to get support tickets' });
    }
});

// Update ticket status / reply
router.patch('/support-tickets/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { status, adminReply } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (adminReply) updateData.adminReply = adminReply;
        if (status === 'RESOLVED' || status === 'CLOSED') {
            updateData.resolvedAt = new Date();
        }

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: updateData,
        });

        res.json(ticket);
    } catch (error) {
        console.error('Update ticket error:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

export default router;
