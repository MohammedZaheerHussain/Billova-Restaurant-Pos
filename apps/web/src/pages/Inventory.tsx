// Inventory Management Page - Premium Glassmorphism UI
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Plus, Edit2, Trash2, X, Search,
    TrendingDown, TrendingUp, Bell, Upload, Link2,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryAPI, menuAPI } from '../api';
import { MenuItem } from '../store';
import './Inventory.css';
import { logger } from '../utils/logger';
import { InventorySummaryGrid } from '../components/inventory/InventorySummaryGrid';
import { StockAlertsSidebar } from '../components/inventory/StockAlertsSidebar';

interface InventoryItem {
    id: string;
    sku: string | null;
    name: string;
    category: string;
    unit: string;
    quantity: number;
    minStock: number;
    safetyStock: number;
    reservedQty: number;
    costPerUnit: number;
    expiryDate: string | null;
    stockStatus: string;
    isActive: boolean;
    ingredients?: { menuItem: { id: string; name: string }; quantityUsed: number }[];
    _count?: { transactions: number; alerts: number };
}

interface StockAlert {
    id: string;
    alertType: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    inventoryItem: { id: string; name: string; quantity: number; unit: string };
}

interface DashboardSummary {
    totalItems: number;
    outOfStock: number;
    critical: number;
    lowStock: number;
    sufficient: number;
    unreadAlerts: number;
    pendingApprovals: number;
}

const emptyForm = {
    sku: '',
    name: '',
    category: 'INGREDIENT',
    unit: 'pcs',
    quantity: '',
    minStock: '',
    safetyStock: '',
    costPerUnit: '',
    expiryDate: '',
};

interface MenuLink {
    menuItemId: string;
    menuItemName: string;
    quantityUsed: string;
}

const categories = [
    { value: 'INGREDIENT', label: 'Ingredient' },
    { value: 'PACKAGING', label: 'Packaging' },
    { value: 'BEVERAGE', label: 'Beverage' },
    { value: 'RAW_MATERIAL', label: 'Raw Material' },
    { value: 'FINISHED_GOODS', label: 'Finished Goods' },
    { value: 'OTHER', label: 'Other' },
];

const units = ['pcs', 'kg', 'g', 'ltr', 'ml', 'pack', 'box', 'dozen'];

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [linkingItem, setLinkingItem] = useState<InventoryItem | null>(null);
    const [linkForm, setLinkForm] = useState({ menuItemId: '', quantityUsed: '' });
    const [menuLinks, setMenuLinks] = useState<MenuLink[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, [filterStatus, filterCategory]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (filterStatus) params.stockStatus = filterStatus;
            if (filterCategory) params.category = filterCategory;
            if (search) params.search = search;

            const [itemsRes, alertsRes, summaryRes, menuRes] = await Promise.all([
                inventoryAPI.getAll(params),
                inventoryAPI.getAlerts(),
                inventoryAPI.getDashboardSummary(),
                menuAPI.getAll(),
            ]);

            setItems(itemsRes.data);
            setAlerts(alertsRes.data);
            setSummary(summaryRes.data);
            setMenuItems(menuRes.data);
        } catch (error) {
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchData();
    };

    const openAddModal = () => {
        setEditingItem(null);
        setForm(emptyForm);
        setMenuLinks([]);
        setShowModal(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setEditingItem(item);
        setForm({
            sku: item.sku || '',
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantity: String(item.quantity),
            minStock: String(item.minStock),
            safetyStock: String(item.safetyStock),
            costPerUnit: String(item.costPerUnit),
            expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setForm(emptyForm);
        setMenuLinks([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.unit) {
            toast.error('Name and unit are required');
            return;
        }

        try {
            const data = {
                ...form,
                quantity: Number(form.quantity) || 0,
                minStock: Number(form.minStock) || 0,
                safetyStock: Number(form.safetyStock) || 0,
                costPerUnit: Number(form.costPerUnit) || 0,
                expiryDate: form.expiryDate || null,
            };

            if (editingItem) {
                await inventoryAPI.update(editingItem.id, data);
                toast.success('Item updated successfully');
            } else {
                const result = await inventoryAPI.create(data);
                const newItemId = result.data.id;

                // Link menu items if any were added
                for (const link of menuLinks) {
                    try {
                        await inventoryAPI.linkMenuItem({
                            inventoryItemId: newItemId,
                            menuItemId: link.menuItemId,
                            quantityUsed: Number(link.quantityUsed),
                        });
                    } catch (e) {
                        logger.error('Failed to link:', link.menuItemName);
                    }
                }

                toast.success(`Item created${menuLinks.length > 0 ? ' with menu links' : ''} successfully`);
            }

            closeModal();
            fetchData();
        } catch (error) {
            toast.error('Failed to save item');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await inventoryAPI.delete(id);
            toast.success('Item deleted');
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete item');
        }
    };

    const handleAdjust = async (item: InventoryItem, type: 'INCREASE' | 'DECREASE') => {
        const qty = prompt(`Enter quantity to ${type.toLowerCase()}:`);
        if (!qty || isNaN(Number(qty))) return;

        const reason = prompt('Reason for adjustment:');
        if (!reason) return;

        try {
            const result = await inventoryAPI.requestAdjustment(item.id, {
                adjustmentType: type,
                quantity: Number(qty),
                reason,
            });

            if (result.data.approved) {
                toast.success('Stock adjusted successfully');
            } else {
                toast.success('Adjustment request submitted for approval');
            }
            fetchData();
        } catch (error) {
            toast.error('Failed to adjust stock');
        }
    };

    const handleMarkAlertRead = async (alertId: string) => {
        try {
            await inventoryAPI.markAlertRead(alertId);
            setAlerts(alerts.filter(a => a.id !== alertId));
            if (summary) setSummary({ ...summary, unreadAlerts: summary.unreadAlerts - 1 });
        } catch (error) {
            toast.error('Failed to mark alert as read');
        }
    };

    const handleMarkAllAlertsRead = async () => {
        try {
            await inventoryAPI.markAllAlertsRead();
            setAlerts([]);
            if (summary) setSummary({ ...summary, unreadAlerts: 0 });
            toast.success('All alerts marked as read');
        } catch (error) {
            toast.error('Failed to mark alerts as read');
        }
    };

    const openLinkModal = (item: InventoryItem) => {
        setLinkingItem(item);
        setLinkForm({ menuItemId: '', quantityUsed: '' });
        setShowLinkModal(true);
    };

    const handleLinkMenuItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkingItem || !linkForm.menuItemId || !linkForm.quantityUsed) return;

        try {
            await inventoryAPI.linkMenuItem({
                inventoryItemId: linkingItem.id,
                menuItemId: linkForm.menuItemId,
                quantityUsed: Number(linkForm.quantityUsed),
            });
            toast.success('Menu item linked successfully');
            setShowLinkModal(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to link menu item');
        }
    };

    const handleUnlinkMenuItem = async (menuItemId: string, inventoryItemId: string) => {
        try {
            await inventoryAPI.unlinkMenuItem(menuItemId, inventoryItemId);
            toast.success('Menu item unlinked');
            fetchData();
        } catch (error) {
            toast.error('Failed to unlink menu item');
        }
    };

    const handleBatchImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Parse CSV
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim());
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

                const items = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    const item: any = {};
                    headers.forEach((h, idx) => {
                        item[h] = values[idx]?.trim();
                    });
                    items.push(item);
                }

                const result = await inventoryAPI.batchImport({ items, fileName: file.name });
                toast.success(`Imported ${result.data.successCount} items. ${result.data.failedCount} failed.`);
                fetchData();
            } catch (error) {
                toast.error('Failed to parse CSV file');
            }
        };
        reader.readAsText(file);

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUFFICIENT': return 'status-sufficient';
            case 'LOW_STOCK': return 'status-low';
            case 'CRITICAL': return 'status-critical';
            case 'OUT_OF_STOCK': return 'status-out';
            default: return '';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'SUFFICIENT': return 'Sufficient';
            case 'LOW_STOCK': return 'Low Stock';
            case 'CRITICAL': return 'Critical';
            case 'OUT_OF_STOCK': return 'Out of Stock';
            default: return status;
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="inventory-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>📦 Inventory Management</h1>
                    <p>Track stock levels, consumption, and alerts</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-glass" onClick={() => setShowAlerts(true)}>
                        <Bell size={18} />
                        {summary && summary.unreadAlerts > 0 && (
                            <span className="badge-count">{summary.unreadAlerts}</span>
                        )}
                    </button>
                    <label className="btn btn-glass">
                        <Upload size={18} /> Import CSV
                        <input
                            type="file"
                            accept=".csv"
                            hidden
                            ref={fileInputRef}
                            onChange={handleBatchImport}
                        />
                    </label>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} /> Add Item
                    </button>
                </div>
            </div>

            {/* Dashboard Summary Cards */}
            {summary && <InventorySummaryGrid summary={summary} />}

            {/* Filters */}
            <div className="filters-bar glass-card">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>

                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Status</option>
                    <option value="SUFFICIENT">Sufficient</option>
                    <option value="LOW_STOCK">Low Stock</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>

                <button className="btn btn-glass" onClick={fetchData}>
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Inventory Table */}
            <div className="inventory-table-container glass-card">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="empty-state">
                        <Package size={48} />
                        <p>No inventory items found</p>
                        <button className="btn btn-primary" onClick={openAddModal}>
                            Add First Item
                        </button>
                    </div>
                ) : (
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Min Stock</th>
                                <th>Status</th>
                                <th>Cost/Unit</th>
                                <th>Menu Links</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence>
                                {filteredItems.map((item, index) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: index * 0.03 }}
                                    >
                                        <td>
                                            <div className="item-name">
                                                <strong>{item.name}</strong>
                                                {item.sku && <span className="sku">SKU: {item.sku}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="category-badge">
                                                {categories.find(c => c.value === item.category)?.label || item.category}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="stock-cell">
                                                <motion.span
                                                    className="stock-qty"
                                                    key={item.quantity}
                                                    initial={{ scale: 1.2 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    {item.quantity}
                                                </motion.span>
                                                <span className="unit">{item.unit}</span>
                                                {item.reservedQty > 0 && (
                                                    <span className="reserved">({item.reservedQty} reserved)</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{item.minStock} {item.unit}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusColor(item.stockStatus)}`}>
                                                {getStatusLabel(item.stockStatus)}
                                            </span>
                                        </td>
                                        <td>₹{item.costPerUnit}</td>
                                        <td>
                                            <div className="menu-links">
                                                {item.ingredients && item.ingredients.length > 0 ? (
                                                    <div className="linked-items">
                                                        {item.ingredients.slice(0, 2).map((ing) => (
                                                            <span
                                                                key={ing.menuItem.id}
                                                                className="linked-tag"
                                                                title={`${ing.quantityUsed} ${item.unit} per item`}
                                                            >
                                                                {ing.menuItem.name}
                                                                <button
                                                                    className="unlink-btn"
                                                                    onClick={() => handleUnlinkMenuItem(ing.menuItem.id, item.id)}
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                        {item.ingredients.length > 2 && (
                                                            <span className="more-links">+{item.ingredients.length - 2}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="no-links">Not linked</span>
                                                )}
                                                <button
                                                    className="btn-link-small"
                                                    onClick={() => openLinkModal(item)}
                                                    title="Link menu item"
                                                >
                                                    <Link2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-action increase"
                                                    onClick={() => handleAdjust(item, 'INCREASE')}
                                                    title="Increase stock"
                                                >
                                                    <TrendingUp size={16} />
                                                </button>
                                                <button
                                                    className="btn-action decrease"
                                                    onClick={() => handleAdjust(item, 'DECREASE')}
                                                    title="Decrease stock"
                                                >
                                                    <TrendingDown size={16} />
                                                </button>
                                                <button
                                                    className="btn-action edit"
                                                    onClick={() => openEditModal(item)}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn-action delete"
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeModal}
                    >
                        <motion.div
                            className="modal glass-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</h2>
                                <button className="close-btn" onClick={closeModal}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="modal-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>SKU (Optional)</label>
                                        <input
                                            type="text"
                                            value={form.sku}
                                            onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                            placeholder="e.g., BUN-001"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g., Burger Buns"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select
                                            value={form.category}
                                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                                        >
                                            {categories.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Unit *</label>
                                        <select
                                            value={form.unit}
                                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                        >
                                            {units.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Initial Quantity</label>
                                        <input
                                            type="number"
                                            value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                                            placeholder="0"
                                            min="0"
                                            step="0.001"
                                            disabled={!!editingItem}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Min Stock Level</label>
                                        <input
                                            type="number"
                                            value={form.minStock}
                                            onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                                            placeholder="10"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Safety Stock</label>
                                        <input
                                            type="number"
                                            value={form.safetyStock}
                                            onChange={(e) => setForm({ ...form, safetyStock: e.target.value })}
                                            placeholder="5"
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Cost per Unit (₹)</label>
                                        <input
                                            type="number"
                                            value={form.costPerUnit}
                                            onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                {/* Menu Item Consumption Mapping - Only show when creating new items */}
                                {!editingItem && (
                                    <div className="menu-linking-section">
                                        <label className="section-label">
                                            <Link2 size={16} /> Menu Item Usage (How much consumed per order)
                                        </label>

                                        {menuLinks.length > 0 && (
                                            <div className="linked-menu-items">
                                                {menuLinks.map((link, idx) => (
                                                    <div key={idx} className="linked-item-row">
                                                        <span className="linked-menu-name">{link.menuItemName}</span>
                                                        <span className="linked-qty">{link.quantityUsed} {form.unit} per order</span>
                                                        <button
                                                            type="button"
                                                            className="btn-remove"
                                                            onClick={() => setMenuLinks(menuLinks.filter((_, i) => i !== idx))}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="add-menu-link-row">
                                            <select
                                                value={linkForm.menuItemId}
                                                onChange={(e) => setLinkForm({ ...linkForm, menuItemId: e.target.value })}
                                                className="menu-select"
                                            >
                                                <option value="">Select menu item...</option>
                                                {menuItems.filter(m => !menuLinks.some(l => l.menuItemId === m.id)).map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="Qty used"
                                                value={linkForm.quantityUsed}
                                                onChange={(e) => setLinkForm({ ...linkForm, quantityUsed: e.target.value })}
                                                min="0.001"
                                                step="0.001"
                                                className="qty-input"
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-glass"
                                                disabled={!linkForm.menuItemId || !linkForm.quantityUsed}
                                                onClick={() => {
                                                    const selectedMenu = menuItems.find(m => m.id === linkForm.menuItemId);
                                                    if (selectedMenu && linkForm.quantityUsed) {
                                                        setMenuLinks([...menuLinks, {
                                                            menuItemId: linkForm.menuItemId,
                                                            menuItemName: selectedMenu.name,
                                                            quantityUsed: linkForm.quantityUsed,
                                                        }]);
                                                        setLinkForm({ menuItemId: '', quantityUsed: '' });
                                                    }
                                                }}
                                            >
                                                <Plus size={14} /> Add
                                            </button>
                                        </div>
                                        <p className="help-text">
                                            Link menu items to auto-deduct stock when orders are placed
                                        </p>
                                    </div>
                                )}

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {editingItem ? 'Update Item' : 'Add Item'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alerts Sidebar */}
            <StockAlertsSidebar
                showAlerts={showAlerts}
                alerts={alerts}
                onClose={() => setShowAlerts(false)}
                onMarkRead={handleMarkAlertRead}
                onMarkAllRead={handleMarkAllAlertsRead}
            />

            {/* Link Menu Item Modal */}
            <AnimatePresence>
                {showLinkModal && linkingItem && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLinkModal(false)}
                    >
                        <motion.div
                            className="modal glass-modal small"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>Link to Menu Item</h2>
                                <button className="close-btn" onClick={() => setShowLinkModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleLinkMenuItem} className="modal-form">
                                <p className="link-info">
                                    Link <strong>{linkingItem.name}</strong> to a menu item and specify
                                    how much is consumed per order.
                                </p>

                                <div className="form-group">
                                    <label>Menu Item</label>
                                    <select
                                        value={linkForm.menuItemId}
                                        onChange={(e) => setLinkForm({ ...linkForm, menuItemId: e.target.value })}
                                        required
                                    >
                                        <option value="">Select menu item</option>
                                        {menuItems.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Quantity Used per Item ({linkingItem.unit})</label>
                                    <input
                                        type="number"
                                        value={linkForm.quantityUsed}
                                        onChange={(e) => setLinkForm({ ...linkForm, quantityUsed: e.target.value })}
                                        placeholder="e.g., 2"
                                        min="0.001"
                                        step="0.001"
                                        required
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowLinkModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        <Link2 size={16} /> Link Item
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
