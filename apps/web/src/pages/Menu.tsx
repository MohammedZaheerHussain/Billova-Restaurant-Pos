// Menu Management Page
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Upload, Image as ImageIcon, FileImage, FolderPlus, FolderCog, Sparkles, Loader, UtensilsCrossed } from 'lucide-react';
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
    image: string;
    hasGST: boolean;
    gstPercent: string;
}

const emptyForm: MenuItemForm = {
    name: '',
    description: '',
    price: '',
    categoryId: '',
    isVeg: false,
    image: '',
    hasGST: true,
    gstPercent: '5',
};

// Rich collection of 48 food, beverage, dessert, and dining emojis
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
    const user = useAuthStore((state) => state.user);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [form, setForm] = useState<MenuItemForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuCardInputRef = useRef<HTMLInputElement>(null);

    // Category Modal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', icon: '🍽️' });
    const [savingCategory, setSavingCategory] = useState(false);

    // Manage Categories Modal & Editing
    const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [editCatName, setEditCatName] = useState('');
    const [editCatIcon, setEditCatIcon] = useState('🍽️');

    // Menu Card Upload
    const [showMenuCardModal, setShowMenuCardModal] = useState(false);
    const [menuCardImage, setMenuCardImage] = useState<string>('');
    // menuCardSide removed — Groq AI Vision handles any page automatically
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
        setForm({ ...emptyForm, categoryId: categories[0]?.id || '' });
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
            image: item.image || '',
            hasGST: (item as any).hasGST !== false,
            gstPercent: String((item as any).gstPercent || 5),
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setForm(emptyForm);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm({ ...form, image: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm({ ...form, image: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name || !form.price || !form.categoryId) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setSaving(true);
            const data = {
                name: form.name,
                description: form.description || undefined,
                price: parseFloat(form.price),
                categoryId: form.categoryId,
                branchId: user?.branch?.id,
                isVeg: form.isVeg,
                image: form.image || undefined,
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

    // Handle Add Category
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryForm.name) {
            toast.error('Please enter category name');
            return;
        }
        try {
            setSavingCategory(true);
            await categoriesAPI.create({
                name: categoryForm.name,
                icon: categoryForm.icon,
                branchId: user?.branch?.id,
            });
            toast.success('Category added!');
            setShowCategoryModal(false);
            setCategoryForm({ name: '', icon: '🍽️' });
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to add category');
        } finally {
            setSavingCategory(false);
        }
    };

    // Clean up duplicate categories
    const handleCleanDuplicates = async () => {
        try {
            const res = await categoriesAPI.cleanDuplicates(user?.branch?.id);
            if (res.success) {
                toast.success(res.count > 0 ? `✨ Merged ${res.count} duplicate categories!` : 'All categories are already clean!');
                fetchData();
            } else {
                toast.error('Failed to merge categories');
            }
        } catch {
            toast.error('Failed to merge categories');
        }
    };

    // Update Category
    const handleUpdateCategory = async (id: string, name: string, icon: string) => {
        if (!name.trim()) {
            toast.error('Category name is required');
            return;
        }
        try {
            await categoriesAPI.update(id, { name, icon });
            toast.success('Category updated!');
            setEditingCategory(null);
            fetchData();
        } catch {
            toast.error('Failed to update category');
        }
    };

    // Delete Category
    const handleDeleteCategory = async (id: string) => {
        try {
            await categoriesAPI.delete(id);
            toast.success('Category deleted!');
            fetchData();
        } catch {
            toast.error('Failed to delete category');
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
            const response = await menuAPI.extractMenuCard(menuCardImage);
            const { items, message } = response.data;

            setExtractedItems(items);

            // Refresh categories in case new ones were created
            const catRes = await categoriesAPI.getAll(user?.branch?.id);
            setCategories(catRes.data);

            toast.success(message || `Extracted ${items.length} items!`);
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

    const filteredItems = items.filter((item) =>
        !selectedCategory || item.categoryId === selectedCategory
    );

    return (
        <div className="menu-page">
            <div className="page-header">
                <div>
                    <h1>Menu Management</h1>
                    <p>{items.length} items across {categories.length} categories</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowManageCategoriesModal(true)}>
                        <FolderCog size={18} /> Manage Categories
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
                        <FolderPlus size={18} /> Add Category
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowMenuCardModal(true)}>
                        <FileImage size={18} /> Upload Menu Card
                    </button>
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={18} /> Add Item
                    </button>
                </div>
            </div>

            <div className="menu-filters">
                <button
                    className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(null)}
                >
                    All
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
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add your first item or try a different category</span>
                </div>
            ) : (
                <div className="menu-table-container">
                    <table className="menu-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Item</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item) => {
                                const cat = item.category || categories.find((c) => c.id === item.categoryId);
                                return (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <td>
                                            <div className="item-image">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} />
                                                ) : (
                                                    <div className="no-image">
                                                        <ImageIcon size={18} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="item-cell">
                                                <span className="item-name">{item.name}</span>
                                                <span className={item.isVeg ? 'veg-badge' : 'nonveg-badge'}>
                                                    {item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="category-badge">
                                                {cat?.icon || '🍽️'} {cat?.name || 'General'}
                                            </span>
                                        </td>
                                        <td className="price-cell">₹{item.price}</td>
                                        <td>
                                            <button
                                                className={`status-toggle ${item.isAvailable ? 'available' : 'unavailable'}`}
                                                onClick={() => handleToggleAvailability(item.id)}
                                            >
                                                {item.isAvailable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                {item.isAvailable ? 'Available' : 'Unavailable'}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon-sm"
                                                    onClick={() => openEditModal(item)}
                                                    title="Edit item"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button
                                                    className="btn-icon-sm danger"
                                                    onClick={() => setDeleteConfirm(item.id)}
                                                    title="Delete item"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
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
                                    <div className="form-group">
                                        <label>Category *</label>
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                        >
                                            <option value="">Select category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.icon} {cat.name}
                                                </option>
                                            ))}
                                        </select>
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

                                <div className="form-group">
                                    <label>Item Image</label>
                                    <div
                                        className="upload-placeholder"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                        style={form.image ? { padding: 0, border: 'none', height: 'auto' } : undefined}
                                    >
                                        {form.image ? (
                                            <div className="image-preview">
                                                <img src={form.image} alt="Preview" />
                                                <button
                                                    type="button"
                                                    className="remove-image"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setForm({ ...form, image: '' });
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={24} />
                                                <p>Click or drag image here</p>
                                                <span>Max 2MB · JPG / PNG</span>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
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

            {/* Add Category Modal */}
            <AnimatePresence>
                {showCategoryModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCategoryModal(false)}
                    >
                        <motion.div
                            className="modal category-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2><FolderPlus size={20} /> Add Category</h2>
                                <button className="modal-close" onClick={() => setShowCategoryModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleAddCategory} className="category-form">
                                <div className="form-group">
                                    <label>Category Name *</label>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        placeholder="e.g., Desserts, Soups"
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Icon</label>
                                    <div className="icon-picker">
                                        {CATEGORY_ICONS.map((icon) => (
                                            <button
                                                key={icon}
                                                type="button"
                                                className={`icon-option ${categoryForm.icon === icon ? 'selected' : ''}`}
                                                onClick={() => setCategoryForm({ ...categoryForm, icon })}
                                                title={icon}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={savingCategory}>
                                        {savingCategory ? <div className="spinner" /> : 'Add Category'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Manage Categories Modal */}
            <AnimatePresence>
                {showManageCategoriesModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowManageCategoriesModal(false)}
                    >
                        <motion.div
                            className="modal category-modal"
                            style={{ maxWidth: '540px' }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2><FolderCog size={20} /> Manage Categories</h2>
                                <button className="modal-close" onClick={() => setShowManageCategoriesModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="category-manager-body" style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {categories.length} Categories
                                    </span>
                                    <button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={handleCleanDuplicates}>
                                        <Sparkles size={14} /> Merge Duplicates
                                    </button>
                                </div>
                                <div className="category-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {categories.map((cat) => {
                                        const itemCount = items.filter(i => i.categoryId === cat.id || (cat as any).ids?.includes(i.categoryId)).length;
                                        const isEditing = editingCategory?.id === cat.id;

                                        return (
                                            <div key={cat.id} className="category-manager-row" style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '20px', padding: '0 4px' }}>{editCatIcon || '🍽️'}</span>
                                                            <input
                                                                type="text"
                                                                value={editCatName}
                                                                onChange={(e) => setEditCatName(e.target.value)}
                                                                placeholder="Category Name"
                                                                style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
                                                            />
                                                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateCategory(cat.id, editCatName, editCatIcon)}>
                                                                Save
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingCategory(null)}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                        <div className="icon-picker" style={{ maxHeight: '110px' }}>
                                                            {CATEGORY_ICONS.map((icon) => (
                                                                <button
                                                                    key={icon}
                                                                    type="button"
                                                                    className={`icon-option ${editCatIcon === icon ? 'selected' : ''}`}
                                                                    onClick={() => setEditCatIcon(icon)}
                                                                    style={{ height: '36px', fontSize: '18px' }}
                                                                >
                                                                    {icon}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                                                            <div>
                                                                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{cat.name}</span>
                                                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{itemCount} items</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                className="btn-icon-sm"
                                                                onClick={() => {
                                                                    setEditingCategory(cat);
                                                                    setEditCatName(cat.name);
                                                                    setEditCatIcon(cat.icon || '🍽️');
                                                                }}
                                                                title="Edit Category"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                className="btn-icon-sm danger"
                                                                onClick={() => handleDeleteCategory(cat.id)}
                                                                title="Delete Category"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
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
                                            {extractedItems.map((item, index) => (
                                                <div key={index} className="extracted-item-row">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateExtractedItem(index, 'name', e.target.value)}
                                                        placeholder="Item name"
                                                    />
                                                    <div className="price-input-wrapper">
                                                        <span className="currency-symbol">₹</span>
                                                        <input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={(e) => updateExtractedItem(index, 'price', e.target.value)}
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

