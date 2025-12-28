/**
 * @fileoverview Modal Service
 * Handles modal open/close, focus trapping, and accessibility
 */

/**
 * Focusable elements selector
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

/**
 * Create a modal service instance
 * @returns {Object} Modal service instance
 */
export function createModalService() {
  /** @type {Map<string, Function>} */
  const focusTrapHandlers = new Map();

  /** @type {HTMLElement|null} */
  let lastFocusedElement = null;

  /**
   * Get focusable elements within a container
   * @param {HTMLElement} container - Container element
   * @returns {NodeListOf<HTMLElement>}
   */
  function getFocusableElements(container) {
    return container.querySelectorAll(FOCUSABLE_SELECTOR);
  }

  /**
   * Set up focus trap for a modal
   * @param {HTMLElement} modal - Modal element
   * @param {Function} onClose - Called when Escape is pressed
   */
  function setupFocusTrap(modal, onClose) {
    // Remove existing handler
    removeFocusTrap(modal);

    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements(modal);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: go to last element if on first
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: go to first element if on last
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    modal.addEventListener('keydown', trapFocus);
    focusTrapHandlers.set(modal.id, trapFocus);

    // Auto-focus first focusable element
    requestAnimationFrame(() => {
      const focusableElements = getFocusableElements(modal);
      // Prefer input fields, then buttons
      const inputField = modal.querySelector('input:not([type="hidden"]):not([disabled])');
      const firstFocusable = inputField || focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // Fallback: make modal content focusable
        const content = modal.querySelector('.vault-modal-content, .modal-content');
        if (content) {
          content.setAttribute('tabindex', '-1');
          content.focus();
        }
      }
    });
  }

  /**
   * Remove focus trap from a modal
   * @param {HTMLElement} modal - Modal element
   */
  function removeFocusTrap(modal) {
    const handler = focusTrapHandlers.get(modal.id);
    if (handler) {
      modal.removeEventListener('keydown', handler);
      focusTrapHandlers.delete(modal.id);
    }
  }

  /**
   * Open a modal by ID
   * @param {string} modalId - Modal element ID
   * @param {Object} options - Options
   * @param {Function} options.onClose - Close callback
   * @returns {HTMLElement|null} Modal element
   */
  function open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return null;

    // Store last focused element
    lastFocusedElement = document.activeElement;

    // Set ARIA attributes
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Setup focus trap
    setupFocusTrap(modal, () => close(modalId));

    return modal;
  }

  /**
   * Close a modal by ID
   * @param {string} modalId - Modal element ID
   * @returns {boolean} True if modal was closed
   */
  function close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    // Remove focus trap
    removeFocusTrap(modal);

    // Update state
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');

    // Restore focus
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }

    return true;
  }

  /**
   * Check if any modal is active
   * @returns {boolean}
   */
  function hasActiveModal() {
    return document.querySelector('.vault-modal-overlay.active, .vault-modal.active') !== null;
  }

  /**
   * Get the currently active modal
   * @returns {HTMLElement|null}
   */
  function getActiveModal() {
    return document.querySelector('.vault-modal-overlay.active, .vault-modal.active');
  }

  /**
   * Close all active modals
   */
  function closeAll() {
    const activeModals = document.querySelectorAll('.vault-modal-overlay.active, .vault-modal.active');
    activeModals.forEach(modal => {
      if (modal.id) {
        close(modal.id);
      }
    });
  }

  /**
   * Destroy the service (cleanup)
   */
  function destroy() {
    focusTrapHandlers.forEach((handler, modalId) => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.removeEventListener('keydown', handler);
      }
    });
    focusTrapHandlers.clear();
    lastFocusedElement = null;
  }

  return {
    open,
    close,
    hasActiveModal,
    getActiveModal,
    closeAll,
    destroy,
    setupFocusTrap,
    removeFocusTrap
  };
}

/**
 * Singleton instance for global modal management
 */
let globalModalService = null;

/**
 * Get or create the global modal service
 * @returns {Object} Modal service instance
 */
export function getModalService() {
  if (!globalModalService) {
    globalModalService = createModalService();
  }
  return globalModalService;
}
