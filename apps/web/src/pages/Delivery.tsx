// Delivery App - Driver Interface
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Truck, MapPin, Phone, Package, Clock, CheckCircle,
    Navigation, User, RefreshCw
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../api';
import './Delivery.css';

interface DeliveryOrder {
    id: string;
    status: string;
    pickedUpAt?: string;
    deliveredAt?: string;
    notes?: string;
    order: {
        id: string;
        orderNumber: number;
        customerName: string;
        customerPhone: string;
        notes: string;
        total: number;
        createdAt: string;
    };
}

export default function DeliveryPage() {
    const [orders, setOrders] = useState<DeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

    useEffect(() => {
        fetchOrders();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            if (!loading) setRefreshing(true);
            const res = await api.get('/delivery/orders');
            setOrders(res.data);
        } catch (error) {
            toast.error('Failed to fetch orders');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.put(`/delivery/orders/${id}/status`, { status });
            toast.success(status === 'PICKED_UP' ? 'Picked up!' : 'Delivered!');
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const openMaps = (address: string) => {
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    };

    const callCustomer = (phone: string) => {
        window.location.href = `tel:${phone}`;
    };

    const activeOrders = orders.filter(o => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status));
    const completedOrders = orders.filter(o => ['DELIVERED', 'FAILED'].includes(o.status));

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'ASSIGNED': return <Package size={18} />;
            case 'PICKED_UP': return <Truck size={18} />;
            case 'IN_TRANSIT': return <Navigation size={18} />;
            case 'DELIVERED': return <CheckCircle size={18} />;
            default: return <Clock size={18} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ASSIGNED': return '#f59e0b';
            case 'PICKED_UP': return '#3b82f6';
            case 'IN_TRANSIT': return '#8b5cf6';
            case 'DELIVERED': return '#10b981';
            case 'FAILED': return '#ef4444';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="delivery-page loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="delivery-page">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="del-header">
                <div>
                    <h1><Truck size={24} /> Deliveries</h1>
                    <p>{activeOrders.length} active orders</p>
                </div>
                <button
                    className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
                    onClick={fetchOrders}
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            {/* Tabs */}
            <div className="del-tabs">
                <button
                    className={activeTab === 'active' ? 'active' : ''}
                    onClick={() => setActiveTab('active')}
                >
                    Active ({activeOrders.length})
                </button>
                <button
                    className={activeTab === 'completed' ? 'active' : ''}
                    onClick={() => setActiveTab('completed')}
                >
                    Completed ({completedOrders.length})
                </button>
            </div>

            {/* Orders List */}
            <div className="del-orders">
                {(activeTab === 'active' ? activeOrders : completedOrders).map((delivery) => (
                    <motion.div
                        key={delivery.id}
                        className="del-card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="del-card-header">
                            <span className="order-num">#{delivery.order.orderNumber}</span>
                            <span
                                className="del-status"
                                style={{ background: getStatusColor(delivery.status) }}
                            >
                                {getStatusIcon(delivery.status)}
                                {delivery.status.replace('_', ' ')}
                            </span>
                        </div>

                        <div className="del-customer">
                            <User size={16} />
                            <span>{delivery.order.customerName}</span>
                        </div>

                        {delivery.order.notes && (
                            <div className="del-address">
                                <MapPin size={16} />
                                <span>{delivery.order.notes.replace('Delivery: ', '')}</span>
                            </div>
                        )}

                        <div className="del-amount">
                            <span>₹{Number(delivery.order.total).toFixed(0)}</span>
                            <span className="del-time">
                                <Clock size={14} />
                                {new Date(delivery.order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="del-actions">
                            <button
                                className="action-btn maps"
                                onClick={() => openMaps(delivery.order.notes || '')}
                            >
                                <Navigation size={18} />
                                Maps
                            </button>
                            <button
                                className="action-btn call"
                                onClick={() => callCustomer(delivery.order.customerPhone)}
                            >
                                <Phone size={18} />
                                Call
                            </button>
                        </div>

                        {/* Status Update Buttons */}
                        {delivery.status === 'ASSIGNED' && (
                            <button
                                className="status-btn pickup"
                                onClick={() => updateStatus(delivery.id, 'PICKED_UP')}
                            >
                                <Package size={18} />
                                Mark Picked Up
                            </button>
                        )}
                        {(delivery.status === 'PICKED_UP' || delivery.status === 'IN_TRANSIT') && (
                            <button
                                className="status-btn deliver"
                                onClick={() => updateStatus(delivery.id, 'DELIVERED')}
                            >
                                <CheckCircle size={18} />
                                Mark Delivered
                            </button>
                        )}
                    </motion.div>
                ))}

                {(activeTab === 'active' ? activeOrders : completedOrders).length === 0 && (
                    <div className="empty-state">
                        {activeTab === 'active' ? (
                            <>
                                <Truck size={48} />
                                <p>No active deliveries</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={48} />
                                <p>No completed deliveries yet</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
