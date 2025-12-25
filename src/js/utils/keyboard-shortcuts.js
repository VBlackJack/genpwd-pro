/**
 * Keyboard Shortcuts Module
 * Implements accessibility keyboard shortcuts for GenPwd Pro
 *
 * @module keyboard-shortcuts
 * @version 3.0.0
 * @description Provides keyboard navigation and shortcuts for accessibility
 *
 * Shortcuts (Generator tab only):
 * - Ctrl+Alt+G: Generate passwords
 * - Ctrl+Alt+C: Copy all passwords
 * - Ctrl+Alt+R: Run tests
 * - Ctrl+Alt+S: Save/Export results
 * - Escape: Close modals (works everywhere)
 *
 * Note: Ctrl+Alt combo avoids conflicts with Windows accessibility shortcuts
 */

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);

  // Log initialization
  if (window.log) {
    window.log('[Keyboard] Shortcuts initialized - Ctrl+Alt+G/C/R/S, Escape');
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
  const isInVault = document.querySelector('.vault-app') !== null ||
                    document.querySelector('.vault-container') !== null;
  if (isInVault) {
    return;
  }

  // Handle Alt+ combinations (Ctrl+Alt avoids Windows conflicts)
  if (event.altKey && !event.metaKey) {
    const key = event.key.toLowerCase();

    // Use Ctrl+Alt to avoid Windows accessibility conflicts
    if (event.ctrlKey) {
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
}

/**
 * Trigger password generation
 */
function triggerGenerate() {
  const btn = document.getElementById('btn-generate');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Generating passwords');
  }
}

/**
 * Trigger copy all passwords
 */
function triggerCopyAll() {
  const btn = document.getElementById('btn-copy-all');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Copying all passwords');
  }
}

/**
 * Trigger test runner
 */
function triggerRunTests() {
  const btn = document.getElementById('btn-run-tests');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Running tests');
  }
}

/**
 * Trigger export
 */
function triggerExport() {
  const btn = document.getElementById('btn-export');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Exporting results');
  }
}

/**
 * Handle Escape key - close modals
 */
function handleEscapeKey() {
  // Find open modals
  const modals = document.querySelectorAll('.modal-overlay:not(.hidden)');

  if (modals.length > 0) {
    // Close the last opened modal
    const lastModal = modals[modals.length - 1];
    const closeBtn = lastModal.querySelector('.modal-close');

    if (closeBtn) {
      closeBtn.click();
      announceAction('Modal closed');
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
 * @returns {Array<{key: string, description: string}>} List of shortcuts
 */
export function getKeyboardShortcuts() {
  return [
    { key: 'Ctrl+Alt+G', description: 'Generate passwords' },
    { key: 'Ctrl+Alt+C', description: 'Copy all passwords' },
    { key: 'Ctrl+Alt+R', description: 'Run tests' },
    { key: 'Ctrl+Alt+S', description: 'Export results' },
    { key: 'Escape', description: 'Close modals' }
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
