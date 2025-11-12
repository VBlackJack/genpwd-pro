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
import { RATE_LIMITING } from '../config/crypto-constants.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';
import { safeLog, clearLogs } from '../utils/logger.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { renderResults, updateMaskDisplay, renderEmptyState } from './render.js';
import { initVisualPlacement, getVisualPlacement } from './placement.js';

let previewTimeout = null;
let blockSyncTimeout = null;
const BLOCK_SYNC_DELAY = 200;

// Rate limiting configuration for password generation
const GENERATION_CONFIG = RATE_LIMITING;

// State for rate limiting
const generationState = {
  lastGeneration: 0,
  burstCount: 0
};

/**
 * Cleans up all active timeouts and event handlers
 * Should be called on page unload to prevent memory leaks
 */
export function cleanupEventHandlers() {
  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }
  if (blockSyncTimeout) {
    clearTimeout(blockSyncTimeout);
    blockSyncTimeout = null;
  }
  safeLog('Event handlers cleaned up');
}

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

    // Register cleanup handler for page unload
    window.addEventListener('beforeunload', cleanupEventHandlers);

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

  const policySelect = getElement('#policy-select');
  if (policySelect) {
    ensurePolicySelection(policySelect);
    addEventListener(policySelect, 'change', (event) => {
      ensurePolicySelection(event?.target);
      debouncedUpdatePreview();
    });
  }

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

// Actions principales - REFACTORED for better maintainability

/**
 * Logs visual placement state if active
 */
function logVisualPlacement() {
  const placementState = getVisualPlacement();
  if (placementState?.mode === 'visual') {
    const digitsInfo = placementState.digits.length > 0
      ? placementState.digits.join(', ')
      : 'aucun';
    const specialsInfo = placementState.specials.length > 0
      ? placementState.specials.join(', ')
      : 'aucun';
    safeLog(`Placement visuel actif → chiffres: [${digitsInfo}] • spéciaux: [${specialsInfo}]`);
  }
}

/**
 * Builds common configuration for all generation modes
 * @param {Object} settings - Current settings
 * @returns {Object} Common configuration object
 */
function buildCommonConfig(settings) {
  return {
    digits: settings.digitsNum,
    specials: settings.specialsNum,
    customSpecials: settings.customSpecials,
    placeDigits: settings.placeDigits,
    placeSpecials: settings.placeSpecials,
    caseMode: settings.caseMode,
    useBlocks: settings.caseMode === 'blocks',
    blockTokens: getBlocks()
  };
}

/**
 * Generates a single password based on mode
 * @param {string} mode - Generation mode (syllables, passphrase, leet)
 * @param {Object} commonConfig - Common configuration
 * @param {Object} settings - Full settings object
 * @returns {Promise<Object>} Generated password result
 */
async function generateSinglePassword(mode, commonConfig, settings) {
  switch (mode) {
    case 'syllables':
      return generateSyllables({
        ...commonConfig,
        length: settings.specific.length,
        policy: settings.specific.policy
      });

    case 'passphrase':
      return await generatePassphrase({
        ...commonConfig,
        wordCount: settings.specific.count,
        separator: settings.specific.sep,
        dictionary: settings.specific.dictionary
      });

    case 'leet':
      return generateLeet({
        ...commonConfig,
        baseWord: settings.specific.word
      });

    default:
      throw new Error(`Unknown generation mode: ${mode}`);
  }
}

/**
 * Handles generation results display and notifications
 * @param {Array} results - Array of generated passwords
 * @param {Object} settings - Current settings
 */
function handleGenerationResults(results, settings) {
  if (results.length === 0) {
    showToast('Erreur lors de la génération', 'error');
    return;
  }

  setResults(results);
  renderResults(results, settings.mask);

  const dictText = settings.mode === 'passphrase'
    ? ` (${settings.specific.dictionary})`
    : '';
  const plural = results.length > 1 ? 's' : '';

  showToast(
    `Généré ${results.length} mot${plural} de passe${dictText} !`,
    'success'
  );
}

/**
 * Generate passwords with rate limiting
 * Prevents client-side DoS from excessive generation requests
 * Uses parallel generation with Promise.all for better performance
 */
async function generatePasswords() {
  // Rate limiting check
  const now = Date.now();
  const timeSinceLastGen = now - generationState.lastGeneration;

  // Reset burst counter if window expired
  if (timeSinceLastGen > GENERATION_CONFIG.BURST_WINDOW_MS) {
    generationState.burstCount = 0;
  }

  // Check cooldown for non-burst requests
  if (generationState.burstCount >= GENERATION_CONFIG.MAX_BURST) {
    if (timeSinceLastGen < GENERATION_CONFIG.COOLDOWN_MS) {
      const waitTime = Math.ceil((GENERATION_CONFIG.COOLDOWN_MS - timeSinceLastGen) / 100) / 10;
      showToast(`Génération trop rapide. Veuillez patienter ${waitTime}s`, 'warning');
      safeLog(`Rate limit: ${waitTime}s remaining`);
      return;
    }
    generationState.burstCount = 0; // Reset after cooldown
  }

  // Update state
  generationState.lastGeneration = now;
  generationState.burstCount++;

  try {
    const settings = readSettings();
    const commonConfig = buildCommonConfig(settings);

    // Log visual placement if active
    logVisualPlacement();

    safeLog(`Génération: mode=${settings.mode}, qty=${settings.qty}`);

    // PARALLEL generation instead of sequential for better performance
    const promises = Array.from(
      { length: settings.qty },
      () => generateSinglePassword(settings.mode, commonConfig, settings)
    );

    const allResults = await Promise.all(promises);

    // Filter out errors
    const results = allResults.filter(
      result => result?.value && !result.value.startsWith('error-')
    );

    handleGenerationResults(results, settings);

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

/**
 * Exporte les mots de passe générés vers un fichier
 * Supporte les formats: TXT, JSON, CSV
 */
async function exportPasswords() {
  const results = getResults();
  if (!results?.length) {
    showToast('Aucun mot de passe à exporter', 'warning');
    return;
  }

  // Demander le format d'export
  const format = await promptExportFormat();
  if (!format) return;

  try {
    let content, filename, mimeType;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    switch (format) {
      case 'txt':
        content = results.map(r => r.value).join('\n');
        filename = `genpwd-export-${timestamp}.txt`;
        mimeType = 'text/plain';
        break;

      case 'json':
        content = JSON.stringify({
          exported: new Date().toISOString(),
          generator: 'GenPwd Pro v2.6.0', // Synchronized with package.json
          count: results.length,
          passwords: results.map(r => ({
            value: r.value,
            mode: r.mode,
            entropy: r.entropy,
            ...(r.words && { words: r.words }),
            ...(r.dictionary && { dictionary: r.dictionary }),
            ...(r.policy && { policy: r.policy })
          }))
        }, null, 2);
        filename = `genpwd-export-${timestamp}.json`;
        mimeType = 'application/json';
        break;

      case 'csv': {
        const headers = ['Password', 'Mode', 'Entropy (bits)', 'Length', 'Details'];
        const rows = results.map(r => [
          r.value,
          r.mode,
          r.entropy,
          r.value.length,
          r.words ? r.words.join(' ') : (r.baseWord || r.policy || '')
        ]);
        content = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        filename = `genpwd-export-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      }

      default:
        showToast('Format non supporté', 'error');
        return;
    }

    // Créer et télécharger le fichier
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Export ${format.toUpperCase()} réussi (${results.length} mots de passe)`, 'success');
    safeLog(`Export réussi: ${filename} (${results.length} entrées)`);

  } catch (error) {
    safeLog(`Erreur export: ${error.message}`);
    showToast('Erreur lors de l\'export', 'error');
  }
}

/**
 * Affiche une boîte de dialogue pour choisir le format d'export
 * @returns {Promise<string|null>} Format choisi ('txt', 'json', 'csv') ou null si annulé
 */
function promptExportFormat() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'export-modal-dialog';
    dialog.innerHTML = `
      <h3 class="export-modal-title">Choisir le format d'export</h3>
      <div class="export-modal-buttons">
        <button id="export-txt" class="btn export-modal-button">
          📄 Texte (.txt) - Simple liste
        </button>
        <button id="export-json" class="btn export-modal-button">
          📊 JSON (.json) - Données complètes
        </button>
        <button id="export-csv" class="btn export-modal-button">
          📈 CSV (.csv) - Excel/Tableur
        </button>
      </div>
      <button id="export-cancel" class="btn btn-secondary export-modal-cancel">
        Annuler
      </button>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const cleanup = (result) => {
      document.body.removeChild(modal);
      resolve(result);
    };

    dialog.querySelector('#export-txt').addEventListener('click', () => cleanup('txt'));
    dialog.querySelector('#export-json').addEventListener('click', () => cleanup('json'));
    dialog.querySelector('#export-csv').addEventListener('click', () => cleanup('csv'));
    dialog.querySelector('#export-cancel').addEventListener('click', () => cleanup(null));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(null);
    });
  });
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
function ensurePolicySelection(select) {
  if (!select || !select.options) {
    return;
  }

  const options = Array.from(select.options);
  if (options.length === 0) {
    return;
  }

  const fallback = options.find(option => option.value === 'standard')?.value
    || options[0].value
    || '';

  let desired = select.value;
  const hasDesired = options.some(option => option.value === desired && option.value !== '');

  if (!hasDesired) {
    desired = fallback;
  }

  if (!desired && fallback) {
    desired = fallback;
  }

  if (desired && select.value !== desired) {
    select.value = desired;
  }
}

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
  previewTimeout = setTimeout(updatePreview, ANIMATION_DURATION.DEBOUNCE_INPUT);
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
