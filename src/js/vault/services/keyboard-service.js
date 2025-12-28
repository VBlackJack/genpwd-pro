/**
 * @fileoverview Keyboard Shortcuts Service
 * Centralized keyboard shortcut handling for the vault
 */

/**
 * Keyboard shortcut definitions
 * @type {Array<{key: string, ctrl?: boolean, shift?: boolean, action: string, description: string}>}
 */
export const SHORTCUTS = [
  { key: 'l', ctrl: true, action: 'lock', description: 'Lock vault' },
  { key: 'f', ctrl: true, action: 'search', description: 'Focus search' },
  { key: 'n', ctrl: true, action: 'newEntry', description: 'New entry' },
  { key: 'e', ctrl: true, action: 'editEntry', description: 'Edit selected entry' },
  { key: 'd', ctrl: true, action: 'duplicateEntry', description: 'Duplicate entry' },
  { key: 'Delete', action: 'deleteEntry', description: 'Delete selected entry' },
  { key: '?', action: 'showShortcuts', description: 'Show keyboard shortcuts' },
  { key: 'u', ctrl: true, action: 'copyUsername', description: 'Copy username' },
  { key: 'p', ctrl: true, action: 'copyPassword', description: 'Copy password' },
  { key: 'U', ctrl: true, shift: true, action: 'autoType', description: 'Auto-fill form' },
  { key: 'ArrowDown', action: 'nextEntry', description: 'Select next entry' },
  { key: 'ArrowUp', action: 'prevEntry', description: 'Select previous entry' },
  { key: 'Escape', action: 'closeModal', description: 'Close modal' }
];

/**
 * Check if event target is an input element
 * @param {HTMLElement} target - Event target
 * @returns {boolean}
 */
function isInputElement(target) {
  return target.matches('input, textarea, select');
}

/**
 * Create a keyboard service instance
 * @param {Object} handlers - Action handlers
 * @param {Function} handlers.onLock - Lock vault
 * @param {Function} handlers.onSearch - Focus search
 * @param {Function} handlers.onNewEntry - Open new entry modal
 * @param {Function} handlers.onEditEntry - Edit selected entry
 * @param {Function} handlers.onDuplicateEntry - Duplicate entry
 * @param {Function} handlers.onDeleteEntry - Delete entry (async, returns boolean)
 * @param {Function} handlers.onShowShortcuts - Show shortcuts modal
 * @param {Function} handlers.onCopyUsername - Copy username
 * @param {Function} handlers.onCopyPassword - Copy password
 * @param {Function} handlers.onAutoType - Auto-type credentials
 * @param {Function} handlers.onNextEntry - Select next entry
 * @param {Function} handlers.onPrevEntry - Select previous entry
 * @param {Function} handlers.onCloseModal - Close active modal
 * @param {Function} handlers.onActivity - Record user activity
 * @param {Function} handlers.getSelectedEntry - Get currently selected entry
 * @param {Function} handlers.isMainView - Check if in main view
 * @param {Function} handlers.hasActiveModal - Check for active modal
 * @returns {Object} Keyboard service instance
 */
export function createKeyboardService(handlers = {}) {
  let keydownHandler = null;

  const {
    onLock,
    onSearch,
    onNewEntry,
    onEditEntry,
    onDuplicateEntry,
    onDeleteEntry,
    onShowShortcuts,
    onCopyUsername,
    onCopyPassword,
    onAutoType,
    onNextEntry,
    onPrevEntry,
    onCloseModal,
    onActivity,
    getSelectedEntry,
    isMainView,
    hasActiveModal
  } = handlers;

  /**
   * Handle keydown event
   * @param {KeyboardEvent} e - Keyboard event
   */
  async function handleKeydown(e) {
    const selectedEntry = getSelectedEntry?.();
    const inMainView = isMainView?.() ?? true;

    // Escape to close modals - always active
    if (e.key === 'Escape' && hasActiveModal?.()) {
      onCloseModal?.();
      return;
    }

    // Other shortcuts only in main view
    if (!inMainView) return;

    // Ctrl+L - Lock
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      onLock?.();
      return;
    }

    // Ctrl+F - Focus search
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      onSearch?.();
      return;
    }

    // Ctrl+N - New entry
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      onNewEntry?.();
      return;
    }

    // Ctrl+E - Edit selected entry
    if (e.ctrlKey && e.key === 'e' && selectedEntry) {
      e.preventDefault();
      onEditEntry?.(selectedEntry);
      return;
    }

    // Ctrl+D - Duplicate entry
    if (e.ctrlKey && e.key === 'd' && selectedEntry) {
      e.preventDefault();
      onDuplicateEntry?.(selectedEntry);
      return;
    }

    // Delete - Delete selected entry
    if (e.key === 'Delete' && !isInputElement(e.target) && selectedEntry) {
      e.preventDefault();
      await onDeleteEntry?.(selectedEntry);
      return;
    }

    // ? - Show shortcuts modal
    if (e.key === '?' && !isInputElement(e.target)) {
      e.preventDefault();
      onShowShortcuts?.();
      return;
    }

    // Ctrl+U - Copy username
    if (e.ctrlKey && !e.shiftKey && e.key === 'u' && selectedEntry?.data?.username) {
      e.preventDefault();
      onCopyUsername?.(selectedEntry);
      return;
    }

    // Ctrl+P - Copy password (prevent print dialog)
    if (e.ctrlKey && e.key === 'p' && selectedEntry?.data?.password) {
      e.preventDefault();
      onCopyPassword?.(selectedEntry);
      return;
    }

    // Ctrl+Shift+U - Auto-type
    if (e.ctrlKey && e.shiftKey && e.key === 'U' && selectedEntry?.type === 'login') {
      e.preventDefault();
      onAutoType?.(selectedEntry);
      return;
    }

    // Arrow keys for entry navigation
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInputElement(e.target)) {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        onNextEntry?.();
      } else {
        onPrevEntry?.();
      }
      return;
    }

    // Record activity on any key
    onActivity?.();
  }

  /**
   * Start listening for keyboard shortcuts
   * @param {HTMLElement} container - Container for mouse activity tracking
   */
  function start(container) {
    keydownHandler = handleKeydown;
    document.addEventListener('keydown', keydownHandler);

    // Track mouse activity for auto-lock reset
    if (container && onActivity) {
      container.addEventListener('mousemove', onActivity, { passive: true });
      container.addEventListener('click', onActivity, { passive: true });
    }
  }

  /**
   * Stop listening for keyboard shortcuts
   */
  function stop() {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
  }

  /**
   * Get all shortcut definitions for help display
   * @returns {Array} Shortcut definitions
   */
  function getShortcuts() {
    return SHORTCUTS;
  }

  return {
    start,
    stop,
    getShortcuts
  };
}
