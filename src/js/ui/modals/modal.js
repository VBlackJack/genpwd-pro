/**
 * @fileoverview Base Modal Class
 * Provides common functionality for modal dialogs
 */

export class Modal {
  #escapeHandler = null;
  #focusTrapHandler = null;
  #previouslyFocusedElement = null;

  constructor(modalId) {
    this._modalId = modalId;
    this._element = null;
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
    overlay.innerHTML = `<div class="vault-modal">${this.template}</div>`;
    document.body.appendChild(overlay);
    this._element = overlay;

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    // Close on [data-action="close"] buttons
    overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });
  }

  /**
   * Get focusable elements within the modal
   * @returns {HTMLElement[]} Array of focusable elements
   */
  #getFocusableElements() {
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    return Array.from(this.element.querySelectorAll(selector));
  }

  /**
   * Show the modal
   */
  show() {
    // Save currently focused element for restoration
    this.#previouslyFocusedElement = document.activeElement;

    this.element.classList.add('active');
    this.element.style.display = 'flex';

    // Add escape key handler
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.#escapeHandler);

    // Add focus trap handler
    this.#focusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      const focusable = this.#getFocusableElements();
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

    // Focus first focusable element
    const focusable = this.#getFocusableElements();
    const firstInput = focusable.find(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') || focusable[0];
    if (firstInput) {
      requestAnimationFrame(() => firstInput.focus());
    }
  }

  /**
   * Hide the modal
   */
  hide() {
    if (this._element) {
      this._element.classList.remove('active');
      this._element.style.display = 'none';
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
    // Clean up escape handler
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
    }
    // Clean up focus trap handler
    if (this.#focusTrapHandler) {
      document.removeEventListener('keydown', this.#focusTrapHandler);
      this.#focusTrapHandler = null;
    }
    if (this._element) {
      this._element.remove();
      this._element = null;
    }
  }
}
