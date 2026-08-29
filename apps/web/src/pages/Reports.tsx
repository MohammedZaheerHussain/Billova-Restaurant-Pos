// Reports Dashboard - Premium Analytics
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, DollarSign, ShoppingBag,
    Calendar, BarChart3, PieChart, Award, CreditCard, Activity, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsAPI } from '../api';
import './Reports.css';
import { ReportsSkeleton } from '../components/Skeleton';

type Period = 'today' | 'week' | 'month';

interface DailyData {
    totalSales: number;
    totalOrders: number;
    avgOrderValue: number;
    paymentBreakdown: Record<string, number>;
    orderTypeBreakdown: Record<string, { count: number; total: number }>;
}

interface WeeklyData {
    totalSales: number;
    totalOrders: number;
    trend: number;
    avgDaily: number;
    days: { date: string; dayName: string; sales: number; orders: number }[];
}

interface MonthlyData {
    month: string;
    totalSales: number;
    totalOrders: number;
    trend: number;
    avgDaily: number;
    daysElapsed: number;
}

interface HourlyData {
    hour: number;
    orders: number;
    total: number;
}

export default function ReportsPage() {
    const [period, setPeriod] = useState<Period>('today');
    const [loading, setLoading] = useState(true);
    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
    const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
    const [itemSales, setItemSales] = useState<any[]>([]);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [dailyRes, weeklyRes, monthlyRes, itemRes, hourlyRes] = await Promise.all([
                reportsAPI.dailySales(),
                reportsAPI.weeklySummary(),
                reportsAPI.monthlySummary(),
                reportsAPI.itemSales(),
                reportsAPI.hourlySales(),
            ]);
            setDailyData(dailyRes.data);
            setWeeklyData(weeklyRes.data);
            setMonthlyData(monthlyRes.data);
            setItemSales(itemRes.data.items || []);
            setHourlyData(hourlyRes.data || []);
        } catch (error) {
            toast.error('Failed to load reports');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
        return `₹${value.toFixed(0)}`;
    };

    // Calculate chart bar heights
    const maxSales = weeklyData ? Math.max(...weeklyData.days.map(d => d.sales)) : 0;

    return (
        <div className="reports-page">
            <div className="page-header">
                <div>
                    <h1>Reports & Analytics</h1>
                    <p>Business revenue and operational insights</p>
                </div>
                <div className="period-tabs">
                    <button
                        className={`period-tab ${period === 'today' ? 'active' : ''}`}
                        onClick={() => setPeriod('today')}
                    >
                        <Calendar size={16} /> Today
                    </button>
                    <button
                        className={`period-tab ${period === 'week' ? 'active' : ''}`}
                        onClick={() => setPeriod('week')}
                    >
                        <BarChart3 size={16} /> This Week
                    </button>
                    <button
                        className={`period-tab ${period === 'month' ? 'active' : ''}`}
                        onClick={() => setPeriod('month')}
                    >
                        <PieChart size={16} /> This Month
                    </button>
                </div>
            </div>

            {loading ? (
                <ReportsSkeleton />
            ) : (
                <>
                    {/* Summary Cards - Period Specific */}
                    <div className="summary-cards">
                        <motion.div
                            className="summary-card gradient-green"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={`sales-${period}`}
                        >
                            <div className="card-icon">
                                <DollarSign size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {period === 'today' && formatCurrency(dailyData?.totalSales || 0)}
                                    {period === 'week' && formatCurrency(weeklyData?.totalSales || 0)}
                                    {period === 'month' && formatCurrency(monthlyData?.totalSales || 0)}
                                </span>
                                <span className="card-label">
                                    {period === 'today' && "Today's Sales"}
                                    {period === 'week' && "Weekly Sales"}
                                    {period === 'month' && `${monthlyData?.month || 'Monthly'} Sales`}
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            className="summary-card gradient-blue"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            key={`avg-${period}`}
                        >
                            <div className="card-icon">
                                <BarChart3 size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {period === 'today' && formatCurrency(dailyData?.avgOrderValue || 0)}
                                    {period === 'week' && formatCurrency(weeklyData?.avgDaily || 0)}
                                    {period === 'month' && formatCurrency(monthlyData?.avgDaily || 0)}
                                </span>
                                <span className="card-label">
                                    {period === 'today' && "Avg Order Value"}
                                    {period === 'week' && "Daily Average"}
                                    {period === 'month' && "Daily Average"}
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            className="summary-card gradient-purple"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            key={`trend-${period}`}
                        >
                            <div className="card-icon">
                                <TrendingUp size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {period === 'today' && `${dailyData?.totalOrders || 0} orders`}
                                    {period === 'week' && (
                                        <>
                                            {weeklyData?.trend !== undefined && weeklyData.trend !== 0 ? (
                                                <span className={weeklyData.trend > 0 ? 'trend-up' : 'trend-down'}>
                                                    {weeklyData.trend > 0 ? '+' : ''}{weeklyData.trend.toFixed(1)}%
                                                </span>
                                            ) : '0%'}
                                        </>
                                    )}
                                    {period === 'month' && (
                                        <>
                                            {monthlyData?.trend !== undefined && monthlyData.trend !== 0 ? (
                                                <span className={monthlyData.trend > 0 ? 'trend-up' : 'trend-down'}>
                                                    {monthlyData.trend > 0 ? '+' : ''}{monthlyData.trend.toFixed(1)}%
                                                </span>
                                            ) : '0%'}
                                        </>
                                    )}
                                </span>
                                <span className="card-label">
                                    {period === 'today' && "Total Orders"}
                                    {period === 'week' && "vs Last Week"}
                                    {period === 'month' && "vs Last Month"}
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            className="summary-card gradient-orange"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            key={`orders-${period}`}
                        >
                            <div className="card-icon">
                                <ShoppingBag size={24} />
                            </div>
                            <div className="card-content">
                                <span className="card-value">
                                    {period === 'today' && (dailyData?.totalOrders || 0)}
                                    {period === 'week' && (weeklyData?.totalOrders || 0)}
                                    {period === 'month' && (monthlyData?.totalOrders || 0)}
                                </span>
                                <span className="card-label">
                                    {period === 'today' && "Today's Orders"}
                                    {period === 'week' && "Weekly Orders"}
                                    {period === 'month' && "Monthly Orders"}
                                </span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Charts Row - Period Specific */}
                    <div className="charts-row">
                        {/* Sales Trend Chart - Changes based on period */}
                        <motion.div
                            className="chart-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            key={`chart-${period}`}
                        >
                            <h3>
                                <Activity size={18} />
                                {period === 'today' && 'Hourly Sales Trend'}
                                {period === 'week' && 'Weekly Sales Trend'}
                                {period === 'month' && 'This Week Overview'}
                            </h3>
                            <div className="bar-chart">
                                {period === 'today' && hourlyData.length > 0 && (() => {
                                    const maxHourlySales = Math.max(...hourlyData.map(h => h.total));
                                    const businessHours = hourlyData.filter(h => h.hour >= 9 && h.hour <= 23);
                                    return businessHours.map((hour, idx) => (
                                        <div key={idx} className="bar-container">
                                            <div
                                                className="bar"
                                                style={{
                                                    height: `${maxHourlySales > 0 ? (hour.total / maxHourlySales) * 100 : 0}%`,
                                                }}
                                            >
                                                <span className="bar-value">{formatCurrency(hour.total)}</span>
                                            </div>
                                            <span className="bar-label">{hour.hour}:00</span>
                                        </div>
                                    ));
                                })()}
                                {period === 'today' && hourlyData.length === 0 && (
                                    <p className="no-data">No hourly data available</p>
                                )}
                                {period === 'week' && weeklyData?.days.map((day, idx) => (
                                    <div key={idx} className="bar-container">
                                        <div
                                            className="bar"
                                            style={{
                                                height: `${maxSales > 0 ? (day.sales / maxSales) * 100 : 0}%`,
                                            }}
                                        >
                                            <span className="bar-value">{formatCurrency(day.sales)}</span>
                                        </div>
                                        <span className="bar-label">{day.dayName}</span>
                                    </div>
                                ))}
                                {period === 'month' && weeklyData?.days.map((day, idx) => (
                                    <div key={idx} className="bar-container">
                                        <div
                                            className="bar"
                                            style={{
                                                height: `${maxSales > 0 ? (day.sales / maxSales) * 100 : 0}%`,
                                            }}
                                        >
                                            <span className="bar-value">{formatCurrency(day.sales)}</span>
                                        </div>
                                        <span className="bar-label">{day.dayName}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Order Type Breakdown - Shows order types for the selected period */}
                        <motion.div
                            className="chart-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h3>
                                <Layers size={18} />
                                {period === 'today' && 'Order Types (Today)'}
                                {period === 'week' && 'Order Types (This Week)'}
                                {period === 'month' && 'Order Types (This Month)'}
                            </h3>
                            <div className="order-types">
                                {dailyData?.orderTypeBreakdown && Object.entries(dailyData.orderTypeBreakdown).map(([type, data]) => {
                                    const total = Object.values(dailyData.orderTypeBreakdown).reduce((sum, d) => sum + d.count, 0);
                                    const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;
                                    const colors: Record<string, string> = {
                                        'DINE_IN': '#22c55e',
                                        'TAKEAWAY': '#3b82f6',
                                        'ONLINE': '#f59e0b',
                                    };
                                    return (
                                        <div key={type} className="order-type-item">
                                            <div className="order-type-header">
                                                <span
                                                    className="order-type-dot"
                                                    style={{ background: colors[type] || '#888' }}
                                                />
                                                <span className="order-type-name">
                                                    {type.replace('_', ' ')}
                                                </span>
                                                <span className="order-type-percent">{percentage}%</span>
                                            </div>
                                            <div className="order-type-bar">
                                                <div
                                                    className="order-type-fill"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        background: colors[type] || '#888'
                                                    }}
                                                />
                                            </div>
                                            <div className="order-type-stats">
                                                <span>{data.count} orders</span>
                                                <span>{formatCurrency(data.total)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!dailyData?.orderTypeBreakdown || Object.keys(dailyData.orderTypeBreakdown).length === 0) && (
                                    <p className="no-data">
                                        {period === 'today' && 'No orders today'}
                                        {period === 'week' && 'No orders this week'}
                                        {period === 'month' && 'No orders this month'}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Bottom Row */}
                    <div className="bottom-row">
                        {/* Top Selling Items */}
                        <motion.div
                            className="report-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <h3>
                                <Award size={18} /> Top Selling Items
                                {period === 'today' && ' (Today)'}
                                {period === 'week' && ' (This Week)'}
                                {period === 'month' && ' (This Month)'}
                            </h3>
                            <div className="items-list">
                                {itemSales.slice(0, 5).map((item, idx) => (
                                    <div key={idx} className="item-row">
                                        <span className={`rank rank-${idx + 1}`}>#{idx + 1}</span>
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-qty">{item.quantity} sold</span>
                                        <span className="item-total">{formatCurrency(item.total)}</span>
                                    </div>
                                ))}
                                {itemSales.length === 0 && (
                                    <p className="no-data">No sales data</p>
                                )}
                            </div>
                        </motion.div>

                        {/* Payment Breakdown */}
                        <motion.div
                            className="report-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                        >
                            <h3>
                                <CreditCard size={18} /> Payment Methods
                                {period === 'today' && ' (Today)'}
                                {period === 'week' && ' (This Week)'}
                                {period === 'month' && ' (This Month)'}
                            </h3>
                            <div className="payment-list">
                                {dailyData?.paymentBreakdown && Object.entries(dailyData.paymentBreakdown).map(([mode, amount]) => (
                                    <div key={mode} className="payment-item">
                                        <span className="payment-mode">{mode}</span>
                                        <span className="payment-amount">{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                                {(!dailyData?.paymentBreakdown || Object.keys(dailyData.paymentBreakdown).length === 0) && (
                                    <p className="no-data">
                                        {period === 'today' && 'No payments today'}
                                        {period === 'week' && 'No payments this week'}
                                        {period === 'month' && 'No payments this month'}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
