/**
 * Keyboard Shortcuts Module
 * Implements accessibility keyboard shortcuts for GenPwd Pro
 *
 * @module keyboard-shortcuts
 * @version 3.1.1
 * @description Provides keyboard navigation and shortcuts for accessibility
 *
 * Shortcuts (Generator tab only):
 * - Alt+G: Generate passwords
 * - Alt+C: Copy all passwords
 * - Alt+R: Run tests
 * - Alt+S: Export results
 * - Escape: Close modals (works everywhere)
 *
 * Note: Alt key avoids conflicts with browser and system shortcuts
 */

import { t } from './i18n.js';

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);

  // Log initialization
  if (window.log) {
    window.log('[Keyboard] Shortcuts initialized - Alt+G/C/R/S, Escape');
  }
}

/**
 * Handle keyboard shortcut events
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyboardShortcut(event) {
  // Check if we're in an input field (don't interfere with typing)
  const activeElement = document.activeElement;
  const isInputField = activeElement.tagName === 'INPUT' ||
                       activeElement.tagName === 'TEXTAREA' ||
                       activeElement.tagName === 'SELECT' ||
                       activeElement.isContentEditable;

  // Escape key always works (close modals)
  if (event.key === 'Escape') {
    handleEscapeKey();
    return;
  }

  // Don't process Alt shortcuts when typing in input fields
  if (isInputField) {
    return;
  }

  // Only handle shortcuts when generator tab is active (not in vault)
  // Check if vault tab is currently visible/active
  const vaultContainer = document.getElementById('vault-container');
  const isVaultActive = vaultContainer && !vaultContainer.hidden && vaultContainer.offsetParent !== null;
  if (isVaultActive) {
    return;
  }

  // Handle Alt+ combinations (avoids conflicts with browser/system shortcuts)
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    const key = event.key.toLowerCase();

    switch (key) {
      case 'g':
        event.preventDefault();
        triggerGenerate();
        break;
      case 'c':
        event.preventDefault();
        triggerCopyAll();
        break;
      case 'r':
        event.preventDefault();
        triggerRunTests();
        break;
      case 's':
        event.preventDefault();
        triggerExport();
        break;
    }
  }
}

/**
 * Trigger password generation
 */
function triggerGenerate() {
  const btn = document.getElementById('btn-generate');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction(t('keyboard.generatingPasswords'));
  }
}

/**
 * Trigger copy all passwords
 */
function triggerCopyAll() {
  const btn = document.getElementById('btn-copy-all');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction(t('keyboard.copyingPasswords'));
  }
}

/**
 * Trigger test runner
 */
function triggerRunTests() {
  const btn = document.getElementById('btn-run-tests');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction(t('keyboard.runningTests'));
  }
}

/**
 * Trigger export
 */
function triggerExport() {
  const btn = document.getElementById('btn-export');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction(t('keyboard.exportingResults'));
  }
}

/**
 * Handle Escape key - close modals
 */
function handleEscapeKey() {
  // Find open modals (both .show class and :not(.hidden) for compatibility)
  const modals = document.querySelectorAll('.modal-overlay.show, .modal-overlay:not(.hidden)');

  if (modals.length > 0) {
    // Close the last opened modal
    const lastModal = modals[modals.length - 1];
    const closeBtn = lastModal.querySelector('.modal-close');

    if (closeBtn) {
      closeBtn.click();
      announceAction(t('keyboard.modalClosed'));
    } else {
      // Fallback: hide modal directly
      lastModal.classList.add('hidden');
      lastModal.setAttribute('aria-hidden', 'true');
    }
  }
}

/**
 * Announce action to screen readers
 * @param {string} message - Message to announce
 */
function announceAction(message) {
  // Create or update screen reader announcement area
  let announcer = document.getElementById('sr-announcer');

  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }

  // Update message
  announcer.textContent = message;

  // Clear after announcement
  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}

/**
 * Get list of all keyboard shortcuts
 * @param {Function} t - Translation function
 * @returns {Array<{key: string, description: string}>} List of shortcuts
 */
export function getKeyboardShortcuts(t = (k) => k) {
  return [
    { key: 'Alt+G', description: t('shortcuts.descriptions.generate') },
    { key: 'Alt+C', description: t('shortcuts.descriptions.copyAll') },
    { key: 'Alt+R', description: t('shortcuts.descriptions.runTests') },
    { key: 'Alt+S', description: t('shortcuts.descriptions.exportResults') },
    { key: 'Escape', description: t('shortcuts.descriptions.closeModal') }
  ];
}

/**
 * Remove keyboard shortcuts (cleanup)
 */
export function removeKeyboardShortcuts() {
  document.removeEventListener('keydown', handleKeyboardShortcut);

  if (window.log) {
    window.log('[Keyboard] Shortcuts removed');
  }
}
