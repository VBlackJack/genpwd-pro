/**
 * @fileoverview Sync Settings Modal
 * Manages cloud provider configuration (WebDAV, Google Drive)
 */

import { showToast } from '../../utils/toast.js';
import { WebDAVProvider } from '../../core/sync/index.js';
import { safeLog } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { setMainContentInert } from '../events.js';

export class SyncSettingsModal {
  #modalId = 'sync-settings-modal';
  #webdavProvider;
  #escapeHandler = null;
  #focusTrapHandler = null;
  #previouslyFocusedElement = null;

  constructor() {
    this.#webdavProvider = new WebDAVProvider();
  }

  /**
   * Render and inject the modal into the DOM
   */
  render() {
    if (document.getElementById(this.#modalId)) return; // Already exists

    const modalHtml = `
      <div class="vault-modal-overlay" id="${this.#modalId}" role="dialog" aria-modal="true" aria-labelledby="${this.#modalId}-title" hidden>
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="${this.#modalId}-title">Sync Settings</h3>
            <button type="button" class="vault-modal-close" data-close-sync-modal aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="vault-modal-body">
            <!-- Provider Selector -->
            <div class="vault-form-group">
              <label class="vault-label" for="sync-provider-select">Cloud Provider</label>
              <select id="sync-provider-select" class="vault-select" aria-describedby="sync-provider-hint">
                <option value="none">Disabled (Local only)</option>
                <option value="webdav">WebDAV / Nextcloud / OwnCloud</option>
              </select>
              <div class="vault-field-hint" id="sync-provider-hint">Choose where to sync your vault</div>
            </div>

            <!-- WebDAV Configuration -->
            <div id="webdav-config-section" hidden aria-live="polite">
              <div class="vault-form-group">
                <label class="vault-label" for="webdav-url">Server URL <span class="required" aria-label="required">*</span></label>
                <input type="url" id="webdav-url" class="vault-input"
                       placeholder="https://example.com/dav/"
                       autocomplete="url"
                       aria-required="true"
                       aria-describedby="webdav-url-hint">
                <div class="vault-field-hint" id="webdav-url-hint">e.g., https://cloud.example.com/remote.php/dav/files/user/</div>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-username">Username <span class="required" aria-label="required">*</span></label>
                <input type="text" id="webdav-username" class="vault-input"
                       placeholder="your-username"
                       autocomplete="username"
                       aria-required="true">
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-password">Password / App Token <span class="required" aria-label="required">*</span></label>
                <div class="vault-input-group">
                  <input type="password" id="webdav-password" class="vault-input"
                         placeholder="••••••••"
                         autocomplete="current-password"
                         aria-required="true"
                         aria-label="WebDAV password or app token">
                  <button type="button" class="vault-input-btn toggle-pwd-visibility"
                          data-target="webdav-password"
                          aria-label="Toggle password visibility"
                          aria-pressed="false">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="vault-form-group">
                <button type="button" id="btn-test-webdav" class="vault-btn vault-btn-outline vault-btn-sm" style="width: 100%">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  Test connection
                </button>
                <div id="webdav-test-result" class="vault-field-message" style="margin-top: 8px;"></div>
              </div>
            </div>

            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-sync-modal>Cancel</button>
              <button type="button" id="btn-save-sync" class="vault-btn vault-btn-primary">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this._attachEvents();
  }

  _attachEvents() {
    const modal = document.getElementById(this.#modalId);
    if (!modal) return;

    // Backdrop click to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hide();
    });

    // Close buttons
    modal.querySelectorAll('[data-close-sync-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    // Provider change
    const providerSelect = document.getElementById('sync-provider-select');
    providerSelect?.addEventListener('change', (e) => {
      const section = document.getElementById('webdav-config-section');
      if (section) {
        section.hidden = e.target.value !== 'webdav';
      }
    });

    // Test Connection
    document.getElementById('btn-test-webdav')?.addEventListener('click', async () => {
      await this._testWebDAVConnection();
    });

    // Save
    document.getElementById('btn-save-sync')?.addEventListener('click', async () => {
      await this._saveConfiguration();
    });

    // Toggle Password Visibility with ARIA support
    modal.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.target;
        const input = document.getElementById(inputId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        }
      });
    });

    // Real-time validation for WebDAV fields
    const webdavFields = ['webdav-url', 'webdav-username', 'webdav-password'];
    webdavFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      field?.addEventListener('input', () => {
        if (field.value.trim()) {
          field.removeAttribute('aria-invalid');
          field.classList.remove('field-invalid');
        }
      });
    });
  }

  async _testWebDAVConnection() {
    const urlInput = document.getElementById('webdav-url');
    const usernameInput = document.getElementById('webdav-username');
    const passwordInput = document.getElementById('webdav-password');
    const url = urlInput?.value.trim();
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value;
    const resultDiv = document.getElementById('webdav-test-result');
    const btn = document.getElementById('btn-test-webdav');

    // Validate all fields with inline feedback
    let hasError = false;
    const fields = [
      { input: urlInput, value: url, name: 'URL' },
      { input: usernameInput, value: username, name: 'Username' },
      { input: passwordInput, value: password, name: 'Password' }
    ];

    fields.forEach(({ input, value }) => {
      if (!value) {
        input?.setAttribute('aria-invalid', 'true');
        input?.classList.add('field-invalid');
        hasError = true;
      }
    });

    if (hasError) {
      this._showResult(resultDiv, 'Please fill in all required fields', 'error');
      // Focus first invalid field
      const firstInvalid = fields.find(f => !f.value)?.input;
      firstInvalid?.focus();
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner"></span> Connecting...';

      this.#webdavProvider.configure({ url, username, password });

      // Attempt to list files to verify connection
      await this.#webdavProvider.listVaults();

      this._showResult(resultDiv, 'Connection successful!', 'success');
    } catch (error) {
      safeLog(`[SyncSettingsModal] WebDAV test failed: ${error.message}`);
      this._showResult(resultDiv, `Failed: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        Test connection
      `;
    }
  }

  async _saveConfiguration() {
    const provider = document.getElementById('sync-provider-select')?.value;
    const saveBtn = document.getElementById('btn-save-sync');

    if (provider === 'webdav') {
      const urlInput = document.getElementById('webdav-url');
      const usernameInput = document.getElementById('webdav-username');
      const passwordInput = document.getElementById('webdav-password');
      const url = urlInput?.value.trim();
      const username = usernameInput?.value.trim();
      const password = passwordInput?.value;

      // Validate with aria-invalid feedback
      const fields = [
        { input: urlInput, value: url },
        { input: usernameInput, value: username },
        { input: passwordInput, value: password }
      ];

      let hasError = false;
      fields.forEach(({ input, value }) => {
        if (!value) {
          input?.setAttribute('aria-invalid', 'true');
          input?.classList.add('field-invalid');
          hasError = true;
        }
      });

      if (hasError) {
        showToast(i18n.t('toast.webdavFieldsRequired'), 'error');
        // Focus first invalid field
        fields.find(f => !f.value)?.input?.focus();
        return;
      }

      // Double-submission prevention
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
        saveBtn.innerHTML = '<span class="vault-spinner" role="status" aria-label="Saving..."></span> Saving...';
      }

      try {
        // Clear error states on success
        fields.forEach(({ input }) => {
          input?.removeAttribute('aria-invalid');
          input?.classList.remove('field-invalid');
        });

        await window.vault.cloud.saveConfig({
          provider: 'webdav',
          url,
          username,
          password
        });
        showToast(i18n.t('toast.syncConfigSaved'), 'success');
        this.hide();
      } catch (error) {
        safeLog(`[SyncSettingsModal] Save error: ${error.message}`);
        showToast(i18n.t('toast.syncConfigError') + ': ' + error.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
          saveBtn.textContent = 'Save';
        }
      }
    } else {
      // Double-submission prevention
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
      }

      // Save empty config to clear
      try {
        await window.vault.cloud.saveConfig({ provider: 'none' });
        showToast(i18n.t('toast.syncDisabled'), 'success');
        this.hide();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
        }
      }
    }
  }

  _showResult(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = type === 'error' ? 'vault-field-message error' : 'vault-field-message success';
    element.style.color = type === 'error' ? 'var(--highlight-color)' : 'var(--success-color)';
  }

  show() {
    // Save previously focused element
    this.#previouslyFocusedElement = document.activeElement;
    this.render(); // Ensure DOM exists
    setMainContentInert(true);
    const modal = document.getElementById(this.#modalId);
    if (modal) {
      modal.hidden = false;

      // Focus first focusable element
      requestAnimationFrame(() => {
        modal.querySelector('select, input, button')?.focus();
      });

      // Add escape key handler
      this.#escapeHandler = (e) => {
        if (e.key === 'Escape') this.hide();
      };
      document.addEventListener('keydown', this.#escapeHandler);

      // Add focus trap
      this.#focusTrapHandler = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      };
      modal.addEventListener('keydown', this.#focusTrapHandler);

      // Load existing config
      this._loadCurrentConfig();
    }
  }

  hide() {
    setMainContentInert(false);
    const modal = document.getElementById(this.#modalId);
    if (modal) {
      modal.hidden = true;
      // Remove focus trap
      if (this.#focusTrapHandler) {
        modal.removeEventListener('keydown', this.#focusTrapHandler);
        this.#focusTrapHandler = null;
      }
    }
    // Remove escape key handler
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
    }
    // Restore focus
    if (this.#previouslyFocusedElement && typeof this.#previouslyFocusedElement.focus === 'function') {
      this.#previouslyFocusedElement.focus();
      this.#previouslyFocusedElement = null;
    }
  }

  async _loadCurrentConfig() {
    try {
      const config = await window.vault.cloud.getConfig();
      const provider = config?.provider || 'none';

      const select = document.getElementById('sync-provider-select');
      if (select) select.value = provider;

      const section = document.getElementById('webdav-config-section');
      if (section) section.hidden = provider !== 'webdav';

      if (provider === 'webdav') {
        document.getElementById('webdav-url').value = config.url || '';
        document.getElementById('webdav-username').value = config.username || '';
        document.getElementById('webdav-password').value = config.password || '';
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] Failed to load cloud config: ${error.message}`);
    }
  }

  /**
   * Cleanup and remove modal from DOM
   */
  destroy() {
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
    }
    const modal = document.getElementById(this.#modalId);
    if (modal) modal.remove();
  }
}
