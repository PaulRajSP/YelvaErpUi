import { apiFetch } from '../services/apiClient';

export const productApi = {
    /** GET paginated product list */
    getProducts: (pageNumber = 1, pageSize = 10, isCombo = null, searchKeyword = null, isActive = null) =>
        apiFetch('products/list', 'POST', { pagination: { pageNumber, pageSize }, isCombo, searchKeyword, isActive }),

    /** POST search products with customer-specific pricing (only returns products with pricing for customer type) */
    getProductsByCustomer: (customerEdid, searchKeyword = '', isCombo = null, pageNumber = 1, pageSize = 20) =>
        apiFetch('products/customer-products', 'POST', {
            customerEdid,
            searchKeyword: searchKeyword || null,
            isCombo,
            pagination: { pageNumber, pageSize }
        }),

    /** GET single product by ID */
    getProduct: (productId) =>
        apiFetch(`products/${productId}`),

    /** GET pricing tiers for a product */
    getPricing: (productId, customerType = null) => {
        const query = customerType ? `?customerType=${customerType}` : '';
        return apiFetch(`products/${productId}/pricing${query}`);
    },

    /** POST get price history for a product */
    getPriceHistory: (productId, pageNumber = 1, pageSize = 10) =>
        apiFetch(`products/${productId}/price-history`, 'POST', { productEdid: productId, pagination: { pageNumber, pageSize } }),

    /** GET combo items for a combo product */
    getComboItems: (productId) =>
        apiFetch(`products/${productId}/combo-items`),

    /** GET recipe (raw-material usage) for a product */
    getRecipe: (productId) =>
        apiFetch(`raw-materials/${productId}/recipe`),

    /** POST create or update a product */
    saveProduct: (product) =>
        apiFetch('products', 'POST', product),

    /** POST save pricing for a product */
    savePricing: (productEdid, pricingData) =>
        apiFetch(`products/${productEdid}/pricing/save`, 'POST', pricingData),

    /** POST get raw material categories — used to resolve allowedUnitEdid / allowedUnitSymbol */
    getRawMaterialCategories: (pageNumber = 1, pageSize = 10, name = null) =>
        apiFetch('raw-materials/category/list', 'POST', { pageNumber, pageSize, name }),

    /** POST toggle product status */
    toggleStatus: (productEdid, active) =>
        apiFetch(`products/${productEdid}/status`, 'POST', { active }),

    /** POST get combos using a product */
    getCombosUsingProduct: (productEdid, pageNumber = 1, pageSize = 10) =>
        apiFetch(`products/${productEdid}/used-in-combos`, 'POST', { pageNumber, pageSize }),

    /** POST save recipe for a product */
    saveRecipe: (productEdid, items) =>
        apiFetch(`raw-materials/${productEdid}/recipe/save`, 'POST', { items }),

    /** POST toggle recipe item status */
    toggleRecipeItemStatus: (productEdid, materialEdid, active) =>
        apiFetch(`raw-materials/${productEdid}/recipe/${materialEdid}/status`, 'POST', { active }),

    /** POST validate a material batch for reconciliation */
    validateMaterialBatch: (productEdid, materialEdid, batchEdid, batchNumber, newStockValue) =>
        apiFetch(`product-batches/${productEdid}/reconciliation/validate-material`, 'POST', {
            materialEdid,
            batchEdid,
            batchNumber,
            newStockValue,
        }),

    /** POST reconcile product batch (production) */
    reconcileProductBatch: (payload) =>
        apiFetch('product-batches/reconciliation', 'POST', payload),

    /** POST get product batch list */
    getProductBatchList: (productEdid, pageNumber = 1, pageSize = 10, search = '') =>
        apiFetch(`products/${productEdid}/batch-list`, 'POST', {
            pagination: { pageNumber, pageSize },
            search
        }),

    /** POST get product batch usage history */
    getProductUsageHistory: (productEdid, batchEdid, searchRemark = '') =>
        apiFetch(`products/${productEdid}/usage-history/${batchEdid}`, 'POST', { searchRemark: searchRemark || '' }),
};
