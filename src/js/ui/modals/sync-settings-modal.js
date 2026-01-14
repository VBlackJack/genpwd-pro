/**
 * @fileoverview Sync Settings Modal
 * Manages cloud provider configuration (WebDAV, OneDrive, Dropbox)
 */

import { Modal } from './modal.js';
import { showToast } from '../../utils/toast.js';
import { WebDAVProvider, getOneDriveProvider, getDropboxProvider } from '../../core/sync/index.js';
import { safeLog } from '../../utils/logger.js';
import { t } from '../../utils/i18n.js';

export class SyncSettingsModal extends Modal {
  #webdavProvider;
  #oneDriveConnected = false;
  #dropboxConnected = false;

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
              <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
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
                <option value="onedrive">${t('syncModal.onedrive', 'Microsoft OneDrive')}</option>
                <option value="dropbox">${t('syncModal.dropbox', 'Dropbox')}</option>
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
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    </svg>
                  </button>
                </div>
                <div class="vault-field-hint" id="webdav-password-hint">${t('syncModal.passwordHint')}</div>
              </div>

              <div class="vault-form-group">
                <button type="button" id="btn-test-webdav" class="vault-btn vault-btn-outline vault-btn-sm" style="width: 100%">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  ${t('syncModal.testConnection')}
                </button>
                <div id="webdav-test-result" class="vault-field-message" style="margin-top: 8px;"></div>
              </div>
            </div>

            <!-- OneDrive Configuration -->
            <div id="onedrive-config-section" hidden aria-live="polite">
              <div class="sync-oauth-section">
                <div class="sync-provider-info">
                  <svg class="sync-provider-icon" viewBox="0 0 24 24" width="48" height="48" fill="none">
                    <path d="M12.5 3C8.36 3 5 6.36 5 10.5c0 .09 0 .18.01.27A5.5 5.5 0 0 0 5.5 22h13a5.5 5.5 0 0 0 .5-10.97A7.5 7.5 0 0 0 12.5 3z" fill="#0078D4"/>
                    <path d="M9 14.5c0-2.21 1.79-4 4-4 1.68 0 3.12 1.04 3.71 2.5H18.5a3 3 0 0 1 0 6h-9a3 3 0 0 1-3-3c0-.55.15-1.07.41-1.51" fill="#50E6FF"/>
                  </svg>
                  <div class="sync-provider-text">
                    <h3>${t('syncModal.onedriveTitle', 'Microsoft OneDrive')}</h3>
                    <p>${t('syncModal.onedriveDesc', 'Sync your vault securely with OneDrive. Your data is encrypted before upload.')}</p>
                  </div>
                </div>
                <div id="onedrive-status" class="sync-status"></div>
                <button type="button" id="btn-connect-onedrive" class="vault-btn vault-btn-microsoft">
                  <svg viewBox="0 0 21 21" width="20" height="20" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  ${t('syncModal.connectMicrosoft', 'Sign in with Microsoft')}
                </button>
                <button type="button" id="btn-disconnect-onedrive" class="vault-btn vault-btn-outline vault-btn-danger" hidden>
                  ${t('syncModal.disconnect', 'Disconnect')}
                </button>
              </div>
            </div>

            <!-- Dropbox Configuration -->
            <div id="dropbox-config-section" hidden aria-live="polite">
              <div class="sync-oauth-section">
                <div class="sync-provider-info">
                  <svg class="sync-provider-icon" viewBox="0 0 24 24" width="48" height="48" fill="#0061FF">
                    <path d="M6 2l6 4-6 4 6 4-6 4-6-4 6-4-6-4 6-4zm12 0l6 4-6 4 6 4-6 4-6-4 6-4-6-4 6-4zm-6 8l6-4 6 4-6 4-6-4zm0 4l6 4-6 4-6-4 6-4z"/>
                  </svg>
                  <div class="sync-provider-text">
                    <h3>${t('syncModal.dropboxTitle', 'Dropbox')}</h3>
                    <p>${t('syncModal.dropboxDesc', 'Sync your vault securely with Dropbox. Your data is encrypted before upload.')}</p>
                  </div>
                </div>
                <div id="dropbox-status" class="sync-status"></div>
                <button type="button" id="btn-connect-dropbox" class="vault-btn vault-btn-dropbox">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M6 2l6 3.6L6 9.2 0 5.6 6 2zm12 0l6 3.6-6 3.6-6-3.6L18 2zM0 12.8l6-3.6 6 3.6-6 3.6-6-3.6zm18-3.6l6 3.6-6 3.6-6-3.6 6-3.6zM6 17.6l6-3.6 6 3.6-6 3.6-6-3.6z"/>
                  </svg>
                  ${t('syncModal.connectDropbox', 'Sign in with Dropbox')}
                </button>
                <button type="button" id="btn-disconnect-dropbox" class="vault-btn vault-btn-outline vault-btn-danger" hidden>
                  ${t('syncModal.disconnect', 'Disconnect')}
                </button>
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

    // Provider change - show/hide appropriate config section
    const providerSelect = document.getElementById('sync-provider-select');
    providerSelect?.addEventListener('change', (e) => {
      const provider = e.target.value;

      // Hide all config sections
      document.getElementById('webdav-config-section').hidden = true;
      document.getElementById('onedrive-config-section').hidden = true;
      document.getElementById('dropbox-config-section').hidden = true;

      // Show selected provider section
      if (provider === 'webdav') {
        document.getElementById('webdav-config-section').hidden = false;
      } else if (provider === 'onedrive') {
        document.getElementById('onedrive-config-section').hidden = false;
        this.#checkOneDriveStatus();
      } else if (provider === 'dropbox') {
        document.getElementById('dropbox-config-section').hidden = false;
        this.#checkDropboxStatus();
      }
    });

    // OneDrive Connect
    document.getElementById('btn-connect-onedrive')?.addEventListener('click', async () => {
      await this.#connectOneDrive();
    });

    // OneDrive Disconnect
    document.getElementById('btn-disconnect-onedrive')?.addEventListener('click', async () => {
      await this.#disconnectOneDrive();
    });

    // Dropbox Connect
    document.getElementById('btn-connect-dropbox')?.addEventListener('click', async () => {
      await this.#connectDropbox();
    });

    // Dropbox Disconnect
    document.getElementById('btn-disconnect-dropbox')?.addEventListener('click', async () => {
      await this.#disconnectDropbox();
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
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

      // Hide all sections first
      document.getElementById('webdav-config-section').hidden = true;
      document.getElementById('onedrive-config-section').hidden = true;
      document.getElementById('dropbox-config-section').hidden = true;

      // Show relevant section and load config
      if (provider === 'webdav') {
        document.getElementById('webdav-config-section').hidden = false;
        document.getElementById('webdav-url').value = config.url || '';
        document.getElementById('webdav-username').value = config.username || '';
        document.getElementById('webdav-password').value = config.password || '';
      } else if (provider === 'onedrive') {
        document.getElementById('onedrive-config-section').hidden = false;
        this.#checkOneDriveStatus();
      } else if (provider === 'dropbox') {
        document.getElementById('dropbox-config-section').hidden = false;
        this.#checkDropboxStatus();
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] Failed to load cloud config: ${error.message}`);
    }
  }

  // ==================== OneDrive Methods ====================

  async #checkOneDriveStatus() {
    const statusDiv = document.getElementById('onedrive-status');
    const connectBtn = document.getElementById('btn-connect-onedrive');
    const disconnectBtn = document.getElementById('btn-disconnect-onedrive');

    try {
      // Check if we have stored OneDrive tokens
      const result = await window.vault?.cloud?.checkOAuthStatus?.('onedrive');

      if (result?.connected) {
        this.#oneDriveConnected = true;
        statusDiv.innerHTML = `<span class="sync-status-connected">✓ ${t('syncModal.connectedAs', { account: result.email || 'Microsoft Account' })}</span>`;
        connectBtn.hidden = true;
        disconnectBtn.hidden = false;
      } else {
        this.#oneDriveConnected = false;
        statusDiv.innerHTML = `<span class="sync-status-disconnected">${t('syncModal.notConnected', 'Not connected')}</span>`;
        connectBtn.hidden = false;
        disconnectBtn.hidden = true;
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] OneDrive status check failed: ${error.message}`);
      statusDiv.innerHTML = `<span class="sync-status-disconnected">${t('syncModal.notConnected', 'Not connected')}</span>`;
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
  }

  async #connectOneDrive() {
    const btn = document.getElementById('btn-connect-onedrive');
    const statusDiv = document.getElementById('onedrive-status');

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner"></span> ${t('syncModal.connecting', 'Connecting...')}`;
      statusDiv.innerHTML = `<span class="sync-status-pending">${t('syncModal.waitingAuth', 'Waiting for authorization...')}</span>`;

      // Call Electron main process to start OAuth flow
      const result = await window.vault?.cloud?.startOAuth?.('onedrive');

      if (result?.success) {
        this.#oneDriveConnected = true;
        showToast(t('syncModal.onedriveConnected', 'Connected to OneDrive'), 'success');
        this.#checkOneDriveStatus();
      } else {
        throw new Error(result?.error || 'OAuth failed');
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] OneDrive connect failed: ${error.message}`);
      showToast(t('syncModal.connectFailed', { error: error.message }), 'error');
      statusDiv.innerHTML = `<span class="sync-status-error">${error.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 21 21" width="20" height="20" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        ${t('syncModal.connectMicrosoft', 'Sign in with Microsoft')}
      `;
    }
  }

  async #disconnectOneDrive() {
    const btn = document.getElementById('btn-disconnect-onedrive');

    try {
      btn.disabled = true;
      btn.textContent = t('syncModal.disconnecting', 'Disconnecting...');

      await window.vault?.cloud?.disconnectOAuth?.('onedrive');

      this.#oneDriveConnected = false;
      showToast(t('syncModal.onedriveDisconnected', 'Disconnected from OneDrive'), 'success');
      this.#checkOneDriveStatus();
    } catch (error) {
      safeLog(`[SyncSettingsModal] OneDrive disconnect failed: ${error.message}`);
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('syncModal.disconnect', 'Disconnect');
    }
  }

  // ==================== Dropbox Methods ====================

  async #checkDropboxStatus() {
    const statusDiv = document.getElementById('dropbox-status');
    const connectBtn = document.getElementById('btn-connect-dropbox');
    const disconnectBtn = document.getElementById('btn-disconnect-dropbox');

    try {
      const result = await window.vault?.cloud?.checkOAuthStatus?.('dropbox');

      if (result?.connected) {
        this.#dropboxConnected = true;
        statusDiv.innerHTML = `<span class="sync-status-connected">✓ ${t('syncModal.connectedAs', { account: result.email || 'Dropbox Account' })}</span>`;
        connectBtn.hidden = true;
        disconnectBtn.hidden = false;
      } else {
        this.#dropboxConnected = false;
        statusDiv.innerHTML = `<span class="sync-status-disconnected">${t('syncModal.notConnected', 'Not connected')}</span>`;
        connectBtn.hidden = false;
        disconnectBtn.hidden = true;
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] Dropbox status check failed: ${error.message}`);
      statusDiv.innerHTML = `<span class="sync-status-disconnected">${t('syncModal.notConnected', 'Not connected')}</span>`;
      connectBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
  }

  async #connectDropbox() {
    const btn = document.getElementById('btn-connect-dropbox');
    const statusDiv = document.getElementById('dropbox-status');

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner"></span> ${t('syncModal.connecting', 'Connecting...')}`;
      statusDiv.innerHTML = `<span class="sync-status-pending">${t('syncModal.waitingAuth', 'Waiting for authorization...')}</span>`;

      const result = await window.vault?.cloud?.startOAuth?.('dropbox');

      if (result?.success) {
        this.#dropboxConnected = true;
        showToast(t('syncModal.dropboxConnected', 'Connected to Dropbox'), 'success');
        this.#checkDropboxStatus();
      } else {
        throw new Error(result?.error || 'OAuth failed');
      }
    } catch (error) {
      safeLog(`[SyncSettingsModal] Dropbox connect failed: ${error.message}`);
      showToast(t('syncModal.connectFailed', { error: error.message }), 'error');
      statusDiv.innerHTML = `<span class="sync-status-error">${error.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M6 2l6 3.6L6 9.2 0 5.6 6 2zm12 0l6 3.6-6 3.6-6-3.6L18 2zM0 12.8l6-3.6 6 3.6-6 3.6-6-3.6zm18-3.6l6 3.6-6 3.6-6-3.6 6-3.6zM6 17.6l6-3.6 6 3.6-6 3.6-6-3.6z"/>
        </svg>
        ${t('syncModal.connectDropbox', 'Sign in with Dropbox')}
      `;
    }
  }

  async #disconnectDropbox() {
    const btn = document.getElementById('btn-disconnect-dropbox');

    try {
      btn.disabled = true;
      btn.textContent = t('syncModal.disconnecting', 'Disconnecting...');

      await window.vault?.cloud?.disconnectOAuth?.('dropbox');

      this.#dropboxConnected = false;
      showToast(t('syncModal.dropboxDisconnected', 'Disconnected from Dropbox'), 'success');
      this.#checkDropboxStatus();
    } catch (error) {
      safeLog(`[SyncSettingsModal] Dropbox disconnect failed: ${error.message}`);
      showToast(error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('syncModal.disconnect', 'Disconnect');
    }
  }
}
