/**
 * @fileoverview Base Modal Class
 * Provides common functionality for modal dialogs including:
 * - Focus trap (Tab cycling within modal)
 * - Escape key to close
 * - Focus restoration on close
 * - Backdrop click to close
 * - Main content inert state
 */

import { setMainContentInert } from '../events.js';

export class Modal {
  #escapeHandler = null;
  #focusTrapHandler = null;
  #previouslyFocusedElement = null;
  #useInert = true;

  /**
   * Create a modal instance
   * @param {string} modalId - The ID of the modal element
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.useInert=true] - Whether to set main content inert when modal is open
   */
  constructor(modalId, options = {}) {
    this._modalId = modalId;
    this._element = null;
    this.#useInert = options.useInert !== false;
  }

  /**
   * Get the modal element (creates if needed)
   */
  get element() {
    if (!this._element) {
      this._element = document.getElementById(this._modalId);
      if (!this._element) {
        this._createModal();
      }
    }
    return this._element;
  }

  /**
   * Check if modal is currently visible
   */
  get isVisible() {
    return this._element && !this._element.hidden && this._element.style.display !== 'none';
  }

  /**
   * Template to be overridden by subclasses
   */
  get template() {
    return '';
  }

  /**
   * Create and inject the modal into the DOM
   */
  _createModal() {
    const overlay = document.createElement('div');
    overlay.id = this._modalId;
    overlay.className = 'vault-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${this._modalId}-title`);
    overlay.hidden = true;
    overlay.innerHTML = `<div class="vault-modal">${this.template}</div>`;
    document.body.appendChild(overlay);
    this._element = overlay;

    this._setupBaseEventHandlers();
  }

  /**
   * Setup base event handlers (backdrop click, close buttons)
   * Can be called by subclasses that inject their own HTML
   * @protected
   */
  _setupBaseEventHandlers() {
    const overlay = this._element;
    if (!overlay) return;

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    // Close on [data-action="close"] buttons
    overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    // Close on .vault-modal-close buttons
    overlay.querySelectorAll('.vault-modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });
  }

  /**
   * Get focusable elements within the modal (excluding hidden elements)
   * @returns {HTMLElement[]} Array of focusable elements
   * @protected
   */
  _getFocusableElements() {
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    const elements = Array.from(this.element.querySelectorAll(selector));
    // Filter out elements within hidden containers
    return elements.filter(el => {
      const hidden = el.closest('[hidden]');
      return !hidden || hidden === this.element;
    });
  }

  /**
   * Show the modal
   * @param {...any} _args - Arguments passed to subclass (ignored by base class)
   */
  show(..._args) {
    // Save currently focused element for restoration
    this.#previouslyFocusedElement = document.activeElement;

    // Set main content inert for accessibility
    if (this.#useInert) {
      setMainContentInert(true);
    }

    // Show the modal
    const el = this.element;
    el.hidden = false;
    el.classList.add('active');
    el.style.display = 'flex';

    // Add escape key handler
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.#escapeHandler);

    // Add focus trap handler
    this.#focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      const focusable = this._getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this.#focusTrapHandler);

    // Focus first focusable element (prefer inputs/textareas)
    requestAnimationFrame(() => {
      const focusable = this._getFocusableElements();
      const firstInput = focusable.find(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') || focusable[0];
      if (firstInput) {
        firstInput.focus();
      }
    });
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this._element) {
      this._element.hidden = true;
      this._element.classList.remove('active');
      this._element.style.display = 'none';
    }

    // Remove main content inert
    if (this.#useInert) {
      setMainContentInert(false);
    }

    // Remove escape key handler to prevent memory leak
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
    }

    // Remove focus trap handler
    if (this.#focusTrapHandler) {
      document.removeEventListener('keydown', this.#focusTrapHandler);
      this.#focusTrapHandler = null;
    }

    // Restore focus to previously focused element
    if (this.#previouslyFocusedElement && typeof this.#previouslyFocusedElement.focus === 'function') {
      this.#previouslyFocusedElement.focus();
      this.#previouslyFocusedElement = null;
    }
  }

  /**
   * Remove the modal from DOM
   */
  destroy() {
    this.hide(); // Clean up handlers
    if (this._element) {
      this._element.remove();
      this._element = null;
    }
  }
}
