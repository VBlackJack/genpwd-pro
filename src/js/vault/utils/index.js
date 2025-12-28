/**
 * @fileoverview Vault Utilities Index
 * Re-exports all utility modules for convenient importing
 */

// Formatting utilities
export {
  escapeHtml,
  formatDate,
  formatDateTime,
  maskHistoryPassword,
  getRelativeTime,
  formatTime,
  formatFileSize,
  formatBreachCount
} from './formatter.js';

// Validation utilities
export {
  isValidUrl,
  isValidEmail,
  validateFieldValue,
  validatePasswordMatch
} from './validators.js';

// Password utilities
export {
  getPasswordStrength,
  calculatePasswordStrength,
  generatePassword,
  getPasswordAgeDays,
  isPasswordDuplicated
} from './password-utils.js';

// Favicon utilities
export {
  extractDomain,
  getFaviconUrl,
  getDefaultFaviconSvg,
  renderFaviconImg,
  preloadFavicons
} from './favicon-manager.js';
