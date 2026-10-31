import { apiFetch, getCachedApiResponse } from '../services/apiClient';

export const dashboardApi = {
    /** GET summary metrics for the dashboard (today, 1week, 1month) */
    getSummary: (period = 'today', date, timezoneOffset) => {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (date) params.append('date', date);
        if (timezoneOffset !== undefined) params.append('timezoneOffset', timezoneOffset);
        const qs = params.toString();
        return apiFetch(`dashboard/summary${qs ? `?${qs}` : ''}`, 'GET');
    },

    /** GET today's summary metrics for the dashboard */
    getTodaySummary: (date, timezoneOffset) => {
        return dashboardApi.getSummary('today', date, timezoneOffset);
    },

    /** GET sales report with product performance and packing history */
    getSalesReport: (period = '1month', date, timezoneOffset) => {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (date) params.append('date', date);
        if (timezoneOffset !== undefined) params.append('timezoneOffset', timezoneOffset);
        const qs = params.toString();
        return apiFetch(`dashboard/sales-report${qs ? `?${qs}` : ''}`, 'GET');
    },

    /** GET top-selling products for a dashboard period */
    getTopSellingProducts: (period = 'today', date, timezoneOffset) => {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (date) params.append('date', date);
        if (timezoneOffset !== undefined) params.append('timezoneOffset', timezoneOffset);
        const qs = params.toString();
        return apiFetch(`dashboard/top-selling${qs ? `?${qs}` : ''}`, 'GET');
    },

    getCachedTopSellingProducts: (period = 'today', date, timezoneOffset) => {
        const params = new URLSearchParams();
        if (period) params.append('period', period);
        if (date) params.append('date', date);
        if (timezoneOffset !== undefined) params.append('timezoneOffset', timezoneOffset);
        const qs = params.toString();
        return getCachedApiResponse(`dashboard/top-selling${qs ? `?${qs}` : ''}`, 'GET');
    },

    /** GET recent orders for the dashboard summary */
    getRecentOrders: (pageNumber = 1, pageSize = 10) =>
        apiFetch('orders', 'POST', { pageNumber, pageSize }),
};
