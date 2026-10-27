import { useStore } from '../context/StoreContext';

/**
 * Hook to access purchase state and actions.
 */
export function usePurchases() {
    const { purchases, setPurchases, suppliers, loadPurchases, loadSuppliers } = useStore();
    return { purchases, setPurchases, suppliers, loadPurchases, loadSuppliers };
}
