import { useStore } from '../context/StoreContext';

/**
 * Hook to access authentication state and actions.
 */
export function useAuth() {
    const { currentUser, login, logout } = useStore();
    return { currentUser, login, logout };
}
