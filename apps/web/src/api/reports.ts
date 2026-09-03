import api from './client';
import { hasExpressBackend } from '../lib/superadmin-direct';
import { ordersAPI, getStoredLocalOrders } from './orders';
import { useAuthStore } from '../store';

const getLocalDate = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getOrderDateStr = (o: any) => {
    const raw = o.createdAt || o.created_at;
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return getLocalDate(d);
};

async function getResilientOrders(): Promise<any[]> {
    try {
        const res = await ordersAPI.getAll();
        if (res && Array.isArray(res.data) && res.data.length > 0) {
            return res.data;
        }
    } catch {}

    // Fallback directly to local tenant orders
    try {
        const branchId = useAuthStore.getState().user?.branch?.id || (useAuthStore.getState().user as any)?.branchId;
        const local = getStoredLocalOrders(branchId);
        if (Array.isArray(local) && local.length > 0) return local;
    } catch {}

    return [];
}

export const reportsAPI = {
    dailySales: async (date?: string) => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/daily-sales', { params: { date } }); } catch { /* fallback */ }
        }
        const orders = await getResilientOrders();
        const targetDateStr = date || getLocalDate();
        const todayOrders = orders.filter((o: any) => o.status !== 'CANCELLED' && getOrderDateStr(o) === targetDateStr);
        const totalSales = todayOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
        const paymentBreakdown: Record<string, number> = {};
        const orderTypeBreakdown: Record<string, { count: number; total: number }> = {};
        todayOrders.forEach((o: any) => {
            const pm = (o.payments?.[0]?.mode || o.paymentMethod || o.payment_method || (o.orderType === 'ONLINE' ? 'ONLINE' : 'CASH')).toUpperCase();
            const amt = Number(o.total || o.totalAmount || o.total_amount || 0);
            paymentBreakdown[pm] = (paymentBreakdown[pm] || 0) + amt;
            const ot = o.orderType || o.order_type || o.type || 'DINE_IN';
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
        const orders = await getResilientOrders();
        const itemMap: Record<string, { name: string; quantity: number; total: number }> = {};
        orders.forEach((o: any) => {
            const items = o.items || [];
            items.forEach((it: any) => {
                const name = it.name || it.itemName || it.item_name || it.menuItem?.name || 'Item';
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || it.unitPrice || it.unit_price || 0);
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
        const orders = await getResilientOrders();
        const hourly: { hour: number; orders: number; total: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, total: 0 }));
        orders.forEach((o: any) => {
            const raw = o.createdAt || o.created_at;
            const h = new Date(raw || Date.now()).getHours();
            hourly[h].orders++;
            hourly[h].total += Number(o.total || o.totalAmount || o.total_amount || 0);
        });
        return { data: hourly };
    },
    daily14Days: async () => {
        if (hasExpressBackend()) {
            try { return await api.get('/reports/daily-14-days'); } catch { /* fallback */ }
        }
        const orders = await getResilientOrders();
        const days: { date: string; label: string; sales: number; orders: number }[] = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = getLocalDate(d);
            const label = `${d.getDate()} ${monthNames[d.getMonth()]}`;
            const dayOrders = orders.filter((o: any) => getOrderDateStr(o) === dateStr);
            const sales = dayOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
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
        const orders = await getResilientOrders();
        const weeks: { label: string; sales: number; orders: number }[] = [];
        const weekLabels = ['4w ago', '3w ago', '2w ago', 'This week'];
        const now = Date.now();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        for (let w = 3; w >= 0; w--) {
            const startMs = now - (w + 1) * 7 * MS_PER_DAY;
            const endMs = now - w * 7 * MS_PER_DAY;
            const weekOrders = orders.filter((o: any) => {
                const raw = o.createdAt || o.created_at;
                const orderMs = new Date(raw || Date.now()).getTime();
                return orderMs >= startMs && (w === 0 ? orderMs <= now : orderMs < endMs);
            });
            const sales = weekOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
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
        const orders = await getResilientOrders();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days: { date: string; dayName: string; sales: number; orders: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dateStr = getLocalDate(d);
            const dayOrders = orders.filter((o: any) => getOrderDateStr(o) === dateStr);
            days.push({
                date: dateStr,
                dayName: dayNames[d.getDay()],
                sales: dayOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0),
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
        const orders = await getResilientOrders();
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const months: { label: string; sales: number; orders: number }[] = [];
        
        // Past 3 months + current month
        for (let m = 3; m >= 0; m--) {
            const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
            const monthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mOrders = orders.filter((o: any) => getOrderDateStr(o).startsWith(monthPrefix));
            const sales = mOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
            months.push({
                label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
                sales,
                orders: mOrders.length,
            });
        }

        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthOrders = orders.filter((o: any) => getOrderDateStr(o).startsWith(currentMonthPrefix));
        const totalSales = currentMonthOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
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
        const orders = await getResilientOrders();
        const todayStr = getLocalDate();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = getLocalDate(yesterdayDate);

        const activeOrders = orders.filter((o: any) => o.status !== 'CANCELLED');
        const todayOrders = activeOrders.filter((o: any) => getOrderDateStr(o) === todayStr);
        const yesterdayOrders = activeOrders.filter((o: any) => getOrderDateStr(o) === yesterdayStr);

        const todayRevenue = todayOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);
        const yesterdayRevenue = yesterdayOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0);

        const revenueChange = yesterdayRevenue > 0
            ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1))
            : (todayRevenue > 0 ? 100 : 0);

        // Compute top items from active orders
        const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
        activeOrders.forEach((o: any) => {
            (o.items || []).forEach((it: any) => {
                const name = it.name || it.itemName || it.item_name || it.menuItem?.name || 'Item';
                const qty = Number(it.quantity || 1);
                const price = Number(it.price || it.unitPrice || it.unit_price || 0);
                if (!itemMap[name]) itemMap[name] = { name, quantity: 0, revenue: 0 };
                itemMap[name].quantity += qty;
                itemMap[name].revenue += (qty * price);
            });
        });
        const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

        // Payment split for today
        const paymentSplit: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0, ONLINE: 0 };
        todayOrders.forEach((o: any) => {
            if (o.payments && o.payments.length > 0) {
                o.payments.forEach((p: any) => {
                    const mode = (p.mode || p.method || 'CASH').toUpperCase();
                    const amt = Number(p.amount || 0);
                    paymentSplit[mode] = (paymentSplit[mode] || 0) + amt;
                });
            } else {
                const pm = (o.paymentMethod || o.payment_method || (o.orderType === 'ONLINE' ? 'ONLINE' : 'CASH')).toUpperCase();
                const amt = Number(o.total || o.totalAmount || o.total_amount || 0);
                paymentSplit[pm] = (paymentSplit[pm] || 0) + amt;
            }
        });

        // Hourly sales
        const hourlySales = Array.from({ length: 24 }, (_, hour) => {
            const hourOrders = todayOrders.filter((o: any) => {
                const raw = o.createdAt || o.created_at;
                return raw && new Date(raw).getHours() === hour;
            });
            return {
                hour,
                orders: hourOrders.length,
                revenue: hourOrders.reduce((s: number, o: any) => s + Number(o.total || o.totalAmount || o.total_amount || 0), 0),
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

        const estCost = Math.round(todayRevenue * 0.4);
        const estProfit = Math.round(todayRevenue * 0.6);

        return {
            data: {
                today: {
                    revenue: todayRevenue,
                    orders: todayOrders.length,
                    avgBill: todayOrders.length ? Math.round(todayRevenue / todayOrders.length) : 0,
                },
                yesterday: { revenue: yesterdayRevenue },
                revenueChange,
                topItems,
                slowItems: [],
                lowStockAlerts: [],
                lowStockCount: 0,
                paymentSplit,
                hourlySales,
                peakHour: peak,
                profitEstimate: {
                    revenue: todayRevenue,
                    estimatedCost: estCost,
                    estimatedProfit: estProfit,
                    margin: 60,
                },
                generatedAt: new Date().toISOString(),
            }
        };
    },
};
