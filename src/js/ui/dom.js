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
// src/js/ui/dom.js - Utilitaires DOM optimisés
import { getCachedElement } from '../config/settings.js';
import { safeLog } from '../utils/logger.js';

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
    safeLog(`Erreur sélecteur DOM: ${selector} - ${e.message}`);
    return null;
  }
}

export function getAllElements(selector) {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch (e) {
    safeLog(`Erreur querySelectorAll: ${selector} - ${e.message}`);
    return [];
  }
}

export function addEventListener(element, event, handler, options = {}) {
  if (!element || typeof handler !== 'function') return false;
  
  try {
    element.addEventListener(event, handler, options);
    return true;
  } catch (e) {
    safeLog(`Erreur addEventListener: ${e.message}`);
    return false;
  }
}

export function updateBadgeForInput(input) {
  if (!input) return;
  try {
    const badge = input.parentNode ? input.parentNode.querySelector('.badge') : null;
    if (badge) badge.textContent = input.value;
  } catch (e) {
    safeLog(`Erreur updateBadgeForInput: ${e.message}`);
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

  safeLog(`Mode affiché: ${mode}`);
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

export function showModal(modalSelector) {
  const modal = getElement(modalSelector);
  if (modal) {
    modal.classList.add('show');
    document.body.classList.add('no-scroll');

    // Focus management
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }
}

export function hideModal(modalSelector) {
  const modal = getElement(modalSelector);
  if (modal) {
    modal.classList.remove('show');
    document.body.classList.remove('no-scroll');
  }
}

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
    btn.textContent = isVisible ? '🔬 Debug' : '🔬 Fermer';
  }

  return !isVisible;
}

export function renderChips(containerSelector, blocks, onChipClick) {
  const container = getElement(containerSelector);
  if (!container) return;

  container.innerHTML = '';

  blocks.forEach((token, index) => {
    const chip = document.createElement('button');
    chip.className = 'chip ' + (token === 'U' ? '' : token === 'l' ? 'chip-muted' : 'chip-title');
    chip.textContent = token;
    chip.title = 'Cliquer pour changer (U → l → T → U)';
    
    if (onChipClick) {
      addEventListener(chip, 'click', () => onChipClick(index));
    }
    
    container.appendChild(chip);
  });
}

export function updateBlockSizeLabel(labelSelector, blocksCount) {
  const label = getElement(labelSelector);
  if (label) {
    label.textContent = `Blocs: ${blocksCount}`;
  }
}

export async function initializeDOM() {
  try {
    // Vérifier éléments critiques
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
        throw new Error(`Élément critique manquant: ${selector}`);
      }
    }

    // Initialiser les badges des sliders
    getAllElements('input[type="range"]').forEach(updateBadgeForInput);
    
    // Initialiser la visibilité selon le mode
    updateVisibilityByMode();
    ensureBlockVisible();
    
    safeLog('DOM initialisé avec succès');
    
  } catch (error) {
    throw new Error(`Erreur initialisation DOM: ${error.message}`);
  }
}
