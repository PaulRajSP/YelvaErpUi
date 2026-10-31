import { apiFetch } from '../services/apiClient';
import { PAGE_SIZE, formatFilterDateToUTC } from '../common/utils';

export const purchaseApi = {
    /** GET paginated purchases */
    getPurchases: (pageNumber = 1, pageSize = PAGE_SIZE, status = null, fromDate = null, toDate = null, searchKeyword = null, publicId = null) =>
        apiFetch('purchases/list', 'POST', {
            pageNumber,
            pageSize,
            status,
            fromDate: formatFilterDateToUTC(fromDate, false),
            toDate: formatFilterDateToUTC(toDate, true),
            searchKeyword,
            publicId
        }),

    /** POST paginated purchases for a supplier */
    getPurchasesBySupplier: (supplierEdid, pageNumber = 1, pageSize = PAGE_SIZE, fromDate = null, toDate = null, publicId = null, paymentStatus = null) =>
        apiFetch('purchases/supplier', 'POST', {
            supplierEdid,
            pageNumber,
            pageSize,
            fromDate: formatFilterDateToUTC(fromDate, false),
            toDate: formatFilterDateToUTC(toDate, true),
            publicId,
            paymentStatus
        }),

    /** POST create a purchase */
    createPurchase: (data) =>
        apiFetch('purchases/create', 'POST', data),

    /** GET a single purchase by id */
    getPurchaseById: (purchaseId) =>
        apiFetch(`purchases/${purchaseId}`),

    /** POST pay purchase due */
    payPurchaseDue: (data) =>
        apiFetch('purchases/pay-due', 'POST', data),

    /** POST line items for a purchase */
    getPurchaseItems: (purchaseEdid, pageNumber = 1, pageSize = PAGE_SIZE) =>
        apiFetch('purchases/items', 'POST', { purchaseEdid, pageNumber, pageSize }),

    /** GET batches for a raw material */
    getBatchesForMaterial: (materialEdid, batchNumber = null, unitCost = null, supplierEdid = null) => {
        const query = new URLSearchParams();
        if (batchNumber) query.set('batchNumber', batchNumber);
        if (unitCost !== null && unitCost !== undefined) query.set('unitCost', unitCost);
        if (supplierEdid) query.set('supplierEdid', supplierEdid);
        const queryString = query.toString();
        return apiFetch(`batches/material/${materialEdid}${queryString ? `?${queryString}` : ''}`);
    },

    /** GET batch by id */
    getBatchById: (batchEdid) =>
        apiFetch(`batches/${batchEdid}`),

    adjustMaterialBatch: (batchEdid, adjustment) =>
        apiFetch(`batches/${batchEdid}/adjustment`, 'PATCH', adjustment),

    closeMaterialBatch: (batchEdid) =>
        apiFetch(`batches/${batchEdid}/close`, 'PATCH'),

    /** POST paginated raw materials */
    getRawMaterials: (pageNumber = 1, pageSize = PAGE_SIZE, searchKeyword = null, category = null, status = null) =>
        apiFetch('raw-materials/list', 'POST', {
            pagination: { pageNumber, pageSize },
            pagenation: { pageNumber, pageSize },
            pageNumber,
            pageSize,
            searchKeyword,
            category,
            status
        }),

    /** GET a single raw material by id */
    getRawMaterialById: (id) =>
        apiFetch(`raw-materials/${id}`),

    /** POST paginated purchase history for a raw material */
    getMaterialPurchaseHistory: (id, pageNumber = 1, pageSize = PAGE_SIZE) =>
        apiFetch(`raw-materials/${id}/purchase-history`, 'POST', { pageNumber, pageSize }),

    /** POST paginated batch list for a raw material */
    getMaterialBatchList: (materialEdid, pageNumber = 1, pageSize = 50, search = '') =>
        apiFetch(`raw-materials/${materialEdid}/batch-list`, 'POST', {
            search,
            pagination: { pageNumber, pageSize }
        }),

    /** POST usage history for a raw material and batch */
    getMaterialUsageHistory: (materialEdid, batchEdid) => {
        return apiFetch(`raw-materials/${materialEdid}/usage-history/${batchEdid}`, 'POST');
    },
    /** GET paginated suppliers */
    getSuppliers: (pageNumber = 1, pageSize = PAGE_SIZE, contactName = null, supplierType = null, name = null) =>
        apiFetch('suppliers/list', 'POST', { pageNumber, pageSize, contactName, supplierType, name }),

    /** GET a single supplier by id */
    getSupplierById: (supplierId) =>
        apiFetch(`suppliers/${supplierId}`),

    /** POST create or update a supplier */
    saveSupplier: (supplier) =>
        apiFetch('suppliers', 'POST', supplier),

    /** GET enum types (like SupplierType, CustomerType) */
    getTypes: (typeName) =>
        apiFetch(`common/type/${typeName}`),

    /** POST raw material categories */
    getCategories: (name = "") =>
        apiFetch('raw-materials/category/list', 'POST', { pageNumber: 1, pageSize: PAGE_SIZE, name }),

    /** POST create a raw material category */
    addCategory: (name, allowedUnitEdid) =>
        apiFetch('raw-materials/category/add', 'POST', { name, allowedUnitEdid }),

    /** POST create a raw material */
    addRawMaterial: (material) =>
        apiFetch('raw-materials', 'POST', material),

    /** POST fetch units */
    getUnits: () =>
        apiFetch('units/list', 'POST')
};
