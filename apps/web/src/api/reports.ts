import api from './client';
import { supabase } from '../lib/supabase';
import { hasExpressBackend } from '../lib/superadmin-direct';

async function getSupabaseOrders() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
    try {
        const { data, error } = await supabase.from('orders').select('*');
        if (error) return [];
        return data || [];
    } catch {
        return [];
    }
}

export const reportsAPI = {
    dailySales: async (date?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/daily-sales', { params: { date } }); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const today = date ? new Date(date) : new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(todayStr));
        const totalSales = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);
        const paymentBreakdown: Record<string, number> = {};
        const orderTypeBreakdown: Record<string, { count: number; total: number }> = {};
        todayOrders.forEach((o: any) => {
            const pm = o.payment_method || o.paymentMethod || 'CASH';
            const amt = Number(o.total_amount || o.total || o.subtotal || 0);
            paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + amt;
            const ot = o.order_type || o.orderType || o.type || 'DINE_IN';
            if (!orderTypeBreakdown[ot]) orderTypeBreakdown[ot] = { count: 0, total: 0 };
            orderTypeBreakdown[ot].count++;
            orderTypeBreakdown[ot].total += amt;
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
    },
    itemSales: async (startDate?: string, endDate?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/item-sales', { params: { startDate, endDate } }); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const itemMap: Record<string, { name: string; quantity: number; total: number }> = {};
        orders.forEach((o: any) => {
            const items = o.items || [];
            items.forEach((it: any) => {
                const name = it.name || it.item_name || 'Item';
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || it.unit_price || 0);
                if (!itemMap[name]) itemMap[name] = { name, quantity: 0, total: 0 };
                itemMap[name].quantity += qty;
                itemMap[name].total += (qty * price);
            });
        });
        const items = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
        return { data: { items, categories: [] } };
    },
    categorySales: async (startDate?: string, endDate?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/category-sales', { params: { startDate, endDate } }); } catch { /* fallback */ }
        }
        return { data: [] };
    },
    hourlySales: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/hourly-sales'); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const hourly: { hour: number; orders: number; total: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, total: 0 }));
        orders.forEach((o: any) => {
            const h = new Date(o.created_at || Date.now()).getHours();
            hourly[h].orders++;
            hourly[h].total += Number(o.total_amount || o.total || o.subtotal || 0);
        });
        return { data: hourly };
    },
    daily14Days: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/daily-14-days'); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const days: { date: string; label: string; sales: number; orders: number }[] = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
            const dayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(dateStr));
            const sales = dayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);
            days.push({
                date: dateStr,
                label,
                sales,
                orders: dayOrders.length,
            });
        }
        return { data: days };
    },
    weekly4Weeks: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/weekly-4-weeks'); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const weeks: { label: string; sales: number; orders: number }[] = [];
        const weekLabels = ['4w ago', '3w ago', '2w ago', 'This week'];
        const now = Date.now();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        for (let w = 3; w >= 0; w--) {
            const startMs = now - (w + 1) * 7 * MS_PER_DAY;
            const endMs = now - w * 7 * MS_PER_DAY;
            const weekOrders = orders.filter((o: any) => {
                const orderMs = new Date(o.created_at || Date.now()).getTime();
                return orderMs >= startMs && (w === 0 ? orderMs <= now : orderMs < endMs);
            });
            const sales = weekOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);
            weeks.push({
                label: weekLabels[3 - w],
                sales,
                orders: weekOrders.length,
            });
        }
        return { data: weeks };
    },
    weeklySummary: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/weekly-summary'); } catch { /* fallback */ }
        }
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
                sales: dayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0),
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
    },
    monthlySummary: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/monthly-summary'); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const months: { label: string; sales: number; orders: number }[] = [];
        
        // Past 3 months + current month
        for (let m = 3; m >= 0; m--) {
            const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
            const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mOrders = orders.filter((o: any) => (o.created_at || '').startsWith(monthPrefix));
            const sales = mOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);
            months.push({
                label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
                sales,
                orders: mOrders.length,
            });
        }

        const currentMonthOrders = orders.filter((o: any) => (o.created_at || '').startsWith(now.toISOString().slice(0, 7)));
        const totalSales = currentMonthOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);
        const daysElapsed = now.getDate();
        return {
            data: {
                month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
                totalSales,
                totalOrders: currentMonthOrders.length,
                trend: 0,
                avgDaily: daysElapsed ? Math.round(totalSales / daysElapsed) : 0,
                daysElapsed,
                months,
            }
        };
    },
    salesTrend: async (days?: number) => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/sales-trend', { params: { days } }); } catch { /* fallback */ }
        }
        return { data: [] };
    },
};

export const dashboardAPI = {
    ownerSummary: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/dashboard/owner-summary'); } catch { /* fallback */ }
        }
        const orders = await getSupabaseOrders();
        const todayStr = new Date().toISOString().split('T')[0];
        const todayOrders = orders.filter((o: any) => (o.created_at || '').startsWith(todayStr));
        const todayRevenue = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0);

        // Compute top items
        const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        orders.forEach((o: any) => {
            (o.items || []).forEach((it: any) => {
                const name = it.name || it.item_name || 'Item';
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || it.unit_price || 0);
                if (!itemMap[name]) itemMap[name] = { name, quantity: 0, revenue: 0 };
                itemMap[name].quantity += qty;
                itemMap[name].revenue += (qty * price);
            });
        });
        const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

        const paymentSplit: Record<string, number> = {};
        todayOrders.forEach((o: any) => {
            const pm = o.payment_method || o.paymentMethod || 'CASH';
            const amt = Number(o.total_amount || o.total || o.subtotal || 0);
            paymentSplit[pm] = (paymentSplit[pm] || 0) + amt;
        });

        const hourlySales = Array.from({ length: 24 }, (_, hour) => {
            const hourOrders = todayOrders.filter((o: any) => new Date(o.created_at || Date.now()).getHours() === hour);
            return {
                hour,
                orders: hourOrders.length,
                revenue: hourOrders.reduce((s: number, o: any) => s + Number(o.total_amount || o.total || o.subtotal || 0), 0),
            };
        });

        let peak = { hour: 13, label: '1:00 PM', orders: 0 };
        hourlySales.forEach(h => {
            if (h.orders > peak.orders) {
                const h12 = h.hour % 12 || 12;
                const ampm = h.hour >= 12 ? 'PM' : 'AM';
                peak = { hour: h.hour, label: `${h12}:00 ${ampm}`, orders: h.orders };
            }
        });

        return {
            data: {
                today: {
                    revenue: todayRevenue,
                    orders: todayOrders.length,
                    avgBill: todayOrders.length ? Math.round(todayRevenue / todayOrders.length) : 0,
                },
                yesterday: { revenue: 0 },
                revenueChange: 0,
                topItems,
                slowItems: [],
                lowStockAlerts: [],
                lowStockCount: 0,
                paymentSplit,
                hourlySales,
                peakHour: peak,
                profitEstimate: { revenue: todayRevenue, estimatedCost: Math.round(todayRevenue * 0.4), estimatedProfit: Math.round(todayRevenue * 0.6), margin: 60 },
                generatedAt: new Date().toISOString(),
            }
        };
    },
};
