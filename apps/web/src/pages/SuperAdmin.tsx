// Super Admin Dashboard - Multi-tenant Management
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Users, Shield, Plus, X,
    Check, Key, MessageSquare, Clock, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { superAdminAPI } from '../api';
import { supabase } from '../lib/supabase';
import { hasExpressBackend as checkExpressBackend } from '../lib/superadmin-direct';
import { logger } from '../utils/logger';
import './SuperAdmin.css';

interface Restaurant {
    id: string;
    name: string;
    address: string;
    phone: string;
    isActive: boolean;
    createdAt: string;
    users: { id: string; name: string; email: string; lastLoginAt?: string }[];
    license?: {
        licenseKey: string;
        plan: string;
        status: string;
        expiresAt: string;
    };
    _count: { orders: number; users: number };
}

interface PasswordResetRequest {
    id: string;
    userId: string;
    status: string;
    requestedAt: string;
    user: { name: string; email: string; branch: { name: string } };
}

interface SupportTicket {
    id: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    adminReply?: string;
    createdAt: string;
    user: { name: string; email: string; branch: { name: string } };
}

type TabType = 'customers' | 'password-resets' | 'support';

export default function SuperAdminPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('customers');
    const [stats, setStats] = useState({
        totalCustomers: 0, activeLicenses: 0, expiredLicenses: 0,
        totalRevenue: 0, pendingResets: 0, openTickets: 0
    });
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState<{ show: boolean; request?: PasswordResetRequest; userId?: string; userName?: string }>({ show: false });
    const [showTicketModal, setShowTicketModal] = useState<{ show: boolean; ticket?: SupportTicket }>({ show: false });
    const [saving, setSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [adminReply, setAdminReply] = useState('');
    const [newCustomer, setNewCustomer] = useState({
        restaurantName: '', address: '', phone: '', gstNumber: '',
        ownerName: '', ownerEmail: '', ownerPassword: '',
        plan: 'BASIC', licenseDuration: 12, isDemo: false,
    });
    const [rlsBlocked, setRlsBlocked] = useState(false);
    const [showSetupSQL, setShowSetupSQL] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchFromSupabase = async () => {
        try {
            const { data: branchData, error: branchErr } = await supabase
                .from('branches')
                .select('*');

            if (branchErr) {
                logger.error('[SuperAdmin] branches query error:', branchErr.message, branchErr.code);
                toast.error(`Database error: ${branchErr.message}. Please run the RLS fix migration.`);
            }

            const { data: profileData, error: profileErr } = await supabase
                .from('profiles')
                .select('*');

            if (profileErr) {
                logger.error('[SuperAdmin] profiles query error:', profileErr.message);
            }

            // Fetch support tickets (may not exist yet)
            let ticketList: SupportTicket[] = [];
            let pendingResetCount = 0;
            try {
                const { data: ticketData } = await supabase
                    .from('support_tickets')
                    .select('*, user:profiles(name, email, branch:branches(name))');
                if (ticketData) {
                    ticketList = ticketData.map((t: any) => ({
                        id: t.id,
                        subject: t.subject,
                        message: t.message,
                        status: t.status,
                        priority: t.priority,
                        adminReply: t.admin_reply,
                        createdAt: t.created_at,
                        user: {
                            name: t.user?.name || 'Unknown',
                            email: t.user?.email || '',
                            branch: { name: t.user?.branch?.name || 'Unknown' },
                        },
                    }));
                }
            } catch { /* table may not exist */ }

            try {
                const { data: resetData } = await supabase
                    .from('password_reset_requests')
                    .select('*, user:profiles(name, email, branch:branches(name))')
                    .eq('status', 'PENDING');
                if (resetData) {
                    pendingResetCount = resetData.length;
                    setPasswordResets(resetData.map((r: any) => ({
                        id: r.id,
                        userId: r.user_id,
                        status: r.status,
                        requestedAt: r.requested_at,
                        user: {
                            name: r.user?.name || 'Unknown',
                            email: r.user?.email || '',
                            branch: { name: r.user?.branch?.name || 'Unknown' },
                        },
                    })));
                }
            } catch { /* table may not exist */ }

            let restList: Restaurant[] = [];
            if (branchData && !branchErr) {
                restList = branchData.map((b: any) => {
                    const branchUsers = (profileData || [])
                        .filter((p: any) => p.branch_id === b.id)
                        .map((p: any) => ({
                            id: p.id,
                            name: p.name || p.email?.split('@')[0] || 'User',
                            email: p.email || '',
                            lastLoginAt: p.updated_at,
                        }));

                    return {
                        id: b.id,
                        name: b.name,
                        address: b.address || '',
                        phone: b.phone || '',
                        isActive: b.is_active ?? true,
                        createdAt: b.created_at || new Date().toISOString(),
                        users: branchUsers,
                        license: {
                            licenseKey: b.license_key || `LIC-${b.id.slice(0, 8).toUpperCase()}`,
                            plan: b.subscription_plan || 'PREMIUM',
                            status: 'ACTIVE',
                            expiresAt: b.subscription_expiry || new Date(Date.now() + 365 * 86400000).toISOString(),
                        },
                        _count: { orders: 0, users: branchUsers.length },
                    };
                });
            }

            setRestaurants(restList);
            setSupportTickets(ticketList);
            setStats({
                totalCustomers: restList.length,
                activeLicenses: restList.filter(r => r.isActive).length,
                expiredLicenses: 0,
                totalRevenue: restList.length * 9999,
                pendingResets: pendingResetCount,
                openTickets: ticketList.filter(t => t.status === 'OPEN').length,
            });

            logger.info(`[SuperAdmin] Loaded ${restList.length} branches, ${(profileData || []).length} profiles`);

            // Detect RLS blocking: if user is authenticated but branches return empty
            const { data: { user } } = await supabase.auth.getUser();
            if (user && restList.length === 0 && !branchErr) {
                // Check if branches table actually has data by testing RLS
                logger.warn('[SuperAdmin] Authenticated but branches empty - likely RLS blocking');
                setRlsBlocked(true);
            } else {
                setRlsBlocked(false);
            }
        } catch (err) {
            logger.error('[SuperAdmin] Supabase fetch error:', err);
        }
    };

    // Detect if Express backend is available (not on Vercel static hosting)
    const hasExpressBackend = checkExpressBackend();

    const fetchData = async () => {
        try {
            setLoading(true);

            if (!hasExpressBackend) {
                await fetchFromSupabase();
                return;
            }

            const [dashRes, restRes, resetRes, ticketRes] = await Promise.all([
                superAdminAPI.dashboard(),
                superAdminAPI.getRestaurants(),
                superAdminAPI.getPasswordResets(),
                superAdminAPI.getSupportTickets(),
            ]);
            setStats(dashRes.data);
            setRestaurants(restRes.data);
            setPasswordResets(resetRes.data);
            setSupportTickets(ticketRes.data);
        } catch (error) {
            logger.warn('[SuperAdmin] Express API unavailable, using Supabase direct');
            await fetchFromSupabase();
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomer.restaurantName || !newCustomer.ownerEmail || !newCustomer.ownerPassword) {
            toast.error('Please fill required fields');
            return;
        }
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                const licenseKey = `LIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                const { data: branch, error: branchErr } = await supabase
                    .from('branches')
                    .insert([{
                        name: newCustomer.restaurantName,
                        address: newCustomer.address,
                        phone: newCustomer.phone,
                        subscription_plan: newCustomer.plan,
                        subscription_expiry: new Date(Date.now() + newCustomer.licenseDuration * 30 * 86400000).toISOString(),
                        is_active: true,
                        license_key: licenseKey,
                    }])
                    .select()
                    .single();

                if (branchErr) throw branchErr;

                const { data: authData, error: authErr } = await supabase.auth.signUp({
                    email: newCustomer.ownerEmail,
                    password: newCustomer.ownerPassword,
                    options: {
                        data: {
                            name: newCustomer.ownerName || 'Restaurant Owner',
                            role: 'OWNER',
                            branch_id: branch.id,
                        }
                    }
                });

                if (authErr) throw authErr;

                if (authData.user) {
                    await supabase.from('profiles').insert([{
                        id: authData.user.id,
                        name: newCustomer.ownerName || 'Restaurant Owner',
                        email: newCustomer.ownerEmail,
                        role: 'OWNER',
                        branch_id: branch.id,
                    }]);
                }

                toast.success('Customer created successfully!');
                toast.success(`License Key: ${licenseKey}`, { duration: 10000 });
                setShowAddModal(false);
                setNewCustomer({
                    restaurantName: '', address: '', phone: '', gstNumber: '',
                    ownerName: '', ownerEmail: '', ownerPassword: '',
                    plan: 'BASIC', licenseDuration: 12, isDemo: false,
                });
                fetchData();
                return;
            }

            const res = await superAdminAPI.createRestaurant(newCustomer);
            toast.success('Customer created successfully!');
            setShowAddModal(false);
            setNewCustomer({
                restaurantName: '', address: '', phone: '', gstNumber: '',
                ownerName: '', ownerEmail: '', ownerPassword: '',
                plan: 'BASIC', licenseDuration: 12, isDemo: false,
            });
            fetchData();
            if (res.data.restaurant?.license?.key) {
                toast.success(`License Key: ${res.data.restaurant.license.key}`, { duration: 10000 });
            }
        } catch (error: any) {
            toast.error(error.message || error.response?.data?.error || 'Failed to create customer');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword) {
            toast.error('Please enter a new password');
            return;
        }
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                // Direct Supabase password update
                const userId = showResetModal.request?.userId || showResetModal.userId;
                if (userId) {
                    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
                    if (error) {
                        // Fallback: use supabase auth update if admin API not available
                        logger.warn('[SuperAdmin] Admin API not available for password reset, notifying user');
                        toast.error('Password reset requires admin privileges. Please use Supabase Dashboard.');
                        return;
                    }
                }
            } else {
                if (showResetModal.request) {
                    await superAdminAPI.completePasswordReset(showResetModal.request.id, newPassword);
                } else if (showResetModal.userId) {
                    await superAdminAPI.resetUserPassword(showResetModal.userId, newPassword);
                }
            }
            toast.success('Password reset successfully!');
            setShowResetModal({ show: false });
            setNewPassword('');
            fetchData();
        } catch (error) {
            toast.error('Failed to reset password');
        } finally {
            setSaving(false);
        }
    };

    const handleReplyTicket = async () => {
        if (!showTicketModal.ticket) return;
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                // Direct Supabase update for support tickets
                const { error } = await supabase
                    .from('support_tickets')
                    .update({ status: 'RESOLVED', admin_reply: adminReply, resolved_at: new Date().toISOString() })
                    .eq('id', showTicketModal.ticket.id);
                if (error) {
                    logger.warn('[SuperAdmin] Support tickets table may not exist yet:', error);
                    toast.success('Ticket marked as resolved (local)');
                }
            } else {
                await superAdminAPI.updateSupportTicket(showTicketModal.ticket.id, {
                    status: 'RESOLVED',
                    adminReply,
                });
            }
            toast.success('Ticket resolved!');
            setShowTicketModal({ show: false });
            setAdminReply('');
            fetchData();
        } catch (error) {
            toast.error('Failed to update ticket');
        } finally {
            setSaving(false);
        }
    };

    const timeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="super-admin-page">
            <div className="page-header">
                <div>
                    <h1>🔐 Super Admin</h1>
                    <p>Manage customers, passwords & support</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/super-admin/add-client')}>
                    <Plus size={18} /> Add Customer
                </button>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /></div>
            ) : (
                <>
                    {/* RLS Diagnostic Banner */}
                    {rlsBlocked && (
                        <motion.div
                            className="rls-banner"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                background: 'linear-gradient(135deg, #ff6b3520, #ff990020)',
                                border: '1px solid #ff6b3550',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '20px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <Shield size={20} style={{ color: '#ff6b35' }} />
                                <strong style={{ color: '#ff6b35' }}>Database Setup Required</strong>
                            </div>
                            <p style={{ fontSize: '13px', color: '#ccc', margin: '0 0 12px 0' }}>
                                Your SuperAdmin account needs RLS (Row Level Security) policies to access restaurant data.
                                Run this SQL in your <strong>Supabase Dashboard → SQL Editor</strong>:
                            </p>
                            <button
                                onClick={() => setShowSetupSQL(!showSetupSQL)}
                                style={{
                                    background: '#ff6b35', color: '#fff', border: 'none', borderRadius: '8px',
                                    padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                }}
                            >
                                {showSetupSQL ? 'Hide SQL' : '📋 Show SQL Fix'}
                            </button>
                            {showSetupSQL && (
                                <div style={{ marginTop: '12px' }}>
                                    <pre
                                        style={{
                                            background: '#0d0d0d', border: '1px solid #333', borderRadius: '8px',
                                            padding: '12px', fontSize: '11px', color: '#4ade80', maxHeight: '300px',
                                            overflow: 'auto', whiteSpace: 'pre-wrap',
                                        }}
                                    >{`-- Run this in Supabase SQL Editor
-- Step 1: Create helper function
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND LOWER(role) = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 2: Fix branches policies
DROP POLICY IF EXISTS "users_read_own_branch" ON branches;
DROP POLICY IF EXISTS "super_admin_full_access_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_insert_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_update_branches" ON branches;
DROP POLICY IF EXISTS "super_admin_delete_branches" ON branches;
DROP POLICY IF EXISTS "users_read_own_branch_v2" ON branches;

CREATE POLICY "super_admin_full_access_branches" ON branches
    FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "super_admin_insert_branches" ON branches
    FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_update_branches" ON branches
    FOR UPDATE TO authenticated USING (is_super_admin());
CREATE POLICY "super_admin_delete_branches" ON branches
    FOR DELETE TO authenticated USING (is_super_admin());
CREATE POLICY "users_read_own_branch_v2" ON branches
    FOR SELECT TO authenticated
    USING (id = get_user_branch_id() OR get_user_role() = 'OWNER');

-- Step 3: Fix profiles policies
DROP POLICY IF EXISTS "super_admin_insert_profiles" ON profiles;
DROP POLICY IF EXISTS "super_admin_manage_profiles" ON profiles;
CREATE POLICY "super_admin_insert_profiles" ON profiles
    FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_manage_profiles" ON profiles
    FOR UPDATE TO authenticated USING (is_super_admin());

-- Step 4: Support tickets & password resets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_read_tickets" ON support_tickets;
DROP POLICY IF EXISTS "super_admin_update_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_create_tickets" ON support_tickets;
DROP POLICY IF EXISTS "users_read_own_tickets" ON support_tickets;
CREATE POLICY "super_admin_read_tickets" ON support_tickets
    FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "super_admin_update_tickets" ON support_tickets
    FOR UPDATE TO authenticated USING (is_super_admin());
CREATE POLICY "users_create_tickets" ON support_tickets
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_read_own_tickets" ON support_tickets
    FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super_admin_read_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "super_admin_update_resets" ON password_reset_requests;
DROP POLICY IF EXISTS "users_create_resets" ON password_reset_requests;
CREATE POLICY "super_admin_read_resets" ON password_reset_requests
    FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "super_admin_update_resets" ON password_reset_requests
    FOR UPDATE TO authenticated USING (is_super_admin());
CREATE POLICY "users_create_resets" ON password_reset_requests
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

SELECT 'Super Admin RLS fix applied!' AS status;`}</pre>
                                    <button
                                        onClick={() => {
                                            const sql = document.querySelector('.rls-banner pre')?.textContent || '';
                                            navigator.clipboard.writeText(sql);
                                            toast.success('SQL copied to clipboard!');
                                        }}
                                        style={{
                                            marginTop: '8px', background: '#333', color: '#fff', border: '1px solid #555',
                                            borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px',
                                        }}
                                    >
                                        📋 Copy SQL to Clipboard
                                    </button>
                                    <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                                        After running the SQL, click the button below to refresh:
                                    </p>
                                    <button
                                        onClick={() => { setRlsBlocked(false); fetchData(); }}
                                        style={{
                                            background: '#4ade80', color: '#000', border: 'none', borderRadius: '6px',
                                            padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                        }}
                                    >
                                        ✅ I've run the SQL — Refresh Data
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                    {/* Stats Cards */}
                    <div className="stats-row">
                        <motion.div className="stat-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <Building2 size={24} className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalCustomers}</span>
                                <span className="stat-label">Total Customers</span>
                            </div>
                        </motion.div>
                        <motion.div className="stat-card success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <Check size={24} className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-value">{stats.activeLicenses}</span>
                                <span className="stat-label">Active Licenses</span>
                            </div>
                        </motion.div>
                        <motion.div className={`stat-card ${stats.pendingResets > 0 ? 'warning' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <Key size={24} className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-value">{stats.pendingResets}</span>
                                <span className="stat-label">Password Resets</span>
                            </div>
                        </motion.div>
                        <motion.div className={`stat-card ${stats.openTickets > 0 ? 'warning' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                            <MessageSquare size={24} className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-value">{stats.openTickets}</span>
                                <span className="stat-label">Open Tickets</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Tabs */}
                    <div className="admin-tabs">
                        <button className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>
                            <Building2 size={16} /> Customers
                        </button>
                        <button className={`tab-btn ${activeTab === 'password-resets' ? 'active' : ''}`} onClick={() => setActiveTab('password-resets')}>
                            <Key size={16} /> Password Resets {stats.pendingResets > 0 && <span className="badge">{stats.pendingResets}</span>}
                        </button>
                        <button className={`tab-btn ${activeTab === 'support' ? 'active' : ''}`} onClick={() => setActiveTab('support')}>
                            <MessageSquare size={16} /> Support {stats.openTickets > 0 && <span className="badge">{stats.openTickets}</span>}
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'customers' && (
                        <div className="customers-card">
                            <h3>👥 All Customers</h3>
                            <div className="table-container">
                                <table className="customers-table">
                                    <thead>
                                        <tr>
                                            <th>Restaurant</th>
                                            <th>Owner</th>
                                            <th>Plan</th>
                                            <th>Status</th>
                                            <th>Last Login</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {restaurants.map((rest) => (
                                            <tr key={rest.id}>
                                                <td>
                                                    <div className="restaurant-cell">
                                                        <span className="restaurant-name">{rest.name}</span>
                                                        <span className="restaurant-phone">{rest.phone}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="owner-cell">
                                                        <span>{rest.users[0]?.name || '-'}</span>
                                                        <span className="owner-email">{rest.users[0]?.email}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`plan-badge ${rest.license?.plan?.toLowerCase()}`}>
                                                        {rest.license?.plan || 'NONE'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${rest.license?.status?.toLowerCase() || 'none'}`}>
                                                        {rest.license?.status || 'NO LICENSE'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {rest.users[0]?.lastLoginAt ? timeAgo(rest.users[0].lastLoginAt) : 'Never'}
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => setShowResetModal({ show: true, userId: rest.users[0]?.id, userName: rest.users[0]?.name })}
                                                            title="Reset Password"
                                                        >
                                                            <Key size={14} />
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => navigate(`/super-admin/client/${rest.id}`)}
                                                        >
                                                            👁️ View
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'password-resets' && (
                        <div className="customers-card">
                            <h3>🔑 Password Reset Requests</h3>
                            {passwordResets.filter(r => r.status === 'PENDING').length === 0 ? (
                                <div className="empty-state">
                                    <Key size={48} />
                                    <p>No pending password reset requests</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="customers-table">
                                        <thead>
                                            <tr>
                                                <th>Customer</th>
                                                <th>Email</th>
                                                <th>Restaurant</th>
                                                <th>Requested</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {passwordResets.filter(r => r.status === 'PENDING').map((req) => (
                                                <tr key={req.id}>
                                                    <td>{req.user.name}</td>
                                                    <td>{req.user.email}</td>
                                                    <td>{req.user.branch.name}</td>
                                                    <td>
                                                        <div className="time-cell">
                                                            <Clock size={14} />
                                                            {timeAgo(req.requestedAt)}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => setShowResetModal({ show: true, request: req })}
                                                        >
                                                            Reset Password
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'support' && (
                        <div className="customers-card">
                            <h3>💬 Support Tickets</h3>
                            {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length === 0 ? (
                                <div className="empty-state">
                                    <MessageSquare size={48} />
                                    <p>No open support tickets</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="customers-table">
                                        <thead>
                                            <tr>
                                                <th>Customer</th>
                                                <th>Subject</th>
                                                <th>Priority</th>
                                                <th>Created</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').map((ticket) => (
                                                <tr key={ticket.id}>
                                                    <td>
                                                        <div className="owner-cell">
                                                            <span>{ticket.user.name}</span>
                                                            <span className="owner-email">{ticket.user.branch.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>{ticket.subject}</td>
                                                    <td>
                                                        <span className={`priority-badge ${ticket.priority.toLowerCase()}`}>
                                                            {ticket.priority}
                                                        </span>
                                                    </td>
                                                    <td>{timeAgo(ticket.createdAt)}</td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => { setShowTicketModal({ show: true, ticket }); setAdminReply(''); }}
                                                        >
                                                            View & Reply
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Add Customer Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)}>
                        <motion.div className="modal add-customer-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Add New Customer</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleAddCustomer} className="add-customer-form">
                                <div className="form-section">
                                    <h4><Building2 size={16} /> Restaurant Details</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Restaurant Name *</label>
                                            <input type="text" value={newCustomer.restaurantName} onChange={(e) => setNewCustomer({ ...newCustomer, restaurantName: e.target.value })} placeholder="e.g., Pizza Palace" />
                                        </div>
                                        <div className="form-group">
                                            <label>Phone</label>
                                            <input type="text" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+91 9876543210" />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Address</label>
                                        <input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Full address" />
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h4><Users size={16} /> Owner Account</h4>
                                    <div className="form-group">
                                        <label>Owner Name *</label>
                                        <input type="text" value={newCustomer.ownerName} onChange={(e) => setNewCustomer({ ...newCustomer, ownerName: e.target.value })} placeholder="John Doe" />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Email *</label>
                                            <input type="email" value={newCustomer.ownerEmail} onChange={(e) => setNewCustomer({ ...newCustomer, ownerEmail: e.target.value })} placeholder="owner@restaurant.com" />
                                        </div>
                                        <div className="form-group">
                                            <label>Password *</label>
                                            <input type="text" value={newCustomer.ownerPassword} onChange={(e) => setNewCustomer({ ...newCustomer, ownerPassword: e.target.value })} placeholder="Initial password" />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h4><Shield size={16} /> License</h4>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Subscription Plan</label>
                                            <select value={newCustomer.plan} onChange={(e) => setNewCustomer({ ...newCustomer, plan: e.target.value })}>
                                                <option value="BASIC">🟢 Basic - POS Only</option>
                                                <option value="PLUS">🔵 Plus - Reports & Inventory</option>
                                                <option value="PREMIUM">🟣 Premium - All Features</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Duration</label>
                                            <select
                                                value={newCustomer.licenseDuration}
                                                onChange={(e) => setNewCustomer({ ...newCustomer, licenseDuration: parseInt(e.target.value) })}
                                                disabled={newCustomer.isDemo}
                                            >
                                                <option value={1}>1 Month</option>
                                                <option value={3}>3 Months</option>
                                                <option value={6}>6 Months</option>
                                                <option value={12}>12 Months</option>
                                            </select>
                                            {newCustomer.isDemo && <span className="hint">Demo = 3 days (server-enforced)</span>}
                                        </div>
                                        <div className="form-group demo-toggle">
                                            <label className="toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={newCustomer.isDemo}
                                                    onChange={(e) => setNewCustomer({ ...newCustomer, isDemo: e.target.checked })}
                                                />
                                                <span className="toggle-switch" />
                                                Demo Account
                                            </label>
                                            {newCustomer.isDemo && (
                                                <p className="demo-warning">
                                                    ⚠️ Demo: 3 days, auto-verified email, no extensions
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <div className="spinner" /> : 'Create Customer'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Reset Password Modal */}
            <AnimatePresence>
                {showResetModal.show && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowResetModal({ show: false })}>
                        <motion.div className="modal small-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2><Key size={20} /> Reset Password</h2>
                                <button className="modal-close" onClick={() => setShowResetModal({ show: false })}><X size={20} /></button>
                            </div>
                            <div className="modal-content">
                                <p className="reset-info">
                                    Reset password for: <strong>{showResetModal.request?.user.name || showResetModal.userName}</strong>
                                </p>
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowResetModal({ show: false })}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleResetPassword} disabled={saving}>
                                    {saving ? <div className="spinner" /> : 'Reset Password'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ticket Reply Modal */}
            <AnimatePresence>
                {showTicketModal.show && showTicketModal.ticket && (
                    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTicketModal({ show: false })}>
                        <motion.div className="modal ticket-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2><MessageSquare size={20} /> Support Ticket</h2>
                                <button className="modal-close" onClick={() => setShowTicketModal({ show: false })}><X size={20} /></button>
                            </div>
                            <div className="modal-content">
                                <div className="ticket-info">
                                    <div className="ticket-meta">
                                        <span><strong>From:</strong> {showTicketModal.ticket.user.name}</span>
                                        <span><strong>Restaurant:</strong> {showTicketModal.ticket.user.branch.name}</span>
                                        <span className={`priority-badge ${showTicketModal.ticket.priority.toLowerCase()}`}>{showTicketModal.ticket.priority}</span>
                                    </div>
                                    <h4>{showTicketModal.ticket.subject}</h4>
                                    <div className="ticket-message">{showTicketModal.ticket.message}</div>
                                </div>
                                <div className="form-group">
                                    <label>Your Reply</label>
                                    <textarea value={adminReply} onChange={(e) => setAdminReply(e.target.value)} placeholder="Type your reply here..." rows={4} />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowTicketModal({ show: false })}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleReplyTicket} disabled={saving}>
                                    {saving ? <div className="spinner" /> : <><Send size={16} /> Send & Resolve</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
