/**
 * @fileoverview Search and Filter Logic
 * Pure functions for filtering vault entries
 */

import { getPasswordStrength, getPasswordAgeDays } from '../utils/password-utils.js';

/**
 * Filter entries by search query
 * @param {Array} entries - Entries to filter
 * @param {string} query - Search query
 * @returns {Array} Filtered entries
 */
export function filterBySearch(entries, query) {
  if (!query) return entries;

  const q = query.toLowerCase();
  return entries.filter(e =>
    e.title?.toLowerCase().includes(q) ||
    e.data?.username?.toLowerCase().includes(q) ||
    e.data?.url?.toLowerCase().includes(q) ||
    e.data?.email?.toLowerCase().includes(q) ||
    e.notes?.toLowerCase().includes(q)
  );
}

/**
 * Filter entries by type
 * @param {Array} entries - Entries to filter
 * @param {string|null} type - Entry type (login, note, card, identity)
 * @returns {Array} Filtered entries
 */
export function filterByType(entries, type) {
  if (!type) return entries;
  return entries.filter(e => e.type === type);
}

/**
 * Filter entries by password strength
 * @param {Array} entries - Entries to filter
 * @param {string|null} strength - Strength level (weak, medium, strong)
 * @returns {Array} Filtered entries
 */
export function filterByStrength(entries, strength) {
  if (!strength) return entries;
  return entries.filter(e => {
    if (e.type !== 'login' || !e.data?.password) return false;
    return getPasswordStrength(e.data.password) === strength;
  });
}

// getPasswordAgeDays imported from password-utils.js

/**
 * Get expiry status for an entry
 * @param {Object} entry - Entry object
 * @returns {{status: string, daysUntil: number|null}}
 */
export function getExpiryStatus(entry) {
  if (!entry.data?.expiryDate) {
    return { status: 'none', daysUntil: null };
  }

  const expiry = new Date(entry.data.expiryDate);
  const now = new Date();
  const daysUntil = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return { status: 'expired', daysUntil };
  if (daysUntil === 0) return { status: 'today', daysUntil: 0 };
  if (daysUntil <= 7) return { status: 'soon', daysUntil };
  if (daysUntil <= 30) return { status: 'warning', daysUntil };
  return { status: 'ok', daysUntil };
}

/**
 * Filter entries by age/expiry status
 * @param {Array} entries - Entries to filter
 * @param {string|null} ageFilter - Age filter (recent, old, expiring, expired)
 * @returns {Array} Filtered entries
 */
export function filterByAge(entries, ageFilter) {
  if (!ageFilter) return entries;

  return entries.filter(e => {
    if (e.type !== 'login') return false;

    // Expiration-based filters
    if (ageFilter === 'expiring' || ageFilter === 'expired') {
      const expiryStatus = getExpiryStatus(e);
      if (ageFilter === 'expired') {
        return expiryStatus.status === 'expired';
      } else if (ageFilter === 'expiring') {
        return ['today', 'soon', 'warning'].includes(expiryStatus.status);
      }
    }

    // Age-based filters
    const days = getPasswordAgeDays(e.modifiedAt);
    switch (ageFilter) {
      case 'recent': return days <= 30;
      case 'old': return days > 180;
      default: return true;
    }
  });
}

/**
 * Filter entries by category
 * @param {Array} entries - Entries to filter
 * @param {string} category - Category (all, favorites, recent, login, note, card, identity)
 * @returns {Array} Filtered entries
 */
export function filterByCategory(entries, category) {
  if (!category || category === 'all') return entries;

  if (category === 'favorites') {
    return entries.filter(e => e.favorite);
  }

  if (category === 'recent') {
    return [...entries]
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
      .slice(0, 10);
  }

  return entries.filter(e => e.type === category);
}

/**
 * Filter entries by folder
 * @param {Array} entries - Entries to filter
 * @param {string|null} folderId - Folder ID
 * @returns {Array} Filtered entries
 */
export function filterByFolder(entries, folderId) {
  if (!folderId) return entries;
  return entries.filter(e => e.folderId === folderId);
}

/**
 * Filter entries by tag
 * @param {Array} entries - Entries to filter
 * @param {string|null} tagId - Tag ID
 * @returns {Array} Filtered entries
 */
export function filterByTag(entries, tagId) {
  if (!tagId) return entries;
  return entries.filter(e => e.tags?.includes(tagId));
}

/**
 * Filter entries by audit IDs
 * @param {Array} entries - Entries to filter
 * @param {Set|null} auditIds - Set of entry IDs from audit
 * @returns {Array} Filtered entries
 */
export function filterByAuditIds(entries, auditIds) {
  if (!auditIds || auditIds.size === 0) return entries;
  return entries.filter(e => auditIds.has(e.id));
}

/**
 * Sort entries
 * @param {Array} entries - Entries to sort
 * @param {string} sortBy - Sort field (title, modifiedAt, createdAt, type)
 * @param {string} sortOrder - Sort order (asc, desc)
 * @returns {Array} Sorted entries
 */
export function sortEntries(entries, sortBy = 'title', sortOrder = 'asc') {
  const sorted = [...entries].sort((a, b) => {
    let valA, valB;

    switch (sortBy) {
      case 'title':
        valA = a.title?.toLowerCase() || '';
        valB = b.title?.toLowerCase() || '';
        break;
      case 'modifiedAt':
      case 'createdAt':
        valA = new Date(a[sortBy] || 0);
        valB = new Date(b[sortBy] || 0);
        break;
      case 'type':
        valA = a.type || '';
        valB = b.type || '';
        break;
      default:
        return 0;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Apply all filters to entries
 * @param {Array} entries - All entries
 * @param {Object} filters - Filter options
 * @param {string} filters.search - Search query
 * @param {string} filters.type - Type filter
 * @param {string} filters.strength - Strength filter
 * @param {string} filters.age - Age filter
 * @param {string} filters.category - Category filter
 * @param {string} filters.folderId - Folder ID
 * @param {string} filters.tagId - Tag ID
 * @param {Set} filters.auditIds - Audit IDs
 * @param {string} filters.sortBy - Sort field
 * @param {string} filters.sortOrder - Sort order
 * @returns {Array} Filtered and sorted entries
 */
export function applyFilters(entries, filters = {}) {
  let result = [...entries];

  // Apply filters in order
  if (filters.auditIds) {
    result = filterByAuditIds(result, filters.auditIds);
  }
  if (filters.search) {
    result = filterBySearch(result, filters.search);
  }
  if (filters.type) {
    result = filterByType(result, filters.type);
  }
  if (filters.strength) {
    result = filterByStrength(result, filters.strength);
  }
  if (filters.age) {
    result = filterByAge(result, filters.age);
  }
  if (filters.category) {
    result = filterByCategory(result, filters.category);
  }
  if (filters.folderId) {
    result = filterByFolder(result, filters.folderId);
  }
  if (filters.tagId) {
    result = filterByTag(result, filters.tagId);
  }

  // Sort
  if (filters.sortBy) {
    result = sortEntries(result, filters.sortBy, filters.sortOrder || 'asc');
  }

  return result;
}
