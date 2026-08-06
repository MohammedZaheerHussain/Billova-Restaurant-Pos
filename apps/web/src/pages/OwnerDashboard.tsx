// Owner Dashboard — SaaS Business Intelligence
// Layout: KPI command strip → hourly chart → 3-column data
// Philosophy: answer the owner's 3 questions in 3 seconds:
//   1. How much money did I make today?
//   2. What's selling / not selling?
//   3. Do I have any urgent issues?
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, DollarSign,
    Clock, AlertTriangle, Package,
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
            setError(err.response?.data?.error || 'Failed to load dashboard');
            toast.error('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fmt = (v: number) => new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(v);

    const fmtTime = (h: number) => `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;

    if (loading && !data) {
        return (
            <div className="od-loading">
                <div className="od-spinner" />
                <span>Loading business overview…</span>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="od-error">
                <AlertTriangle size={40} style={{ color: 'var(--danger)' }} />
                <p>{error}</p>
                <button onClick={fetchData}>Try Again</button>
            </div>
        );
    }

    if (!data) return null;

    const maxHourly = Math.max(...data.hourlySales.map(h => h.revenue), 1);
    const hourlyFiltered = data.hourlySales.filter(h => h.hour >= 6 && h.hour <= 23);

    return (
        <div className="od-root">
            {/* ── Page Header ── */}
            <header className="od-header">
                <div className="od-header-left">
                    <h1>Business Overview</h1>
                    <span className="od-date">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
                <button className="od-refresh-btn" onClick={fetchData} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'od-spin' : ''} />
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </header>

            {/* ── KPI Command Strip ── */}
            <motion.div className="od-kpi-strip" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Revenue */}
                <div className="od-kpi">
                    <span className="od-kpi-label">Revenue Today</span>
                    <span className="od-kpi-value">{fmt(data.today.revenue)}</span>
                    <span className={`od-kpi-change ${data.revenueChange >= 0 ? 'up' : 'down'}`}>
                        {data.revenueChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(data.revenueChange).toFixed(1)}% vs yesterday
                    </span>
                </div>
                {/* Orders */}
                <div className="od-kpi">
                    <span className="od-kpi-label">Orders Today</span>
                    <span className="od-kpi-value">{data.today.orders}</span>
                    <span className="od-kpi-sub">Yesterday: {fmt(data.yesterday.revenue)}</span>
                </div>
                {/* Avg Bill */}
                <div className="od-kpi">
                    <span className="od-kpi-label">Avg Bill Value</span>
                    <span className="od-kpi-value">{fmt(data.today.avgBill)}</span>
                    <span className="od-kpi-sub">Per order</span>
                </div>
                {/* Peak Hour */}
                <div className="od-kpi">
                    <span className="od-kpi-label">Peak Hour</span>
                    <span className="od-kpi-value">{data.peakHour.label}</span>
                    <span className="od-kpi-sub">{data.peakHour.orders} orders</span>
                </div>
                {/* Profit */}
                <div className="od-kpi">
                    <span className="od-kpi-label">Est. Profit</span>
                    <span className="od-kpi-value" style={{ color: 'var(--success)' }}>
                        {fmt(data.profitEstimate.estimatedProfit)}
                    </span>
                    <span className="od-kpi-sub">{data.profitEstimate.margin}% margin</span>
                </div>
            </motion.div>

            {/* ── Main Content ── */}
            <div className="od-content">
                {/* Hourly Chart */}
                <motion.div className="od-chart-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="od-chart-header">
                        <Clock size={14} style={{ color: 'var(--primary)' }} />
                        <h3>Hourly Sales</h3>
                        <span className="od-chart-sub">
                            Peak: <strong style={{ color: 'var(--primary)' }}>{data.peakHour.label}</strong>
                        </span>
                    </div>
                    <div className="od-chart-bars">
                        {hourlyFiltered.map((hour) => (
                            <div
                                key={hour.hour}
                                className={`od-bar-wrap ${hour.hour === data.peakHour.hour ? 'peak' : ''}`}
                                title={`${fmtTime(hour.hour)}: ${fmt(hour.revenue)} (${hour.orders} orders)`}
                            >
                                <div
                                    className="od-bar"
                                    style={{ height: `${Math.max((hour.revenue / maxHourly) * 100, 2)}%` }}
                                />
                                <span className="od-bar-label">{fmtTime(hour.hour)}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* 3-Column Data Panels */}
                <div className="od-columns">
                    {/* Column 1: Top Selling Items */}
                    <motion.div className="od-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <div className="od-panel-header">
                            <TrendingUp size={14} />
                            <h3>Top Selling</h3>
                            <span className="od-panel-badge neutral">7 days</span>
                        </div>
                        <div className="od-panel-body">
                            {data.topItems.length > 0 ? (
                                data.topItems.map((item, i) => (
                                    <div key={i} className="od-item-row">
                                        <span className={`od-rank ${i === 0 ? 'top' : ''}`}>#{i + 1}</span>
                                        <span className="od-item-name">{item.name}</span>
                                        <span className="od-item-qty">{item.quantity}×</span>
                                        <span className="od-item-rev">{fmt(item.revenue)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="od-empty">No sales data yet</div>
                            )}

                            {/* Divider + Slow Items */}
                            {data.slowItems.length > 0 && (
                                <>
                                    <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                                    <div className="od-panel-header" style={{ border: 'none', padding: '4px 16px 4px' }}>
                                        <TrendingDown size={13} style={{ color: 'var(--warning)' }} />
                                        <h3 style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dead Stock</h3>
                                        <span className="od-panel-badge warn">7+ days</span>
                                    </div>
                                    {data.slowItems.map((item, i) => (
                                        <div key={i} className="od-slow-row">
                                            <span className="od-slow-name">{item.name}</span>
                                            <span className="od-slow-days">{item.daysSinceLastSale}d</span>
                                        </div>
                                    ))}
                                </>
                            )}
                            {data.slowItems.length === 0 && data.topItems.length > 0 && (
                                <div className="od-empty success">All items selling ✓</div>
                            )}
                        </div>
                    </motion.div>

                    {/* Column 2: Stock Alerts */}
                    <motion.div
                        className={`od-panel ${data.lowStockCount > 0 ? 'alert' : ''}`}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    >
                        <div className="od-panel-header">
                            <Package size={14} />
                            <h3>Stock Alerts</h3>
                            {data.lowStockCount > 0 && (
                                <span className="od-panel-badge danger">{data.lowStockCount}</span>
                            )}
                        </div>
                        <div className="od-panel-body">
                            {data.lowStockAlerts.length > 0 ? (
                                data.lowStockAlerts.map((item) => {
                                    const cls = item.status === 'OUT_OF_STOCK' ? 'critical' : item.status === 'CRITICAL' ? 'critical' : '';
                                    return (
                                        <div key={item.id} className={`od-stock-row ${cls}`}>
                                            <AlertTriangle size={13} />
                                            <span className="od-stock-name">{item.name}</span>
                                            <span className="od-stock-qty">{item.quantity}{item.unit}</span>
                                            <span className={`od-stock-status ${item.status.toLowerCase()}`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="od-empty success">Stock levels healthy ✓</div>
                            )}
                        </div>
                    </motion.div>

                    {/* Column 3: Payment Split + Profit */}
                    <motion.div className="od-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <div className="od-panel-header">
                            <DollarSign size={14} />
                            <h3>Payment Split</h3>
                        </div>
                        <div className="od-panel-body">
                            {Object.keys(data.paymentSplit).length > 0 ? (
                                Object.entries(data.paymentSplit).map(([mode, amount]) => (
                                    <div key={mode} className="od-payment-row">
                                        <div className="od-payment-top">
                                            <span className="od-payment-mode">{mode}</span>
                                            <span className="od-payment-amount">{fmt(amount)}</span>
                                        </div>
                                        <div className="od-payment-bar">
                                            <div
                                                className="od-payment-fill"
                                                style={{ width: `${(amount / data.today.revenue) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="od-empty">No payments today</div>
                            )}

                            {/* Profit micro-strip */}
                            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                            <div className="od-profit-strip">
                                <div className="od-profit-item">
                                    <span className="od-profit-label">Revenue</span>
                                    <span className="od-profit-value positive">{fmt(data.profitEstimate.revenue)}</span>
                                </div>
                                <div className="od-profit-item">
                                    <span className="od-profit-label">Est. Cost</span>
                                    <span className="od-profit-value negative">{fmt(data.profitEstimate.estimatedCost)}</span>
                                </div>
                                <div className="od-profit-item">
                                    <span className="od-profit-label">Profit</span>
                                    <span className="od-profit-value accent">{fmt(data.profitEstimate.estimatedProfit)}</span>
                                </div>
                                <div className="od-profit-item">
                                    <span className="od-profit-label">Margin</span>
                                    <span className="od-profit-value">{data.profitEstimate.margin}%</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Footer ── */}
            <footer className="od-footer">
                Last updated: {lastRefresh.toLocaleTimeString('en-IN')} · Auto-refreshes every 5 minutes
            </footer>
        </div>
    );
}

export default OwnerDashboard;
