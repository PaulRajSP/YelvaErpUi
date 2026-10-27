import { apiFetch } from '../services/apiClient';
import { PAGE_SIZE, formatFilterDateToUTC } from '../common/utils';

export const orderApi = {
    /** GET paginated order list with optional filters */
    getOrders: (pageNumber = 1, pageSize = PAGE_SIZE, filters = {}) =>
        apiFetch('orders/list', 'POST', {
            pagination: { pageNumber, pageSize },
            fromDate: formatFilterDateToUTC(filters.fromDate, false),
            toDate: formatFilterDateToUTC(filters.toDate, true),
            status: filters.status && filters.status !== 'All' ? filters.status : null,
            paymentStatus: filters.paymentStatus && filters.paymentStatus !== 'All' ? filters.paymentStatus : null,
            searchKeyword: filters.searchKeyword || null
        }),

    /** GET full order details by orderNumber (and optional orderEdid) */
    getOrderDetail: (orderNumber, orderEdid) =>
        apiFetch(orderEdid && orderEdid !== orderNumber ? `orders/${orderNumber}/${orderEdid}` : `orders/${encodeURIComponent((orderNumber || '').trim())}/details`),

    /** GET order details by orderNumber only */
    getOrderByNumber: (orderNumber) =>
        apiFetch(`orders/${encodeURIComponent(orderNumber.trim())}/details`),

    /** GET single order by id */
    getOrderById: (orderId) =>
        apiFetch(`orders/${orderId}`),

    /** GET items for a specific order */
    getOrderItems: (orderId) =>
        apiFetch(`orders/${orderId}/items`),

    /** POST create a new order */
    createOrder: (payload) =>
        apiFetch('orders/create', 'POST', payload),

    /** PATCH update order status */
    updateStatus: (orderId, payload) =>
        apiFetch(`orders/${orderId}/status`, 'PATCH', typeof payload === 'string' ? { status: payload } : payload),

    /** GET separate status tracking history */
    getOrderTracking: (orderNumber, orderEdid = null) =>
        apiFetch(orderEdid ? `orders/${encodeURIComponent((orderNumber || '').trim())}/tracking?orderEdid=${encodeURIComponent(orderEdid)}` : `orders/${encodeURIComponent((orderNumber || '').trim())}/tracking`),

    /** GET comments for a specific order */
    getOrderComments: (orderEdid) =>
        apiFetch(`orders/${encodeURIComponent((orderEdid || '').trim())}/comments`),

    /** POST add comment to an order */
    addOrderComment: (orderEdid, payload) =>
        apiFetch(`orders/${encodeURIComponent((orderEdid || '').trim())}/comments/add`, 'POST', payload),

    /** PATCH update payment status */
    updatePaymentStatus: (orderId, paymentStatus) =>
        apiFetch(`orders/${orderId}/payment-status`, 'PATCH', paymentStatus),

    /** POST record a payment for an order */
    recordPayment: (orderEdid, payload) =>
        apiFetch(`orders/${orderEdid}/payments`, 'POST', payload),

    /** GET all payments for an order */
    getOrderPayments: (orderEdid) =>
        apiFetch(`orders/${orderEdid}/payments`),

    /** DELETE a specific order payment */
    deletePayment: (paymentEdid) =>
        apiFetch(`orders/payments/${paymentEdid}`, 'DELETE'),

    /** POST confirm order and generate physical bottle records in OrderProductItem */
    confirmOrder: (orderEdid) =>
        apiFetch(`orders/${orderEdid}/confirm`, 'POST'),

    /** GET packing details for an order by order number only */
    getPackingDetails: (orderNumber) =>
        apiFetch(`orders/${encodeURIComponent(orderNumber.trim())}/packing`),

    /** GET all available raw materials from category Packaging with optional searchKeyword (no pagination needed) */
    getPackingMaterials: (searchKeyword = null) =>
        apiFetch(`raw-materials/packing-materials${searchKeyword ? `?searchKeyword=${encodeURIComponent(searchKeyword.trim())}` : ''}`),

    /** GET physical bottle list for an order by order number only */
    getOrderBottles: (orderNumber) =>
        apiFetch(`orders/${encodeURIComponent(orderNumber.trim())}/bottles`),

    /** POST confirm packing and mark Ready To Ship */
    confirmPacking: (payload) =>
        apiFetch('orders/packing/confirm', 'POST', payload),

    /** POST dispatch order and mark Shipped */
    dispatchOrder: (payload) =>
        apiFetch(`orders/logistics/dispatch/${encodeURIComponent(payload?.orderEdid || '')}`, 'POST', payload),

    /** POST all orders in Ready To Ship status with dynamic pagination and filters */
    getReadyToShipOrders: (pageNumber = 1, pageSize = PAGE_SIZE, filters = {}) =>
        apiFetch('orders/logistics/ready-to-ship', 'POST', {
            pagination: { pageNumber, pageSize },
            fromDate: formatFilterDateToUTC(filters.fromDate, false),
            toDate: formatFilterDateToUTC(filters.toDate, true),
            searchKeyword: filters.searchKeyword || null
        }),
};



