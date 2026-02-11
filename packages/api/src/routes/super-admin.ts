// Super Admin Routes - Supabase Version
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = Router();
const requireSuperAdmin = requireRole('SUPER_ADMIN');

// Generate unique license key
const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'BLV-';
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
        const sb = (req as any).supabase || supabase;

        const [branchesRes, activeLicRes, expiredLicRes, ordersRes, resetsRes, ticketsRes] = await Promise.all([
            sb.from('branches').select('*', { count: 'exact', head: true }),
            sb.from('licenses').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
            sb.from('licenses').select('*', { count: 'exact', head: true }).in('status', ['EXPIRED', 'SUSPENDED']),
            sb.from('orders').select('total').eq('status', 'COMPLETED'),
            sb.from('password_reset_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
            sb.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'IN_PROGRESS']),
        ]);

        const totalRevenue = (ordersRes.data || []).reduce((sum: number, o: any) => sum + Number(o.total), 0);

        res.json({
            totalCustomers: branchesRes.count || 0,
            activeLicenses: activeLicRes.count || 0,
            expiredLicenses: expiredLicRes.count || 0,
            totalRevenue,
            pendingResets: resetsRes.count || 0,
            openTickets: ticketsRes.count || 0,
        });
    } catch (error) {
        console.error('Super admin dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// List all restaurants/branches
router.get('/restaurants', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: branches, error } = await sb
            .from('branches')
            .select(`
                *,
                licenses (*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Get owners and counts for each branch
        const enriched = await Promise.all((branches || []).map(async (branch: any) => {
            const { data: owners } = await sb
                .from('profiles')
                .select('id, name, email, phone')
                .eq('branch_id', branch.id)
                .eq('role', 'owner');

            const { count: orderCount } = await sb
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('branch_id', branch.id);

            const { count: userCount } = await sb
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('branch_id', branch.id);

            return {
                id: branch.id,
                name: branch.name,
                address: branch.address,
                phone: branch.phone,
                gstNumber: branch.gst_number,
                isActive: branch.is_active,
                subscriptionPlan: branch.subscription_plan,
                createdAt: branch.created_at,
                license: branch.licenses,
                users: owners || [],
                _count: { orders: orderCount || 0, users: userCount || 0 },
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Get restaurants error:', error);
        res.status(500).json({ error: 'Failed to get restaurants' });
    }
});

// Get single restaurant by ID
router.get('/restaurants/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        const { data: branch, error } = await sb
            .from('branches')
            .select(`
                *,
                licenses (*)
            `)
            .eq('id', id)
            .single();

        if (error || !branch) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        // Get owner
        const { data: owners } = await sb
            .from('profiles')
            .select('id, name, email, phone')
            .eq('branch_id', id)
            .eq('role', 'owner');

        // Get order count
        const { count: orderCount } = await sb
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', id);

        // Get user count
        const { count: userCount } = await sb
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', id);

        // Calculate days left
        let daysLeft = null;
        if (branch.licenses?.expires_at) {
            const expiry = new Date(branch.licenses.expires_at);
            const now = new Date();
            daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        res.json({
            id: branch.id,
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            gstNumber: branch.gst_number,
            fssaiNumber: branch.fssai_number,
            city: branch.city,
            isActive: branch.is_active,
            subscriptionPlan: branch.subscription_plan,
            createdAt: branch.created_at,
            license: branch.licenses,
            daysLeft,
            owner: owners?.[0] || null,
            users: owners || [],
            _count: { orders: orderCount || 0, users: userCount || 0 },
        });
    } catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({ error: 'Failed to get restaurant' });
    }
});

// Force deactivate restaurant
router.post('/restaurants/:id/force-deactivate', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Deactivate branch
        const { error: branchError } = await sb
            .from('branches')
            .update({ is_active: false })
            .eq('id', id);

        if (branchError) throw branchError;

        // Suspend license
        const { error: licenseError } = await sb
            .from('licenses')
            .update({ status: 'SUSPENDED' })
            .eq('branch_id', id);

        if (licenseError) throw licenseError;

        res.json({ message: 'Restaurant deactivated successfully' });
    } catch (error) {
        console.error('Force deactivate error:', error);
        res.status(500).json({ error: 'Failed to deactivate restaurant' });
    }
});

// Upgrade plan
router.post('/restaurants/:id/upgrade-plan', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { plan, durationMonths, isLifetime } = req.body;

        if (!plan) {
            return res.status(400).json({ error: 'Plan is required' });
        }

        // Update branch subscription_plan
        await sb
            .from('branches')
            .update({ subscription_plan: plan, is_active: true })
            .eq('id', id);

        // Calculate new expiry
        let expiresAt: Date;
        if (isLifetime) {
            // Lifetime = 100 years
            expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 100);
        } else {
            expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + (durationMonths || 12));
        }

        // Update license
        const { data: license, error: licenseError } = await sb
            .from('licenses')
            .update({
                plan,
                status: 'ACTIVE',
                expires_at: expiresAt.toISOString(),
                is_lifetime: isLifetime || false,
            })
            .eq('branch_id', id)
            .select()
            .single();

        if (licenseError) throw licenseError;

        res.json({
            message: 'Plan upgraded successfully',
            license,
        });
    } catch (error) {
        console.error('Upgrade plan error:', error);
        res.status(500).json({ error: 'Failed to upgrade plan' });
    }
});

// Reactivate restaurant
router.post('/restaurants/:id/reactivate', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        // Reactivate branch
        await sb
            .from('branches')
            .update({ is_active: true })
            .eq('id', id);

        // Reactivate license
        await sb
            .from('licenses')
            .update({ status: 'ACTIVE' })
            .eq('branch_id', id);

        res.json({ message: 'Restaurant reactivated successfully' });
    } catch (error) {
        console.error('Reactivate error:', error);
        res.status(500).json({ error: 'Failed to reactivate restaurant' });
    }
});

// Create new restaurant with owner
router.post('/restaurants', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { restaurantName, address, phone, gstNumber, ownerName, ownerEmail, ownerPassword, plan, licenseDuration, isDemo } = req.body;

        if (!restaurantName || !ownerName || !ownerEmail || !ownerPassword) {
            return res.status(400).json({ error: 'Restaurant name, owner name, email, and password are required' });
        }

        // Check if email exists
        const { data: existing } = await sb
            .from('profiles')
            .select('id')
            .eq('email', ownerEmail)
            .limit(1)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Create organization
        const { data: org } = await sb
            .from('organizations')
            .insert({ name: restaurantName })
            .select()
            .single();

        // Create branch
        const { data: branch, error: branchError } = await sb
            .from('branches')
            .insert({
                org_id: org?.id,
                name: restaurantName,
                address,
                phone,
                gst_number: gstNumber,
                subscription_plan: plan || 'BASIC',
            })
            .select()
            .single();

        if (branchError) throw branchError;

        // Calculate license expiry - DEMO = 3 days (server-enforced), Real = configurable
        const expiresAt = new Date();
        if (isDemo === true) {
            // Demo accounts: 3 days max (server-enforced, cannot be overridden by UI)
            expiresAt.setDate(expiresAt.getDate() + 3);
        } else {
            // Real accounts: configurable duration in months
            expiresAt.setMonth(expiresAt.getMonth() + (licenseDuration || 12));
        }

        // Create license
        const { data: license } = await sb
            .from('licenses')
            .insert({
                branch_id: branch.id,
                license_key: generateLicenseKey(),
                plan: isDemo ? 'DEMO' : (plan || 'BASIC'),
                status: 'ACTIVE',
                is_demo: isDemo === true,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single();

        // Create owner via Supabase Auth
        // email_confirm: true = email is already verified (for demos)
        // email_confirm: false = requires email confirmation (for real clients)
        const { data: authData, error: authError } = await sb.auth.admin.createUser({
            email: ownerEmail,
            password: ownerPassword,
            email_confirm: isDemo === true, // Demo = auto-verified, Real = requires email confirmation
            user_metadata: {
                name: ownerName,
                role: 'owner',
                org_id: org?.id,
                branch_id: branch.id,
                is_demo: isDemo === true,
            },
        });

        if (authError) throw authError;

        // Update profile
        await sb
            .from('profiles')
            .update({
                org_id: org?.id,
                branch_id: branch.id,
                role: 'owner',
                phone,
                email: ownerEmail,
            })
            .eq('id', authData.user.id);

        // Create default categories
        const defaultCategories = [
            { name: 'Starters', icon: '🍗' },
            { name: 'Main Course', icon: '🍛' },
            { name: 'Beverages', icon: '🥤' },
        ];

        for (const cat of defaultCategories) {
            await sb.from('categories').insert({
                branch_id: branch.id,
                name: cat.name,
                icon: cat.icon,
            });
        }

        res.status(201).json({
            message: 'Restaurant created successfully!',
            restaurant: {
                id: branch.id,
                name: branch.name,
                owner: { name: ownerName, email: ownerEmail },
                license: { key: license?.license_key, plan: license?.plan, expiresAt: license?.expires_at },
            },
        });
    } catch (error) {
        console.error('Create restaurant error:', error);
        res.status(500).json({ error: 'Failed to create restaurant' });
    }
});

// Update restaurant
router.patch('/restaurants/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { isActive, name, address, phone, gstNumber } = req.body;

        const { data: branch, error } = await sb
            .from('branches')
            .update({
                is_active: isActive !== undefined ? isActive : undefined,
                name: name || undefined,
                address: address || undefined,
                phone: phone || undefined,
                gst_number: gstNumber || undefined,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(branch);
    } catch (error) {
        console.error('Update restaurant error:', error);
        res.status(500).json({ error: 'Failed to update restaurant' });
    }
});

// Update license
router.patch('/licenses/:branchId', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { branchId } = req.params;
        const { status, plan, extendMonths } = req.body;

        const { data: license, error: fetchError } = await sb
            .from('licenses')
            .select('*')
            .eq('branch_id', branchId)
            .single();

        if (fetchError || !license) {
            return res.status(404).json({ error: 'License not found' });
        }

        const updateData: any = {};
        if (status) updateData.status = status;
        if (plan) updateData.plan = plan;
        if (extendMonths) {
            const newExpiry = new Date(license.expires_at);
            newExpiry.setMonth(newExpiry.getMonth() + extendMonths);
            updateData.expires_at = newExpiry.toISOString();
        }

        const { data: updated, error } = await sb
            .from('licenses')
            .update(updateData)
            .eq('branch_id', branchId)
            .select()
            .single();

        if (error) throw error;

        res.json(updated);
    } catch (error) {
        console.error('Update license error:', error);
        res.status(500).json({ error: 'Failed to update license' });
    }
});

// Delete restaurant (soft delete)
router.delete('/restaurants/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;

        await sb.from('branches').update({ is_active: false }).eq('id', id);
        await sb.from('licenses').update({ status: 'SUSPENDED' }).eq('branch_id', id);

        res.json({ message: 'Restaurant deactivated' });
    } catch (error) {
        console.error('Delete restaurant error:', error);
        res.status(500).json({ error: 'Failed to deactivate restaurant' });
    }
});

// Get password reset requests
router.get('/password-resets', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: requests, error } = await sb
            .from('password_reset_requests')
            .select('*')
            .order('requested_at', { ascending: false });

        if (error) {
            // Table might not exist, return empty array
            console.log('Password resets query note:', error.message);
            return res.json([]);
        }

        // Fetch user info separately if needed
        const enriched = await Promise.all((requests || []).map(async (req: any) => {
            const { data: user } = await sb
                .from('profiles')
                .select('name, email, branch_id')
                .eq('id', req.user_id)
                .single();
            return { ...req, user };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Get password resets error:', error);
        res.json([]);
    }
});

// Complete password reset
router.post('/password-resets/:id/complete', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const { data: request, error: fetchError } = await sb
            .from('password_reset_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Update password via Supabase Auth
        const { error: authError } = await sb.auth.admin.updateUserById(request.user_id, {
            password: newPassword,
        });

        if (authError) throw authError;

        // Update request status
        await sb
            .from('password_reset_requests')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', id);

        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Complete password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Admin reset password directly
router.post('/users/:userId/reset-password', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        const { error } = await sb.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (error) throw error;

        res.json({ message: 'Password reset successfully!' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Get support tickets
router.get('/support-tickets', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;

        const { data: tickets, error } = await sb
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            // Table might not exist, return empty array
            console.log('Support tickets query note:', error.message);
            return res.json([]);
        }

        // Fetch user info separately if needed
        const enriched = await Promise.all((tickets || []).map(async (ticket: any) => {
            const { data: user } = await sb
                .from('profiles')
                .select('name, email, branch_id')
                .eq('id', ticket.user_id)
                .single();
            return { ...ticket, user };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Get support tickets error:', error);
        res.json([]);
    }
});

// Update ticket
router.patch('/support-tickets/:id', authMiddleware, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const sb = (req as any).supabase || supabase;
        const { id } = req.params;
        const { status, adminReply } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (adminReply) updateData.admin_reply = adminReply;
        if (status === 'RESOLVED' || status === 'CLOSED') {
            updateData.resolved_at = new Date().toISOString();
        }

        const { data: ticket, error } = await sb
            .from('support_tickets')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(ticket);
    } catch (error) {
        console.error('Update ticket error:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

export default router;
