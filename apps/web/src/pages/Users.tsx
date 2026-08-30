import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users as UsersIcon, Plus, Edit2, Trash2, Shield, X,
    Search, Mail, Phone, Key, Crown, ChefHat, CreditCard,
    CheckCircle2, UserCheck, Bike
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersAPI } from '../api';
import useSubscription from '../hooks/useSubscription';
import './Users.css';

interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    isActive: boolean;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'CASHIER',
    });

    const { planConfig, canAddUser, currentPlan } = useSubscription();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await usersAPI.getAll();
            setUsers(response.data || []);
        } catch (error) {
            toast.error('Failed to load team members');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
            toast.error('Please fill all required fields');
            return;
        }

        if (!canAddUser(users.length)) {
            toast.error(`Your ${currentPlan} plan allows up to ${planConfig.maxUsers} staff members. Upgrade to add more!`);
            return;
        }

        try {
            setSaving(true);
            await usersAPI.create(newUser);
            toast.success('Employee added successfully!');
            setShowAddModal(false);
            setNewUser({ name: '', email: '', phone: '', password: '', role: 'CASHIER' });
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to add employee');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            await usersAPI.delete(userId);
            toast.success('Employee removed successfully');
            setDeleteConfirmId(null);
            fetchUsers();
        } catch (error) {
            toast.error('Failed to delete employee');
        }
    };

    const getRoleDetails = (role: string) => {
        switch (role) {
            case 'OWNER':
                return { label: 'Owner', icon: Crown, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', permissions: ['Full System Access', 'Financial Reports', 'Settings & Billing'] };
            case 'MANAGER':
                return { label: 'Manager', icon: Shield, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)', permissions: ['POS Operations', 'Inventory & Menu', 'Shift Management'] };
            case 'CASHIER':
                return { label: 'Cashier', icon: CreditCard, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', permissions: ['POS Billing', 'Table Orders', 'Cash Handling'] };
            case 'KITCHEN':
                return { label: 'Kitchen Staff', icon: ChefHat, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', permissions: ['KDS Display', 'Order Prep', 'Item Status'] };
            case 'CAPTAIN':
                return { label: 'Captain / Waiter', icon: UserCheck, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', permissions: ['Table Ordering', 'Kot Generation', 'Guest Requests'] };
            case 'DELIVERY':
                return { label: 'Delivery Rider', icon: Bike, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', permissions: ['Delivery Tracking', 'Order Status'] };
            default:
                return { label: role, icon: Shield, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.3)', permissions: ['Standard Access'] };
        }
    };

    // Filter counts
    const ownerCount = useMemo(() => users.filter(u => u.role === 'OWNER').length, [users]);
    const managerCount = useMemo(() => users.filter(u => u.role === 'MANAGER').length, [users]);
    const cashierCount = useMemo(() => users.filter(u => u.role === 'CASHIER').length, [users]);
    const kitchenCount = useMemo(() => users.filter(u => u.role === 'KITCHEN').length, [users]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (u.phone && u.phone.includes(searchTerm));
            const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, roleFilter]);

    const canAdd = canAddUser(users.length);
    const limitText = planConfig.maxUsers === Infinity
        ? 'Unlimited staff'
        : `${users.length} of ${planConfig.maxUsers} staff active`;

    return (
        <div className="users-page">
            {/* ── Header Toolbar (Icebox Style) ── */}
            <div className="page-header">
                <div className="header-left">
                    <h1>Team & Permissions</h1>
                    <span className="team-limit-chip">
                        <span className={`status-indicator ${canAdd ? 'healthy' : 'warning'}`} />
                        {limitText}
                    </span>
                </div>

                <div className="header-actions">
                    {/* Search Box */}
                    <div className="users-search-box">
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Role Filter Tabs */}
                    <div className="filter-tabs">
                        <button
                            className={`filter-tab ${roleFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('ALL')}
                        >
                            All ({users.length})
                        </button>
                        <button
                            className={`filter-tab ${roleFilter === 'OWNER' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('OWNER')}
                        >
                            Owners ({ownerCount})
                        </button>
                        <button
                            className={`filter-tab ${roleFilter === 'MANAGER' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('MANAGER')}
                        >
                            Managers ({managerCount})
                        </button>
                        <button
                            className={`filter-tab ${roleFilter === 'CASHIER' ? 'active' : ''}`}
                            onClick={() => setRoleFilter('CASHIER')}
                        >
                            Cashiers ({cashierCount})
                        </button>
                        {kitchenCount > 0 && (
                            <button
                                className={`filter-tab ${roleFilter === 'KITCHEN' ? 'active' : ''}`}
                                onClick={() => setRoleFilter('KITCHEN')}
                            >
                                Kitchen ({kitchenCount})
                            </button>
                        )}
                    </div>

                    {/* Add Employee Button */}
                    <button
                        className="btn btn-primary add-user-btn"
                        onClick={() => canAdd ? setShowAddModal(true) : toast.error(`Upgrade to add more team members`)}
                    >
                        <Plus size={16} />
                        <span>Add Employee</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content Area ── */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon-box">
                        <UsersIcon size={40} strokeWidth={1.5} />
                    </div>
                    <h3>{users.length === 0 ? 'No Team Members Configured' : 'No Matching Employees'}</h3>
                    <p>
                        {users.length === 0
                            ? 'Add your cashiers, managers, and kitchen staff to grant tailored role permissions and secure multi-user access.'
                            : `No team members found matching "${searchTerm || roleFilter}". Try resetting your filter.`}
                    </p>
                    {users.length === 0 ? (
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 8 }}>
                            <Plus size={16} /> Add First Employee
                        </button>
                    ) : (
                        <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setRoleFilter('ALL'); }} style={{ marginTop: 8 }}>
                            Clear Search
                        </button>
                    )}
                </div>
            ) : (
                <div className="users-grid">
                    {filteredUsers.map((u) => {
                        const roleInfo = getRoleDetails(u.role);
                        const RoleIcon = roleInfo.icon;

                        return (
                            <motion.div
                                key={u.id}
                                className="user-card"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.16 }}
                            >
                                <div className="user-card-header">
                                    <div className="user-avatar-wrap">
                                        <div
                                            className="user-avatar-circle"
                                            style={{ backgroundColor: roleInfo.bg, borderColor: roleInfo.border, color: roleInfo.color }}
                                        >
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="user-active-dot" />
                                    </div>

                                    <div className="user-card-actions">
                                        <button className="user-icon-btn edit" title="Edit Employee Permissions">
                                            <Edit2 size={14} />
                                        </button>
                                        {u.role !== 'OWNER' && (
                                            <button
                                                className="user-icon-btn delete"
                                                onClick={() => setDeleteConfirmId(u.id)}
                                                title="Remove Employee"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="user-card-body">
                                    <h3 className="user-name">{u.name}</h3>

                                    <div className="user-contact-row">
                                        <span className="contact-item">
                                            <Mail size={12} />
                                            <span className="truncate">{u.email}</span>
                                        </span>
                                        {u.phone && (
                                            <span className="contact-item">
                                                <Phone size={12} />
                                                <span>{u.phone}</span>
                                            </span>
                                        )}
                                    </div>

                                    <span
                                        className="role-pill-badge"
                                        style={{ backgroundColor: roleInfo.bg, color: roleInfo.color, borderColor: roleInfo.border }}
                                    >
                                        <RoleIcon size={12} />
                                        <span>{roleInfo.label}</span>
                                    </span>
                                </div>

                                <div className="user-permissions-box">
                                    <span className="permissions-label">Access Scope:</span>
                                    <div className="permissions-tags">
                                        {roleInfo.permissions.map((perm, idx) => (
                                            <span key={idx} className="permission-tag">
                                                <CheckCircle2 size={10} />
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Add Employee Modal (Icebox Dialog) ── */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            className="modal add-user-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <div className="modal-header-title">
                                    <div className="modal-icon-badge">
                                        <UsersIcon size={18} />
                                    </div>
                                    <div>
                                        <h2>Add Team Member</h2>
                                        <p className="modal-subtitle">Create a new staff login and assign operational role</p>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="user-form">
                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <div className="input-with-icon">
                                        <UsersIcon size={15} className="input-icon" />
                                        <input
                                            type="text"
                                            value={newUser.name}
                                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                            placeholder="e.g. Alex Sharma"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="form-row-dual">
                                    <div className="form-group">
                                        <label>Email Address *</label>
                                        <div className="input-with-icon">
                                            <Mail size={15} className="input-icon" />
                                            <input
                                                type="email"
                                                value={newUser.email}
                                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                                placeholder="alex@restaurant.com"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Phone Number</label>
                                        <div className="input-with-icon">
                                            <Phone size={15} className="input-icon" />
                                            <input
                                                type="text"
                                                value={newUser.phone}
                                                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Initial Login Password *</label>
                                    <div className="input-with-icon">
                                        <Key size={15} className="input-icon" />
                                        <input
                                            type="password"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            placeholder="Create a strong password"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Assign Role & Access Level</label>
                                    <div className="role-selector-grid">
                                        {[
                                            { role: 'CASHIER', label: 'Cashier', icon: CreditCard, desc: 'POS billing, cash drawer & orders' },
                                            { role: 'MANAGER', label: 'Manager', icon: Shield, desc: 'Inventory, menu & staff management' },
                                            { role: 'KITCHEN', label: 'Kitchen', icon: ChefHat, desc: 'KDS display & preparation status' },
                                            { role: 'CAPTAIN', label: 'Captain', icon: UserCheck, desc: 'Table ordering & guest service' },
                                        ].map((r) => {
                                            const IconComp = r.icon;
                                            const isSelected = newUser.role === r.role;
                                            return (
                                                <button
                                                    key={r.role}
                                                    type="button"
                                                    className={`role-select-card ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => setNewUser({ ...newUser, role: r.role })}
                                                >
                                                    <div className="role-card-top">
                                                        <IconComp size={16} />
                                                        <span className="role-card-label">{r.label}</span>
                                                    </div>
                                                    <span className="role-card-desc">{r.desc}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="spinner" /> : (
                                            <>
                                                <Plus size={16} />
                                                <span>Add Member</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Delete Confirmation Modal ── */}
            <AnimatePresence>
                {deleteConfirmId && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDeleteConfirmId(null)}
                    >
                        <motion.div
                            className="modal delete-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="delete-content">
                                <div className="delete-icon-box">
                                    <Trash2 size={28} />
                                </div>
                                <h3>Remove Employee?</h3>
                                <p>Are you sure you want to remove this staff member? Their login access will be revoked immediately.</p>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                                    Cancel
                                </button>
                                <button className="btn btn-danger" onClick={() => handleDeleteUser(deleteConfirmId)}>
                                    Remove Staff
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
