/**
 * @fileoverview SaveToVaultModal - Modal component for saving generated passwords to vault
 * Displays an overlay modal on the Generator tab with entry creation form
 *
 * @version 2.6.8
 */

import { VaultBridge } from './vault-bridge.js';
import { showToast } from '../utils/toast.js';
import { escapeHtml } from '../utils/helpers.js';
import { QuickUnlockDialog } from './quick-unlock-dialog.js';
import { t } from '../utils/i18n.js';

/**
 * SaveToVaultModal - Manages the save-to-vault modal overlay
 */
export class SaveToVaultModal {
  static #instance = null;
  static #isOpen = false;
  static #currentPassword = '';
  static #folders = [];
  static #escapeHandler = null;
  static #focusTrapHandler = null;
  static #previouslyFocusedElement = null;

  /**
   * Get the singleton instance
   */
  static getInstance() {
    if (!this.#instance) {
      this.#instance = new SaveToVaultModal();
    }
    return this.#instance;
  }

  /**
   * Open the modal with a password to save
   * @param {string} password - The password to save
   * @param {Object} [prefill] - Optional prefill data
   * @param {string} [prefill.title] - Suggested title
   * @param {string} [prefill.username] - Suggested username
   * @param {string} [prefill.url] - Suggested URL
   */
  static async open(password, prefill = {}) {
    if (this.#isOpen) return;
    this.#isOpen = true; // Set immediately to prevent race condition

    // Check vault state
    if (!VaultBridge.isAvailable()) {
      this.#isOpen = false;
      showToast(t('toast.vaultNotAvailable'), 'error');
      return;
    }

    const isUnlocked = await VaultBridge.isUnlocked();
    if (!isUnlocked) {
      // Show quick unlock dialog instead of switching tabs
      const unlocked = await QuickUnlockDialog.show({
        message: t('vault.saveModal.unlockMessage')
      });

      if (!unlocked) {
        // User cancelled, reset flag and return
        this.#isOpen = false;
        return;
      }
      // Vault is now unlocked, continue
    }

    this.#currentPassword = password;

    try {
      this.#folders = await VaultBridge.getFolders();
    } catch (error) {
      this.#isOpen = false;
      showToast(t('vault.common.error'), 'error');
      return;
    }

    this.#render(prefill);
    this.#show();
    this.#bindEvents();
  }

  /**
   * Close the modal
   */
  static close() {
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

    const overlay = document.getElementById('save-to-vault-modal');
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
      }, 200);
    }
  }

  /**
   * Render the modal HTML
   * @private
   */
  static #render(prefill = {}) {
    // Remove existing modal if any
    const existing = document.getElementById('save-to-vault-modal');
    if (existing) existing.remove();

    const folderOptions = this.#folders.length > 0
      ? this.#folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')
      : '';

    const html = `
      <div class="save-vault-modal-overlay" id="save-to-vault-modal" role="dialog" aria-modal="true" aria-labelledby="save-vault-title">
        <div class="save-vault-modal">
          <div class="save-vault-header">
            <div class="save-vault-title-row">
              <div class="save-vault-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 id="save-vault-title">${t('vault.saveModal.title')}</h3>
            </div>
            <button type="button" class="save-vault-close" id="save-vault-close" aria-label="${t('common.close')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <form class="save-vault-form" id="save-vault-form">
            <!-- Password Preview -->
            <div class="save-vault-password-preview">
              <label class="save-vault-label">${t('vault.labels.password')}</label>
              <div class="save-vault-password-display">
                <code class="save-vault-password-value">${escapeHtml(this.#currentPassword)}</code>
                <button type="button" class="save-vault-copy-btn" id="save-vault-copy" title="${t('common.copy')}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Title (required) -->
            <div class="save-vault-group">
              <label class="save-vault-label" for="save-vault-title-input">
                ${t('vault.labels.title')} <span class="required">*</span>
              </label>
              <input
                type="text"
                class="save-vault-input"
                id="save-vault-title-input"
                placeholder="${t('vault.saveModal.titlePlaceholder')}"
                value="${escapeHtml(prefill.title || '')}"
                required
                autofocus
                aria-required="true"
                aria-invalid="false"
                aria-describedby="save-vault-title-error"
                minlength="1"
                maxlength="100"
              >
              <span class="field-error" id="save-vault-title-error" hidden>${t('vault.messages.titleRequired')}</span>
            </div>

            <!-- Username -->
            <div class="save-vault-group">
              <label class="save-vault-label" for="save-vault-username">${t('vault.labels.username')}</label>
              <input
                type="text"
                class="save-vault-input"
                id="save-vault-username"
                placeholder="${t('vault.form.userPlaceholder')}"
                value="${escapeHtml(prefill.username || '')}"
              >
            </div>

            <!-- URL -->
            <div class="save-vault-group">
              <label class="save-vault-label" for="save-vault-url">${t('vault.saveModal.websiteUrl')}</label>
              <input
                type="url"
                class="save-vault-input"
                id="save-vault-url"
                placeholder="${t('vault.saveModal.urlPlaceholder')}"
                value="${escapeHtml(prefill.url || '')}"
              >
            </div>

            <!-- Folder -->
            <div class="save-vault-group">
              <label class="save-vault-label" for="save-vault-folder">${t('vault.labels.folder')}</label>
              <select class="save-vault-select" id="save-vault-folder">
                <option value="">${t('vault.saveModal.noFolder')}</option>
                ${folderOptions}
              </select>
            </div>

            <!-- Notes (collapsed by default) -->
            <details class="save-vault-notes-section">
              <summary class="save-vault-notes-toggle">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                ${t('vault.saveModal.addNotes')}
              </summary>
              <div class="save-vault-group">
                <textarea
                  class="save-vault-textarea"
                  id="save-vault-notes"
                  placeholder="${t('vault.form.optionalNotes')}"
                  rows="3"
                ></textarea>
              </div>
            </details>

            <!-- Actions -->
            <div class="save-vault-actions">
              <button type="button" class="save-vault-btn save-vault-btn-secondary" id="save-vault-cancel">
                ${t('common.cancel')}
              </button>
              <button type="submit" class="save-vault-btn save-vault-btn-primary" id="save-vault-submit">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                ${t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  /**
   * Show the modal with animation
   * @private
   */
  static #show() {
    const overlay = document.getElementById('save-to-vault-modal');
    if (overlay) {
      // Trigger animation
      requestAnimationFrame(() => {
        overlay.classList.add('active');
        this.#isOpen = true;
      });
    }
  }

  /**
   * Get focusable elements within the modal
   * @private
   * @returns {HTMLElement[]}
   */
  static #getFocusableElements() {
    const overlay = document.getElementById('save-to-vault-modal');
    if (!overlay) return [];
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    return Array.from(overlay.querySelectorAll(selector));
  }

  /**
   * Bind event handlers
   * @private
   */
  static #bindEvents() {
    const overlay = document.getElementById('save-to-vault-modal');
    const form = document.getElementById('save-vault-form');
    const closeBtn = document.getElementById('save-vault-close');
    const cancelBtn = document.getElementById('save-vault-cancel');
    const copyBtn = document.getElementById('save-vault-copy');

    // Save previously focused element
    this.#previouslyFocusedElement = document.activeElement;

    // Close on overlay click
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Close buttons
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    // Escape key - store handler for cleanup
    this.#escapeHandler = (e) => {
      if (e.key === 'Escape' && this.#isOpen) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.#escapeHandler);

    // Focus trap - keep focus within modal
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

    // Copy password
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.#currentPassword);
        showToast(t('toast.passwordCopied'), 'success');
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 1000);
      } catch (error) {
        showToast(t('toast.copyFailed'), 'error');
      }
    });

    // Real-time validation for title field
    const titleInput = document.getElementById('save-vault-title-input');
    const titleError = document.getElementById('save-vault-title-error');
    titleInput?.addEventListener('input', () => {
      const value = titleInput.value.trim();
      const isValid = value.length > 0;
      titleInput.setAttribute('aria-invalid', !isValid);
      if (titleError) {
        titleError.hidden = isValid;
      }
    });

    // Validate on blur
    titleInput?.addEventListener('blur', () => {
      const value = titleInput.value.trim();
      const isValid = value.length > 0;
      titleInput.setAttribute('aria-invalid', !isValid);
      if (titleError) {
        titleError.hidden = isValid;
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
    const titleInput = document.getElementById('save-vault-title-input');
    const usernameInput = document.getElementById('save-vault-username');
    const urlInput = document.getElementById('save-vault-url');
    const folderSelect = document.getElementById('save-vault-folder');
    const notesInput = document.getElementById('save-vault-notes');
    const submitBtn = document.getElementById('save-vault-submit');

    const title = titleInput?.value?.trim();
    if (!title) {
      titleInput?.setAttribute('aria-invalid', 'true');
      const titleError = document.getElementById('save-vault-title-error');
      if (titleError) titleError.hidden = false;
      titleInput?.focus();
      showToast(t('vault.messages.titleRequired'), 'warning');
      return;
    }

    // Disable submit button
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="save-vault-spinner"></span>
        ${t('vault.saveModal.saving')}
      `;
    }

    const result = await VaultBridge.savePassword(this.#currentPassword, {
      title,
      username: usernameInput?.value?.trim() || '',
      url: urlInput?.value?.trim() || '',
      notes: notesInput?.value?.trim() || '',
      folderId: folderSelect?.value || null
    });

    if (result.success) {
      this.close();
    } else {
      showToast(result.error || t('vault.saveModal.saveFailed'), 'error');
      // Re-enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          ${t('common.save')}
        `;
      }
    }
  }

}

export default SaveToVaultModal;
