import { AliasService } from '../../services/alias-service.js';
import { setMainContentInert } from '../events.js';

export class AliasSettingsModal {
    #modal;
    #service;
    #onSaveCallback;
    #escapeHandler = null;
    #focusTrapHandler = null;
    #previouslyFocusedElement = null;

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
              <button class="vault-modal-close" type="button" aria-label="Close dialog">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="vault-modal-body">
              <div class="vault-form-group">
                <label class="vault-label" for="alias-provider">Provider <span class="required" aria-label="required">*</span></label>
                <select id="alias-provider" class="vault-select" required aria-required="true">
                  <option value="simplelogin">SimpleLogin</option>
                  <option value="anonaddy">AnonAddy</option>
                </select>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="alias-api-key">API Key / Token <span class="required" aria-label="required">*</span></label>
                <div class="vault-input-group">
                  <input type="password" id="alias-api-key" class="vault-input"
                         placeholder="Paste your API key here..."
                         required
                         aria-required="true"
                         aria-describedby="alias-help-text alias-api-key-error"
                         autocomplete="off">
                  <button type="button" id="btn-toggle-api-key" class="vault-input-btn"
                          title="Show/Hide password"
                          aria-label="Toggle API key visibility"
                          aria-pressed="false">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    </svg>
                  </button>
                </div>
                <div class="vault-field-hint" id="alias-help-text">
                  For SimpleLogin: Go to Settings > API Keys.
                </div>
                <div class="field-error" id="alias-api-key-error" hidden aria-live="polite"></div>
              </div>

              <div id="alias-status-msg" class="vault-field-message" role="status" aria-live="polite" hidden></div>
            </div>
            <div class="vault-modal-actions">
              <button class="vault-btn vault-btn-secondary" id="btn-cancel-alias" type="button">Cancel</button>
              <button class="vault-btn vault-btn-primary" id="btn-save-alias" type="button">Save</button>
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
        closeBtn.addEventListener('click', closeHandler);
        cancelBtn.addEventListener('click', closeHandler);

        toggleKeyBtn.addEventListener('click', () => {
            const isPassword = keyInput.type === 'password';
            keyInput.type = isPassword ? 'text' : 'password';
            toggleKeyBtn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        });

        // Real-time validation on input
        keyInput.addEventListener('input', () => {
            const errorEl = this.#modal.querySelector('#alias-api-key-error');
            if (keyInput.value.trim()) {
                keyInput.removeAttribute('aria-invalid');
                keyInput.classList.remove('field-invalid');
                errorEl.hidden = true;
            }
        });

        providerSelect.addEventListener('change', () => {
            const helpText = this.#modal.querySelector('#alias-help-text');
            if (providerSelect.value === 'simplelogin') {
                helpText.textContent = 'For SimpleLogin: Go to Settings > API Keys.';
            } else {
                helpText.textContent = 'For AnonAddy: Go to Settings > API > Generate New Token.';
            }
        });

        saveBtn.addEventListener('click', async () => {
            const provider = providerSelect.value;
            const key = keyInput.value.trim();
            const errorEl = this.#modal.querySelector('#alias-api-key-error');

            if (!key) {
                // Show inline validation error
                keyInput.setAttribute('aria-invalid', 'true');
                keyInput.classList.add('field-invalid');
                errorEl.textContent = 'Please enter an API key.';
                errorEl.hidden = false;
                keyInput.focus();
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Verifying...';
            this.#showStatus('Validating key...', 'info');

            try {
                const isValid = await this.#service.validateApiKey(provider, key);
                if (isValid) {
                    // Clear any previous error state
                    keyInput.removeAttribute('aria-invalid');
                    keyInput.classList.remove('field-invalid');
                    errorEl.hidden = true;

                    await this.#service.saveConfig(provider, key);
                    this.#showStatus('Key validated and saved!', 'success');
                    setTimeout(() => this.hide(), 1000);
                    if (this.#onSaveCallback) this.#onSaveCallback();
                } else {
                    // Show validation error with aria-invalid
                    keyInput.setAttribute('aria-invalid', 'true');
                    keyInput.classList.add('field-invalid');
                    errorEl.textContent = 'Invalid API key. Check your credentials.';
                    errorEl.hidden = false;
                    this.#showStatus('Invalid API key. Check your credentials.', 'error');
                }
            } catch (e) {
                // Show error with aria-invalid
                keyInput.setAttribute('aria-invalid', 'true');
                keyInput.classList.add('field-invalid');
                errorEl.textContent = e.message;
                errorEl.hidden = false;
                this.#showStatus('Validation error: ' + e.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        });
    }

    #showStatus(msg, type) {
        const el = this.#modal.querySelector('#alias-status-msg');
        el.textContent = msg;
        el.className = `status-message ${type}`;
        el.hidden = false;
    }

    show(callback) {
        // Save previously focused element
        this.#previouslyFocusedElement = document.activeElement;
        this.#onSaveCallback = callback;
        setMainContentInert(true);
        this.#modal.hidden = false;
        this.#modal.querySelector('#alias-api-key').value = ''; // Clean for security
        this.#modal.querySelector('#alias-api-key').type = 'password'; // Reset to password type
        this.#modal.querySelector('#alias-status-msg').hidden = true;

        // Focus first input
        requestAnimationFrame(() => {
            this.#modal.querySelector('#alias-provider')?.focus();
        });

        // Add escape key handler
        this.#escapeHandler = (e) => {
            if (e.key === 'Escape') this.hide();
        };
        document.addEventListener('keydown', this.#escapeHandler);

        // Add focus trap
        this.#focusTrapHandler = (e) => {
            if (e.key !== 'Tab') return;
            const focusable = this.#modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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
        this.#modal.addEventListener('keydown', this.#focusTrapHandler);
    }

    hide() {
        setMainContentInert(false);
        this.#modal.hidden = true;
        // Remove focus trap
        if (this.#focusTrapHandler) {
            this.#modal.removeEventListener('keydown', this.#focusTrapHandler);
            this.#focusTrapHandler = null;
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
