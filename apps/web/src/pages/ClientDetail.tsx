// Client Detail Page - Like Billova Medical
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Shield, Ban, Zap, Building2, Key, User, Crown, X, Check } from 'lucide-react';
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

// Available plans for upgrade
const upgradePlans = [
    { id: 'BASIC', name: 'Basic', price: 1000, duration: 12, isLifetime: false },
    { id: 'PRO', name: 'Pro', price: 2000, duration: 12, isLifetime: false },
    { id: 'PREMIUM', name: 'Premium', price: 3000, duration: 12, isLifetime: false },
    { id: 'BASIC_LIFETIME', name: 'Basic Lifetime', price: 5000, duration: 0, isLifetime: true },
    { id: 'PRO_LIFETIME', name: 'Pro Lifetime', price: 7000, duration: 0, isLifetime: true },
    { id: 'PREMIUM_LIFETIME', name: 'Premium Lifetime', price: 10000, duration: 0, isLifetime: true },
];

export default function ClientDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'licenses' | 'branding'>('info');

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
            toast.error('Failed to load client');
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
            toast.success('Client deactivated');
            setShowDeactivateModal(false);
            fetchClient();
        } catch (error: any) {
            toast.error(error?.message || error.response?.data?.error || 'Deactivation failed');
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
            toast.success('Client reactivated');
            fetchClient();
        } catch (error: any) {
            toast.error(error?.message || error.response?.data?.error || 'Reactivation failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpgrade = async () => {
        if (!selectedPlan) {
            toast.error('Please select a plan');
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
            toast.success('Plan upgraded!');
            setShowUpgradeModal(false);
            setSelectedPlan('');
            fetchClient();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Upgrade failed');
        } finally {
            setActionLoading(false);
        }
    };

    const getPlanBadgeClass = (plan: string) => {
        if (plan?.includes('DEMO')) return 'badge-demo';
        if (plan?.includes('PREMIUM')) return 'badge-premium';
        if (plan?.includes('PRO')) return 'badge-pro';
        if (plan?.includes('LIFETIME')) return 'badge-lifetime';
        return 'badge-basic';
    };

    const formatDaysLeft = () => {
        if (!client?.license?.expires_at) return null;
        if (client.license.is_lifetime) return '∞ Lifetime';
        const days = client.daysLeft;
        if (days === null || days === undefined) return null;
        if (days < 0) return 'EXPIRED';
        if (days <= 7) return `${days} days left`;
        return `${days} days left`;
    };

    if (loading) {
        return (
            <div className="client-detail-page">
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading client...</p>
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="client-detail-page">
                <div className="error-state">
                    <p>Client not found</p>
                    <button onClick={() => navigate('/super-admin')}>Go Back</button>
                </div>
            </div>
        );
    }

    return (
        <div className="client-detail-page">
            {/* Upgrade Modal */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="modal upgrade-modal"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                        >
                            <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>
                                <X size={20} />
                            </button>
                            <h2><Crown size={24} /> Upgrade Plan</h2>
                            <p>Select a new plan for {client.name}</p>

                            <div className="plan-options">
                                {upgradePlans.map(plan => (
                                    <div
                                        key={plan.id}
                                        className={`plan-option ${selectedPlan === plan.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedPlan(plan.id)}
                                    >
                                        <span className="plan-name">{plan.name}</span>
                                        <span className="plan-price">₹{plan.price.toLocaleString()}</span>
                                        {selectedPlan === plan.id && <Check size={18} className="check" />}
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-cancel" onClick={() => setShowUpgradeModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-upgrade"
                                    onClick={handleUpgrade}
                                    disabled={actionLoading || !selectedPlan}
                                >
                                    {actionLoading ? <div className="spinner-sm" /> : 'Upgrade Now'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Deactivate Confirmation Modal */}
            <AnimatePresence>
                {showDeactivateModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="modal deactivate-modal"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                        >
                            <div className="warning-icon">
                                <Ban size={32} />
                            </div>
                            <h2>Force Deactivate?</h2>
                            <p>
                                This will immediately suspend <strong>{client.name}</strong>'s access.
                                They won't be able to use the POS until reactivated.
                            </p>

                            <div className="modal-actions">
                                <button className="btn btn-cancel" onClick={() => setShowDeactivateModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={handleForceDeactivate}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? <div className="spinner-sm" /> : 'Yes, Deactivate'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="client-header">
                <button className="back-btn" onClick={() => navigate('/super-admin')}>
                    <ArrowLeft size={18} />
                    Back to Clients
                </button>
            </div>

            {/* Client Card */}
            <motion.div
                className="client-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="client-card-header">
                    <div className="client-info">
                        <h1>{client.name}</h1>
                        <div className="client-meta">
                            <span className="client-id">BILLOVA-{client.id.slice(0, 3).toUpperCase()}</span>
                            <span className={`status-badge ${client.isActive ? 'active' : 'inactive'}`}>
                                {client.isActive ? 'Active' : 'Suspended'}
                            </span>
                        </div>
                    </div>

                    <div className="client-actions">
                        <span className={`plan-badge ${getPlanBadgeClass(client.subscriptionPlan)}`}>
                            {client.subscriptionPlan?.replace('_', ' ') || 'BASIC'}
                        </span>

                        <button
                            className="btn btn-upgrade-action"
                            onClick={() => setShowUpgradeModal(true)}
                        >
                            <Zap size={16} /> Upgrade Plan
                        </button>

                        {client.isActive ? (
                            <button
                                className="btn btn-danger-action"
                                onClick={() => setShowDeactivateModal(true)}
                            >
                                <Ban size={16} /> Force Deactivate
                            </button>
                        ) : (
                            <button
                                className="btn btn-reactivate"
                                onClick={handleReactivate}
                                disabled={actionLoading}
                            >
                                <Shield size={16} /> Reactivate
                            </button>
                        )}

                        {formatDaysLeft() && (
                            <span className={`days-left ${client.daysLeft != null && client.daysLeft <= 7 ? 'warning' : ''}`}>
                                <Clock size={14} /> {formatDaysLeft()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="client-tabs">
                    <button
                        className={`tab ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        <User size={16} /> Info
                    </button>
                    <button
                        className={`tab ${activeTab === 'licenses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('licenses')}
                    >
                        <Key size={16} /> Licenses
                    </button>
                    <button
                        className={`tab ${activeTab === 'branding' ? 'active' : ''}`}
                        onClick={() => setActiveTab('branding')}
                    >
                        <Building2 size={16} /> Branding
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {activeTab === 'info' && (
                        <div className="info-tab">
                            <h3>Client Information</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label>OWNER</label>
                                    <span>{client.owner?.name || '-'}</span>
                                </div>
                                <div className="info-item">
                                    <label>PHONE</label>
                                    <span>{client.phone || client.owner?.phone || '-'}</span>
                                </div>
                                <div className="info-item">
                                    <label>EMAIL</label>
                                    <span>{client.owner?.email || '-'}</span>
                                </div>
                                <div className="info-item">
                                    <label>CITY</label>
                                    <span>{client.city || '-'}</span>
                                </div>
                                <div className="info-item">
                                    <label>GST NUMBER</label>
                                    <span>{client.gstNumber || '-'}</span>
                                </div>
                                <div className="info-item">
                                    <label>FSSAI NUMBER</label>
                                    <span>{client.fssaiNumber || '-'}</span>
                                </div>
                            </div>
                            <div className="info-item full-width">
                                <label>ADDRESS</label>
                                <span>{client.address || '-'}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'licenses' && (
                        <div className="licenses-tab">
                            <h3>License Details</h3>
                            {client.license ? (
                                <div className="license-card">
                                    <div className="license-row">
                                        <label>PLAN</label>
                                        <span className={`plan-badge ${getPlanBadgeClass(client.license.plan)}`}>
                                            {client.license.plan}
                                        </span>
                                    </div>
                                    <div className="license-row">
                                        <label>STATUS</label>
                                        <span className={`status-badge ${client.license.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                                            {client.license.status}
                                        </span>
                                    </div>
                                    <div className="license-row">
                                        <label>EXPIRES</label>
                                        <span>
                                            {client.license.is_lifetime
                                                ? '∞ Lifetime'
                                                : new Date(client.license.expires_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="license-row">
                                        <label>DAYS LEFT</label>
                                        <span className={client.daysLeft != null && client.daysLeft <= 7 ? 'text-warning' : ''}>
                                            {formatDaysLeft() || '-'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="no-license">No license found</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="branding-tab">
                            <h3>Branding Settings</h3>
                            <p className="coming-soon">Custom branding features coming soon...</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
