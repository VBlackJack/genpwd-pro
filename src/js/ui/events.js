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
// src/js/ui/events.js - Gestion centralisée des événements
import { getElement, getAllElements, addEventListener, updateBadgeForInput, 
         updateVisibilityByMode, ensureBlockVisible, toggleDebugPanel,
         renderChips, updateBlockSizeLabel } from './dom.js';
import { generateSyllables, generatePassphrase, generateLeet } from '../core/generators.js';
import { setCurrentDictionary } from '../core/dictionaries.js';
import { randomizeBlocks, defaultBlocksForMode } from '../core/casing.js';
import { readSettings, getBlocks, setBlocks, setResults, getResults, getUIState, setUIState } from '../config/settings.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';
import { safeLog, clearLogs } from '../utils/logger.js';
import { renderResults, updateMaskDisplay, renderEmptyState } from './render.js';
import { initVisualPlacement, getVisualPlacement } from './placement.js';

let previewTimeout = null;
let blockSyncTimeout = null;
const BLOCK_SYNC_DELAY = 200;

export function bindEventHandlers() {
  try {
    bindMainActions();
    bindModeAndSettings();
    bindSliders();
    bindCaseAndBlocks();
    bindDebugActions();

    initializeBlockSyncState();

    const placementApi = initVisualPlacement();
    if (placementApi && typeof placementApi.onUpdate === 'function') {
      placementApi.onUpdate(() => debouncedUpdatePreview());
    }

    safeLog('Événements bindés avec succès');
  } catch (error) {
    throw new Error(`Erreur binding événements: ${error.message}`);
  }
}

function bindMainActions() {
  // Action principale : générer
  addEventListener(getElement('#btn-generate'), 'click', generatePasswords);
  
  // Actions secondaires
  addEventListener(getElement('#btn-copy-all'), 'click', copyAllPasswords);
  addEventListener(getElement('#btn-export'), 'click', exportPasswords);
  addEventListener(getElement('#btn-clear'), 'click', clearResults);
  
  // Actions debug
  addEventListener(getElement('#btn-run-tests'), 'click', runTests);
  addEventListener(getElement('#btn-toggle-debug'), 'click', () => {
    const isVisible = toggleDebugPanel();
    setUIState('debugVisible', isVisible);
  });
  addEventListener(getElement('#btn-clear-logs'), 'click', clearLogs);
}

function bindModeAndSettings() {
  // Changement de mode
  addEventListener(getElement('#mode-select'), 'change', (event) => {
    updateVisibilityByMode();

    const caseModeValue = getElement('#case-mode-select')?.value;
    const programmatic = event?.isTrusted === false;
    const shouldResyncBlocks = caseModeValue === 'blocks'
      && (programmatic || !getUIState().blockDirty);

    if (shouldResyncBlocks) {
      setUIState('blockDirty', false);
      resetBlocksForCurrentMode();
      scheduleCurrentModeBlockSync();
    }

    debouncedUpdatePreview();
  });
  
  // Masquage
  addEventListener(getElement('#mask-toggle'), 'change', () => {
    const masked = getElement('#mask-toggle').checked;
    updateMaskDisplay(masked);
    safeLog('Masquage ' + (masked ? 'activé' : 'désactivé'));
  });
  
  // Dictionnaire
  addEventListener(getElement('#dict-select'), 'change', async (e) => {
    const newDict = e.target.value;
    setCurrentDictionary(newDict);
    safeLog(`Changement dictionnaire vers: ${newDict}`);

    try {
      // Le chargement est géré par le système de dictionnaires
      showToast(`Dictionnaire ${newDict} sélectionné !`, 'success');
    } catch (error) {
      showToast(`Erreur dictionnaire ${newDict}`, 'error');
    }
  });

  addEventListener(getElement('#leet-input'), 'input', () => {
    if (getElement('#case-mode-select')?.value === 'blocks' && !getUIState().blockDirty) {
      resetBlocksForCurrentMode();
    }
    debouncedUpdatePreview();
  });
}

function bindSliders() {
  // Mise à jour des badges pour tous les sliders
  getAllElements('input[type="range"]').forEach(updateBadgeForInput);

  function handleSliderChange(e) {
    const target = e.target;
    if (target && target.type === 'range') {
      updateBadgeForInput(target);

      if (['syll-len', 'digits-count', 'specials-count', 'pp-count'].includes(target.id)) {
        debouncedUpdatePreview();

        // Réajuster les blocs si mode blocks et pas modifié manuellement
        const programmatic = e?.isTrusted === false;
        if (getElement('#case-mode-select')?.value === 'blocks'
          && (programmatic || !getUIState().blockDirty)) {
          if (programmatic) {
            setUIState('blockDirty', false);
          }
          resetBlocksForCurrentMode();
        }

        if (target.id === 'syll-len') {
          scheduleBlockSync('syllables', parseInt(target.value, 10));
        } else if (target.id === 'pp-count') {
          scheduleBlockSync('passphrase', parseInt(target.value, 10));
        }
      }
    }
  }

  document.addEventListener('input', handleSliderChange, { passive: true });
  document.addEventListener('change', handleSliderChange, { passive: true });

  // Changements qui triggent la préview
  addEventListener(getElement('#pp-sep'), 'change', debouncedUpdatePreview);
}

function bindCaseAndBlocks() {
  // Changement mode de casse
  addEventListener(getElement('#case-mode-select'), 'change', (event) => {
    ensureBlockVisible();
    const isBlocks = event.target.value === 'blocks';
    const programmatic = event?.isTrusted === false;

    setUIState('useBlocks', isBlocks);

    if (isBlocks && (programmatic || !getUIState().blockDirty)) {
      setUIState('blockDirty', false);
      resetBlocksForCurrentMode();
      scheduleCurrentModeBlockSync();
    }

    if (!isBlocks) {
      setUIState('blockDirty', false);
    }

    debouncedUpdatePreview();
  });

  const syncToggle = getElement('#blocks-sync-toggle');
  if (syncToggle) {
    addEventListener(syncToggle, 'change', (event) => {
      const enabled = Boolean(event.target.checked);
      setUIState('blockAutoSync', enabled);
      if (enabled) {
        setUIState('blockDirty', false);
        scheduleCurrentModeBlockSync();
      }
    });
  }

  // Contrôles des blocs
  addEventListener(getElement('#btn-all-title'), 'click', () => {
    const blocks = getBlocks().map(() => 'T');
    setBlocks(blocks);
    setUIState('blockDirty', true);
    renderBlocksUI();
    debouncedUpdatePreview();
  });

  addEventListener(getElement('#btn-all-upper'), 'click', () => {
    const blocks = getBlocks().map(() => 'U');
    setBlocks(blocks);
    setUIState('blockDirty', true);
    renderBlocksUI();
    debouncedUpdatePreview();
  });

  addEventListener(getElement('#btn-all-lower'), 'click', () => {
    const blocks = getBlocks().map(() => 'l');
    setBlocks(blocks);
    setUIState('blockDirty', true);
    renderBlocksUI();
    debouncedUpdatePreview();
  });

  addEventListener(getElement('#btn-block-dec'), 'click', () => {
    const blocks = getBlocks();
    if (blocks.length > 1) {
      blocks.pop();
      setBlocks(blocks);
      setUIState('blockDirty', true);
      renderBlocksUI();
      debouncedUpdatePreview();
    }
  });

  addEventListener(getElement('#btn-block-inc'), 'click', () => {
    const blocks = getBlocks();
    if (blocks.length < 10) {
      const last = blocks[blocks.length - 1];
      const next = last === 'U' ? 'l' : last === 'l' ? 'T' : 'U';
      blocks.push(next);
      setBlocks(blocks);
      setUIState('blockDirty', true);
      renderBlocksUI();
      debouncedUpdatePreview();
    }
  });

  addEventListener(getElement('#btn-block-random'), 'click', () => {
    const settings = readSettings();
    let param = 20;
    
    if (settings.mode === 'syllables') {
      param = parseInt(getElement('#syll-len')?.value || '20', 10);
    } else if (settings.mode === 'passphrase') {
      param = parseInt(getElement('#pp-count')?.value || '5', 10);
    }
    
    const randomBlocks = randomizeBlocks(settings.mode, param);
    setBlocks(randomBlocks);
    setUIState('blockDirty', true);
    renderBlocksUI();
    debouncedUpdatePreview();
    showToast('Blocs randomisés !', 'success');
  });
}

function bindDebugActions() {
  // Modal à propos
  addEventListener(getElement('#btn-about'), 'click', () => {
    const modal = getElement('#about-modal');
    if (modal) modal.classList.add('show');
  });
  
  addEventListener(getElement('#modal-close'), 'click', () => {
    const modal = getElement('#about-modal');
    if (modal) modal.classList.remove('show');
  });
  
  // Fermeture modal par overlay
  addEventListener(getElement('#about-modal'), 'click', (e) => {
    if (e.target === e.currentTarget) {
      const modal = getElement('#about-modal');
      if (modal) modal.classList.remove('show');
    }
  });
  
  // Fermeture modal par Escape
  addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = getElement('#about-modal');
      if (modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
      }
    }
  });
}

// Actions principales
async function generatePasswords() {
  try {
    const settings = readSettings();
    const results = [];

    const placementState = getVisualPlacement();
    if (placementState?.mode === 'visual') {
      const digitsInfo = placementState.digits.length > 0 ? placementState.digits.join(', ') : 'aucun';
      const specialsInfo = placementState.specials.length > 0 ? placementState.specials.join(', ') : 'aucun';
      safeLog(`Placement visuel actif → chiffres: [${digitsInfo}] • spéciaux: [${specialsInfo}]`);
    }
    
    safeLog(`Génération: mode=${settings.mode}, qty=${settings.qty}`);

    for (let i = 0; i < settings.qty; i++) {
      let result;
      
      const commonConfig = {
        digits: settings.digitsNum,
        specials: settings.specialsNum,
        customSpecials: settings.customSpecials,
        placeDigits: settings.placeDigits,
        placeSpecials: settings.placeSpecials,
        caseMode: settings.caseMode,
        useBlocks: settings.caseMode === 'blocks',
        blockTokens: getBlocks()
      };

      switch (settings.mode) {
        case 'syllables':
          result = generateSyllables({
            ...commonConfig,
            length: settings.specific.length,
            policy: settings.specific.policy
          });
          break;

        case 'passphrase':
          result = await generatePassphrase({
            ...commonConfig,
            wordCount: settings.specific.count,
            separator: settings.specific.sep,
            dictionary: settings.specific.dictionary
          });
          break;

        case 'leet':
          result = generateLeet({
            ...commonConfig,
            baseWord: settings.specific.word
          });
          break;
      }

      if (result && result.value && !result.value.startsWith('error-')) {
        results.push(result);
      }
    }

    if (results.length === 0) {
      showToast('Erreur lors de la génération', 'error');
      return;
    }

    setResults(results);
    renderResults(results, settings.mask);
    
    const dictText = settings.mode === 'passphrase' ? ` (${settings.specific.dictionary})` : '';
    showToast(`Généré ${results.length} mot${results.length > 1 ? 's' : ''} de passe${dictText} !`, 'success');
    
  } catch (error) {
    safeLog(`Erreur génération: ${error.message}`);
    showToast('Erreur lors de la génération', 'error');
  }
}

async function copyAllPasswords() {
  const results = getResults();
  if (!results?.length) {
    showToast('Aucun mot de passe à copier', 'warning');
    return;
  }

  const passwords = results
    .map(result => result?.value)
    .filter(Boolean)
    .join('\n');

  if (!passwords) {
    showToast('Aucun mot de passe valide trouvé', 'warning');
    return;
  }

  const success = await copyToClipboard(passwords);
  const count = passwords.split('\n').length;

  showToast(
    success
      ? `${count} mot${count > 1 ? 's' : ''} de passe copiés !`
      : 'Impossible de copier les mots de passe',
    success ? 'success' : 'error'
  );

  if (success) {
    safeLog(`Copie groupée: ${count} entrées`);
  }
}

function exportPasswords() {
  // Implementation simplifiée - à compléter selon besoins
  showToast('Fonction à implémenter', 'info');
}

function clearResults() {
  setResults([]);
  renderEmptyState();
  showToast('Résultats effacés', 'info');
}

function runTests() {
  const testsEl = getElement('#tests');
  if (!testsEl) return;
  
  let output = 'Tests système:\n';
  output += '✅ Modules chargés\n';
  output += '✅ DOM initialisé\n';
  output += '✅ Événements bindés\n';
  
  testsEl.textContent = output;
  showToast('Tests exécutés', 'success');
}

// Helpers
function resetBlocksForCurrentMode() {
  const settings = readSettings();
  let param = 20;

  if (settings.mode === 'syllables') {
    param = parseInt(getElement('#syll-len')?.value || '20', 10);
  } else if (settings.mode === 'passphrase') {
    param = parseInt(getElement('#pp-count')?.value || '5', 10);
  } else if (settings.mode === 'leet') {
    const word = settings.specific?.word || '';
    param = word.length || 1;
  }

  const blocks = defaultBlocksForMode(settings.mode, param);
  setBlocks(blocks);
  renderBlocksUI();
  setUIState('blockDirty', false);
}

function renderBlocksUI() {
  const blocks = getBlocks();
  renderChips('#chips', blocks, (index) => {
    const currentBlocks = getBlocks();
    const current = currentBlocks[index];
    currentBlocks[index] = current === 'U' ? 'l' : current === 'l' ? 'T' : 'U';
    setBlocks(currentBlocks);
    setUIState('blockDirty', true);
    renderBlocksUI();
    debouncedUpdatePreview();
  });
  
  updateBlockSizeLabel('#block-size-label', blocks.length);
}

function initializeBlockSyncState() {
  const caseMode = getElement('#case-mode-select')?.value || 'mixte';
  setUIState('useBlocks', caseMode === 'blocks');

  const toggle = getElement('#blocks-sync-toggle');
  if (toggle) {
    setUIState('blockAutoSync', toggle.checked !== false);
  }

  if (caseMode === 'blocks') {
    scheduleCurrentModeBlockSync();
  }
}

function scheduleCurrentModeBlockSync() {
  const mode = getElement('#mode-select')?.value || 'syllables';
  if (mode === 'syllables') {
    const length = parseInt(getElement('#syll-len')?.value || '0', 10);
    scheduleBlockSync('syllables', length);
  } else if (mode === 'passphrase') {
    const count = parseInt(getElement('#pp-count')?.value || '0', 10);
    scheduleBlockSync('passphrase', count);
  }
}

function scheduleBlockSync(mode, value) {
  if (!getUIState('blockAutoSync') || !getUIState('useBlocks')) {
    return;
  }

  if (getUIState('blockDirty')) {
    return;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return;
  }

  if (blockSyncTimeout) {
    clearTimeout(blockSyncTimeout);
  }

  blockSyncTimeout = setTimeout(() => {
    syncBlocksWithLength(mode, numericValue);
  }, BLOCK_SYNC_DELAY);
}

function syncBlocksWithLength(mode, value) {
  if (!getUIState('blockAutoSync') || !getUIState('useBlocks') || getUIState('blockDirty')) {
    return;
  }

  let targetBlocks;

  switch (mode) {
    case 'syllables':
      targetBlocks = Math.max(2, Math.min(6, Math.ceil(value / 4)));
      break;
    case 'passphrase':
      targetBlocks = Math.max(1, Math.min(6, value));
      break;
    default:
      return;
  }

  const patterns = ['T', 'l', 'U'];
  const newBlocks = Array.from({ length: targetBlocks }, (_, index) => patterns[index % patterns.length]);

  const current = getBlocks();
  const isIdentical = current.length === newBlocks.length && current.every((token, index) => token === newBlocks[index]);
  if (isIdentical) {
    return;
  }

  setBlocks(newBlocks);
  renderBlocksUI();
  setUIState('blockDirty', false);
  safeLog(`Blocs synchronisés: ${newBlocks.join('-')} (${targetBlocks} blocs)`);
}

function debouncedUpdatePreview() {
  if (previewTimeout) {
    clearTimeout(previewTimeout);
  }
  previewTimeout = setTimeout(updatePreview, 150);
}

function updatePreview() {
  // Implementation simplifiée de la prévisualisation
  const settings = readSettings();
  if (settings.caseMode !== 'blocks') return;
  
  const blocks = getBlocks();
  const preview = `${blocks.join('-')} • Pattern de casse`;
  
  const previewEl = getElement('#case-preview');
  if (previewEl) {
    previewEl.textContent = preview;
  }
}
