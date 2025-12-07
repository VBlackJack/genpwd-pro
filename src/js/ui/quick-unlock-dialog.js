/**
 * @fileoverview QuickUnlockDialog - Inline vault unlock dialog
 * Allows unlocking the vault without switching tabs
 *
 * @version 2.6.8
 */

import { showToast } from '../utils/toast.js';
import { VaultBridge, VaultState } from './vault-bridge.js';

/**
 * QuickUnlockDialog - Lightweight modal for quick vault unlocking
 */
export class QuickUnlockDialog {
  static #isOpen = false;
  static #resolvePromise = null;
  static #rejectPromise = null;

  /**
   * Show the quick unlock dialog
   * @param {Object} options - Options
   * @param {string} [options.message] - Custom message to display
   * @returns {Promise<boolean>} - Resolves true if unlocked, false if cancelled
   */
  static show(options = {}) {
    return new Promise((resolve, reject) => {
      if (this.#isOpen) {
        resolve(false);
        return;
      }

      // Check if vault is available
      if (!VaultBridge.isAvailable()) {
        showToast('Coffre non disponible', 'error');
        resolve(false);
        return;
      }

      // Check if already unlocked
      if (VaultBridge.getState() === VaultState.UNLOCKED) {
        resolve(true);
        return;
      }

      this.#resolvePromise = resolve;
      this.#rejectPromise = reject;
      this.#render(options);
      this.#show();
      this.#bindEvents();
    });
  }

  /**
   * Close the dialog
   * @param {boolean} success - Whether unlock was successful
   */
  static close(success = false) {
    const overlay = document.getElementById('quick-unlock-dialog');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        this.#isOpen = false;
        if (this.#resolvePromise) {
          this.#resolvePromise(success);
          this.#resolvePromise = null;
          this.#rejectPromise = null;
        }
      }, 200);
    }
  }

  /**
   * Render the dialog
   * @private
   */
  static async #render(options = {}) {
    // Remove existing dialog if any
    const existing = document.getElementById('quick-unlock-dialog');
    if (existing) existing.remove();

    // Get vault list
    let vaults = [];
    try {
      vaults = await window.vault.list();
    } catch (error) {
      console.error('[QuickUnlockDialog] Error fetching vaults:', error);
    }

    const vaultOptions = vaults.map((v, i) => `
      <option value="${v.id}" ${i === 0 ? 'selected' : ''}>${this.#escapeHtml(v.name || v.id.substring(0, 8))}</option>
    `).join('');

    const message = options.message || 'Déverrouillez le coffre pour continuer';

    const html = `
      <div class="quick-unlock-overlay" id="quick-unlock-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-unlock-title">
        <div class="quick-unlock-modal">
          <div class="quick-unlock-header">
            <div class="quick-unlock-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3 id="quick-unlock-title">Déverrouiller le coffre</h3>
            <p class="quick-unlock-message">${this.#escapeHtml(message)}</p>
          </div>

          <form class="quick-unlock-form" id="quick-unlock-form">
            ${vaults.length > 1 ? `
              <div class="quick-unlock-group">
                <label for="quick-unlock-vault">Coffre</label>
                <select id="quick-unlock-vault" class="quick-unlock-input">
                  ${vaultOptions}
                </select>
              </div>
            ` : `
              <input type="hidden" id="quick-unlock-vault" value="${vaults[0]?.id || ''}">
            `}

            <div class="quick-unlock-group">
              <label for="quick-unlock-password">Mot de passe</label>
              <div class="quick-unlock-password-wrap">
                <input
                  type="password"
                  id="quick-unlock-password"
                  class="quick-unlock-input"
                  placeholder="Mot de passe principal"
                  autocomplete="current-password"
                  autofocus
                  required
                >
                <button type="button" class="quick-unlock-toggle-pwd" id="quick-unlock-toggle-pwd" aria-label="Afficher le mot de passe">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <div class="quick-unlock-error" id="quick-unlock-error" hidden></div>

            <div class="quick-unlock-actions">
              <button type="button" class="quick-unlock-btn quick-unlock-btn-secondary" id="quick-unlock-cancel">
                Annuler
              </button>
              <button type="submit" class="quick-unlock-btn quick-unlock-btn-primary" id="quick-unlock-submit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                </svg>
                Déverrouiller
              </button>
            </div>
          </form>

          <button type="button" class="quick-unlock-close" id="quick-unlock-close" aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  /**
   * Show the dialog with animation
   * @private
   */
  static #show() {
    const overlay = document.getElementById('quick-unlock-dialog');
    if (overlay) {
      requestAnimationFrame(() => {
        overlay.classList.add('active');
        this.#isOpen = true;
        // Focus password input
        document.getElementById('quick-unlock-password')?.focus();
      });
    }
  }

  /**
   * Bind event handlers
   * @private
   */
  static #bindEvents() {
    const overlay = document.getElementById('quick-unlock-dialog');
    const form = document.getElementById('quick-unlock-form');
    const closeBtn = document.getElementById('quick-unlock-close');
    const cancelBtn = document.getElementById('quick-unlock-cancel');
    const togglePwdBtn = document.getElementById('quick-unlock-toggle-pwd');

    // Close on overlay click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close(false);
      }
    });

    // Close buttons
    closeBtn?.addEventListener('click', () => this.close(false));
    cancelBtn?.addEventListener('click', () => this.close(false));

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape' && this.#isOpen) {
        this.close(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Toggle password visibility
    togglePwdBtn?.addEventListener('click', () => {
      const input = document.getElementById('quick-unlock-password');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.#handleSubmit();
    });
  }

  /**
   * Handle form submission
   * @private
   */
  static async #handleSubmit() {
    const vaultSelect = document.getElementById('quick-unlock-vault');
    const passwordInput = document.getElementById('quick-unlock-password');
    const submitBtn = document.getElementById('quick-unlock-submit');
    const errorEl = document.getElementById('quick-unlock-error');

    const vaultId = vaultSelect?.value;
    const password = passwordInput?.value;

    if (!vaultId || !password) {
      if (errorEl) {
        errorEl.textContent = 'Veuillez entrer le mot de passe';
        errorEl.hidden = false;
      }
      return;
    }

    // Disable submit
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="quick-unlock-spinner"></span> Déverrouillage...';
    }
    if (errorEl) errorEl.hidden = true;

    try {
      await window.vault.unlock(vaultId, password);
      showToast('Coffre déverrouillé', 'success');
      this.close(true);
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || 'Mot de passe incorrect';
        errorEl.hidden = false;
      }
      passwordInput?.select();

      // Re-enable submit
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
          </svg>
          Déverrouiller
        `;
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  static #escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export default QuickUnlockDialog;
