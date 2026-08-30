// Tables Page - Dine-in table management (Icebox POS Standard)
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Plus, Trash2, X, QrCode, Copy, ExternalLink,
    Grid3X3, Search, CheckCircle2, RotateCcw, Sparkles
} from 'lucide-react';
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
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
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
            setTables(response.data || []);
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
            toast.success(`Table marked as ${status.toLowerCase()}`);
        } catch (error) {
            toast.error('Failed to update table status');
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
            toast.success('Table added successfully!');
            setShowAddModal(false);
            setNewTable({ name: '', capacity: 4 });
            fetchTables();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to add table');
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

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'EMPTY':
                return { label: 'Available', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)' };
            case 'OCCUPIED':
                return { label: 'Occupied', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
            case 'RESERVED':
                return { label: 'Reserved', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
            case 'CLEANING':
                return { label: 'Cleaning', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' };
            default:
                return { label: status, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.3)' };
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

    // Filter counts
    const emptyCount = useMemo(() => tables.filter(t => t.status === 'EMPTY').length, [tables]);
    const occupiedCount = useMemo(() => tables.filter(t => t.status === 'OCCUPIED').length, [tables]);
    const reservedCount = useMemo(() => tables.filter(t => t.status === 'RESERVED').length, [tables]);
    const cleaningCount = useMemo(() => tables.filter(t => t.status === 'CLEANING').length, [tables]);

    const filteredTables = useMemo(() => {
        return tables.filter(table => {
            const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                table.status.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'ALL' || table.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tables, searchTerm, statusFilter]);

    const occupancyRate = tables.length > 0 ? Math.round((occupiedCount / tables.length) * 100) : 0;

    return (
        <div className="tables-page">
            {/* ── Page Header Toolbar (Icebox Style) ── */}
            <div className="page-header">
                <div className="header-left">
                    <h1>Tables & Floor Plan</h1>
                    <span className="tables-count-sub">
                        {tables.length} {tables.length === 1 ? 'table' : 'tables'}
                        {tables.length > 0 && ` · ${occupiedCount} occupied (${occupancyRate}%)`}
                    </span>
                </div>

                <div className="header-actions">
                    {/* Search Box */}
                    <div className="tables-search-box">
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter Pill Tabs */}
                    <div className="filter-tabs">
                        <button
                            className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('ALL')}
                        >
                            All ({tables.length})
                        </button>
                        <button
                            className={`filter-tab ${statusFilter === 'EMPTY' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('EMPTY')}
                        >
                            <span className="status-dot-mini empty" />
                            Available ({emptyCount})
                        </button>
                        <button
                            className={`filter-tab ${statusFilter === 'OCCUPIED' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('OCCUPIED')}
                        >
                            <span className="status-dot-mini occupied" />
                            Occupied ({occupiedCount})
                        </button>
                        <button
                            className={`filter-tab ${statusFilter === 'RESERVED' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('RESERVED')}
                        >
                            <span className="status-dot-mini reserved" />
                            Reserved ({reservedCount})
                        </button>
                        {cleaningCount > 0 && (
                            <button
                                className={`filter-tab ${statusFilter === 'CLEANING' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('CLEANING')}
                            >
                                <span className="status-dot-mini cleaning" />
                                Cleaning ({cleaningCount})
                            </button>
                        )}
                    </div>

                    {/* Add Table Button */}
                    <button className="btn btn-primary add-table-btn" onClick={() => setShowAddModal(true)}>
                        <Plus size={16} />
                        <span>Add Table</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content / Grid ── */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                </div>
            ) : filteredTables.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon-box">
                        <Grid3X3 size={40} strokeWidth={1.5} />
                    </div>
                    <h3>{tables.length === 0 ? 'No Tables Configured' : 'No Matching Tables'}</h3>
                    <p>
                        {tables.length === 0
                            ? 'Set up your dine-in floor plan to manage seating, track occupied tables, and generate self-ordering QR codes.'
                            : `No tables found matching "${searchTerm || statusFilter}". Try adjusting your filters.`}
                    </p>
                    {tables.length === 0 ? (
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 8 }}>
                            <Plus size={16} /> Add First Table
                        </button>
                    ) : (
                        <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }} style={{ marginTop: 8 }}>
                            <RotateCcw size={14} /> Clear Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="tables-grid">
                    {filteredTables.map((table) => {
                        const statusInfo = getStatusInfo(table.status);
                        const hasActiveOrders = Boolean(table.orders && table.orders.length > 0);
                        const activeOrder = table.orders?.[0];
                        const runningTotal = activeOrder ? Number(activeOrder.total || 0) : 0;
                        const runningItemsCount = activeOrder?.items ? activeOrder.items.length : 0;

                        return (
                            <motion.div
                                key={table.id}
                                className={`table-card status-${table.status.toLowerCase()}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.16 }}
                            >
                                <div className="table-card-top">
                                    <div className="table-title-wrap">
                                        <h3 className="table-name">{table.name}</h3>
                                        <span className="table-capacity-tag">
                                            <Users size={13} />
                                            {table.capacity} {table.capacity === 1 ? 'seat' : 'seats'}
                                        </span>
                                    </div>
                                    <span
                                        className="table-status-pill"
                                        style={{
                                            backgroundColor: statusInfo.bg,
                                            color: statusInfo.color,
                                            borderColor: statusInfo.border
                                        }}
                                    >
                                        <span className="status-dot" style={{ backgroundColor: statusInfo.color }} />
                                        {statusInfo.label}
                                    </span>
                                </div>

                                {hasActiveOrders && (
                                    <div className="table-active-order-box">
                                        <div className="order-running-total">
                                            <span className="running-label">Running Bill</span>
                                            <span className="running-amount">₹{runningTotal.toFixed(2)}</span>
                                        </div>
                                        <span className="running-items-badge">
                                            {runningItemsCount} {runningItemsCount === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                )}

                                <div className="table-actions-strip">
                                    <button
                                        className="table-icon-btn qr"
                                        onClick={() => handleGenerateQR(table.id, table.name)}
                                        title="View / Share QR Code"
                                    >
                                        <QrCode size={15} />
                                    </button>

                                    {table.status === 'EMPTY' && (
                                        <>
                                            <button
                                                className="table-btn-action occupy"
                                                onClick={() => handleStatusChange(table.id, 'OCCUPIED')}
                                            >
                                                Occupy
                                            </button>
                                            <button
                                                className="table-btn-action reserve"
                                                onClick={() => handleStatusChange(table.id, 'RESERVED')}
                                            >
                                                Reserve
                                            </button>
                                            <button
                                                className="table-icon-btn delete"
                                                onClick={() => setDeleteConfirm(table.id)}
                                                title="Delete Table"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}

                                    {table.status === 'OCCUPIED' && (
                                        <button
                                            className="table-btn-action clear"
                                            onClick={() => handleStatusChange(table.id, 'CLEANING')}
                                        >
                                            Clear Table
                                        </button>
                                    )}

                                    {table.status === 'RESERVED' && (
                                        <>
                                            <button
                                                className="table-btn-action occupy"
                                                onClick={() => handleStatusChange(table.id, 'OCCUPIED')}
                                            >
                                                Seat Guests
                                            </button>
                                            <button
                                                className="table-btn-action ready"
                                                onClick={() => handleStatusChange(table.id, 'EMPTY')}
                                            >
                                                Release
                                            </button>
                                        </>
                                    )}

                                    {table.status === 'CLEANING' && (
                                        <button
                                            className="table-btn-action ready"
                                            onClick={() => handleStatusChange(table.id, 'EMPTY')}
                                        >
                                            <CheckCircle2 size={14} />
                                            Ready
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Add Table Modal (Modern Icebox Dialog) ── */}
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
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <div className="modal-header-title">
                                    <div className="modal-icon-badge">
                                        <Grid3X3 size={18} />
                                    </div>
                                    <div>
                                        <h2>Add New Table</h2>
                                        <p className="modal-subtitle">Configure a new dining table on your floor</p>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleAddTable} className="table-form">
                                <div className="form-group">
                                    <label>Table Name / Number *</label>
                                    <div className="input-with-icon">
                                        <Grid3X3 size={15} className="input-icon" />
                                        <input
                                            type="text"
                                            value={newTable.name}
                                            onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                                            placeholder="e.g., Table 1, Outdoor 4, VIP 2"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Seating Capacity</label>
                                    <div className="capacity-pills-grid">
                                        {[2, 4, 6, 8, 10, 12].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                className={`capacity-pill-btn ${newTable.capacity === num ? 'selected' : ''}`}
                                                onClick={() => setNewTable({ ...newTable, capacity: num })}
                                            >
                                                <Users size={13} />
                                                <span>{num} {num === 1 ? 'Seat' : 'Seats'}</span>
                                            </button>
                                        ))}
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
                                                <span>Add Table</span>
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
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="delete-content">
                                <div className="delete-icon-box">
                                    <Trash2 size={28} />
                                </div>
                                <h3>Delete Table?</h3>
                                <p>Are you sure you want to remove this table? This action cannot be undone.</p>
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

            {/* ── QR Code Modal ── */}
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
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <div className="modal-header-title">
                                    <div className="modal-icon-badge">
                                        <QrCode size={18} />
                                    </div>
                                    <div>
                                        <h2>Self-Order QR for {qrModal.tableName}</h2>
                                        <p className="modal-subtitle">Contactless ordering code for dining guests</p>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setQrModal(null)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="qr-modal-body">
                                <div className="qr-card-container">
                                    <div className="qr-image-wrapper">
                                        <QrCode size={130} />
                                    </div>
                                    <span className="qr-table-tag">{qrModal.tableName}</span>
                                </div>

                                <div className="qr-url-box">
                                    <input type="text" value={qrModal.qrUrl} readOnly />
                                    <button
                                        className="btn btn-secondary btn-icon-copy"
                                        onClick={() => copyQRUrl(qrModal.qrUrl)}
                                        title="Copy URL"
                                    >
                                        <Copy size={15} />
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-icon-copy"
                                        onClick={() => window.open(qrModal.qrUrl, '_blank')}
                                        title="Open Link"
                                    >
                                        <ExternalLink size={15} />
                                    </button>
                                </div>

                                <div className="qr-tip-banner">
                                    <Sparkles size={16} />
                                    <span>Print and place on <strong>{qrModal.tableName}</strong> for guests to scan and view menu on mobile.</span>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setQrModal(null)}>
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
