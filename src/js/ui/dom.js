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
  if (syllEl) syllEl.style.display = (mode === 'syllables') ? '' : 'none';
  
  const ppEl = getElement('#mode-passphrase-opts');
  if (ppEl) ppEl.style.display = (mode === 'passphrase') ? '' : 'none';
  
  const leetEl = getElement('#mode-leet-opts');
  if (leetEl) leetEl.style.display = (mode === 'leet') ? '' : 'none';
  
  safeLog(`Mode affiché: ${mode}`);
}

export function ensureBlockVisible() {
  try {
    const caseModeSelect = getElement('#case-mode-select');
    const currentValue = caseModeSelect ? caseModeSelect.value : null;
    const show = currentValue === 'blocks';

    const row = getElement('#blocks-editor-row');
    const prev = getElement('#case-preview-row');

    if (row) row.style.display = show ? '' : 'none';
    if (prev) prev.style.display = show ? '' : 'none';
  } catch (e) {
    safeLog('ensureBlockVisible error: ' + (e?.message || e));
  }
}

export function showModal(modalSelector) {
  const modal = getElement(modalSelector);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Focus management
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }
}

export function hideModal(modalSelector) {
  const modal = getElement(modalSelector);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

export function toggleDebugPanel() {
  const debugPanel = getElement('#debug-panel');
  if (!debugPanel) return;

  const isVisible = debugPanel.style.display !== 'none';
  debugPanel.style.display = isVisible ? 'none' : 'block';

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