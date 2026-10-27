import { useStore } from '../context/StoreContext';

/**
 * Hook to access product state and actions.
 */
export function useProducts() {
    const { products, setProducts, loadProducts } = useStore();
    return { products, setProducts, loadProducts };
}
