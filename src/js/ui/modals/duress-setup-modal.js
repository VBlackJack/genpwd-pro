import { Modal } from './modal.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export class DuressSetupModal extends Modal {
    constructor() {
        super('duress-setup-modal');
        this._setupEventHandlers();
    }

    get template() {
        return `
      <div class="vault-modal-header warning">
        <h2 id="duress-setup-modal-title">🛡️ ${t('vault.duressModal.title')}</h2>
        <button class="vault-modal-close" data-action="close" aria-label="${t('common.close')}">×</button>
      </div>
      <div class="vault-modal-body">
        <div class="duress-explanation">
          <p>${t('vault.duressModal.explanation1')}</p>
          <p>${t('vault.duressModal.explanation2')}</p>
          <p>${t('vault.duressModal.explanation3')}</p>
        </div>

        <form id="duress-setup-form">
          <div class="vault-form-group">
            <label class="vault-label" for="duress-master-pass">${t('vault.duressModal.masterPasswordLabel')}</label>
            <input type="password" id="duress-master-pass" class="vault-input" required placeholder="${t('vault.duressModal.masterPasswordPlaceholder')}" aria-describedby="duress-error" autofocus>
          </div>

          <hr class="separator">

          <div class="vault-form-group">
            <label class="vault-label" for="duress-pass">${t('vault.duressModal.newDuressLabel')}</label>
            <input type="password" id="duress-pass" class="vault-input" required placeholder="${t('vault.duressModal.duressPlaceholder')}" aria-describedby="duress-pass-hint duress-error">
            <div class="vault-field-hint" id="duress-pass-hint">${t('vault.duressModal.duressHint')}</div>
          </div>

          <div class="vault-form-group vault-checkbox-group">
            <input type="checkbox" id="duress-autofill" checked>
            <label for="duress-autofill">
              <strong>${t('vault.duressModal.autofillLabel')}</strong>
              <div class="vault-field-hint">${t('vault.duressModal.autofillHint')}</div>
            </label>
          </div>

          <div class="vault-alert vault-alert-danger" id="duress-error" role="alert" aria-live="assertive" hidden></div>
        </form>
      </div>
      <div class="vault-modal-actions">
        <button class="vault-btn vault-btn-secondary" data-action="close">${t('common.cancel')}</button>
        <button class="vault-btn vault-btn-danger" id="btn-enable-duress">⚠️ ${t('vault.duressModal.enableButton')}</button>
      </div>
    `;
    }

    _setupEventHandlers() {
        this.element.querySelector('#btn-enable-duress').addEventListener('click', () => this._handleSubmit());
    }

    async _handleSubmit() {
        const masterPass = this.element.querySelector('#duress-master-pass').value;
        const duressPass = this.element.querySelector('#duress-pass').value;
        const autoFill = this.element.querySelector('#duress-autofill').checked;
        const errorEl = this.element.querySelector('#duress-error');
        const btn = this.element.querySelector('#btn-enable-duress');

        errorEl.hidden = true;

        const masterInput = this.element.querySelector('#duress-master-pass');
        const duressInput = this.element.querySelector('#duress-pass');

        // Clear previous validation states
        masterInput.removeAttribute('aria-invalid');
        duressInput.removeAttribute('aria-invalid');

        if (!masterPass || !duressPass) {
            this._showError(t('vault.duressModal.bothRequired'));
            if (!masterPass) masterInput.setAttribute('aria-invalid', 'true');
            if (!duressPass) duressInput.setAttribute('aria-invalid', 'true');
            return;
        }

        if (masterPass === duressPass) {
            this._showError(t('vault.duressModal.mustBeDifferent'));
            duressInput.setAttribute('aria-invalid', 'true');
            duressInput.focus();
            return;
        }

        try {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = t('vault.duressModal.encrypting');

            // Call backend to perform migration
            await window.vault.duress.setup({
                masterPassword: masterPass,
                duressPassword: duressPass,
                populateDecoy: autoFill
            });

            this.hide();
            // Show success toast then reload
            showToast(t('vault.duressModal.successMessage'), 'success');
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            this._showError(error.message);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.textContent = `⚠️ ${t('vault.duressModal.enableButton')}`;
        }
    }

    _showError(msg) {
        const el = this.element.querySelector('#duress-error');
        el.textContent = msg;
        el.hidden = false;
    }
}
