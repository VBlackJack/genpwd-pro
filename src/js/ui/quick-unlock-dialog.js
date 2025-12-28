/**
 * @fileoverview QuickUnlockDialog - Inline vault unlock dialog
 * Allows unlocking the vault without switching tabs
 *
 * @version 2.6.8
 */

import { showToast } from '../utils/toast.js';
import { safeLog } from '../utils/logger.js';
import { escapeHtml } from '../utils/helpers.js';
import { VaultBridge, VaultState } from './vault-bridge.js';
import { t } from '../utils/i18n.js';

/**
 * QuickUnlockDialog - Lightweight modal for quick vault unlocking
 */
export class QuickUnlockDialog {
  static #isOpen = false;
  static #resolvePromise = null;
  static #rejectPromise = null;
  static #escapeHandler = null;
  static #focusTrapHandler = null;
  static #previouslyFocusedElement = null;

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
        showToast(t('toast.vaultNotAvailable'), 'error');
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
    // Clean up keyboard handlers
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
    }
    if (this.#focusTrapHandler) {
      document.removeEventListener('keydown', this.#focusTrapHandler);
      this.#focusTrapHandler = null;
    }

    const overlay = document.getElementById('quick-unlock-dialog');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        this.#isOpen = false;

        // Restore focus to previously focused element
        if (this.#previouslyFocusedElement && typeof this.#previouslyFocusedElement.focus === 'function') {
          this.#previouslyFocusedElement.focus();
          this.#previouslyFocusedElement = null;
        }

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
      safeLog(`[QuickUnlockDialog] Error fetching vaults: ${error.message}`);
    }

    const vaultOptions = vaults.map((v, i) => `
      <option value="${v.id}" ${i === 0 ? 'selected' : ''}>${escapeHtml(v.name || v.id.substring(0, 8))}</option>
    `).join('');

    const message = options.message || t('vault.quickUnlock.unlockToContinue');

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
            <h3 id="quick-unlock-title">${t('vault.quickUnlock.title')}</h3>
            <p class="quick-unlock-message">${escapeHtml(message)}</p>
          </div>

          <form class="quick-unlock-form" id="quick-unlock-form">
            ${vaults.length > 1 ? `
              <div class="quick-unlock-group">
                <label for="quick-unlock-vault">${t('vault.lockScreen.title')}</label>
                <select id="quick-unlock-vault" class="quick-unlock-input">
                  ${vaultOptions}
                </select>
              </div>
            ` : `
              <input type="hidden" id="quick-unlock-vault" value="${vaults[0]?.id || ''}">
            `}

            <div class="quick-unlock-group">
              <label for="quick-unlock-password">${t('vault.labels.password')}</label>
              <div class="quick-unlock-password-wrap">
                <input
                  type="password"
                  id="quick-unlock-password"
                  class="quick-unlock-input"
                  placeholder="${t('vault.lockScreen.masterPassword')}"
                  autocomplete="current-password"
                  autofocus
                  required
                  aria-required="true"
                  aria-invalid="false"
                  aria-describedby="quick-unlock-error"
                  aria-label="${t('vault.labels.password')}"
                >
                <button type="button" class="quick-unlock-toggle-pwd" id="quick-unlock-toggle-pwd" aria-label="${t('vault.quickUnlock.showPassword')}">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <div class="quick-unlock-error" id="quick-unlock-error" role="alert" aria-live="assertive" hidden>
              <span class="quick-unlock-error-text"></span>
              <button type="button" class="quick-unlock-retry-btn" id="quick-unlock-retry">
                ${t('vault.quickUnlock.tryAgain')}
              </button>
            </div>

            <!-- Windows Hello Section (shown when available) -->
            <div class="quick-unlock-hello" id="quick-unlock-hello" hidden>
              <div class="quick-unlock-divider">
                <span>${t('vault.quickUnlock.or') || 'or'}</span>
              </div>
              <button type="button" class="quick-unlock-btn quick-unlock-btn-hello" id="quick-unlock-hello-btn" aria-label="${t('vault.quickUnlock.unlockWithHello')}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <path d="M12 6c-2.21 0-4 1.79-4 4v2c0 2.21 1.79 4 4 4s4-1.79 4-4v-2c0-2.21-1.79-4-4-4z"/>
                  <circle cx="9" cy="10" r="1"/>
                  <circle cx="15" cy="10" r="1"/>
                  <path d="M9 14c1.5 1 4.5 1 6 0"/>
                </svg>
                <span>Windows Hello</span>
              </button>
            </div>

            <div class="quick-unlock-actions">
              <button type="button" class="quick-unlock-btn quick-unlock-btn-secondary" id="quick-unlock-cancel">
                ${t('common.cancel')}
              </button>
              <button type="submit" class="quick-unlock-btn quick-unlock-btn-primary" id="quick-unlock-submit">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                </svg>
                ${t('vault.lockScreen.unlock')}
              </button>
            </div>
          </form>

          <button type="button" class="quick-unlock-close" id="quick-unlock-close" aria-label="${t('common.close')}">
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
      requestAnimationFrame(async () => {
        overlay.classList.add('active');
        this.#isOpen = true;
        // Focus password input
        document.getElementById('quick-unlock-password')?.focus();
        // Check Windows Hello availability
        await this.#checkWindowsHello();
      });
    }
  }

  /**
   * Check if Windows Hello is available for the selected vault
   * @private
   */
  static async #checkWindowsHello() {
    const helloSection = document.getElementById('quick-unlock-hello');
    const vaultSelect = document.getElementById('quick-unlock-vault');
    if (!helloSection) return;

    // Check if Windows Hello API is available
    if (!window.vault?.hello) {
      helloSection.hidden = true;
      return;
    }

    try {
      // Check if Windows Hello is available on this system
      const isAvailable = await window.vault.hello.isAvailable();
      if (!isAvailable) {
        helloSection.hidden = true;
        return;
      }

      // Check if Windows Hello is enabled for the selected vault
      const vaultId = vaultSelect?.value;
      if (!vaultId) {
        helloSection.hidden = true;
        return;
      }

      const isEnabled = await window.vault.hello.isEnabled(vaultId);
      helloSection.hidden = !isEnabled;
    } catch (error) {
      safeLog('[QuickUnlockDialog] Windows Hello check error:', error);
      helloSection.hidden = true;
    }
  }

  /**
   * Get focusable elements within the dialog
   * @private
   * @returns {HTMLElement[]}
   */
  static #getFocusableElements() {
    const overlay = document.getElementById('quick-unlock-dialog');
    if (!overlay) return [];
    const selector = 'button:not([disabled]):not([hidden]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    return Array.from(overlay.querySelectorAll(selector)).filter(el => {
      // Filter out hidden elements
      return el.offsetParent !== null && !el.closest('[hidden]');
    });
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

    // Save previously focused element
    this.#previouslyFocusedElement = document.activeElement;

    // Close on overlay click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close(false);
      }
    });

    // Close buttons
    closeBtn?.addEventListener('click', () => this.close(false));
    cancelBtn?.addEventListener('click', () => this.close(false));

    // Escape key - store handler for cleanup
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape' && this.#isOpen) {
        this.close(false);
      }
    };
    document.addEventListener('keydown', this.#escapeHandler);

    // Focus trap - keep focus within dialog
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

    // Windows Hello button
    const helloBtn = document.getElementById('quick-unlock-hello-btn');
    helloBtn?.addEventListener('click', async () => {
      await this.#handleWindowsHello();
    });

    // Update Windows Hello when vault selection changes
    const vaultSelect = document.getElementById('quick-unlock-vault');
    vaultSelect?.addEventListener('change', async () => {
      await this.#checkWindowsHello();
    });

    // Retry button
    const retryBtn = document.getElementById('quick-unlock-retry');
    retryBtn?.addEventListener('click', () => {
      const errorEl = document.getElementById('quick-unlock-error');
      const passwordInput = document.getElementById('quick-unlock-password');
      if (errorEl) errorEl.hidden = true;
      passwordInput?.focus();
    });
  }

  /**
   * Handle Windows Hello authentication
   * @private
   */
  static async #handleWindowsHello() {
    const vaultSelect = document.getElementById('quick-unlock-vault');
    const helloBtn = document.getElementById('quick-unlock-hello-btn');
    const errorEl = document.getElementById('quick-unlock-error');

    const vaultId = vaultSelect?.value;
    if (!vaultId) {
      showToast(t('vault.messages.selectVault'), 'warning');
      return;
    }

    // Show loading state
    if (helloBtn) {
      helloBtn.disabled = true;
      helloBtn.innerHTML = `
        <svg class="spinning" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/>
        </svg>
        <span>${t('vault.actions.unlocking')}</span>
      `;
    }

    try {
      // Attempt Windows Hello unlock
      await window.vault.hello.unlock(vaultId);
      showToast(t('toast.vaultUnlocked'), 'success');
      this.close(true);
    } catch (error) {
      safeLog('[QuickUnlockDialog] Windows Hello unlock failed:', error);

      // Show error
      if (errorEl) {
        const errorText = errorEl.querySelector('.quick-unlock-error-text');
        if (errorText) {
          errorText.textContent = error.message || t('vault.misc.biometricFailed');
        }
        errorEl.hidden = false;
      }

      // Restore button
      if (helloBtn) {
        helloBtn.disabled = false;
        helloBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <path d="M12 6c-2.21 0-4 1.79-4 4v2c0 2.21 1.79 4 4 4s4-1.79 4-4v-2c0-2.21-1.79-4-4-4z"/>
            <circle cx="9" cy="10" r="1"/>
            <circle cx="15" cy="10" r="1"/>
            <path d="M9 14c1.5 1 4.5 1 6 0"/>
          </svg>
          <span>Windows Hello</span>
        `;
      }
    }
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
        errorEl.textContent = t('vault.form.enterPassword');
        errorEl.hidden = false;
      }
      return;
    }

    // Disable submit and set aria-busy
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.innerHTML = `<span class="quick-unlock-spinner"></span> ${t('vault.actions.unlocking')}`;
    }
    if (errorEl) errorEl.hidden = true;

    try {
      await window.vault.unlock(vaultId, password);
      showToast(t('toast.vaultUnlocked'), 'success');
      this.close(true);
    } catch (error) {
      if (errorEl) {
        const errorText = errorEl.querySelector('.quick-unlock-error-text');
        if (errorText) {
          errorText.textContent = error.message || t('vault.misc.incorrectPassword');
        }
        errorEl.hidden = false;
      }
      // Set aria-invalid for accessibility
      passwordInput?.setAttribute('aria-invalid', 'true');
      passwordInput?.value && (passwordInput.value = '');
      passwordInput?.focus();

      // Re-enable submit
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
          </svg>
          ${t('vault.lockScreen.unlock')}
        `;
      }
    }
  }

}

export default QuickUnlockDialog;
