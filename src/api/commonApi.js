import { apiFetch } from '../services/apiClient';

// In-memory cache for common enum types
const typesCache = new Map();

// Azure backend endpoint for file upload
export const AZURE_UPLOAD_URL = 'https://honeyerpapi-ecfag7bahrdhdxf6.southindia-01.azurewebsites.net/api/common/upload';

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

    getShelfLifeOptions: async () => {
        const response = await commonApi.getTypes('ShelfLifeMonths');
        const months = response?.items || response?.Items || [];
        return months.map(value => ({
            value: String(value),
            label: `${value} months`
        }));
    },

    /** Evict a specific typeClass or all types from cache if manual refresh is needed */
    clearTypesCache: (typeClass) => {
        if (typeClass) {
            typesCache.delete(typeClass);
        } else {
            typesCache.clear();
        }
    },

    /**
     * POST upload attachment file to Azure server
     * Calls Azure API for uploading only
     */
    uploadAttachment: async (file) => {
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);
        return apiFetch(AZURE_UPLOAD_URL, 'POST', formData);
    },

    /**
     * GET module attachments
     * Endpoint: GET /api/common/module-attachment?ModuleName={ModuleName}&RecordEdid={RecordEdid}
     * Query Parameters:
     * - ModuleName (string)
     * - RecordEdid (string)
     * Returns: { items: [{ attachmentEdid, attachmentOriginalName, attachmentType }] }
     */
    getModuleAttachment: async (moduleNameOrReq, recordEdid) => {
        let moduleName = moduleNameOrReq;
        let edid = recordEdid;
        if (typeof moduleNameOrReq === 'object' && moduleNameOrReq !== null) {
            moduleName = moduleNameOrReq.moduleName || moduleNameOrReq.ModuleName;
            edid = moduleNameOrReq.recordEdid || moduleNameOrReq.RecordEdid;
        }
        const params = new URLSearchParams();
        if (moduleName) params.append('ModuleName', moduleName);
        if (edid) params.append('RecordEdid', edid);
        const qs = params.toString() ? `?${params.toString()}` : '';
        return apiFetch(`common/module-attachment${qs}`);
    },

    /**
     * Alias for getModuleAttachment
     */
    getModuleAttachments: async (moduleNameOrReq, recordEdid) => {
        return commonApi.getModuleAttachment(moduleNameOrReq, recordEdid);
    }
};
