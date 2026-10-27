import { apiFetch } from '../services/apiClient';
import { PAGE_SIZE, formatFilterDateToUTC } from '../common/utils';

export const expenseApi = {
    /** POST get paginated expense list with filters */
    getExpenses: (pageNumber = 1, pageSize = PAGE_SIZE, filters = {}) => {
        const payload = {
            pagination: { pageNumber, pageSize },
            fromDate: formatFilterDateToUTC(filters.fromDate, false),
            toDate: formatFilterDateToUTC(filters.toDate, true),
            category: filters.category && filters.category !== 'All' ? filters.category : null,
            status: filters.status && filters.status !== 'All' ? filters.status : null,
            paymentMode: filters.paymentMode && filters.paymentMode !== 'All' ? filters.paymentMode : null,
            searchKeyword: filters.searchKeyword?.trim() || null
        };
        return apiFetch('expenses/list', 'POST', payload);
    },

    /** GET expense summary aggregates */
    getExpenseSummary: (filters = {}) => {
        const params = new URLSearchParams();
        const fromDate = formatFilterDateToUTC(filters.fromDate, false);
        const toDate = formatFilterDateToUTC(filters.toDate, true);
        if (fromDate) params.append('fromDate', fromDate);
        if (toDate) params.append('toDate', toDate);

        const qs = params.toString();
        return apiFetch(qs ? `expenses/summary?${qs}` : 'expenses/summary');
    },

    /** GET single expense by edid */
    getExpenseById: (edid) =>
        apiFetch(`expenses/${encodeURIComponent(edid)}`),

    /** POST create new expense */
    createExpense: (payload) =>
        apiFetch('expenses', 'POST', payload),

    /** PUT update existing expense */
    updateExpense: (edid, payload) =>
        apiFetch(`expenses/${encodeURIComponent(edid)}`, 'PUT', payload),

    /** DELETE expense by edid */
    deleteExpense: (edid) =>
        apiFetch(`expenses/${encodeURIComponent(edid)}`, 'DELETE')
};
