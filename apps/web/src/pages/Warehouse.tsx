// Warehouse Management Page - Enterprise Edition
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Warehouse as WarehouseIcon, Plus, Package, ArrowRightLeft,
    Building2, X, Check, Truck, ChevronRight, MapPin,
    Users, AlertTriangle, Grid3X3
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api, { inventoryAPI } from '../api';
import './Warehouse.css';
import { logger } from '../utils/logger';

interface Warehouse {
    id: string;
    name: string;
    address?: string;
    isMain: boolean;
    _count?: { stock: number };
}

interface StockTransfer {
    id: string;
    transferNumber: number;
    status: string;
    fromWarehouse: { name: string };
    toWarehouse: { name: string };
    items: { quantity: number; inventoryItem: { name: string; unit: string } }[];
    createdAt: string;
}

interface InventoryItem {
    id: string;
    name: string;
    unit: string;
}

interface Supplier {
    id: string;
    name: string;
    code?: string;
    phone?: string;
    email?: string;
    address?: string;
    gstNumber?: string;
    isActive: boolean;
}

interface StockAdjustment {
    id: string;
    adjustmentType: string;
    quantity: number;
    reason: string;
    status: string;
    inventoryItem: { name: string; unit: string };
    createdAt: string;
}

interface Zone {
    id: string;
    name: string;
    code: string;
    _count?: { racks: number };
}

type TabType = 'warehouses' | 'transfers' | 'locations' | 'suppliers' | 'adjustments';

export default function WarehousePage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('warehouses');

    // Modals
    const [showAddWarehouse, setShowAddWarehouse] = useState(false);
    const [showTransfer, setShowTransfer] = useState(false);

    // Form states
    const [newWarehouse, setNewWarehouse] = useState({ name: '', address: '', isMain: false });
    const [transferData, setTransferData] = useState({
        fromWarehouseId: '',
        toWarehouseId: '',
        items: [{ inventoryItemId: '', quantity: 0 }]
    });
    const [newSupplier, setNewSupplier] = useState({ name: '', code: '', phone: '', email: '', address: '', gstNumber: '' });
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const [newZone, setNewZone] = useState({ name: '', code: '', description: '' });
    const [showAddZone, setShowAddZone] = useState(false);
    const [newAdjustment, setNewAdjustment] = useState({
        inventoryItemId: '', warehouseId: '', adjustmentType: 'DAMAGE', quantity: 0, reason: ''
    });
    const [showAddAdjustment, setShowAddAdjustment] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [whRes, trRes, invRes] = await Promise.all([
                api.get('/warehouses').catch(() => ({ data: [] })),
                api.get('/warehouses/transfers').catch(() => ({ data: [] })),
                inventoryAPI.getAll().catch(() => ({ data: [] }))
            ]);
            setWarehouses(whRes.data || []);
            setTransfers(trRes.data || []);
            setInventoryItems(invRes.data || []);

            try {
                const [supRes, adjRes] = await Promise.all([
                    api.get('/suppliers').catch(() => ({ data: [] })),
                    api.get('/adjustments').catch(() => ({ data: [] }))
                ]);
                setSuppliers(supRes.data || []);
                setAdjustments(adjRes.data || []);
            } catch {
                setSuppliers([]);
                setAdjustments([]);
            }
        } catch (error) {
            logger.error('[Warehouse] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchZones = async (warehouseId: string) => {
        try {
            const res = await api.get(`/warehouses/${warehouseId}/zones`);
            setZones(res.data);
        } catch (error) {
            logger.error('Failed to fetch zones');
        }
    };

    const createSupplier = async () => {
        if (!newSupplier.name.trim()) {
            toast.error('Supplier name is required');
            return;
        }
        try {
            await api.post('/suppliers', newSupplier);
            toast.success('Supplier created');
            setShowAddSupplier(false);
            setNewSupplier({ name: '', code: '', phone: '', email: '', address: '', gstNumber: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to create supplier');
        }
    };

    const createZone = async () => {
        if (!selectedWarehouse || !newZone.name.trim() || !newZone.code.trim()) {
            toast.error('Name and code are required');
            return;
        }
        try {
            await api.post(`/warehouses/${selectedWarehouse}/zones`, newZone);
            toast.success('Zone created');
            setShowAddZone(false);
            setNewZone({ name: '', code: '', description: '' });
            fetchZones(selectedWarehouse);
        } catch (error) {
            toast.error('Failed to create zone');
        }
    };

    const createAdjustment = async () => {
        if (!newAdjustment.inventoryItemId || !newAdjustment.warehouseId || newAdjustment.quantity <= 0) {
            toast.error('All fields are required');
            return;
        }
        try {
            await api.post('/adjustments', newAdjustment);
            toast.success('Adjustment created - pending approval');
            setShowAddAdjustment(false);
            setNewAdjustment({ inventoryItemId: '', warehouseId: '', adjustmentType: 'DAMAGE', quantity: 0, reason: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to create adjustment');
        }
    };

    const approveAdjustment = async (id: string) => {
        try {
            await api.put(`/adjustments/${id}/approve`);
            toast.success('Adjustment approved');
            fetchData();
        } catch (error) {
            toast.error('Failed to approve adjustment');
        }
    };

    const createWarehouse = async () => {
        if (!newWarehouse.name.trim()) {
            toast.error('Warehouse name is required');
            return;
        }
        try {
            await api.post('/warehouses', newWarehouse);
            toast.success('Warehouse created');
            setShowAddWarehouse(false);
            setNewWarehouse({ name: '', address: '', isMain: false });
            fetchData();
        } catch (error) {
            toast.error('Failed to create warehouse');
        }
    };

    const createTransfer = async () => {
        if (!transferData.fromWarehouseId || !transferData.toWarehouseId) {
            toast.error('Select both warehouses');
            return;
        }
        if (transferData.fromWarehouseId === transferData.toWarehouseId) {
            toast.error('Cannot transfer to same warehouse');
            return;
        }
        const validItems = transferData.items.filter(i => i.inventoryItemId && i.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Add at least one item');
            return;
        }
        try {
            await api.post('/warehouses/transfers', {
                ...transferData,
                items: validItems
            });
            toast.success('Transfer request created');
            setShowTransfer(false);
            setTransferData({
                fromWarehouseId: '',
                toWarehouseId: '',
                items: [{ inventoryItemId: '', quantity: 0 }]
            });
            fetchData();
        } catch (error) {
            toast.error('Failed to create transfer');
        }
    };

    const updateTransferStatus = async (id: string, status: string) => {
        try {
            await api.put(`/warehouses/transfers/${id}/status`, { status });
            toast.success(`Transfer ${status.toLowerCase()}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update transfer');
        }
    };

    const addTransferItem = () => {
        setTransferData({
            ...transferData,
            items: [...transferData.items, { inventoryItemId: '', quantity: 0 }]
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return '#f59e0b';
            case 'APPROVED': return '#3b82f6';
            case 'IN_TRANSIT': return '#8b5cf6';
            case 'COMPLETED': return '#10b981';
            case 'CANCELLED': return '#ef4444';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="warehouse-page loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="warehouse-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="wh-header">
                <div>
                    <h1><WarehouseIcon size={28} /> Warehouse Management</h1>
                    <p>{warehouses.length} warehouses • {transfers.filter(t => t.status === 'PENDING').length} pending transfers</p>
                </div>
                <div className="header-actions">
                    <button className="btn-secondary" onClick={() => setShowTransfer(true)}>
                        <ArrowRightLeft size={18} /> Stock Transfer
                    </button>
                    <button className="btn-primary" onClick={() => setShowAddWarehouse(true)}>
                        <Plus size={18} /> Add Warehouse
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="wh-tabs">
                <button
                    className={`wh-tab ${activeTab === 'warehouses' ? 'active' : ''}`}
                    onClick={() => setActiveTab('warehouses')}
                >
                    <Building2 size={18} /> Warehouses
                </button>
                <button
                    className={`wh-tab ${activeTab === 'transfers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transfers')}
                >
                    <Truck size={18} /> Transfers
                </button>
                <button
                    className={`wh-tab ${activeTab === 'locations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('locations')}
                >
                    <MapPin size={18} /> Locations
                </button>
                <button
                    className={`wh-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suppliers')}
                >
                    <Users size={18} /> Suppliers
                </button>
                <button
                    className={`wh-tab ${activeTab === 'adjustments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('adjustments')}
                >
                    <AlertTriangle size={18} /> Adjustments
                </button>
            </div>

            {/* Content */}
            {activeTab === 'warehouses' ? (
                <div className="wh-grid">
                    {warehouses.map((wh) => (
                        <motion.div
                            key={wh.id}
                            className="wh-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="wh-card-header">
                                <Building2 size={24} />
                                <div>
                                    <h3>{wh.name}</h3>
                                    {wh.isMain && <span className="main-badge">Main</span>}
                                </div>
                            </div>
                            {wh.address && <p className="wh-address">{wh.address}</p>}
                            <div className="wh-stats">
                                <Package size={16} />
                                <span>{wh._count?.stock || 0} items in stock</span>
                            </div>
                            <button className="view-stock-btn">
                                View Stock <ChevronRight size={16} />
                            </button>
                        </motion.div>
                    ))}

                    {warehouses.length === 0 && (
                        <div className="empty-state">
                            <WarehouseIcon size={48} />
                            <p>No warehouses yet. Add your first warehouse to get started.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="transfers-list">
                    {transfers.map((transfer) => (
                        <motion.div
                            key={transfer.id}
                            className="transfer-card"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="transfer-header">
                                <span className="transfer-number">#{transfer.transferNumber}</span>
                                <span
                                    className="transfer-status"
                                    style={{ background: getStatusColor(transfer.status) }}
                                >
                                    {transfer.status}
                                </span>
                            </div>
                            <div className="transfer-route">
                                <span>{transfer.fromWarehouse.name}</span>
                                <ArrowRightLeft size={16} />
                                <span>{transfer.toWarehouse.name}</span>
                            </div>
                            <div className="transfer-items">
                                {transfer.items.slice(0, 3).map((item, i) => (
                                    <span key={i}>{item.quantity} {item.inventoryItem.unit} {item.inventoryItem.name}</span>
                                ))}
                                {transfer.items.length > 3 && <span>+{transfer.items.length - 3} more</span>}
                            </div>
                            {transfer.status === 'PENDING' && (
                                <div className="transfer-actions">
                                    <button onClick={() => updateTransferStatus(transfer.id, 'APPROVED')}>
                                        <Check size={16} /> Approve
                                    </button>
                                    <button className="cancel" onClick={() => updateTransferStatus(transfer.id, 'CANCELLED')}>
                                        <X size={16} /> Cancel
                                    </button>
                                </div>
                            )}
                            {transfer.status === 'APPROVED' && (
                                <button
                                    className="complete-btn"
                                    onClick={() => updateTransferStatus(transfer.id, 'COMPLETED')}
                                >
                                    Mark Completed
                                </button>
                            )}
                        </motion.div>
                    ))}

                    {transfers.length === 0 && (
                        <div className="empty-state">
                            <Truck size={48} />
                            <p>No transfers yet.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Locations Tab */}
            {activeTab === 'locations' && (
                <div className="locations-section">
                    <div className="location-header">
                        <div className="form-group inline">
                            <label>Select Warehouse:</label>
                            <select
                                value={selectedWarehouse}
                                onChange={(e) => {
                                    setSelectedWarehouse(e.target.value);
                                    if (e.target.value) fetchZones(e.target.value);
                                }}
                            >
                                <option value="">Choose warehouse</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedWarehouse && (
                            <button className="btn-primary" onClick={() => setShowAddZone(true)}>
                                <Plus size={16} /> Add Zone
                            </button>
                        )}
                    </div>

                    {selectedWarehouse ? (
                        <div className="zones-grid">
                            {zones.map(zone => (
                                <motion.div key={zone.id} className="zone-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <div className="zone-header">
                                        <Grid3X3 size={20} />
                                        <span className="zone-code">{zone.code}</span>
                                    </div>
                                    <h4>{zone.name}</h4>
                                    <p>{zone._count?.racks || 0} racks</p>
                                </motion.div>
                            ))}
                            {zones.length === 0 && (
                                <div className="empty-state">
                                    <MapPin size={48} />
                                    <p>No zones yet. Create zones to organize your warehouse.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <MapPin size={48} />
                            <p>Select a warehouse to view its location hierarchy.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Suppliers Tab */}
            {activeTab === 'suppliers' && (
                <div className="suppliers-section">
                    <div className="section-header">
                        <h3><Users size={20} /> Suppliers ({suppliers.length})</h3>
                        <button className="btn-primary" onClick={() => setShowAddSupplier(true)}>
                            <Plus size={16} /> Add Supplier
                        </button>
                    </div>
                    <div className="suppliers-grid">
                        {suppliers.map(supplier => (
                            <motion.div key={supplier.id} className="supplier-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="supplier-header">
                                    <Users size={20} />
                                    <div>
                                        <h4>{supplier.name}</h4>
                                        {supplier.code && <span className="supplier-code">{supplier.code}</span>}
                                    </div>
                                </div>
                                {supplier.phone && <p className="supplier-contact">📞 {supplier.phone}</p>}
                                {supplier.email && <p className="supplier-contact">✉️ {supplier.email}</p>}
                                {supplier.gstNumber && <p className="supplier-gst">GST: {supplier.gstNumber}</p>}
                            </motion.div>
                        ))}
                        {suppliers.length === 0 && (
                            <div className="empty-state">
                                <Users size={48} />
                                <p>No suppliers yet. Add your first supplier.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Adjustments Tab */}
            {activeTab === 'adjustments' && (
                <div className="adjustments-section">
                    <div className="section-header">
                        <h3><AlertTriangle size={20} /> Stock Adjustments</h3>
                        <button className="btn-primary" onClick={() => setShowAddAdjustment(true)}>
                            <Plus size={16} /> New Adjustment
                        </button>
                    </div>
                    <div className="adjustments-list">
                        {adjustments.map(adj => (
                            <motion.div key={adj.id} className="adjustment-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div className="adjustment-header">
                                    <span className={`adj-type adj-${adj.adjustmentType.toLowerCase()}`}>
                                        {adj.adjustmentType}
                                    </span>
                                    <span className={`adj-status status-${adj.status.toLowerCase()}`}>
                                        {adj.status}
                                    </span>
                                </div>
                                <div className="adjustment-details">
                                    <p><strong>{adj.inventoryItem?.name}</strong> - {adj.quantity} {adj.inventoryItem?.unit}</p>
                                    <p className="adj-reason">{adj.reason}</p>
                                </div>
                                {adj.status === 'PENDING' && (
                                    <div className="adjustment-actions">
                                        <button className="approve-btn" onClick={() => approveAdjustment(adj.id)}>
                                            <Check size={14} /> Approve
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        {adjustments.length === 0 && (
                            <div className="empty-state">
                                <AlertTriangle size={48} />
                                <p>No adjustments recorded. Use adjustments to track damage, expired, or wasted stock.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Warehouse Modal */}
            <AnimatePresence>
                {showAddWarehouse && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddWarehouse(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Add Warehouse</h2>
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={newWarehouse.name}
                                    onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                                    placeholder="e.g., Central Warehouse"
                                />
                            </div>
                            <div className="form-group">
                                <label>Address</label>
                                <textarea
                                    value={newWarehouse.address}
                                    onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                                    placeholder="Optional address"
                                />
                            </div>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={newWarehouse.isMain}
                                    onChange={(e) => setNewWarehouse({ ...newWarehouse, isMain: e.target.checked })}
                                />
                                Set as main warehouse
                            </label>
                            <div className="modal-actions">
                                <button onClick={() => setShowAddWarehouse(false)}>Cancel</button>
                                <button className="btn-primary" onClick={createWarehouse}>
                                    Create Warehouse
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stock Transfer Modal */}
            <AnimatePresence>
                {showTransfer && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowTransfer(false)}
                    >
                        <motion.div
                            className="modal transfer-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Create Stock Transfer</h2>
                            <div className="transfer-route-select">
                                <div className="form-group">
                                    <label>From Warehouse</label>
                                    <select
                                        value={transferData.fromWarehouseId}
                                        onChange={(e) => setTransferData({ ...transferData, fromWarehouseId: e.target.value })}
                                    >
                                        <option value="">Select source</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <ArrowRightLeft size={24} />
                                <div className="form-group">
                                    <label>To Warehouse</label>
                                    <select
                                        value={transferData.toWarehouseId}
                                        onChange={(e) => setTransferData({ ...transferData, toWarehouseId: e.target.value })}
                                    >
                                        <option value="">Select destination</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <h3>Items to Transfer</h3>
                            {transferData.items.map((item, idx) => (
                                <div key={idx} className="transfer-item-row">
                                    <select
                                        value={item.inventoryItemId}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[idx].inventoryItemId = e.target.value;
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                    >
                                        <option value="">Select item</option>
                                        {inventoryItems.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[idx].quantity = Number(e.target.value);
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        placeholder="Qty"
                                    />
                                </div>
                            ))}
                            <button className="add-item-btn" onClick={addTransferItem}>
                                <Plus size={16} /> Add Item
                            </button>

                            <div className="modal-actions">
                                <button onClick={() => setShowTransfer(false)}>Cancel</button>
                                <button className="btn-primary" onClick={createTransfer}>
                                    Create Transfer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Supplier Modal */}
            <AnimatePresence>
                {showAddSupplier && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddSupplier(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Add Supplier</h2>
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                    placeholder="Supplier name"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Code</label>
                                    <input
                                        type="text"
                                        value={newSupplier.code}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                                        placeholder="SUP001"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Phone</label>
                                    <input
                                        type="text"
                                        value={newSupplier.phone}
                                        onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                        placeholder="Phone number"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newSupplier.email}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                    placeholder="supplier@email.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>GST Number</label>
                                <input
                                    type="text"
                                    value={newSupplier.gstNumber}
                                    onChange={(e) => setNewSupplier({ ...newSupplier, gstNumber: e.target.value })}
                                    placeholder="GST number"
                                />
                            </div>
                            <div className="modal-actions">
                                <button onClick={() => setShowAddSupplier(false)}>Cancel</button>
                                <button className="btn-primary" onClick={createSupplier}>
                                    Add Supplier
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Zone Modal */}
            <AnimatePresence>
                {showAddZone && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddZone(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Add Zone</h2>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Zone Code *</label>
                                    <input
                                        type="text"
                                        value={newZone.code}
                                        onChange={(e) => setNewZone({ ...newZone, code: e.target.value })}
                                        placeholder="Z01"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Zone Name *</label>
                                    <input
                                        type="text"
                                        value={newZone.name}
                                        onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                                        placeholder="Food Storage"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={newZone.description}
                                    onChange={(e) => setNewZone({ ...newZone, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="modal-actions">
                                <button onClick={() => setShowAddZone(false)}>Cancel</button>
                                <button className="btn-primary" onClick={createZone}>
                                    Create Zone
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Adjustment Modal */}
            <AnimatePresence>
                {showAddAdjustment && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddAdjustment(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2>Record Stock Adjustment</h2>
                            <div className="form-group">
                                <label>Adjustment Type *</label>
                                <select
                                    value={newAdjustment.adjustmentType}
                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, adjustmentType: e.target.value })}
                                >
                                    <option value="DAMAGE">Damage</option>
                                    <option value="EXPIRED">Expired</option>
                                    <option value="WASTAGE">Wastage</option>
                                    <option value="PRODUCTION_USE">Production Use</option>
                                    <option value="INTERNAL_USE">Internal Use</option>
                                    <option value="SAMPLE">Sample</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Warehouse *</label>
                                <select
                                    value={newAdjustment.warehouseId}
                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, warehouseId: e.target.value })}
                                >
                                    <option value="">Select warehouse</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Item *</label>
                                    <select
                                        value={newAdjustment.inventoryItemId}
                                        onChange={(e) => setNewAdjustment({ ...newAdjustment, inventoryItemId: e.target.value })}
                                    >
                                        <option value="">Select item</option>
                                        {inventoryItems.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Quantity *</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={newAdjustment.quantity}
                                        onChange={(e) => setNewAdjustment({ ...newAdjustment, quantity: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Reason *</label>
                                <textarea
                                    value={newAdjustment.reason}
                                    onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
                                    placeholder="Explain why this adjustment is needed"
                                />
                            </div>
                            <div className="modal-actions">
                                <button onClick={() => setShowAddAdjustment(false)}>Cancel</button>
                                <button className="btn-primary" onClick={createAdjustment}>
                                    Submit for Approval
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

