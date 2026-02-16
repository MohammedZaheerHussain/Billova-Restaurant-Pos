// Customer Self-Order Page - Public QR Code Ordering
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Minus, Trash2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './CustomerOrder.css';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    isVeg: boolean;
    categoryId: string;
    variants?: { id: string; name: string; price: number; isDefault: boolean }[];
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

interface MenuData {
    table: { id: string; name: string };
    branch: { id: string; name: string; phone?: string };
    categories: Category[];
    menuItems: MenuItem[];
}

export default function CustomerOrderPage() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [menuData, setMenuData] = useState<MenuData | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [showCart, setShowCart] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: number } | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

    useEffect(() => {
        if (token) {
            fetchMenu();
        }
    }, [token]);

    const fetchMenu = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/v1/public/menu/${token}`);
            if (!response.ok) {
                throw new Error('Invalid or expired QR code');
            }
            const data = await response.json();
            setMenuData(data);
            if (data.categories.length > 0) {
                setSelectedCategory(data.categories[0].id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load menu');
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
        if (cart.length === 0) {
            toast.error('Your cart is empty');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch(`${API_URL}/api/v1/public/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    customerName: customerName.trim() || 'Guest',
                    items: cart.map(c => ({
                        menuItemId: c.menuItem.id,
                        variantId: c.variantId,
                        quantity: c.quantity
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('Failed to place order');
            }

            const data = await response.json();
            setOrderSuccess({ orderNumber: data.orderNumber });
            setCart([]);
            setShowCart(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredItems = menuData?.menuItems.filter(
        item => item.categoryId === selectedCategory
    ) || [];

    if (loading) {
        return (
            <div className="customer-order-page loading">
                <div className="spinner" />
                <p>Loading menu...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="customer-order-page error">
                <AlertCircle size={48} />
                <h2>Oops!</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (orderSuccess) {
        return (
            <div className="customer-order-page success">
                <div className="success-animation">
                    <CheckCircle size={64} />
                </div>
                <h2>Order Placed!</h2>
                <p className="order-number">Order #{orderSuccess.orderNumber}</p>
                <p className="success-message">
                    Your order has been sent to the kitchen.<br />
                    It will be prepared shortly.
                </p>
                <button className="btn-primary" onClick={() => setOrderSuccess(null)}>
                    Order More
                </button>
            </div>
        );
    }

    return (
        <div className="customer-order-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="co-header">
                <div className="restaurant-info">
                    <h1>{menuData?.branch.name}</h1>
                    <span className="table-badge">Table {menuData?.table.name}</span>
                </div>
            </header>

            {/* Categories */}
            <div className="co-categories">
                {menuData?.categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`co-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.icon && <span>{cat.icon}</span>}
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu Items */}
            <div className="co-menu">
                {filteredItems.map(item => (
                    <motion.div
                        key={item.id}
                        className="co-menu-item"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="item-info">
                            <div className={`veg-dot ${item.isVeg ? 'veg' : 'non-veg'}`} />
                            <div className="item-details">
                                <h3>{item.name}</h3>
                                <p className="item-price">
                                    ₹{item.variants?.[0]?.price || item.price}
                                </p>
                            </div>
                        </div>
                        <button className="add-btn" onClick={() => addToCart(item)}>
                            <Plus size={20} />
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Cart Button */}
            {cart.length > 0 && (
                <button className="cart-fab" onClick={() => setShowCart(true)}>
                    <ShoppingCart size={24} />
                    <span className="cart-count">{cart.reduce((s, c) => s + c.quantity, 0)}</span>
                    <span className="cart-total">₹{getTotal().toFixed(0)}</span>
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
                                <h2>Your Order</h2>
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
                                <input
                                    type="text"
                                    placeholder="Your name (optional)"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                />
                                <div className="cart-total-row">
                                    <span>Total</span>
                                    <span className="total-amount">₹{getTotal().toFixed(2)}</span>
                                </div>
                                <button
                                    className="submit-order-btn"
                                    onClick={submitOrder}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Placing Order...' : (
                                        <>
                                            <Send size={20} />
                                            Place Order
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
