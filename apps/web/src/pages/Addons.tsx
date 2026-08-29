// Addons Management Page - Extras & Customizations
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Edit2, Trash2, Tag, DollarSign, Folder } from 'lucide-react';
import toast from 'react-hot-toast';
import { addonsAPI } from '../api';
import useSubscription from '../hooks/useSubscription';
import './Addons.css';

interface Addon {
    id: string;
    name: string;
    price: number;
    category: string;
    isActive: boolean;
}

const ADDON_CATEGORIES = [
    { value: 'Extras', label: '➕ Extras', color: '#22c55e' },
    { value: 'Remove', label: '➖ Remove', color: '#ef4444' },
    { value: 'Customize', label: '⚙️ Customize', color: '#3b82f6' },
    { value: 'Toppings', label: '🧀 Toppings', color: '#f59e0b' },
    { value: 'Sauce', label: '🍯 Sauce', color: '#8b5cf6' },
];

export default function AddonsPage() {
    const [addons, setAddons] = useState<Addon[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        category: 'Extras',
    });
    const [filterCategory, setFilterCategory] = useState('all');

    const { hasFeature } = useSubscription();
    const canUseAddons = hasFeature('inventory'); // Plus+ feature

    useEffect(() => {
        fetchAddons();
    }, []);

    const fetchAddons = async () => {
        try {
            setLoading(true);
            const response = await addonsAPI.getAll();
            setAddons(response.data);
        } catch (error) {
            toast.error('Failed to load addons');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Addon name is required');
            return;
        }

        try {
            setSaving(true);
            if (editingAddon) {
                await addonsAPI.update(editingAddon.id, {
                    name: formData.name,
                    price: parseFloat(formData.price) || 0,
                    category: formData.category,
                });
                toast.success('Addon updated!');
            } else {
                await addonsAPI.create({
                    name: formData.name,
                    price: parseFloat(formData.price) || 0,
                    category: formData.category,
                });
                toast.success('Addon created!');
            }
            setShowModal(false);
            setEditingAddon(null);
            setFormData({ name: '', price: '', category: 'Extras' });
            fetchAddons();
        } catch (error) {
            toast.error('Failed to save addon');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (addon: Addon) => {
        setEditingAddon(addon);
        setFormData({
            name: addon.name,
            price: addon.price.toString(),
            category: addon.category,
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this addon?')) return;
        try {
            await addonsAPI.delete(id);
            toast.success('Addon deleted');
            fetchAddons();
        } catch (error) {
            toast.error('Failed to delete addon');
        }
    };

    const getCategoryColor = (category: string) => {
        return ADDON_CATEGORIES.find(c => c.value === category)?.color || '#6b7280';
    };

    const filteredAddons = filterCategory === 'all'
        ? addons
        : addons.filter(a => a.category === filterCategory);

    if (!canUseAddons) {
        return (
            <div className="addons-page">
                <div className="upgrade-message">
                    <div className="upgrade-icon">🔒</div>
                    <h2>Addons Feature</h2>
                    <p>Upgrade to <strong>Plus</strong> or <strong>Premium</strong> to create extras like cheese, toppings, and customizations for your menu items.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="addons-page">
            <div className="page-header">
                <div>
                    <h1>Extras & Addons</h1>
                    <p>Manage customizations like extra cheese, toppings, and removals</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingAddon(null);
                    setFormData({ name: '', price: '', category: 'Extras' });
                    setShowModal(true);
                }}>
                    <Plus size={18} /> Add Addon
                </button>
            </div>

            {/* Category Filter */}
            <div className="category-filter">
                <button
                    className={`filter-btn ${filterCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('all')}
                >
                    All ({addons.length})
                </button>
                {ADDON_CATEGORIES.map(cat => {
                    const count = addons.filter(a => a.category === cat.value).length;
                    return (
                        <button
                            key={cat.value}
                            className={`filter-btn ${filterCategory === cat.value ? 'active' : ''}`}
                            onClick={() => setFilterCategory(cat.value)}
                            style={{ '--cat-color': cat.color } as any}
                        >
                            {cat.label} ({count})
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /></div>
            ) : filteredAddons.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon-box">
                        <Tag size={36} strokeWidth={1.5} />
                    </div>
                    <h3>No Addons Yet</h3>
                    <p>Create addons like "Extra Cheese", "No Onion", etc.</p>
                </div>
            ) : (
                <div className="addons-grid">
                    {filteredAddons.map(addon => (
                        <motion.div
                            key={addon.id}
                            className="addon-card"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="addon-header">
                                <span
                                    className="addon-category"
                                    style={{ backgroundColor: getCategoryColor(addon.category) + '20', color: getCategoryColor(addon.category) }}
                                >
                                    {addon.category}
                                </span>
                                <div className="addon-actions">
                                    <button onClick={() => handleEdit(addon)}><Edit2 size={14} /></button>
                                    <button onClick={() => handleDelete(addon.id)} className="danger"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <h3 className="addon-name">{addon.name}</h3>
                            <p className="addon-price">
                                {addon.price > 0 ? `+₹${addon.price}` : 'Free'}
                            </p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            className="modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>{editingAddon ? 'Edit Addon' : 'Add New Addon'}</h2>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="modal-form">
                                <div className="form-group">
                                    <label><Tag size={14} /> Addon Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Extra Cheese, No Onion"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label><DollarSign size={14} /> Extra Price (₹)</label>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label><Folder size={14} /> Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            {ADDON_CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="spinner" /> : (editingAddon ? 'Update Addon' : 'Create Addon')}
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
