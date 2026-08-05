// User Routes (Supabase)
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema } from '../middleware/schemas';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Get all users (now uses profiles table)
router.get('/', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: users, error } = await sb
            .from('profiles')
            .select('*')
            .eq('branch_id', req.user!.branchId)
            .order('name', { ascending: true });

        if (error) throw error;

        const transformed = (users || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role?.toUpperCase(),
            isActive: u.is_active,
            createdAt: u.created_at,
        }));

        res.json(transformed);
    } catch (error) {
        logger.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Create user via Supabase Auth
router.post('/', authMiddleware, requireRole('OWNER', 'MANAGER'), validate(createUserSchema), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { name, email, phone, password, role } = req.body;

        // Check if email exists
        const { data: existing } = await sb
            .from('profiles')
            .select('id')
            .eq('email', email)
            .limit(1)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Get branch org_id
        const { data: branch } = await sb
            .from('branches')
            .select('org_id')
            .eq('id', req.user!.branchId)
            .single();

        // Create user via Supabase Auth
        const { data: authData, error: authError } = await sb.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name,
                role: role?.toLowerCase() || 'cashier',
                org_id: branch?.org_id,
                branch_id: req.user!.branchId,
            },
        });

        if (authError) throw authError;

        // Update profile with additional info
        await sb
            .from('profiles')
            .update({
                org_id: branch?.org_id,
                branch_id: req.user!.branchId,
                role: role?.toLowerCase() || 'cashier',
                phone,
                email,
            })
            .eq('id', authData.user.id);

        res.status(201).json({
            id: authData.user.id,
            name,
            email,
            phone,
            role: role || 'CASHIER',
            isActive: true,
        });
    } catch (error) {
        logger.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', authMiddleware, requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { name, email, phone, role, isActive } = req.body;

        const { data: user, error } = await sb
            .from('profiles')
            .update({
                name,
                email,
                phone,
                role: role?.toLowerCase(),
                is_active: isActive,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role?.toUpperCase(),
            isActive: user.is_active,
        });
    } catch (error) {
        logger.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Reset user password
router.post('/:id/reset-password', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { newPassword } = req.body;

        const { error } = await sb.auth.admin.updateUserById(id, {
            password: newPassword,
        });

        if (error) throw error;

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Delete user
router.delete('/:id', authMiddleware, requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Don't allow deleting self
        if (id === req.user!.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        // Delete from Supabase Auth (profile will cascade)
        const { error } = await sb.auth.admin.deleteUser(id);

        if (error) throw error;

        res.json({ message: 'User deleted' });
    } catch (error) {
        logger.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Activate user by email
router.post('/activate-by-email', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const { data: user, error: fetchError } = await sb
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_active) {
            return res.json({ message: 'User is already active' });
        }

        await sb
            .from('profiles')
            .update({ is_active: true })
            .eq('email', email);

        res.json({ message: 'User activated successfully! You can now login.' });
    } catch (error) {
        logger.error('Activate user error:', error);
        res.status(500).json({ error: 'Failed to activate user' });
    }
});

// Upgrade user role by email
router.post('/upgrade-role', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }

        const validRoles = ['owner', 'manager', 'cashier', 'kitchen', 'waiter'];
        const roleLower = role.toLowerCase();
        if (!validRoles.includes(roleLower)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const { data: user, error: fetchError } = await sb
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await sb
            .from('profiles')
            .update({ role: roleLower })
            .eq('email', email);

        res.json({ message: `User role updated to ${role}` });
    } catch (error) {
        logger.error('Upgrade role error:', error);
        res.status(500).json({ error: 'Failed to upgrade role' });
    }
});

export default router;
