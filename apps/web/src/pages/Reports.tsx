import { useState, useEffect, useMemo } from 'react';
import { Award, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI, inventoryAPI } from '../api';
import { useAuthStore } from '../store';
import './Reports.css';
import { ReportsSkeleton } from '../components/Skeleton';

type ReportTab = 'sales' | 'shifts' | 'inventory';

interface Day14Item {
    date: string;
    label: string;
    sales: number;
    orders: number;
}

interface Week4Item {
    label: string;
    sales: number;
    orders: number;
}

interface MonthItem {
    label: string;
    sales: number;
    orders: number;
}

export default function ReportsPage() {
    const user = useAuthStore((state) => state.user);
    const [activeTab, setActiveTab] = useState<ReportTab>('sales');
    const [loading, setLoading] = useState(true);

    // Data States
    const [daily14, setDaily14] = useState<Day14Item[]>([]);
    const [weekly4, setWeekly4] = useState<Week4Item[]>([]);
    const [monthlyData, setMonthlyData] = useState<MonthItem[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [paymentBreakdown, setPaymentBreakdown] = useState<Record<string, number>>({});
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [hovered14Idx, setHovered14Idx] = useState<number | null>(null);
    const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
    const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

    // Current Time
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const day = now.getDate();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[now.getMonth()];
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12 || 12;
            const hoursFormatted = String(hours).padStart(2, '0');
            setCurrentTime(`${day} ${month} · ${hoursFormatted}:${minutes} ${ampm}`);
        };
        updateTime();
        const timer = setInterval(updateTime, 10000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchAllReports();
    }, []);

    const fetchAllReports = async () => {
        try {
            setLoading(true);
            const [daily14Res, weekly4Res, monthlyRes, itemsRes, dailyRes, invRes] = await Promise.all([
                reportsAPI.daily14Days(),
                reportsAPI.weekly4Weeks(),
                reportsAPI.monthlySummary(),
                reportsAPI.itemSales(),
                reportsAPI.dailySales(),
                inventoryAPI.getAll().catch(() => ({ data: [] })),
            ]);

            setDaily14(daily14Res.data || []);
            setWeekly4(weekly4Res.data || []);
            setMonthlyData(monthlyRes.data?.months || []);
            setTopProducts(itemsRes.data?.items || []);
            setPaymentBreakdown(dailyRes.data?.paymentBreakdown || {});
            setInventoryItems(invRes.data || []);
        } catch (error) {
            toast.error('Failed to load reports data');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return `₹${Number(value || 0).toLocaleString('en-IN')}`;
    };

    // Calculate dynamic Y-axis steps for 14-day chart
    const max14Sales = useMemo(() => {
        const max = Math.max(...daily14.map(d => d.sales), 0);
        return max > 0 ? max : 1200;
    }, [daily14]);

    const yAxis14Steps = useMemo(() => {
        const ceilMax = Math.ceil(max14Sales / 300) * 300 || 1200;
        return [ceilMax, Math.round(ceilMax * 0.75), Math.round(ceilMax * 0.5), Math.round(ceilMax * 0.25), 0];
    }, [max14Sales]);

    // Calculate dynamic Y-axis steps for Weekly chart
    const maxWeekSales = useMemo(() => {
        const max = Math.max(...weekly4.map(w => w.sales), 0);
        return max > 0 ? max : 2200;
    }, [weekly4]);

    const yAxisWeekSteps = useMemo(() => {
        const ceilMax = Math.ceil(maxWeekSales / 550) * 550 || 2200;
        return [ceilMax, Math.round(ceilMax * 0.75), Math.round(ceilMax * 0.5), Math.round(ceilMax * 0.25), 0];
    }, [maxWeekSales]);

    // Calculate dynamic Y-axis steps for Monthly chart
    const maxMonthSales = useMemo(() => {
        const max = Math.max(...monthlyData.map(m => m.sales), 0);
        return max > 0 ? max : 2200;
    }, [monthlyData]);

    const yAxisMonthSteps = useMemo(() => {
        const ceilMax = Math.ceil(maxMonthSales / 550) * 550 || 2200;
        return [ceilMax, Math.round(ceilMax * 0.75), Math.round(ceilMax * 0.5), Math.round(ceilMax * 0.25), 0];
    }, [maxMonthSales]);

    // Payment methods normalized
    const normalizedPayments = useMemo(() => {
        const methods = [
            { key: 'CASH', label: 'Cash', amount: paymentBreakdown['CASH'] || 0 },
            { key: 'UPI', label: 'UPI', amount: paymentBreakdown['UPI'] || 0 },
            { key: 'CARD', label: 'Card', amount: paymentBreakdown['CARD'] || 0 },
            { key: 'ONLINE', label: 'Online', amount: paymentBreakdown['ONLINE'] || 0 },
        ];
        return methods;
    }, [paymentBreakdown]);

    // Low stock items
    const lowStockItems = useMemo(() => {
        return inventoryItems.filter(i => (i.currentStock || i.quantity || 0) <= (i.minStock || i.safetyStock || 5));
    }, [inventoryItems]);

    const totalInventoryValuation = useMemo(() => {
        return inventoryItems.reduce((sum, item) => sum + ((item.currentStock || item.quantity || 0) * (item.costPerUnit || 0)), 0);
    }, [inventoryItems]);

    return (
        <div className="reports-page">
            {/* ── Page Header (Icebox Style) ── */}
            <div className="reports-header-bar">
                <div className="header-left-group">
                    <h1 className="reports-page-title">Reports & Analytics</h1>
                    <div className="reports-meta-chips">
                        <span className="reports-time-chip">{currentTime}</span>
                        <span className="reports-role-badge">{user?.role || 'Admin'}</span>
                    </div>
                </div>

                <div className="reports-header-right">
                    <button className="reports-refresh-btn" onClick={fetchAllReports} title="Refresh analytics">
                        <Activity size={15} />
                        <span>Live Sync</span>
                    </button>
                </div>
            </div>

            {/* ── Top Navigation Tabs (Pill Group) ── */}
            <div className="reports-nav-section">
                <div className="reports-tabs-pillbar">
                    <button
                        className={`reports-nav-tab ${activeTab === 'sales' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sales')}
                    >
                        Sales Reports
                    </button>
                    <button
                        className={`reports-nav-tab ${activeTab === 'shifts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shifts')}
                    >
                        Cashier Shifts & Cash
                    </button>
                    <button
                        className={`reports-nav-tab ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inventory')}
                    >
                        Inventory Overview
                    </button>
                </div>
            </div>

            {/* ── Main Content Container ── */}
            <div className="reports-content-container">
                {loading ? (
                    <ReportsSkeleton />
                ) : activeTab === 'sales' ? (
                    <div className="sales-reports-view">
                        {/* ── 1. Hero Chart: Daily sales — last 14 days ── */}
                        <div className="ice-chart-card hero-chart-card">
                            <div className="ice-card-header">
                                <h3 className="ice-card-title">Daily sales — last 14 days</h3>
                            </div>

                            <div className="ice-barchart-wrapper">
                                {/* Y-Axis Numbers & Gridlines */}
                                <div className="chart-y-axis">
                                    {yAxis14Steps.map((val, idx) => (
                                        <div key={idx} className="y-axis-step">
                                            <span className="y-axis-label">{val}</span>
                                            <div className="y-axis-gridline" />
                                        </div>
                                    ))}
                                </div>

                                {/* Bars Row */}
                                <div className="chart-bars-track">
                                    {daily14.map((item, idx) => {
                                        const ceilMax = yAxis14Steps[0] || 1200;
                                        const heightPercent = ceilMax > 0 ? Math.min(100, Math.max(3, (item.sales / ceilMax) * 100)) : 3;
                                        const isHovered = hovered14Idx === idx;

                                        return (
                                            <div
                                                key={idx}
                                                className={`chart-bar-column ${isHovered ? 'hovered' : ''}`}
                                                onMouseEnter={() => setHovered14Idx(idx)}
                                                onMouseLeave={() => setHovered14Idx(null)}
                                            >
                                                {/* Tooltip */}
                                                {isHovered && (
                                                    <div className="chart-tooltip-box">
                                                        <span className="tooltip-date">{item.label}</span>
                                                        <span className="tooltip-revenue">revenue : {formatCurrency(item.sales)}</span>
                                                    </div>
                                                )}

                                                {/* Background Column Highlight Pillar */}
                                                <div className="bar-column-bg" />

                                                {/* Active Bar */}
                                                <div className="bar-column-fill-wrap">
                                                    <div
                                                        className="bar-column-fill purple-fill"
                                                        style={{ height: `${heightPercent}%` }}
                                                    />
                                                </div>

                                                {/* X-Axis Label */}
                                                <span className="chart-x-label">{item.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ── 2. Dual Grid: Weekly Sales & Monthly Sales ── */}
                        <div className="ice-charts-dual-grid">
                            {/* Weekly sales */}
                            <div className="ice-chart-card">
                                <div className="ice-card-header">
                                    <h3 className="ice-card-title">Weekly sales</h3>
                                </div>

                                <div className="ice-barchart-wrapper mini-chart">
                                    <div className="chart-y-axis">
                                        {yAxisWeekSteps.map((val, idx) => (
                                            <div key={idx} className="y-axis-step">
                                                <span className="y-axis-label">{val}</span>
                                                <div className="y-axis-gridline" />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="chart-bars-track">
                                        {weekly4.map((item, idx) => {
                                            const ceilMax = yAxisWeekSteps[0] || 2200;
                                            const heightPercent = ceilMax > 0 ? Math.min(100, Math.max(3, (item.sales / ceilMax) * 100)) : 3;
                                            const isHovered = hoveredWeekIdx === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`chart-bar-column ${isHovered ? 'hovered' : ''}`}
                                                    onMouseEnter={() => setHoveredWeekIdx(idx)}
                                                    onMouseLeave={() => setHoveredWeekIdx(null)}
                                                >
                                                    {isHovered && (
                                                        <div className="chart-tooltip-box">
                                                            <span className="tooltip-date">{item.label}</span>
                                                            <span className="tooltip-revenue">revenue : {formatCurrency(item.sales)}</span>
                                                        </div>
                                                    )}
                                                    <div className="bar-column-bg" />
                                                    <div className="bar-column-fill-wrap">
                                                        <div
                                                            className="bar-column-fill yellow-fill"
                                                            style={{ height: `${heightPercent}%` }}
                                                        />
                                                    </div>
                                                    <span className="chart-x-label">{item.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Monthly sales */}
                            <div className="ice-chart-card">
                                <div className="ice-card-header">
                                    <h3 className="ice-card-title">Monthly sales</h3>
                                </div>

                                <div className="ice-barchart-wrapper mini-chart">
                                    <div className="chart-y-axis">
                                        {yAxisMonthSteps.map((val, idx) => (
                                            <div key={idx} className="y-axis-step">
                                                <span className="y-axis-label">{val}</span>
                                                <div className="y-axis-gridline" />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="chart-bars-track">
                                        {monthlyData.map((item, idx) => {
                                            const ceilMax = yAxisMonthSteps[0] || 2200;
                                            const heightPercent = ceilMax > 0 ? Math.min(100, Math.max(3, (item.sales / ceilMax) * 100)) : 3;
                                            const isHovered = hoveredMonthIdx === idx;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`chart-bar-column ${isHovered ? 'hovered' : ''}`}
                                                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                                                    onMouseLeave={() => setHoveredMonthIdx(null)}
                                                >
                                                    {isHovered && (
                                                        <div className="chart-tooltip-box">
                                                            <span className="tooltip-date">{item.label}</span>
                                                            <span className="tooltip-revenue">revenue : {formatCurrency(item.sales)}</span>
                                                        </div>
                                                    )}
                                                    <div className="bar-column-bg" />
                                                    <div className="bar-column-fill-wrap">
                                                        <div
                                                            className="bar-column-fill green-fill"
                                                            style={{ height: `${heightPercent}%` }}
                                                        />
                                                    </div>
                                                    <span className="chart-x-label">{item.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── 3. Bottom Dual Row: Top Selling Products & Payment Breakdown ── */}
                        <div className="ice-charts-dual-grid">
                            {/* Top selling products */}
                            <div className="ice-data-card">
                                <div className="ice-card-header">
                                    <h3 className="ice-card-title">Top selling products</h3>
                                </div>

                                <div className="top-products-list">
                                    {topProducts.length === 0 ? (
                                        <div className="ice-empty-card-state">
                                            <Award size={32} />
                                            <span>No product sales data recorded yet</span>
                                        </div>
                                    ) : (
                                        topProducts.slice(0, 8).map((product, idx) => (
                                            <div key={idx} className="product-rank-row">
                                                <div className="rank-badge">{idx + 1}</div>
                                                <span className="product-rank-name">{product.name}</span>
                                                <div className="product-rank-metrics">
                                                    <span className="product-rank-qty">{product.quantity} pcs</span>
                                                    <span className="metric-dot">·</span>
                                                    <span className="product-rank-total">{formatCurrency(product.total)}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Payment breakdown (today) */}
                            <div className="ice-data-card">
                                <div className="ice-card-header">
                                    <h3 className="ice-card-title">Payment breakdown (today)</h3>
                                </div>

                                <div className="payment-breakdown-list">
                                    {normalizedPayments.map((pm) => (
                                        <div key={pm.key} className="payment-pill-row">
                                            <span className="payment-mode-label">{pm.label}</span>
                                            <span className="payment-mode-amount">{formatCurrency(pm.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'shifts' ? (
                    <div className="shifts-reports-view">
                        {/* Summary KPI Strip */}
                        <div className="shifts-kpi-grid">
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Today's Cash Collected</span>
                                <span className="kpi-value">{formatCurrency(paymentBreakdown['CASH'] || 0)}</span>
                            </div>
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Digital / UPI Sales</span>
                                <span className="kpi-value">{formatCurrency((paymentBreakdown['UPI'] || 0) + (paymentBreakdown['CARD'] || 0) + (paymentBreakdown['ONLINE'] || 0))}</span>
                            </div>
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Active Register</span>
                                <span className="kpi-value positive">Online & Synced</span>
                            </div>
                        </div>

                        {/* Shifts Table */}
                        <div className="ice-data-card full-table-card">
                            <div className="ice-card-header">
                                <h3 className="ice-card-title">Cashier Shifts History</h3>
                            </div>
                            <div className="shifts-table-wrap">
                                <table className="ice-table">
                                    <thead>
                                        <tr>
                                            <th>CASHIER / STAFF</th>
                                            <th>TIME WINDOW</th>
                                            <th>OPENING FLOAT</th>
                                            <th>CASH SALES</th>
                                            <th>DIGITAL SALES</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="staff-cell">
                                                <div className="staff-avatar">{user?.name?.slice(0, 1) || 'A'}</div>
                                                <span className="staff-name">{user?.name || 'Current Admin'}</span>
                                            </td>
                                            <td>Today, 09:00 AM – Active</td>
                                            <td>₹500.00</td>
                                            <td>{formatCurrency(paymentBreakdown['CASH'] || 0)}</td>
                                            <td>{formatCurrency((paymentBreakdown['UPI'] || 0) + (paymentBreakdown['CARD'] || 0))}</td>
                                            <td>
                                                <span className="ice-status-pill green">ACTIVE SHIFT</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="inventory-reports-view">
                        {/* Inventory KPI Grid */}
                        <div className="shifts-kpi-grid">
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Total Stock Items</span>
                                <span className="kpi-value">{inventoryItems.length}</span>
                            </div>
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Low Stock Alerts</span>
                                <span className={`kpi-value ${lowStockItems.length > 0 ? 'warning' : ''}`}>{lowStockItems.length}</span>
                            </div>
                            <div className="shifts-kpi-card">
                                <span className="kpi-label">Estimated Stock Valuation</span>
                                <span className="kpi-value">{formatCurrency(totalInventoryValuation)}</span>
                            </div>
                        </div>

                        {/* Stock Status Table */}
                        <div className="ice-data-card full-table-card">
                            <div className="ice-card-header">
                                <h3 className="ice-card-title">Stock Overview & Reorder Status</h3>
                            </div>
                            <div className="shifts-table-wrap">
                                <table className="ice-table">
                                    <thead>
                                        <tr>
                                            <th>ITEM NAME</th>
                                            <th>CATEGORY</th>
                                            <th>CURRENT STOCK</th>
                                            <th>UNIT</th>
                                            <th>MIN THRESHOLD</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventoryItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                                    No inventory items configured
                                                </td>
                                            </tr>
                                        ) : (
                                            inventoryItems.slice(0, 15).map((item) => {
                                                const current = Number(item.currentStock ?? item.quantity ?? 0);
                                                const min = Number(item.minStock ?? item.safetyStock ?? 5);
                                                const isLow = current <= min;

                                                return (
                                                    <tr key={item.id}>
                                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                                                        <td>{item.category || 'General'}</td>
                                                        <td style={{ fontWeight: 700 }}>{current}</td>
                                                        <td>{item.unit || 'pcs'}</td>
                                                        <td>{min}</td>
                                                        <td>
                                                            <span className={`ice-status-pill ${isLow ? 'amber' : 'green'}`}>
                                                                {isLow ? 'LOW STOCK' : 'SUFFICIENT'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
