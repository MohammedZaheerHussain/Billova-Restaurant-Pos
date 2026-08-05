import api from './client';

export const reportsAPI = {
    dailySales: (date?: string) => api.get('/reports/daily-sales', { params: { date } }),
    itemSales: (startDate?: string, endDate?: string) =>
        api.get('/reports/item-sales', { params: { startDate, endDate } }),
    categorySales: (startDate?: string, endDate?: string) =>
        api.get('/reports/category-sales', { params: { startDate, endDate } }),
    hourlySales: () => api.get('/reports/hourly-sales'),
    weeklySummary: () => api.get('/reports/weekly-summary'),
    monthlySummary: () => api.get('/reports/monthly-summary'),
    salesTrend: (days?: number) => api.get('/reports/sales-trend', { params: { days } }),
};

export const dashboardAPI = {
    ownerSummary: () => api.get('/dashboard/owner-summary'),
};
