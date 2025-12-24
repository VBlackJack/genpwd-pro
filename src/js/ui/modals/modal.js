/**
 * @fileoverview Base Modal Class
 * Provides common functionality for modal dialogs
 */

export class Modal {
  #escapeHandler = null;

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
   * Show the modal
   */
  show() {
    this.element.classList.add('active');
    this.element.style.display = 'flex';

    // Add escape key handler
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.#escapeHandler);

    // Focus first input
    const firstInput = this.element.querySelector('input, button:not([data-action="close"])');
    if (firstInput) firstInput.focus();
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
    if (this._element) {
      this._element.remove();
      this._element = null;
    }
  }
}
