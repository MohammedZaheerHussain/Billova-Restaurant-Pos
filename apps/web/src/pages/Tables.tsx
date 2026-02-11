// Tables Page - Dine-in table management
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trash2, X, QrCode, Copy, ExternalLink, Grid3X3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { tablesAPI } from '../api';
import './Tables.css';

interface Table {
    id: string;
    name: string;
    capacity: number;
    status: string;
    qrToken?: string;
    orders?: any[];
}

export default function TablesPage() {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [newTable, setNewTable] = useState({ name: '', capacity: 4 });
    const [saving, setSaving] = useState(false);
    const [qrModal, setQrModal] = useState<{ tableId: string; tableName: string; qrUrl: string } | null>(null);

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            setLoading(true);
            const response = await tablesAPI.getAll();
            setTables(response.data);
        } catch (error) {
            toast.error('Failed to load tables');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (tableId: string, status: string) => {
        try {
            await tablesAPI.updateStatus(tableId, status);
            fetchTables();
            toast.success('Table status updated');
        } catch (error) {
            toast.error('Failed to update table');
        }
    };

    const handleAddTable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTable.name.trim()) {
            toast.error('Table name is required');
            return;
        }
        try {
            setSaving(true);
            await tablesAPI.create(newTable);
            toast.success('Table added!');
            setShowAddModal(false);
            setNewTable({ name: '', capacity: 4 });
            fetchTables();
        } catch (error) {
            toast.error('Failed to add table');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTable = async (tableId: string) => {
        try {
            await tablesAPI.delete(tableId);
            toast.success('Table deleted');
            setDeleteConfirm(null);
            fetchTables();
        } catch (error) {
            toast.error('Failed to delete table');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'EMPTY': return '#22c55e';
            case 'OCCUPIED': return '#dc2626';
            case 'RESERVED': return '#f59e0b';
            case 'CLEANING': return '#6b7280';
            default: return '#6b7280';
        }
    };

    const handleGenerateQR = async (tableId: string, tableName: string) => {
        try {
            const response = await tablesAPI.generateQRToken(tableId);
            setQrModal({ tableId, tableName, qrUrl: response.data.qrUrl });
            fetchTables();
        } catch (error) {
            toast.error('Failed to generate QR code');
        }
    };

    const copyQRUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success('URL copied to clipboard!');
    };

    return (
        <div className="tables-page">
            <div className="page-header">
                <div>
                    <h1>Tables</h1>
                    <p>Manage dine-in tables ({tables.length} tables)</p>
                </div>
                <div className="header-actions">
                    <div className="table-legend">
                        <span className="legend-item"><span style={{ background: '#22c55e' }} /> Empty</span>
                        <span className="legend-item"><span style={{ background: '#dc2626' }} /> Occupied</span>
                        <span className="legend-item"><span style={{ background: '#f59e0b' }} /> Reserved</span>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Add Table
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                </div>
            ) : tables.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
                    <Grid3X3 size={48} strokeWidth={1} />
                    <p style={{ marginTop: 12, fontSize: 15, color: 'var(--text-secondary)' }}>No tables configured yet</p>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "Add Table" to set up your dine-in area</span>
                </div>
            ) : (
                <div className="tables-grid">
                    {tables.map((table) => (
                        <motion.div
                            key={table.id}
                            className="table-card"
                            style={{ borderColor: getStatusColor(table.status) }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02 }}
                        >
                            <div className="table-header">
                                <span className="table-name">{table.name}</span>
                                <span
                                    className="table-status"
                                    style={{ backgroundColor: getStatusColor(table.status) }}
                                >
                                    {table.status}
                                </span>
                            </div>

                            <div className="table-info">
                                <span><Users size={16} /> {table.capacity} seats</span>
                            </div>

                            {table.orders && table.orders.length > 0 && (
                                <div className="table-order">
                                    <span className="order-amount">₹{table.orders[0].total}</span>
                                    <span className="order-items">{table.orders[0].items.length} items</span>
                                </div>
                            )}

                            <div className="table-actions">
                                <button
                                    className="btn btn-sm btn-qr"
                                    onClick={() => handleGenerateQR(table.id, table.name)}
                                    title="Generate QR for Self-Order"
                                >
                                    <QrCode size={14} />
                                </button>
                                {table.status === 'EMPTY' && (
                                    <>
                                        <button className="btn btn-sm" onClick={() => handleStatusChange(table.id, 'OCCUPIED')}>
                                            Occupy
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(table.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                                {table.status === 'OCCUPIED' && (
                                    <button className="btn btn-sm" onClick={() => handleStatusChange(table.id, 'CLEANING')}>
                                        Clear
                                    </button>
                                )}
                                {table.status === 'CLEANING' && (
                                    <button className="btn btn-sm btn-success" onClick={() => handleStatusChange(table.id, 'EMPTY')}>
                                        Ready
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add Table Modal */}
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
                            className="modal table-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>Add New Table</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddTable} className="table-form">
                                <div className="form-group">
                                    <label>Table Name *</label>
                                    <input
                                        type="text"
                                        value={newTable.name}
                                        onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                                        placeholder="e.g., Table 1, Outdoor 1, VIP 1"
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Seating Capacity</label>
                                    <div className="capacity-selector">
                                        {[2, 4, 6, 8, 10, 12].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                className={`capacity-btn ${newTable.capacity === num ? 'active' : ''}`}
                                                onClick={() => setNewTable({ ...newTable, capacity: num })}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="spinner" /> : 'Add Table'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirm && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDeleteConfirm(null)}
                    >
                        <motion.div
                            className="modal delete-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="delete-content">
                                <Trash2 size={48} className="delete-icon" />
                                <h3>Delete Table?</h3>
                                <p>This will permanently remove this table from your restaurant.</p>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                                    Cancel
                                </button>
                                <button className="btn btn-danger" onClick={() => handleDeleteTable(deleteConfirm)}>
                                    Delete Table
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* QR Code Modal */}
            <AnimatePresence>
                {qrModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setQrModal(null)}
                    >
                        <motion.div
                            className="modal qr-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>QR Code for {qrModal.tableName}</h2>
                                <button className="modal-close" onClick={() => setQrModal(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="qr-content">
                                <div className="qr-image">
                                    <QrCode size={120} />
                                </div>
                                <p className="qr-instructions">
                                    Scan this QR code or share the link below for customers to place orders directly from their phones.
                                </p>
                                <div className="qr-url-box">
                                    <input type="text" value={qrModal.qrUrl} readOnly />
                                    <button className="btn btn-sm" onClick={() => copyQRUrl(qrModal.qrUrl)}>
                                        <Copy size={16} />
                                    </button>
                                    <button className="btn btn-sm" onClick={() => window.open(qrModal.qrUrl, '_blank')}>
                                        <ExternalLink size={16} />
                                    </button>
                                </div>
                                <p className="qr-tip">
                                    💡 Print this QR code and place it on the table for contactless ordering!
                                </p>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setQrModal(null)}>
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
