// POS Billing Screen - Main Point of Sale Interface
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, ShoppingCart, Minus, Plus, Trash2, X,
    CreditCard, Banknote, Smartphone, Coffee,
    UtensilsCrossed, Globe, User, Phone, FileText,
    Sparkles, Flame, Check, Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore, useUIStore, useAuthStore, MenuItem, Category } from '../store';
import { menuAPI, categoriesAPI, ordersAPI } from '../api';
import { logger } from '../utils/logger';
import { OrderCompleteModal, OrderCompleteData } from '../components/order';
import { ReceiptData } from '../printing';
import { usePrinterConfigStore } from '../printing/printer-config-store';
import { useBranchSettingsStore } from '../store/branch-settings-store';
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
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
    const [cashReceived, setCashReceived] = useState<string>('');

    // Quick Picks Tab State
    const [isQuickPicksActive, setIsQuickPicksActive] = useState(false);

    // Customer details (optional)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [showCustomerInputs, setShowCustomerInputs] = useState(false);

    // Inline Discount Mode (₹ vs %)
    const [discountMode, setDiscountMode] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
    const [discountInput, setDiscountInput] = useState('');

    // Order notes
    const [orderNotes, setOrderNotes] = useState('');

    // Active editing item notes
    const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);

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
        updateItemNotes,
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

    // Keyboard Shortcuts (F4 to trigger payment)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F4') {
                e.preventDefault();
                if (cartItems.length > 0) {
                    openPaymentModal();
                } else {
                    toast.error('Add items to cart first');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cartItems]);

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

    // Helper to get quantity of an item currently in cart
    const getQuantityInCart = (itemId: string) => {
        return cartItems
            .filter((ci) => ci.menuItem.id === itemId)
            .reduce((sum, ci) => sum + ci.quantity, 0);
    };

    // Filter items
    const filteredItems = menuItems.filter((item) => {
        if (isQuickPicksActive) {
            // In Quick Picks mode, show items that match search query
            const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch && item.isAvailable;
        }

        const catObj = categories.find((c) => c.id === selectedCategory);
        const catIds = catObj && (catObj as any).ids ? (catObj as any).ids : (selectedCategory ? [selectedCategory] : []);

        const matchesCategory = !selectedCategory ||
            item.categoryId === selectedCategory ||
            catIds.includes(item.categoryId);

        const matchesSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSearch && item.isAvailable;
    });

    // If Quick Picks is active, limit to top 10 items
    const displayItems = isQuickPicksActive ? filteredItems.slice(0, 12) : filteredItems;

    // Handle add to cart
    const handleAddItem = (item: MenuItem) => {
        try {
            if (item.variants && item.variants.length > 0) {
                const defaultVariant = item.variants.find(v => v.isDefault) || item.variants[0];
                addItem(item, defaultVariant);
            } else {
                addItem(item);
            }
        } catch (error) {
            logger.error('Error adding item:', error);
            toast.error('Failed to add item');
        }
    };

    // Apply inline discount changes
    const handleDiscountChange = (valStr: string, mode: 'PERCENTAGE' | 'FIXED') => {
        setDiscountInput(valStr);
        const num = parseFloat(valStr);
        if (!isNaN(num) && num > 0) {
            if (mode === 'PERCENTAGE' && num <= 100) {
                setDiscount('PERCENTAGE', num);
            } else if (mode === 'FIXED') {
                setDiscount('FIXED', num);
            }
        } else {
            setDiscount(null, 0);
        }
    };

    const toggleDiscountMode = (newMode: 'PERCENTAGE' | 'FIXED') => {
        setDiscountMode(newMode);
        if (discountInput) {
            handleDiscountChange(discountInput, newMode);
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
                subtotal: getSubtotal(),
                discountAmount: getDiscountAmount(),
                total: getTotal(),
                totalAmount: getTotal(),
                items: cartItems.map((item) => ({
                    menuItemId: item.menuItem.id,
                    variantId: item.variant?.id || null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
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
            const branchSettings = useBranchSettingsStore.getState().settings;
            const cleanOrderNumber = response.data.orderNumber || response.data.dailyOrderNo || response.data.daily_order_no || 1;
            const cleanBillNumber = response.data.billNumber || response.data.bill_number || `#${String(cleanOrderNumber).padStart(3, '0')}`;

            const receiptData: ReceiptData = {
                businessName: branchSettings.name || user?.branch?.name || 'Billova POS',
                branchName: branchSettings.name || user?.branch?.name || '',
                address: branchSettings.address || '',
                phone: branchSettings.phone || '',
                gstNumber: branchSettings.gstEnabled ? branchSettings.gstNumber : undefined,
                orderNumber: cleanOrderNumber,
                billNumber: cleanBillNumber,
                orderType: orderType,
                tableName: (orderType === 'DINE_IN' && orderNotes.trim()) ? orderNotes.trim() : (orderType === 'DINE_IN' ? 'Counter' : undefined),
                orderDate: new Date(),
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                notes: orderNotes.trim() || undefined,
                onlinePlatform: orderType === 'ONLINE' ? (onlinePlatform || undefined) : undefined,
                onlineOrderId: orderType === 'ONLINE' ? (onlineOrderId.trim() || undefined) : undefined,
                items: cartItems.map((item) => ({
                    name: item.menuItem.name,
                    variant: item.variant?.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    notes: item.notes || undefined,
                })),
                subtotal: getSubtotal(),
                discountType: discountType,
                discountValue: discountValue || 0,
                discountAmount: getDiscountAmount(),
                gstAmount: 0,
                total: getTotal(),
                paymentMode: paymentMode,
                includeKOT: true,
            };

            // Save order details for modal
            setCompletedOrderData({
                orderId: response.data.id,
                orderNumber: cleanOrderNumber,
                billNumber: cleanBillNumber,
                total: getTotal(),
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                receiptData,
            });

            toast.success(`Order #${cleanOrderNumber} completed!`);
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
        if (orderType === 'ONLINE') {
            if (!onlinePlatform) setOnlinePlatform('SWIGGY');
        } else {
            setSelectedPaymentMethod('CASH');
            setCashReceived(getTotal().toFixed(0));
        }
        setShowPayment(true);
    };

    return (
        <div className="pos-container">
            {/* Left Side - Products & Categories (65% Width) */}
            <div className="pos-menu">
                {/* Top Action Bar: Order Types & Search */}
                <div className="pos-top-bar">
                    <div className="order-type-tabs">
                        <button
                            className={`order-type-tab ${orderType === 'DINE_IN' ? 'active' : ''}`}
                            onClick={() => setOrderType('DINE_IN')}
                        >
                            <UtensilsCrossed size={16} />
                            <span>Dine In</span>
                        </button>
                        <button
                            className={`order-type-tab ${orderType === 'TAKEAWAY' ? 'active' : ''}`}
                            onClick={() => setOrderType('TAKEAWAY')}
                        >
                            <Coffee size={16} />
                            <span>Takeaway</span>
                        </button>
                        <button
                            className={`order-type-tab ${orderType === 'ONLINE' ? 'active' : ''}`}
                            onClick={() => setOrderType('ONLINE')}
                        >
                            <Globe size={16} />
                            <span>Online</span>
                        </button>
                    </div>

                    {/* Search Bar with auto-focus styling */}
                    <div className="pos-search">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search food items... (Press / to search)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Pill Rail with ⭐ Quick Picks */}
                <div className="category-scroll custom-scrollbar">
                    <button
                        className={`category-btn ${!selectedCategory && !isQuickPicksActive ? 'active' : ''}`}
                        onClick={() => {
                            setIsQuickPicksActive(false);
                            setSelectedCategory(null);
                        }}
                    >
                        <span className="category-name">All</span>
                    </button>

                    <button
                        className={`category-btn quick-picks-btn ${isQuickPicksActive ? 'active' : ''}`}
                        onClick={() => {
                            setIsQuickPicksActive(true);
                            setSelectedCategory(null);
                        }}
                    >
                        <Flame size={14} className="quick-picks-icon" />
                        <span className="category-name">Quick Picks ⭐</span>
                    </button>

                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            className={`category-btn ${selectedCategory === cat.id && !isQuickPicksActive ? 'active' : ''}`}
                            onClick={() => {
                                setIsQuickPicksActive(false);
                                setSelectedCategory(cat.id);
                            }}
                        >
                            <span className="category-icon">{cat.icon || '🍽️'}</span>
                            <span className="category-name">{cat.name}</span>
                        </button>
                    ))}
                </div>

                {/* Product Cards Grid */}
                <div className={`menu-grid custom-scrollbar ${displayItems.length > 0 && displayItems.length <= 6 ? 'menu-grid-sparse' : ''}`}>
                    {loading ? (
                        <POSSkeleton />
                    ) : displayItems.length === 0 ? (
                        <div className="empty-state">
                            <Search size={36} strokeWidth={1.5} />
                            <p>No items found in this section</p>
                            <span className="empty-hint">Try selecting another category or check your search term</span>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {displayItems.map((item) => {
                                const inCartQty = getQuantityInCart(item.id);
                                const itemImage = (item as any).image_url || (item as any).image;
                                const itemPrice = Number(item.variants?.[0]?.price ?? item.price);

                                return (
                                    <motion.div
                                        key={item.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        whileHover={{ y: -3 }}
                                        whileTap={{ scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className={`menu-item-card ${inCartQty > 0 ? 'in-cart' : ''}`}
                                        onClick={() => handleAddItem(item)}
                                    >
                                        {/* Top Card Badges */}
                                        <div className="card-badge-row">
                                            {/* In-Cart Counter Badge */}
                                            {inCartQty > 0 ? (
                                                <span className="in-cart-badge">
                                                    {inCartQty} in cart
                                                </span>
                                            ) : (
                                                <span className="badge-placeholder" />
                                            )}

                                            <div className="card-top-right">
                                                {item.variants && item.variants.length > 1 && (
                                                    <span className="variant-badge">{item.variants.length} sizes</span>
                                                )}
                                                <div className={`veg-indicator ${item.isVeg ? 'veg' : 'non-veg'}`} />
                                            </div>
                                        </div>

                                        {/* Product Hero Image / Illustration */}
                                        <div className="item-hero-container">
                                            {itemImage ? (
                                                <img
                                                    src={itemImage}
                                                    alt={item.name}
                                                    className="item-hero-img"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="item-hero-fallback">
                                                    <span className="fallback-emoji">
                                                        {item.isVeg ? '🥗' : '🍗'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Details */}
                                        <div className="item-details">
                                            <h3 className="item-name" title={item.name}>
                                                {item.name}
                                            </h3>

                                            <div className="item-footer">
                                                <div className="item-price">
                                                    <span className="currency">₹</span>
                                                    <span className="price-num">{itemPrice}</span>
                                                </div>

                                                <button
                                                    type="button"
                                                    className={`card-add-btn ${inCartQty > 0 ? 'added' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddItem(item);
                                                    }}
                                                    title="Add to cart"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Right Side - Sticky Cart & Settlement (35% Width) */}
            <div className="pos-cart">
                {/* Cart Header */}
                <div className="cart-header">
                    <div className="cart-header-title">
                        <ShoppingCart size={20} className="cart-icon" />
                        <h2>CURRENT BILL</h2>
                    </div>

                    <div className="cart-header-actions">
                        <span className="cart-count-badge">
                            {getItemCount()} {getItemCount() === 1 ? 'item' : 'items'}
                        </span>
                        {cartItems.length > 0 && (
                            <button
                                className="clear-cart-btn"
                                onClick={clearCart}
                                title="Clear current cart"
                            >
                                <Trash2 size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Cart Items List */}
                <div className="cart-items custom-scrollbar">
                    {cartItems.length === 0 ? (
                        <div className="cart-empty">
                            <div className="empty-cart-icon-wrapper">
                                <ShoppingCart size={40} strokeWidth={1.5} />
                            </div>
                            <h3>Ready to create a bill?</h3>
                            <p>Select any item from the menu to get started.</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {cartItems.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="cart-item"
                                >
                                    <div className="cart-item-main">
                                        <div className="cart-item-details">
                                            <div className="cart-item-title-row">
                                                <span className="item-sno">{index + 1}.</span>
                                                <h4 className="cart-item-name">{formatProductName(item.menuItem.name)}</h4>
                                            </div>
                                            {item.variant && (
                                                <span className="variant-name">{item.variant.name}</span>
                                            )}
                                            <span className="item-unit-price">₹{item.unitPrice} each</span>
                                        </div>

                                        <div className="cart-item-controls">
                                            <div className="quantity-control">
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    className="qty-btn"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="qty-val">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="qty-btn"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            <span className="item-total">₹{item.total.toFixed(2)}</span>

                                            <button
                                                className="remove-btn"
                                                onClick={() => removeItem(item.id)}
                                                title="Remove item"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Item Cooking Modifiers / Notes */}
                                    <div className="cart-item-notes-row">
                                        {editingNoteItemId === item.id ? (
                                            <div className="item-note-input-wrapper">
                                                <input
                                                    type="text"
                                                    placeholder="e.g., Less spicy, no onion"
                                                    value={item.notes || ''}
                                                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                                                    autoFocus
                                                    onBlur={() => setEditingNoteItemId(null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setEditingNoteItemId(null);
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingNoteItemId(null)}
                                                    className="note-done-btn"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className={`item-note-toggle ${item.notes ? 'has-note' : ''}`}
                                                onClick={() => setEditingNoteItemId(item.id)}
                                            >
                                                <FileText size={12} />
                                                <span>{item.notes ? item.notes : '+ Add note / modifier'}</span>
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Collapsible Customer Info & Order Notes */}
                {cartItems.length > 0 && (
                    <div className="cart-customer-panel">
                        <button
                            type="button"
                            className="toggle-customer-btn"
                            onClick={() => setShowCustomerInputs(!showCustomerInputs)}
                        >
                            <span>
                                {customerName || customerPhone
                                    ? `Customer: ${customerName || customerPhone}`
                                    : '+ Add Customer / Order Note'}
                            </span>
                            {showCustomerInputs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showCustomerInputs && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="customer-fields-container"
                            >
                                <div className="customer-input-row">
                                    <div className="customer-input-group">
                                        <User size={14} />
                                        <input
                                            type="text"
                                            placeholder="Customer Name"
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                        />
                                    </div>
                                    <div className="customer-input-group">
                                        <Phone size={14} />
                                        <input
                                            type="tel"
                                            placeholder="Phone"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="order-notes-input-group">
                                    <FileText size={14} />
                                    <input
                                        type="text"
                                        placeholder="Order notes (e.g. Table 4, Pack with cutlery)"
                                        value={orderNotes}
                                        onChange={(e) => setOrderNotes(e.target.value)}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Sticky Cart Summary & Settlement Footer */}
                <div className="cart-footer">
                    {/* Inline Discount Switcher (₹ vs %) */}
                    <div className="inline-discount-row">
                        <span className="discount-label">Discount</span>
                        <div className="discount-controls">
                            <div className="discount-mode-toggle">
                                <button
                                    type="button"
                                    className={`mode-btn ${discountMode === 'FIXED' ? 'active' : ''}`}
                                    onClick={() => toggleDiscountMode('FIXED')}
                                >
                                    ₹
                                </button>
                                <button
                                    type="button"
                                    className={`mode-btn ${discountMode === 'PERCENTAGE' ? 'active' : ''}`}
                                    onClick={() => toggleDiscountMode('PERCENTAGE')}
                                >
                                    %
                                </button>
                            </div>

                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="0"
                                value={discountInput}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                    handleDiscountChange(val, discountMode);
                                }}
                                className="discount-input-box"
                            />
                        </div>
                    </div>

                    {/* Totals Breakdown */}
                    <div className="cart-totals">
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>₹{getSubtotal().toFixed(2)}</span>
                        </div>

                        {getDiscountAmount() > 0 && (
                            <div className="summary-row discount">
                                <span>
                                    Discount ({discountType === 'PERCENTAGE' ? `${discountValue}%` : `₹${discountValue}`})
                                </span>
                                <span>-₹{getDiscountAmount().toFixed(2)}</span>
                            </div>
                        )}

                        <div className="summary-row total-row">
                            <span className="total-label">TOTAL</span>
                            <span className="total-amount">₹{getTotal().toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Complete Bill CTA Button */}
                    <button
                        className="complete-bill-btn"
                        onClick={openPaymentModal}
                        disabled={cartItems.length === 0}
                    >
                        <Sparkles size={18} />
                        <span>COMPLETE BILL • ₹{getTotal().toFixed(2)}</span>
                        <span className="shortcut-hint">F4</span>
                    </button>
                </div>
            </div>

            {/* Checkout Payment Modal */}
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
                            className="checkout-payment-modal"
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="checkout-modal-header">
                                <div>
                                    <h2>{orderType === 'ONLINE' ? 'Online Delivery Order' : 'Checkout Payment'}</h2>
                                    <p className="checkout-modal-subtitle">
                                        {orderType === 'ONLINE'
                                            ? 'Select Swiggy or Zomato to confirm and print order.'
                                            : 'Select payment method and collect payment.'}
                                    </p>
                                </div>
                                <button className="close-btn" onClick={() => setShowPayment(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* TOTAL PAYABLE Top Banner */}
                            <div className="total-payable-banner">
                                <span className="payable-label">TOTAL PAYABLE</span>
                                <div className="payable-amount">
                                    <span className="currency">₹</span>
                                    <span>{getTotal().toFixed(2)}</span>
                                </div>
                            </div>

                            {/* ONLINE ORDER FLOW: Swiggy vs Zomato */}
                            {orderType === 'ONLINE' ? (
                                <div className="online-aggregator-section">
                                    <label className="section-label">Select Delivery Partner</label>
                                    <div className="online-platform-grid">
                                        <button
                                            type="button"
                                            className={`online-partner-card swiggy ${(onlinePlatform || 'SWIGGY') === 'SWIGGY' ? 'selected' : ''}`}
                                            onClick={() => setOnlinePlatform('SWIGGY')}
                                        >
                                            <div className="partner-logo-box swiggy-bg">
                                                <img
                                                    src="https://logos-world.net/wp-content/uploads/2020/11/Swiggy-Logo.png"
                                                    alt="Swiggy"
                                                    className="partner-logo-img"
                                                />
                                            </div>
                                            <div className="partner-info">
                                                <h4>Swiggy</h4>
                                                <span>Online Delivery</span>
                                            </div>
                                            {(onlinePlatform || 'SWIGGY') === 'SWIGGY' && (
                                                <div className="partner-check-icon">
                                                    <Check size={16} />
                                                </div>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            className={`online-partner-card zomato ${onlinePlatform === 'ZOMATO' ? 'selected' : ''}`}
                                            onClick={() => setOnlinePlatform('ZOMATO')}
                                        >
                                            <div className="partner-logo-box zomato-bg">
                                                <img
                                                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Zomato_Logo.svg/1280px-Zomato_Logo.svg.png"
                                                    alt="Zomato"
                                                    className="partner-logo-img"
                                                />
                                            </div>
                                            <div className="partner-info">
                                                <h4>Zomato</h4>
                                                <span>Online Delivery</span>
                                            </div>
                                            {onlinePlatform === 'ZOMATO' && (
                                                <div className="partner-check-icon">
                                                    <Check size={16} />
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    {/* Optional Order ID & Notes for Online */}
                                    <div className="online-details-inputs">
                                        <div className="modal-input-group">
                                            <Tag size={14} />
                                            <input
                                                type="text"
                                                placeholder={`${onlinePlatform || 'Swiggy'} Order ID / Token (optional)`}
                                                value={onlineOrderId}
                                                onChange={(e) => setOnlineOrderId(e.target.value)}
                                            />
                                        </div>
                                        <div className="modal-input-group">
                                            <FileText size={14} />
                                            <input
                                                type="text"
                                                placeholder="Packaging / Kitchen Notes (optional)"
                                                value={orderNotes}
                                                onChange={(e) => setOrderNotes(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Button for Online Orders */}
                                    <button
                                        className="modal-complete-bill-btn"
                                        onClick={() => handleSubmitOrder(onlinePlatform || 'SWIGGY')}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="button-spinner" />
                                                <span>CONFIRMING ORDER...</span>
                                            </>
                                        ) : (
                                            <span>CONFIRM & PRINT BILL</span>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                /* DINE-IN & TAKEAWAY FLOW: Cash, UPI, Card */
                                <>
                                    {/* Payment Method Selector (3 Segmented Pills) */}
                                    <div className="payment-method-pills">
                                        <button
                                            type="button"
                                            className={`method-pill ${selectedPaymentMethod === 'CASH' ? 'active' : ''}`}
                                            onClick={() => setSelectedPaymentMethod('CASH')}
                                        >
                                            <Banknote size={18} />
                                            <span>Cash</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`method-pill ${selectedPaymentMethod === 'UPI' ? 'active' : ''}`}
                                            onClick={() => setSelectedPaymentMethod('UPI')}
                                        >
                                            <Smartphone size={18} />
                                            <span>UPI</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`method-pill ${selectedPaymentMethod === 'CARD' ? 'active' : ''}`}
                                            onClick={() => setSelectedPaymentMethod('CARD')}
                                        >
                                            <CreditCard size={18} />
                                            <span>Card</span>
                                        </button>
                                    </div>

                                    {/* Tender Specific Body */}
                                    {selectedPaymentMethod === 'CASH' && (
                                        <div className="cash-tender-section">
                                            <div className="cash-input-header">
                                                <label className="section-label">Cash Received</label>
                                                <span className="section-helper">Type or tap quick cash</span>
                                            </div>

                                            <div className="cash-input-wrapper">
                                                <span className="input-currency">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={cashReceived}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                                        setCashReceived(val);
                                                    }}
                                                    placeholder="0"
                                                    className="cash-input-field"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* ⚡ Quick Cash Denomination Buttons */}
                                            <div className="quick-cash-row">
                                                <div className="quick-cash-label">
                                                    <Sparkles size={12} />
                                                    <span>QUICK CASH</span>
                                                </div>
                                                <div className="quick-cash-buttons">
                                                    <button
                                                        type="button"
                                                        className={`quick-cash-btn exact ${cashReceived === getTotal().toFixed(0) || cashReceived === getTotal().toString() ? 'selected' : ''}`}
                                                        onClick={() => setCashReceived(getTotal().toFixed(0))}
                                                    >
                                                        Exact ₹{getTotal().toFixed(0)}
                                                    </button>

                                                    {[50, 100, 200, 500, 1000, 2000]
                                                        .filter(denom => denom >= getTotal())
                                                        .slice(0, 4)
                                                        .map(denom => (
                                                            <button
                                                                key={denom}
                                                                type="button"
                                                                className={`quick-cash-btn ${cashReceived === denom.toString() ? 'selected' : ''}`}
                                                                onClick={() => setCashReceived(denom.toString())}
                                                            >
                                                                ₹{denom}
                                                            </button>
                                                        ))
                                                    }
                                                </div>
                                            </div>

                                            {/* Change to Return Banner */}
                                            <div className="change-return-banner">
                                                <span className="change-label">Change to Return</span>
                                                <span className="change-amount">
                                                    ₹{Math.max(0, (parseFloat(cashReceived || '0') - getTotal())).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedPaymentMethod === 'UPI' && (
                                        <div className="upi-tender-section">
                                            <div className="tender-info-card">
                                                <Smartphone size={32} className="tender-info-icon" />
                                                <div className="tender-info-text">
                                                    <h4>Dynamic UPI Payment</h4>
                                                    <p>Scan the merchant QR code on billing counter or verify customer UPI transfer.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedPaymentMethod === 'CARD' && (
                                        <div className="card-tender-section">
                                            <div className="tender-info-card">
                                                <CreditCard size={32} className="tender-info-icon" />
                                                <div className="tender-info-text">
                                                    <h4>Card Swipe / Tap</h4>
                                                    <p>Swipe or tap credit/debit card on EDC POS Machine and complete transaction.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Optional Customer Details for Dine In / Takeaway */}
                                    <div className="modal-customer-section">
                                        <div className="modal-customer-inputs">
                                            <div className="modal-input-group">
                                                <User size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Customer Name (optional)"
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                />
                                            </div>
                                            <div className="modal-input-group">
                                                <Phone size={14} />
                                                <input
                                                    type="tel"
                                                    placeholder="Phone Number (optional)"
                                                    value={customerPhone}
                                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Full-Width Complete Bill Action Button */}
                                    <button
                                        className="modal-complete-bill-btn"
                                        onClick={() => handleSubmitOrder(selectedPaymentMethod)}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="button-spinner" />
                                                <span>PROCESSING ORDER...</span>
                                            </>
                                        ) : (
                                            <span>COMPLETE BILL</span>
                                        )}
                                    </button>
                                </>
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
