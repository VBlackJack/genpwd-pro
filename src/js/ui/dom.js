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
 * @fileoverview Optimized DOM utilities
 * Provides cached element access, event binding, and visibility helpers
 */
import { getCachedElement } from '../config/settings.js';
import { safeLog } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';
import { t } from '../utils/i18n.js';

/**
 * Gets a DOM element by selector with optional caching
 * @param {string} selector - CSS selector (ID or query)
 * @param {boolean} useCache - Whether to use cached element lookup
 * @returns {HTMLElement|null} The found element or null
 */
export function getElement(selector, useCache = true) {
  if (!selector) return null;
  try {
    if (useCache) {
      return getCachedElement(selector);
    }
    if (selector.startsWith('#')) {
      return document.getElementById(selector.slice(1));
    } else {
      return document.querySelector(selector);
    }
  } catch (e) {
    safeLog(`DOM selector error: ${selector} - ${e.message}`);
    return null;
  }
}

/**
 * Gets all DOM elements matching a selector
 * @param {string} selector - CSS selector
 * @returns {HTMLElement[]} Array of matching elements
 */
export function getAllElements(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (e) {
    safeLog(`querySelectorAll error: ${selector} - ${e.message}`);
    return [];
  }
}

/**
 * Safely adds an event listener to an element
 * @param {HTMLElement} element - Target element
 * @param {string} event - Event type (e.g., 'click')
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 * @returns {boolean} True if listener was added successfully
 */
export function addEventListener(element, event, handler, options = {}) {
  if (!element || typeof handler !== 'function') return false;
  try {
    element.addEventListener(event, handler, options);
    return true;
  } catch (e) {
    safeLog(`addEventListener error: ${e.message}`);
    return false;
  }
}

/**
 * Updates a badge element with the input's current value
 * @param {HTMLInputElement} input - The input element (typically range slider)
 */
export function updateBadgeForInput(input) {
  if (!input) return;
  try {
    const badge = input.parentNode ? input.parentNode.querySelector('.badge') : null;
    if (badge) badge.textContent = input.value;
  } catch (e) {
    safeLog(`updateBadgeForInput error: ${e.message}`);
  }
}

/**
 * Updates visibility of mode-specific option panels
 * Shows/hides syllables, passphrase, and leet options based on mode selection
 */
export function updateVisibilityByMode() {
  const mode = getElement('#mode-select')?.value || 'syllables';

  const syllEl = getElement('#mode-syllables-opts');
  if (syllEl) {
    const isActive = mode === 'syllables';
    syllEl.classList.toggle('hidden', !isActive);
    syllEl.setAttribute('aria-hidden', String(!isActive));
  }

  const ppEl = getElement('#mode-passphrase-opts');
  if (ppEl) {
    const isActive = mode === 'passphrase';
    ppEl.classList.toggle('hidden', !isActive);
    ppEl.setAttribute('aria-hidden', String(!isActive));
  }

  const leetEl = getElement('#mode-leet-opts');
  if (leetEl) {
    const isActive = mode === 'leet';
    leetEl.classList.toggle('hidden', !isActive);
    leetEl.setAttribute('aria-hidden', String(!isActive));
  }
  safeLog(`Display mode: ${mode}`);
}

/**
 * Ensures block editor visibility matches case mode selection
 * Shows blocks editor row when case mode is 'blocks'
 */
export function ensureBlockVisible() {
  try {
    const caseModeSelect = getElement('#case-mode-select');
    const currentValue = caseModeSelect ? caseModeSelect.value : null;
    const show = currentValue === 'blocks';

    const row = getElement('#blocks-editor-row');
    const prev = getElement('#case-preview-row');

    if (row) {
      row.classList.toggle('hidden', !show);
      row.setAttribute('aria-hidden', String(!show));
    }
    if (prev) {
      prev.classList.toggle('hidden', !show);
      prev.setAttribute('aria-hidden', String(!show));
    }
  } catch (e) {
    safeLog('ensureBlockVisible error: ' + (e?.message || e));
  }
}

/**
 * Toggles the debug panel visibility
 * @returns {boolean} True if panel is now visible, false if hidden
 */
export function toggleDebugPanel() {
  const debugPanel = getElement('#debug-panel');
  if (!debugPanel) return;

  const isCurrentlyHidden = debugPanel.hasAttribute('hidden');

  if (isCurrentlyHidden) {
    debugPanel.removeAttribute('hidden');
    debugPanel.classList.remove('hidden');
  } else {
    debugPanel.setAttribute('hidden', '');
    debugPanel.classList.add('hidden');
  }

  const btn = getElement('#btn-toggle-debug');
  if (btn) {
    // FIXED: Uses i18n keys for "Close" and "Debug"
    btn.textContent = isCurrentlyHidden ?
      `🔬 ${t('common.close')}` :
      `🔬 ${t('common.debug')}`;
  }

  return isCurrentlyHidden;
}

/**
 * Renders case pattern chips in a container
 * @param {string} containerSelector - CSS selector for the container
 * @param {string[]} blocks - Array of case tokens (U, l, T)
 * @param {Function} onChipClick - Callback when a chip is clicked (receives index)
 */
export function renderChips(containerSelector, blocks, onChipClick) {
  const container = getElement(containerSelector);
  if (!container) return;

  container.innerHTML = sanitizeHTML('');

  blocks.forEach((token, index) => {
    const chip = document.createElement('button');
    chip.className = 'chip ' + (token === 'U' ? '' : token === 'l' ? 'chip-muted' : 'chip-title');
    chip.textContent = token;
    chip.title = t('vault.generator.clickToCycle');

    if (onChipClick) {
      addEventListener(chip, 'click', () => onChipClick(index));
    }

    container.appendChild(chip);
  });
}

/**
 * Updates the block size label with current count
 * @param {string} labelSelector - CSS selector for the label element
 * @param {number} blocksCount - Number of blocks to display
 */
export function updateBlockSizeLabel(labelSelector, blocksCount) {
  const label = getElement(labelSelector);
  if (label) {
    label.textContent = `${t('vault.generator.blocks')} ${blocksCount}`;
  }
}

/**
 * Initializes the DOM environment
 * Validates critical elements exist and sets up initial visibility states
 * @throws {Error} If critical elements are missing
 */
export async function initializeDOM() {
  try {
    const criticalElements = [
      '#mode-select', '#qty', '#results-list', '#btn-generate', '#logs'
    ];

    for (const selector of criticalElements) {
      const element = getElement(selector);
      if (!element) {
        throw new Error(`Missing critical element: ${selector}`);
      }
    }

    getAllElements('input[type="range"]').forEach(updateBadgeForInput);
    updateVisibilityByMode();
    ensureBlockVisible();

    safeLog('DOM initialized successfully');
  } catch (error) {
    throw new Error(`DOM initialization error: ${error.message}`);
  }
}
