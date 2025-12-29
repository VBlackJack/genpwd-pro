/*
 * GenPwd Pro - i18n Helper for Chrome Extension
 * Copyright 2025 Julien Bombled
 */

/**
 * Get localized message from chrome.i18n
 * @param {string} key - Message key from messages.json
 * @param {string|string[]} [substitutions] - Optional substitution values
 * @returns {string} Localized message or key if not found
 */
export function getMessage(key, substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

/**
 * Shorthand alias for getMessage
 * @param {string} key - Message key
 * @param {string|string[]} [substitutions] - Optional substitutions
 * @returns {string} Localized message
 */
export const t = getMessage;

/**
 * Initialize i18n for HTML elements with data-i18n attribute
 * Call this after DOMContentLoaded
 */
export function initializeI18n() {
  // Translate elements with data-i18n attribute (text content)
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = getMessage(key);
    if (message && message !== key) {
      element.textContent = message;
    }
  });

  // Translate elements with data-i18n-placeholder (input placeholders)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const message = getMessage(key);
    if (message && message !== key) {
      element.placeholder = message;
    }
  });

  // Translate elements with data-i18n-title (title attribute)
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    const message = getMessage(key);
    if (message && message !== key) {
      element.title = message;
    }
  });

  // Translate elements with data-i18n-aria-label (aria-label attribute)
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const key = element.getAttribute('data-i18n-aria-label');
    const message = getMessage(key);
    if (message && message !== key) {
      element.setAttribute('aria-label', message);
    }
  });

  // Translate elements with data-i18n-html (innerHTML - use with caution)
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    const key = element.getAttribute('data-i18n-html');
    const message = getMessage(key);
    if (message && message !== key) {
      element.innerHTML = message;
    }
  });

  // Update document lang attribute based on browser locale
  const uiLang = chrome.i18n.getUILanguage();
  document.documentElement.lang = uiLang.split('-')[0] || 'en';
}

/**
 * Get the current UI language
 * @returns {string} Language code (e.g., 'en', 'fr')
 */
export function getLanguage() {
  return chrome.i18n.getUILanguage().split('-')[0] || 'en';
}
