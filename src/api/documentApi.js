import { apiFetch, API_BASE } from '../services/apiClient';

export const documentApi = {
    /** GET all supported document types */
    getTypes: () => apiFetch('documents/types'),

    /** Direct URL for single document iframe preview */
    getDocumentHtmlUrl: (type, identifier) =>
        `${API_BASE}/documents/${type}/${encodeURIComponent(identifier)}/html`,

    /** Fetch raw HTML for a single document (matching D:\EMS pattern) */
    getDocumentHtml: async (type, identifier) => {
        const url = `${API_BASE}/documents/${type}/${encodeURIComponent(identifier)}/html`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to generate document: ${res.statusText}`);
        return await res.text();
    },

    /** Direct URL for viewing confirmed orders HTML directly */
    getConfirmedHtmlUrl: () =>
        `${API_BASE}/documents/confirmed`,

    /** Fetch raw HTML for all confirmed orders (matching D:\EMS pattern) */
    getConfirmedHtml: async (timestamp) => {
        const url = timestamp
            ? `${API_BASE}/documents/confirmed?_t=${timestamp}`
            : `${API_BASE}/documents/confirmed`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to generate confirmed slips: ${res.statusText}`);
        return await res.text();
    },

    /** Direct URL for downloading all documents for orders in Confirmed status */
    getConfirmedDownloadUrl: () =>
        `${API_BASE}/documents/confirmed/download`,

    /** Trigger download of all confirmed orders documents */
    downloadConfirmedDocuments: () => {
        const url = `${API_BASE}/documents/confirmed/download`;
        window.open(url, '_blank');
    }
};
