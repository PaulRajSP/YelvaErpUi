export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://honeyerpapi-ecfag7bahrdhdxf6.southindia-01.azurewebsites.net/api').replace(/\/+$/, '');

// Map of in-flight read requests to prevent duplicate concurrent API calls
const inFlightRequests = new Map();
const responseCache = new Map();
const API_CACHE_PREFIX = 'yelva_api_cache:';
let apiRequestSequence = 0;

export const TOKEN_KEY = 'yelva_auth_token';
export const USER_KEY = 'yelva_user';
export const PERMISSIONS_KEY = 'yelva_permissions';
export const MENUS_KEY = 'yelva_menus';

export function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
    if (token) {
        if (localStorage.getItem(TOKEN_KEY) !== token) {
            clearApiCache();
        }
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
        clearApiCache();
    }
}

export function clearStoredAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(MENUS_KEY);
    clearApiCache();
}

function getApiCacheScope() {
    const token = getStoredToken();
    if (!token) return 'anonymous';

    try {
        const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        const userId = user?.edid || user?.id || user?.email;
        if (userId) return String(userId);
    } catch {
        // Fall back to the active token when user data is not available yet.
    }

    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    return `token-${Math.abs(hash)}`;
}

function getCacheKey(method, endpoint, body) {
    return `${getApiCacheScope()}:${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
}

function isCacheableRead(method, endpoint) {
    if (method === 'GET') return true;
    if (method !== 'POST') return false;

    const path = endpoint.split('?')[0];
    return path.endsWith('/list') ||
        path.includes('customers/order') ||
        path === 'orders' ||
        path === 'transactions' ||
        path === 'products/customer-products' ||
        path.endsWith('/price-history') ||
        path.endsWith('/used-in-combos') ||
        path.includes('/purchase-history') ||
        path === 'purchases/supplier' ||
        path === 'purchases/items' ||
        path === 'orders/logistics/ready-to-ship';
}

function readCachedResponse(cacheKey) {
    if (responseCache.has(cacheKey)) return responseCache.get(cacheKey);

    try {
        const cached = sessionStorage.getItem(`${API_CACHE_PREFIX}${cacheKey}`);
        if (!cached) return null;
        const entry = JSON.parse(cached);
        responseCache.set(cacheKey, entry);
        return entry;
    } catch (error) {
        console.warn('[apiFetch] Unable to read cached API response:', error);
        return null;
    }
}

function replaceCachedValue(previous, next) {
    if (Array.isArray(previous) && Array.isArray(next)) {
        const updated = next.map((value, index) => {
            const oldValue = previous[index];
            if (oldValue && value && typeof oldValue === 'object' && typeof value === 'object') {
                return replaceCachedValue(oldValue, value);
            }
            return value;
        });
        previous.length = 0;
        updated.forEach(value => previous.push(value));
        return previous;
    }

    if (
        previous && next &&
        typeof previous === 'object' && typeof next === 'object' &&
        !Array.isArray(previous) && !Array.isArray(next)
    ) {
        Object.keys(previous).forEach(key => {
            if (!(key in next)) delete previous[key];
        });
        Object.entries(next).forEach(([key, value]) => {
            const oldValue = previous[key];
            if (oldValue && value && typeof oldValue === 'object' && typeof value === 'object') {
                previous[key] = replaceCachedValue(oldValue, value);
            } else {
                previous[key] = value;
            }
        });
        return previous;
    }

    return next;
}

function writeCachedResponse(cacheKey, data, method, endpoint, body) {
    const previousEntry = readCachedResponse(cacheKey);
    const changed = !previousEntry || JSON.stringify(previousEntry.data) !== JSON.stringify(data);
    const cachedData = previousEntry
        ? replaceCachedValue(previousEntry.data, data)
        : data;
    const entry = { data: cachedData, updatedAt: Date.now() };
    responseCache.set(cacheKey, entry);

    try {
        sessionStorage.setItem(`${API_CACHE_PREFIX}${cacheKey}`, JSON.stringify(entry));
    } catch (error) {
        console.warn('[apiFetch] Unable to persist cached API response:', error);
    }

    if (changed && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api:cache-updated', {
            detail: { cacheKey, method, endpoint, body, data: cachedData }
        }));
    }

    return entry;
}

export function getCachedApiResponse(endpoint, method = 'GET', body = null) {
    const upperMethod = method.toUpperCase();
    if (!isCacheableRead(upperMethod, endpoint)) return null;
    return readCachedResponse(getCacheKey(upperMethod, endpoint, body))?.data ?? null;
}

function clearApiCache() {
    responseCache.clear();
    if (typeof sessionStorage === 'undefined') return;

    try {
        Object.keys(sessionStorage)
            .filter(key => key.startsWith(API_CACHE_PREFIX))
            .forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
        console.warn('[apiFetch] Unable to clear cached API responses:', error);
    }
}

/**
 * Internal fetch wrapper that unwraps the ApiResponseModel { success, message, data }
 * envelope returned by the .NET backend.
 * Uses localStorage for authentication tokens (no cookies).
 *
 * @param {string} endpoint  - relative endpoint, e.g. 'auth/login' or 'couriers/list'
 * @param {string} method    - HTTP method (default: 'GET')
 * @param {object|null} body - request body (will be JSON-serialised)
 * @returns {Promise<any>}   - the `data` field of the response, or throws on error
 */
export async function apiFetch(endpoint, method = 'GET', body = null) {
    const upperMethod = method.toUpperCase();
    const isExternal = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    const isRead = isCacheableRead(upperMethod, endpoint);
    const cacheKey = isRead && !isExternal ? getCacheKey(upperMethod, endpoint, body) : null;
    const cachedEntry = cacheKey ? readCachedResponse(cacheKey) : null;
    const reqKey = cacheKey;

    if (reqKey && inFlightRequests.has(reqKey)) {
        if (cachedEntry) return cachedEntry.data;
        return inFlightRequests.get(reqKey);
    }

    const requestId = cacheKey && !cachedEntry ? ++apiRequestSequence : null;
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
            if (requestId !== null && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:request-start', { detail: { requestId } }));
            }
            const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
                ? endpoint
                : `${API_BASE}/${endpoint.replace(/^\/+/, '')}`;
            const res = await fetch(url, options);

            // Handle unauthorized response (only clear local auth for local API calls, not external upload)
            if (res.status === 401) {
                const isExternal = endpoint.startsWith('http://') || endpoint.startsWith('https://');
                if (!isExternal) {
                    console.warn(`[apiFetch] 401 Unauthorized for ${endpoint}. Clearing local storage.`);
                    clearStoredAuth();
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    }
                }
                throw new Error('Session expired or unauthorized. Please log in again.');
            }

            if (!res.ok) {
                let errMessage = `HTTP ${res.status} on ${endpoint}`;
                try {
                    const errJson = await res.json();
                    if (errJson?.message) {
                        errMessage = errJson.message;
                    } else if (errJson?.errors && typeof errJson.errors === 'object') {
                        const errorList = Object.values(errJson.errors).flat().filter(Boolean);
                        if (errorList.length > 0) {
                            errMessage = errorList.join(' ');
                        } else if (errJson?.title) {
                            errMessage = errJson.title;
                        }
                    } else if (errJson?.title) {
                        errMessage = errJson.title;
                    }
                } catch {
                    // Ignore json parse error on non-json error responses
                }
                throw new Error(errMessage);
            }

            const result = await res.json();
            let data = result;
            if (result && typeof result === 'object' && 'success' in result) {
                if (!result.success) throw new Error(result?.message || 'Unknown API Error');
                data = result.data;
            }
            if (cacheKey) return writeCachedResponse(cacheKey, data, upperMethod, endpoint, body).data;
            return data;
        } catch (err) {
            console.error(`API Error [${upperMethod}] ${endpoint}:`, err);
            throw err;
        } finally {
            if (reqKey) {
                inFlightRequests.delete(reqKey);
            }
            if (requestId !== null && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:request-end', { detail: { requestId } }));
            }
        }
    })();

    if (reqKey) {
        inFlightRequests.set(reqKey, fetchPromise);
    }

    if (cachedEntry) {
        fetchPromise.catch(() => {});
        return cachedEntry.data;
    }

    return fetchPromise;
}
