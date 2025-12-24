import { AliasService } from '../../services/alias-service.js';

export class AliasSettingsModal {
    #modal;
    #service;
    #onSaveCallback;
    #escapeHandler = null;

    constructor() {
        this.#service = new AliasService();
        this.#init();
    }

    // Initialize modal structure if not present
    #init() {
        let modal = document.getElementById('alias-settings-modal');
        if (!modal) {
            const modalHtml = `
        <div class="vault-modal-overlay" id="alias-settings-modal" role="dialog" aria-modal="true" aria-labelledby="alias-settings-modal-title" hidden>
          <div class="vault-modal vault-modal-sm">
            <div class="vault-modal-header">
              <h2 id="alias-settings-modal-title">Configure Email Alias</h2>
              <button class="vault-modal-close" type="button" aria-label="Close"></button>
            </div>
            <div class="vault-modal-body">
              <div class="vault-form-group">
                <label class="vault-label" for="alias-provider">Provider</label>
                <select id="alias-provider" class="vault-select">
                  <option value="simplelogin">SimpleLogin</option>
                  <option value="anonaddy">AnonAddy</option>
                </select>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="alias-api-key">API Key / Token</label>
                <div class="vault-input-group">
                  <input type="password" id="alias-api-key" class="vault-input" placeholder="Paste your API key here...">
                  <button type="button" id="btn-toggle-api-key" class="vault-input-btn" title="Show/Hide">
                     👁️
                  </button>
                </div>
                <div class="vault-field-hint" id="alias-help-text">
                  For SimpleLogin: Go to Settings > API Keys.
                </div>
              </div>

               <div id="alias-status-msg" class="vault-field-message" hidden></div>
            </div>
            <div class="vault-modal-actions">
              <button class="vault-btn vault-btn-secondary" id="btn-cancel-alias">Cancel</button>
              <button class="vault-btn vault-btn-primary" id="btn-save-alias">Save</button>
            </div>
          </div>
        </div>
      `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('alias-settings-modal');
        }

        this.#modal = modal;
        this.#attachEvents();
    }

    #attachEvents() {
        const closeBtn = this.#modal.querySelector('.vault-modal-close');
        const cancelBtn = this.#modal.querySelector('#btn-cancel-alias');
        const saveBtn = this.#modal.querySelector('#btn-save-alias');
        const providerSelect = this.#modal.querySelector('#alias-provider');
        const toggleKeyBtn = this.#modal.querySelector('#btn-toggle-api-key');
        const keyInput = this.#modal.querySelector('#alias-api-key');

        // Backdrop click to close
        this.#modal.addEventListener('click', (e) => {
            if (e.target === this.#modal) this.hide();
        });

        const closeHandler = () => this.hide();
        closeBtn.onclick = closeHandler;
        cancelBtn.onclick = closeHandler;

        toggleKeyBtn.onclick = () => {
            keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        };

        providerSelect.onchange = () => {
            const helpText = this.#modal.querySelector('#alias-help-text');
            if (providerSelect.value === 'simplelogin') {
                helpText.textContent = 'For SimpleLogin: Go to Settings > API Keys.';
            } else {
                helpText.textContent = 'For AnonAddy: Go to Settings > API > Generate New Token.';
            }
        };

        saveBtn.onclick = async () => {
            const provider = providerSelect.value;
            const key = keyInput.value.trim();

            if (!key) {
                this.#showStatus('Please enter an API key.', 'error');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Verifying...';
            this.#showStatus('Validating key...', 'info');

            try {
                const isValid = await this.#service.validateApiKey(provider, key);
                if (isValid) {
                    await this.#service.saveConfig(provider, key);
                    this.#showStatus('Key validated and saved!', 'success');
                    setTimeout(() => this.hide(), 1000);
                    if (this.#onSaveCallback) this.#onSaveCallback();
                } else {
                    this.#showStatus('Invalid API key. Check your credentials.', 'error');
                }
            } catch (e) {
                this.#showStatus('Validation error: ' + e.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };
    }

    #showStatus(msg, type) {
        const el = this.#modal.querySelector('#alias-status-msg');
        el.textContent = msg;
        el.className = `status-message ${type}`;
        el.hidden = false;
    }

    show(callback) {
        this.#onSaveCallback = callback;
        this.#modal.hidden = false;
        this.#modal.querySelector('#alias-api-key').value = ''; // Clean for security
        this.#modal.querySelector('#alias-status-msg').hidden = true;
        // Add escape key handler
        this.#escapeHandler = (e) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.#escapeHandler);
    }

    hide() {
        this.#modal.hidden = true;
        // Remove escape key handler
        if (this.#escapeHandler) {
            document.removeEventListener('keydown', this.#escapeHandler);
            this.#escapeHandler = null;
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
        if (this.#modal) {
            this.#modal.remove();
            this.#modal = null;
        }
    }
}
