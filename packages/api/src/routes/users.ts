// User Routes
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Get all users
router.get('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const users = await prisma.user.findMany({
            where: { branchId: req.user!.branchId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: { name: 'asc' },
        });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Create user
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { name, email, phone, password, role } = req.body;

        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                branchId: req.user!.branchId,
                name,
                email,
                phone,
                password: hashedPassword,
                role: role || 'CASHIER',
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
            },
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { name, email, phone, role, isActive } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: { name, email, phone, role, isActive },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
            },
        });

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Reset user password
router.post('/:id/reset-password', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;
        const { newPassword } = req.body;

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Delete user
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { id } = req.params;

        // Don't allow deleting self
        if (id === req.user!.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        await prisma.user.delete({ where: { id } });

        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Activate user by email (for self-registration flow)
// This activates any inactive user - useful if someone registered but account was inactive
router.post('/activate-by-email', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isActive) {
            return res.json({ message: 'User is already active' });
        }

        await prisma.user.update({
            where: { email },
            data: { isActive: true },
        });

        res.json({ message: 'User activated successfully! You can now login.' });
    } catch (error) {
        console.error('Activate user error:', error);
        res.status(500).json({ error: 'Failed to activate user' });
    }
});

// Upgrade user role by email (for self-registration - makes first user OWNER)
router.post('/upgrade-role', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }

        const validRoles = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'KITCHEN'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await prisma.user.update({
            where: { email },
            data: { role },
        });

        res.json({ message: `User role updated to ${role}` });
    } catch (error) {
        console.error('Upgrade role error:', error);
        res.status(500).json({ error: 'Failed to upgrade role' });
    }
});

export default router;
