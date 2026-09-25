// Menu Management Page
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Upload, FileImage, Sparkles, Loader, UtensilsCrossed, Search, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { menuAPI, categoriesAPI } from '../api';
import { useAuthStore, MenuItem, Category } from '../store';
import './Menu.css';

interface MenuItemForm {
    name: string;
    description: string;
    price: string;
    categoryId: string;
    isVeg: boolean;
    hasGST: boolean;
    gstPercent: string;
}

const emptyForm: MenuItemForm = {
    name: '',
    description: '',
    price: '',
    categoryId: '',
    isVeg: false,
    hasGST: true,
    gstPercent: '5',
};

// Rich collection of food, beverage, dessert, and dining emojis
const CATEGORY_ICONS = [
    // Mains & Fast Food
    '🍽️', '🍕', '🍔', '🌭', '🥪', '🌮', '🌯', '🥙',
    '🍗', '🍖', '🥩', '🍳', '🍤', '🍢', '🍟', '🍿',
    // Asian, Indian, Rice & Soups
    '🍛', '🍚', '🍜', '🥟', '🍲', '🍝', '🍣', '🧆',
    // Desserts, Bakery & Sweets
    '🍰', '🧁', '🍨', '🍦', '🍩', '🧇', '🥞', '🥧',
    '🍫', '🍪', '🥐', '🍞',
    // Beverages & Drinks
    '🥤', '🧃', '🧋', '☕', '🍵', '🍹', '🍺', '🥛',
    '🧊', '🥗', '🍱', '🥡'
];

export default function MenuPage() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const user = useAuthStore((state) => state.user);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [form, setForm] = useState<MenuItemForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Inline Category Creator inside Add/Edit Item Modal
    const [showInlineNewCat, setShowInlineNewCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('🍽️');
    const [creatingCat, setCreatingCat] = useState(false);

    const menuCardInputRef = useRef<HTMLInputElement>(null);

    // Menu Card Upload
    const [showMenuCardModal, setShowMenuCardModal] = useState(false);
    const [menuCardImage, setMenuCardImage] = useState<string>('');
    const [extractedItems, setExtractedItems] = useState<Array<{ name: string; price: string; isVeg: boolean; categoryId: string }>>([]);
    const [extracting, setExtracting] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [menuRes, catRes] = await Promise.all([
                menuAPI.getAll(user?.branch?.id),
                categoriesAPI.getAll(user?.branch?.id),
            ]);
            setItems(menuRes.data);
            setCategories(catRes.data);
        } catch (error) {
            toast.error('Failed to load menu');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAvailability = async (id: string) => {
        try {
            await menuAPI.toggleAvailability(id);
            fetchData();
            toast.success('Availability updated');
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const openAddModal = () => {
        setEditingItem(null);
        const defaultCatId = categories[0]?.id || '';
        setForm({ ...emptyForm, categoryId: defaultCatId });
        setShowInlineNewCat(categories.length === 0);
        setNewCatName('');
        setNewCatIcon('🍽️');
        setShowModal(true);
    };

    const openEditModal = (item: MenuItem) => {
        setEditingItem(item);
        setForm({
            name: item.name,
            description: (item as any).description || '',
            price: String(item.price),
            categoryId: item.categoryId,
            isVeg: item.isVeg,
            hasGST: (item as any).hasGST !== false,
            gstPercent: String((item as any).gstPercent || 5),
        });
        setShowInlineNewCat(false);
        setNewCatName('');
        setNewCatIcon('🍽️');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setForm(emptyForm);
        setShowInlineNewCat(false);
        setNewCatName('');
        setNewCatIcon('🍽️');
    };

    // Quick inline category creation inside Add/Edit Item modal
    const handleCreateCategoryInline = async () => {
        if (!newCatName.trim()) {
            toast.error('Please enter category name');
            return;
        }
        try {
            setCreatingCat(true);
            const res = await categoriesAPI.create({
                name: newCatName.trim(),
                icon: newCatIcon || '🍽️',
                branchId: user?.branch?.id,
            });
            const createdCat = res.data;
            toast.success(`Category "${createdCat.name}" created!`);

            // Add to categories list and select it immediately
            const updatedCategories = [...categories, createdCat];
            setCategories(updatedCategories);
            setForm((prev) => ({ ...prev, categoryId: createdCat.id }));

            // Close inline creator and reset
            setShowInlineNewCat(false);
            setNewCatName('');
            setNewCatIcon('🍽️');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create category');
        } finally {
            setCreatingCat(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // If user typed a category name in inline creator, auto-create it seamlessly
        let activeCategoryId = form.categoryId;
        if (showInlineNewCat && newCatName.trim()) {
            try {
                setSaving(true);
                const res = await categoriesAPI.create({
                    name: newCatName.trim(),
                    icon: newCatIcon || '🍽️',
                    branchId: user?.branch?.id,
                });
                const createdCat = res.data;
                setCategories((prev) => [...prev, createdCat]);
                activeCategoryId = createdCat.id;
            } catch (err: any) {
                toast.error(err.response?.data?.error || 'Failed to create category');
                setSaving(false);
                return;
            }
        }

        if (!form.name || !form.price || !activeCategoryId) {
            toast.error('Please fill in item name, price, and category');
            return;
        }

        try {
            setSaving(true);
            const data = {
                name: form.name,
                description: form.description || undefined,
                price: parseFloat(form.price),
                categoryId: activeCategoryId,
                branchId: user?.branch?.id,
                isVeg: form.isVeg,
                hasGST: form.hasGST,
                gstPercent: parseFloat(form.gstPercent) || 5,
            };

            if (editingItem) {
                await menuAPI.update(editingItem.id, data);
                toast.success('Item updated!');
            } else {
                await menuAPI.create(data);
                toast.success('Item added!');
            }

            closeModal();
            fetchData();
        } catch (error: any) {
            toast.error(error?.message || error.response?.data?.error || 'Failed to save item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await menuAPI.delete(id);
            toast.success('Item deleted');
            setDeleteConfirm(null);
            fetchData();
        } catch (error) {
            toast.error('Failed to delete item');
        }
    };

    // Handle Menu Card Upload
    const handleMenuCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setMenuCardImage(reader.result as string);
            setExtractedItems([]);
        };
        reader.readAsDataURL(file);
    };

    // Extract items from menu card using backend AI
    const handleExtractItems = async () => {
        if (!menuCardImage) {
            toast.error('Please upload a menu card image first');
            return;
        }

        setExtracting(true);

        try {
            // Call Groq AI Vision to extract items from menu card
            const response = await menuAPI.extractMenuCard(menuCardImage, user?.branch?.id);
            const { items, message } = response.data;

            // Give each item a stable unique ID for clean React keying
            const itemsWithKeys = (items || []).map((it: any, idx: number) => ({
                ...it,
                _id: `ext_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            }));

            setExtractedItems(itemsWithKeys);

            // Refresh categories in case new ones were created
            const catRes = await categoriesAPI.getAll(user?.branch?.id);
            setCategories(catRes.data);

            toast.success(message || `Extracted ${itemsWithKeys.length} items!`);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to extract items');
        } finally {
            setExtracting(false);
        }
    };

    // Import extracted items
    const handleImportItems = async () => {
        if (extractedItems.length === 0) return;

        setImporting(true);
        let successCount = 0;
        let failCount = 0;
        const currentBranchId = user?.branch?.id;

        try {
            for (const item of extractedItems) {
                try {
                    const priceVal = typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0;
                    await menuAPI.create({
                        name: item.name,
                        price: priceVal,
                        categoryId: (item.categoryId && item.categoryId.trim() !== '') ? item.categoryId : undefined,
                        branchId: currentBranchId,
                        isVeg: Boolean(item.isVeg),
                        hasGST: true,
                        gstPercent: 5,
                    });
                    successCount++;
                } catch (err) {
                    console.error('Failed to import menu item:', item.name, err);
                    failCount++;
                }
            }
            if (successCount > 0) toast.success(`🎉 Successfully saved ${successCount} items to your menu!`);
            if (failCount > 0) toast.error(`⚠️ ${failCount} items failed to save.`);
            try { await menuAPI.cleanDuplicates(currentBranchId); } catch {}
            setShowMenuCardModal(false);
            setMenuCardImage('');
            setExtractedItems([]);
            fetchData();
        } finally {
            setImporting(false);
        }
    };

    // Update extracted item
    const updateExtractedItem = (index: number, field: string, value: any) => {
        const updated = [...extractedItems];
        updated[index] = { ...updated[index], [field]: value };
        setExtractedItems(updated);
    };

    // Remove extracted item
    const removeExtractedItem = (index: number) => {
        setExtractedItems(extractedItems.filter((_, i) => i !== index));
    };

    const filteredItems = items.filter((item) => {
        const catObj = categories.find((c) => c.id === selectedCategory);
        const catIds = catObj && (catObj as any).ids ? (catObj as any).ids : (selectedCategory ? [selectedCategory] : []);
        const matchesCategory = !selectedCategory || item.categoryId === selectedCategory || catIds.includes(item.categoryId);
        const matchesSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="menu-page">
            {/* Header Area */}
            <div className="page-header">
                <div>
                    <h1>Menu Management</h1>
                    <p>{items.length} items across {categories.length} categories</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowMenuCardModal(true)}>
                        <FileImage size={16} /> Upload Menu Card
                    </button>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>
            </div>

            {/* Icebox Style Search & Action Bar */}
            <div className="menu-search-bar-row">
                <div className="menu-search-box">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search products or menu items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="menu-filters">
                <button
                    className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(null)}
                >
                    All Items
                </button>
                {Array.from(new Map(categories.map((c) => [c.name.trim().toLowerCase(), c])).values()).map((cat) => (
                    <button
                        key={cat.id}
                        className={`filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner" /></div>
            ) : filteredItems.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
                    <UtensilsCrossed size={48} strokeWidth={1} />
                    <p style={{ marginTop: 12, fontSize: 15, color: 'var(--text-secondary)' }}>No menu items found</p>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {searchQuery ? `No results matching "${searchQuery}"` : 'Add your first item or try a different category'}
                    </span>
                </div>
            ) : (
                <div className="menu-table-container">
                    <table className="menu-table">
                        <thead>
                            <tr>
                                <th>PRODUCT</th>
                                <th>CATEGORY</th>
                                <th>PRICE</th>
                                <th>STATUS</th>
                                <th style={{ textAlign: 'right' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => {
                                const cat = item.category || categories.find((c) => c.id === item.categoryId);
                                return (
                                    <tr
                                        key={item.id}
                                        className="menu-table-row"
                                    >
                                        <td className="product-col">
                                            <div className="product-item-cell">
                                                <div className="item-image-wrapper">
                                                    <div className="product-thumb-fallback">
                                                        <span>{cat?.icon || '🍽️'}</span>
                                                    </div>
                                                </div>
                                                <div className="product-meta">
                                                    <span className="product-name">{item.name}</span>
                                                    <div className="product-badges-row">
                                                        <span className={item.isVeg ? 'dietary-dot veg' : 'dietary-dot nonveg'}>
                                                            {item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="category-col">
                                            <span className="category-text">{cat?.name || 'General'}</span>
                                        </td>
                                        <td className="price-col">
                                            <span className="price-val">₹{item.price}</span>
                                        </td>
                                        <td className="status-col">
                                            <button
                                                className={`status-pill ${item.isAvailable ? 'active' : 'inactive'}`}
                                                onClick={() => handleToggleAvailability(item.id)}
                                                title="Click to toggle availability"
                                            >
                                                {item.isAvailable ? 'ACTIVE' : 'INACTIVE'}
                                            </button>
                                        </td>
                                        <td className="actions-col" style={{ textAlign: 'right' }}>
                                            <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn-action-icon edit"
                                                    onClick={() => openEditModal(item)}
                                                    title="Edit item"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className={`btn-action-icon power ${item.isAvailable ? 'on' : 'off'}`}
                                                    onClick={() => handleToggleAvailability(item.id)}
                                                    title={item.isAvailable ? 'Deactivate item' : 'Activate item'}
                                                >
                                                    <Power size={16} />
                                                </button>
                                                <button
                                                    className="btn-action-icon delete"
                                                    onClick={() => setDeleteConfirm(item.id)}
                                                    title="Delete item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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
                        onClick={closeModal}
                    >
                        <motion.div
                            className="modal menu-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>{editingItem ? 'Edit Menu Item' : 'Add New Item'}</h2>
                                <button className="modal-close" onClick={closeModal}>
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="menu-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Item Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g., Chicken Biryani"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Price (₹) *</label>
                                        <input
                                            type="number"
                                            value={form.price}
                                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group category-form-group">
                                        {!showInlineNewCat ? (
                                            <>
                                                <div className="category-label-row">
                                                    <label>Category *</label>
                                                    <button
                                                        type="button"
                                                        className="btn-link-action"
                                                        onClick={() => setShowInlineNewCat(true)}
                                                    >
                                                        + New Category
                                                    </button>
                                                </div>
                                                <select
                                                    value={form.categoryId}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__NEW__') {
                                                            setShowInlineNewCat(true);
                                                        } else {
                                                            setForm({ ...form, categoryId: e.target.value });
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select category</option>
                                                    {categories.map((cat) => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.icon || '🍽️'} {cat.name}
                                                        </option>
                                                    ))}
                                                    <option value="__NEW__">✨ + Create New Category...</option>
                                                </select>
                                            </>
                                        ) : (
                                            <div className="inline-category-box">
                                                <div className="inline-category-header">
                                                    <span className="inline-cat-title"><Sparkles size={13} /> Create Category</span>
                                                    {categories.length > 0 && (
                                                        <button
                                                            type="button"
                                                            className="btn-link-action"
                                                            onClick={() => setShowInlineNewCat(false)}
                                                        >
                                                            Select Existing
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="inline-category-row">
                                                    <div className="inline-cat-preview" title="Selected icon">{newCatIcon}</div>
                                                    <input
                                                        type="text"
                                                        className="inline-cat-input"
                                                        value={newCatName}
                                                        onChange={(e) => setNewCatName(e.target.value)}
                                                        placeholder="e.g. Desserts, Soups..."
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleCreateCategoryInline();
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-save-inline-cat"
                                                        onClick={handleCreateCategoryInline}
                                                        disabled={creatingCat || !newCatName.trim()}
                                                    >
                                                        {creatingCat ? <Loader size={13} className="spin" /> : 'Add'}
                                                    </button>
                                                </div>
                                                <div className="inline-icon-palette">
                                                    {CATEGORY_ICONS.slice(0, 16).map((icon) => (
                                                        <button
                                                            key={icon}
                                                            type="button"
                                                            className={`palette-icon-btn ${newCatIcon === icon ? 'selected' : ''}`}
                                                            onClick={() => setNewCatIcon(icon)}
                                                        >
                                                            {icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Food Type</label>
                                        <div className="toggle-group">
                                            <button
                                                type="button"
                                                className={`toggle-option veg-option ${form.isVeg ? 'selected' : ''}`}
                                                onClick={() => setForm({ ...form, isVeg: true })}
                                            >
                                                🟢 Veg
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-option nonveg-option ${!form.isVeg ? 'selected' : ''}`}
                                                onClick={() => setForm({ ...form, isVeg: false })}
                                            >
                                                🔴 Non-Veg
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Brief description of the item..."
                                        rows={2}
                                    />
                                </div>

                                <div className="form-row gst-row">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={form.hasGST}
                                            onChange={(e) => setForm({ ...form, hasGST: e.target.checked })}
                                        />
                                        Include GST
                                    </label>
                                    {form.hasGST && (
                                        <div className="gst-input">
                                            <input
                                                type="number"
                                                value={form.gstPercent}
                                                onChange={(e) => setForm({ ...form, gstPercent: e.target.value })}
                                                min="0"
                                                max="28"
                                            />
                                            <span>%</span>
                                        </div>
                                    )}
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="spinner" /> : (editingItem ? 'Update Item' : 'Add Item')}
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
                                <h3>Delete Item?</h3>
                                <p>This action cannot be undone. The item will be permanently removed.</p>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                                    Cancel
                                </button>
                                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Menu Card Modal */}
            <AnimatePresence>
                {showMenuCardModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowMenuCardModal(false)}
                    >
                        <motion.div
                            className="modal menu-card-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '92%', maxWidth: '780px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                        >
                            <div className="modal-header">
                                <h2><FileImage size={20} className="text-primary" /> Upload Menu Card</h2>
                                <button className="modal-close" onClick={() => setShowMenuCardModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="menu-card-content" style={{ overflowY: 'auto', padding: '20px' }}>
                                {/* Upload Area */}
                                <div
                                    className={`menu-card-upload-box ${menuCardImage ? 'has-image' : ''}`}
                                    onClick={() => menuCardInputRef.current?.click()}
                                >
                                    {menuCardImage ? (
                                        <img src={menuCardImage} alt="Menu Card" className="menu-card-preview-img" />
                                    ) : (
                                        <div className="upload-placeholder">
                                            <Upload size={40} />
                                            <p>Upload your menu card image</p>
                                            <span>JPG, PNG up to 5MB</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={menuCardInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleMenuCardUpload}
                                    style={{ display: 'none' }}
                                />

                                {menuCardImage && !extractedItems.length && (
                                    <button
                                        className="btn btn-primary extract-btn"
                                        onClick={handleExtractItems}
                                        disabled={extracting}
                                        style={{ width: '100%', marginTop: '14px', padding: '12px' }}
                                    >
                                        {extracting ? (
                                            <><Loader size={18} className="spin" /> 🤖 Groq AI Vision is reading your menu...</>
                                        ) : (
                                            <><Sparkles size={18} /> 🤖 Extract Menu Items with Groq AI Vision</>
                                        )}
                                    </button>
                                )}

                                {/* Extracted Items Preview */}
                                {extractedItems.length > 0 && (
                                    <div className="extracted-items-section">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                Extracted Menu Items ({extractedItems.length})
                                            </h4>
                                            <span style={{ fontSize: '12px', color: '#f97316', fontWeight: 500 }}>
                                                ✨ Review & edit extracted items before importing
                                            </span>
                                        </div>

                                        {/* Table Header */}
                                        <div className="extracted-list-header">
                                            <span>ITEM NAME</span>
                                            <span>PRICE (₹)</span>
                                            <span>CATEGORY</span>
                                            <span>TYPE</span>
                                            <span></span>
                                        </div>

                                        <div className="extracted-list">
                                            {extractedItems.map((item: any, index) => (
                                                <div key={item._id || `ext_${index}`} className="extracted-item-row">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateExtractedItem(index, 'name', e.target.value)}
                                                        placeholder="Item name"
                                                    />
                                                    <div className="price-input-wrapper">
                                                        <span className="currency-symbol">₹</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={item.price}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                updateExtractedItem(index, 'price', val);
                                                            }}
                                                            placeholder="Price"
                                                            className="price-input"
                                                        />
                                                    </div>
                                                    <select
                                                        value={item.categoryId}
                                                        onChange={(e) => updateExtractedItem(index, 'categoryId', e.target.value)}
                                                    >
                                                        {categories.map((cat) => (
                                                            <option key={cat.id} value={cat.id}>
                                                                {cat.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className={`veg-pill ${item.isVeg ? 'veg' : 'non-veg'}`}
                                                        onClick={() => updateExtractedItem(index, 'isVeg', !item.isVeg)}
                                                        title="Click to toggle Veg / Non-Veg"
                                                    >
                                                        {item.isVeg ? '🟢 VEG' : '🔴 NON-VEG'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="extract-remove-btn"
                                                        onClick={() => removeExtractedItem(index)}
                                                        title="Remove item"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Prominent Add to Menu Button */}
                                        <button
                                            className="btn btn-success import-all-btn"
                                            onClick={handleImportItems}
                                            disabled={importing}
                                            style={{
                                                width: '100%',
                                                marginTop: '20px',
                                                padding: '14px 20px',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                color: 'white',
                                                cursor: importing ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                boxShadow: '0 4px 16px rgba(249, 115, 22, 0.35)',
                                            }}
                                        >
                                            {importing ? (
                                                <><Loader size={20} className="spin" /> Adding {extractedItems.length} Items to Menu...</>
                                            ) : (
                                                <><Plus size={20} /> Add All {extractedItems.length} Items to Restaurant Menu</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

