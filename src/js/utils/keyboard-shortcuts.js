/**
 * Keyboard Shortcuts Module
 * Implements accessibility keyboard shortcuts for GenPwd Pro
 *
 * @module keyboard-shortcuts
 * @version 2.6.0
 * @description Provides keyboard navigation and shortcuts for accessibility
 *
 * Shortcuts:
 * - Alt+G: Generate passwords
 * - Alt+C: Copy all passwords
 * - Alt+R: Run tests
 * - Alt+S: Save/Export results
 * - Escape: Close modals
 */

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

  // Alt+ shortcuts don't work in input fields (except Escape)
  if (isInputField && !event.altKey) {
    return;
  }

  // Handle Alt+ combinations
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
    announceAction('Génération de mots de passe');
  }
}

/**
 * Trigger copy all passwords
 */
function triggerCopyAll() {
  const btn = document.getElementById('btn-copy-all');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Copie de tous les mots de passe');
  }
}

/**
 * Trigger test runner
 */
function triggerRunTests() {
  const btn = document.getElementById('btn-run-tests');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Exécution des tests');
  }
}

/**
 * Trigger export
 */
function triggerExport() {
  const btn = document.getElementById('btn-export');
  if (btn && !btn.disabled) {
    btn.click();
    announceAction('Export des résultats');
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
      announceAction('Modal fermée');
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
    { key: 'Alt+G', description: 'Générer des mots de passe' },
    { key: 'Alt+C', description: 'Copier tous les mots de passe' },
    { key: 'Alt+R', description: 'Exécuter les tests' },
    { key: 'Alt+S', description: 'Exporter les résultats' },
    { key: 'Escape', description: 'Fermer les modals' }
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
