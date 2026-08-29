// Users Management Page
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users as UsersIcon, Plus, Edit2, Trash2, Shield, X } from 'lucide-react';
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
    const [showAddModal, setShowAddModal] = useState(false);
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
            setUsers(response.data);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newUser.name || !newUser.email || !newUser.password) {
            toast.error('Please fill all required fields');
            return;
        }

        // Check subscription limit
        if (!canAddUser(users.length)) {
            toast.error(`Your ${currentPlan} plan allows only ${planConfig.maxUsers} employees. Upgrade to add more!`);
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
        if (!confirm('Are you sure you want to delete this employee?')) return;

        try {
            await usersAPI.delete(userId);
            toast.success('Employee deleted');
            fetchUsers();
        } catch (error) {
            toast.error('Failed to delete employee');
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'OWNER': return '#dc2626';
            case 'MANAGER': return '#8b5cf6';
            case 'CASHIER': return '#3b82f6';
            case 'KITCHEN': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    const canAdd = canAddUser(users.length);
    const limitText = planConfig.maxUsers === Infinity
        ? 'Unlimited employees'
        : `${users.length}/${planConfig.maxUsers} employees`;

    return (
        <div className="users-page">
            <div className="page-header">
                <div>
                    <h1>Team & Permissions</h1>
                    <p>Manage staff accounts • <span style={{ color: canAdd ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{limitText}</span></p>
                </div>
                <button
                    className={`btn ${canAdd ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => canAdd ? setShowAddModal(true) : toast.error(`Upgrade to ${currentPlan === 'BASIC' ? 'Plus' : 'Premium'} to add more employees`)}
                >
                    <Plus size={16} /> Add Employee
                </button>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /></div>
            ) : users.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon-box">
                        <UsersIcon size={42} strokeWidth={1.5} />
                    </div>
                    <h3>No Team Members Yet</h3>
                    <p>Add your staff members to assign cashiers, managers, and kitchen staff roles</p>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 8 }}>
                        <Plus size={16} /> Add First Employee
                    </button>
                </div>
            ) : (
                <div className="users-grid">
                    {users.map((u) => (
                        <div key={u.id} className="user-card">
                            <div className="user-avatar">
                                {u.name.charAt(0)}
                            </div>
                            <div className="user-info">
                                <h3>{u.name}</h3>
                                <p>{u.email}</p>
                                <span
                                    className="role-badge"
                                    style={{
                                        backgroundColor: `${getRoleBadgeColor(u.role)}18`,
                                        color: getRoleBadgeColor(u.role),
                                        border: `1px solid ${getRoleBadgeColor(u.role)}33`
                                    }}
                                >
                                    <Shield size={11} />
                                    {u.role.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="user-actions">
                                <button className="btn-action-icon edit" title="Edit user">
                                    <Edit2 size={15} />
                                </button>
                                {u.role !== 'OWNER' && (
                                    <button className="btn-action-icon delete" onClick={() => handleDeleteUser(u.id)} title="Delete user">
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add User Modal */}
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
                            className="modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2><UsersIcon size={20} /> Add Employee</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddUser} className="modal-form">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                        placeholder="Employee name"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            value={newUser.email}
                                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            type="text"
                                            value={newUser.phone}
                                            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                            placeholder="+91 9876543210"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input
                                            type="text"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            placeholder="Initial password"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Role</label>
                                        <select
                                            value={newUser.role}
                                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        >
                                            <option value="CASHIER">Cashier</option>
                                            <option value="KITCHEN">Kitchen Staff</option>
                                            <option value="MANAGER">Manager</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="spinner" /> : 'Add Employee'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

