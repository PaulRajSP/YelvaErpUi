import { apiFetch } from '../services/apiClient';

export const accountApi = {
    /** GET paginated transactions */
    getTransactions: (pageNumber = 1, pageSize = 10) =>
        apiFetch('transactions', 'POST', { pagination: { pageNumber, pageSize } }),

    /** POST create a new transaction */
    createTransaction: (txn) =>
        apiFetch('transactions/create', 'POST', txn),
};
