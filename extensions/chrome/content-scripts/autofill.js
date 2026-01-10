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

/**
 * @fileoverview Autofill engine for Chrome extension
 * Fills form fields with credentials from vault
 */

import { detectLoginFields, findSubmitButton } from './form-detector.js';

/**
 * Fill a single input field
 * @param {HTMLInputElement} field
 * @param {string} value
 */
function fillField(field, value) {
  if (!field || !value) return;

  // Focus the field
  field.focus();

  // Clear existing value
  field.value = '';

  // Set the value
  field.value = value;

  // Dispatch events to trigger React/Vue/Angular validation
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));

  // For React specifically
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Blur to trigger validation
  field.blur();
}

/**
 * Fill login credentials
 * @param {{username?: string, password?: string, otp?: string}} credentials
 * @param {Object} options
 * @returns {{filled: string[], errors: string[]}}
 */
export function fillCredentials(credentials, options = {}) {
  const result = { filled: [], errors: [] };
  const fields = detectLoginFields();

  // Fill username
  if (credentials.username && fields.username) {
    try {
      fillField(fields.username, credentials.username);
      result.filled.push('username');
    } catch (e) {
      result.errors.push(`Username: ${e.message}`);
    }
  }

  // Fill password
  if (credentials.password && fields.password) {
    try {
      fillField(fields.password, credentials.password);
      result.filled.push('password');
    } catch (e) {
      result.errors.push(`Password: ${e.message}`);
    }
  }

  // Fill OTP
  if (credentials.otp && fields.otp) {
    try {
      fillField(fields.otp, credentials.otp);
      result.filled.push('otp');
    } catch (e) {
      result.errors.push(`OTP: ${e.message}`);
    }
  }

  // Auto-submit if requested
  if (options.autoSubmit && result.filled.length > 0 && result.errors.length === 0) {
    const form = fields.form || fields.password?.closest('form') || fields.username?.closest('form');
    if (form) {
      setTimeout(() => {
        const submitBtn = findSubmitButton(form);
        if (submitBtn) {
          submitBtn.click();
        } else {
          form.submit();
        }
      }, 100);
    }
  }

  return result;
}

/**
 * Fill only username
 * @param {string} username
 */
export function fillUsername(username) {
  const fields = detectLoginFields();
  if (fields.username) {
    fillField(fields.username, username);
    return true;
  }
  return false;
}

/**
 * Fill only password
 * @param {string} password
 */
export function fillPassword(password) {
  const fields = detectLoginFields();
  if (fields.password) {
    fillField(fields.password, password);
    return true;
  }
  return false;
}

/**
 * Fill only OTP
 * @param {string} otp
 */
export function fillOTP(otp) {
  const fields = detectLoginFields();
  if (fields.otp) {
    fillField(fields.otp, otp);
    return true;
  }
  return false;
}

/**
 * Clear all login fields
 */
export function clearFields() {
  const fields = detectLoginFields();

  if (fields.username) {
    fillField(fields.username, '');
  }
  if (fields.password) {
    fillField(fields.password, '');
  }
  if (fields.otp) {
    fillField(fields.otp, '');
  }
}
