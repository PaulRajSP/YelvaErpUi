import { useStore } from '../context/StoreContext';

/**
 * Hook to access order state and actions.
 */
export function useOrders() {
    const { orders, addOrder, updateOrder, loadOrders } = useStore();
    return { orders, addOrder, updateOrder, loadOrders };
}
