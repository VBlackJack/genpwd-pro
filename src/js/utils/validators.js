/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// src/js/utils/validators.js - Centralized input validation utilities

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateString(value, context = 'value') {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${context} must be a string, got ${typeof value}`
    };
  }

  if (value.trim().length === 0) {
    return {
      valid: false,
      error: `${context} cannot be empty`
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates that a value is a positive integer within range
 * @param {*} value - Value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null, value: number}}
 */
export function validateInteger(value, min, max, context = 'value') {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof num !== 'number' || isNaN(num) || !Number.isFinite(num)) {
    return {
      valid: false,
      error: `${context} must be a valid number`,
      value: null
    };
  }

  if (!Number.isInteger(num)) {
    return {
      valid: false,
      error: `${context} must be an integer`,
      value: null
    };
  }

  if (num < min || num > max) {
    return {
      valid: false,
      error: `${context} must be between ${min} and ${max}, got ${num}`,
      value: null
    };
  }

  return { valid: true, error: null, value: num };
}

/**
 * Validates that a value is an array with minimum length
 * @param {*} value - Value to validate
 * @param {number} minLength - Minimum array length
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateArray(value, minLength = 0, context = 'value') {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `${context} must be an array, got ${typeof value}`
    };
  }

  if (value.length < minLength) {
    return {
      valid: false,
      error: `${context} must have at least ${minLength} elements, got ${value.length}`
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates that a value is one of the allowed options
 * @param {*} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateEnum(value, allowedValues, context = 'value') {
  if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
    return {
      valid: false,
      error: 'validateEnum: allowedValues must be a non-empty array'
    };
  }

  if (!allowedValues.includes(value)) {
    return {
      valid: false,
      error: `${context} must be one of [${allowedValues.join(', ')}], got "${value}"`
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates percentage value (0-100)
 * @param {*} value - Value to validate
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null, value: number}}
 */
export function validatePercentage(value, context = 'percentage') {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num) || !Number.isFinite(num)) {
    return {
      valid: false,
      error: `${context} must be a valid number`,
      value: null
    };
  }

  if (num < 0 || num > 100) {
    return {
      valid: false,
      error: `${context} must be between 0 and 100, got ${num}`,
      value: null
    };
  }

  return { valid: true, error: null, value: num };
}

/**
 * Validates object structure
 * @param {*} value - Value to validate
 * @param {Array<string>} requiredKeys - Required object keys
 * @param {string} context - Context for error message
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateObject(value, requiredKeys = [], context = 'object') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      error: `${context} must be an object, got ${typeof value}`
    };
  }

  for (const key of requiredKeys) {
    if (!(key in value)) {
      return {
        valid: false,
        error: `${context} missing required key: "${key}"`
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validates entropy value (minimum 40 bits for security)
 * @param {number} entropy - Entropy value to validate
 * @param {number} minimumBits - Minimum required bits (default: 40)
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateEntropy(entropy, minimumBits = 40) {
  if (typeof entropy !== 'number' || isNaN(entropy) || !Number.isFinite(entropy)) {
    return {
      valid: false,
      error: `Entropy must be a valid number, got ${typeof entropy}`
    };
  }

  if (entropy < minimumBits) {
    return {
      valid: false,
      error: `Entropy too low: ${entropy.toFixed(1)} bits < ${minimumBits} bits minimum`
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates password strength (length + character types)
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, error: string|null, strength: string, score: number}}
 */
export function validatePasswordStrength(password) {
  const result = validateString(password, 'password');
  if (!result.valid) {
    return { ...result, strength: 'invalid', score: 0 };
  }

  let score = 0;
  const checks = {
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digits: /[0-9]/.test(password),
    specials: /[^a-zA-Z0-9]/.test(password)
  };

  // Score calculation
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.digits) score += 1;
  if (checks.specials) score += 1;

  // Strength classification
  let strength;
  if (score <= 2) strength = 'weak';
  else if (score <= 4) strength = 'medium';
  else if (score <= 5) strength = 'strong';
  else strength = 'very-strong';

  return {
    valid: score >= 3, // Minimum acceptable strength
    error: score < 3 ? 'Password is too weak' : null,
    strength,
    score,
    checks
  };
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @param {Array<string>} allowedProtocols - Allowed protocols (default: http, https)
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateURL(url, allowedProtocols = ['http:', 'https:']) {
  const result = validateString(url, 'URL');
  if (!result.valid) return result;

  try {
    const parsed = new URL(url);

    if (!allowedProtocols.includes(parsed.protocol)) {
      return {
        valid: false,
        error: `URL protocol must be one of [${allowedProtocols.join(', ')}], got "${parsed.protocol}"`
      };
    }

    return { valid: true, error: null };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid URL format: ${err.message}`
    };
  }
}

// ==================== DOM VALIDATION HELPERS ====================

/**
 * Validate a form field and update its aria-invalid state
 * Also shows/hides associated error message element
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field - Form field
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.required=false] - Field is required
 * @param {number} [options.minLength] - Minimum length
 * @param {number} [options.maxLength] - Maximum length
 * @param {RegExp} [options.pattern] - Pattern to match
 * @param {string} [options.patternMessage] - Custom pattern error message
 * @param {Function} [options.customValidator] - Custom validation function returning {valid, error}
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateField(field, options = {}) {
  if (!field) return { valid: false, error: 'Field not found' };

  const value = field.value?.trim() ?? '';
  const {
    required = false,
    minLength,
    maxLength,
    pattern,
    patternMessage,
    customValidator
  } = options;

  let error = null;

  // Required check
  if (required && value.length === 0) {
    error = 'This field is required';
  }
  // Min length check
  else if (minLength !== undefined && value.length > 0 && value.length < minLength) {
    error = `Must be at least ${minLength} characters`;
  }
  // Max length check
  else if (maxLength !== undefined && value.length > maxLength) {
    error = `Must be at most ${maxLength} characters`;
  }
  // Pattern check
  else if (pattern && value.length > 0 && !pattern.test(value)) {
    error = patternMessage || 'Invalid format';
  }
  // Custom validator
  else if (customValidator && value.length > 0) {
    const result = customValidator(value);
    if (!result.valid) {
      error = result.error;
    }
  }

  // Update aria-invalid attribute
  field.setAttribute('aria-invalid', error ? 'true' : 'false');

  // Update associated error message element if exists
  const errorId = field.getAttribute('aria-describedby');
  if (errorId) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = error || '';
      errorEl.hidden = !error;
    }
  }

  // Add/remove invalid class for styling
  field.classList.toggle('field-invalid', !!error);

  return { valid: !error, error };
}

/**
 * Validate all fields in a form
 * @param {HTMLFormElement} form - Form element
 * @param {Object} fieldConfigs - Map of field name to validation options
 * @returns {{valid: boolean, errors: Object}}
 */
export function validateForm(form, fieldConfigs = {}) {
  if (!form) return { valid: false, errors: { form: 'Form not found' } };

  const errors = {};
  let firstInvalid = null;

  for (const [fieldName, config] of Object.entries(fieldConfigs)) {
    const field = form.elements[fieldName];
    if (!field) continue;

    const result = validateField(field, config);
    if (!result.valid) {
      errors[fieldName] = result.error;
      if (!firstInvalid) {
        firstInvalid = field;
      }
    }
  }

  // Focus first invalid field
  if (firstInvalid) {
    firstInvalid.focus();
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Setup real-time validation on a field (blur + input events)
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field - Form field
 * @param {Object} options - Validation options (same as validateField)
 * @param {AbortController} [abortController] - Optional abort controller for cleanup
 */
export function setupFieldValidation(field, options, abortController) {
  if (!field) return;

  const signal = abortController?.signal;

  // Validate on blur
  field.addEventListener('blur', () => {
    validateField(field, options);
  }, { signal });

  // Clear error on input (but don't validate yet)
  field.addEventListener('input', () => {
    if (field.getAttribute('aria-invalid') === 'true') {
      // Re-validate if currently invalid
      validateField(field, options);
    }
  }, { signal });
}

/**
 * Sanitizes user input by removing dangerous characters
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') return '';

  const {
    maxLength = 10000,
    allowNewlines = false,
    allowHTML = false,
    trim = true
  } = options;

  let sanitized = input;

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove newlines if not allowed
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }

  // Escape HTML if not allowed
  if (!allowHTML) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  return sanitized;
}
