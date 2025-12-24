/**
 * @fileoverview Sync Settings Modal
 * Manages cloud provider configuration (WebDAV, Google Drive)
 */

import { showToast } from '../../utils/toast.js';
import { WebDAVProvider } from '../../core/sync/index.js';
import { safeLog } from '../../utils/logger.js';

export class SyncSettingsModal {
  #escapeHandler = null;

  constructor() {
    this._modalId = 'sync-settings-modal';
    this._webdavProvider = new WebDAVProvider();
  }

  /**
   * Render and inject the modal into the DOM
   */
  render() {
    if (document.getElementById(this._modalId)) return; // Already exists

    const modalHtml = `
      <div class="vault-modal-overlay" id="${this._modalId}" role="dialog" aria-modal="true" aria-labelledby="${this._modalId}-title" hidden>
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="${this._modalId}-title">Sync Settings</h3>
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
              <label class="vault-label">Cloud Provider</label>
              <select id="sync-provider-select" class="vault-select">
                <option value="none">Disabled (Local only)</option>
                <option value="webdav">WebDAV / Nextcloud / OwnCloud</option>
                <!-- <option value="gdrive" disabled>Google Drive (Coming soon)</option> -->
              </select>
            </div>

            <!-- WebDAV Configuration -->
            <div id="webdav-config-section" hidden>
              <div class="vault-form-group">
                <label class="vault-label" for="webdav-url">Server URL</label>
                <input type="url" id="webdav-url" class="vault-input" placeholder="https://cloud.example.com/remote.php/dav/files/user/" autocomplete="url">
                <div class="vault-field-hint">Full URL to your WebDAV folder</div>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-username">Username</label>
                <input type="text" id="webdav-username" class="vault-input" autocomplete="username">
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="webdav-password">Password / App Token</label>
                <div class="vault-input-group">
                  <input type="password" id="webdav-password" class="vault-input" autocomplete="current-password">
                  <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="webdav-password">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
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
    const modal = document.getElementById(this._modalId);
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

    // Toggle Password Visibility
    modal.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.target;
        const input = document.getElementById(inputId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });
  }

  async _testWebDAVConnection() {
    const url = document.getElementById('webdav-url')?.value.trim();
    const username = document.getElementById('webdav-username')?.value.trim();
    const password = document.getElementById('webdav-password')?.value;
    const resultDiv = document.getElementById('webdav-test-result');
    const btn = document.getElementById('btn-test-webdav');

    if (!url || !username || !password) {
      this._showResult(resultDiv, 'Please fill in all fields', 'error');
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner"></span> Connecting...';

      this._webdavProvider.configure({ url, username, password });

      // Attempt to list files to verify connection
      await this._webdavProvider.listVaults();

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

    if (provider === 'webdav') {
      const url = document.getElementById('webdav-url')?.value.trim();
      const username = document.getElementById('webdav-username')?.value.trim();
      const password = document.getElementById('webdav-password')?.value;

      if (!url || !username || !password) {
        showToast('All WebDAV fields are required', 'error');
        return;
      }

      try {
        await window.vault.cloud.saveConfig({
          provider: 'webdav',
          url,
          username,
          password
        });
        showToast('Configuration saved', 'success');
        this.hide();
      } catch (error) {
        safeLog(`[SyncSettingsModal] Save error: ${error.message}`);
        showToast('Save error: ' + error.message, 'error');
      }
    } else {
      // Save empty config to clear
      try {
        await window.vault.cloud.saveConfig({ provider: 'none' });
        showToast('Sync disabled', 'success');
        this.hide();
      } catch (error) {
        showToast(error.message, 'error');
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
    this.render(); // Ensure DOM exists
    const modal = document.getElementById(this._modalId);
    if (modal) {
      modal.hidden = false;
      // Add escape key handler
      this.#escapeHandler = (e) => {
        if (e.key === 'Escape') this.hide();
      };
      document.addEventListener('keydown', this.#escapeHandler);
      // Load existing config
      this._loadCurrentConfig();
    }
  }

  hide() {
    const modal = document.getElementById(this._modalId);
    if (modal) modal.hidden = true;
    // Remove escape key handler
    if (this.#escapeHandler) {
      document.removeEventListener('keydown', this.#escapeHandler);
      this.#escapeHandler = null;
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
    const modal = document.getElementById(this._modalId);
    if (modal) modal.remove();
  }
}
