import { apiFetch } from '../services/apiClient';

export const authApi = {
    /**
     * Authenticate employee with employeeCode & password.
     * Uses localStorage for JWT (no cookies).
     */
    login: (credentials) => apiFetch('auth/login', 'POST', credentials),

    /**
     * Fetch current employee profile using stored token
     */
    getMe: () => apiFetch('auth/me'),

    /**
     * Fetch authorized navigation menus for current employee
     */
    getMenus: () => apiFetch('auth/menus'),
};
