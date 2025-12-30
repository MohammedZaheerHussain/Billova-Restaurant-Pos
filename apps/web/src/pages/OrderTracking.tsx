// Order Tracking Page - Customer view of order status
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Clock, ChefHat, Bike, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import './OrderTracking.css';

interface OrderStatus {
    orderNumber: number;
    status: string;
    orderType: string;
    customerName: string;
    total: number;
    createdAt: string;
    items: { name: string; quantity: number }[];
}

const STATUS_STEPS = [
    { key: 'PENDING', label: 'Order Received', icon: Package },
    { key: 'CONFIRMED', label: 'Confirmed', icon: Clock },
    { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
    { key: 'READY', label: 'Ready', icon: Bike },
    { key: 'COMPLETED', label: 'Completed', icon: CheckCircle },
];

export default function OrderTrackingPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [order, setOrder] = useState<OrderStatus | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        fetchOrderStatus();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchOrderStatus, 30000);
        return () => clearInterval(interval);
    }, [orderId]);

    const fetchOrderStatus = async () => {
        try {
            if (!loading) setRefreshing(true);
            const response = await fetch(`${API_URL}/api/public/order-status/${orderId}`);
            if (!response.ok) throw new Error('Order not found');
            const data = await response.json();
            setOrder(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getCurrentStep = () => {
        if (!order) return -1;
        if (order.status === 'CANCELLED') return -2;
        return STATUS_STEPS.findIndex(s => s.key === order.status);
    };

    const currentStep = getCurrentStep();

    if (loading) {
        return (
            <div className="order-tracking-page loading">
                <div className="spinner" />
                <p>Loading order status...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="order-tracking-page error">
                <XCircle size={48} />
                <h2>Order Not Found</h2>
                <p>Please check your order ID and try again.</p>
            </div>
        );
    }

    if (order.status === 'CANCELLED') {
        return (
            <div className="order-tracking-page cancelled">
                <XCircle size={64} />
                <h2>Order Cancelled</h2>
                <p>Your order #{order.orderNumber} has been cancelled.</p>
                <p className="sub-text">If you have questions, please call the restaurant.</p>
            </div>
        );
    }

    return (
        <div className="order-tracking-page">
            {/* Header */}
            <header className="ot-header">
                <div>
                    <h1>Order #{order.orderNumber}</h1>
                    <p className="ot-type">{order.orderType} • {order.customerName}</p>
                </div>
                <button
                    className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
                    onClick={fetchOrderStatus}
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            {/* Status Steps */}
            <div className="ot-progress">
                {STATUS_STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index <= currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <motion.div
                            key={step.key}
                            className={`ot-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div className="step-icon">
                                <Icon size={24} />
                            </div>
                            <span className="step-label">{step.label}</span>
                            {index < STATUS_STEPS.length - 1 && (
                                <div className={`step-line ${isActive ? 'filled' : ''}`} />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Current Status Message */}
            <div className="ot-status-card">
                {currentStep === 0 && (
                    <p>Your order has been received! We'll start preparing it soon.</p>
                )}
                {currentStep === 1 && (
                    <p>Your order is confirmed! Our kitchen will start cooking shortly.</p>
                )}
                {currentStep === 2 && (
                    <p>🍳 Your food is being prepared! Almost there...</p>
                )}
                {currentStep === 3 && (
                    <p>✅ Your order is ready! {order.orderType === 'DELIVERY' ? 'Out for delivery.' : 'Please pick it up.'}</p>
                )}
                {currentStep === 4 && (
                    <p>🎉 Order completed! Thank you for ordering with us.</p>
                )}
            </div>

            {/* Order Items */}
            <div className="ot-items">
                <h3>Order Items</h3>
                {order.items.map((item, i) => (
                    <div key={i} className="ot-item">
                        <span>{item.quantity}x</span>
                        <span>{item.name}</span>
                    </div>
                ))}
                <div className="ot-total">
                    <span>Total</span>
                    <span>₹{order.total}</span>
                </div>
            </div>

            {/* Footer */}
            <footer className="ot-footer">
                <p>Auto-refreshes every 30 seconds</p>
                <p className="powered">Powered by <strong>Billova POS</strong></p>
            </footer>
        </div>
    );
}
