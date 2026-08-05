import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, AlertCircle, AlertTriangle, TrendingDown } from 'lucide-react';

export interface StockAlert {
    id: string;
    alertType: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    inventoryItem: { id: string; name: string; quantity: number; unit: string };
}

interface StockAlertsSidebarProps {
    showAlerts: boolean;
    alerts: StockAlert[];
    onClose: () => void;
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
}

export function StockAlertsSidebar({
    showAlerts,
    alerts,
    onClose,
    onMarkRead,
    onMarkAllRead,
}: StockAlertsSidebarProps) {
    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'OUT_OF_STOCK': return <AlertCircle size={16} />;
            case 'CRITICAL': return <AlertTriangle size={16} />;
            case 'LOW_STOCK': return <TrendingDown size={16} />;
            default: return <Bell size={16} />;
        }
    };

    return (
        <AnimatePresence>
            {showAlerts && (
                <motion.div
                    className="alerts-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="alerts-sidebar glass-card"
                        initial={{ x: 300 }}
                        animate={{ x: 0 }}
                        exit={{ x: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="alerts-header">
                            <h3>
                                <Bell size={20} /> Stock Alerts
                            </h3>
                            <div className="alerts-actions">
                                {alerts.length > 0 && (
                                    <button
                                        className="btn btn-sm btn-glass"
                                        onClick={onMarkAllRead}
                                    >
                                        <Check size={14} /> Mark All Read
                                    </button>
                                )}
                                <button className="close-btn" onClick={onClose}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="alerts-list">
                            {alerts.length === 0 ? (
                                <div className="no-alerts">
                                    <Check size={32} />
                                    <p>No unread alerts</p>
                                </div>
                            ) : (
                                alerts.map((alert) => (
                                    <motion.div
                                        key={alert.id}
                                        className={`alert-item ${alert.alertType.toLowerCase()}`}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        <div className="alert-icon">
                                            {getAlertIcon(alert.alertType)}
                                        </div>
                                        <div className="alert-content">
                                            <p className="alert-message">{alert.message}</p>
                                            <span className="alert-time">
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <button
                                            className="dismiss-btn"
                                            onClick={() => onMarkRead(alert.id)}
                                        >
                                            <X size={16} />
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
