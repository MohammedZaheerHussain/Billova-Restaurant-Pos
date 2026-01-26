// Menu Management Page
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Upload, Image as ImageIcon, FileImage, FolderPlus, Sparkles, Loader } from 'lucide-react';
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
            toast.error(error.response?.data?.error || 'Failed to save item');
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
            // Call backend API to extract items from menu card
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
        try {
            for (const item of extractedItems) {
                await menuAPI.create({
                    name: item.name,
                    price: parseFloat(item.price),
                    categoryId: item.categoryId,
                    isVeg: item.isVeg,
                    hasGST: true,
                    gstPercent: 5,
                });
            }
            toast.success(`${extractedItems.length} items imported!`);
            setShowMenuCardModal(false);
            setMenuCardImage('');
            setExtractedItems([]);
            fetchData();
        } catch (error) {
            toast.error('Failed to import some items');
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
                {categories.map((cat) => (
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
                            {filteredItems.map((item) => (
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
                                                    <ImageIcon size={20} />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="item-cell">
                                            <div className={`veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}`} />
                                            <span className="item-name">{item.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="category-badge">
                                            {item.category?.icon} {item.category?.name}
                                        </span>
                                    </td>
                                    <td className="price-cell">₹{item.price}</td>
                                    <td>
                                        <button
                                            className={`status-toggle ${item.isAvailable ? 'available' : 'unavailable'}`}
                                            onClick={() => handleToggleAvailability(item.id)}
                                        >
                                            {item.isAvailable ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            {item.isAvailable ? 'Available' : 'Unavailable'}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="btn-icon-sm"
                                                onClick={() => openEditModal(item)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn-icon-sm danger"
                                                onClick={() => setDeleteConfirm(item.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
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
                                <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                                <button className="modal-close" onClick={closeModal}>
                                    <X size={20} />
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
                                        <label>Type</label>
                                        <div className="toggle-group">
                                            <button
                                                type="button"
                                                className={`toggle-btn ${form.isVeg ? 'active veg' : ''}`}
                                                onClick={() => setForm({ ...form, isVeg: true })}
                                            >
                                                🟢 Veg
                                            </button>
                                            <button
                                                type="button"
                                                className={`toggle-btn ${!form.isVeg ? 'active non-veg' : ''}`}
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
                                    <label>Image</label>
                                    <div
                                        className={`image-upload ${form.image ? 'has-image' : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
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
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="upload-placeholder">
                                                <Upload size={32} />
                                                <p>Click or drag image here</p>
                                                <span>Max 2MB, JPG/PNG</span>
                                            </div>
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
                                        {['🍽️', '🍕', '🍔', '🍗', '🍛', '🥗', '🍜', '🥤', '🍰', '🍿', '☕', '🍲'].map((icon) => (
                                            <button
                                                key={icon}
                                                type="button"
                                                className={`icon-option ${categoryForm.icon === icon ? 'selected' : ''}`}
                                                onClick={() => setCategoryForm({ ...categoryForm, icon })}
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
                        >
                            <div className="modal-header">
                                <h2><FileImage size={20} /> Upload Menu Card</h2>
                                <button className="modal-close" onClick={() => setShowMenuCardModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="menu-card-content">
                                {/* Upload Area */}
                                <div
                                    className={`menu-card-upload ${menuCardImage ? 'has-image' : ''}`}
                                    onClick={() => menuCardInputRef.current?.click()}
                                >
                                    {menuCardImage ? (
                                        <img src={menuCardImage} alt="Menu Card" className="menu-card-preview" />
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
                                    >
                                        {extracting ? (
                                            <><Loader size={18} className="spin" /> Extracting...</>
                                        ) : (
                                            <><Sparkles size={18} /> Extract Items with AI</>
                                        )}
                                    </button>
                                )}

                                {/* Extracted Items Preview */}
                                {extractedItems.length > 0 && (
                                    <div className="extracted-items">
                                        <h4>Extracted Items ({extractedItems.length})</h4>
                                        <div className="extracted-list">
                                            {extractedItems.map((item, index) => (
                                                <div key={index} className="extracted-item">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateExtractedItem(index, 'name', e.target.value)}
                                                        placeholder="Item name"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={item.price}
                                                        onChange={(e) => updateExtractedItem(index, 'price', e.target.value)}
                                                        placeholder="Price"
                                                        className="price-input"
                                                    />
                                                    <select
                                                        value={item.categoryId}
                                                        onChange={(e) => updateExtractedItem(index, 'categoryId', e.target.value)}
                                                    >
                                                        {categories.map((cat) => (
                                                            <option key={cat.id} value={cat.id}>
                                                                {cat.icon} {cat.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className={`veg-toggle ${item.isVeg ? 'veg' : 'non-veg'}`}
                                                        onClick={() => updateExtractedItem(index, 'isVeg', !item.isVeg)}
                                                    >
                                                        {item.isVeg ? '🟢' : '🔴'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="remove-btn"
                                                        onClick={() => removeExtractedItem(index)}
                                                    >
                                                        <X size={16} />
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
                                                marginTop: '16px',
                                                padding: '14px 20px',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                cursor: importing ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            {importing ? (
                                                <><Loader size={20} className="spin" /> Adding to Menu...</>
                                            ) : (
                                                <><Plus size={20} /> Add All {extractedItems.length} Items to Menu</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => {
                                    setShowMenuCardModal(false);
                                    setMenuCardImage('');
                                    setExtractedItems([]);
                                }}>
                                    Cancel
                                </button>
                                {extractedItems.length > 0 && (
                                    <button className="btn btn-primary" onClick={handleImportItems} disabled={importing}>
                                        {importing ? <div className="spinner" /> : `Import ${extractedItems.length} Items`}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

