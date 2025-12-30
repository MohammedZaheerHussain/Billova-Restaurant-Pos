// Public Menu Page - View-only restaurant menu (no ordering)
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Leaf, Drumstick, Share2, ShoppingBag } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './PublicMenu.css';

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    isVeg: boolean;
    image?: string;
    categoryId: string;
    variants?: { id: string; name: string; price: number }[];
    category?: { id: string; name: string; icon?: string };
}

interface Category {
    id: string;
    name: string;
    icon?: string;
}

interface Branch {
    id: string;
    name: string;
    phone?: string;
    address?: string;
}

export default function PublicMenuPage() {
    const { branchId } = useParams<{ branchId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        if (branchId) {
            fetchMenu();
        }
    }, [branchId]);

    const fetchMenu = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/public/menu-full/${branchId}`);
            if (!response.ok) {
                throw new Error('Restaurant not found');
            }
            const data = await response.json();
            setBranch(data.branch);
            setCategories(data.categories);
            setMenuItems(data.menuItems);
            if (data.categories.length > 0) {
                setSelectedCategory(data.categories[0].id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load menu');
        } finally {
            setLoading(false);
        }
    };

    const shareMenu = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${branch?.name} - Menu`,
                    text: `Check out the menu at ${branch?.name}!`,
                    url
                });
            } catch (e) {
                // User cancelled or error
            }
        } else {
            navigator.clipboard.writeText(url);
            toast.success('Menu link copied!');
        }
    };

    const filteredItems = selectedCategory
        ? menuItems.filter(item => item.categoryId === selectedCategory)
        : menuItems;

    // Group items by category for "All" view
    const groupedByCategory = categories.map(cat => ({
        ...cat,
        items: menuItems.filter(item => item.categoryId === cat.id)
    })).filter(cat => cat.items.length > 0);

    if (loading) {
        return (
            <div className="public-menu-page loading">
                <div className="spinner" />
                <p>Loading menu...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="public-menu-page error">
                <h2>Restaurant Not Found</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="public-menu-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="pm-header">
                <div className="pm-brand">
                    <h1>{branch?.name}</h1>
                    {branch?.address && (
                        <p className="pm-address">
                            <MapPin size={14} /> {branch.address}
                        </p>
                    )}
                    {branch?.phone && (
                        <p className="pm-phone">
                            <Phone size={14} /> {branch.phone}
                        </p>
                    )}
                </div>
                <button className="pm-share-btn" onClick={shareMenu}>
                    <Share2 size={18} />
                    Share
                </button>
            </header>

            {/* Categories */}
            <div className="pm-categories">
                <button
                    className={`pm-category-btn ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(null)}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`pm-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.icon && <span>{cat.icon}</span>}
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu Items */}
            <div className="pm-menu">
                {selectedCategory ? (
                    // Show single category
                    <div className="pm-category-section">
                        {filteredItems.map((item, index) => (
                            <MenuItemCard key={item.id} item={item} index={index} />
                        ))}
                    </div>
                ) : (
                    // Show all categories
                    groupedByCategory.map(cat => (
                        <div key={cat.id} className="pm-category-section">
                            <h2 className="pm-category-title">
                                {cat.icon && <span>{cat.icon}</span>}
                                {cat.name}
                            </h2>
                            {cat.items.map((item, index) => (
                                <MenuItemCard key={item.id} item={item} index={index} />
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <footer className="pm-footer">
                <button className="pm-order-btn" onClick={() => navigate(`/o/${branchId}`)}>
                    <ShoppingBag size={20} />
                    Order Now
                </button>
                <p>Powered by <strong>Billova POS</strong></p>
            </footer>
        </div>
    );
}

// Menu Item Card Component
function MenuItemCard({ item, index }: { item: MenuItem; index: number }) {
    return (
        <motion.div
            className="pm-item"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
        >
            <div className="pm-item-info">
                <div className={`pm-veg-badge ${item.isVeg ? 'veg' : 'non-veg'}`}>
                    {item.isVeg ? <Leaf size={12} /> : <Drumstick size={12} />}
                </div>
                <div className="pm-item-details">
                    <h3>{item.name}</h3>
                    {item.description && <p className="pm-item-desc">{item.description}</p>}
                    {item.variants && item.variants.length > 0 ? (
                        <div className="pm-variants">
                            {item.variants.map(v => (
                                <span key={v.id} className="pm-variant">
                                    {v.name}: ₹{v.price}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="pm-price">₹{item.price}</span>
                    )}
                </div>
            </div>
            {item.image && (
                <img src={item.image} alt={item.name} className="pm-item-image" />
            )}
        </motion.div>
    );
}
