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

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
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
            toast.error('Failed to load data');
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
            toast.error(error.response?.data?.error || 'Failed to create customer');
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
            if (showResetModal.request) {
                await superAdminAPI.completePasswordReset(showResetModal.request.id, newPassword);
            } else if (showResetModal.userId) {
                await superAdminAPI.resetUserPassword(showResetModal.userId, newPassword);
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
            await superAdminAPI.updateSupportTicket(showTicketModal.ticket.id, {
                status: 'RESOLVED',
                adminReply,
            });
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
