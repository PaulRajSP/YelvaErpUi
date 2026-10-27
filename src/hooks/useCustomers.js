import { useStore } from '../context/StoreContext';

/**
 * Hook to access customer state and actions.
 */
export function useCustomers() {
    const { customers, customerTotal, addresses, addCustomer, addAddress, loadCustomers } = useStore();
    return { customers, customerTotal, addresses, addCustomer, addAddress, loadCustomers };
}
