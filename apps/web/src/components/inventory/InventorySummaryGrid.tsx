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
                className="summary-card total"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                <div className="summary-icon total">
                    <Package size={20} />
                </div>
                <div className="summary-content">
                    <span className="summary-value">{summary.totalItems}</span>
                    <span className="summary-label">Total Items</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card sufficient"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.04 }}
            >
                <div className="summary-icon sufficient">
                    <CheckCircle size={20} />
                </div>
                <div className="summary-content">
                    <span className="summary-value">{summary.sufficient}</span>
                    <span className="summary-label">Sufficient</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card low"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.08 }}
            >
                <div className="summary-icon low">
                    <TrendingDown size={20} />
                </div>
                <div className="summary-content">
                    <span className="summary-value">{summary.lowStock}</span>
                    <span className="summary-label">Low Stock</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card critical"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.12 }}
            >
                <div className="summary-icon critical">
                    <AlertTriangle size={20} />
                </div>
                <div className="summary-content">
                    <span className="summary-value">{summary.critical}</span>
                    <span className="summary-label">Critical</span>
                </div>
            </motion.div>

            <motion.div
                className="summary-card out"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.16 }}
            >
                <div className="summary-icon out">
                    <AlertCircle size={20} />
                </div>
                <div className="summary-content">
                    <span className="summary-value">{summary.outOfStock}</span>
                    <span className="summary-label">Out of Stock</span>
                </div>
            </motion.div>
        </div>
    );
}
