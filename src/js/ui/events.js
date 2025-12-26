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
// src/js/ui/events.js - Centralized event management
import { getElement, getAllElements, addEventListener, updateBadgeForInput,
         updateVisibilityByMode, ensureBlockVisible, toggleDebugPanel,
         renderChips, updateBlockSizeLabel } from './dom.js';
import { generateSyllables, generatePassphrase, generateLeet } from '../core/generators.js';
import { setCurrentDictionary } from '../core/dictionaries.js';
import { randomizeBlocks, defaultBlocksForMode } from '../core/casing.js';
import { readSettings, getBlocks, setBlocks, setResults, getResults, getUIState, setUIState } from '../config/settings.js';
import { RATE_LIMITING } from '../config/crypto-constants.js';
import { copyToClipboard, getClipboardTimeout, setClipboardTimeout, CLIPBOARD_TIMEOUT_OPTIONS } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';
import { safeLog, clearLogs } from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { renderResults, updateMaskDisplay, renderEmptyState } from './render.js';
import { initVisualPlacement, getVisualPlacement } from './placement.js';
import { createModal, showConfirm } from './modal-manager.js';

let previewTimeout = null;
let blockSyncTimeout = null;
const BLOCK_SYNC_DELAY = 200;

// AbortController for document-level event listeners
let eventsController = null;

// State for rate limiting
const generationState = {
  lastGeneration: 0,
  burstCount: 0
};

// Guards for preventing double-submission on async operations
let isGenerating = false;
let isCopying = false;
let isExporting = false;

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
  // Abort all document-level event listeners
  if (eventsController) {
    eventsController.abort();
    eventsController = null;
  }
  safeLog('Event handlers cleaned up');
}

export function bindEventHandlers() {
  try {
    // Initialize AbortController for document-level listeners
    if (eventsController) {
      eventsController.abort();
    }
    eventsController = new AbortController();

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

    // Register cleanup handler for page unload (with signal for proper cleanup)
    window.addEventListener('beforeunload', cleanupEventHandlers, { signal: eventsController.signal });

    safeLog('Event handlers bound successfully');
  } catch (error) {
    throw new Error(`Error binding event handlers: ${error.message}`);
  }
}

function bindMainActions() {
  // Main action: generate
  addEventListener(getElement('#btn-generate'), 'click', generatePasswords);

  // Secondary actions
  addEventListener(getElement('#btn-copy-all'), 'click', copyAllPasswords);
  addEventListener(getElement('#btn-export'), 'click', exportPasswords);
  addEventListener(getElement('#btn-clear'), 'click', clearResults);

  // Clipboard settings
  addEventListener(getElement('#btn-clipboard-settings'), 'click', showClipboardSettings);

  // Debug actions (btn-run-tests handled by test-integration.js)
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
    safeLog('Masking ' + (masked ? 'enabled' : 'disabled'));
  });
  
  // Dictionnaire
  addEventListener(getElement('#dict-select'), 'change', async (e) => {
    const newDict = e.target.value;
    setCurrentDictionary(newDict);
    safeLog(`Dictionary changed to: ${newDict}`);

    try {
      // Loading is handled by the dictionary system
      showToast(`Dictionary ${newDict} selected`, 'success');
    } catch (error) {
      showToast(`Dictionary error: ${newDict}`, 'error');
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
  // Update badges for all sliders
  getAllElements('input[type="range"]').forEach(updateBadgeForInput);

  function handleSliderChange(e) {
    const target = e.target;
    if (target && target.type === 'range') {
      updateBadgeForInput(target);

      if (['syll-len', 'digits-count', 'specials-count', 'pp-count'].includes(target.id)) {
        debouncedUpdatePreview();

        // Always readjust blocks if blocks mode (1 block = 3 characters)
        if (getElement('#case-mode-select')?.value === 'blocks') {
          if (target.id === 'syll-len' || target.id === 'pp-count') {
            setUIState('blockDirty', false);
            resetBlocksForCurrentMode();
          }
        }
      }
    }
  }

  // Use existing AbortController signal for document-level listeners
  const signal = eventsController?.signal;

  document.addEventListener('input', handleSliderChange, { passive: true, signal });
  document.addEventListener('change', handleSliderChange, { passive: true, signal });

  // Changes that trigger preview
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

  // Block controls
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
      const last = blocks.length > 0 ? blocks[blocks.length - 1] : 'U';
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
    showToast(t('toast.blocksRandomized'), 'success');
  });
}

/**
 * Set inert attribute on main content when modal is open
 * This prevents focus from escaping the modal for accessibility
 * @param {boolean} inert - Whether to set inert attribute
 * @export
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

function bindDebugActions() {
  // About modal
  addEventListener(getElement('#btn-about'), 'click', () => {
    const modal = getElement('#about-modal');
    if (modal) {
      modal.classList.add('show');
      setMainContentInert(true);
      // Focus first focusable element
      requestAnimationFrame(() => {
        modal.querySelector('.modal-close')?.focus();
      });
    }
  });

  addEventListener(getElement('#modal-close'), 'click', () => {
    const modal = getElement('#about-modal');
    if (modal) {
      modal.classList.remove('show');
      setMainContentInert(false);
    }
  });

  // Fermeture modal par overlay
  addEventListener(getElement('#about-modal'), 'click', (e) => {
    if (e.target === e.currentTarget) {
      const modal = getElement('#about-modal');
      if (modal) {
        modal.classList.remove('show');
        setMainContentInert(false);
      }
    }
  });

  // Fermeture modal par Escape
  addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = getElement('#about-modal');
      if (modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
        setMainContentInert(false);
      }
    }
  });

  // Section headers - collapsible with keyboard support
  const sectionHeaders = getAllElements('.section-header[role="button"]');
  sectionHeaders.forEach(header => {
    const toggleSection = () => {
      const section = header.closest('.section');
      if (!section) return;

      const isCollapsed = section.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', !isCollapsed);

      // Announce state change for screen readers
      const sectionName = header.querySelector('strong')?.textContent || 'Section';
      const announcement = isCollapsed ? `${sectionName} collapsed` : `${sectionName} expanded`;
      announceToScreenReader(announcement);
    };

    // Click handler
    header.addEventListener('click', toggleSection);

    // Keyboard handler (Enter and Space)
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSection();
      }
    });
  });
}

/**
 * Announce message to screen readers via aria-live region
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
  let announcer = document.getElementById('sr-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }
  announcer.textContent = message;
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
      : 'none';
    const specialsInfo = placementState.specials.length > 0
      ? placementState.specials.join(', ')
      : 'none';
    safeLog(`Visual placement active → digits: [${digitsInfo}] • specials: [${specialsInfo}]`);
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
    showToast(t('toast.generationError'), 'error');
    return;
  }

  setResults(results);
  renderResults(results, settings.mask);

  const dictText = settings.mode === 'passphrase'
    ? ` (${settings.specific.dictionary})`
    : '';
  const plural = results.length > 1 ? 's' : '';

  showToast(
    `Generated ${results.length} password${plural}${dictText}!`,
    'success'
  );
}

/**
 * Generate passwords with rate limiting
 * Prevents client-side DoS from excessive generation requests
 * Uses parallel generation with Promise.all for better performance
 */
async function generatePasswords() {
  // Guard against double-submission
  if (isGenerating) return;
  isGenerating = true;

  // Rate limiting check
  const now = Date.now();
  const timeSinceLastGen = now - generationState.lastGeneration;

  // Reset burst counter if window expired
  if (timeSinceLastGen > RATE_LIMITING.BURST_WINDOW_MS) {
    generationState.burstCount = 0;
  }

  // Check cooldown for non-burst requests
  if (generationState.burstCount >= RATE_LIMITING.MAX_BURST) {
    if (timeSinceLastGen < RATE_LIMITING.COOLDOWN_MS) {
      const waitTime = Math.ceil((RATE_LIMITING.COOLDOWN_MS - timeSinceLastGen) / 100) / 10;
      showToast(`Generation too fast. Please wait ${waitTime}s`, 'warning');
      safeLog(`Rate limit: ${waitTime}s remaining`);
      isGenerating = false;
      return;
    }
    generationState.burstCount = 0; // Reset after cooldown
  }

  // Update state
  generationState.lastGeneration = now;
  generationState.burstCount++;

  // Show loading state
  const btn = document.getElementById('btn-generate');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
  }

  try {
    const settings = readSettings();
    const commonConfig = buildCommonConfig(settings);

    // Log visual placement if active
    logVisualPlacement();

    safeLog(`Generation: mode=${settings.mode}, qty=${settings.qty}`);

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
    safeLog(`Generation error: ${error.message}`);
    showToast(t('toast.generationError'), 'error');
  } finally {
    // Restore button state
    isGenerating = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }
}

async function copyAllPasswords() {
  // Guard against double-submission
  if (isCopying) return;

  const results = getResults();
  if (!results?.length) {
    showToast(t('toast.noPasswordsToCopy'), 'warning');
    return;
  }

  const passwords = results
    .map(result => result?.value)
    .filter(Boolean)
    .join('\n');

  if (!passwords) {
    showToast(t('toast.noValidPasswords'), 'warning');
    return;
  }

  isCopying = true;

  // Show loading state
  const btn = document.getElementById('btn-copy-all');
  const originalHTML = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spinner" role="status" aria-label="Copying passwords..."></span>';
  }

  try {
    const success = await copyToClipboard(passwords);
    const count = passwords.split('\n').length;

    showToast(
      success
        ? `${count} password${count > 1 ? 's' : ''} copied!`
        : 'Could not copy passwords',
      success ? 'success' : 'error'
    );

    if (success) {
      safeLog(`Bulk copy: ${count} entries`);
    }
  } finally {
    // Restore button state
    isCopying = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = originalHTML;
    }
  }
}

/**
 * Show clipboard settings popover
 */
function showClipboardSettings() {
  // Remove existing popover
  document.querySelector('.clipboard-settings-popover')?.remove();

  const btn = getElement('#btn-clipboard-settings');
  if (!btn) return;

  const currentTimeout = getClipboardTimeout();

  const popover = document.createElement('div');
  popover.className = 'clipboard-settings-popover';
  popover.innerHTML = `
    <div class="clipboard-settings-header">
      <span>⏱️ Auto-clear</span>
    </div>
    <div class="clipboard-settings-body">
      <p class="clipboard-settings-desc">
        Clear clipboard automatically after copy
      </p>
      <div class="clipboard-settings-options">
        ${CLIPBOARD_TIMEOUT_OPTIONS.map(opt => `
          <button class="clipboard-option ${opt.value === currentTimeout ? 'active' : ''}"
                  data-timeout="${opt.value}">
            ${opt.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Position popover
  const rect = btn.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${rect.left}px`;
  popover.style.zIndex = '1000';

  document.body.appendChild(popover);

  // Event handlers
  popover.querySelectorAll('.clipboard-option').forEach(optBtn => {
    optBtn.addEventListener('click', () => {
      const timeout = parseInt(optBtn.dataset.timeout, 10);
      setClipboardTimeout(timeout);

      // Update active state
      popover.querySelectorAll('.clipboard-option').forEach(b => b.classList.remove('active'));
      optBtn.classList.add('active');

      showToast(timeout > 0 ? `Auto-clear: ${optBtn.textContent.trim()}` : 'Auto-clear disabled', 'success');
      setTimeout(() => popover.remove(), 300);
    });
  });

  // Close on click outside
  setTimeout(() => {
    const handler = (e) => {
      if (!popover.contains(e.target) && e.target !== btn) {
        popover.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);
}

/**
 * Exports generated passwords to a file
 * Supports formats: TXT, JSON, CSV
 */
async function exportPasswords() {
  // Guard against double-submission
  if (isExporting) return;

  const results = getResults();
  if (!results?.length) {
    showToast(t('toast.noPasswordsToExport'), 'warning');
    return;
  }

  // Ask for export format
  const format = await promptExportFormat();
  if (!format) return;

  isExporting = true;

  // Show loading state
  const btn = document.getElementById('btn-export');
  const originalHTML = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spinner" role="status" aria-label="Exporting passwords..."></span>';
  }

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
          generator: 'GenPwd Pro v3.0.0', // Synchronized with package.json
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
        showToast(t('toast.unsupportedFormat'), 'error');
        return;
    }

    // Create and download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${format.toUpperCase()} export successful (${results.length} passwords)`, 'success');
    safeLog(`Export successful: ${filename} (${results.length} entries)`);

  } catch (error) {
    safeLog(`Export error: ${error.message}`);
    showToast(t('toast.exportError'), 'error');
  } finally {
    // Restore button state
    isExporting = false;
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = originalHTML;
    }
  }
}

/**
 * Displays a dialog to choose export format
 * @returns {Promise<string|null>} Chosen format ('txt', 'json', 'csv') or null if cancelled
 */
function promptExportFormat() {
  return new Promise((resolve) => {
    const content = `
      <div class="export-modal-buttons">
        <button id="export-txt" class="btn export-modal-button">
          📄 Text (.txt) - Simple list
        </button>
        <button id="export-json" class="btn export-modal-button">
          📊 JSON (.json) - Complete data
        </button>
        <button id="export-csv" class="btn export-modal-button">
          📈 CSV (.csv) - Excel/Spreadsheet
        </button>
      </div>
    `;

    const modal = createModal({
      id: 'export-format-modal',
      title: 'Choose export format',
      content,
      actions: [
        {
          label: 'Cancel',
          className: 'btn btn-secondary',
          onClick: () => {
            modal.close();
            resolve(null);
          }
        }
      ],
      closeOnEscape: true,
      onClose: () => resolve(null)
    });

    // Add handlers for format buttons
    modal.element.querySelector('#export-txt')?.addEventListener('click', () => {
      modal.close();
      resolve('txt');
    });
    modal.element.querySelector('#export-json')?.addEventListener('click', () => {
      modal.close();
      resolve('json');
    });
    modal.element.querySelector('#export-csv')?.addEventListener('click', () => {
      modal.close();
      resolve('csv');
    });
  });
}

async function clearResults() {
  const results = getResults();
  // Only confirm if there are results to clear
  if (results && results.length > 0) {
    const confirmed = await showConfirm(t('toast.clearResultsConfirm') || 'Clear all generated passwords?', {
      title: t('actions.clearResults') || 'Clear Results',
      confirmLabel: t('common.clear') || 'Clear',
      danger: true
    });
    if (!confirmed) return;
  }

  setResults([]);
  renderEmptyState();
  showToast(t('toast.resultsCleared'), 'info');
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
      // 1 block = 3 characters (consistent with calculateBlocksCount)
      targetBlocks = Math.max(1, Math.min(10, Math.ceil(value / 3)));
      break;
    case 'passphrase':
      // 1 block per word
      targetBlocks = Math.max(1, Math.min(10, value));
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
  safeLog(`Blocks synced: ${newBlocks.join('-')} (${targetBlocks} blocks)`);
}

function debouncedUpdatePreview() {
  if (previewTimeout) {
    clearTimeout(previewTimeout);
  }
  previewTimeout = setTimeout(updatePreview, ANIMATION_DURATION.DEBOUNCE_INPUT);
}

function updatePreview() {
  // Simplified preview implementation
  const settings = readSettings();
  if (settings.caseMode !== 'blocks') return;

  const blocks = getBlocks();
  const preview = `${blocks.join('-')} • Case pattern`;
  
  const previewEl = getElement('#case-preview');
  if (previewEl) {
    previewEl.textContent = preview;
  }
}
