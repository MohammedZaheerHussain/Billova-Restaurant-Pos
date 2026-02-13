// Auth Routes - Supabase Auth Integration
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Check if initial setup is needed
router.get('/check-setup', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        // Check if any super_admin or owner exists in profiles
        const { data: adminProfile, error } = await sb
            .from('profiles')
            .select('id, role')
            .or('role.eq.SUPER_ADMIN,role.eq.super_admin,role.eq.owner,role.eq.OWNER')
            .limit(1)
            .maybeSingle();

        const isSetupComplete = !!adminProfile && !error;
        logger.debug('[check-setup] Admin found:', adminProfile?.role, 'Setup complete:', isSetupComplete);

        res.json({ isSetupComplete });
    } catch (error) {
        logger.error('Check setup error:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// First-time setup - Create Super Admin via Supabase Auth
router.post('/setup', async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { adminName, adminEmail, adminPassword, adminPhone, companyName } = req.body;

        // Check if setup already done (check for SUPER_ADMIN or owner)
        const { data: existingAdmin } = await sb
            .from('profiles')
            .select('id, role')
            .or('role.eq.SUPER_ADMIN,role.eq.super_admin,role.eq.owner,role.eq.OWNER')
            .limit(1)
            .maybeSingle();

        if (existingAdmin) {
            return res.status(400).json({ error: 'Setup already completed. Please login with your admin account.' });
        }

        // Validate required fields
        if (!adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        // Create organization first
        const { data: org, error: orgError } = await sb
            .from('organizations')
            .insert({
                name: companyName || 'Billova',
            })
            .select()
            .single();

        if (orgError) throw orgError;

        // Create admin branch
        const { data: branch, error: branchError } = await sb
            .from('branches')
            .insert({
                org_id: org.id,
                name: companyName || 'Billova Admin',
                address: 'Admin Office',
                is_active: true,
            })
            .select()
            .single();

        if (branchError) throw branchError;

        // Create user via Supabase Auth
        const { data: authData, error: authError } = await sb.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: {
                name: adminName,
                role: 'owner',
                org_id: org.id,
                branch_id: branch.id,
            },
        });

        if (authError) throw authError;

        // Profile is auto-created via trigger, but update it with org/branch
        const { error: profileError } = await sb
            .from('profiles')
            .update({
                org_id: org.id,
                branch_id: branch.id,
                role: 'owner',
                phone: adminPhone,
            })
            .eq('id', authData.user.id);

        if (profileError) logger.warn('Profile update warning:', profileError);

        res.status(201).json({
            message: 'Setup completed successfully!',
            admin: {
                name: adminName,
                email: adminEmail,
            },
        });
    } catch (error) {
        logger.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed' });
    }
});

// Login via Supabase Auth
router.post('/login', async (req: AuthRequest, res: Response) => {
    try {
        const { email, password } = req.body;
        const sb = (req as any).supabase || supabase;

        // Sign in with Supabase
        const { data: authData, error: authError } = await sb.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            logger.debug('Supabase auth error:', authError.message);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Get profile with branch info
        const { data: profile, error: profileError } = await sb
            .from('profiles')
            .select(`
                *,
                branches (*)
            `)
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            return res.status(401).json({ error: 'Profile not found' });
        }

        if (!profile.is_active) {
            return res.status(401).json({ error: 'Account is inactive' });
        }

        // Also create a JWT for backward compatibility during migration
        const token = jwt.sign(
            {
                id: authData.user.id,
                email: authData.user.email,
                role: profile.role,
                branchId: profile.branch_id,
            },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({
            token, // Legacy JWT token
            supabase_token: authData.session?.access_token, // Supabase token
            user: {
                id: authData.user.id,
                name: profile.name,
                email: authData.user.email,
                role: profile.role,
                branch: profile.branches,
            },
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: profile, error } = await sb
            .from('profiles')
            .select(`
                *,
                branches (*)
            `)
            .eq('id', req.user!.id)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            phone: profile.phone,
            branch: profile.branches,
        });
    } catch (error) {
        logger.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Change password via Supabase Auth
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const sb = (req as any).supabase || supabase;

        // Get user email
        const { data: profile } = await sb
            .from('profiles')
            .select('email')
            .eq('id', req.user!.id)
            .single();

        if (!profile?.email) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password by trying to sign in
        const { error: verifyError } = await sb.auth.signInWithPassword({
            email: profile.email,
            password: currentPassword,
        });

        if (verifyError) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        // Update password via admin API
        const { error: updateError } = await sb.auth.admin.updateUserById(
            req.user!.id,
            { password: newPassword }
        );

        if (updateError) throw updateError;

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        logger.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Register new user via Supabase Auth
router.post('/register', async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, phone, branchId, role } = req.body;
        const sb = (req as any).supabase || supabase;

        // Validate required fields
        if (!name || !email || !password || !branchId) {
            return res.status(400).json({ error: 'Name, email, password, and branch are required' });
        }

        // Check if email exists
        const { data: existing } = await sb
            .from('profiles')
            .select('id')
            .eq('email', email)
            .limit(1)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Get branch org_id
        const { data: branch } = await sb
            .from('branches')
            .select('org_id')
            .eq('id', branchId)
            .single();

        // Create user via Supabase Auth
        const { data: authData, error: authError } = await sb.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name,
                role: role || 'cashier',
                org_id: branch?.org_id,
                branch_id: branchId,
            },
        });

        if (authError) throw authError;

        // Update profile with additional info
        const { error: profileError } = await sb
            .from('profiles')
            .update({
                org_id: branch?.org_id,
                branch_id: branchId,
                role: role || 'cashier',
                phone,
                email,
            })
            .eq('id', authData.user.id);

        if (profileError) logger.warn('Profile update warning:', profileError);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: authData.user.id,
                name,
                email,
                role: role || 'cashier',
            },
        });
    } catch (error) {
        logger.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Logout (client-side handles Supabase signOut)
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        // Supabase signout is handled client-side
        // This endpoint is for any server-side cleanup if needed
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Refresh token
router.post('/refresh', async (req: AuthRequest, res: Response) => {
    try {
        const { refresh_token } = req.body;
        const sb = (req as any).supabase || supabase;

        if (!refresh_token) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const { data, error } = await sb.auth.refreshSession({ refresh_token });

        if (error) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        res.json({
            access_token: data.session?.access_token,
            refresh_token: data.session?.refresh_token,
            expires_at: data.session?.expires_at,
        });
    } catch (error) {
        logger.error('Refresh error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Verify Supabase token
router.post('/verify-supabase', async (req: AuthRequest, res: Response) => {
    try {
        const { access_token } = req.body;
        const sb = (req as any).supabase || supabase;

        if (!access_token) {
            return res.status(400).json({ error: 'Access token required' });
        }

        const { data: { user }, error } = await sb.auth.getUser(access_token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get profile
        const { data: profile } = await sb
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        res.json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                role: profile?.role,
                branchId: profile?.branch_id,
            },
        });
    } catch (error) {
        logger.error('Verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

export default router;
