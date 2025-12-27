/**
 * @fileoverview Sync Settings Modal
 * Manages cloud provider configuration (WebDAV, Google Drive)
 */

import { Modal } from './modal.js';
import { showToast } from '../../utils/toast.js';
import { WebDAVProvider } from '../../core/sync/index.js';
import { safeLog } from '../../utils/logger.js';
import { t } from '../../utils/i18n.js';

export class SyncSettingsModal extends Modal {
  #webdavProvider;

  constructor() {
    super('sync-settings-modal');
    this.#webdavProvider = new WebDAVProvider();
  }

  /**
   * Show the modal and load config
   */
  show() {
    this.#ensureModalExists();
    super.show();
    this._loadCurrentConfig();
  }

  #ensureModalExists() {
    if (document.getElementById(this._modalId)) return;

    const modalHtml = `
      <div class="vault-modal-overlay" id="${this._modalId}" role="dialog" aria-modal="true" aria-labelledby="${this._modalId}-title" hidden>
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h2 id="${this._modalId}-title">${t('syncModal.title')}</h2>
            <button type="button" class="vault-modal-close" aria-label="${t('common.close')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="vault-modal-body">
            <!-- Provider Selector -->
            <div class="vault-form-group">
              <label class="vault-label" for="sync-provider-select">${t('syncModal.cloudProvider')}</label>
              <select id="sync-provider-select" class="vault-select" aria-describedby="sync-provider-hint">
                <option value="none">${t('syncModal.disabled')}</option>
                <option value="webdav">${t('syncModal.webdav')}</option>
              </select>
              <div class="vault-field-hint" id="sync-provider-hint">${t('syncModal.chooseProvider')}</div>
            </div>

            <!-- WebDAV Configuration -->
            <div id="webdav-config-section" hidden aria-live="polite">
              <div class="vault-form-group">
                <label class="vault-label" for="webdav-url">${t('syncModal.serverUrl')} <span class="required" aria-label="${t('syncModal.required')}">*</span></label>
                <input type="url" id="webdav-url" class="vault-input"
                       placeholder="https://example.com/dav/"
                       autocomplete="url"
                       aria-required="true"
                       aria-describedby="webdav-url-hint">
                <div class="vault-field-hint" id="webdav-url-hint">${t('syncModal.serverUrlHint')}</div>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-username">${t('syncModal.username')} <span class="required" aria-label="${t('syncModal.required')}">*</span></label>
                <input type="text" id="webdav-username" class="vault-input"
                       placeholder="your-username"
                       autocomplete="username"
                       aria-required="true"
                       aria-describedby="webdav-username-hint">
                <div class="vault-field-hint" id="webdav-username-hint">${t('syncModal.usernameHint')}</div>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-password">${t('syncModal.passwordToken')} <span class="required" aria-label="${t('syncModal.required')}">*</span></label>
                <div class="vault-input-group">
                  <input type="password" id="webdav-password" class="vault-input"
                         placeholder="${t('vault.labels.password')}"
                         autocomplete="current-password"
                         aria-required="true"
                         aria-describedby="webdav-password-hint">
                  <button type="button" class="vault-input-btn toggle-pwd-visibility"
                          data-target="webdav-password"
                          aria-label="${t('vault.lockScreen.showHide')}"
                          aria-pressed="false">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    </svg>
                  </button>
                </div>
                <div class="vault-field-hint" id="webdav-password-hint">${t('syncModal.passwordHint')}</div>
              </div>

              <div class="vault-form-group">
                <button type="button" id="btn-test-webdav" class="vault-btn vault-btn-outline vault-btn-sm" style="width: 100%">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  ${t('syncModal.testConnection')}
                </button>
                <div id="webdav-test-result" class="vault-field-message" style="margin-top: 8px;"></div>
              </div>
            </div>

            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-action="close">${t('common.cancel')}</button>
              <button type="button" id="btn-save-sync" class="vault-btn vault-btn-primary">${t('common.save')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this._element = document.getElementById(this._modalId);
    this._setupBaseEventHandlers();
    this.#attachEvents();
  }

  #attachEvents() {
    const modal = this.element;
    if (!modal) return;

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
      await this.#testWebDAVConnection();
    });

    // Save
    document.getElementById('btn-save-sync')?.addEventListener('click', async () => {
      await this.#saveConfiguration();
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

  async #testWebDAVConnection() {
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
      this.#showResult(resultDiv, t('syncModal.fillAllFields'), 'error');
      const firstInvalid = fields.find(f => !f.value)?.input;
      firstInvalid?.focus();
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner"></span> ${t('syncModal.testing')}`;

      this.#webdavProvider.configure({ url, username, password });
      await this.#webdavProvider.listVaults();

      this.#showResult(resultDiv, t('syncModal.connectionSuccess'), 'success');
    } catch (error) {
      safeLog(`[SyncSettingsModal] WebDAV test failed: ${error.message}`);
      this.#showResult(resultDiv, t('syncModal.connectionFailed', { message: error.message }), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        ${t('syncModal.testConnection')}
      `;
    }
  }

  async #saveConfiguration() {
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
        showToast(t('toast.webdavFieldsRequired'), 'error');
        fields.find(f => !f.value)?.input?.focus();
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
        saveBtn.innerHTML = `<span class="vault-spinner" role="status" aria-label="${t('syncModal.saving')}"></span> ${t('syncModal.saving')}`;
      }

      try {
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
        showToast(t('toast.syncConfigSaved'), 'success');
        this.hide();
      } catch (error) {
        safeLog(`[SyncSettingsModal] Save error: ${error.message}`);
        showToast(t('toast.syncConfigError') + ': ' + error.message, 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.removeAttribute('aria-busy');
          saveBtn.textContent = t('common.save');
        }
      }
    } else {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.setAttribute('aria-busy', 'true');
      }

      try {
        await window.vault.cloud.saveConfig({ provider: 'none' });
        showToast(t('toast.syncDisabled'), 'success');
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

  #showResult(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = type === 'error' ? 'vault-field-message error' : 'vault-field-message success';
    element.style.color = type === 'error' ? 'var(--highlight-color)' : 'var(--success-color)';
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
}
