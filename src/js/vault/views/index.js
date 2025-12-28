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

// Templates
export {
  renderLockScreen,
  renderVaultList,
  renderVaultListLoading,
  renderVaultListError
} from './templates/lock-screen.js';
