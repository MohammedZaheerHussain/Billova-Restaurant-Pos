// Super Admin — Platform Control Center (SKYWALK Architecture mapped to Billova Orange)
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Shield, Plus, X, Key, Copy,
    MessageSquare, Clock, Send, Search, RefreshCw,
    AlertCircle, CheckCircle2, Phone,
    Calendar, ArrowUpRight, TrendingUp, AlertTriangle,
    Activity, Zap, UserCheck, ShieldAlert,
    ExternalLink, Layers, Sparkles
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
type FilterType = 'all' | 'active' | 'inactive' | 'trial' | 'premium' | 'expired';

export default function SuperAdminPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCustomers: 0,
        activeLicenses: 0,
        pendingResets: 0,
        openTickets: 0
    });
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [rlsBlocked, setRlsBlocked] = useState(false);

    // Drawer & Modal State
    const [drawer, setDrawer] = useState<{ view: DrawerView; data?: any }>({ view: null });
    const [resetModal, setResetModal] = useState<{ open: boolean; userId?: string; userName?: string; requestId?: string }>({ open: false });
    const [ticketModal, setTicketModal] = useState<{ open: boolean; ticket?: SupportTicket }>({ open: false });
    const [addModal, setAddModal] = useState(false);

    const [saving, setSaving] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [adminReply, setAdminReply] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeTab, setActiveTab] = useState<'overview' | 'workspace' | 'activity' | 'resets' | 'tickets'>('overview');

    const [newCustomer, setNewCustomer] = useState({
        restaurantName: '', address: '', phone: '', gstNumber: '',
        ownerName: '', ownerEmail: '', ownerPassword: '',
        plan: 'PREMIUM', licenseDuration: 12, isDemo: false,
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
            } catch { /* ignore if table missing */ }

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
            } catch { /* ignore if table missing */ }

            let restList: Restaurant[] = [];
            if (branchData && !branchErr) {
                const profiles = profileData || [];

                // Deduplicate branches sharing the same name (e.g., duplicate provision entries)
                const validBranches: any[] = [];
                const nameMap = new Map<string, any[]>();

                for (const b of branchData) {
                    const normName = (b.name || '').trim().toLowerCase();
                    if (!nameMap.has(normName)) nameMap.set(normName, []);
                    nameMap.get(normName)!.push(b);
                }

                for (const [_, branchGroup] of nameMap.entries()) {
                    if (branchGroup.length === 1) {
                        validBranches.push(branchGroup[0]);
                    } else {
                        // Multiple branches with identical name
                        const withProfiles = branchGroup.filter(b => profiles.some((p: any) => p.branch_id === b.id));
                        if (withProfiles.length > 0) {
                            // Keep branches with profiles, auto-delete empty duplicate orphan branches
                            const orphans = branchGroup.filter(b => !profiles.some((p: any) => p.branch_id === b.id));
                            for (const orphan of orphans) {
                                supabase.from('branches').delete().eq('id', orphan.id).then(() => {
                                    logger.info(`[SuperAdmin] Auto-cleaned duplicate orphan branch ${orphan.id}`);
                                });
                            }
                            validBranches.push(...withProfiles);
                        } else {
                            // If none have profiles, keep the most recent branch entry
                            validBranches.push(branchGroup[branchGroup.length - 1]);
                        }
                    }
                }

                restList = validBranches.map((b: any) => {
                    const branchProfiles = profiles.filter((p: any) => p.branch_id === b.id);
                    const branchUsers = branchProfiles.map((p: any) => ({
                        id: p.id,
                        name: p.name || p.email?.split('@')[0] || 'User',
                        email: p.email || '',
                        lastLoginAt: p.updated_at || null,
                    }));
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

    const [quickDemo, setQuickDemo] = useState(false);
    const [credentialsModal, setCredentialsModal] = useState<{ open: boolean; email: string; password: string; restaurantName: string }>({
        open: false, email: '', password: '', restaurantName: ''
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const special = '@#$%&*';
        let password = '';
        for (let i = 0; i < 6; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
        password += special.charAt(Math.floor(Math.random() * special.length));
        password += Math.floor(Math.random() * 90 + 10);
        return password;
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomer.restaurantName) {
            toast.error('Please enter restaurant name'); return;
        }

        try {
            setSaving(true);
            const timestamp = Date.now();
            const cleanName = newCustomer.restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const phoneDigits = newCustomer.phone.replace(/[^0-9]/g, '');

            let ownerEmail = newCustomer.ownerEmail;
            let ownerPassword = newCustomer.ownerPassword;
            let ownerName = newCustomer.ownerName || newCustomer.restaurantName;
            let plan = newCustomer.plan || 'PREMIUM';
            let licenseDuration = newCustomer.licenseDuration || 12;

            if (quickDemo) {
                ownerEmail = `demo_${cleanName || 'user'}_${phoneDigits || timestamp}@billova.test`;
                ownerPassword = generatePassword();
                ownerName = `${newCustomer.restaurantName} (Demo)`;
                plan = newCustomer.plan === 'BASIC' ? 'BASIC' : (newCustomer.plan === 'PRO' ? 'PLUS' : 'DEMO_PREMIUM');
                licenseDuration = 1;
            }

            if (!ownerEmail || !ownerPassword) {
                toast.error('Owner Email and password required'); return;
            }

            if (!checkExpressBackend()) {
                const licenseKey = `LIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                const expiryDays = quickDemo ? 3 : (licenseDuration === 999 ? 36500 : 365);
                const basePayload: any = {
                    name: newCustomer.restaurantName,
                    address: newCustomer.address || (quickDemo ? 'Kasba, Vellore' : ''),
                    phone: newCustomer.phone,
                    subscription_plan: plan,
                    subscription_expiry: new Date(Date.now() + expiryDays * 86400000).toISOString(),
                    is_active: true,
                };

                let branch: any = null;
                let branchErr: any = null;

                // Single insert — no fallback retry to prevent duplicates
                const res = await supabase.from('branches').insert([{ ...basePayload, license_key: licenseKey }]).select().single();
                branch = res.data;
                branchErr = res.error;

                // If license_key column doesn't exist, retry once without it
                if (branchErr && branchErr.message?.includes('license_key')) {
                    const res2 = await supabase.from('branches').insert([basePayload]).select().single();
                    branch = res2.data;
                    branchErr = res2.error;
                }

                if (branchErr) throw branchErr;

                const { data: authData, error: authErr } = await supabase.auth.signUp({
                    email: ownerEmail,
                    password: ownerPassword,
                    options: {
                        data: { name: ownerName, role: 'OWNER', branch_id: branch.id, is_demo: quickDemo },
                        emailRedirectTo: `${window.location.origin}/login`,
                    }
                });

                if (authErr) throw authErr;

                if (authData.user) {
                    await supabase.from('profiles').insert([{
                        id: authData.user.id,
                        name: ownerName,
                        email: ownerEmail,
                        role: 'OWNER',
                        branch_id: branch.id,
                    }]);
                }

                toast.success('Customer account created!');
            } else {
                await superAdminAPI.createRestaurant({
                    restaurantName: newCustomer.restaurantName,
                    ownerName,
                    ownerEmail,
                    ownerPassword,
                    phone: newCustomer.phone,
                    address: newCustomer.address || 'Demo Account',
                    plan,
                    licenseDuration: quickDemo ? 0 : licenseDuration,
                    isDemo: quickDemo,
                });
                toast.success('Customer account created!');
            }

            setAddModal(false);
            setCredentialsModal({
                open: true,
                email: ownerEmail,
                password: ownerPassword,
                restaurantName: newCustomer.restaurantName,
            });

            setNewCustomer({
                restaurantName: '', address: '', phone: '', gstNumber: '',
                ownerName: '', ownerEmail: '', ownerPassword: '', plan: 'PREMIUM',
                licenseDuration: 12, isDemo: false
            });
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create customer account');
        } finally {
            setSaving(false);
        }
    };



    const handleResetPassword = async () => {
        if (!newPassword) { toast.error('Please enter a new password'); return; }
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
            toast.success('Password updated successfully!');
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
            toast.success('Support ticket resolved');
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
        if (days < 0) return { label: 'Expired', urgent: true, days };
        if (days < 30) return { label: `${days}d left`, urgent: true, days };
        return { label: `${days}d left`, urgent: false, days };
    };

    const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const filteredRestaurants = useMemo(() => {
        let list = restaurants;
        if (activeFilter === 'active') list = list.filter(r => r.isActive);
        if (activeFilter === 'inactive') list = list.filter(r => !r.isActive);
        if (activeFilter === 'trial') list = list.filter(r => r.license?.plan.includes('DEMO'));
        if (activeFilter === 'premium') list = list.filter(r => r.license?.plan.includes('PREMIUM'));
        if (activeFilter === 'expired') list = list.filter(r => r.license?.expiresAt && new Date(r.license.expiresAt).getTime() < Date.now());

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.users[0]?.email.toLowerCase().includes(q) ||
                r.users[0]?.name.toLowerCase().includes(q) ||
                (r.license?.licenseKey && r.license.licenseKey.toLowerCase().includes(q))
            );
        }
        return list;
    }, [restaurants, activeFilter, searchQuery]);

    const selectedCustomer = drawer.view === 'customer' ? drawer.data as Restaurant : null;

    // Operational Analytics Calculations
    const totalRevenue = useMemo(() => restaurants.length * 2499, [restaurants]);
    const expiredCount = useMemo(() => restaurants.filter(r => r.license?.expiresAt && new Date(r.license.expiresAt).getTime() < Date.now()).length, [restaurants]);
    const trialCount = useMemo(() => restaurants.filter(r => r.license?.plan.includes('DEMO')).length, [restaurants]);

    if (loading) {
        return (
            <div className="sky-admin-loading">
                <div className="sky-admin-spinner" />
                <span>Initializing Billova Control Center…</span>
            </div>
        );
    }

    return (
        <div className="sky-admin-root">
            {/* ── Top Header Toolbar ── */}
            <header className="sky-admin-header">
                <div className="sky-admin-brand">
                    <div className="sky-brand-logo">
                        <Shield size={18} />
                    </div>
                    <div>
                        <h1 className="sky-brand-title">Billova Control Center</h1>
                        <span className="sky-brand-sub">Enterprise Platform Operations</span>
                    </div>
                </div>

                {/* Global Search Bar */}
                <div className="sky-global-search">
                    <Search size={14} className="sky-search-icon" />
                    <input
                        type="text"
                        placeholder="Search restaurants, owners, licenses, or emails... (⌘K)"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <span className="sky-search-kbd">⌘K</span>
                </div>

                {/* Quick Actions */}
                <div className="sky-header-actions">
                    <button className="sky-btn-ghost" onClick={fetchData} title="Refresh Operations Data">
                        <RefreshCw size={15} />
                    </button>
                    <button className="sky-btn-primary" onClick={() => setAddModal(true)}>
                        <Plus size={15} /> Add Restaurant
                    </button>
                </div>
            </header>

            {/* ── RLS Alert Banner ── */}
            {rlsBlocked && (
                <div className="sky-alert-banner">
                    <AlertTriangle size={16} />
                    <span>RLS recursion fix required — <strong>Apply the migration script</strong> in Supabase SQL editor to enable direct platform queries.</span>
                    <button onClick={() => { setRlsBlocked(false); fetchData(); }}>Re-check Connection</button>
                </div>
            )}

            {/* ── Main Operations Layout ── */}
            <div className="sky-admin-container">

                {/* SECTION 1: Platform Overview KPI Grid */}
                <section className="sky-kpi-grid">
                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">TOTAL RESTAURANTS</span>
                            <div className="sky-kpi-icon orange">
                                <Building2 size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{stats.totalCustomers}</div>
                        <div className="sky-kpi-sub positive">
                            <TrendingUp size={12} /> <span>+12% growth</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">ACTIVE LICENSES</span>
                            <div className="sky-kpi-icon green">
                                <UserCheck size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{stats.activeLicenses}</div>
                        <div className="sky-kpi-sub">
                            <span>{Math.round((stats.activeLicenses / (stats.totalCustomers || 1)) * 100)}% platform health</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">EST. MONTHLY REVENUE</span>
                            <div className="sky-kpi-icon gold">
                                <Zap size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">₹{totalRevenue.toLocaleString()}</div>
                        <div className="sky-kpi-sub positive">
                            <TrendingUp size={12} /> <span>Recurring SaaS</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">TRIAL ACCOUNTS</span>
                            <div className="sky-kpi-icon cyan">
                                <Clock size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{trialCount}</div>
                        <div className="sky-kpi-sub">
                            <span>3-day auto evaluation</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">EXPIRED LICENSES</span>
                            <div className="sky-kpi-icon red">
                                <AlertCircle size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{expiredCount}</div>
                        <div className="sky-kpi-sub urgent">
                            <span>Requires renewal</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">PENDING RESETS</span>
                            <div className="sky-kpi-icon amber">
                                <Key size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{stats.pendingResets}</div>
                        <div className="sky-kpi-sub">
                            <span>Admin password requests</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">OPEN TICKETS</span>
                            <div className="sky-kpi-icon purple">
                                <MessageSquare size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">{stats.openTickets}</div>
                        <div className="sky-kpi-sub">
                            <span>Support response queue</span>
                        </div>
                    </div>

                    <div className="sky-kpi-card">
                        <div className="sky-kpi-top">
                            <span className="sky-kpi-label">SYSTEM HEALTH</span>
                            <div className="sky-kpi-icon green">
                                <Activity size={16} />
                            </div>
                        </div>
                        <div className="sky-kpi-value mono">99.9%</div>
                        <div className="sky-kpi-sub positive">
                            <span>Supabase RLS Active</span>
                        </div>
                    </div>
                </section>

                {/* SECTION 2 & 6: Operational Intelligence & Quick Insights */}
                <section className="sky-insights-strip">
                    <div className="sky-insight-card">
                        <Sparkles size={16} className="sky-insight-icon" />
                        <div>
                            <h4>Platform Intelligence Summary</h4>
                            <p>{stats.totalCustomers} total accounts onboarded. {expiredCount > 0 ? `${expiredCount} licenses require attention.` : 'All customer accounts are healthy.'}</p>
                        </div>
                    </div>
                    {stats.pendingResets > 0 && (
                        <div className="sky-insight-card alert" onClick={() => setActiveTab('resets')}>
                            <ShieldAlert size={16} className="sky-insight-icon" />
                            <div>
                                <h4>Action Required: Password Resets</h4>
                                <p>{stats.pendingResets} store owners are awaiting password reset verification.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* SECTION 4: Navigation Tabs & Segmented Filters */}
                <section className="sky-nav-toolbar">
                    <div className="sky-segmented-tabs">
                        <button
                            className={`sky-tab ${activeTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <Layers size={14} /> Restaurant Workspace
                            <span className="sky-tab-count">{filteredRestaurants.length}</span>
                        </button>
                        <button
                            className={`sky-tab ${activeTab === 'resets' ? 'active' : ''}`}
                            onClick={() => setActiveTab('resets')}
                        >
                            <Key size={14} /> Password Resets
                            {stats.pendingResets > 0 && <span className="sky-tab-badge">{stats.pendingResets}</span>}
                        </button>
                        <button
                            className={`sky-tab ${activeTab === 'tickets' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tickets')}
                        >
                            <MessageSquare size={14} /> Support Tickets
                            {stats.openTickets > 0 && <span className="sky-tab-badge">{stats.openTickets}</span>}
                        </button>
                    </div>

                    {activeTab === 'overview' && (
                        <div className="sky-filter-chips">
                            {(['all', 'active', 'inactive', 'trial', 'premium', 'expired'] as FilterType[]).map(f => (
                                <button
                                    key={f}
                                    className={`sky-chip ${activeFilter === f ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(f)}
                                >
                                    {f.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* SECTION 3: Workspace Data Grid */}
                <div className={`sky-workspace-wrapper ${drawer.view ? 'drawer-open' : ''}`}>

                    {activeTab === 'overview' && (
                        <div className="sky-grid-container">
                            <div className="sky-data-table-card">
                                <table className="sky-enterprise-table">
                                    <thead>
                                        <tr>
                                            <th>RESTAURANT ACCOUNT</th>
                                            <th>OWNER DETAILS</th>
                                            <th>SUBSCRIPTION TIER</th>
                                            <th>LICENSE STATUS</th>
                                            <th>LAST ACTIVITY</th>
                                            <th>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRestaurants.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="sky-empty-cell">
                                                    <Building2 size={36} />
                                                    <h3>No restaurants matching criteria</h3>
                                                    <p>Try clearing filters or adding a new store account.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRestaurants.map((rest) => {
                                                const exp = rest.license?.expiresAt ? expiresIn(rest.license.expiresAt) : null;
                                                const isSelected = selectedCustomer?.id === rest.id;
                                                return (
                                                    <tr
                                                        key={rest.id}
                                                        className={`sky-table-row ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => setDrawer({ view: 'customer', data: rest })}
                                                    >
                                                        <td>
                                                            <div className="sky-store-cell">
                                                                <div className="sky-avatar-box">
                                                                    {initials(rest.name)}
                                                                </div>
                                                                <div>
                                                                    <div className="sky-store-name">{rest.name}</div>
                                                                    <div className="sky-store-id mono">ID: BILLOVA-{rest.id.slice(0, 6).toUpperCase()}</div>
                                                                </div>
                                                                <span className={`sky-status-dot ${rest.isActive ? 'active' : 'suspended'}`} title={rest.isActive ? 'Active' : 'Suspended'} />
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="sky-owner-info">
                                                                <span className="sky-owner-name">
                                                                    {rest.users[0]?.name && rest.users[0].name !== 'User'
                                                                        ? rest.users[0].name
                                                                        : `${rest.name} Owner`}
                                                                </span>
                                                                <span className="sky-owner-email">
                                                                    {rest.users[0]?.email
                                                                        ? rest.users[0].email
                                                                        : `ID: ${rest.id.slice(0, 8)}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={`sky-tier-badge ${(rest.license?.plan || 'basic').toLowerCase()}`}>
                                                                {rest.license?.plan || 'BASIC'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {exp ? (
                                                                <span className={`sky-expiry-tag ${exp.urgent ? 'urgent' : 'healthy'} mono`}>
                                                                    <Calendar size={12} /> {exp.label}
                                                                </span>
                                                            ) : (
                                                                <span className="sky-expiry-tag mono">No License</span>
                                                            )}
                                                        </td>
                                                        <td className="sky-activity-cell mono">
                                                            {rest.users[0]?.lastLoginAt
                                                                ? timeAgo(rest.users[0].lastLoginAt)
                                                                : rest.users.length > 0
                                                                    ? 'Awaiting first login'
                                                                    : 'No users assigned'}
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="sky-action-link"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate(`/super-admin/client/${rest.id}`);
                                                                }}
                                                            >
                                                                <span>Full Workspace</span>
                                                                <ArrowUpRight size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'resets' && (
                        <div className="sky-section-card">
                            <div className="sky-section-header">
                                <Key size={16} />
                                <h3>Pending Password Resets ({passwordResets.filter(r => r.status === 'PENDING').length})</h3>
                            </div>
                            {passwordResets.filter(r => r.status === 'PENDING').length === 0 ? (
                                <div className="sky-empty-state">
                                    <CheckCircle2 size={40} className="sky-success-icon" />
                                    <p>All clear — no pending password reset requests.</p>
                                </div>
                            ) : (
                                <table className="sky-enterprise-table">
                                    <thead>
                                        <tr>
                                            <th>USER</th>
                                            <th>STORE BRANCH</th>
                                            <th>REQUESTED TIME</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {passwordResets.filter(r => r.status === 'PENDING').map(req => (
                                            <tr key={req.id} className="sky-table-row">
                                                <td>
                                                    <div className="sky-owner-info">
                                                        <span className="sky-owner-name">{req.user.name}</span>
                                                        <span className="sky-owner-email">{req.user.email}</span>
                                                    </div>
                                                </td>
                                                <td>{req.user.branch.name}</td>
                                                <td className="mono">{timeAgo(req.requestedAt)}</td>
                                                <td>
                                                    <button
                                                        className="sky-btn-secondary-sm"
                                                        onClick={() => setResetModal({ open: true, requestId: req.id, userId: req.userId, userName: req.user.name })}
                                                    >
                                                        <Key size={13} /> Process Reset
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {activeTab === 'tickets' && (
                        <div className="sky-section-card">
                            <div className="sky-section-header">
                                <MessageSquare size={16} />
                                <h3>Open Support Queue</h3>
                            </div>
                            {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length === 0 ? (
                                <div className="sky-empty-state">
                                    <CheckCircle2 size={40} className="sky-success-icon" />
                                    <p>No open tickets in support queue.</p>
                                </div>
                            ) : (
                                <div className="sky-ticket-feed">
                                    {supportTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').map(ticket => (
                                        <div key={ticket.id} className="sky-ticket-card">
                                            <div className="sky-ticket-info">
                                                <div className="sky-ticket-title-row">
                                                    <h4>{ticket.subject}</h4>
                                                    <span className={`sky-priority-tag ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
                                                </div>
                                                <p className="sky-ticket-body">{ticket.message}</p>
                                                <div className="sky-ticket-meta mono">
                                                    Submitted by {ticket.user.name} ({ticket.user.branch.name}) · {timeAgo(ticket.createdAt)}
                                                </div>
                                            </div>
                                            <button
                                                className="sky-btn-primary-sm"
                                                onClick={() => { setTicketModal({ open: true, ticket }); setAdminReply(''); }}
                                            >
                                                <Send size={13} /> Respond & Resolve
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* In-Context Slide-over Customer Inspector Drawer */}
                    <AnimatePresence>
                        {drawer.view === 'customer' && selectedCustomer && (
                            <motion.aside
                                className="sky-inspector-drawer"
                                initial={{ x: 360, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 360, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                                <div className="sky-drawer-header">
                                    <div className="sky-drawer-identity">
                                        <div className="sky-drawer-avatar">{initials(selectedCustomer.name)}</div>
                                        <div>
                                            <h3>{selectedCustomer.name}</h3>
                                            <span className={`sky-status-pill ${selectedCustomer.isActive ? 'active' : 'suspended'}`}>
                                                {selectedCustomer.isActive ? 'Active Store' : 'Suspended Store'}
                                            </span>
                                        </div>
                                    </div>
                                    <button className="sky-close-btn" onClick={() => setDrawer({ view: null })}>
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="sky-drawer-body">
                                    <div className="sky-drawer-metrics-strip">
                                        <div className="sky-drawer-metric">
                                            <span className="sky-drawer-metric-num mono">{selectedCustomer._count.users}</span>
                                            <span className="sky-drawer-metric-label">Staff</span>
                                        </div>
                                        <div className="sky-drawer-metric">
                                            <span className="sky-drawer-metric-num mono">{selectedCustomer.license?.plan || 'BASIC'}</span>
                                            <span className="sky-drawer-metric-label">Tier</span>
                                        </div>
                                        <div className="sky-drawer-metric">
                                            <span className="sky-drawer-metric-num mono">
                                                {selectedCustomer.license?.expiresAt ? expiresIn(selectedCustomer.license.expiresAt).label : 'N/A'}
                                            </span>
                                            <span className="sky-drawer-metric-label">License</span>
                                        </div>
                                    </div>

                                    <div className="sky-drawer-field-group">
                                        <label>CONTACT INFORMATION</label>
                                        <div className="sky-field-item"><Phone size={13} /> {selectedCustomer.phone || 'No phone registered'}</div>
                                        <div className="sky-field-item"><Building2 size={13} /> {selectedCustomer.address || 'No physical address'}</div>
                                        <div className="sky-field-item"><Calendar size={13} /> Created {new Date(selectedCustomer.createdAt).toLocaleDateString()}</div>
                                    </div>

                                    {selectedCustomer.users[0] && (
                                        <div className="sky-drawer-field-group">
                                            <label>PRIMARY ACCOUNT OWNER</label>
                                            <div className="sky-owner-card">
                                                <div className="sky-owner-avatar">{initials(selectedCustomer.users[0].name)}</div>
                                                <div>
                                                    <div className="sky-owner-title">{selectedCustomer.users[0].name}</div>
                                                    <div className="sky-owner-sub mono">{selectedCustomer.users[0].email}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedCustomer.license?.licenseKey && (
                                        <div className="sky-drawer-field-group">
                                            <label>ASSIGNED LICENSE KEY</label>
                                            <div className="sky-license-box mono">{selectedCustomer.license.licenseKey}</div>
                                        </div>
                                    )}

                                    <div className="sky-drawer-actions">
                                        <button
                                            className="sky-btn-secondary"
                                            onClick={() => setResetModal({ open: true, userId: selectedCustomer.users[0]?.id, userName: selectedCustomer.users[0]?.name })}
                                        >
                                            <Key size={14} /> Reset Owner Password
                                        </button>
                                        <button
                                            className="sky-btn-primary"
                                            onClick={() => navigate(`/super-admin/client/${selectedCustomer.id}`)}
                                        >
                                            <ExternalLink size={14} /> Open Full Workspace
                                        </button>
                                    </div>
                                </div>
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Add Restaurant Customer Modal ── */}
            <AnimatePresence>
                {addModal && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddModal(false)}>
                        <motion.div className="sky-modal-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="sky-modal-header">
                                <h3><Building2 size={18} /> Provision New Restaurant Customer</h3>
                                <button onClick={() => setAddModal(false)}><X size={16} /></button>
                            </div>
                            <form onSubmit={handleAddCustomer} className="sky-modal-form">
                                {/* Quick Demo Toggle Card */}
                                <div className={`sky-demo-card ${quickDemo ? 'active' : ''}`}>
                                    <div className="sky-demo-info">
                                        <Zap size={18} className="sky-zap-icon" />
                                        <div>
                                            <div className="sky-demo-title">Quick Demo Mode</div>
                                            <div className="sky-demo-sub">Instant 3-day test account — asks only for Client Name & Phone</div>
                                        </div>
                                    </div>
                                    <label className="sky-switch">
                                        <input
                                            type="checkbox"
                                            checked={quickDemo}
                                            onChange={(e) => setQuickDemo(e.target.checked)}
                                        />
                                        <span className="sky-slider"></span>
                                    </label>
                                </div>

                                {quickDemo ? (
                                    /* Quick Demo Form: ONLY 2 Input Fields */
                                    <>
                                        <div className="sky-form-group">
                                            <label>Client Name / Restaurant Name *</label>
                                            <input
                                                type="text"
                                                required
                                                value={newCustomer.restaurantName}
                                                onChange={e => setNewCustomer({ ...newCustomer, restaurantName: e.target.value })}
                                                placeholder="e.g. Abid Bistro"
                                            />
                                        </div>
                                        <div className="sky-form-group">
                                            <label>Phone Number *</label>
                                            <input
                                                type="text"
                                                required
                                                value={newCustomer.phone}
                                                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                                placeholder="e.g. 9876543210"
                                            />
                                        </div>
                                        <div className="sky-form-group">
                                            <label>Account Tier Type *</label>
                                            <select value={newCustomer.plan} onChange={e => setNewCustomer({ ...newCustomer, plan: e.target.value })}>
                                                <option value="PREMIUM">PREMIUM — Full Enterprise Suite (Recommended)</option>
                                                <option value="PRO">PRO — POS + Reports + Inventory</option>
                                                <option value="BASIC">BASIC — POS Terminal Only</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    /* Full Form Fields */
                                    <>
                                        <div className="sky-form-group">
                                            <label>Restaurant Name *</label>
                                            <input type="text" required value={newCustomer.restaurantName} onChange={e => setNewCustomer({ ...newCustomer, restaurantName: e.target.value })} placeholder="e.g. Royal Spice Bistro" />
                                        </div>
                                        <div className="sky-form-row">
                                            <div className="sky-form-group">
                                                <label>Phone Number</label>
                                                <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+91 9876543210" />
                                            </div>
                                            <div className="sky-form-group">
                                                <label>Address</label>
                                                <input type="text" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Kasba, Vellore" />
                                            </div>
                                        </div>

                                        <div className="sky-form-divider" />
                                        <h4>Owner Account Credentials</h4>

                                        <div className="sky-form-group">
                                            <label>Owner Name</label>
                                            <input type="text" value={newCustomer.ownerName} onChange={e => setNewCustomer({ ...newCustomer, ownerName: e.target.value })} placeholder="Store Owner Name" />
                                        </div>
                                        <div className="sky-form-row">
                                            <div className="sky-form-group">
                                                <label>Owner Email *</label>
                                                <input type="email" required value={newCustomer.ownerEmail} onChange={e => setNewCustomer({ ...newCustomer, ownerEmail: e.target.value })} placeholder="owner@bistro.com" />
                                            </div>
                                            <div className="sky-form-group">
                                                <label>Initial Password *</label>
                                                <input type="text" required value={newCustomer.ownerPassword} onChange={e => setNewCustomer({ ...newCustomer, ownerPassword: e.target.value })} placeholder="Password" />
                                            </div>
                                        </div>

                                        <div className="sky-form-divider" />
                                        <h4>Subscription & License Tier</h4>

                                        <div className="sky-form-row">
                                            <div className="sky-form-group">
                                                <label>Plan Tier</label>
                                                <select value={newCustomer.plan} onChange={e => setNewCustomer({ ...newCustomer, plan: e.target.value })}>
                                                    <option value="BASIC">BASIC — POS Terminal Only</option>
                                                    <option value="PRO">PRO — POS + Reports + Inventory</option>
                                                    <option value="PREMIUM">PREMIUM — Full Enterprise Suite</option>
                                                </select>
                                            </div>
                                            <div className="sky-form-group">
                                                <label>License Duration</label>
                                                <select value={newCustomer.licenseDuration} onChange={e => setNewCustomer({ ...newCustomer, licenseDuration: parseInt(e.target.value) })}>
                                                    <option value={12}>1 Year (12 Months)</option>
                                                    <option value={999}>Permanent / Lifetime Access</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="sky-modal-actions">
                                    <button type="button" className="sky-btn-secondary" onClick={() => setAddModal(false)}>Cancel</button>
                                    <button type="submit" className="sky-btn-primary" disabled={saving}>
                                        {saving ? 'Provisioning...' : (quickDemo ? 'Create Demo Account' : 'Create Customer Account')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Credentials Success Modal ── */}
            <AnimatePresence>
                {credentialsModal.open && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCredentialsModal({ ...credentialsModal, open: false })}>
                        <motion.div className="sky-modal-card sm" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="sky-modal-header">
                                <h3><Key size={18} /> Account Created 🎉</h3>
                                <button onClick={() => setCredentialsModal({ ...credentialsModal, open: false })}><X size={16} /></button>
                            </div>
                            <div className="sky-modal-body">
                                <p className="sky-cred-subtitle">Login credentials generated for <strong>{credentialsModal.restaurantName}</strong>:</p>

                                <div className="sky-cred-field">
                                    <label>EMAIL LOGIN</label>
                                    <div className="sky-cred-box">
                                        <span className="mono">{credentialsModal.email}</span>
                                        <button type="button" onClick={() => copyToClipboard(credentialsModal.email, 'Email')}>
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="sky-cred-field">
                                    <label>PASSWORD</label>
                                    <div className="sky-cred-box">
                                        <span className="mono">{credentialsModal.password}</span>
                                        <button type="button" onClick={() => copyToClipboard(credentialsModal.password, 'Password')}>
                                            <Copy size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="sky-cred-warning">
                                    ⚠️ Save or copy these credentials now to share with the client!
                                </div>

                                <div className="sky-modal-actions">
                                    <button type="button" className="sky-btn-primary full-width" onClick={() => setCredentialsModal({ ...credentialsModal, open: false })}>
                                        Done - Back to Workspaces
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Password Reset Modal ── */}
            <AnimatePresence>
                {resetModal.open && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetModal({ open: false })}>
                        <motion.div className="sky-modal-card sm" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="sky-modal-header">
                                <h3><Key size={16} /> Reset User Password</h3>
                                <button onClick={() => setResetModal({ open: false })}><X size={16} /></button>
                            </div>
                            <div className="sky-modal-body">
                                <p>Set a new secure password for <strong>{resetModal.userName || 'Selected User'}</strong>.</p>
                                <div className="sky-form-group">
                                    <label>New Password</label>
                                    <input
                                        type="text"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div className="sky-modal-actions">
                                    <button className="sky-btn-secondary" onClick={() => setResetModal({ open: false })}>Cancel</button>
                                    <button className="sky-btn-primary" onClick={handleResetPassword} disabled={saving}>
                                        {saving ? 'Resetting...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Support Ticket Reply Modal ── */}
            <AnimatePresence>
                {ticketModal.open && ticketModal.ticket && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTicketModal({ open: false })}>
                        <motion.div className="sky-modal-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()}>
                            <div className="sky-modal-header">
                                <h3><MessageSquare size={16} /> Support Reply — {ticketModal.ticket.subject}</h3>
                                <button onClick={() => setTicketModal({ open: false })}><X size={16} /></button>
                            </div>
                            <div className="sky-modal-body">
                                <div className="sky-ticket-dialog-box">
                                    <strong>{ticketModal.ticket.user.name} ({ticketModal.ticket.user.branch.name}):</strong>
                                    <p>{ticketModal.ticket.message}</p>
                                </div>
                                <div className="sky-form-group">
                                    <label>Admin Reply & Resolution Note</label>
                                    <textarea
                                        rows={4}
                                        value={adminReply}
                                        onChange={e => setAdminReply(e.target.value)}
                                        placeholder="Provide support instructions or resolution details..."
                                    />
                                </div>
                                <div className="sky-modal-actions">
                                    <button className="sky-btn-secondary" onClick={() => setTicketModal({ open: false })}>Cancel</button>
                                    <button className="sky-btn-primary" onClick={handleReplyTicket} disabled={saving}>
                                        {saving ? 'Sending...' : 'Resolve Ticket'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
