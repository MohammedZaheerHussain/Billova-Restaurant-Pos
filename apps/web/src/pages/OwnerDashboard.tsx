// Owner Dashboard - Premium Business Intelligence UI
// Single API call → full dashboard metrics
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag,
    Clock, AlertTriangle, Package, Zap, Award, Users,
    RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../api';
import './OwnerDashboard.css';

interface OwnerSummary {
    today: { revenue: number; orders: number; avgBill: number };
    yesterday: { revenue: number };
    revenueChange: number;
    topItems: { name: string; quantity: number; revenue: number }[];
    slowItems: { name: string; lastSold: string | null; daysSinceLastSale: number }[];
    lowStockAlerts: { id: string; name: string; quantity: number; unit: string; status: string }[];
    lowStockCount: number;
    paymentSplit: Record<string, number>;
    hourlySales: { hour: number; orders: number; revenue: number }[];
    peakHour: { hour: number; label: string; orders: number };
    profitEstimate: { revenue: number; estimatedCost: number; estimatedProfit: number; margin: number };
    generatedAt: string;
}

export function OwnerDashboard() {
    const [data, setData] = useState<OwnerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await dashboardAPI.ownerSummary();
            setData(response.data);
            setLastRefresh(new Date());
            setError(null);
        } catch (err: any) {
            console.error('Dashboard error:', err);
            setError(err.response?.data?.error || 'Failed to load dashboard');
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatTime = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h = hour % 12 || 12;
        return `${h}${ampm}`;
    };

    if (loading && !data) {
        return (
            <div className="owner-dashboard loading-state">
                <div className="loading-spinner">
                    <RefreshCw className="spin" size={48} />
                    <p>Loading your business overview...</p>
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="owner-dashboard error-state">
                <AlertTriangle size={48} />
                <p>{error}</p>
                <button onClick={fetchData}>Try Again</button>
            </div>
        );
    }

    if (!data) return null;

    const maxHourlyRevenue = Math.max(...data.hourlySales.map(h => h.revenue), 1);

    return (
        <div className="owner-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Business Overview</h1>
                    <p className="subtitle">
                        {new Date().toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                </div>
                <button
                    className="refresh-btn"
                    onClick={fetchData}
                    disabled={loading}
                >
                    <RefreshCw className={loading ? 'spin' : ''} size={20} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            {/* Main Metrics Grid */}
            <div className="metrics-grid">
                {/* Today's Revenue - Hero Card */}
                <motion.div
                    className="metric-card hero-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="card-icon revenue-icon">
                        <DollarSign size={28} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Today's Revenue</span>
                        <span className="card-value large">{formatCurrency(data.today.revenue)}</span>
                        <div className={`change-badge ${data.revenueChange >= 0 ? 'positive' : 'negative'}`}>
                            {data.revenueChange >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            <span>{Math.abs(data.revenueChange).toFixed(1)}% vs yesterday</span>
                        </div>
                    </div>
                </motion.div>

                {/* Orders Count */}
                <motion.div
                    className="metric-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="card-icon orders-icon">
                        <ShoppingBag size={24} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Orders Today</span>
                        <span className="card-value">{data.today.orders}</span>
                    </div>
                </motion.div>

                {/* Avg Bill Value */}
                <motion.div
                    className="metric-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="card-icon avg-icon">
                        <Users size={24} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Avg Bill Value</span>
                        <span className="card-value">{formatCurrency(data.today.avgBill)}</span>
                    </div>
                </motion.div>

                {/* Peak Hour */}
                <motion.div
                    className="metric-card highlight"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                >
                    <div className="card-icon peak-icon">
                        <Zap size={24} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Peak Hour</span>
                        <span className="card-value">{data.peakHour.label}</span>
                        <span className="card-sub">{data.peakHour.orders} orders</span>
                    </div>
                </motion.div>
            </div>

            {/* Profit Estimate Card */}
            <motion.div
                className="profit-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="profit-header">
                    <Award size={24} />
                    <h3>Today's Profit Estimate</h3>
                </div>
                <div className="profit-grid">
                    <div className="profit-item">
                        <span className="label">Revenue</span>
                        <span className="value positive">{formatCurrency(data.profitEstimate.revenue)}</span>
                    </div>
                    <div className="profit-item">
                        <span className="label">Est. Cost (~40%)</span>
                        <span className="value negative">{formatCurrency(data.profitEstimate.estimatedCost)}</span>
                    </div>
                    <div className="profit-item highlight">
                        <span className="label">Est. Profit</span>
                        <span className="value profit">{formatCurrency(data.profitEstimate.estimatedProfit)}</span>
                    </div>
                    <div className="profit-item">
                        <span className="label">Margin</span>
                        <span className="value">{data.profitEstimate.margin}%</span>
                    </div>
                </div>
            </motion.div>

            {/* Two Column Layout */}
            <div className="two-column">
                {/* Left Column - Top Items & Slow Items */}
                <div className="column">
                    {/* Top Selling Items */}
                    <motion.div
                        className="panel"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 }}
                    >
                        <div className="panel-header">
                            <TrendingUp size={20} />
                            <h3>Top Selling Items</h3>
                            <span className="badge">Last 7 days</span>
                        </div>
                        <div className="item-list">
                            {data.topItems.length > 0 ? (
                                data.topItems.map((item, index) => (
                                    <div key={index} className="item-row">
                                        <span className="rank">#{index + 1}</span>
                                        <span className="name">{item.name}</span>
                                        <span className="qty">{item.quantity} sold</span>
                                        <span className="revenue">{formatCurrency(item.revenue)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">No sales data yet</div>
                            )}
                        </div>
                    </motion.div>

                    {/* Slow Moving Items */}
                    <motion.div
                        className="panel warning"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="panel-header">
                            <TrendingDown size={20} />
                            <h3>Dead Stock Items</h3>
                            <span className="badge warn">Not sold 7+ days</span>
                        </div>
                        <div className="item-list">
                            {data.slowItems.length > 0 ? (
                                data.slowItems.map((item, index) => (
                                    <div key={index} className="item-row warn">
                                        <span className="name">{item.name}</span>
                                        <span className="days">{item.daysSinceLastSale}+ days</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state success">All items selling well! ✓</div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Right Column - Stock Alerts & Payment Split */}
                <div className="column">
                    {/* Low Stock Alerts */}
                    <motion.div
                        className={`panel ${data.lowStockCount > 0 ? 'alert' : ''}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.35 }}
                    >
                        <div className="panel-header">
                            <Package size={20} />
                            <h3>Low Stock Alerts</h3>
                            {data.lowStockCount > 0 && (
                                <span className="badge danger">{data.lowStockCount}</span>
                            )}
                        </div>
                        <div className="item-list">
                            {data.lowStockAlerts.length > 0 ? (
                                data.lowStockAlerts.map((item) => (
                                    <div key={item.id} className={`item-row ${item.status === 'OUT_OF_STOCK' ? 'critical' : item.status === 'CRITICAL' ? 'warn' : ''}`}>
                                        <AlertTriangle size={16} />
                                        <span className="name">{item.name}</span>
                                        <span className="qty">{item.quantity} {item.unit}</span>
                                        <span className="status">{item.status.replace('_', ' ')}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state success">Stock levels healthy! ✓</div>
                            )}
                        </div>
                    </motion.div>

                    {/* Payment Mode Split */}
                    <motion.div
                        className="panel"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="panel-header">
                            <DollarSign size={20} />
                            <h3>Payment Split</h3>
                        </div>
                        <div className="payment-split">
                            {Object.keys(data.paymentSplit).length > 0 ? (
                                Object.entries(data.paymentSplit).map(([mode, amount]) => (
                                    <div key={mode} className="payment-item">
                                        <span className="mode">{mode}</span>
                                        <span className="amount">{formatCurrency(amount)}</span>
                                        <div className="bar">
                                            <div
                                                className="fill"
                                                style={{
                                                    width: `${(amount / data.today.revenue) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">No payments today</div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Hourly Sales Chart */}
            <motion.div
                className="hourly-chart"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
            >
                <div className="chart-header">
                    <Clock size={20} />
                    <h3>Hourly Sales Today</h3>
                </div>
                <div className="chart-container">
                    <div className="bars">
                        {data.hourlySales.filter(h => h.hour >= 6 && h.hour <= 23).map((hour) => (
                            <div
                                key={hour.hour}
                                className={`bar-wrapper ${hour.hour === data.peakHour.hour ? 'peak' : ''}`}
                            >
                                <div
                                    className="bar"
                                    style={{
                                        height: `${Math.max((hour.revenue / maxHourlyRevenue) * 100, 2)}%`
                                    }}
                                    title={`${formatTime(hour.hour)}: ${formatCurrency(hour.revenue)} (${hour.orders} orders)`}
                                />
                                <span className="hour-label">{formatTime(hour.hour)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Footer */}
            <footer className="dashboard-footer">
                <p>Last updated: {lastRefresh.toLocaleTimeString('en-IN')}</p>
            </footer>
        </div>
    );
}

export default OwnerDashboard;
