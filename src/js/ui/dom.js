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
// src/js/ui/dom.js - Optimized DOM utilities
import { getCachedElement } from '../config/settings.js';
import { safeLog } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';
import { t } from '../utils/i18n.js';

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

export function getAllElements(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (e) {
    safeLog(`querySelectorAll error: ${selector} - ${e.message}`);
    return [];
  }
}

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

export function updateBadgeForInput(input) {
  if (!input) return;
  try {
    const badge = input.parentNode ? input.parentNode.querySelector('.badge') : null;
    if (badge) badge.textContent = input.value;
  } catch (e) {
    safeLog(`updateBadgeForInput error: ${e.message}`);
  }
}

export function updateVisibilityByMode() {
  const mode = getElement('#mode-select')?.value || 'syllables';

  const syllEl = getElement('#mode-syllables-opts');
  if (syllEl) {
    if (mode === 'syllables') {
      syllEl.classList.remove('hidden');
    } else {
      syllEl.classList.add('hidden');
    }
  }

  const ppEl = getElement('#mode-passphrase-opts');
  if (ppEl) {
    if (mode === 'passphrase') {
      ppEl.classList.remove('hidden');
    } else {
      ppEl.classList.add('hidden');
    }
  }

  const leetEl = getElement('#mode-leet-opts');
  if (leetEl) {
    if (mode === 'leet') {
      leetEl.classList.remove('hidden');
    } else {
      leetEl.classList.add('hidden');
    }
  }

  safeLog(`Display mode: ${mode}`);
}

export function ensureBlockVisible() {
  try {
    const caseModeSelect = getElement('#case-mode-select');
    const currentValue = caseModeSelect ? caseModeSelect.value : null;
    const show = currentValue === 'blocks';

    const row = getElement('#blocks-editor-row');
    const prev = getElement('#case-preview-row');

    if (row) {
      if (show) {
        row.classList.remove('hidden');
      } else {
        row.classList.add('hidden');
      }
    }
    if (prev) {
      if (show) {
        prev.classList.remove('hidden');
      } else {
        prev.classList.add('hidden');
      }
    }
  } catch (e) {
    safeLog('ensureBlockVisible error: ' + (e?.message || e));
  }
}

// NOTE: showModal/hideModal removed - use modal-manager.js instead

export function toggleDebugPanel() {
  const debugPanel = getElement('#debug-panel');
  if (!debugPanel) return;

  const isVisible = !debugPanel.classList.contains('hidden');
  if (isVisible) {
    debugPanel.classList.add('hidden');
  } else {
    debugPanel.classList.remove('hidden');
  }

  const btn = getElement('#btn-toggle-debug');
  if (btn) {
    btn.textContent = isVisible ? '🔬 Debug' : '🔬 Close';
  }

  return !isVisible;
}

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

export function updateBlockSizeLabel(labelSelector, blocksCount) {
  const label = getElement(labelSelector);
  if (label) {
    label.textContent = `${t('vault.generator.blocks')} ${blocksCount}`;
  }
}

export async function initializeDOM() {
  try {
    // Check critical elements
    const criticalElements = [
      '#mode-select',
      '#qty',
      '#results-list',
      '#btn-generate',
      '#logs'
    ];

    for (const selector of criticalElements) {
      const element = getElement(selector);
      if (!element) {
        throw new Error(`Missing critical element: ${selector}`);
      }
    }

    // Initialize slider badges
    getAllElements('input[type="range"]').forEach(updateBadgeForInput);

    // Initialize visibility by mode
    updateVisibilityByMode();
    ensureBlockVisible();

    safeLog('DOM initialized successfully');

  } catch (error) {
    throw new Error(`DOM initialization error: ${error.message}`);
  }
}
