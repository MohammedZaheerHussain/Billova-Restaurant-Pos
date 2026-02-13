// Captain App - Waiter ordering interface (PWA)
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Plus, Minus, Trash2, Send, Users, CheckCircle, ShoppingBag, Search } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store';
import { tablesAPI, menuAPI, ordersAPI } from '../api';
import './Captain.css';
import { logger } from '../utils/logger';

interface Table {
    id: string;
    name: string;
    capacity: number;
    status: 'EMPTY' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}

interface MenuItem {
    id: string;
    name: string;
    price: number;
    isVeg: boolean;
    categoryId: string;
    variants?: { id: string; name: string; price: number }[];
    category?: { name: string };
}

interface Category {
    id: string;
    name: string;
    icon?: string;
}

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
    variantId?: string;
}

export default function CaptainPage() {
    const { user, logout } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState<Table[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tablesRes, menuRes] = await Promise.all([
                tablesAPI.getAll(),
                menuAPI.getAll(user?.branch?.id)
            ]);
            setTables(tablesRes.data);
            setMenuItems(menuRes.data);

            // Extract categories from menu items
            const cats: { [key: string]: Category } = {};
            menuRes.data.forEach((item: MenuItem) => {
                if (item.category && !cats[item.categoryId]) {
                    cats[item.categoryId] = { id: item.categoryId, name: item.category.name };
                }
            });
            setCategories(Object.values(cats));
        } catch (error) {
            logger.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: MenuItem) => {
        const variantId = item.variants?.[0]?.id;
        const existing = cart.find(c =>
            c.menuItem.id === item.id && c.variantId === variantId
        );

        if (existing) {
            setCart(cart.map(c =>
                c.menuItem.id === item.id && c.variantId === variantId
                    ? { ...c, quantity: c.quantity + 1 }
                    : c
            ));
        } else {
            setCart([...cart, { menuItem: item, quantity: 1, variantId }]);
        }
        toast.success(`Added ${item.name}`);
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(cart.map(c => {
            if (c.menuItem.id === itemId) {
                const newQty = c.quantity + delta;
                return newQty > 0 ? { ...c, quantity: newQty } : c;
            }
            return c;
        }).filter(c => c.quantity > 0));
    };

    const removeFromCart = (itemId: string) => {
        setCart(cart.filter(c => c.menuItem.id !== itemId));
    };

    const getTotal = () => {
        return cart.reduce((sum, c) => {
            const price = c.variantId
                ? c.menuItem.variants?.find(v => v.id === c.variantId)?.price || c.menuItem.price
                : c.menuItem.price;
            return sum + Number(price) * c.quantity;
        }, 0);
    };

    const submitOrder = async () => {
        if (!selectedTable) {
            toast.error('Please select a table first');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        try {
            setSubmitting(true);
            await ordersAPI.create({
                orderType: 'DINEIN',
                tableId: selectedTable.id,
                items: cart.map(c => ({
                    menuItemId: c.menuItem.id,
                    variantId: c.variantId,
                    quantity: c.quantity
                }))
            });

            setOrderSuccess(true);
            setCart([]);
            setTimeout(() => {
                setOrderSuccess(false);
                setSelectedTable(null);
                setShowCart(false);
            }, 2000);
        } catch (error) {
            logger.error('Error submitting order:', error);
            toast.error('Failed to submit order');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = !searchTerm ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <div className="captain-page loading">
                <div className="spinner" />
                <p>Loading...</p>
            </div>
        );
    }

    if (orderSuccess) {
        return (
            <div className="captain-page success">
                <CheckCircle size={64} />
                <h2>Order Sent!</h2>
                <p>Order sent to kitchen for {selectedTable?.name}</p>
            </div>
        );
    }

    return (
        <div className="captain-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="captain-header">
                <div className="captain-info">
                    <h1>Captain</h1>
                    <span className="captain-name">{user?.name}</span>
                </div>
                <button className="logout-btn" onClick={logout}>
                    <LogOut size={18} />
                </button>
            </header>

            {!selectedTable ? (
                /* Table Selection */
                <div className="table-selection">
                    <h2>Select Table</h2>
                    <div className="tables-grid">
                        {tables.map(table => (
                            <button
                                key={table.id}
                                className={`table-btn ${table.status.toLowerCase()}`}
                                onClick={() => setSelectedTable(table)}
                            >
                                <span className="table-name">{table.name}</span>
                                <span className="table-capacity">
                                    <Users size={14} /> {table.capacity}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* Menu & Ordering */
                <>
                    <div className="order-header">
                        <button className="back-btn" onClick={() => {
                            setSelectedTable(null);
                            setCart([]);
                        }}>
                            ← Tables
                        </button>
                        <span className="current-table">{selectedTable.name}</span>
                    </div>

                    {/* Search */}
                    <div className="search-bar">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search menu..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Categories */}
                    <div className="captain-categories">
                        <button
                            className={`cat-btn ${!selectedCategory ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(null)}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`cat-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Menu Items */}
                    <div className="captain-menu">
                        {filteredItems.map(item => (
                            <motion.div
                                key={item.id}
                                className="captain-item"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <div className="item-info">
                                    <span className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
                                    <div>
                                        <h4>{item.name}</h4>
                                        <p>₹{item.variants?.[0]?.price || item.price}</p>
                                    </div>
                                </div>
                                <button className="add-btn" onClick={() => addToCart(item)}>
                                    <Plus size={20} />
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* Cart FAB */}
                    {cart.length > 0 && (
                        <button className="cart-fab" onClick={() => setShowCart(true)}>
                            <ShoppingBag size={24} />
                            <span className="cart-count">{cart.reduce((s, c) => s + c.quantity, 0)}</span>
                            <span>₹{getTotal().toFixed(0)}</span>
                        </button>
                    )}

                    {/* Cart Modal */}
                    <AnimatePresence>
                        {showCart && (
                            <motion.div
                                className="cart-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowCart(false)}
                            >
                                <motion.div
                                    className="cart-modal"
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="cart-header">
                                        <h2>Order for {selectedTable.name}</h2>
                                        <button onClick={() => setShowCart(false)}>×</button>
                                    </div>

                                    <div className="cart-items">
                                        {cart.map(c => (
                                            <div key={c.menuItem.id} className="cart-item">
                                                <div className="cart-item-info">
                                                    <h4>{c.menuItem.name}</h4>
                                                    <p>₹{c.menuItem.variants?.[0]?.price || c.menuItem.price}</p>
                                                </div>
                                                <div className="cart-item-controls">
                                                    <button onClick={() => updateQuantity(c.menuItem.id, -1)}>
                                                        <Minus size={16} />
                                                    </button>
                                                    <span>{c.quantity}</span>
                                                    <button onClick={() => updateQuantity(c.menuItem.id, 1)}>
                                                        <Plus size={16} />
                                                    </button>
                                                    <button className="remove" onClick={() => removeFromCart(c.menuItem.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="cart-footer">
                                        <div className="cart-total-row">
                                            <span>Total</span>
                                            <span className="total-amount">₹{getTotal().toFixed(2)}</span>
                                        </div>
                                        <button
                                            className="submit-btn"
                                            onClick={submitOrder}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Sending...' : (
                                                <>
                                                    <Send size={20} />
                                                    Send to Kitchen
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
