export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://honeyerpapi-ecfag7bahrdhdxf6.southindia-01.azurewebsites.net/api').replace(/\/+$/, '');

// Map of in-flight read requests to prevent duplicate concurrent API calls
const inFlightRequests = new Map();

export const TOKEN_KEY = 'yelva_auth_token';
export const USER_KEY = 'yelva_user';
export const PERMISSIONS_KEY = 'yelva_permissions';
export const MENUS_KEY = 'yelva_menus';

export function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function clearStoredAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(MENUS_KEY);
}

/**
 * Internal fetch wrapper that unwraps the ApiResponseModel { success, message, data }
 * envelope returned by the .NET backend.
 * Uses localStorage for authentication tokens (no cookies).
 *
 * @param {string} endpoint  - relative endpoint, e.g. 'auth/login' or 'employees/list'
 * @param {string} method    - HTTP method (default: 'GET')
 * @param {object|null} body - request body (will be JSON-serialised)
 * @returns {Promise<any>}   - the `data` field of the response, or throws on error
 */
export async function apiFetch(endpoint, method = 'GET', body = null) {
    const upperMethod = method.toUpperCase();
    const isRead = upperMethod === 'GET' || (upperMethod === 'POST' && (endpoint.endsWith('/list') || endpoint.includes('list') || endpoint.includes('customers/order')));
    const reqKey = isRead ? `${upperMethod}:${endpoint}:${body ? JSON.stringify(body) : ''}` : null;

    if (reqKey && inFlightRequests.has(reqKey)) {
        return inFlightRequests.get(reqKey);
    }

    const fetchPromise = (async () => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

        // Read JWT Bearer token from localStorage
        const token = getStoredToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method: upperMethod,
            headers: headers,
        };
        if (body !== null) options.body = isFormData ? body : JSON.stringify(body);

        try {
            const res = await fetch(`${API_BASE}/${endpoint}`, options);

            // Handle unauthorized response
            if (res.status === 401) {
                console.warn(`[apiFetch] 401 Unauthorized for ${endpoint}. Clearing local storage.`);
                clearStoredAuth();
                // Dispatch event so app/context can react if needed
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                throw new Error('Session expired or unauthorized. Please log in again.');
            }

            if (!res.ok) {
                let errMessage = `HTTP ${res.status} on ${endpoint}`;
                try {
                    const errJson = await res.json();
                    if (errJson?.message) errMessage = errJson.message;
                } catch {
                    // Ignore json parse error on non-json error responses
                }
                throw new Error(errMessage);
            }

            const result = await res.json();
            if (result && typeof result === 'object' && 'success' in result) {
                if (result.success) return result.data;
                throw new Error(result?.message || 'Unknown API Error');
            }
            return result;
        } catch (err) {
            console.error(`API Error [${upperMethod}] ${endpoint}:`, err);
            throw err;
        } finally {
            if (reqKey) {
                inFlightRequests.delete(reqKey);
            }
        }
    })();

    if (reqKey) {
        inFlightRequests.set(reqKey, fetchPromise);
    }

    return fetchPromise;
}
