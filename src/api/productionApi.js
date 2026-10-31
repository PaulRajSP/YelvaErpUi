import { apiFetch } from '../services/apiClient';
import { PAGE_SIZE, formatFilterDateToUTC } from '../common/utils';

export const productionApi = {
    /** POST paginated production requests list */
    getRequests: (pageNumber = 1, pageSize = PAGE_SIZE, filters = {}) =>
        apiFetch('production-requests/list', 'POST', {
            pagination: { pageNumber, pageSize },
            status: filters.status && filters.status !== 'All' ? filters.status : null,
            priority: filters.priority && filters.priority !== 'All' ? filters.priority : null,
            fromDate: formatFilterDateToUTC(filters.fromDate, false),
            toDate: formatFilterDateToUTC(filters.toDate, true),
            searchKeyword: filters.searchKeyword || null
        }),

    /** GET single production request by edid */
    getRequestById: (edid) =>
        apiFetch(`production-requests/${edid}`),

    /** GET raw materials recipe and available batches for a product */
    getRecipe: (productEdid) =>
        apiFetch(`production-requests/raw-materials/${productEdid}/recipe`),

    /** POST create new production request */
    createRequest: (payload) =>
        apiFetch('production-requests/create', 'POST', payload),

    /** PATCH update production request status */
    updateStatus: (edid, status, completedQty = 0.00, packedDate = null, shelfLifeMonths = null) =>
        apiFetch(`production-requests/${edid}/status`, 'PATCH', { status, completedQty, packedDate, shelfLifeMonths })
};
