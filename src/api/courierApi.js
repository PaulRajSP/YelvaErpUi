import { apiFetch } from '../services/apiClient';

export const courierApi = {
    /**
     * Get list of couriers from backend CourierMaster
     * POST /api/couriers/list
     *
     * Request body:
     * {
     *   "onlyActive": true,
     *   "isActive": true,
     *   "searchText": "",
     *   "paginationRequest": {
     *     "pageNumber": 1,
     *     "pageSize": 10
     *   }
     * }
     * Omit isActive to use the legacy onlyActive behavior (false returns all couriers).
     */
    getCouriers: async ({ onlyActive = true, isActive, searchText = '', pageNumber = 1, pageSize = 10 } = {}) => {
        const payload = {
            onlyActive: Boolean(onlyActive),
            searchText: searchText ? String(searchText).trim() : '',
            paginationRequest: {
                pageNumber: Number(pageNumber) || 1,
                pageSize: Number(pageSize) || 10
            },
        };
        if (isActive !== undefined) payload.isActive = Boolean(isActive);
        return apiFetch('couriers/list', 'POST', payload);
    },

    /**
     * Get single courier details by Edid and CourierName
     * GET /api/couriers/{Edid}/{CourierName}
     */
    getCourier: async (edid, courierName = '') => {
        if (!edid) throw new Error('Courier edid is required');
        const encodedEdid = encodeURIComponent(edid);
        if (courierName) {
            return apiFetch(`couriers/${encodedEdid}/${encodeURIComponent(courierName)}`);
        }
        return apiFetch(`couriers/${encodedEdid}`);
    },

    /**
     * Alias for backward compatibility
     */
    getCourierById: async (edid, courierName = '') => {
        return courierApi.getCourier(edid, courierName);
    },

    /**
     * Add a new courier to CourierMaster
     * POST /api/couriers
     *
     * Request body:
     * {
     *   "name": "string",
     *   "contactPerson": "string",
     *   "mobile": "string",
     *   "email": "string",
     *   "address": "string",
     *   "attachmentData": { ... },
     *   "metadata": [ { "courierMasterId": 0, "label": "string", "value": "string", "showInSlip": true } ]
     * }
     */
    addCourier: async (data) => {
        return apiFetch('couriers', 'POST', data);
    },

    /**
     * Update courier in CourierMaster
     * PUT /api/couriers/{Edid}/{CourierName}
     *
     * Request body:
     * {
     *   "edid": "string",
     *   "name": "string",
     *   "contactPerson": "string",
     *   "mobile": "string",
     *   "email": "string",
     *   "address": "string",
     *   "isActive": true,
     *   "attachmentData": { ... },
     *   "metadata": [ { "courierMasterId": 0, "label": "string", "value": "string", "showInSlip": true } ]
     * }
     */
    updateCourier: async (edid, courierNameOrData, maybeData) => {
        if (!edid) throw new Error('Courier edid is required for update');

        let courierName = '';
        let payload = null;

        if (maybeData !== undefined) {
            courierName = courierNameOrData || '';
            payload = maybeData;
        } else if (typeof courierNameOrData === 'object' && courierNameOrData !== null) {
            payload = courierNameOrData;
            courierName = payload.name || '';
        } else {
            courierName = courierNameOrData || '';
            payload = {};
        }

        const encodedEdid = encodeURIComponent(edid);
        const nameToUse = courierName || payload.name || '';
        const endpoint = nameToUse
            ? `couriers/${encodedEdid}/${encodeURIComponent(nameToUse)}`
            : `couriers/${encodedEdid}`;

        return apiFetch(endpoint, 'PUT', payload);
    }
};
