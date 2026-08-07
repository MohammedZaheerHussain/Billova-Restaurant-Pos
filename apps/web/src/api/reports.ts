import api from './client';
import { supabase } from '../lib/supabase';

// Build date-bucketed Supabase fallback for reports
async function getSupabaseOrders() {
    const query = supabase.from('orders').select('total_amount, created_at, payment_method, order_type, status');
    const { data } = await query;
    return data || [];
}

export const reportsAPI = {
    dailySales: async (date?: string) => {
        try { return await api.get('/reports/daily-sales', { params: { date } }); }
        catch {
            const orders = await getSupabaseOrders();
            const today = date ? new Date(date) : new Date();
            const todayStr = today.toISOString().split('T')[0];
            const todayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(todayStr));
            const totalSales = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
            const paymentBreakdown: Record<string, number> = {};
            const orderTypeBreakdown: Record<string, { count: number; total: number }> = {};
            todayOrders.forEach((o: any) => {
                const pm = o.payment_method || 'CASH';
                paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + Number(o.total_amount || 0);
                const ot = o.order_type || 'DINE_IN';
                if (!orderTypeBreakdown[ot]) orderTypeBreakdown[ot] = { count: 0, total: 0 };
                orderTypeBreakdown[ot].count++;
                orderTypeBreakdown[ot].total += Number(o.total_amount || 0);
            });
            return {
                data: {
                    totalSales,
                    totalOrders: todayOrders.length,
                    avgOrderValue: todayOrders.length ? Math.round(totalSales / todayOrders.length) : 0,
                    paymentBreakdown,
                    orderTypeBreakdown,
                    hourlyBreakdown: [],
                }
            };
        }
    },
    itemSales: async (startDate?: string, endDate?: string) => {
        try { return await api.get('/reports/item-sales', { params: { startDate, endDate } }); }
        catch { return { data: { items: [], categories: [] } }; }
    },
    categorySales: async (startDate?: string, endDate?: string) => {
        try { return await api.get('/reports/category-sales', { params: { startDate, endDate } }); }
        catch { return { data: [] }; }
    },
    hourlySales: async () => {
        try { return await api.get('/reports/hourly-sales'); }
        catch {
            const orders = await getSupabaseOrders();
            const hourly: { hour: number; orders: number; total: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, total: 0 }));
            orders.forEach((o: any) => {
                const h = new Date(o.created_at || Date.now()).getHours();
                hourly[h].orders++;
                hourly[h].total += Number(o.total_amount || 0);
            });
            return { data: hourly };
        }
    },
    weeklySummary: async () => {
        try { return await api.get('/reports/weekly-summary'); }
        catch {
            const orders = await getSupabaseOrders();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const days: { date: string; dayName: string; sales: number; orders: number }[] = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(dateStr));
                days.push({
                    date: dateStr,
                    dayName: dayNames[d.getDay()],
                    sales: dayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
                    orders: dayOrders.length,
                });
            }
            const totalSales = days.reduce((s, d) => s + d.sales, 0);
            return {
                data: {
                    totalSales,
                    totalOrders: days.reduce((s, d) => s + d.orders, 0),
                    trend: 0,
                    avgDaily: days.length ? Math.round(totalSales / days.length) : 0,
                    days,
                }
            };
        }
    },
    monthlySummary: async () => {
        try { return await api.get('/reports/monthly-summary'); }
        catch {
            const orders = await getSupabaseOrders();
            const now = new Date();
            const monthStr = now.toISOString().slice(0, 7); // "2026-08"
            const monthOrders = orders.filter((o: any) => (o.created_at || '').startsWith(monthStr));
            const totalSales = monthOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
            const daysElapsed = now.getDate();
            return {
                data: {
                    month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
                    totalSales,
                    totalOrders: monthOrders.length,
                    trend: 0,
                    avgDaily: daysElapsed ? Math.round(totalSales / daysElapsed) : 0,
                    daysElapsed,
                }
            };
        }
    },
    salesTrend: async (days?: number) => {
        try { return await api.get('/reports/sales-trend', { params: { days } }); }
        catch { return { data: [] }; }
    },
};

export const dashboardAPI = {
    ownerSummary: async () => {
        try { return await api.get('/dashboard/owner-summary'); }
        catch {
            const orders = await getSupabaseOrders();
            const todayStr = new Date().toISOString().split('T')[0];
            const todayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(todayStr));
            const totalSalesToday = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
            const openOrders = orders.filter((o: any) => ['PENDING', 'PREPARING', 'READY'].includes(o.status));
            return {
                data: {
                    totalSalesToday,
                    openOrdersCount: openOrders.length,
                    totalOrdersToday: todayOrders.length,
                    avgOrderValue: todayOrders.length ? Math.round(totalSalesToday / todayOrders.length) : 0,
                    totalCustomersCount: 0,
                }
            };
        }
    },
};
