// POS Billing Screen - Main Point of Sale Interface
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ShoppingCart, Minus, Plus, Trash2, X,
    CreditCard, Banknote, Smartphone, Percent, Coffee,
    UtensilsCrossed, Globe, User, Phone, Receipt, FileText, MessageCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore, useUIStore, useAuthStore, MenuItem, Category } from '../store';
import { menuAPI, categoriesAPI, ordersAPI } from '../api';
import './POS.css';


export default function POSPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPayment, setShowPayment] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Customer details (optional)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Discount input
    const [discountInput, setDiscountInput] = useState('');

    // Order notes (for parcel/special instructions)
    const [orderNotes, setOrderNotes] = useState('');

    // Online platform details
    const [onlinePlatform, setOnlinePlatform] = useState<'SWIGGY' | 'ZOMATO' | null>(null);
    const [onlineOrderId, setOnlineOrderId] = useState('');

    // Order success state for WhatsApp sharing
    const [showSuccess, setShowSuccess] = useState(false);
    const [completedOrder, setCompletedOrder] = useState<{
        orderNumber: number;
        items: typeof cartItems;
        subtotal: number;
        discount: number;
        total: number;
        customerPhone: string;
        customerName: string;
    } | null>(null);


    const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useUIStore();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const {
        items: cartItems,
        orderType,
        setOrderType,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getSubtotal,
        getDiscountAmount,
        getTotal,
        getItemCount,
        discountType,
        discountValue,
        setDiscount,
    } = useCartStore();

    // Fetch data
    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [catRes, menuRes] = await Promise.all([
                categoriesAPI.getAll(user?.branch?.id),
                menuAPI.getAll(user?.branch?.id),
            ]);
            setCategories(catRes.data || []);
            setMenuItems(menuRes.data || []);

            if (catRes.data && catRes.data.length > 0 && !selectedCategory) {
                setSelectedCategory(catRes.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load menu');
        } finally {
            setLoading(false);
        }
    };

    // Filter items
    const filteredItems = menuItems.filter((item) => {
        const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
        const matchesSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch && item.isAvailable;
    });

    // Handle add to cart
    const handleAddItem = (item: MenuItem) => {
        try {
            // If item has variants, use the default variant
            if (item.variants && item.variants.length > 0) {
                const defaultVariant = item.variants.find(v => v.isDefault) || item.variants[0];
                addItem(item, defaultVariant);
            } else {
                addItem(item);
            }
            toast.success(`Added ${item.name}`, { duration: 1500 });
        } catch (error) {
            console.error('Error adding item:', error);
            toast.error('Failed to add item');
        }
    };

    // Apply discount from input
    const applyDiscount = () => {
        const value = parseFloat(discountInput);
        if (!isNaN(value) && value > 0 && value <= 100) {
            setDiscount('PERCENTAGE', value);
            toast.success(`${value}% discount applied!`);
        } else if (value === 0 || discountInput === '') {
            setDiscount(null, 0);
            toast.success('Discount removed');
        } else {
            toast.error('Enter valid discount (0-100%)');
        }
    };

    // Handle order submission
    const handleSubmitOrder = async (paymentMode: string) => {
        if (cartItems.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        if (submitting) return;

        try {
            setSubmitting(true);

            const orderData = {
                orderType,
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                notes: orderNotes.trim() || undefined,
                onlinePlatform: orderType === 'ONLINE' ? onlinePlatform : undefined,
                onlineOrderId: orderType === 'ONLINE' ? onlineOrderId.trim() : undefined,
                items: cartItems.map((item) => ({
                    menuItemId: item.menuItem.id,
                    variantId: item.variant?.id || null,
                    quantity: item.quantity,
                    notes: item.notes || null,
                })),
                discountType: discountType || undefined,
                discountValue: discountValue || undefined,
            };

            console.log('Creating order:', orderData);
            const response = await ordersAPI.create(orderData);
            console.log('Order created:', response.data);

            // Add payment
            await ordersAPI.addPayment(response.data.id, {
                mode: paymentMode,
                amount: getTotal(),
            });

            // Save order details for WhatsApp sharing
            setCompletedOrder({
                orderNumber: response.data.orderNumber || 0,
                items: [...cartItems],
                subtotal: getSubtotal(),
                discount: getDiscountAmount(),
                total: getTotal(),
                customerPhone: customerPhone.trim(),
                customerName: customerName.trim(),
            });

            toast.success(`Order #${response.data.orderNumber || 'Created'} completed!`);
            setShowPayment(false);
            setShowSuccess(true);

            // Clear form data but keep completed order for WhatsApp
            clearCart();
            setCustomerName('');
            setCustomerPhone('');
            setDiscountInput('');
            setOrderNotes('');
            setOnlinePlatform(null);
            setOnlineOrderId('');
        } catch (error: any) {
            console.error('Order failed:', error);
            const errorMessage = error.response?.data?.error || 'Failed to create order';
            toast.error(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    // Generate WhatsApp share message
    const generateWhatsAppMessage = () => {
        if (!completedOrder) return '';

        const branchName = user?.branch?.name || 'Our Restaurant';
        const date = new Date().toLocaleDateString('en-IN');
        const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        let message = `🧾 *${branchName}*\n`;
        message += `Order #${completedOrder.orderNumber}\n`;
        message += `📅 ${date} | ⏰ ${time}\n`;
        message += `─────────────────\n`;

        completedOrder.items.forEach((item, idx) => {
            const variantText = item.variant ? ` (${item.variant.name})` : '';
            message += `${idx + 1}. ${item.menuItem.name}${variantText}\n`;
            message += `   ${item.quantity} x ₹${item.unitPrice} = ₹${item.total.toFixed(2)}\n`;
        });

        message += `─────────────────\n`;
        message += `Subtotal: ₹${completedOrder.subtotal.toFixed(2)}\n`;

        if (completedOrder.discount > 0) {
            message += `Discount: -₹${completedOrder.discount.toFixed(2)}\n`;
        }

        message += `*Total: ₹${completedOrder.total.toFixed(2)}*\n`;
        message += `─────────────────\n`;
        message += `✅ Payment Received\n`;
        message += `Thank you for your order! 🙏`;

        return message;
    };

    // Share via WhatsApp
    const shareViaWhatsApp = () => {
        const message = generateWhatsAppMessage();
        const phone = completedOrder?.customerPhone?.replace(/\D/g, '') || '';

        // Format phone number for India
        const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;

        const url = phone
            ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;

        window.open(url, '_blank');
    };

    // Close success modal
    const closeSuccessModal = () => {
        setShowSuccess(false);
        setCompletedOrder(null);
    };


    // Open payment modal
    const openPaymentModal = () => {
        if (cartItems.length === 0) {
            toast.error('Add items to cart first');
            return;
        }
        // Pre-fill discount input if discount exists
        if (discountType === 'PERCENTAGE' && discountValue > 0) {
            setDiscountInput(discountValue.toString());
        }
        setShowPayment(true);
    };

    return (
        <div className="pos-container">
            {/* Left Side - Menu Items */}
            <div className="pos-menu">
                {/* Order Type Tabs */}
                <div className="order-type-tabs">
                    <button
                        className={`order-type-tab ${orderType === 'DINE_IN' ? 'active' : ''}`}
                        onClick={() => setOrderType('DINE_IN')}
                    >
                        <UtensilsCrossed size={18} />
                        Dine In
                    </button>
                    <button
                        className={`order-type-tab ${orderType === 'TAKEAWAY' ? 'active' : ''}`}
                        onClick={() => setOrderType('TAKEAWAY')}
                    >
                        <Coffee size={18} />
                        Takeaway
                    </button>
                    <button
                        className={`order-type-tab ${orderType === 'ONLINE' ? 'active' : ''}`}
                        onClick={() => setOrderType('ONLINE')}
                    >
                        <Globe size={18} />
                        Online
                    </button>
                </div>

                {/* Search Bar */}
                <div className="pos-search">
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Categories */}
                <div className="category-scroll">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat.id)}
                            style={{ '--cat-color': cat.color || '#dc2626' } as React.CSSProperties}
                        >
                            <span className="category-icon">{cat.icon}</span>
                            <span className="category-name">{cat.name}</span>
                        </button>
                    ))}
                </div>

                {/* Menu Grid */}
                <div className="menu-grid">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading menu...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="empty-state">
                            <p>No items found</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    className="menu-item-card"
                                    onClick={() => handleAddItem(item)}
                                >
                                    <div className="item-header">
                                        <div className={`veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}`} />
                                        {item.variants && item.variants.length > 1 && (
                                            <span className="variant-badge">{item.variants.length} sizes</span>
                                        )}
                                    </div>
                                    <h3 className="item-name">{item.name}</h3>
                                    <div className="item-price">
                                        ₹{item.variants?.[0]?.price || item.price}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Right Side - Cart */}
            <div className="pos-cart">
                <div className="cart-header">
                    <h2>
                        <ShoppingCart size={22} />
                        Current Order
                    </h2>
                    <span className="cart-count">{getItemCount()} items</span>
                </div>

                {/* Cart Items */}
                <div className="cart-items">
                    {cartItems.length === 0 ? (
                        <div className="cart-empty">
                            <ShoppingCart size={48} strokeWidth={1} />
                            <p>Cart is empty</p>
                            <span>Add items to start an order</span>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {cartItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="cart-item"
                                >
                                    <div className="cart-item-info">
                                        <h4>{item.menuItem.name}</h4>
                                        {item.variant && (
                                            <span className="variant-name">{item.variant.name}</span>
                                        )}
                                        <span className="item-unit-price">₹{item.unitPrice}</span>
                                    </div>
                                    <div className="cart-item-controls">
                                        <div className="quantity-control">
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                                <Minus size={16} />
                                            </button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <span className="item-total">₹{item.total}</span>
                                        <button className="remove-btn" onClick={() => removeItem(item.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Order Notes Section */}
                {cartItems.length > 0 && (
                    <div className="order-notes-section">
                        <div className="notes-input-group">
                            <FileText size={16} />
                            <input
                                type="text"
                                placeholder="Order notes (e.g., Strips - Parcel, Popcorn - Dine)"
                                value={orderNotes}
                                onChange={(e) => setOrderNotes(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Discount Input Section */}
                {cartItems.length > 0 && (
                    <div className="discount-section">
                        <div className="discount-input-group">
                            <Percent size={16} />
                            <input
                                type="number"
                                placeholder="Discount %"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                min="0"
                                max="100"
                            />
                            <button className="apply-discount-btn" onClick={applyDiscount}>
                                Apply
                            </button>
                        </div>
                        {discountType && discountValue > 0 && (
                            <span className="discount-value">
                                -{discountValue}% Applied
                            </span>
                        )}
                    </div>
                )}

                {/* Cart Summary */}
                <div className="cart-summary">
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>₹{getSubtotal().toFixed(2)}</span>
                    </div>
                    {getDiscountAmount() > 0 && (
                        <div className="summary-row discount">
                            <span>Discount ({discountValue}%)</span>
                            <span>-₹{getDiscountAmount().toFixed(2)}</span>
                        </div>
                    )}
                    <div className="summary-row total">
                        <span>Total</span>
                        <span>₹{getTotal().toFixed(2)}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="cart-actions">
                    <button className="btn btn-secondary" onClick={clearCart} disabled={cartItems.length === 0}>
                        Clear
                    </button>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={openPaymentModal}
                        disabled={cartItems.length === 0}
                    >
                        Pay ₹{getTotal().toFixed(2)}
                    </button>
                </div>
            </div>

            {/* Payment Modal with Bill Summary */}
            <AnimatePresence>
                {showPayment && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowPayment(false)}
                    >
                        <motion.div
                            className="payment-modal bill-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2><Receipt size={22} /> Bill Summary</h2>
                                <button className="close-btn" onClick={() => setShowPayment(false)}>
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Customer Details (Optional) */}
                            <div className="customer-details">
                                <h3>Customer Details (Optional)</h3>
                                <div className="customer-inputs">
                                    <div className="input-group">
                                        <User size={18} className="input-icon" />
                                        <input
                                            type="text"
                                            placeholder="Customer Name"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <Phone size={18} className="input-icon" />
                                        <input
                                            type="tel"
                                            placeholder="Phone Number"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Online Platform Selection - Only for Online orders */}
                            {orderType === 'ONLINE' && (
                                <div className="online-platform-section">
                                    <h3>Select Platform</h3>
                                    <div className="platform-selector">
                                        <button
                                            className={`platform-btn ${onlinePlatform === 'SWIGGY' ? 'selected' : ''}`}
                                            onClick={() => setOnlinePlatform('SWIGGY')}
                                        >
                                            <img
                                                src="https://logos-world.net/wp-content/uploads/2020/11/Swiggy-Logo.png"
                                                alt="Swiggy"
                                                className="platform-logo"
                                            />
                                            <span>Swiggy</span>
                                        </button>
                                        <button
                                            className={`platform-btn ${onlinePlatform === 'ZOMATO' ? 'selected' : ''}`}
                                            onClick={() => setOnlinePlatform('ZOMATO')}
                                        >
                                            <img
                                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Zomato_Logo.svg/1280px-Zomato_Logo.svg.png"
                                                alt="Zomato"
                                                className="platform-logo"
                                            />
                                            <span>Zomato</span>
                                        </button>
                                    </div>
                                    {onlinePlatform && (
                                        <div className="platform-order-id">
                                            <label>{onlinePlatform} Order ID:</label>
                                            <input
                                                type="text"
                                                placeholder={`Enter ${onlinePlatform} order number`}
                                                value={onlineOrderId}
                                                onChange={(e) => setOnlineOrderId(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bill Items List */}
                            <div className="bill-items-section">
                                <div className="bill-items-header">
                                    <span>Item</span>
                                    <span>Qty</span>
                                    <span>Price</span>
                                    <span>Total</span>
                                </div>
                                <div className="bill-items-list">
                                    {cartItems.map((item, index) => (
                                        <div key={item.id} className="bill-item-row">
                                            <span className="bill-item-name">
                                                {index + 1}. {item.menuItem.name}
                                                {item.variant && <small> ({item.variant.name})</small>}
                                            </span>
                                            <span className="bill-item-qty">x{item.quantity}</span>
                                            <span className="bill-item-price">₹{item.unitPrice}</span>
                                            <span className="bill-item-total">₹{item.total.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bill Summary */}
                            <div className="bill-summary">
                                <div className="bill-row">
                                    <span>Subtotal ({getItemCount()} items)</span>
                                    <span>₹{getSubtotal().toFixed(2)}</span>
                                </div>
                                {getDiscountAmount() > 0 && (
                                    <div className="bill-row discount-row">
                                        <span>Discount ({discountValue}%)</span>
                                        <span>-₹{getDiscountAmount().toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="bill-row total-row">
                                    <span>Grand Total</span>
                                    <span>₹{getTotal().toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Discount Input in Modal */}
                            <div className="modal-discount">
                                <label>Apply Discount:</label>
                                <div className="discount-input-inline">
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={discountInput}
                                        onChange={(e) => setDiscountInput(e.target.value)}
                                        min="0"
                                        max="100"
                                    />
                                    <span>%</span>
                                    <button onClick={applyDiscount}>Apply</button>
                                </div>
                            </div>

                            <div className="payment-methods">
                                <h3>Select Payment Method</h3>
                                <div className="payment-grid">
                                    <button
                                        className="payment-method-btn"
                                        onClick={() => handleSubmitOrder('CASH')}
                                        disabled={submitting}
                                    >
                                        <Banknote size={32} />
                                        <span>Cash</span>
                                    </button>
                                    <button
                                        className="payment-method-btn"
                                        onClick={() => handleSubmitOrder('CARD')}
                                        disabled={submitting}
                                    >
                                        <CreditCard size={32} />
                                        <span>Card</span>
                                    </button>
                                    <button
                                        className="payment-method-btn"
                                        onClick={() => handleSubmitOrder('UPI')}
                                        disabled={submitting}
                                    >
                                        <Smartphone size={32} />
                                        <span>UPI</span>
                                    </button>
                                </div>
                            </div>

                            {submitting && (
                                <div className="submitting-overlay">
                                    <div className="spinner" />
                                    <p>Processing order...</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Order Success Modal with WhatsApp Share */}
            <AnimatePresence>
                {showSuccess && completedOrder && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeSuccessModal}
                    >
                        <motion.div
                            className="success-modal"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="success-icon">
                                <Check size={48} />
                            </div>
                            <h2>Order Complete!</h2>
                            <p className="order-number">Order #{completedOrder.orderNumber}</p>
                            <p className="order-total">Total: ₹{completedOrder.total.toFixed(2)}</p>

                            <div className="success-actions">
                                <button
                                    className="btn whatsapp-btn"
                                    onClick={shareViaWhatsApp}
                                >
                                    <MessageCircle size={20} />
                                    Share Bill via WhatsApp
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={closeSuccessModal}
                                >
                                    New Order
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

    );
}
