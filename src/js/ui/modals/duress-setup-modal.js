import { Modal } from './modal.js';
import { showToast } from '../../utils/toast.js';

export class DuressSetupModal extends Modal {
    constructor() {
        super('duress-setup-modal');
        this._setupEventHandlers();
    }

    get template() {
        return `
      <div class="vault-modal-header warning">
        <h2 id="duress-setup-modal-title">🛡️ Plausible Deniability Setup</h2>
        <button class="vault-modal-close" data-action="close" aria-label="Close">×</button>
      </div>
      <div class="vault-modal-body">
        <div class="duress-explanation">
          <p>This advanced security feature creates a <strong>secondary "Decoy" Vault</strong> hidden within your main vault file.</p>
          <p>If you are forced to unlock your vault under duress, enter your <strong>Duress Password</strong> instead of your Master Password.</p>
          <p>The app will unlock the Decoy Vault, which looks fully functional but contains non-sensitive data. It is mathematically impossible to prove the existence of your Real Vault.</p>
        </div>

        <form id="duress-setup-form">
          <div class="vault-form-group">
            <label class="vault-label" for="duress-master-pass">Master Password (verification)</label>
            <input type="password" id="duress-master-pass" class="vault-input" required placeholder="Enter current master password" aria-describedby="duress-error" autofocus>
          </div>

          <hr class="separator">

          <div class="vault-form-group">
            <label class="vault-label" for="duress-pass">New Duress Password</label>
            <input type="password" id="duress-pass" class="vault-input" required placeholder="Cannot be same as Master Password" aria-describedby="duress-pass-hint duress-error">
            <div class="vault-field-hint" id="duress-pass-hint">Entering this password at login will open the Decoy Vault.</div>
          </div>

          <div class="vault-form-group vault-checkbox-group">
            <input type="checkbox" id="duress-autofill" checked>
            <label for="duress-autofill">
              <strong>Auto-populate Decoy Vault</strong>
              <div class="vault-field-hint">Generate realistic "fake" entries (e.g. Amazon, Google) so the vault doesn't look suspicious/empty.</div>
            </label>
          </div>

          <div class="vault-alert vault-alert-danger" id="duress-error" hidden></div>
        </form>
      </div>
      <div class="vault-modal-actions">
        <button class="vault-btn vault-btn-secondary" data-action="close">Cancel</button>
        <button class="vault-btn vault-btn-danger" id="btn-enable-duress">⚠️ Enable Duress Mode</button>
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
            this._showError('Both passwords are required.');
            if (!masterPass) masterInput.setAttribute('aria-invalid', 'true');
            if (!duressPass) duressInput.setAttribute('aria-invalid', 'true');
            return;
        }

        if (masterPass === duressPass) {
            this._showError('Duress password MUST be different from Master password.');
            duressInput.setAttribute('aria-invalid', 'true');
            duressInput.focus();
            return;
        }

        try {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = 'Encrypting Vault (V3)...';

            // Call backend to perform migration
            await window.vault.duress.setup({
                masterPassword: masterPass,
                duressPassword: duressPass,
                populateDecoy: autoFill
            });

            this.hide();
            // Show success toast then reload
            showToast('Duress Mode Enabled! Restarting to apply security container...', 'success');
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            this._showError(error.message);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.textContent = '⚠️ Enable Duress Mode';
        }
    }

    _showError(msg) {
        const el = this.element.querySelector('#duress-error');
        el.textContent = msg;
        el.hidden = false;
    }
}
