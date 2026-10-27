import { apiFetch } from '../services/apiClient';

// In-memory cache for common enum types
const typesCache = new Map();

export const commonApi = {
    /**
     * GET enum types from backend (e.g. 'SupplierType', 'StockStatus', 'PaymentStatus', 'CustomerType')
     * Endpoint: GET /api/common/type/{typeClass}
     * Returns: { items: string[] }
     * Cached permanently in-memory so enum types are only fetched once.
     */
    getTypes: (typeClass) => {
        if (!typesCache.has(typeClass)) {
            const fetchPromise = apiFetch(`common/type/${typeClass}`).catch((err) => {
                typesCache.delete(typeClass); // Evict on error so retry is possible
                throw err;
            });
            typesCache.set(typeClass, fetchPromise);
        }
        return typesCache.get(typeClass);
    },

    /** Evict a specific typeClass or all types from cache if manual refresh is needed */
    clearTypesCache: (typeClass) => {
        if (typeClass) {
            typesCache.delete(typeClass);
        } else {
            typesCache.clear();
        }
    },
    
    /** POST upload attachment file to server */
    uploadAttachment: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('common/upload', 'POST', formData);
    }
};
