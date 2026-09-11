// Warehouse Management Page - Streamlined 3-Pillar Indian Restaurant Edition
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, ArrowRightLeft, Building2, Trash2, X, Check,
    Package, AlertCircle, Clock, Search,
    Sparkles, ArrowRight, ShieldCheck, Flame, Apple
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api, { inventoryAPI } from '../api';
import { hasExpressBackend } from '../lib/superadmin-direct';
import './Warehouse.css';
import { logger } from '../utils/logger';

// ── Types ──
export interface GodownLocation {
    id: string;
    name: string;
    type: 'GODOWN' | 'KITCHEN' | 'BAR' | 'COLD_STORAGE' | string;
    description?: string;
    isMain: boolean;
    itemCount?: number;
    createdAt?: string;
}

export interface StockTransferItem {
    inventoryItemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    notes?: string;
}

export interface StockTransferRecord {
    id: string;
    transferNumber: number | string;
    fromLocationId: string;
    fromLocationName: string;
    toLocationId: string;
    toLocationName: string;
    items: StockTransferItem[];
    status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
    notes?: string;
    createdAt: string;
}

export interface WastageRecord {
    id: string;
    inventoryItemId: string;
    itemName: string;
    locationId: string;
    locationName: string;
    quantity: number;
    unit: string;
    reason: 'SPOILED' | 'BURNT_LOSS' | 'DAMAGED' | 'QUALITY_ISSUE' | 'STAFF_MEAL' | string;
    estimatedCost?: number;
    notes?: string;
    createdAt: string;
}

export interface InventoryItemOption {
    id: string;
    name: string;
    unit: string;
    currentStock?: number;
    costPerUnit?: number;
    category?: string;
}

type TabType = 'godowns' | 'transfers' | 'wastage';

// ── Local Storage Fallback Keys ──
const STORAGE_GODOWNS = 'billova_warehouse_godowns';
const STORAGE_TRANSFERS = 'billova_warehouse_transfers';
const STORAGE_WASTAGE = 'billova_warehouse_wastage';

// Default starter Godowns if fresh
const DEFAULT_STARTER_GODOWNS: GodownLocation[] = [
    {
        id: 'wh-main-01',
        name: 'Main Godown & Dry Store',
        type: 'GODOWN',
        description: 'Primary storage for bulk grains, dry ingredients & spices',
        isMain: true,
        itemCount: 0,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'wh-kitchen-01',
        name: 'Main Kitchen Prep Store',
        type: 'KITCHEN',
        description: 'Daily operational stock for line chefs & prep station',
        isMain: false,
        itemCount: 0,
        createdAt: new Date().toISOString(),
    }
];

export default function WarehousePage() {
    const [activeTab, setActiveTab] = useState<TabType>('godowns');
    const [loading, setLoading] = useState(true);

    // Data States
    const [godowns, setGodowns] = useState<GodownLocation[]>([]);
    const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
    const [wastageList, setWastageList] = useState<WastageRecord[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal Visibility States
    const [showAddGodown, setShowAddGodown] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showWastageModal, setShowWastageModal] = useState(false);

    // Form: New Godown
    const [newGodown, setNewGodown] = useState({
        name: '',
        type: 'GODOWN' as const,
        description: '',
        isMain: false,
    });

    // Form: Quick Transfer
    const [transferForm, setTransferForm] = useState({
        fromLocationId: '',
        toLocationId: '',
        items: [{ inventoryItemId: '', quantity: 1, notes: '' }],
        notes: '',
    });

    // Form: Quick Wastage
    const [wastageForm, setWastageForm] = useState({
        inventoryItemId: '',
        locationId: '',
        quantity: 1,
        reason: 'SPOILED',
        notes: '',
    });

    useEffect(() => {
        loadAllData();
    }, []);

    // ── Load All Data (API with Multi-Tier Fallback) ──
    const loadAllData = async () => {
        try {
            setLoading(true);

            // 1. Inventory Items
            let items: InventoryItemOption[] = [];
            try {
                const invRes = await inventoryAPI.getAll();
                if (Array.isArray(invRes?.data)) {
                    items = invRes.data;
                }
            } catch {
                const localInv = localStorage.getItem('billova_inventory_items');
                if (localInv) items = JSON.parse(localInv);
            }
            setInventoryItems(items);

            // 2. Godowns / Warehouses
            let fetchedGodowns: GodownLocation[] = [];
            if (hasExpressBackend()) {
                try {
                    const res = await api.get('/warehouses');
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        fetchedGodowns = res.data.map((w: any) => ({
                            id: w.id,
                            name: w.name,
                            type: w.type || (w.isMain ? 'GODOWN' : 'KITCHEN'),
                            description: w.address || w.description || '',
                            isMain: Boolean(w.isMain),
                            itemCount: w._count?.stock || items.length,
                            createdAt: w.createdAt,
                        }));
                    }
                } catch { /* fallback to local */ }
            }
            if (fetchedGodowns.length === 0) {
                const stored = localStorage.getItem(STORAGE_GODOWNS);
                fetchedGodowns = stored ? JSON.parse(stored) : DEFAULT_STARTER_GODOWNS;
            }
            setGodowns(fetchedGodowns);

            // 3. Transfers
            let fetchedTransfers: StockTransferRecord[] = [];
            if (hasExpressBackend()) {
                try {
                    const res = await api.get('/warehouses/transfers');
                    if (Array.isArray(res.data)) {
                        fetchedTransfers = res.data.map((t: any) => ({
                            id: t.id,
                            transferNumber: t.transferNumber || `TR-${String(t.id).slice(-4)}`,
                            fromLocationId: t.fromWarehouseId || t.fromWarehouse?.id,
                            fromLocationName: t.fromWarehouse?.name || 'Main Godown',
                            toLocationId: t.toWarehouseId || t.toWarehouse?.id,
                            toLocationName: t.toWarehouse?.name || 'Kitchen Store',
                            items: (t.items || []).map((it: any) => ({
                                inventoryItemId: it.inventoryItemId,
                                itemName: it.inventoryItem?.name || it.name || 'Raw Item',
                                quantity: Number(it.quantity || 1),
                                unit: it.inventoryItem?.unit || 'kg',
                                notes: it.notes,
                            })),
                            status: t.status || 'COMPLETED',
                            notes: t.notes,
                            createdAt: t.createdAt || new Date().toISOString(),
                        }));
                    }
                } catch { /* fallback */ }
            }
            if (fetchedTransfers.length === 0) {
                const stored = localStorage.getItem(STORAGE_TRANSFERS);
                fetchedTransfers = stored ? JSON.parse(stored) : [];
            }
            setTransfers(fetchedTransfers);

            // 4. Wastage & Adjustments
            let fetchedWastage: WastageRecord[] = [];
            if (hasExpressBackend()) {
                try {
                    const res = await api.get('/adjustments');
                    if (Array.isArray(res.data)) {
                        fetchedWastage = res.data.map((a: any) => ({
                            id: a.id,
                            inventoryItemId: a.inventoryItemId,
                            itemName: a.inventoryItem?.name || 'Item',
                            locationId: a.warehouseId,
                            locationName: a.warehouse?.name || 'Kitchen Store',
                            quantity: Number(a.quantity || 1),
                            unit: a.inventoryItem?.unit || 'kg',
                            reason: a.adjustmentType || a.reason || 'SPOILED',
                            estimatedCost: Number(a.quantity || 1) * Number(a.inventoryItem?.costPerUnit || 50),
                            notes: a.reason,
                            createdAt: a.createdAt || new Date().toISOString(),
                        }));
                    }
                } catch { /* fallback */ }
            }
            if (fetchedWastage.length === 0) {
                const stored = localStorage.getItem(STORAGE_WASTAGE);
                fetchedWastage = stored ? JSON.parse(stored) : [];
            }
            setWastageList(fetchedWastage);

        } catch (error) {
            logger.error('[Warehouse] Error loading data:', error);
            toast.error('Failed to load storage data');
        } finally {
            setLoading(false);
        }
    };

    // ── Save Helpers ──
    const persistGodowns = (updated: GodownLocation[]) => {
        setGodowns(updated);
        localStorage.setItem(STORAGE_GODOWNS, JSON.stringify(updated));
    };

    const persistTransfers = (updated: StockTransferRecord[]) => {
        setTransfers(updated);
        localStorage.setItem(STORAGE_TRANSFERS, JSON.stringify(updated));
    };

    const persistWastage = (updated: WastageRecord[]) => {
        setWastageList(updated);
        localStorage.setItem(STORAGE_WASTAGE, JSON.stringify(updated));
    };

    // ── Create Godown / Storage Location ──
    const handleCreateGodown = async () => {
        if (!newGodown.name.trim()) {
            toast.error('Please enter a location name');
            return;
        }

        const godownId = `wh-${Date.now()}`;
        const created: GodownLocation = {
            id: godownId,
            name: newGodown.name.trim(),
            type: newGodown.type,
            description: newGodown.description.trim(),
            isMain: newGodown.isMain || godowns.length === 0,
            itemCount: inventoryItems.length,
            createdAt: new Date().toISOString(),
        };

        if (hasExpressBackend()) {
            try {
                await api.post('/warehouses', {
                    name: created.name,
                    address: created.description,
                    isMain: created.isMain,
                });
            } catch { /* fallback to local */ }
        }

        // If marked as main, reset others
        let nextList = [...godowns];
        if (created.isMain) {
            nextList = nextList.map(g => ({ ...g, isMain: false }));
        }
        nextList.push(created);
        persistGodowns(nextList);

        toast.success(`Storage "${created.name}" created!`);
        setShowAddGodown(false);
        setNewGodown({ name: '', type: 'GODOWN', description: '', isMain: false });
    };

    // ── Create Quick Stock Transfer (1-Click Issue) ──
    const handleCreateTransfer = async () => {
        if (!transferForm.fromLocationId || !transferForm.toLocationId) {
            toast.error('Select both From and To storage locations');
            return;
        }
        if (transferForm.fromLocationId === transferForm.toLocationId) {
            toast.error('Source and destination cannot be the same');
            return;
        }

        const validItems = transferForm.items.filter(i => i.inventoryItemId && i.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Please select at least one item and enter valid quantity');
            return;
        }

        const fromWh = godowns.find(g => g.id === transferForm.fromLocationId);
        const toWh = godowns.find(g => g.id === transferForm.toLocationId);

        const transferNum = `TR-${String(transfers.length + 1).padStart(3, '0')}`;
        const itemsWithDetails: StockTransferItem[] = validItems.map(it => {
            const inv = inventoryItems.find(i => i.id === it.inventoryItemId);
            return {
                inventoryItemId: it.inventoryItemId,
                itemName: inv?.name || 'Raw Ingredient',
                quantity: Number(it.quantity),
                unit: inv?.unit || 'kg',
                notes: it.notes,
            };
        });

        const newRecord: StockTransferRecord = {
            id: `tr-${Date.now()}`,
            transferNumber: transferNum,
            fromLocationId: transferForm.fromLocationId,
            fromLocationName: fromWh?.name || 'Main Godown',
            toLocationId: transferForm.toLocationId,
            toLocationName: toWh?.name || 'Kitchen Store',
            items: itemsWithDetails,
            status: 'COMPLETED',
            notes: transferForm.notes,
            createdAt: new Date().toISOString(),
        };

        if (hasExpressBackend()) {
            try {
                await api.post('/warehouses/transfers', {
                    fromWarehouseId: transferForm.fromLocationId,
                    toWarehouseId: transferForm.toLocationId,
                    items: validItems.map(it => ({ inventoryItemId: it.inventoryItemId, quantity: it.quantity })),
                    notes: transferForm.notes,
                });
            } catch { /* fallback */ }
        }

        persistTransfers([newRecord, ...transfers]);
        toast.success(`Stock Transfer ${transferNum} completed!`);
        setShowTransferModal(false);
        setTransferForm({
            fromLocationId: '',
            toLocationId: '',
            items: [{ inventoryItemId: '', quantity: 1, notes: '' }],
            notes: '',
        });
    };

    // ── Log Kitchen Wastage / Spoilage ──
    const handleLogWastage = async () => {
        if (!wastageForm.inventoryItemId) {
            toast.error('Select the item that was wasted');
            return;
        }
        if (wastageForm.quantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        const inv = inventoryItems.find(i => i.id === wastageForm.inventoryItemId);
        const loc = godowns.find(g => g.id === wastageForm.locationId) || godowns[0];

        const estimatedCost = (inv?.costPerUnit || 0) * wastageForm.quantity;

        const record: WastageRecord = {
            id: `wst-${Date.now()}`,
            inventoryItemId: wastageForm.inventoryItemId,
            itemName: inv?.name || 'Raw Material',
            locationId: loc?.id || 'wh-main-01',
            locationName: loc?.name || 'Kitchen Prep Store',
            quantity: Number(wastageForm.quantity),
            unit: inv?.unit || 'kg',
            reason: wastageForm.reason,
            estimatedCost: estimatedCost > 0 ? estimatedCost : undefined,
            notes: wastageForm.notes,
            createdAt: new Date().toISOString(),
        };

        if (hasExpressBackend()) {
            try {
                await api.post('/adjustments', {
                    inventoryItemId: wastageForm.inventoryItemId,
                    warehouseId: loc?.id,
                    adjustmentType: wastageForm.reason,
                    quantity: wastageForm.quantity,
                    reason: wastageForm.notes || wastageForm.reason,
                });
            } catch { /* fallback */ }
        }

        persistWastage([record, ...wastageList]);
        toast.success(`Wastage logged for ${inv?.name || 'item'}!`);
        setShowWastageModal(false);
        setWastageForm({
            inventoryItemId: '',
            locationId: '',
            quantity: 1,
            reason: 'SPOILED',
            notes: '',
        });
    };

    // ── Format Helper ──
    const formatDateTimeHuman = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'SPOILED': return { label: 'Spoiled / Expired', icon: Apple, color: 'text-amber' };
            case 'BURNT_LOSS': return { label: 'Cooking / Burnt Loss', icon: Flame, color: 'text-danger' };
            case 'DAMAGED': return { label: 'Damaged / Dropped', icon: AlertCircle, color: 'text-danger' };
            case 'QUALITY_ISSUE': return { label: 'Quality Rejected', icon: AlertCircle, color: 'text-amber' };
            case 'STAFF_MEAL': return { label: 'Staff Tasting / Meal', icon: Sparkles, color: 'text-purple' };
            default: return { label: reason, icon: AlertCircle, color: 'text-muted' };
        }
    };

    // Filtered lists
    const filteredGodowns = useMemo(() => {
        if (!searchQuery.trim()) return godowns;
        const q = searchQuery.toLowerCase();
        return godowns.filter(g => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
    }, [godowns, searchQuery]);

    const filteredTransfers = useMemo(() => {
        if (!searchQuery.trim()) return transfers;
        const q = searchQuery.toLowerCase();
        return transfers.filter(t =>
            String(t.transferNumber).toLowerCase().includes(q) ||
            t.fromLocationName.toLowerCase().includes(q) ||
            t.toLocationName.toLowerCase().includes(q) ||
            t.items.some(it => it.itemName.toLowerCase().includes(q))
        );
    }, [transfers, searchQuery]);

    const filteredWastage = useMemo(() => {
        if (!searchQuery.trim()) return wastageList;
        const q = searchQuery.toLowerCase();
        return wastageList.filter(w =>
            w.itemName.toLowerCase().includes(q) ||
            w.locationName.toLowerCase().includes(q) ||
            (w.notes || '').toLowerCase().includes(q)
        );
    }, [wastageList, searchQuery]);

    const totalWastageCost = useMemo(() => {
        return wastageList.reduce((sum, w) => sum + (w.estimatedCost || 0), 0);
    }, [wastageList]);

    return (
        <div className="warehouse-page">
            <Toaster position="top-center" />

            {/* ── Header Bar ── */}
            <div className="wh-header-bar">
                <div className="header-left">
                    <h1 className="page-title">Warehouse & Stores</h1>
                    <div className="header-badges">
                        <span className="count-chip">{godowns.length} Storage Nodes</span>
                        <span className="count-chip">{transfers.length} Transfers</span>
                        <span className="count-chip text-amber">{wastageList.length} Wastage Logs</span>
                    </div>
                </div>

                <div className="header-actions">
                    <button
                        className="wh-btn wh-btn-secondary"
                        onClick={() => setShowTransferModal(true)}
                        title="Quick Stock Transfer"
                    >
                        <ArrowRightLeft size={15} />
                        <span>Issue / Transfer</span>
                    </button>

                    <button
                        className="wh-btn wh-btn-danger"
                        onClick={() => setShowWastageModal(true)}
                        title="Record Kitchen Wastage"
                    >
                        <Trash2 size={15} />
                        <span>Log Wastage</span>
                    </button>

                    <button
                        className="wh-btn wh-btn-primary"
                        onClick={() => setShowAddGodown(true)}
                        title="Add Storage Location"
                    >
                        <Plus size={15} />
                        <span>Add Godown</span>
                    </button>
                </div>
            </div>

            {/* ── 3-Pillar Tab Pill Bar ── */}
            <div className="wh-nav-bar">
                <div className="wh-tabs-pills">
                    <button
                        className={`wh-tab-pill ${activeTab === 'godowns' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('godowns'); setSearchQuery(''); }}
                    >
                        <Building2 size={16} />
                        <span>Godowns & Stores</span>
                        <span className="pill-counter">{godowns.length}</span>
                    </button>

                    <button
                        className={`wh-tab-pill ${activeTab === 'transfers' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('transfers'); setSearchQuery(''); }}
                    >
                        <ArrowRightLeft size={16} />
                        <span>Stock Transfers & Issues</span>
                        <span className="pill-counter">{transfers.length}</span>
                    </button>

                    <button
                        className={`wh-tab-pill ${activeTab === 'wastage' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('wastage'); setSearchQuery(''); }}
                    >
                        <Trash2 size={16} />
                        <span>Kitchen Wastage</span>
                        <span className="pill-counter">{wastageList.length}</span>
                    </button>
                </div>

                <div className="wh-search-box">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Content Area ── */}
            <div className="wh-main-container">
                {loading ? (
                    <div className="wh-loading-state">
                        <div className="spinner" />
                        <span>Loading storage data...</span>
                    </div>
                ) : activeTab === 'godowns' ? (
                    /* ═════════════════════════════════════════════ */
                    /* ── PILLAR 1: GODOWNS & STORES ── */
                    /* ═════════════════════════════════════════════ */
                    <div className="wh-tab-content">
                        <div className="godowns-grid">
                            {filteredGodowns.map((g) => (
                                <motion.div
                                    key={g.id}
                                    className={`godown-card ${g.isMain ? 'main-godown' : ''}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="godown-card-header">
                                        <div className="godown-icon-box">
                                            <Building2 size={20} />
                                        </div>
                                        <div className="godown-meta-title">
                                            <div className="godown-title-row">
                                                <h3>{g.name}</h3>
                                                {g.isMain && <span className="main-tag">Primary Storage</span>}
                                            </div>
                                            <span className="godown-type-label">{g.type.replace('_', ' ')}</span>
                                        </div>
                                    </div>

                                    {g.description && <p className="godown-desc">{g.description}</p>}

                                    <div className="godown-stats-row">
                                        <div className="godown-stat-pill">
                                            <Package size={14} className="text-primary" />
                                            <span><strong>{inventoryItems.length}</strong> items tracked</span>
                                        </div>
                                        <div className="godown-stat-pill">
                                            <ShieldCheck size={14} className="text-green" />
                                            <span>Active Node</span>
                                        </div>
                                    </div>

                                    <div className="godown-card-actions">
                                        <button
                                            className="godown-action-btn primary"
                                            onClick={() => {
                                                setTransferForm({
                                                    ...transferForm,
                                                    fromLocationId: g.id,
                                                });
                                                setShowTransferModal(true);
                                            }}
                                        >
                                            <ArrowRightLeft size={13} />
                                            <span>Issue Stock From Here</span>
                                        </button>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredGodowns.length === 0 && (
                                <div className="wh-empty-state">
                                    <div className="empty-icon-box">
                                        <Building2 size={32} />
                                    </div>
                                    <h3>No storage locations found</h3>
                                    <p>Add your primary godown, prep kitchen storage, or counter pantry.</p>
                                    <button className="wh-btn wh-btn-primary" onClick={() => setShowAddGodown(true)}>
                                        <Plus size={15} /> Add First Godown
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'transfers' ? (
                    /* ═════════════════════════════════════════════ */
                    /* ── PILLAR 2: STOCK TRANSFERS & ISSUES ── */
                    /* ═════════════════════════════════════════════ */
                    <div className="wh-tab-content">
                        <div className="transfers-timeline-list">
                            {filteredTransfers.map((t) => (
                                <motion.div
                                    key={t.id}
                                    className="transfer-timeline-card"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="transfer-card-top">
                                        <div className="transfer-id-group">
                                            <span className="transfer-tag">TRANSFER #{t.transferNumber}</span>
                                            <span className="transfer-time">
                                                <Clock size={12} />
                                                {formatDateTimeHuman(t.createdAt)}
                                            </span>
                                        </div>
                                        <span className="status-badge-success">
                                            <Check size={12} /> Completed
                                        </span>
                                    </div>

                                    {/* Transfer Route Banner */}
                                    <div className="transfer-route-banner">
                                        <div className="route-node origin">
                                            <Building2 size={15} />
                                            <span className="node-name">{t.fromLocationName}</span>
                                        </div>
                                        <div className="route-arrow">
                                            <ArrowRight size={16} />
                                        </div>
                                        <div className="route-node destination">
                                            <Package size={15} />
                                            <span className="node-name">{t.toLocationName}</span>
                                        </div>
                                    </div>

                                    {/* Items Issued */}
                                    <div className="transfer-items-grid">
                                        {t.items.map((it, idx) => (
                                            <div key={idx} className="transfer-item-chip">
                                                <span className="item-qty-badge">{it.quantity} {it.unit}</span>
                                                <span className="item-name-text">{it.itemName}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {t.notes && <p className="transfer-notes-text">💬 {t.notes}</p>}
                                </motion.div>
                            ))}

                            {filteredTransfers.length === 0 && (
                                <div className="wh-empty-state">
                                    <div className="empty-icon-box">
                                        <ArrowRightLeft size={32} />
                                    </div>
                                    <h3>No stock transfers recorded</h3>
                                    <p>Move raw ingredients and supplies from your Godown to Kitchen in 2 clicks.</p>
                                    <button className="wh-btn wh-btn-primary" onClick={() => setShowTransferModal(true)}>
                                        <ArrowRightLeft size={15} /> Create Stock Transfer
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ═════════════════════════════════════════════ */
                    /* ── PILLAR 3: KITCHEN WASTAGE & SPOILAGE ── */
                    /* ═════════════════════════════════════════════ */
                    <div className="wh-tab-content">
                        {/* Wastage Summary Banner */}
                        <div className="wastage-summary-strip">
                            <div className="wastage-metric-card">
                                <span className="metric-label">Total Wastage Logs</span>
                                <span className="metric-value">{wastageList.length} Entries</span>
                            </div>
                            <div className="wastage-metric-card">
                                <span className="metric-label">Est. Wastage Cost</span>
                                <span className="metric-value text-danger">₹{totalWastageCost.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="wastage-metric-card action-card">
                                <button className="wh-btn wh-btn-danger" onClick={() => setShowWastageModal(true)}>
                                    <Trash2 size={15} /> Record New Wastage
                                </button>
                            </div>
                        </div>

                        {/* Wastage Log Table */}
                        <div className="wastage-log-container">
                            <div className="wastage-table-wrapper">
                                <table className="wh-table">
                                    <thead>
                                        <tr>
                                            <th>ITEM</th>
                                            <th>WASTED QTY</th>
                                            <th>LOCATION</th>
                                            <th>REASON</th>
                                            <th>LOGGED AT</th>
                                            <th>NOTES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredWastage.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="table-empty-cell">
                                                    No wastage recorded yet. Clean operations!
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredWastage.map((w) => {
                                                const reasonInfo = getReasonLabel(w.reason);
                                                const ReasonIcon = reasonInfo.icon;
                                                return (
                                                    <tr key={w.id}>
                                                        <td className="font-bold text-primary-cell">
                                                            {w.itemName}
                                                        </td>
                                                        <td>
                                                            <span className="qty-tag danger">
                                                                {w.quantity} {w.unit}
                                                            </span>
                                                        </td>
                                                        <td>{w.locationName}</td>
                                                        <td>
                                                            <span className="reason-pill">
                                                                <ReasonIcon size={12} className={reasonInfo.color} />
                                                                <span>{reasonInfo.label}</span>
                                                            </span>
                                                        </td>
                                                        <td className="text-muted-cell">
                                                            {formatDateTimeHuman(w.createdAt)}
                                                        </td>
                                                        <td className="notes-cell">
                                                            {w.notes || '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═════════════════════════════════════════════ */}
            /* ── MODAL 1: ADD STORAGE GODOWN ── */
            /* ═════════════════════════════════════════════ */
            <AnimatePresence>
                {showAddGodown && (
                    <motion.div
                        className="wh-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddGodown(false)}
                    >
                        <motion.div
                            className="wh-modal-card"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="wh-modal-header">
                                <h3>Add Storage Location</h3>
                                <button className="wh-modal-close" onClick={() => setShowAddGodown(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="wh-modal-body">
                                <div className="wh-form-group">
                                    <label>Location Name *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Main Godown, Kitchen Prep, Bar Store"
                                        value={newGodown.name}
                                        onChange={(e) => setNewGodown({ ...newGodown, name: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                <div className="wh-form-group">
                                    <label>Storage Type</label>
                                    <div className="wh-type-selector">
                                        {[
                                            { key: 'GODOWN', label: 'Main Godown' },
                                            { key: 'KITCHEN', label: 'Kitchen Store' },
                                            { key: 'BAR', label: 'Bar / Counter' },
                                            { key: 'COLD_STORAGE', label: 'Cold Storage' }
                                        ].map((t) => (
                                            <button
                                                key={t.key}
                                                type="button"
                                                className={`wh-type-pill ${newGodown.type === t.key ? 'active' : ''}`}
                                                onClick={() => setNewGodown({ ...newGodown, type: t.key as any })}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="wh-form-group">
                                    <label>Description / Notes (Optional)</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Storage purpose, room details, or notes..."
                                        value={newGodown.description}
                                        onChange={(e) => setNewGodown({ ...newGodown, description: e.target.value })}
                                    />
                                </div>

                                <label className="wh-checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={newGodown.isMain}
                                        onChange={(e) => setNewGodown({ ...newGodown, isMain: e.target.checked })}
                                    />
                                    <span>Set as Primary / Default Godown</span>
                                </label>
                            </div>

                            <div className="wh-modal-footer">
                                <button className="wh-btn wh-btn-secondary" onClick={() => setShowAddGodown(false)}>
                                    Cancel
                                </button>
                                <button className="wh-btn wh-btn-primary" onClick={handleCreateGodown}>
                                    Create Location
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═════════════════════════════════════════════ */}
            /* ── MODAL 2: QUICK STOCK TRANSFER ── */
            /* ═════════════════════════════════════════════ */
            <AnimatePresence>
                {showTransferModal && (
                    <motion.div
                        className="wh-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowTransferModal(false)}
                    >
                        <motion.div
                            className="wh-modal-card transfer-modal-card"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="wh-modal-header">
                                <h3>Create Stock Transfer / Issue</h3>
                                <button className="wh-modal-close" onClick={() => setShowTransferModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="wh-modal-body">
                                {/* Route Selection */}
                                <div className="transfer-route-grid">
                                    <div className="wh-form-group">
                                        <label>From Storage</label>
                                        <select
                                            value={transferForm.fromLocationId}
                                            onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
                                        >
                                            <option value="">Select source location</option>
                                            {godowns.map(g => (
                                                <option key={g.id} value={g.id}>{g.name} ({g.type})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="route-divider-icon">
                                        <ArrowRight size={20} />
                                    </div>

                                    <div className="wh-form-group">
                                        <label>To Storage (e.g. Kitchen)</label>
                                        <select
                                            value={transferForm.toLocationId}
                                            onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                                        >
                                            <option value="">Select destination location</option>
                                            {godowns.map(g => (
                                                <option key={g.id} value={g.id}>{g.name} ({g.type})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Items Multi-Row List */}
                                <div className="transfer-items-form">
                                    <div className="items-header-row">
                                        <label>Items to Issue / Transfer</label>
                                    </div>

                                    {transferForm.items.map((it, idx) => {
                                        const selectedInv = inventoryItems.find(i => i.id === it.inventoryItemId);
                                        return (
                                            <div key={idx} className="transfer-item-form-row">
                                                <div className="item-select-col">
                                                    <select
                                                        value={it.inventoryItemId}
                                                        onChange={(e) => {
                                                            const copy = [...transferForm.items];
                                                            copy[idx].inventoryItemId = e.target.value;
                                                            setTransferForm({ ...transferForm, items: copy });
                                                        }}
                                                    >
                                                        <option value="">Select Raw Ingredient / Item</option>
                                                        {inventoryItems.map(inv => (
                                                            <option key={inv.id} value={inv.id}>
                                                                {inv.name} ({inv.unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="item-qty-col">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.1"
                                                        placeholder="Qty"
                                                        value={it.quantity || ''}
                                                        onChange={(e) => {
                                                            const copy = [...transferForm.items];
                                                            copy[idx].quantity = Number(e.target.value);
                                                            setTransferForm({ ...transferForm, items: copy });
                                                        }}
                                                    />
                                                    <span className="unit-label">{selectedInv?.unit || 'qty'}</span>
                                                </div>

                                                {transferForm.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="remove-row-btn"
                                                        onClick={() => {
                                                            const copy = transferForm.items.filter((_, i) => i !== idx);
                                                            setTransferForm({ ...transferForm, items: copy });
                                                        }}
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        className="add-line-item-btn"
                                        onClick={() => {
                                            setTransferForm({
                                                ...transferForm,
                                                items: [...transferForm.items, { inventoryItemId: '', quantity: 1, notes: '' }]
                                            });
                                        }}
                                    >
                                        <Plus size={14} /> Add Another Item
                                    </button>
                                </div>

                                <div className="wh-form-group">
                                    <label>Remarks / Transfer Reason (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Daily morning kitchen prep issue"
                                        value={transferForm.notes}
                                        onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="wh-modal-footer">
                                <button className="wh-btn wh-btn-secondary" onClick={() => setShowTransferModal(false)}>
                                    Cancel
                                </button>
                                <button className="wh-btn wh-btn-primary" onClick={handleCreateTransfer}>
                                    Complete Transfer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═════════════════════════════════════════════ */}
            /* ── MODAL 3: RECORD KITCHEN WASTAGE ── */
            /* ═════════════════════════════════════════════ */
            <AnimatePresence>
                {showWastageModal && (
                    <motion.div
                        className="wh-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowWastageModal(false)}
                    >
                        <motion.div
                            className="wh-modal-card"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="wh-modal-header">
                                <h3>Record Kitchen Wastage</h3>
                                <button className="wh-modal-close" onClick={() => setShowWastageModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="wh-modal-body">
                                <div className="wh-form-group">
                                    <label>Wasted Item *</label>
                                    <select
                                        value={wastageForm.inventoryItemId}
                                        onChange={(e) => setWastageForm({ ...wastageForm, inventoryItemId: e.target.value })}
                                        autoFocus
                                    >
                                        <option value="">Select ingredient / item</option>
                                        {inventoryItems.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.name} ({inv.unit})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="wh-form-row">
                                    <div className="wh-form-group">
                                        <label>Wasted Quantity *</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.1"
                                            placeholder="e.g. 2"
                                            value={wastageForm.quantity || ''}
                                            onChange={(e) => setWastageForm({ ...wastageForm, quantity: Number(e.target.value) })}
                                        />
                                    </div>

                                    <div className="wh-form-group">
                                        <label>Storage / Location</label>
                                        <select
                                            value={wastageForm.locationId}
                                            onChange={(e) => setWastageForm({ ...wastageForm, locationId: e.target.value })}
                                        >
                                            {godowns.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="wh-form-group">
                                    <label>Wastage Reason</label>
                                    <div className="wh-reason-pills">
                                        {[
                                            { key: 'SPOILED', label: 'Spoiled / Expired' },
                                            { key: 'BURNT_LOSS', label: 'Cooking / Burnt Loss' },
                                            { key: 'DAMAGED', label: 'Damaged / Dropped' },
                                            { key: 'QUALITY_ISSUE', label: 'Quality Rejected' },
                                            { key: 'STAFF_MEAL', label: 'Staff Meal / Tasting' }
                                        ].map((r) => (
                                            <button
                                                key={r.key}
                                                type="button"
                                                className={`wh-reason-pill ${wastageForm.reason === r.key ? 'active' : ''}`}
                                                onClick={() => setWastageForm({ ...wastageForm, reason: r.key })}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="wh-form-group">
                                    <label>Notes / Explanation (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Milk packet leaked overnight in fridge"
                                        value={wastageForm.notes}
                                        onChange={(e) => setWastageForm({ ...wastageForm, notes: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="wh-modal-footer">
                                <button className="wh-btn wh-btn-secondary" onClick={() => setShowWastageModal(false)}>
                                    Cancel
                                </button>
                                <button className="wh-btn wh-btn-danger" onClick={handleLogWastage}>
                                    Record Wastage
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
