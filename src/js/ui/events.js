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
import { copyToClipboard, getClipboardTimeout, setClipboardTimeout, CLIPBOARD_TIMEOUT_OPTIONS } from '../utils/secure-clipboard.js';
import { showToast } from '../utils/toast.js';
import { safeLog, clearLogs } from '../utils/logger.js';
import { t } from '../utils/i18n.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';
import { renderResults, updateMaskDisplay, renderEmptyState } from './render.js';
import { initVisualPlacement, getVisualPlacement } from './placement.js';
import { createModal, showConfirm } from './modal-manager.js';
import { initQuickPresets } from './components/quick-presets.js';
import { initContextualTooltips } from './components/contextual-tooltips.js';
import { initCopyHistoryButton } from '../utils/copy-history.js';
import { VaultBridge } from './vault-bridge.js';
import { SaveToVaultModal } from './save-to-vault-modal.js';
import { Celebration, CELEBRATION_TYPES } from './components/celebration.js';
import { statsModal } from './modals/stats-modal.js';
import { recordGeneration, recordCopy } from '../utils/usage-stats.js';
import { initAchievements, checkAchievements } from '../utils/achievement-manager.js';
import { initAchievementDisplay } from './components/achievement-display.js';
import { initEntropyPreview } from './components/entropy-preview.js';
import { initCommandPalette } from './components/command-palette.js';
import { initEasterEggs } from './easter-eggs.js';

// Singleton celebration instance
let celebration = null;
function getCelebration() {
  if (!celebration) {
    celebration = new Celebration();
  }
  return celebration;
}

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
  // Initialize Quick Presets - BMAD UX
  initQuickPresets();

  // Initialize Contextual Tooltips - BMAD UX
  initContextualTooltips();

  // Initialize Copy History Button - BMAD UX
  initCopyHistoryButton();

  // Initialize BMAD Phase 5 features
  initAchievements();
  initAchievementDisplay();
  initEntropyPreview();
  initCommandPalette();
  initEasterEggs();

  // Main action: generate
  addEventListener(getElement('#btn-generate'), 'click', generatePasswords);

  // Secondary actions
  addEventListener(getElement('#btn-copy-all'), 'click', copyAllPasswords);
  addEventListener(getElement('#btn-export'), 'click', exportPasswords);
  addEventListener(getElement('#btn-clear'), 'click', clearResults);

  // Clipboard settings
  addEventListener(getElement('#btn-clipboard-settings'), 'click', showClipboardSettings);

  // Toolbar overflow menu
  bindToolbarOverflowMenu();

  // Debug actions (btn-run-tests handled by test-integration.js)
  addEventListener(getElement('#btn-toggle-debug'), 'click', () => {
    const isVisible = toggleDebugPanel();
    setUIState('debugVisible', isVisible);
  });
  addEventListener(getElement('#btn-clear-logs'), 'click', clearLogs);

  // Stats button - BMAD Phase 4
  addEventListener(getElement('#btn-stats'), 'click', () => {
    statsModal.show();
  });
}

/**
 * Binds the toolbar overflow menu toggle behavior
 * Handles click, keyboard navigation, and click-outside
 */
function bindToolbarOverflowMenu() {
  const trigger = getElement('#btn-more-actions');
  const menu = getElement('#toolbar-overflow-menu');

  if (!trigger || !menu) return;

  const signal = eventsController?.signal;

  const openMenu = () => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    // Focus first menu item
    const firstItem = menu.querySelector('.toolbar-overflow-item');
    if (firstItem) {
      requestAnimationFrame(() => firstItem.focus());
    }
  };

  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = () => {
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  // Toggle menu on trigger click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  }, { signal });

  // Keyboard navigation
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu();
    }
  }, { signal });

  // Menu item keyboard navigation
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('.toolbar-overflow-item'));
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeMenu();
        trigger.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1]?.focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex - 1]?.focus();
        } else {
          closeMenu();
          trigger.focus();
        }
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  }, { signal });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== trigger) {
      closeMenu();
    }
  }, { signal });

  // Close on Escape anywhere
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      closeMenu();
      trigger.focus();
    }
  }, { signal });
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
  
  // Dictionary
  addEventListener(getElement('#dict-select'), 'change', async (e) => {
    const newDict = e.target.value;
    setCurrentDictionary(newDict);
    safeLog(`Dictionary changed to: ${newDict}`);

    try {
      // Loading is handled by the dictionary system
      showToast(t('toast.dictionarySelected', { dict: newDict }), 'success');
    } catch (error) {
      showToast(t('toast.dictionaryError', { dict: newDict }), 'error');
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
      showToast(t('toast.blockRemoved'), 'success');
    } else {
      showToast(t('toast.blockMinReached'), 'warning');
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
      showToast(t('toast.blockAdded'), 'success');
    } else {
      showToast(t('toast.blockMaxReached'), 'warning');
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

// Import from a11y-utils to avoid circular dependency
// Re-export for backward compatibility
import { setMainContentInert } from './a11y-utils.js';
export { setMainContentInert };

// Track previously focused element for about-modal focus restoration
let aboutModalPreviousFocus = null;

function closeAboutModal() {
  const modal = getElement('#about-modal');
  if (modal && modal.classList.contains('show')) {
    modal.classList.remove('show');
    setMainContentInert(false);
    // Restore focus to trigger element
    if (aboutModalPreviousFocus && typeof aboutModalPreviousFocus.focus === 'function') {
      aboutModalPreviousFocus.focus();
      aboutModalPreviousFocus = null;
    }
  }
}

function bindDebugActions() {
  // About modal
  addEventListener(getElement('#btn-about'), 'click', () => {
    const modal = getElement('#about-modal');
    if (modal) {
      // Save previously focused element
      aboutModalPreviousFocus = document.activeElement;
      modal.classList.add('show');
      setMainContentInert(true);
      // Focus first focusable element
      requestAnimationFrame(() => {
        modal.querySelector('.modal-close')?.focus();
      });
    }
  });

  addEventListener(getElement('#modal-close'), 'click', closeAboutModal);

  // Fermeture modal par overlay
  addEventListener(getElement('#about-modal'), 'click', (e) => {
    if (e.target === e.currentTarget) {
      closeAboutModal();
    }
  });

  // Fermeture modal par Escape
  addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      closeAboutModal();
    }
  });

  // Open keyboard shortcuts via "?" key (when not typing in an input)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const modal = getElement('#about-modal');
    if (modal && !modal.classList.contains('show')) {
      aboutModalPreviousFocus = document.activeElement;
      modal.classList.add('show');
      setMainContentInert(true);
      requestAnimationFrame(() => {
        modal.querySelector('.modal-close')?.focus();
      });
    }
  }, { signal: eventsController?.signal });

  // Section headers - collapsible with keyboard support
  // Uses eventsController.signal for proper cleanup on page unload
  const sectionHeaders = getAllElements('.section-header[role="button"]');
  const signal = eventsController?.signal;

  sectionHeaders.forEach(header => {
    const toggleSection = () => {
      const section = header.closest('.section');
      if (!section) return;

      const isCollapsed = section.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', !isCollapsed);

      // Announce state change for screen readers
      const sectionName = header.querySelector('strong')?.textContent || 'Section';
      const announcement = isCollapsed
        ? t('aria.sectionCollapsed', { name: sectionName })
        : t('aria.sectionExpanded', { name: sectionName });
      announceToScreenReader(announcement);
    };

    // Click handler - uses AbortController signal for cleanup
    header.addEventListener('click', toggleSection, { signal });

    // Keyboard handler (Enter and Space) - uses AbortController signal for cleanup
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSection();
      }
    }, { signal });
  });
}

/**
 * Announce message to screen readers via aria-live region
 * @param {string} message - Message to announce
 */
export function announceToScreenReader(message) {
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
async function handleGenerationResults(results, settings) {
  if (results.length === 0) {
    showToast(t('toast.generationError'), 'error');
    return;
  }

  setResults(results);
  renderResults(results, settings.mask);

  // BMAD Phase 4: Record generation statistics
  results.forEach(result => {
    recordGeneration({
      mode: result.mode || settings.mode,
      entropy: result.entropy || 0,
      count: 1
    });
  });

  // BMAD Phase 5: Check achievements after recording stats
  checkAchievements();

  const dictText = settings.mode === 'passphrase'
    ? ` (${settings.specific.dictionary})`
    : '';

  showToast(
    t('toast.passwordsGenerated', { count: results.length, dict: dictText }),
    'success'
  );

  // BMAD UX: Confetti for strong passwords (entropy > 128 bits)
  checkAndCelebrateStrongPassword(results);

  // BMAD UX: Save suggestion - Show toast with action to save to vault
  await showSaveSuggestion(results);
}

/**
 * Check if any password has entropy > 128 bits and trigger celebration
 * @param {Array} results - Generated passwords with entropy values
 */
function checkAndCelebrateStrongPassword(results) {
  const STRONG_ENTROPY_THRESHOLD = 128;

  // Check if any password exceeds the threshold
  const strongPasswords = results.filter(result =>
    result?.entropy && result.entropy >= STRONG_ENTROPY_THRESHOLD
  );

  if (strongPasswords.length > 0) {
    // Trigger celebration!
    getCelebration().celebrate(CELEBRATION_TYPES.STRONG_PASSWORD, {
      count: strongPasswords.length
    });
  }
}

/**
 * Show a save suggestion toast if vault is available and unlocked
 * @param {Array} results - Generated passwords
 */
async function showSaveSuggestion(results) {
  // Only suggest if vault is available
  if (!VaultBridge.isAvailable()) {
    return;
  }

  // Check if vault is unlocked
  const isUnlocked = await VaultBridge.isUnlocked();
  if (!isUnlocked) {
    return;
  }

  // Get the first password (usually the one user wants to save)
  const firstResult = results[0];
  if (!firstResult?.value) {
    return;
  }

  // Show save suggestion toast with action (with slight delay for better UX)
  setTimeout(() => {
    showToast(
      t('saveSuggestion.prompt'),
      'info',
      {
        action: {
          label: t('saveSuggestion.action'),
          onClick: () => {
            SaveToVaultModal.open(firstResult.value);
          }
        }
      }
    );
  }, 800);
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
      showToast(t('toast.generationTooFast', { time: waitTime }), 'warning');
      safeLog(`Rate limit: ${waitTime}s remaining`);
      isGenerating = false;
      return;
    }
    generationState.burstCount = 0; // Reset after cooldown
  }

  // Update state
  generationState.lastGeneration = now;
  generationState.burstCount++;

  // Show loading state with visual spinner
  const btn = document.getElementById('btn-generate');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('btn-loading'); // CSS handles spinner display
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
      btn.classList.remove('btn-loading');
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
    btn.innerHTML = `<span class="spinner" role="status" aria-label="${t('actions.copyingPasswords')}"></span>`;
  }

  try {
    const success = await copyToClipboard(passwords);
    const count = passwords.split('\n').length;

    showToast(
      success
        ? t('toast.passwordsCopied', { count })
        : t('toast.copyFailed'),
      success ? 'success' : 'error'
    );

    if (success) {
      safeLog(`Bulk copy: ${count} entries`);
      // BMAD Phase 5: Record copy and check achievements
      for (let i = 0; i < count; i++) {
        recordCopy();
      }
      checkAchievements();
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
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', t('clipboard.settingsAriaLabel'));
  popover.innerHTML = `
    <div class="clipboard-settings-header">
      <span>${t('clipboard.autoClearTitle')}</span>
    </div>
    <div class="clipboard-settings-body">
      <p class="clipboard-settings-desc" id="clipboard-desc">
        ${t('clipboard.autoClearDesc')}
      </p>
      <div class="clipboard-settings-options" role="listbox" aria-describedby="clipboard-desc">
        ${CLIPBOARD_TIMEOUT_OPTIONS.map(opt => `
          <button class="clipboard-option ${opt.value === currentTimeout ? 'active' : ''}"
                  data-timeout="${opt.value}"
                  role="option"
                  aria-selected="${opt.value === currentTimeout}"
                  aria-label="${t('clipboard.setAutoClearTo', { time: opt.label })}">
            ${opt.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Position popover with viewport boundary detection
  const rect = btn.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 8;

  let top = rect.bottom + padding;
  let left = rect.left;

  document.body.appendChild(popover);

  // Adjust position after appending (to get actual dimensions)
  const popoverRect = popover.getBoundingClientRect();

  // Prevent going off right edge
  if (left + popoverRect.width + padding > viewportWidth) {
    left = viewportWidth - popoverRect.width - padding;
  }

  // Prevent going off bottom edge - show above button instead
  if (top + popoverRect.height + padding > viewportHeight) {
    top = rect.top - popoverRect.height - padding;
  }

  // Prevent going off left/top edge
  left = Math.max(padding, left);
  top = Math.max(padding, top);

  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;

  // Get all options for keyboard navigation
  const options = Array.from(popover.querySelectorAll('.clipboard-option'));
  let currentIndex = options.findIndex(opt => opt.classList.contains('active'));
  if (currentIndex === -1) currentIndex = 0;

  // Focus first option
  options[currentIndex]?.focus();

  // Select option handler
  const selectOption = (optBtn) => {
    const timeout = parseInt(optBtn.dataset.timeout, 10);
    setClipboardTimeout(timeout);

    // Update active and aria-selected state
    options.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    optBtn.classList.add('active');
    optBtn.setAttribute('aria-selected', 'true');

    showToast(timeout > 0 ? t('toast.autoClearEnabled', { time: optBtn.textContent.trim() }) : t('toast.autoClearDisabled'), 'success');
    setTimeout(() => {
      popover.remove();
      btn.focus(); // Return focus to trigger button
    }, 300);
  };

  // AbortController for cleanup
  const abortController = new AbortController();
  const { signal } = abortController;

  const closePopover = () => {
    abortController.abort();
    popover.remove();
    btn.focus();
  };

  // Event handlers for options
  options.forEach(optBtn => {
    optBtn.addEventListener('click', () => selectOption(optBtn), { signal });
  });

  // Keyboard navigation handler
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closePopover();
        break;
      case 'ArrowDown':
        e.preventDefault();
        currentIndex = (currentIndex + 1) % options.length;
        options[currentIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        currentIndex = (currentIndex - 1 + options.length) % options.length;
        options[currentIndex]?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectOption(options[currentIndex]);
        break;
      case 'Tab':
        closePopover();
        break;
    }
  }, { signal });

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== btn) {
        closePopover();
      }
    }, { signal });
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
    btn.innerHTML = `<span class="spinner" role="status" aria-label="${t('actions.exportingPasswords')}"></span>`;
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
          generator: 'GenPwd Pro v3.1.0', // Synchronized with package.json
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
        const headers = [
          t('export.csvHeaders.password'),
          t('export.csvHeaders.mode'),
          t('export.csvHeaders.entropy'),
          t('export.csvHeaders.length'),
          t('export.csvHeaders.details')
        ];
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

    showToast(t('toast.exportSuccess', { format: format.toUpperCase(), count: results.length }), 'success');
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
          ${t('export.txtButton')}
        </button>
        <button id="export-json" class="btn export-modal-button">
          ${t('export.jsonButton')}
        </button>
        <button id="export-csv" class="btn export-modal-button">
          ${t('export.csvButton')}
        </button>
      </div>
    `;

    const modal = createModal({
      id: 'export-format-modal',
      title: t('export.simpleTitle'),
      content,
      actions: [
        {
          label: t('common.cancel'),
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
  // Only confirm if there are results to clear (skip during automated tests)
  if (results && results.length > 0 && !window._testMode) {
    const confirmed = await showConfirm(t('toast.clearResultsConfirm'), {
      title: t('actions.clearResults'),
      confirmLabel: t('common.clear'),
      danger: true
    });
    if (!confirmed) return;
  }

  setResults([]);
  renderEmptyState();
  if (!window._testMode) {
    showToast(t('toast.resultsCleared'), 'info');
  }
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
