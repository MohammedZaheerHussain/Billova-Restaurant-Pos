// Auth Routes - Login, Register, Profile
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Check if initial setup is needed
router.get('/check-setup', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        // Check if any SUPER_ADMIN exists
        const superAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
        });

        res.json({ isSetupComplete: !!superAdmin });
    } catch (error) {
        console.error('Check setup error:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// First-time setup - Create Super Admin
router.post('/setup', async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;
        const { adminName, adminEmail, adminPassword, adminPhone, companyName } = req.body;

        // Check if setup already done
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'SUPER_ADMIN' },
        });

        if (existingAdmin) {
            return res.status(400).json({ error: 'Setup already completed' });
        }

        // Validate required fields
        if (!adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create admin branch (required for branch relation)
        const adminBranch = await prisma.branch.create({
            data: {
                name: companyName || 'Billova Admin',
                address: 'Admin Office',
                isActive: true,
            },
        });

        // Create Super Admin user
        const superAdmin = await prisma.user.create({
            data: {
                branchId: adminBranch.id,
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                phone: adminPhone || null,
                role: 'SUPER_ADMIN',
                isActive: true,
            },
        });

        res.status(201).json({
            message: 'Setup completed successfully!',
            admin: {
                name: superAdmin.name,
                email: superAdmin.email,
            },
        });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed' });
    }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
    try {
        const { email, password } = req.body;
        const prisma = (req as any).prisma;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { branch: true },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login time
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                branchId: user.branchId,
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                branch: user.branch,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { branch: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            branch: user.branch,
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Change password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const prisma = (req as any).prisma;

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Register new user
router.post('/register', async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, phone } = req.body;
        const prisma = (req as any).prisma;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Get default branch (first branch)
        const defaultBranch = await prisma.branch.findFirst({
            where: { isActive: true },
        });

        if (!defaultBranch) {
            return res.status(500).json({ error: 'No active branch found. Please contact admin.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (active by default)
        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone: phone || null,
                role: 'CASHIER',
                isActive: true, // Auto-active so user can login immediately
                branchId: defaultBranch.id,
            },
        });

        res.status(201).json({
            message: 'Account created successfully! You can now login.'
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Forgot password - Send request to admin (no email system)
router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.body;
        const prisma = (req as any).prisma;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Still return success to prevent email enumeration
            return res.json({
                message: 'If your account exists, a password reset request has been sent to the administrator. Please contact support.',
            });
        }

        // Check if pending request already exists
        const existingRequest = await prisma.passwordResetRequest.findFirst({
            where: { userId: user.id, status: 'PENDING' },
        });

        if (existingRequest) {
            return res.json({
                message: 'A password reset request is already pending. Please contact the administrator.',
            });
        }

        // Create password reset request for admin to handle
        await prisma.passwordResetRequest.create({
            data: {
                userId: user.id,
                status: 'PENDING',
            },
        });

        res.json({
            message: 'Password reset request sent to administrator. Please contact support to receive your new password.',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Reset password with token
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
    try {
        const { token, newPassword } = req.body;
        const prisma = (req as any).prisma;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        // Verify token
        let decoded: any;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        } catch (err) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        if (decoded.type !== 'password-reset') {
            return res.status(400).json({ error: 'Invalid reset token' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        await prisma.user.update({
            where: { id: decoded.id },
            data: { password: hashedPassword },
        });

        res.json({ message: 'Password reset successfully! You can now login with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Submit support ticket (customer-facing)
router.post('/support-ticket', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { subject, message, priority } = req.body;
        const prisma = (req as any).prisma;

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                userId: req.user!.id,
                branchId: req.user!.branchId,
                subject,
                message,
                priority: priority || 'NORMAL',
                status: 'OPEN',
            },
        });

        res.status(201).json({
            message: 'Support ticket submitted successfully. Our team will respond soon.',
            ticketId: ticket.id,
        });
    } catch (error) {
        console.error('Support ticket error:', error);
        res.status(500).json({ error: 'Failed to submit ticket' });
    }
});

// Get my support tickets (customer-facing)
router.get('/my-tickets', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const prisma = (req as any).prisma;

        const tickets = await prisma.supportTicket.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' },
        });

        res.json(tickets);
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ error: 'Failed to get tickets' });
    }
});

export default router;

