// Super Admin — SaaS Control Center
// Architecture: Stripe Dashboard × Linear table density
// Primary workspace: the table. Detail: slide-out drawer.
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Shield, Plus, X, Key,
    MessageSquare, Clock, Send, Search, RefreshCw,
    AlertCircle, CheckCircle2, Phone,
    Calendar, Eye, ArrowUpRight,
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

type DrawerView = 'customer' | 'reset-password' | 'ticket' | null;
type FilterType = 'all' | 'active' | 'inactive';

export default function SuperAdminPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCustomers: 0, activeLicenses: 0,
        pendingResets: 0, openTickets: 0
    });
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [rlsBlocked, setRlsBlocked] = useState(false);

    // Drawer state
    const [drawer, setDrawer] = useState<{ view: DrawerView; data?: any }>({ view: null });

    // Modal state for quick actions
    const [resetModal, setResetModal] = useState<{ open: boolean; userId?: string; userName?: string; requestId?: string }>({ open: false });
    const [ticketModal, setTicketModal] = useState<{ open: boolean; ticket?: SupportTicket }>({ open: false });
    const [addModal, setAddModal] = useState(false);

    const [saving, setSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [adminReply, setAdminReply] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeSection, setActiveSection] = useState<'customers' | 'resets' | 'tickets'>('customers');

    const [newCustomer, setNewCustomer] = useState({
        restaurantName: '', address: '', phone: '', gstNumber: '',
        ownerName: '', ownerEmail: '', ownerPassword: '',
        plan: 'BASIC', licenseDuration: 12, isDemo: false,
    });

    useEffect(() => { fetchData(); }, []);

    const hasExpressBackend = checkExpressBackend();

    const fetchFromSupabase = async () => {
        try {
            const { data: branchData, error: branchErr } = await supabase.from('branches').select('*');
            if (branchErr) {
                logger.error('[SuperAdmin] branches query error:', branchErr.message);
                toast.error(`Database error: ${branchErr.message}`);
            }
            const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*');
            if (profileErr) logger.error('[SuperAdmin] profiles query error:', profileErr.message);

            let ticketList: SupportTicket[] = [];
            let pendingResetCount = 0;
            try {
                const { data: ticketData } = await supabase
                    .from('support_tickets')
                    .select('*, user:profiles(name, email, branch:branches(name))');
                if (ticketData) {
                    ticketList = ticketData.map((t: any) => ({
                        id: t.id, subject: t.subject, message: t.message,
                        status: t.status, priority: t.priority, adminReply: t.admin_reply,
                        createdAt: t.created_at,
                        user: { name: t.user?.name || 'Unknown', email: t.user?.email || '', branch: { name: t.user?.branch?.name || 'Unknown' } },
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
                        id: r.id, userId: r.user_id, status: r.status, requestedAt: r.requested_at,
                        user: { name: r.user?.name || 'Unknown', email: r.user?.email || '', branch: { name: r.user?.branch?.name || 'Unknown' } },
                    })));
                }
            } catch { /* table may not exist */ }

            let restList: Restaurant[] = [];
            if (branchData && !branchErr) {
                restList = branchData.map((b: any) => {
                    const branchUsers = (profileData || [])
                        .filter((p: any) => p.branch_id === b.id)
                        .map((p: any) => ({ id: p.id, name: p.name || p.email?.split('@')[0] || 'User', email: p.email || '', lastLoginAt: p.updated_at }));
                    return {
                        id: b.id, name: b.name, address: b.address || '', phone: b.phone || '',
                        isActive: b.is_active ?? true, createdAt: b.created_at || new Date().toISOString(),
                        users: branchUsers,
                        license: {
                            licenseKey: b.license_key || `LIC-${b.id.slice(0, 8).toUpperCase()}`,
                            plan: b.subscription_plan || 'PREMIUM', status: 'ACTIVE',
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
                pendingResets: pendingResetCount,
                openTickets: ticketList.filter(t => t.status === 'OPEN').length,
            });

            const { data: { user } } = await supabase.auth.getUser();
            setRlsBlocked(!!(user && restList.length === 0 && !branchErr));
        } catch (err) {
            logger.error('[SuperAdmin] Supabase fetch error:', err);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            if (!hasExpressBackend) { await fetchFromSupabase(); return; }
            const [dashRes, restRes, resetRes, ticketRes] = await Promise.all([
                superAdminAPI.dashboard(), superAdminAPI.getRestaurants(),
                superAdminAPI.getPasswordResets(), superAdminAPI.getSupportTickets(),
            ]);
            setStats(dashRes.data); setRestaurants(restRes.data);
            setPasswordResets(resetRes.data); setSupportTickets(ticketRes.data);
        } catch {
            logger.warn('[SuperAdmin] Express API unavailable, using Supabase direct');
            await fetchFromSupabase();
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomer.restaurantName || !newCustomer.ownerEmail || !newCustomer.ownerPassword) {
            toast.error('Please fill required fields'); return;
        }
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                const licenseKey = `LIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                const { data: branch, error: branchErr } = await supabase.from('branches').insert([{
                    name: newCustomer.restaurantName, address: newCustomer.address, phone: newCustomer.phone,
                    subscription_plan: newCustomer.plan, subscription_expiry: new Date(Date.now() + newCustomer.licenseDuration * 30 * 86400000).toISOString(),
                    is_active: true, license_key: licenseKey,
                }]).select().single();
                if (branchErr) throw branchErr;
                const { data: authData, error: authErr } = await supabase.auth.signUp({
                    email: newCustomer.ownerEmail, password: newCustomer.ownerPassword,
                    options: { data: { name: newCustomer.ownerName || 'Restaurant Owner', role: 'OWNER', branch_id: branch.id } }
                });
                if (authErr) throw authErr;
                if (authData.user) {
                    await supabase.from('profiles').insert([{
                        id: authData.user.id, name: newCustomer.ownerName || 'Restaurant Owner',
                        email: newCustomer.ownerEmail, role: 'OWNER', branch_id: branch.id,
                    }]);
                }
                toast.success('Customer created!');
                toast.success(`License Key: ${licenseKey}`, { duration: 10000 });
            } else {
                await superAdminAPI.createRestaurant(newCustomer);
                toast.success('Customer created successfully!');
            }
            setAddModal(false);
            setNewCustomer({ restaurantName: '', address: '', phone: '', gstNumber: '', ownerName: '', ownerEmail: '', ownerPassword: '', plan: 'BASIC', licenseDuration: 12, isDemo: false });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create customer');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword) { toast.error('Enter a new password'); return; }
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                const userId = resetModal.userId;
                if (userId) {
                    const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
                    if (error) { toast.error('Requires admin privileges. Use Supabase Dashboard.'); return; }
                }
            } else {
                if (resetModal.requestId) await superAdminAPI.completePasswordReset(resetModal.requestId, newPassword);
                else if (resetModal.userId) await superAdminAPI.resetUserPassword(resetModal.userId, newPassword);
            }
            toast.success('Password reset successfully!');
            setResetModal({ open: false });
            setNewPassword('');
            fetchData();
        } catch { toast.error('Failed to reset password'); }
        finally { setSaving(false); }
    };

    const handleReplyTicket = async () => {
        if (!ticketModal.ticket) return;
        try {
            setSaving(true);
            if (!hasExpressBackend) {
                await supabase.from('support_tickets').update({
                    status: 'RESOLVED', admin_reply: adminReply, resolved_at: new Date().toISOString()
                }).eq('id', ticketModal.ticket.id);
            } else {
                await superAdminAPI.updateSupportTicket(ticketModal.ticket.id, { status: 'RESOLVED', adminReply });
            }
            toast.success('Ticket resolved!');
            setTicketModal({ open: false });
            setAdminReply('');
            fetchData();
        } catch { toast.error('Failed to update ticket'); }
        finally { setSaving(false); }
    };

    const timeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const expiresIn = (date: string) => {
        const diff = new Date(date).getTime() - Date.now();
        const days = Math.floor(diff / 86400000);
        if (days < 0) return { label: 'Expired', urgent: true };
        if (days < 30) return { label: `${days}d left`, urgent: true };
        return { label: `${days}d left`, urgent: false };
    };

    const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const filteredRestaurants = useMemo(() => {
        let list = restaurants;
        if (activeFilter === 'active') list = list.filter(r => r.isActive);
        if (activeFilter === 'inactive') list = list.filter(r => !r.isActive);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.users[0]?.email.toLowerCase().includes(q) ||
                r.users[0]?.name.toLowerCase().includes(q)
            );
        }
        return list;
    }, [restaurants, activeFilter, searchQuery]);

    const selectedCustomer = drawer.view === 'customer' ? drawer.data as Restaurant : null;

    if (loading) {
        return (
            <div className="sa-loading">
                <div className="sa-spinner" />
                <span>Loading control center…</span>
            </div>
        );
    }

    return (
        <div className="sa-root">
            {/* ── Top Toolbar ── */}
            <header className="sa-toolbar">
                <div className="sa-toolbar-left">
                    <div className="sa-brand">
                        <Shield size={18} style={{ color: 'var(--primary)' }} />
                        <span>Control Center</span>
                    </div>
                    <nav className="sa-section-nav">
                        <button
                            className={`sa-nav-btn ${activeSection === 'customers' ? 'active' : ''}`}
                            onClick={() => setActiveSection('customers')}
                        >
                            <Building2 size={14} /> Customers
                            <span className="sa-nav-count">{stats.totalCustomers}</span>
                        </button>
                        <button
                            className={`sa-nav-btn ${activeSection === 'resets' ? 'active' : ''}`}
                            onClick={() => setActiveSection('resets')}
                        >
                            <Key size={14} /> Resets
                            {stats.pendingResets > 0 && <span className="sa-nav-badge">{stats.pendingResets}</span>}
                        </button>
                        <button
                            className={`sa-nav-btn ${activeSection === 'tickets' ? 'active' : ''}`}
                            onClick={() => setActiveSection('tickets')}
                        >
                            <MessageSquare size={14} /> Tickets
                            {stats.openTickets > 0 && <span className="sa-nav-badge">{stats.openTickets}</span>}
                        </button>
                    </nav>
                </div>
                <div className="sa-toolbar-right">
                    <button className="sa-icon-btn" onClick={fetchData} title="Refresh">
                        <RefreshCw size={15} />
                    </button>
                    <button className="sa-btn-primary" onClick={() => setAddModal(true)}>
                        <Plus size={15} /> New Customer
                    </button>
                </div>
            </header>

            {/* ── RLS Warning Banner ── */}
            {rlsBlocked && (
                <div className="sa-rls-banner">
                    <AlertCircle size={16} />
                    <span>RLS setup required — <strong>run the SQL migration</strong> in Supabase Dashboard, then refresh.</span>
                    <button className="sa-rls-dismiss" onClick={() => { setRlsBlocked(false); fetchData(); }}>
                        Refresh after fix
                    </button>
                </div>
            )}

            {/* ── Metric Strip ── */}
            <div className="sa-metrics">
                <div className="sa-metric">
                    <span className="sa-metric-value">{stats.totalCustomers}</span>
                    <span className="sa-metric-label">Total Accounts</span>
                </div>
                <div className="sa-metric-divider" />
                <div className="sa-metric">
                    <span className="sa-metric-value" style={{ color: 'var(--success)' }}>{stats.activeLicenses}</span>
                    <span className="sa-metric-label">Active</span>
                </div>
                <div className="sa-metric-divider" />
                <div className="sa-metric">
                    <span className="sa-metric-value" style={{ color: stats.pendingResets > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {stats.pendingResets}
                    </span>
                    <span className="sa-metric-label">Pending Resets</span>
                </div>
                <div className="sa-metric-divider" />
                <div className="sa-metric">
                    <span className="sa-metric-value" style={{ color: stats.openTickets > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {stats.openTickets}
                    </span>
                    <span className="sa-metric-label">Open Tickets</span>
                </div>
            </div>

            {/* ── Main Workspace ── */}
            <div className={`sa-workspace ${drawer.view ? 'drawer-open' : ''}`}>

                {/* ── Left: Table Panel ── */}
                <div className="sa-table-panel">

                    {/* Section: Customers */}
                    {activeSection === 'customers' && (
                        <>
                            {/* Table Toolbar */}
                            <div className="sa-table-toolbar">
                                <div className="sa-search-wrap">
                                    <Search size={14} className="sa-search-icon" />
                                    <input
                                        className="sa-search"
                                        placeholder="Search by name, email…"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="sa-filters">
                                    {(['all', 'active', 'inactive'] as FilterType[]).map(f => (
                                        <button
                                            key={f}
                                            className={`sa-filter-pill ${activeFilter === f ? 'active' : ''}`}
                                            onClick={() => setActiveFilter(f)}
                                        >
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <span className="sa-result-count">{filteredRestaurants.length} accounts</span>
                            </div>

                            {/* Customer Table */}
                            <div className="sa-table-wrap">
                                <table className="sa-table">
                                    <thead>
                                        <tr>
                                            <th>Account</th>
                                            <th>Owner</th>
                                            <th>Plan</th>
                                            <th>License</th>
                                            <th>Last Active</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRestaurants.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="sa-table-empty">
                                                    <Building2 size={32} />
                                                    <p>No customers found</p>
                                                </td>
                                            </tr>
                                        ) : filteredRestaurants.map((rest) => {
                                            const exp = rest.license?.expiresAt ? expiresIn(rest.license.expiresAt) : null;
                                            const isSelected = selectedCustomer?.id === rest.id;
                                            return (
                                                <tr
                                                    key={rest.id}
                                                    className={`sa-row ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setDrawer({ view: 'customer', data: rest })}
                                                >
                                                    <td>
                                                        <div className="sa-account-cell">
                                                            <div className="sa-avatar">
                                                                {initials(rest.name)}
                                                            </div>
                                                            <div>
                                                                <div className="sa-account-name">{rest.name}</div>
                                                                {rest.phone && <div className="sa-account-sub">{rest.phone}</div>}
                                                            </div>
                                                            {rest.isActive
                                                                ? <span className="sa-dot active" title="Active" />
                                                                : <span className="sa-dot inactive" title="Inactive" />
                                                            }
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="sa-owner-cell">
                                                            <span>{rest.users[0]?.name || '—'}</span>
                                                            <span className="sa-sub-text">{rest.users[0]?.email}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`sa-plan-badge ${(rest.license?.plan || 'none').toLowerCase()}`}>
                                                            {rest.license?.plan || 'None'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {exp ? (
                                                            <span className={`sa-expiry ${exp.urgent ? 'urgent' : ''}`}>
                                                                <Calendar size={12} /> {exp.label}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="sa-time-cell">
                                                        {rest.users[0]?.lastLoginAt ? timeAgo(rest.users[0].lastLoginAt) : 'Never'}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="sa-row-action"
                                                            onClick={e => { e.stopPropagation(); navigate(`/super-admin/client/${rest.id}`); }}
                                                            title="Open full detail"
                                                        >
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Section: Password Resets */}
                    {activeSection === 'resets' && (
                        <div className="sa-section-wrap">
                            <div className="sa-section-header">
                                <Key size={16} />
                                <h3>Password Reset Requests</h3>
                                {stats.pendingResets > 0 && <span className="sa-section-badge">{stats.pendingResets} pending</span>}
                            </div>
                            {passwordResets.filter(r => r.status === 'PENDING').length === 0 ? (
                                <div className="sa-empty-state">
                                    <CheckCircle2 size={40} style={{ color: 'var(--success)' }} />
                                    <p>All caught up — no pending resets</p>
                                </div>
                            ) : (
                                <div className="sa-table-wrap">
                                    <table className="sa-table">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Restaurant</th>
                                                <th>Requested</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {passwordResets.filter(r => r.status === 'PENDING').map(req => (
                                                <tr key={req.id} className="sa-row">
                                                    <td>
                                                        <div className="sa-owner-cell">
                                                            <span>{req.user.name}</span>
                                                            <span className="sa-sub-text">{req.user.email}</span>
                                                        </div>
                                                    </td>
                                                    <td>{req.user.branch.name}</td>
                                                    <td>
                                                        <span className="sa-time-cell">
                                                            <Clock size={12} /> {timeAgo(req.requestedAt)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="sa-btn-outline"
                                                            onClick={() => setResetModal({ open: true, requestId: req.id, userId: req.userId, userName: req.user.name })}
                                                        >
                                                            <Key size={13} /> Reset Password
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

                    {/* Section: Support Tickets */}
                    {activeSection === 'tickets' && (
                        <div className="sa-section-wrap">
                            <div className="sa-section-header">
                                <MessageSquare size={16} />
                                <h3>Support Tickets</h3>
                                {stats.openTickets > 0 && <span className="sa-section-badge urgent">{stats.openTickets} open</span>}
                            </div>
                            {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length === 0 ? (
                                <div className="sa-empty-state">
                                    <CheckCircle2 size={40} style={{ color: 'var(--success)' }} />
                                    <p>No open support tickets</p>
                                </div>
                            ) : (
                                <div className="sa-ticket-list">
                                    {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').map(ticket => (
                                        <div key={ticket.id} className="sa-ticket-row">
                                            <div className="sa-ticket-left">
                                                <span className={`sa-priority-dot ${ticket.priority.toLowerCase()}`} />
                                                <div>
                                                    <div className="sa-ticket-subject">{ticket.subject}</div>
                                                    <div className="sa-ticket-meta">
                                                        {ticket.user.name} · {ticket.user.branch.name} · {timeAgo(ticket.createdAt)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="sa-ticket-right">
                                                <span className={`sa-priority-badge ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                                                <button
                                                    className="sa-btn-outline"
                                                    onClick={() => { setTicketModal({ open: true, ticket }); setAdminReply(''); }}
                                                >
                                                    <Send size={13} /> Reply
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right: Slide-out Customer Drawer ── */}
                <AnimatePresence>
                    {drawer.view === 'customer' && selectedCustomer && (
                        <motion.aside
                            className="sa-drawer"
                            initial={{ x: 40, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 40, opacity: 0 }}
                            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <div className="sa-drawer-header">
                                <div className="sa-drawer-title">
                                    <div className="sa-drawer-avatar">{initials(selectedCustomer.name)}</div>
                                    <div>
                                        <h3>{selectedCustomer.name}</h3>
                                        <p>{selectedCustomer.isActive ? 'Active account' : 'Inactive account'}</p>
                                    </div>
                                </div>
                                <button className="sa-icon-btn" onClick={() => setDrawer({ view: null })}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="sa-drawer-body">
                                {/* Quick Stats */}
                                <div className="sa-drawer-stats">
                                    <div className="sa-drawer-stat">
                                        <span className="sa-drawer-stat-value">{selectedCustomer._count.users}</span>
                                        <span className="sa-drawer-stat-label">Staff</span>
                                    </div>
                                    <div className="sa-drawer-stat">
                                        <span className={`sa-plan-badge ${(selectedCustomer.license?.plan || 'none').toLowerCase()}`}>
                                            {selectedCustomer.license?.plan || 'None'}
                                        </span>
                                        <span className="sa-drawer-stat-label">Plan</span>
                                    </div>
                                    {selectedCustomer.license?.expiresAt && (
                                        <div className="sa-drawer-stat">
                                            {(() => {
                                                const exp = expiresIn(selectedCustomer.license!.expiresAt);
                                                return <span className={`sa-expiry ${exp.urgent ? 'urgent' : ''}`}>{exp.label}</span>;
                                            })()}
                                            <span className="sa-drawer-stat-label">License</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info fields */}
                                <div className="sa-drawer-section">
                                    <div className="sa-drawer-field">
                                        <Phone size={13} />
                                        <span>{selectedCustomer.phone || 'No phone'}</span>
                                    </div>
                                    {selectedCustomer.address && (
                                        <div className="sa-drawer-field">
                                            <Building2 size={13} />
                                            <span>{selectedCustomer.address}</span>
                                        </div>
                                    )}
                                    <div className="sa-drawer-field">
                                        <Calendar size={13} />
                                        <span>Joined {new Date(selectedCustomer.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Owner info */}
                                {selectedCustomer.users[0] && (
                                    <div className="sa-drawer-section">
                                        <div className="sa-drawer-section-title">Owner Account</div>
                                        <div className="sa-drawer-owner">
                                            <div className="sa-avatar small">{initials(selectedCustomer.users[0].name)}</div>
                                            <div>
                                                <div>{selectedCustomer.users[0].name}</div>
                                                <div className="sa-sub-text">{selectedCustomer.users[0].email}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* License key */}
                                {selectedCustomer.license?.licenseKey && (
                                    <div className="sa-drawer-section">
                                        <div className="sa-drawer-section-title">License Key</div>
                                        <div className="sa-license-key">{selectedCustomer.license.licenseKey}</div>
                                    </div>
                                )}

                                {/* Quick Actions */}
                                <div className="sa-drawer-actions">
                                    <button
                                        className="sa-drawer-action-btn"
                                        onClick={() => setResetModal({ open: true, userId: selectedCustomer.users[0]?.id, userName: selectedCustomer.users[0]?.name })}
                                    >
                                        <Key size={14} /> Reset Password
                                    </button>
                                    <button
                                        className="sa-drawer-action-btn"
                                        onClick={() => navigate(`/super-admin/client/${selectedCustomer.id}`)}
                                    >
                                        <Eye size={14} /> Full Detail
                                        <ArrowUpRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Add Customer Modal ── */}
            <AnimatePresence>
                {addModal && (
                    <motion.div className="sa-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddModal(false)}>
                        <motion.div className="sa-modal" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} onClick={e => e.stopPropagation()}>
                            <div className="sa-modal-header">
                                <h3>New Customer Account</h3>
                                <button className="sa-icon-btn" onClick={() => setAddModal(false)}><X size={16} /></button>
                            </div>
                            <form onSubmit={handleAddCustomer} className="sa-modal-form">
                                <div className="sa-form-section-label">Restaurant</div>
                                <div className="sa-form-row">
                                    <div className="sa-form-group">
                                        <label>Name <span className="sa-required">*</span></label>
                                        <input type="text" value={newCustomer.restaurantName} onChange={e => setNewCustomer({ ...newCustomer, restaurantName: e.target.value })} placeholder="Pizza Palace" />
                                    </div>
                                    <div className="sa-form-group">
                                        <label>Phone</label>
                                        <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+91 9876543210" />
                                    </div>
                                </div>
                                <div className="sa-form-group">
                                    <label>Address</label>
                                    <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Full address" />
                                </div>

                                <div className="sa-form-divider" />
                                <div className="sa-form-section-label">Owner Account</div>
                                <div className="sa-form-group">
                                    <label>Name</label>
                                    <input type="text" value={newCustomer.ownerName} onChange={e => setNewCustomer({ ...newCustomer, ownerName: e.target.value })} placeholder="John Doe" />
                                </div>
                                <div className="sa-form-row">
                                    <div className="sa-form-group">
                                        <label>Email <span className="sa-required">*</span></label>
                                        <input type="email" value={newCustomer.ownerEmail} onChange={e => setNewCustomer({ ...newCustomer, ownerEmail: e.target.value })} placeholder="owner@restaurant.com" />
                                    </div>
                                    <div className="sa-form-group">
                                        <label>Password <span className="sa-required">*</span></label>
                                        <input type="text" value={newCustomer.ownerPassword} onChange={e => setNewCustomer({ ...newCustomer, ownerPassword: e.target.value })} placeholder="Initial password" />
                                    </div>
                                </div>

                                <div className="sa-form-divider" />
                                <div className="sa-form-section-label">License</div>
                                <div className="sa-form-row">
                                    <div className="sa-form-group">
                                        <label>Plan</label>
                                        <select value={newCustomer.plan} onChange={e => setNewCustomer({ ...newCustomer, plan: e.target.value })}>
                                            <option value="BASIC">Basic — POS Only</option>
                                            <option value="PLUS">Plus — Reports & Inventory</option>
                                            <option value="PREMIUM">Premium — All Features</option>
                                        </select>
                                    </div>
                                    <div className="sa-form-group">
                                        <label>Duration</label>
                                        <select value={newCustomer.licenseDuration} onChange={e => setNewCustomer({ ...newCustomer, licenseDuration: parseInt(e.target.value) })} disabled={newCustomer.isDemo}>
                                            <option value={1}>1 Month</option>
                                            <option value={3}>3 Months</option>
                                            <option value={6}>6 Months</option>
                                            <option value={12}>12 Months</option>
                                        </select>
                                    </div>
                                </div>
                                <label className="sa-toggle-row">
                                    <input type="checkbox" checked={newCustomer.isDemo} onChange={e => setNewCustomer({ ...newCustomer, isDemo: e.target.checked })} />
                                    <span className="sa-toggle-switch" />
                                    <span>Demo account <span className="sa-sub-text">(3 days, auto-verified)</span></span>
                                </label>

                                <div className="sa-modal-footer">
                                    <button type="button" className="sa-btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
                                    <button type="submit" className="sa-btn-primary" disabled={saving}>
                                        {saving ? <div className="sa-spinner-sm" /> : <><Plus size={14} /> Create Account</>}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Reset Password Modal ── */}
            <AnimatePresence>
                {resetModal.open && (
                    <motion.div className="sa-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetModal({ open: false })}>
                        <motion.div className="sa-modal sa-modal-sm" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={e => e.stopPropagation()}>
                            <div className="sa-modal-header">
                                <h3><Key size={16} /> Reset Password</h3>
                                <button className="sa-icon-btn" onClick={() => setResetModal({ open: false })}><X size={16} /></button>
                            </div>
                            <div className="sa-modal-body">
                                <p className="sa-modal-info">
                                    Setting new password for <strong>{resetModal.userName}</strong>
                                </p>
                                <div className="sa-form-group">
                                    <label>New Password</label>
                                    <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" autoFocus />
                                </div>
                            </div>
                            <div className="sa-modal-footer">
                                <button className="sa-btn-ghost" onClick={() => setResetModal({ open: false })}>Cancel</button>
                                <button className="sa-btn-primary" onClick={handleResetPassword} disabled={saving}>
                                    {saving ? <div className="sa-spinner-sm" /> : 'Reset Password'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Ticket Reply Modal ── */}
            <AnimatePresence>
                {ticketModal.open && ticketModal.ticket && (
                    <motion.div className="sa-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTicketModal({ open: false })}>
                        <motion.div className="sa-modal" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} onClick={e => e.stopPropagation()}>
                            <div className="sa-modal-header">
                                <h3><MessageSquare size={16} /> Support Ticket</h3>
                                <button className="sa-icon-btn" onClick={() => setTicketModal({ open: false })}><X size={16} /></button>
                            </div>
                            <div className="sa-modal-body">
                                <div className="sa-ticket-detail">
                                    <div className="sa-ticket-from">
                                        <span><strong>{ticketModal.ticket.user.name}</strong></span>
                                        <span className="sa-sub-text">{ticketModal.ticket.user.branch.name}</span>
                                        <span className={`sa-priority-badge ${ticketModal.ticket.priority.toLowerCase()}`}>{ticketModal.ticket.priority}</span>
                                    </div>
                                    <h4 className="sa-ticket-subject-full">{ticketModal.ticket.subject}</h4>
                                    <div className="sa-ticket-message-body">{ticketModal.ticket.message}</div>
                                </div>
                                <div className="sa-form-group" style={{ marginTop: '16px' }}>
                                    <label>Your Reply</label>
                                    <textarea value={adminReply} onChange={e => setAdminReply(e.target.value)} placeholder="Type your reply…" rows={4} />
                                </div>
                            </div>
                            <div className="sa-modal-footer">
                                <button className="sa-btn-ghost" onClick={() => setTicketModal({ open: false })}>Cancel</button>
                                <button className="sa-btn-primary" onClick={handleReplyTicket} disabled={saving}>
                                    {saving ? <div className="sa-spinner-sm" /> : <><Send size={14} /> Send & Resolve</>}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
