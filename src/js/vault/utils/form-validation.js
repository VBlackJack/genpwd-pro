/**
 * @fileoverview Form Validation Utilities
 * Real-time field validation with accessibility support
 *
 * Validation is debounced to prevent showing errors while user is still typing.
 * Errors show immediately on blur for faster feedback.
 */

import { t } from '../../utils/i18n.js';
import { isValidUrl, isValidEmail } from './validators.js';

/**
 * Default debounce delay for validation (ms)
 * Shorter than typical typing debounce to feel responsive
 */
const VALIDATION_DEBOUNCE_MS = 400;

/**
 * Render validation icon SVG
 * @param {string} type - 'error' or 'success'
 * @returns {string} SVG HTML
 */
function getValidationIcon(type) {
  if (type === 'error') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
}

/**
 * Update input validation state (classes and ARIA)
 * @param {HTMLInputElement} input - Input element
 * @param {boolean} isValid - Validation result
 * @param {boolean} hasValue - Whether input has a value
 */
function updateInputState(input, isValid, hasValue) {
  input.classList.remove('is-valid', 'is-invalid');
  if (hasValue) {
    input.classList.add(isValid ? 'is-valid' : 'is-invalid');
    input.setAttribute('aria-invalid', isValid ? 'false' : 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

/**
 * Update message element with validation feedback
 * @param {HTMLElement} messageEl - Message element
 * @param {HTMLInputElement} input - Input element (for ID linking)
 * @param {string} message - Message text
 * @param {string} messageType - 'error' or 'success'
 */
function updateMessageElement(messageEl, input, message, messageType) {
  // Ensure message element has an ID for aria-describedby
  if (!messageEl.id && input.id) {
    messageEl.id = `${input.id}-message`;
  }
  if (messageEl.id) {
    input.setAttribute('aria-describedby', messageEl.id);
  }

  if (message) {
    // Build safely: icon via innerHTML (trusted SVG), message via textContent
    messageEl.innerHTML = '';
    messageEl.insertAdjacentHTML('beforeend', getValidationIcon(messageType));
    const span = document.createElement('span');
    span.textContent = message;
    messageEl.appendChild(span);
    messageEl.className = `vault-field-message visible ${messageType}`;
    // Use role="alert" (assertive) for errors, role="status" (polite) for success
    messageEl.setAttribute('role', messageType === 'error' ? 'alert' : 'status');
    messageEl.setAttribute('aria-live', messageType === 'error' ? 'assertive' : 'polite');
    messageEl.setAttribute('aria-atomic', 'true');
  } else {
    messageEl.className = 'vault-field-message';
    messageEl.innerHTML = '';
    messageEl.removeAttribute('role');
    messageEl.removeAttribute('aria-live');
  }
}

/**
 * Real-time field validation
 * @param {HTMLInputElement} input - The input element
 * @param {HTMLElement} messageEl - The message display element
 * @param {Object} rules - Validation rules
 * @param {boolean} [rules.required] - Field is required
 * @param {string} [rules.requiredMessage] - Custom required message
 * @param {number} [rules.minLength] - Minimum length
 * @param {string} [rules.minLengthMessage] - Custom min length message
 * @param {number} [rules.maxLength] - Maximum length
 * @param {string} [rules.maxLengthMessage] - Custom max length message
 * @param {RegExp} [rules.pattern] - Pattern to match
 * @param {string} [rules.patternMessage] - Custom pattern message
 * @param {boolean} [rules.url] - Validate as URL
 * @param {string} [rules.urlMessage] - Custom URL message
 * @param {boolean} [rules.email] - Validate as email
 * @param {string} [rules.emailMessage] - Custom email message
 * @param {boolean} [rules.showSuccess] - Show success message
 * @param {string} [rules.successMessage] - Custom success message
 * @returns {boolean} Validation result
 */
export function validateField(input, messageEl, rules = {}) {
  if (!input || !messageEl) return true;

  const value = input.value.trim();
  let isValid = true;
  let message = '';
  let messageType = 'error';

  // Required check
  if (rules.required && !value) {
    isValid = false;
    message = rules.requiredMessage || t('vault.validation.fieldRequired');
  }
  // Min length check
  else if (rules.minLength && value.length < rules.minLength) {
    isValid = false;
    message = rules.minLengthMessage || t('vault.validation.minLength', { count: rules.minLength });
  }
  // Max length check
  else if (rules.maxLength && value.length > rules.maxLength) {
    isValid = false;
    message = rules.maxLengthMessage || t('vault.validation.maxLength', { count: rules.maxLength });
  }
  // Pattern check
  else if (rules.pattern && !rules.pattern.test(value)) {
    isValid = false;
    message = rules.patternMessage || t('vault.validation.invalidFormat');
  }
  // URL check
  else if (rules.url && value && !isValidUrl(value)) {
    isValid = false;
    message = rules.urlMessage || t('vault.validation.invalidUrl');
  }
  // Email check
  else if (rules.email && value && !isValidEmail(value)) {
    isValid = false;
    message = rules.emailMessage || t('vault.validation.invalidEmail');
  }
  // Valid
  else if (value && rules.showSuccess) {
    message = rules.successMessage || t('vault.validation.valid');
    messageType = 'success';
  }

  updateInputState(input, isValid, !!value);
  updateMessageElement(messageEl, input, message, messageType);

  return isValid;
}

/**
 * Validate password confirmation match
 * @param {HTMLInputElement} confirmInput - The confirm input
 * @param {HTMLInputElement} passwordInput - The password input
 * @param {HTMLElement} messageEl - The message display element
 * @returns {boolean} Validation result
 */
export function validatePasswordMatch(confirmInput, passwordInput, messageEl) {
  if (!confirmInput || !passwordInput || !messageEl) return true;

  const password = passwordInput.value;
  const confirm = confirmInput.value.trim();
  let isValid = true;
  let message = '';
  let messageType = 'error';

  if (!confirm) {
    // Empty - no message but invalid
    isValid = false;
  } else if (confirm !== password) {
    isValid = false;
    message = t('vault.validation.passwordsNoMatch');
  } else {
    message = t('vault.validation.passwordsMatch');
    messageType = 'success';
  }

  updateInputState(confirmInput, isValid, !!confirm);
  updateMessageElement(messageEl, confirmInput, message, messageType);

  return isValid;
}

/**
 * Simple debounce utility
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a debounced field validator
 * Shows errors after a delay while typing, but immediately on blur.
 *
 * @param {HTMLInputElement} input - Input element to validate
 * @param {HTMLElement} messageEl - Message display element
 * @param {Object} rules - Validation rules (same as validateField)
 * @param {number} [debounceMs=400] - Debounce delay for input events
 * @returns {{ attach: Function, detach: Function, validate: Function }}
 *
 * @example
 * const validator = createDebouncedValidator(input, messageEl, { required: true });
 * validator.attach();
 * // Later:
 * validator.detach();
 */
export function createDebouncedValidator(input, messageEl, rules = {}, debounceMs = VALIDATION_DEBOUNCE_MS) {
  if (!input || !messageEl) {
    return { attach: () => {}, detach: () => {}, validate: () => true };
  }

  // Debounced validation for 'input' events (while typing)
  const debouncedValidate = debounce(() => {
    validateField(input, messageEl, rules);
  }, debounceMs);

  // Immediate validation on blur
  const handleBlur = () => {
    // Clear any pending debounced validation
    debouncedValidate.cancel?.();
    validateField(input, messageEl, rules);
  };

  // Input event handler
  const handleInput = () => {
    // Only show success states while typing, defer error display
    const value = input.value.trim();
    if (value && !hasError(input, rules)) {
      // Valid - can show success immediately
      validateField(input, messageEl, rules);
    } else {
      // May be invalid - debounce to avoid showing error mid-typing
      debouncedValidate();
    }
  };

  /**
   * Quick check if input currently has validation errors
   * @param {HTMLInputElement} inp
   * @param {Object} rls
   * @returns {boolean}
   */
  function hasError(inp, rls) {
    const val = inp.value.trim();
    if (rls.required && !val) return true;
    if (rls.minLength && val.length < rls.minLength) return true;
    if (rls.maxLength && val.length > rls.maxLength) return true;
    if (rls.pattern && !rls.pattern.test(val)) return true;
    if (rls.url && val && !isValidUrl(val)) return true;
    if (rls.email && val && !isValidEmail(val)) return true;
    return false;
  }

  return {
    /**
     * Attach validation listeners
     */
    attach() {
      input.addEventListener('input', handleInput);
      input.addEventListener('blur', handleBlur);
    },
    /**
     * Detach validation listeners
     */
    detach() {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleBlur);
    },
    /**
     * Manually trigger validation
     * @returns {boolean}
     */
    validate() {
      return validateField(input, messageEl, rules);
    }
  };
}
