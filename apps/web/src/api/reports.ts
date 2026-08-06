import api from './client';
import { supabase } from '../lib/supabase';

export const reportsAPI = {
    dailySales: async (date?: string) => {
        try {
            return await api.get('/reports/daily-sales', { params: { date } });
        } catch {
            const { data } = await supabase.from('orders').select('total_amount');
            const total = (data || []).reduce((acc: number, o: any) => acc + Number(o.total_amount || 0), 0);
            return {
                data: {
                    totalSales: total,
                    totalOrders: (data || []).length,
                    averageOrderValue: data?.length ? Math.round(total / data.length) : 0,
                    hourlyBreakdown: [],
                }
            };
        }
    },
    itemSales: async (startDate?: string, endDate?: string) => {
        try { return await api.get('/reports/item-sales', { params: { startDate, endDate } }); }
        catch { return { data: [] }; }
    },
    categorySales: async (startDate?: string, endDate?: string) => {
        try { return await api.get('/reports/category-sales', { params: { startDate, endDate } }); }
        catch { return { data: [] }; }
    },
    hourlySales: async () => {
        try { return await api.get('/reports/hourly-sales'); }
        catch { return { data: [] }; }
    },
    weeklySummary: async () => {
        try { return await api.get('/reports/weekly-summary'); }
        catch { return { data: { totalSales: 0, totalOrders: 0 } }; }
    },
    monthlySummary: async () => {
        try { return await api.get('/reports/monthly-summary'); }
        catch { return { data: { totalSales: 0, totalOrders: 0 } }; }
    },
    salesTrend: async (days?: number) => {
        try { return await api.get('/reports/sales-trend', { params: { days } }); }
        catch { return { data: [] }; }
    },
};

export const dashboardAPI = {
    ownerSummary: async () => {
        try { return await api.get('/dashboard/owner-summary'); }
        catch { return { data: { totalSalesToday: 0, openOrdersCount: 0, totalCustomersCount: 0 } }; }
    },
};
