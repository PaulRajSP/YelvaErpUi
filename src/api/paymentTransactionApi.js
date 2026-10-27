import { apiFetch } from '../services/apiClient';

export const paymentTransactionApi = {
    getList: (payload) => apiFetch('payment-transactions/list', 'POST', payload),
    getBalance: () => apiFetch('payment-transactions/balance', 'GET'),
    create: (payload) => apiFetch('payment-transactions/create', 'POST', payload),
};
