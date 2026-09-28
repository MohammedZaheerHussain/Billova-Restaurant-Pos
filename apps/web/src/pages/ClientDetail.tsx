// Client Detail Page — 3-Column Enterprise SaaS Workspace (SKYWALK Architecture mapped to Billova Orange)
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Shield, Ban, Zap, Building2, Key,
    Crown, X, Check, Copy, AlertTriangle, RefreshCw,
    Activity, Layers, FileText, Lock, Mail,
    CheckCircle2, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { superAdminAPI } from '../api';
import { hasExpressBackend, getRestaurantDirect, deactivateBranchDirect, reactivateBranchDirect, upgradePlanDirect } from '../lib/superadmin-direct';
import './ClientDetail.css';

interface Client {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    gstNumber?: string;
    fssaiNumber?: string;
    city?: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
    license?: {
        id: string;
        plan: string;
        status: string;
        expires_at: string;
        is_lifetime?: boolean;
        licenseKey?: string;
    };
    daysLeft?: number | null;
    owner?: {
        id: string;
        name: string;
        email: string;
        phone?: string;
    };
    _count?: { orders: number; users: number };
}

const upgradePlans = [
    { id: 'BASIC', name: 'Basic (POS Only)', price: 1000, duration: 12, isLifetime: false },
    { id: 'PRO', name: 'Pro (POS + Reports)', price: 2000, duration: 12, isLifetime: false },
    { id: 'PREMIUM', name: 'Premium (Full Suite)', price: 3000, duration: 12, isLifetime: false },
    { id: 'BASIC_LIFETIME', name: 'Basic Lifetime', price: 5000, duration: 0, isLifetime: true },
    { id: 'PRO_LIFETIME', name: 'Pro Lifetime', price: 7000, duration: 0, isLifetime: true },
    { id: 'PREMIUM_LIFETIME', name: 'Premium Lifetime', price: 10000, duration: 0, isLifetime: true },
];

export default function ClientDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'branches' | 'licenses' | 'branding'>('info');

    // Modals
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (id) fetchClient();
    }, [id]);

    const fetchClient = async () => {
        try {
            setLoading(true);
            if (hasExpressBackend()) {
                const res = await superAdminAPI.getRestaurant(id!);
                setClient(res.data);
            } else {
                const data = await getRestaurantDirect(id!);
                setClient(data as any);
            }
        } catch (error: any) {
            toast.error('Failed to load restaurant workspace');
            navigate('/super-admin');
        } finally {
            setLoading(false);
        }
    };

    const handleForceDeactivate = async () => {
        try {
            setActionLoading(true);
            if (hasExpressBackend()) {
                await superAdminAPI.forceDeactivate(id!);
            } else {
                await deactivateBranchDirect(id!);
            }
            toast.success('Restaurant access suspended');
            setShowDeactivateModal(false);
            fetchClient();
        } catch (error: any) {
            toast.error(error?.message || 'Deactivation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivate = async () => {
        try {
            setActionLoading(true);
            if (hasExpressBackend()) {
                await superAdminAPI.reactivate(id!);
            } else {
                await reactivateBranchDirect(id!);
            }
            toast.success('Restaurant access restored');
            fetchClient();
        } catch (error: any) {
            toast.error(error?.message || 'Reactivation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpgrade = async () => {
        if (!selectedPlan) {
            toast.error('Please select a plan tier');
            return;
        }
        try {
            setActionLoading(true);
            const plan = upgradePlans.find(p => p.id === selectedPlan);
            if (hasExpressBackend()) {
                await superAdminAPI.upgradePlan(id!, {
                    plan: selectedPlan,
                    durationMonths: plan?.duration || 12,
                    isLifetime: plan?.isLifetime || false,
                });
            } else {
                await upgradePlanDirect(id!, {
                    plan: selectedPlan,
                    durationMonths: plan?.duration || 12,
                    isLifetime: plan?.isLifetime || false,
                });
            }
            toast.success('Subscription upgraded successfully!');
            setShowUpgradeModal(false);
            setSelectedPlan('');
            fetchClient();
        } catch (error: any) {
            toast.error('Plan upgrade failed');
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const initials = (name: string) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'ST';

    if (loading) {
        return (
            <div className="sky-client-loading">
                <div className="sky-client-spinner" />
                <p>Loading restaurant workspace...</p>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="sky-client-loading">
                <AlertTriangle size={36} color="var(--danger)" />
                <p>Restaurant account not found</p>
                <button className="sky-btn-primary" onClick={() => navigate('/super-admin')}>Return to Control Center</button>
            </div>
        );
    }

    const licenseKeyDisplay = client.license?.licenseKey || `BLLOVA-${(client.subscriptionPlan || 'PREMIUM').toUpperCase()}-${client.id.slice(0, 8).toUpperCase()}`;

    return (
        <div className="sky-client-root">
            {/* Upgrade Modal */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="sky-modal-card" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
                            <div className="sky-modal-header">
                                <h3><Crown size={20} /> Upgrade Subscription Tier</h3>
                                <button onClick={() => setShowUpgradeModal(false)}><X size={18} /></button>
                            </div>
                            <div className="sky-modal-body">
                                <p>Select a new license plan tier for <strong>{client.name}</strong>:</p>
                                <div className="sky-plan-grid">
                                    {upgradePlans.map(plan => (
                                        <div
                                            key={plan.id}
                                            className={`sky-plan-option ${selectedPlan === plan.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedPlan(plan.id)}
                                        >
                                            <div className="sky-plan-title">{plan.name}</div>
                                            <div className="sky-plan-price mono">₹{plan.price.toLocaleString()}</div>
                                            {selectedPlan === plan.id && <Check size={16} className="sky-plan-check" />}
                                        </div>
                                    ))}
                                </div>
                                <div className="sky-modal-actions">
                                    <button className="sky-btn-secondary" onClick={() => setShowUpgradeModal(false)}>Cancel</button>
                                    <button className="sky-btn-primary" onClick={handleUpgrade} disabled={actionLoading || !selectedPlan}>
                                        {actionLoading ? 'Processing Upgrade...' : 'Confirm Upgrade'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Deactivate Confirmation Modal */}
            <AnimatePresence>
                {showDeactivateModal && (
                    <motion.div className="sky-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="sky-modal-card sm" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
                            <div className="sky-modal-header">
                                <h3 className="danger"><Ban size={20} /> Suspend Restaurant Access?</h3>
                                <button onClick={() => setShowDeactivateModal(false)}><X size={18} /></button>
                            </div>
                            <div className="sky-modal-body">
                                <p>
                                    Are you sure you want to suspend access for <strong>{client.name}</strong>?
                                    Staff members will be logged out of POS terminals immediately.
                                </p>
                                <div className="sky-modal-actions">
                                    <button className="sky-btn-secondary" onClick={() => setShowDeactivateModal(false)}>Cancel</button>
                                    <button className="sky-btn-danger" onClick={handleForceDeactivate} disabled={actionLoading}>
                                        {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Toolbar */}
            <header className="sky-client-header">
                <button className="sky-back-link" onClick={() => navigate('/super-admin')}>
                    <ArrowLeft size={16} /> Back to Control Center
                </button>
                <div className="sky-header-meta">
                    <span className="sky-client-id mono">BLLOVA-ID: {client.id.slice(0, 8).toUpperCase()}</span>
                    <span className={`sky-status-pill ${client.isActive ? 'active' : 'suspended'}`}>
                        {client.isActive ? 'Active Account' : 'Suspended'}
                    </span>
                </div>
            </header>

            {/* Hero Workspace Identity Banner */}
            <section className="sky-hero-panel">
                <div className="sky-hero-main">
                    <div className="sky-hero-avatar">{initials(client.name)}</div>
                    <div className="sky-hero-text">
                        <div className="sky-hero-title-row">
                            <h1 className="sky-hero-title">{client.name}</h1>
                            <span className="sky-hero-plan-tag mono">{client.subscriptionPlan || 'PREMIUM'}</span>
                        </div>
                        <p className="sky-hero-subtitle">
                            Joined {new Date(client.createdAt).toLocaleDateString()} · {client.city || 'Headquarters'} · {client._count?.users || 1} staff accounts
                        </p>
                    </div>
                </div>

                <div className="sky-hero-actions">
                    <button className="sky-btn-primary" onClick={() => setShowUpgradeModal(true)}>
                        <Zap size={15} /> Upgrade Subscription
                    </button>

                    {client.isActive ? (
                        <button className="sky-btn-danger" onClick={() => setShowDeactivateModal(true)}>
                            <Ban size={15} /> Suspend Store Access
                        </button>
                    ) : (
                        <button className="sky-btn-success" onClick={handleReactivate} disabled={actionLoading}>
                            <Shield size={15} /> Restore Store Access
                        </button>
                    )}
                </div>
            </section>

            {/* 3-Column Enterprise Workspace Layout */}
            <main className="sky-client-content">
                <div className="sky-workspace-grid">

                    {/* Column 1: Restaurant Profile & Owner Info */}
                    <div className="sky-col-card">
                        <div className="sky-col-header">
                            <div className="sky-col-header-left">
                                <Building2 size={16} />
                                <h3>Restaurant Profile</h3>
                            </div>
                            <span className="sky-col-badge">Store Details</span>
                        </div>

                        <div className="sky-field-list">
                            <div className="sky-field-item">
                                <label>STORE NAME</label>
                                <span className="sky-field-val strong">{client.name}</span>
                            </div>
                            <div className="sky-field-item">
                                <label>PRIMARY OWNER</label>
                                <span className="sky-field-val highlight">{client.owner?.name || 'Unassigned'}</span>
                            </div>
                            
                            <div className="sky-field-item full">
                                <label>OWNER EMAIL</label>
                                <div className="sky-field-val-row">
                                    <span className="sky-field-val mono email-val">{client.owner?.email || 'N/A'}</span>
                                    {client.owner?.email && (
                                        <button 
                                            className="sky-copy-icon-btn" 
                                            onClick={() => copyToClipboard(client.owner!.email, 'Email')}
                                            title="Copy email address"
                                        >
                                            <Copy size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="sky-field-item">
                                <label>PHONE CONTACT</label>
                                <span className="sky-field-val mono">{client.phone || client.owner?.phone || 'N/A'}</span>
                            </div>
                            <div className="sky-field-item">
                                <label>CITY / REGION</label>
                                <span className="sky-field-val">{client.city || 'Headquarters'}</span>
                            </div>

                            <div className="sky-field-item">
                                <label>GST REGISTRATION</label>
                                <span className="sky-field-val mono">{client.gstNumber || 'Unregistered'}</span>
                            </div>
                            <div className="sky-field-item">
                                <label>FSSAI LICENSE</label>
                                <span className="sky-field-val mono">{client.fssaiNumber || 'Unregistered'}</span>
                            </div>

                            <div className="sky-field-item full">
                                <label>PHYSICAL ADDRESS</label>
                                <span className="sky-field-val address-val">{client.address || 'No physical address configured.'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: License Health & Plan Controls */}
                    <div className="sky-col-card">
                        <div className="sky-col-header">
                            <div className="sky-col-header-left">
                                <Crown size={16} />
                                <h3>Subscription & License Health</h3>
                            </div>
                            <span className={`sky-badge-status ${client.isActive ? 'active' : 'suspended'}`}>
                                {client.isActive ? 'HEALTHY' : 'SUSPENDED'}
                            </span>
                        </div>

                        <div className="sky-license-display">
                            <div className="sky-plan-header">
                                <div>
                                    <span className="sky-plan-label">ACTIVE TIER</span>
                                    <div className="sky-plan-name">{client.subscriptionPlan || 'PREMIUM'} TIER</div>
                                </div>
                                <span className="sky-tier-chip">
                                    <Sparkles size={13} /> Enterprise
                                </span>
                            </div>

                            <div className="sky-key-box">
                                <div className="sky-key-label-row">
                                    <label>ACTIVE LICENSE KEY</label>
                                    <span className="key-verified-tag">VERIFIED</span>
                                </div>
                                <div className="sky-key-row mono">
                                    <span className="key-text">{licenseKeyDisplay}</span>
                                    <button 
                                        className="sky-copy-icon-btn" 
                                        onClick={() => copyToClipboard(licenseKeyDisplay, 'License Key')}
                                        title="Copy License Key"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="sky-stat-row">
                                <div className="sky-mini-stat">
                                    <span className="label">EXPIRATION DATE</span>
                                    <span className="value mono">
                                        {client.license?.is_lifetime
                                            ? '∞ Lifetime'
                                            : (client.license?.expires_at ? new Date(client.license.expires_at).toLocaleDateString() : 'Active')}
                                    </span>
                                </div>
                                <div className="sky-mini-stat">
                                    <span className="label">REMAINING VALIDITY</span>
                                    <span className={`value mono ${client.daysLeft !== undefined && client.daysLeft !== null && client.daysLeft <= 7 ? 'urgent' : ''}`}>
                                        {client.license?.is_lifetime
                                            ? 'Lifetime Access'
                                            : (client.daysLeft !== undefined && client.daysLeft !== null
                                                ? (client.daysLeft < 0 ? 'Expired' : `${client.daysLeft} days remaining`)
                                                : 'Active Plan')}
                                    </span>
                                </div>
                            </div>

                            {/* Plan Capabilities Strip */}
                            <div className="sky-features-preview">
                                <div className="sky-feat-tag"><CheckCircle2 size={12} color="var(--success)" /> POS Terminal</div>
                                <div className="sky-feat-tag"><CheckCircle2 size={12} color="var(--success)" /> Cloud Sync</div>
                                <div className="sky-feat-tag"><CheckCircle2 size={12} color="var(--success)" /> Reports & Analytics</div>
                            </div>

                            <button className="sky-card-sub-btn" onClick={() => setShowUpgradeModal(true)}>
                                <Zap size={14} /> Change Tier / Renew License
                            </button>
                        </div>
                    </div>

                    {/* Column 3: Operational Quick Actions & Telemetry */}
                    <div className="sky-col-card">
                        <div className="sky-col-header">
                            <div className="sky-col-header-left">
                                <Activity size={16} />
                                <h3>Quick Management Actions</h3>
                            </div>
                            <span className="sky-col-badge">Operations</span>
                        </div>

                        <div className="sky-quick-actions-list">
                            <button className="sky-action-btn" onClick={() => copyToClipboard(client.id, 'Store ID')}>
                                <FileText size={15} />
                                <div className="sky-action-btn-text">
                                    <span className="action-title">Copy Store ID</span>
                                    <span className="action-sub mono">{client.id.slice(0, 16)}...</span>
                                </div>
                            </button>

                            {client.owner?.email && (
                                <button className="sky-action-btn" onClick={() => copyToClipboard(client.owner!.email, 'Owner Email')}>
                                    <Mail size={15} />
                                    <div className="sky-action-btn-text">
                                        <span className="action-title">Copy Owner Email</span>
                                        <span className="action-sub">{client.owner.email}</span>
                                    </div>
                                </button>
                            )}

                            <button className="sky-action-btn" onClick={fetchClient}>
                                <RefreshCw size={15} />
                                <div className="sky-action-btn-text">
                                    <span className="action-title">Refresh Store Telemetry</span>
                                    <span className="action-sub">Sync live database metrics</span>
                                </div>
                            </button>

                            {client.isActive ? (
                                <button className="sky-action-btn danger" onClick={() => setShowDeactivateModal(true)}>
                                    <Lock size={15} />
                                    <div className="sky-action-btn-text">
                                        <span className="action-title">Lock Store Access</span>
                                        <span className="action-sub">Suspend POS & staff logins</span>
                                    </div>
                                </button>
                            ) : (
                                <button className="sky-action-btn success" onClick={handleReactivate} disabled={actionLoading}>
                                    <Shield size={15} />
                                    <div className="sky-action-btn-text">
                                        <span className="action-title">Restore Store Access</span>
                                        <span className="action-sub">Enable POS terminals</span>
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* Operational Status Box */}
                        <div className="sky-telemetry-box">
                            <div className="sky-telemetry-row">
                                <span className="telemetry-label">SYSTEM HEALTH</span>
                                <span className="telemetry-val positive">
                                    <span className="live-dot" /> Operational
                                </span>
                            </div>
                            <div className="sky-telemetry-row">
                                <span className="telemetry-label">STAFF ACCOUNTS</span>
                                <span className="telemetry-val mono">{client._count?.users || 1} active</span>
                            </div>
                            <div className="sky-telemetry-row">
                                <span className="telemetry-label">TOTAL ORDERS</span>
                                <span className="telemetry-val mono">{client._count?.orders || 0} processed</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-workspace Navigation Tabs */}
                <div className="sky-workspace-tabs">
                    <button
                        className={`sky-wtab ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        <Building2 size={14} /> General Overview
                    </button>
                    <button
                        className={`sky-wtab ${activeTab === 'branches' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branches')}
                    >
                        <Layers size={14} /> Branches & Terminals ({client._count?.users || 1})
                    </button>
                    <button
                        className={`sky-wtab ${activeTab === 'licenses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('licenses')}
                    >
                        <Key size={14} /> License Details
                    </button>
                    <button
                        className={`sky-wtab ${activeTab === 'branding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branding')}
                    >
                        <FileText size={14} /> Branding & Config
                    </button>
                </div>

                {/* Tabbed Sub-workspace Content */}
                <div className="sky-wtab-content">
                    {activeTab === 'info' && (
                        <div className="sky-wtab-pane">
                            <h4>Store System Information</h4>
                            <div className="sky-info-grid">
                                <div className="sky-info-tile">
                                    <label>STORE ID</label>
                                    <div className="sky-tile-val-row">
                                        <span className="mono tile-val break-all">{client.id}</span>
                                        <button className="sky-copy-mini" onClick={() => copyToClipboard(client.id, 'Store ID')} title="Copy ID">
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div className="sky-info-tile">
                                    <label>REGISTERED DATE</label>
                                    <span className="mono tile-val">{new Date(client.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="sky-info-tile">
                                    <label>TOTAL REGISTERED USERS</label>
                                    <span className="mono tile-val">{client._count?.users || 1} staff accounts</span>
                                </div>
                                <div className="sky-info-tile">
                                    <label>TOTAL ORDERS PROCESSED</label>
                                    <span className="mono tile-val">{client._count?.orders || 0} orders</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'branches' && (
                        <div className="sky-wtab-pane">
                            <h4>Configured Store Branches</h4>
                            <div className="sky-branch-card">
                                <div className="sky-branch-header">
                                    <div className="sky-branch-icon">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <div className="title">{client.name} (Main Branch)</div>
                                        <div className="sub mono">Address: {client.address || 'Kasba, Vellore'}</div>
                                    </div>
                                </div>
                                <span className="sky-badge-status active">ONLINE</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'licenses' && (
                        <div className="sky-wtab-pane">
                            <h4>Detailed License Registry</h4>
                            <div className="sky-license-card-detail">
                                <div className="row">
                                    <label>PLAN TIER</label>
                                    <span className="value mono">{client.license?.plan || client.subscriptionPlan || 'PREMIUM'}</span>
                                </div>
                                <div className="row">
                                    <label>LICENSE KEY</label>
                                    <span className="value mono">{licenseKeyDisplay}</span>
                                </div>
                                <div className="row">
                                    <label>STATUS</label>
                                    <span className="value mono">{client.license?.status || (client.isActive ? 'ACTIVE' : 'SUSPENDED')}</span>
                                </div>
                                <div className="row">
                                    <label>EXPIRATION</label>
                                    <span className="value mono">
                                        {client.license?.is_lifetime
                                            ? '∞ Lifetime'
                                            : (client.license?.expires_at ? new Date(client.license.expires_at).toLocaleString() : 'Active')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="sky-wtab-pane">
                            <h4>Store Branding & Receipt Customization</h4>
                            <p className="empty-text">Custom receipt logos, currency formats, and POS print headers configured directly in Store Settings.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

