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
 * @fileoverview Form detection for autofill
 * Detects username, password, and OTP fields on web pages
 */

/**
 * Username field selectors
 */
const USERNAME_SELECTORS = [
  'input[type="email"]',
  'input[type="text"][name*="user" i]',
  'input[type="text"][name*="email" i]',
  'input[type="text"][name*="login" i]',
  'input[type="text"][name*="account" i]',
  'input[type="text"][id*="user" i]',
  'input[type="text"][id*="email" i]',
  'input[type="text"][id*="login" i]',
  'input[type="text"][autocomplete="username"]',
  'input[type="text"][autocomplete="email"]',
  'input[name="username"]',
  'input[name="email"]',
  'input[name="login"]',
  'input[name="identifier"]'
];

/**
 * Password field selectors
 */
const PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]'
];

/**
 * OTP field selectors
 */
const OTP_SELECTORS = [
  'input[name*="otp" i]',
  'input[name*="totp" i]',
  'input[name*="2fa" i]',
  'input[name*="code" i]',
  'input[name*="token" i]',
  'input[name*="verification" i]',
  'input[id*="otp" i]',
  'input[id*="totp" i]',
  'input[id*="2fa" i]',
  'input[autocomplete="one-time-code"]',
  'input[maxlength="6"][type="text"]',
  'input[maxlength="6"][type="tel"]',
  'input[maxlength="6"][type="number"]'
];

/**
 * Check if element is visible
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isVisible(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Find fields matching selectors
 * @param {string[]} selectors
 * @param {Element} container
 * @returns {HTMLInputElement[]}
 */
function findFields(selectors, container = document) {
  const fields = [];
  const seen = new Set();

  for (const selector of selectors) {
    try {
      const elements = container.querySelectorAll(selector);
      for (const element of elements) {
        if (!seen.has(element) && isVisible(element) && !element.disabled && !element.readOnly) {
          seen.add(element);
          fields.push(element);
        }
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return fields;
}

/**
 * Detect login form fields on the page
 * @returns {{username: HTMLInputElement|null, password: HTMLInputElement|null, otp: HTMLInputElement|null, form: HTMLFormElement|null}}
 */
export function detectLoginFields() {
  const result = {
    username: null,
    password: null,
    otp: null,
    form: null
  };

  // Find password fields first (most reliable indicator)
  const passwordFields = findFields(PASSWORD_SELECTORS);
  if (passwordFields.length > 0) {
    result.password = passwordFields[0];
    result.form = result.password.closest('form');
  }

  // Find username fields
  const usernameFields = findFields(USERNAME_SELECTORS);
  if (usernameFields.length > 0) {
    // Prefer username field in same form as password
    if (result.form) {
      const inForm = usernameFields.find(f => result.form.contains(f));
      result.username = inForm || usernameFields[0];
    } else {
      result.username = usernameFields[0];
      result.form = result.username.closest('form');
    }
  }

  // Find OTP fields
  const otpFields = findFields(OTP_SELECTORS);
  if (otpFields.length > 0) {
    // Filter out fields that might be username/password
    const pureOtp = otpFields.filter(f => {
      const name = (f.name || f.id || '').toLowerCase();
      return !name.includes('user') && !name.includes('email') && !name.includes('password');
    });
    result.otp = pureOtp[0] || otpFields[0];
  }

  return result;
}

/**
 * Get all fillable fields on the page
 * @returns {{usernames: HTMLInputElement[], passwords: HTMLInputElement[], otps: HTMLInputElement[]}}
 */
export function getAllFields() {
  return {
    usernames: findFields(USERNAME_SELECTORS),
    passwords: findFields(PASSWORD_SELECTORS),
    otps: findFields(OTP_SELECTORS)
  };
}

/**
 * Find the closest form element
 * @param {HTMLInputElement} field
 * @returns {HTMLFormElement|null}
 */
export function findForm(field) {
  return field?.closest('form') || null;
}

/**
 * Find submit button for a form
 * @param {HTMLFormElement|HTMLInputElement} formOrField
 * @returns {HTMLElement|null}
 */
export function findSubmitButton(formOrField) {
  const form = formOrField instanceof HTMLFormElement
    ? formOrField
    : formOrField?.closest('form');

  if (!form) return null;

  // Try explicit submit buttons
  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn && isVisible(submitBtn)) return submitBtn;

  // Try buttons with submit-like text
  const buttons = form.querySelectorAll('button, input[type="button"]');
  for (const btn of buttons) {
    const text = (btn.textContent || btn.value || '').toLowerCase();
    if (text.includes('login') || text.includes('sign in') || text.includes('submit') ||
        text.includes('connexion') || text.includes('connecter')) {
      if (isVisible(btn)) return btn;
    }
  }

  // Try any visible button
  for (const btn of buttons) {
    if (isVisible(btn)) return btn;
  }

  return null;
}

/**
 * Watch for new fields (dynamic pages)
 * @param {Function} callback - Called when new fields detected
 * @returns {Function} Cleanup function
 */
export function watchForFields(callback) {
  let lastFields = JSON.stringify(detectLoginFields());

  const observer = new MutationObserver(() => {
    const currentFields = JSON.stringify(detectLoginFields());
    if (currentFields !== lastFields) {
      lastFields = currentFields;
      callback(detectLoginFields());
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'style', 'class', 'disabled', 'readonly']
  });

  return () => observer.disconnect();
}
