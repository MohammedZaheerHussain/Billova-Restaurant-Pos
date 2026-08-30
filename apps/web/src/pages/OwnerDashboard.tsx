import { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign,
    Clock, AlertTriangle, Package,
    RefreshCw, ArrowUpRight, ArrowDownRight,
    ShoppingBag, CreditCard, CheckCircle2,
    Percent
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

export default function OwnerDashboard() {
    const [data, setData] = useState<OwnerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [hoveredHour, setHoveredHour] = useState<number | null>(null);

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

    const fmt = (v: number) => {
        return `₹${Number(v || 0).toLocaleString('en-IN')}`;
    };

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

    const hourlySales = data.hourlySales || [];
    const topItems = data.topItems || [];
    const slowItems = data.slowItems || [];
    const lowStockAlerts = data.lowStockAlerts || [];
    const paymentSplit = data.paymentSplit || {};
    const today = data.today || { revenue: 0, orders: 0, avgBill: 0 };
    const yesterday = data.yesterday || { revenue: 0 };
    const peakHour = data.peakHour || { hour: 13, label: '1:00 PM', orders: 0 };
    const profitEstimate = data.profitEstimate || { revenue: 0, estimatedCost: 0, estimatedProfit: 0, margin: 60 };

    const maxHourly = Math.max(...hourlySales.map(h => h.revenue || 0), 1);
    const hourlyFiltered = hourlySales.filter(h => h.hour >= 6 && h.hour <= 23);

    const paymentMethodsList = [
        { label: 'Cash', amount: paymentSplit['CASH'] || 0 },
        { label: 'UPI', amount: paymentSplit['UPI'] || 0 },
        { label: 'Card', amount: paymentSplit['CARD'] || 0 },
        { label: 'Online', amount: paymentSplit['ONLINE'] || 0 },
    ];

    return (
        <div className="od-root">
            {/* ── Page Header (Icebox Style) ── */}
            <header className="od-header">
                <div className="od-header-left">
                    <h1>Business Overview</h1>
                    <div className="od-header-meta">
                        <span className="od-date">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span className="od-live-chip">
                            <span className="od-live-dot" />
                            Live POS Engine
                        </span>
                    </div>
                </div>

                <div className="od-header-right">
                    <button className="od-refresh-btn" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={13} className={loading ? 'od-spin' : ''} />
                        <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
                    </button>
                </div>
            </header>

            {/* ── KPI Command Cards Strip ── */}
            <div className="od-kpi-cards-grid">
                {/* 1. Revenue */}
                <div className="od-kpi-card">
                    <div className="kpi-card-top">
                        <span className="od-kpi-label">Revenue Today</span>
                        <div className="kpi-icon-box orange">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <span className="od-kpi-value">{fmt(today.revenue)}</span>
                    <span className={`od-kpi-change ${(data.revenueChange || 0) >= 0 ? 'up' : 'down'}`}>
                        {(data.revenueChange || 0) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span>{Math.abs(data.revenueChange || 0).toFixed(1)}% vs yesterday</span>
                    </span>
                </div>

                {/* 2. Orders */}
                <div className="od-kpi-card">
                    <div className="kpi-card-top">
                        <span className="od-kpi-label">Orders Today</span>
                        <div className="kpi-icon-box purple">
                            <ShoppingBag size={16} />
                        </div>
                    </div>
                    <span className="od-kpi-value">{today.orders}</span>
                    <span className="od-kpi-sub">Yesterday: {fmt(yesterday.revenue)}</span>
                </div>

                {/* 3. Avg Bill */}
                <div className="od-kpi-card">
                    <div className="kpi-card-top">
                        <span className="od-kpi-label">Avg Bill Value</span>
                        <div className="kpi-icon-box blue">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <span className="od-kpi-value">{fmt(today.avgBill)}</span>
                    <span className="od-kpi-sub">Per completed order</span>
                </div>

                {/* 4. Peak Hour */}
                <div className="od-kpi-card">
                    <div className="kpi-card-top">
                        <span className="od-kpi-label">Peak Hour</span>
                        <div className="kpi-icon-box amber">
                            <Clock size={16} />
                        </div>
                    </div>
                    <span className="od-kpi-value">{peakHour.label}</span>
                    <span className="od-kpi-sub">{peakHour.orders} orders recorded</span>
                </div>

                {/* 5. Profit */}
                <div className="od-kpi-card">
                    <div className="kpi-card-top">
                        <span className="od-kpi-label">Est. Profit</span>
                        <div className="kpi-icon-box green">
                            <Percent size={16} />
                        </div>
                    </div>
                    <span className="od-kpi-value profit">{fmt(profitEstimate.estimatedProfit)}</span>
                    <span className="od-kpi-sub">{profitEstimate.margin}% margin</span>
                </div>
            </div>

            {/* ── Main Content Area ── */}
            <div className="od-content">
                {/* ── Hourly Sales Hero Chart ── */}
                <div className="od-chart-card">
                    <div className="od-chart-header">
                        <div className="od-chart-title-wrap">
                            <Clock size={15} className="chart-icon" />
                            <h3>Hourly Sales Trend</h3>
                        </div>
                        <span className="od-peak-badge">
                            Peak Hour: <strong>{peakHour.label}</strong>
                        </span>
                    </div>

                    <div className="od-chart-bars-track">
                        {hourlyFiltered.map((hour) => {
                            const isPeak = hour.hour === peakHour.hour;
                            const isHovered = hoveredHour === hour.hour;
                            const heightPercent = maxHourly > 0 ? Math.min(100, Math.max(3, (hour.revenue / maxHourly) * 100)) : 3;

                            return (
                                <div
                                    key={hour.hour}
                                    className={`od-bar-column ${isPeak ? 'peak' : ''} ${isHovered ? 'hovered' : ''}`}
                                    onMouseEnter={() => setHoveredHour(hour.hour)}
                                    onMouseLeave={() => setHoveredHour(null)}
                                >
                                    {/* Tooltip */}
                                    {isHovered && (
                                        <div className="od-bar-tooltip">
                                            <span className="tooltip-time">{fmtTime(hour.hour)}</span>
                                            <span className="tooltip-rev">{fmt(hour.revenue)}</span>
                                            <span className="tooltip-orders">{hour.orders} orders</span>
                                        </div>
                                    )}

                                    <div className="od-bar-bg-pillar" />
                                    <div className="od-bar-fill-wrap">
                                        <div
                                            className={`od-bar-fill ${isPeak ? 'peak-fill' : ''}`}
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                    <span className="od-bar-x-label">{fmtTime(hour.hour)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── 3-Column Performance Grid ── */}
                <div className="od-tri-grid">
                    {/* Column 1: Top Selling Items */}
                    <div className="od-panel-card">
                        <div className="od-panel-header">
                            <div className="panel-title-left">
                                <TrendingUp size={15} />
                                <h3>Top Selling</h3>
                            </div>
                            <span className="od-panel-badge">7 days</span>
                        </div>

                        <div className="od-panel-body">
                            {topItems.length > 0 ? (
                                topItems.map((item, i) => (
                                    <div key={i} className="od-ranked-row">
                                        <div className={`od-rank-badge rank-${i + 1}`}>{i + 1}</div>
                                        <span className="od-item-name">{item.name}</span>
                                        <span className="od-item-qty">{item.quantity}×</span>
                                        <span className="od-item-rev">{fmt(item.revenue)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="od-empty-state">
                                    <TrendingUp size={28} />
                                    <span>No product sales recorded yet</span>
                                </div>
                            )}

                            {slowItems.length > 0 && (
                                <div className="od-slow-items-section">
                                    <div className="slow-section-header">
                                        <TrendingDown size={13} />
                                        <span>Slow Moving Items (7+ days)</span>
                                    </div>
                                    {slowItems.map((item, i) => (
                                        <div key={i} className="od-slow-row">
                                            <span className="od-slow-name">{item.name}</span>
                                            <span className="od-slow-days">{item.daysSinceLastSale}d inactive</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Stock Alerts */}
                    <div className="od-panel-card">
                        <div className="od-panel-header">
                            <div className="panel-title-left">
                                <Package size={15} />
                                <h3>Stock Alerts</h3>
                            </div>
                            {(data.lowStockCount || 0) > 0 ? (
                                <span className="od-panel-badge danger">{data.lowStockCount} Low</span>
                            ) : (
                                <span className="od-panel-badge success">Healthy</span>
                            )}
                        </div>

                        <div className="od-panel-body">
                            {lowStockAlerts.length > 0 ? (
                                lowStockAlerts.map((item) => (
                                    <div key={item.id} className="od-stock-alert-row">
                                        <AlertTriangle size={14} className="alert-icon" />
                                        <span className="od-stock-name">{item.name}</span>
                                        <span className="od-stock-qty">{item.quantity} {item.unit} left</span>
                                    </div>
                                ))
                            ) : (
                                <div className="od-empty-state healthy">
                                    <CheckCircle2 size={32} />
                                    <h4>Stock Levels Healthy</h4>
                                    <p>All ingredient thresholds are sufficient for active shifts</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Payment Split & Margin */}
                    <div className="od-panel-card">
                        <div className="od-panel-header">
                            <div className="panel-title-left">
                                <CreditCard size={15} />
                                <h3>Payment Split</h3>
                            </div>
                            <span className="od-panel-badge">Today</span>
                        </div>

                        <div className="od-panel-body">
                            <div className="payment-split-list">
                                {paymentMethodsList.map((pm) => (
                                    <div key={pm.label} className="od-payment-pill-row">
                                        <span className="payment-label">{pm.label}</span>
                                        <span className="payment-amount">{fmt(pm.amount)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Margin Summary Box */}
                            <div className="od-margin-summary-box">
                                <div className="margin-summary-item">
                                    <span className="margin-label">Revenue</span>
                                    <span className="margin-val">{fmt(profitEstimate.revenue)}</span>
                                </div>
                                <div className="margin-summary-item">
                                    <span className="margin-label">Est. Cost</span>
                                    <span className="margin-val">{fmt(profitEstimate.estimatedCost)}</span>
                                </div>
                                <div className="margin-summary-item">
                                    <span className="margin-label">Net Profit</span>
                                    <span className="margin-val profit">{fmt(profitEstimate.estimatedProfit)}</span>
                                </div>
                                <div className="margin-summary-item">
                                    <span className="margin-label">Margin</span>
                                    <span className="margin-val highlight">{profitEstimate.margin}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Sync Note */}
                <div className="od-footer-note">
                    <span>Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 5 minutes</span>
                </div>
            </div>
        </div>
    );
}
