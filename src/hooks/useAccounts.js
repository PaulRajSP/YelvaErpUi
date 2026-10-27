import { useStore } from '../context/StoreContext';

/**
 * Hook to access transaction/accounts state and actions.
 */
export function useAccounts() {
    const { transactions, walletBalance, addTransaction, loadTransactions } = useStore();
    return { transactions, walletBalance, addTransaction, loadTransactions };
}
