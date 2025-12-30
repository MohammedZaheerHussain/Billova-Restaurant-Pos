// Online Order Page - Delivery/Takeaway ordering (Public)
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, ShoppingCart, Plus, Minus, Trash2, Send, CheckCircle, AlertCircle, Leaf, Drumstick, User, Home, Bike, ShoppingBag } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import './OnlineOrder.css';

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    isVeg: boolean;
    categoryId: string;
    image?: string;
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

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
    variantId?: string;
}

export default function OnlineOrderPage() {
    const { branchId } = useParams<{ branchId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState<{ orderId: string; orderNumber: number } | null>(null);
    const navigate = useNavigate();

    // Order type & customer details
    const [orderType, setOrderType] = useState<'DELIVERY' | 'TAKEAWAY'>('DELIVERY');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

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
        if (!customerName.trim()) {
            toast.error('Please enter your name');
            return;
        }
        if (!customerPhone.trim()) {
            toast.error('Please enter your phone number');
            return;
        }
        if (orderType === 'DELIVERY' && !customerAddress.trim()) {
            toast.error('Please enter delivery address');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch(`${API_URL}/api/public/online-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branchId,
                    orderType,
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    customerAddress: orderType === 'DELIVERY' ? customerAddress.trim() : null,
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
            setOrderSuccess({ orderId: data.orderId, orderNumber: data.orderNumber });
            setCart([]);
            setShowCart(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredItems = selectedCategory
        ? menuItems.filter(item => item.categoryId === selectedCategory)
        : menuItems;

    if (loading) {
        return (
            <div className="online-order-page loading">
                <div className="spinner" />
                <p>Loading menu...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="online-order-page error">
                <AlertCircle size={48} />
                <h2>Restaurant Not Found</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (orderSuccess) {
        return (
            <div className="online-order-page success">
                <div className="success-animation">
                    <CheckCircle size={64} />
                </div>
                <h2>Order Placed!</h2>
                <p className="order-number">Order #{orderSuccess.orderNumber}</p>
                <p className="success-message">
                    {orderType === 'DELIVERY'
                        ? 'Your order will be delivered soon!'
                        : 'Your order will be ready for pickup!'}
                    <br />
                    We'll call you at {customerPhone} for updates.
                </p>
                <button className="btn-primary" onClick={() => navigate(`/track/${orderSuccess.orderId}`)}>
                    Track Order
                </button>
                <button className="btn-secondary" onClick={() => {
                    setOrderSuccess(null);
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                }}>
                    Order More
                </button>
            </div>
        );
    }

    return (
        <div className="online-order-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="oo-header">
                <div className="oo-brand">
                    <h1>{branch?.name}</h1>
                    {branch?.address && (
                        <p className="oo-address">
                            <MapPin size={14} /> {branch.address}
                        </p>
                    )}
                </div>
            </header>

            {/* Order Type Selection */}
            <div className="oo-order-type">
                <button
                    className={`type-btn ${orderType === 'DELIVERY' ? 'active' : ''}`}
                    onClick={() => setOrderType('DELIVERY')}
                >
                    <Bike size={20} />
                    Delivery
                </button>
                <button
                    className={`type-btn ${orderType === 'TAKEAWAY' ? 'active' : ''}`}
                    onClick={() => setOrderType('TAKEAWAY')}
                >
                    <ShoppingBag size={20} />
                    Takeaway
                </button>
            </div>

            {/* Categories */}
            <div className="oo-categories">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`oo-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                    >
                        {cat.icon && <span>{cat.icon}</span>}
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu Items */}
            <div className="oo-menu">
                {filteredItems.map((item, index) => (
                    <motion.div
                        key={item.id}
                        className="oo-item"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                    >
                        <div className="oo-item-info">
                            <div className={`oo-veg-badge ${item.isVeg ? 'veg' : 'non-veg'}`}>
                                {item.isVeg ? <Leaf size={12} /> : <Drumstick size={12} />}
                            </div>
                            <div className="oo-item-details">
                                <h3>{item.name}</h3>
                                {item.description && <p className="oo-item-desc">{item.description}</p>}
                                <span className="oo-price">₹{item.variants?.[0]?.price || item.price}</span>
                            </div>
                        </div>
                        <button className="oo-add-btn" onClick={() => addToCart(item)}>
                            <Plus size={20} />
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Cart FAB */}
            {cart.length > 0 && (
                <button className="oo-cart-fab" onClick={() => setShowCart(true)}>
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

                            {/* Customer Details */}
                            <div className="customer-form">
                                <div className="form-row">
                                    <User size={18} />
                                    <input
                                        type="text"
                                        placeholder="Your Name *"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                    />
                                </div>
                                <div className="form-row">
                                    <Phone size={18} />
                                    <input
                                        type="tel"
                                        placeholder="Phone Number *"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                    />
                                </div>
                                {orderType === 'DELIVERY' && (
                                    <div className="form-row">
                                        <Home size={18} />
                                        <input
                                            type="text"
                                            placeholder="Delivery Address *"
                                            value={customerAddress}
                                            onChange={e => setCustomerAddress(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="cart-footer">
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
                                            Place {orderType === 'DELIVERY' ? 'Delivery' : 'Takeaway'} Order
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
