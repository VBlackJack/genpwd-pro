/**
 * @fileoverview Vault Validation Utilities
 * Pure validation functions
 */

import { t } from '../../utils/i18n.js';

/**
 * Check if a string is a valid URL
 * @param {string} string - String to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid email address
 * @param {string} string - String to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string);
}

/**
 * Validate a field value against rules
 * @param {string} value - Value to validate
 * @param {Object} rules - Validation rules
 * @returns {{isValid: boolean, message: string, messageType: string}}
 */
export function validateFieldValue(value, rules = {}) {
  const trimmedValue = (value || '').trim();
  let isValid = true;
  let message = '';
  let messageType = 'error';

  // Required check
  if (rules.required && !trimmedValue) {
    isValid = false;
    message = rules.requiredMessage || t('vault.validation.fieldRequired');
  }
  // Min length check
  else if (rules.minLength && trimmedValue.length < rules.minLength) {
    isValid = false;
    message = rules.minLengthMessage || t('vault.validation.minLength', { count: rules.minLength });
  }
  // Max length check
  else if (rules.maxLength && trimmedValue.length > rules.maxLength) {
    isValid = false;
    message = rules.maxLengthMessage || t('vault.validation.maxLength', { count: rules.maxLength });
  }
  // Pattern check
  else if (rules.pattern && !rules.pattern.test(trimmedValue)) {
    isValid = false;
    message = rules.patternMessage || t('vault.validation.invalidFormat');
  }
  // URL check
  else if (rules.url && trimmedValue && !isValidUrl(trimmedValue)) {
    isValid = false;
    message = rules.urlMessage || t('vault.validation.invalidUrl');
  }
  // Email check
  else if (rules.email && trimmedValue && !isValidEmail(trimmedValue)) {
    isValid = false;
    message = rules.emailMessage || t('vault.validation.invalidEmail');
  }
  // Valid with success message
  else if (trimmedValue && rules.showSuccess) {
    message = rules.successMessage || '✓';
    messageType = 'success';
  }

  return { isValid, message, messageType };
}

/**
 * Check if passwords match
 * @param {string} password - Original password
 * @param {string} confirm - Confirmation password
 * @returns {{isValid: boolean, message: string, messageType: string}}
 */
export function validatePasswordMatch(password, confirm) {
  const trimmedConfirm = (confirm || '').trim();
  let isValid = true;
  let message = '';
  let messageType = 'error';

  if (!trimmedConfirm) {
    isValid = false;
  } else if (trimmedConfirm !== password) {
    isValid = false;
    message = t('vault.validation.passwordsNoMatch');
  } else {
    message = t('vault.validation.passwordsMatch');
    messageType = 'success';
  }

  return { isValid, message, messageType };
}
