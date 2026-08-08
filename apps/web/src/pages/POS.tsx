// POS Billing Screen - Main Point of Sale Interface
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ShoppingCart, Minus, Plus, Trash2, X,
    CreditCard, Banknote, Smartphone, Percent, Coffee,
    UtensilsCrossed, Globe, User, Phone, Receipt, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore, useUIStore, useAuthStore, MenuItem, Category } from '../store';
import { menuAPI, categoriesAPI, ordersAPI } from '../api';
import { logger } from '../utils/logger';
import { OrderCompleteModal, OrderCompleteData } from '../components/order';
import { ReceiptData } from '../printing';
import { usePrinterConfigStore } from '../printing/printer-config-store';
import './POS.css';
import { POSSkeleton } from '../components/Skeleton';

// Helper function to format product names with proper title case
function formatProductName(name: string): string {
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}


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

    // Order success state
    const [showSuccess, setShowSuccess] = useState(false);
    const [completedOrderData, setCompletedOrderData] = useState<OrderCompleteData | null>(null);


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

    // Printer settings for daily order reset
    const { settings: printerSettings } = usePrinterConfigStore();

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
        } catch (error) {
            logger.error('Failed to fetch data:', error);
            toast.error('Failed to load menu');
        } finally {
            setLoading(false);
        }
    };

    // Filter items
    const filteredItems = menuItems.filter((item) => {
        const catObj = categories.find((c) => c.id === selectedCategory);
        const catIds = catObj && (catObj as any).ids ? (catObj as any).ids : (selectedCategory ? [selectedCategory] : []);

        const matchesCategory = !selectedCategory ||
            item.categoryId === selectedCategory ||
            catIds.includes(item.categoryId);

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
            logger.error('Error adding item:', error);
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

            logger.debug('Creating order:', orderData);
            const response = await ordersAPI.create(orderData, {
                dailyReset: printerSettings.dailyOrderReset
            });
            logger.debug('Order created:', response.data);

            // Add payment
            await ordersAPI.addPayment(response.data.id, {
                mode: paymentMode,
                amount: getTotal(),
            });

            // Prepare receipt data for printing
            const receiptData: ReceiptData = {
                businessName: user?.branch?.name || 'Billova POS',
                branchName: '',
                address: '',
                phone: '',
                orderNumber: response.data.orderNumber || 0,
                billNumber: response.data.billNumber || `B-${response.data.orderNumber}`,
                orderType: orderType,
                orderDate: new Date(),
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                items: cartItems.map((item) => ({
                    name: item.menuItem.name,
                    variant: item.variant?.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                })),
                subtotal: getSubtotal(),
                discountType: discountType,
                discountValue: discountValue || 0,
                discountAmount: getDiscountAmount(),
                gstAmount: 0,
                total: getTotal(),
                paymentMode: paymentMode,
            };

            // Save order details for modal
            setCompletedOrderData({
                orderId: response.data.id,
                orderNumber: response.data.orderNumber || 0,
                billNumber: response.data.billNumber || `B-${response.data.orderNumber}`,
                total: getTotal(),
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                receiptData,
            });

            toast.success(`Order #${response.data.orderNumber || 'Created'} completed!`);
            setShowPayment(false);
            setShowSuccess(true);

            // Clear form data
            clearCart();
            setCustomerName('');
            setCustomerPhone('');
            setDiscountInput('');
            setOrderNotes('');
            setOnlinePlatform(null);
            setOnlineOrderId('');
        } catch (error: any) {
            logger.error('Order failed:', error);
            const errorMessage = error.response?.data?.error || 'Failed to create order';
            toast.error(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };
    // Close success modal and start new order
    const handleNewOrder = () => {
        setShowSuccess(false);
        setCompletedOrderData(null);
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
                    <button
                        className={`category-btn ${!selectedCategory ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(null)}
                    >
                        <span className="category-icon">🍽️</span>
                        <span className="category-name">All</span>
                    </button>
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
                <div className={`menu-grid ${filteredItems.length > 0 && filteredItems.length <= 6 ? 'menu-grid-sparse' : ''}`}>
                    {loading ? (
                        <POSSkeleton />
                    ) : filteredItems.length === 0 ? (
                        <div className="empty-state">
                            <Search size={32} strokeWidth={1.5} />
                            <p>No items in this category</p>
                            <span className="empty-hint">Try selecting a different category or add items from the Menu page</span>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    transition={{ duration: 0.15 }}
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
                            {cartItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="cart-item"
                                >
                                    <span className="item-sno">{index + 1}.</span>
                                    <div className="cart-item-info">
                                        <h4>{formatProductName(item.menuItem.name)}</h4>
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

                {/* Customer Info Section (Optional) */}
                {cartItems.length > 0 && (
                    <div className="customer-info-section">
                        <div className="customer-input-row">
                            <div className="customer-input-group">
                                <User size={16} />
                                <input
                                    type="text"
                                    placeholder="Customer Name (optional)"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                />
                            </div>
                            <div className="customer-input-group">
                                <Phone size={16} />
                                <input
                                    type="tel"
                                    placeholder="Phone (optional)"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

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
                                    {cartItems.map((item) => (
                                        <div key={item.id} className="bill-item-row">
                                            <span className="bill-item-name">
                                                {formatProductName(item.menuItem.name)}
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

            {/* Order Complete Modal with Print and WhatsApp */}
            <OrderCompleteModal
                isOpen={showSuccess}
                orderData={completedOrderData}
                onClose={handleNewOrder}
                onNewOrder={handleNewOrder}
            />
        </div>

    );
}
