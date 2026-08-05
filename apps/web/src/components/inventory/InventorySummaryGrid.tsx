import { motion } from 'framer-motion';
import { Package, CheckCircle, TrendingDown, AlertTriangle, AlertCircle } from 'lucide-react';

export interface DashboardSummary {
    totalItems: number;
    outOfStock: number;
    critical: number;
    lowStock: number;
    sufficient: number;
    unreadAlerts: number;
    pendingApprovals: number;
}

interface InventorySummaryGridProps {
    summary: DashboardSummary;
}

export function InventorySummaryGrid({ summary }: InventorySummaryGridProps) {
    return (
        <div className="summary-grid">
            <motion.div
                className="summary-card glass-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className="summary-icon total">
                    <Package size={24} />
                </div>
                <div className="summary-content">
                    <motion.span
                        className="summary-value"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                    >
                        {summary.totalItems}
                    </motion.span>
                    <span className="summary-label">Total Items</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card glass-card sufficient"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <div className="summary-icon sufficient">
                    <CheckCircle size={24} />
                </div>
                <div className="summary-content">
                    <motion.span
                        className="summary-value"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.25 }}
                    >
                        {summary.sufficient}
                    </motion.span>
                    <span className="summary-label">Sufficient</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card glass-card low"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="summary-icon low">
                    <TrendingDown size={24} />
                </div>
                <div className="summary-content">
                    <motion.span
                        className="summary-value"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.3 }}
                    >
                        {summary.lowStock}
                    </motion.span>
                    <span className="summary-label">Low Stock</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card glass-card critical"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <div className="summary-icon critical">
                    <AlertTriangle size={24} />
                </div>
                <div className="summary-content">
                    <motion.span
                        className="summary-value"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.35 }}
                    >
                        {summary.critical}
                    </motion.span>
                    <span className="summary-label">Critical</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card glass-card out"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="summary-icon out">
                    <AlertCircle size={24} />
                </div>
                <div className="summary-content">
                    <motion.span
                        className="summary-value"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.4 }}
                    >
                        {summary.outOfStock}
                    </motion.span>
                    <span className="summary-label">Out of Stock</span>
                </div>
            </motion.div>
        </div>
    );
}
