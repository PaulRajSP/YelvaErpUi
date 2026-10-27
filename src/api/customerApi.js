import { apiFetch } from '../services/apiClient';

export const customerApi = {
    /** GET paginated customer list (mobile is optional search filter) */
    getCustomers: (pageNumber = 1, pageSize = 10, mobile = null) =>
        apiFetch('customers/list', 'POST', { pagination: { pageNumber, pageSize }, mobile: mobile || null }),

    /** GET single customer by edid and mobileNumber */
    getCustomer: (edid, mobileNumber) => {
        return apiFetch(`customers/${edid}/${mobileNumber}`);
    },

    /** GET single customer by edid */
    getCustomerByEdid: (edid) =>
        apiFetch(`customers/${edid}`),

    /** GET all addresses for a customer */
    getAddresses: (customerEdid) =>
        apiFetch(`customers/${customerEdid}/addresses`),

    /** GET single address */
    getAddress: (customerEdid, addressEdid) =>
        apiFetch(`customers/${customerEdid}/addresses/${addressEdid}`),

    /** POST create or update a customer */
    saveCustomer: (customer) =>
        apiFetch('customers', 'POST', customer),

    /** POST create or update an address */
    saveAddress: (customerEdid, edid, address) =>
        apiFetch(`customers/${customerEdid}/${edid}/addresses/save`, 'POST', address),

    /** GET customer by mobile number */
    getCustomerByMobile: (mobile) =>
        apiFetch(`customers/mobile/${mobile}`),

    /** POST paginated customer orders */
    getCustomerOrders: (customerEdid, mobileNumber, payload) =>
        apiFetch(`customers/order/${customerEdid}/${mobileNumber}`, 'POST', payload),
};
