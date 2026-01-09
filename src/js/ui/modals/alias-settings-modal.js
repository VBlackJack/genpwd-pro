import { Modal } from './modal.js';
import { AliasService } from '../../services/alias-service.js';
import { t } from '../../utils/i18n.js';

export class AliasSettingsModal extends Modal {
    #service;
    #onSaveCallback;

    constructor() {
        super('alias-settings-modal');
        this.#service = new AliasService();
        this.#init();
    }

    // Initialize modal structure if not present
    #init() {
        if (document.getElementById(this._modalId)) {
            this._element = document.getElementById(this._modalId);
        } else {
            const modalHtml = `
        <div class="vault-modal-overlay" id="${this._modalId}" role="dialog" aria-modal="true" aria-labelledby="${this._modalId}-title" hidden>
          <div class="vault-modal vault-modal-sm">
            <div class="vault-modal-header">
              <h2 id="${this._modalId}-title">${t('aliasModal.title')}</h2>
              <button class="vault-modal-close" type="button" aria-label="${t('common.close')}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="vault-modal-body">
              <div class="vault-form-group">
                <label class="vault-label" for="alias-provider">${t('aliasModal.provider')} <span class="required" aria-label="${t('aliasModal.required')}">*</span></label>
                <select id="alias-provider" class="vault-select" required aria-required="true">
                  <option value="simplelogin">SimpleLogin</option>
                  <option value="anonaddy">AnonAddy</option>
                </select>
              </div>

              <div class="vault-form-group">
                <label class="vault-label" for="alias-api-key">${t('aliasModal.apiKey')} <span class="required" aria-label="${t('aliasModal.required')}">*</span></label>
                <div class="vault-input-group">
                  <input type="password" id="alias-api-key" class="vault-input"
                         placeholder="${t('aliasModal.apiKeyPlaceholder')}"
                         required
                         aria-required="true"
                         aria-describedby="alias-help-text alias-api-key-error"
                         autocomplete="off">
                  <button type="button" id="btn-toggle-api-key" class="vault-input-btn"
                          title="${t('aliasModal.showHide')}"
                          aria-label="${t('aliasModal.showHide')}"
                          aria-pressed="false">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    </svg>
                  </button>
                </div>
                <div class="vault-field-hint" id="alias-help-text">
                  ${t('aliasModal.helpSimpleLogin')}
                </div>
                <div class="field-error" id="alias-api-key-error" role="alert" hidden aria-live="polite"></div>
              </div>

              <div id="alias-status-msg" class="vault-field-message" role="status" aria-live="polite" hidden></div>
            </div>
            <div class="vault-modal-actions">
              <button class="vault-btn vault-btn-secondary" id="btn-cancel-alias" type="button" data-action="close">${t('common.cancel')}</button>
              <button class="vault-btn vault-btn-primary" id="btn-save-alias" type="button">${t('common.save')}</button>
            </div>
          </div>
        </div>
      `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            this._element = document.getElementById(this._modalId);
        }

        this._setupBaseEventHandlers();
        this.#attachEvents();
    }

    #attachEvents() {
        const modal = this.element;
        if (!modal) return;

        const saveBtn = modal.querySelector('#btn-save-alias');
        const providerSelect = modal.querySelector('#alias-provider');
        const toggleKeyBtn = modal.querySelector('#btn-toggle-api-key');
        const keyInput = modal.querySelector('#alias-api-key');

        toggleKeyBtn.addEventListener('click', () => {
            const isPassword = keyInput.type === 'password';
            keyInput.type = isPassword ? 'text' : 'password';
            toggleKeyBtn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        });

        // Real-time validation on input
        keyInput.addEventListener('input', () => {
            const errorEl = modal.querySelector('#alias-api-key-error');
            if (keyInput.value.trim()) {
                keyInput.removeAttribute('aria-invalid');
                keyInput.classList.remove('field-invalid');
                errorEl.hidden = true;
            }
        });

        providerSelect.addEventListener('change', () => {
            const helpText = modal.querySelector('#alias-help-text');
            if (providerSelect.value === 'simplelogin') {
                helpText.textContent = t('aliasModal.helpSimpleLogin');
            } else {
                helpText.textContent = t('aliasModal.helpAnonAddy');
            }
        });

        saveBtn.addEventListener('click', async () => {
            const provider = providerSelect.value;
            const key = keyInput.value.trim();
            const errorEl = modal.querySelector('#alias-api-key-error');

            if (!key) {
                // Show inline validation error
                keyInput.setAttribute('aria-invalid', 'true');
                keyInput.classList.add('field-invalid');
                errorEl.textContent = t('aliasModal.enterApiKey');
                errorEl.hidden = false;
                keyInput.focus();
                return;
            }

            saveBtn.disabled = true;
            saveBtn.setAttribute('aria-busy', 'true');
            saveBtn.textContent = t('aliasModal.verifying');
            this.#showStatus(t('aliasModal.validating'), 'info');

            try {
                const isValid = await this.#service.validateApiKey(provider, key);
                if (isValid) {
                    // Clear any previous error state
                    keyInput.removeAttribute('aria-invalid');
                    keyInput.classList.remove('field-invalid');
                    errorEl.hidden = true;

                    await this.#service.saveConfig(provider, key);
                    this.#showStatus(t('aliasModal.keyValidated'), 'success');
                    setTimeout(() => this.hide(), 1000);
                    if (this.#onSaveCallback) this.#onSaveCallback();
                } else {
                    // Show validation error with aria-invalid
                    keyInput.setAttribute('aria-invalid', 'true');
                    keyInput.classList.add('field-invalid');
                    errorEl.textContent = t('aliasModal.invalidKey');
                    errorEl.hidden = false;
                    this.#showStatus(t('aliasModal.invalidKey'), 'error');
                }
            } catch (e) {
                // Show error with aria-invalid
                keyInput.setAttribute('aria-invalid', 'true');
                keyInput.classList.add('field-invalid');
                errorEl.textContent = e.message;
                errorEl.hidden = false;
                this.#showStatus(t('aliasModal.validationError', { message: e.message }), 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.removeAttribute('aria-busy');
                saveBtn.textContent = t('common.save');
            }
        });
    }

    #showStatus(msg, type) {
        const el = this.element.querySelector('#alias-status-msg');
        el.textContent = msg;
        el.className = `status-message ${type}`;
        el.hidden = false;
    }

    /**
     * Show the modal with an optional save callback
     * @param {Function} [callback] - Called when config is saved successfully
     */
    show(callback) {
        this.#onSaveCallback = callback;

        // Reset form state for security
        const modal = this.element;
        modal.querySelector('#alias-api-key').value = '';
        modal.querySelector('#alias-api-key').type = 'password';
        modal.querySelector('#alias-status-msg').hidden = true;
        modal.querySelector('#btn-toggle-api-key')?.setAttribute('aria-pressed', 'false');

        // Clear any previous validation errors
        const keyInput = modal.querySelector('#alias-api-key');
        const errorEl = modal.querySelector('#alias-api-key-error');
        keyInput?.removeAttribute('aria-invalid');
        keyInput?.classList.remove('field-invalid');
        if (errorEl) errorEl.hidden = true;

        // Call base class show (handles inert, escape, focus trap, focus)
        super.show();
    }
}
