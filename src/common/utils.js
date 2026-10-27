/**
 * Safely parse a UTC timestamp from the backend and return a JavaScript Date
 * in the local browser timezone.
 *
 * Ensures strings like "2026-10-18T02:13:50" or "2026-10-18 02:13:50" (without Z)
 * are properly treated as UTC and converted to local browser time.
 */
export const parseUTCToLocalDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dateVal === 'string') {
    let s = dateVal.trim();
    if (!s) return null;

    // Convert SQL style "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss"
    if (s.includes(' ') && !s.includes('T')) {
      s = s.replace(' ', 'T');
    }

    // Check if the string already has a timezone indicator ('Z' or '+HH:MM' / '-HH:MM' / '+HHMM' / '-HHMM')
    const hasTimezone = /Z|[+-]\d{2}(:?\d{2})?$/i.test(s);
    if (!hasTimezone) {
      // Backend stores time in UTC, so treat missing timezone offset as UTC
      s = s + 'Z';
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  const fallback = new Date(dateVal);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Format a UTC date string into the user's browser local date and time.
 * E.g., "18 Oct 2026 07:43 AM"
 */
export const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const dateObj = parseUTCToLocalDate(dateVal);
  if (!dateObj) return '';
  const d = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const t = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  return `${d} ${t}`;
};

/**
 * Format a UTC date string into the user's browser local date.
 * E.g., "18 Oct 2026"
 */
export const formatDate = (dateVal) => {
  if (!dateVal) return '';
  const dateObj = parseUTCToLocalDate(dateVal);
  if (!dateObj) return '';
  return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Format a UTC date string into the user's browser local time.
 * E.g., "07:43 AM"
 */
export const formatTime = (dateVal) => {
  if (!dateVal) return '';
  const dateObj = parseUTCToLocalDate(dateVal);
  if (!dateObj) return '';
  return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
};

/**
 * Convert a user's selected browser local date into a UTC ISO string for backend filtration.
 * - Start of day (isEnd = false): local 00:00:00.000 -> UTC ISO string
 * - End of day (isEnd = true): local 23:59:59.999 -> UTC ISO string
 */
export const formatFilterDateToUTC = (d, isEnd = false) => {
  if (!d) return null;
  if (d instanceof Date) {
    return d.toISOString();
  }
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    // If it's already a full ISO string with Z, return as is
    if (trimmed.includes('T') && trimmed.endsWith('Z')) {
      return trimmed;
    }
    // Extract YYYY-MM-DD
    const datePart = trimmed.split('T')[0].split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const boundary = isEnd ? `${datePart}T23:59:59.999` : `${datePart}T00:00:00.000`;
      const dateObj = new Date(boundary);
      return isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

export const PAGE_SIZE = 10;

/**
 * Format OrderStatus enum into a user-friendly display string.
 * E.g., "OrderPlaced" -> "Order Placed", "ReadyToShip" -> "Ready To Ship"
 */
export const formatOrderStatus = (status) => {
  if (!status) return '';
  const clean = status.replace(/_/g, ' ');
  if (clean === clean.toUpperCase() && /[A-Z]/.test(clean)) {
    return clean
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  if (clean.includes(' ')) return clean;
  return clean.replace(/([a-z])([A-Z])/g, '$1 $2');
};

/**
 * Format a number to Indian Rupee currency format
 * E.g., 12500 -> "₹12,500.00"
 */
export const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

