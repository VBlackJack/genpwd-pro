/**
 * @fileoverview Accessibility Utilities
 * Shared a11y functions to avoid circular dependencies
 */

import { getElement } from './dom.js';

/**
 * Sets the main content area inert state for modal accessibility
 * When a modal is open, main content should be inert to prevent focus
 * @param {boolean} inert - Whether to make content inert
 */
export function setMainContentInert(inert) {
  const mainContent = getElement('.main');
  const header = getElement('#app-header');
  const debugPanel = getElement('#debug-panel');

  [mainContent, header, debugPanel].forEach(el => {
    if (el) {
      if (inert) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    }
  });
}
