/**
 * @fileoverview Vault Views Index
 * Re-exports all view modules
 */

// Search and filtering
export {
  filterBySearch,
  filterByType,
  filterByStrength,
  filterByAge,
  filterByCategory,
  filterByFolder,
  filterByTag,
  filterByAuditIds,
  sortEntries,
  applyFilters,
  getExpiryStatus
} from './search-filter.js';

// Icons
export * from './icons.js';

// Lock screen
export { renderLockScreen } from './lock-screen.js';

// Templates
export * from './templates/index.js';
