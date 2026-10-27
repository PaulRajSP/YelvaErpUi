import { apiFetch } from '../services/apiClient';

export const courierApi = {
    /**
     * Get list of couriers from backend CourierMaster
     * POST /api/couriers/list
     */
    getCouriers: async ({ onlyActive = true, searchText = null, pageNumber = 1, pageSize = 500 } = {}) => {
        const payload = {
            onlyActive: Boolean(onlyActive),
            searchText: searchText ? String(searchText).trim() : null,
            paginationRequest: { pageNumber, pageSize },
        };
        return apiFetch('couriers/list', 'POST', payload);
    },

    /**
     * Get single courier details with dynamic metadata
     * GET /api/couriers/:id
     */
    getCourierById: async (id) => {
        return apiFetch(`couriers/${id}`);
    },

    /**
     * Add a new courier to CourierMaster
     * POST /api/couriers
     */
    addCourier: async (data) => {
        return apiFetch('couriers', 'POST', data);
    },

    /**
     * Update courier in CourierMaster
     * PUT /api/couriers/:id
     */
    updateCourier: async (id, data) => {
        return apiFetch(`couriers/${id || ''}`, 'PUT', data);
    }
};
