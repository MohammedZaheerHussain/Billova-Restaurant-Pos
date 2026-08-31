import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingBag, Clock, X, User, Phone, CreditCard,
    Banknote, Smartphone, Receipt, CheckCircle, XCircle, Edit,
    Plus, FileText, Search, Minus, CheckSquare, Square, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersAPI, menuAPI } from '../api';
import { useAuthStore, MenuItem } from '../store';
import { useBranchSettingsStore } from '../store/branch-settings-store';
import { reprintReceipt, ReceiptData } from '../printing';
import './Orders.css';
import { OrdersSkeleton } from '../components/Skeleton';
import { DatePicker } from '../components/ui';
import { logger } from '../utils/logger';

interface OrderItem {
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    notes?: string;
    menuItem: { id: string; name: string };
    variant?: { id: string; name: string };
}

interface Payment {
    id: string;
    mode: string;
    amount: number;
    createdAt: string;
}

interface Order {
    id: string;
    orderNumber: number;
    orderType: string;
    status: string;
    subtotal: number;
    discountType?: string;
    discountValue?: number;
    discountAmount: number;
    gstAmount: number;
    total: number;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    items: OrderItem[];
    payments: Payment[];
    createdAt: string;
    user: { name: string };
    table?: { name: string };
}

interface NewItem {
    menuItem: MenuItem;
    quantity: number;
    variantId?: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PENDING');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    // Use local date to avoid timezone issues (toISOString uses UTC)
    const getLocalDateString = (d = new Date()) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const [selectedDate, setSelectedDate] = useState(getLocalDateString());
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    const formatDateHuman = (dateStr: string) => {
        if (!dateStr) return '';
        const today = getLocalDateString();
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const formatted = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        if (dateStr === today) return `Today (${formatted})`;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateStr === getLocalDateString(yesterday)) return `Yesterday (${formatted})`;
        return formatted;
    };

    // Edit modal state
    const [menuSearch, setMenuSearch] = useState('');
    const [newItems, setNewItems] = useState<NewItem[]>([]);
    const [addingItems, setAddingItems] = useState(false);

    // Bulk selection state
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [bulkClosing, setBulkClosing] = useState(false);

    const [orderSearch, setOrderSearch] = useState('');
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        fetchOrders();
        fetchMenuItems();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [selectedDate]);

    // Clear selection when filter/date changes
    useEffect(() => {
        setSelectedOrderIds(new Set());
    }, [filter, selectedDate, orderSearch]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await ordersAPI.getAll({ date: selectedDate });
            setOrders(response.data || []);
        } catch (error) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchMenuItems = async () => {
        try {
            const response = await menuAPI.getAll(user?.branch?.id);
            setMenuItems(response.data || []);
        } catch (error) {
            logger.error('Failed to fetch menu items');
        }
    };

    // Tab counts
    const pendingCount = useMemo(() => orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length, [orders]);
    const completedCount = useMemo(() => orders.filter(o => o.status === 'COMPLETED').length, [orders]);
    const cancelledCount = useMemo(() => orders.filter(o => o.status === 'CANCELLED').length, [orders]);
    const allCount = orders.length;

    // Filter menu items for search
    const filteredMenuItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(menuSearch.toLowerCase()) && item.isAvailable
    ).slice(0, 8);

    // Filter orders based on status & search
    const filteredOrders = orders.filter((order) => {
        let matchesStatus = true;
        if (filter === 'all') matchesStatus = true;
        else if (filter === 'PENDING') {
            matchesStatus = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status);
        } else {
            matchesStatus = order.status === filter;
        }

        const q = orderSearch.trim().toLowerCase();
        const matchesSearch = !q ||
            String(order.orderNumber).includes(q) ||
            (order.customerName && order.customerName.toLowerCase().includes(q)) ||
            (order.customerPhone && order.customerPhone.includes(q)) ||
            (order.table?.name && order.table.name.toLowerCase().includes(q));

        return matchesStatus && matchesSearch;
    });

    // Update order status
    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            await ordersAPI.updateStatus(orderId, newStatus);
            toast.success(`Order marked as ${newStatus}`);
            fetchOrders();
            setSelectedOrder(null);
        } catch (error) {
            toast.error('Failed to update order status');
        }
    };

    // Add item to new items list
    const addNewItem = (item: MenuItem) => {
        const existing = newItems.find(ni => ni.menuItem.id === item.id);
        if (existing) {
            setNewItems(newItems.map(ni =>
                ni.menuItem.id === item.id
                    ? { ...ni, quantity: ni.quantity + 1 }
                    : ni
            ));
        } else {
            // Get default variant
            const defaultVariant = item.variants?.find(v => v.isDefault) || item.variants?.[0];
            setNewItems([...newItems, {
                menuItem: item,
                quantity: 1,
                variantId: defaultVariant?.id
            }]);
        }
        toast.success(`Added ${item.name}`);
    };

    // Update new item quantity
    const updateNewItemQty = (menuItemId: string, delta: number) => {
        setNewItems(newItems.map(ni => {
            if (ni.menuItem.id === menuItemId) {
                const newQty = ni.quantity + delta;
                return newQty > 0 ? { ...ni, quantity: newQty } : ni;
            }
            return ni;
        }).filter(ni => ni.quantity > 0));
    };

    // Remove new item
    const removeNewItem = (menuItemId: string) => {
        setNewItems(newItems.filter(ni => ni.menuItem.id !== menuItemId));
    };

    // Calculate new items total
    const getNewItemsTotal = () => {
        return newItems.reduce((sum, ni) => {
            const price = ni.menuItem.variants?.find(v => v.id === ni.variantId)?.price
                || ni.menuItem.price;
            return sum + (Number(price) * ni.quantity);
        }, 0);
    };

    // Submit new items to order
    const submitNewItems = async () => {
        if (!editingOrder || newItems.length === 0) return;

        try {
            setAddingItems(true);
            const items = newItems.map(ni => ({
                menuItemId: ni.menuItem.id,
                variantId: ni.variantId || undefined,
                quantity: ni.quantity,
            }));

            await ordersAPI.addItems(editingOrder.id, items);
            toast.success('Items added successfully!');
            setNewItems([]);
            setEditingOrder(null);
            setMenuSearch('');
            fetchOrders();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Failed to add items';
            toast.error(msg);
        } finally {
            setAddingItems(false);
        }
    };

    // Close edit modal
    const closeEditModal = () => {
        setEditingOrder(null);
        setNewItems([]);
        setMenuSearch('');
    };

    // Toggle order selection
    const toggleOrderSelection = (orderId: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(orderId)) {
            newSet.delete(orderId);
        } else {
            newSet.add(orderId);
        }
        setSelectedOrderIds(newSet);
    };

    // Select all pending orders
    const selectAllPending = () => {
        const pendingOrders = filteredOrders.filter(o =>
            ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)
        );
        if (selectedOrderIds.size === pendingOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(pendingOrders.map(o => o.id)));
        }
    };

    // Bulk close selected orders
    const bulkCloseOrders = async () => {
        if (selectedOrderIds.size === 0) {
            toast.error('No orders selected');
            return;
        }

        const confirmClose = window.confirm(
            `Are you sure you want to close ${selectedOrderIds.size} order(s)?`
        );
        if (!confirmClose) return;

        try {
            setBulkClosing(true);
            const promises = Array.from(selectedOrderIds).map(orderId =>
                ordersAPI.updateStatus(orderId, 'COMPLETED')
            );
            await Promise.all(promises);
            toast.success(`${selectedOrderIds.size} orders closed successfully!`);
            setSelectedOrderIds(new Set());
            fetchOrders();
        } catch (error) {
            toast.error('Failed to close some orders');
        } finally {
            setBulkClosing(false);
        }
    };

    // Print bill for an order
    const handlePrintBill = async (order: Order) => {
        const user = useAuthStore.getState().user;
        const branchSettings = useBranchSettingsStore.getState().settings;

        const cleanOrderNumber = order.orderNumber || 1;
        const cleanBillNumber = `#${String(cleanOrderNumber).padStart(3, '0')}`;

        const receiptData: ReceiptData = {
            businessName: branchSettings.name || user?.branch?.name || 'Billova POS',
            branchName: branchSettings.name || user?.branch?.name || '',
            address: branchSettings.address || '',
            phone: branchSettings.phone || '',
            gstNumber: branchSettings.gstEnabled ? branchSettings.gstNumber : undefined,
            orderNumber: cleanOrderNumber,
            billNumber: cleanBillNumber,
            orderType: order.orderType as 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE',
            orderDate: new Date(order.createdAt),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            items: order.items.map(item => ({
                name: item.menuItem.name,
                variant: item.variant?.name,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                total: Number(item.total),
            })),
            subtotal: Number(order.subtotal),
            discountAmount: Number(order.discountAmount || 0),
            gstAmount: Number(order.gstAmount || 0),
            total: Number(order.total),
            paymentMode: order.payments?.[0]?.mode || 'CASH',
            includeKOT: true,
        };

        try {
            const success = await reprintReceipt(receiptData);
            if (success) {
                toast.success('Bill printed successfully!');
            } else {
                toast.error('Print failed - check printer settings');
            }
        } catch (error) {
            logger.error('Print error:', error);
            toast.error('Failed to print bill');
        }
    };


    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return '#f59e0b';
            case 'CONFIRMED': return '#3b82f6';
            case 'PREPARING': return '#8b5cf6';
            case 'READY': return '#22c55e';
            case 'COMPLETED': return '#10b981';
            case 'CANCELLED': return '#dc2626';
            default: return '#6b7280';
        }
    };

    const getOrderTypeLabel = (type: string) => {
        switch (type) {
            case 'DINE_IN': return { icon: '🍽️', label: 'Dine In' };
            case 'TAKEAWAY': return { icon: '🥡', label: 'Takeaway' };
            case 'ONLINE': return { icon: '📱', label: 'Online' };
            default: return { icon: '📦', label: type };
        }
    };

    const getPaymentIcon = (mode: string) => {
        switch (mode) {
            case 'CASH': return <Banknote size={16} />;
            case 'CARD': return <CreditCard size={16} />;
            case 'UPI': return <Smartphone size={16} />;
            default: return <CreditCard size={16} />;
        }
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
    };

    const canEditOrder = (status: string) => {
        return !['COMPLETED', 'CANCELLED'].includes(status);
    };

    const totalSales = filteredOrders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + Number(o.total), 0);

    return (
        <div className="orders-page">
            <div className="page-header">
                <div>
                    <h1>Orders & Bills</h1>
                    <p>{filteredOrders.length} orders · ₹{totalSales.toFixed(2)} sales</p>
                </div>
                <div className="header-actions">
                    <div className="orders-search-box">
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder="Search orders, customers, tables..."
                            value={orderSearch}
                            onChange={(e) => setOrderSearch(e.target.value)}
                        />
                        {orderSearch && (
                            <button className="search-clear-btn" onClick={() => setOrderSearch('')}>
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <DatePicker
                        value={selectedDate}
                        onChange={(newDate) => setSelectedDate(newDate)}
                    />

                    <div className="filter-tabs">
                        {[
                            { key: 'all', label: 'All', count: allCount },
                            { key: 'PENDING', label: 'Pending', count: pendingCount },
                            { key: 'COMPLETED', label: 'Completed', count: completedCount },
                            { key: 'CANCELLED', label: 'Cancelled', count: cancelledCount },
                        ].map((f) => (
                            <button
                                key={f.key}
                                className={`filter-tab ${filter === f.key ? 'active' : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                <span>{f.label}</span>
                                <span className="filter-count-badge">{f.count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Bulk Close Button */}
                    {selectedOrderIds.size > 0 && (
                        <button
                            className="btn btn-success bulk-close-btn"
                            onClick={bulkCloseOrders}
                            disabled={bulkClosing}
                        >
                            <CheckCircle size={16} />
                            {bulkClosing ? 'Closing...' : `Close ${selectedOrderIds.size} Selected`}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <OrdersSkeleton />
            ) : filteredOrders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon-box">
                        <ShoppingBag size={42} strokeWidth={1.5} />
                    </div>
                    <h3>No Orders Found</h3>
                    <p>
                        {orderSearch
                            ? `No orders matching "${orderSearch}" on ${formatDateHuman(selectedDate)}`
                            : `There are no ${filter !== 'all' ? filter.toLowerCase() : ''} orders recorded for ${formatDateHuman(selectedDate)}`}
                    </p>
                </div>
            ) : (
                <div className="orders-table-wrapper">
                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th className="checkbox-col">
                                    <button
                                        className="select-all-btn"
                                        onClick={selectAllPending}
                                        title="Select all pending orders"
                                    >
                                        {selectedOrderIds.size > 0 ?
                                            <CheckSquare size={18} /> :
                                            <Square size={18} />
                                        }
                                    </button>
                                </th>
                                <th>Order #</th>
                                <th>Type</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const { time } = formatDateTime(order.createdAt);
                                const typeInfo = getOrderTypeLabel(order.orderType);
                                const isEditable = canEditOrder(order.status);
                                const isSelected = selectedOrderIds.has(order.id);

                                return (
                                    <motion.tr
                                        key={order.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={isSelected ? 'selected-row' : ''}
                                    >
                                        <td className="checkbox-col">
                                            {isEditable && (
                                                <button
                                                    className="row-checkbox"
                                                    onClick={() => toggleOrderSelection(order.id)}
                                                >
                                                    {isSelected ?
                                                        <CheckSquare size={18} className="checked" /> :
                                                        <Square size={18} />
                                                    }
                                                </button>
                                            )}
                                        </td>
                                        <td className="order-num">#{order.orderNumber}</td>
                                        <td>
                                            <span className="order-type">
                                                {typeInfo.icon} {typeInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            {order.customerName || '-'}
                                            {order.customerPhone && (
                                                <small className="customer-phone">{order.customerPhone}</small>
                                            )}
                                        </td>
                                        <td>
                                            <span className="items-count">
                                                {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                                            </span>
                                        </td>
                                        <td className="order-total">₹{Number(order.total).toFixed(2)}</td>
                                        <td>
                                            {order.payments?.length > 0 ? (
                                                <span className="payment-mode">
                                                    {getPaymentIcon(order.payments[0].mode)}
                                                    {order.payments[0].mode}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="order-time">
                                            <Clock size={14} /> {time}
                                        </td>
                                        <td>
                                            <span
                                                className="status-badge"
                                                style={{
                                                    backgroundColor: getStatusColor(order.status) + '20',
                                                    color: getStatusColor(order.status),
                                                }}
                                            >
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            {isEditable && (
                                                <>
                                                    <button
                                                        className="action-icon complete"
                                                        onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                                                        title="Mark Complete"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        className="action-icon cancel"
                                                        onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                                                        title="Cancel Order"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button
                                                        className="action-icon edit"
                                                        onClick={() => setEditingOrder(order)}
                                                        title="Edit Order"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                className="action-icon view"
                                                onClick={() => setSelectedOrder(order)}
                                                title="View Bill"
                                            >
                                                <Receipt size={18} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Order Detail Modal */}
            <AnimatePresence>
                {selectedOrder && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedOrder(null)}
                    >
                        <motion.div
                            className="order-detail-modal"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>
                                    <Receipt size={22} />
                                    Bill #{selectedOrder.orderNumber}
                                </h2>
                                <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="order-info-section">
                                <div className="info-row">
                                    <span>Order Type:</span>
                                    <span>{getOrderTypeLabel(selectedOrder.orderType).icon} {getOrderTypeLabel(selectedOrder.orderType).label}</span>
                                </div>
                                <div className="info-row">
                                    <span>Date & Time:</span>
                                    <span>
                                        {formatDateTime(selectedOrder.createdAt).date} at {formatDateTime(selectedOrder.createdAt).time}
                                    </span>
                                </div>
                                {selectedOrder.customerName && (
                                    <div className="info-row">
                                        <span><User size={14} /> Customer:</span>
                                        <span>{selectedOrder.customerName}</span>
                                    </div>
                                )}
                                {selectedOrder.customerPhone && (
                                    <div className="info-row">
                                        <span><Phone size={14} /> Phone:</span>
                                        <span>{selectedOrder.customerPhone}</span>
                                    </div>
                                )}
                                {selectedOrder.notes && (
                                    <div className="info-row notes">
                                        <span><FileText size={14} /> Notes:</span>
                                        <span>{selectedOrder.notes}</span>
                                    </div>
                                )}
                            </div>

                            <div className="order-items-section">
                                <div className="items-header">
                                    <span>Item</span>
                                    <span>Qty</span>
                                    <span>Price</span>
                                    <span>Total</span>
                                </div>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={item.id} className="item-row">
                                        <span className="item-name">
                                            {idx + 1}. {item.menuItem.name}
                                            {item.variant && <small> ({item.variant.name})</small>}
                                        </span>
                                        <span className="item-qty">x{item.quantity}</span>
                                        <span className="item-price">₹{Number(item.unitPrice).toFixed(2)}</span>
                                        <span className="item-total">₹{Number(item.total).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bill-summary-section">
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
                                </div>
                                {selectedOrder.discountAmount > 0 && (
                                    <div className="summary-row discount">
                                        <span>Discount ({selectedOrder.discountValue}%)</span>
                                        <span>-₹{Number(selectedOrder.discountAmount).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="summary-row total">
                                    <span>Grand Total</span>
                                    <span>₹{Number(selectedOrder.total).toFixed(2)}</span>
                                </div>
                            </div>

                            {selectedOrder.payments?.length > 0 && (
                                <div className="payment-section">
                                    <h4>Payment Details</h4>
                                    {selectedOrder.payments.map((payment) => (
                                        <div key={payment.id} className="payment-row">
                                            <span>
                                                {getPaymentIcon(payment.mode)} {payment.mode}
                                            </span>
                                            <span>₹{Number(payment.amount).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="modal-actions">
                                <span
                                    className="status-badge large"
                                    style={{
                                        backgroundColor: getStatusColor(selectedOrder.status) + '20',
                                        color: getStatusColor(selectedOrder.status),
                                    }}
                                >
                                    {selectedOrder.status}
                                </span>

                                {canEditOrder(selectedOrder.status) && (
                                    <div className="action-buttons">
                                        <button
                                            className="btn btn-success"
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'COMPLETED')}
                                        >
                                            <CheckCircle size={18} /> Complete
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => updateOrderStatus(selectedOrder.id, 'CANCELLED')}
                                        >
                                            <XCircle size={18} /> Cancel
                                        </button>
                                    </div>
                                )}

                                {/* Print Bill Button - Always visible */}
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => handlePrintBill(selectedOrder)}
                                    style={{ marginTop: 12 }}
                                >
                                    <Printer size={18} /> Print Bill
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Order Modal with Item Addition */}
            <AnimatePresence>
                {editingOrder && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeEditModal}
                    >
                        <motion.div
                            className="edit-order-modal expanded"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>
                                    <Edit size={22} />
                                    Edit Order #{editingOrder.orderNumber}
                                </h2>
                                <button className="close-btn" onClick={closeEditModal}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="edit-content">
                                {/* Left: Menu Search */}
                                <div className="edit-menu-section">
                                    <h4>Add Items</h4>
                                    <div className="menu-search-box">
                                        <Search size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search menu items..."
                                            value={menuSearch}
                                            onChange={(e) => setMenuSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="menu-items-list">
                                        {filteredMenuItems.map(item => (
                                            <div
                                                key={item.id}
                                                className="menu-item-row"
                                                onClick={() => addNewItem(item)}
                                            >
                                                <div className="menu-item-info">
                                                    <span className="menu-item-name">{item.name}</span>
                                                    <span className="menu-item-price">
                                                        ₹{item.variants?.[0]?.price || item.price}
                                                    </span>
                                                </div>
                                                <button className="add-item-btn">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        {filteredMenuItems.length === 0 && menuSearch && (
                                            <p className="no-results">No items found</p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Current + New Items */}
                                <div className="edit-items-section">
                                    <h4>Order Items</h4>

                                    {/* Existing Items */}
                                    <div className="existing-items">
                                        {editingOrder.items.map((item) => (
                                            <div key={item.id} className="edit-item-row existing">
                                                <span className="edit-item-name">
                                                    {item.menuItem.name}
                                                    {item.variant && <small> ({item.variant.name})</small>}
                                                </span>
                                                <span className="edit-item-qty">x{item.quantity}</span>
                                                <span className="edit-item-total">₹{Number(item.total).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* New Items to Add */}
                                    {newItems.length > 0 && (
                                        <div className="new-items">
                                            <h5>New Items to Add</h5>
                                            {newItems.map(ni => {
                                                const price = ni.menuItem.variants?.find(v => v.id === ni.variantId)?.price
                                                    || ni.menuItem.price;
                                                return (
                                                    <div key={ni.menuItem.id} className="edit-item-row new">
                                                        <span className="edit-item-name">{ni.menuItem.name}</span>
                                                        <div className="qty-controls">
                                                            <button onClick={() => updateNewItemQty(ni.menuItem.id, -1)}>
                                                                <Minus size={14} />
                                                            </button>
                                                            <span>{ni.quantity}</span>
                                                            <button onClick={() => updateNewItemQty(ni.menuItem.id, 1)}>
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                        <span className="edit-item-total">
                                                            ₹{(Number(price) * ni.quantity).toFixed(2)}
                                                        </span>
                                                        <button
                                                            className="remove-item-btn"
                                                            onClick={() => removeNewItem(ni.menuItem.id)}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="edit-summary">
                                <div className="summary-line">
                                    <span>Current Total:</span>
                                    <span>₹{Number(editingOrder.total).toFixed(2)}</span>
                                </div>
                                {newItems.length > 0 && (
                                    <>
                                        <div className="summary-line new-total">
                                            <span>+ New Items:</span>
                                            <span>₹{getNewItemsTotal().toFixed(2)}</span>
                                        </div>
                                        <div className="summary-line grand-total">
                                            <span>New Total:</span>
                                            <span>₹{(Number(editingOrder.total) + getNewItemsTotal()).toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="edit-actions">
                                <button className="btn btn-secondary" onClick={closeEditModal}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={submitNewItems}
                                    disabled={newItems.length === 0 || addingItems}
                                >
                                    {addingItems ? 'Adding...' : (
                                        <>
                                            <Plus size={18} /> Add {newItems.length} Item{newItems.length !== 1 ? 's' : ''}
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
