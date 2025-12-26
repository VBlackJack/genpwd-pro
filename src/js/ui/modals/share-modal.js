/**
 * @fileoverview Share Modal (GenPwd Send)
 */

import { Modal } from './modal.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export class ShareModal extends Modal {
    #currentSecret = null;

    constructor() {
        super('share-modal');
        this.#injectModal();
        this.#attachEvents();
    }

    /**
     * Show the share modal with secret data
     * @param {string} secretData - The secret to share
     */
    show(secretData) {
        this.#currentSecret = secretData;

        // Reset state
        document.getElementById('share-step-1').hidden = false;
        document.getElementById('share-step-2').hidden = true;
        document.getElementById('share-result-url').value = '';

        // Reset step indicator
        document.getElementById('share-step-indicator').textContent = t('shareModal.step1');
        const dots = document.querySelectorAll('#share-modal .step-dot');
        dots.forEach((dot, i) => dot.classList.toggle('active', i === 0));

        // Call parent show
        super.show();
    }

    #injectModal() {
        if (document.getElementById(this._modalId)) return;

        const html = `
      <div class="vault-modal-overlay" id="${this._modalId}" hidden role="dialog" aria-modal="true" aria-labelledby="${this._modalId}-title">
        <div class="vault-modal vault-modal-md">
          <div class="vault-modal-header">
            <h3 id="${this._modalId}-title">${t('shareModal.title')}</h3>
            <button type="button" class="vault-modal-close" aria-label="${t('common.close')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body">

            <!-- Step Progress Indicator -->
            <div class="step-indicator" aria-live="polite">
              <span class="step-current" id="share-step-indicator">${t('shareModal.step1')}</span>
              <div class="step-dots">
                <span class="step-dot active" aria-label="${t('shareModal.stepConfig')}"></span>
                <span class="step-dot" aria-label="${t('shareModal.stepResult')}"></span>
              </div>
            </div>

            <!-- Step 1: Config -->
            <div id="share-step-1">
              <div class="vault-info-box">
                <p>${t('shareModal.infoText')}</p>
              </div>

              <div class="vault-form-group">
                <label class="vault-label">${t('shareModal.expiration')}</label>
                <select class="vault-select" id="share-expiry">
                  <option value="1h">${t('shareModal.hour1')}</option>
                  <option value="1d" selected>${t('shareModal.day1')}</option>
                  <option value="7d">${t('shareModal.days7')}</option>
                </select>
              </div>

              <div class="vault-form-group">
                <label class="vault-checkbox-label">
                  <input type="checkbox" id="share-burn" checked>
                  <span>${t('shareModal.burnAfterReading')}</span>
                </label>
              </div>

              <div class="vault-modal-actions">
                <button type="button" class="vault-btn vault-btn-secondary" data-action="close">${t('common.cancel')}</button>
                <button type="button" class="vault-btn vault-btn-primary" id="btn-create-share">
                  ${t('shareModal.generateLink')}
                </button>
              </div>
            </div>

            <!-- Step 2: Result -->
            <div id="share-step-2" hidden>
              <div class="vault-success-icon">${t('shareModal.done')}</div>
              <h4 class="text-center">${t('shareModal.linkReady')}</h4>

              <div class="vault-form-group">
                <label class="vault-label">${t('shareModal.shareLink')}</label>
                <div class="vault-input-group">
                  <input type="text" class="vault-input" id="share-result-url" readonly>
                  <button type="button" class="vault-input-btn" id="btn-copy-share-url" title="${t('shareModal.copyLink')}">
                    ${t('shareModal.copyLink')}
                  </button>
                </div>
              </div>

              <div class="vault-alert warning-alert">
                ${t('shareModal.warningText')}
              </div>

              <div class="vault-modal-actions">
                <button type="button" class="vault-btn vault-btn-secondary" data-action="close">${t('common.close')}</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', html);
        this._element = document.getElementById(this._modalId);
        this._setupBaseEventHandlers();
    }

    #attachEvents() {
        const modal = this.element;
        if (!modal) return;

        // Create Share
        document.getElementById('btn-create-share')?.addEventListener('click', async () => {
            const expiry = document.getElementById('share-expiry').value;
            const burn = document.getElementById('share-burn').checked;

            const btn = document.getElementById('btn-create-share');
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = `<span class="vault-spinner-small"></span> ${t('shareModal.generating')}`;

            try {
                const result = await window.vault.share.create(this.#currentSecret, {
                    expiryType: expiry,
                    burnAfterReading: burn
                });

                // Show result
                document.getElementById('share-result-url').value = result.url;
                document.getElementById('share-step-1').hidden = true;
                document.getElementById('share-step-2').hidden = false;

                // Update step indicator
                document.getElementById('share-step-indicator').textContent = t('shareModal.step2');
                const dots = document.querySelectorAll('#share-modal .step-dot');
                dots.forEach((dot, i) => dot.classList.toggle('active', i === 1));
            } catch (err) {
                showToast(t('vault.common.error') + ': ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.textContent = t('shareModal.generateLink');
            }
        });

        // Copy URL
        document.getElementById('btn-copy-share-url')?.addEventListener('click', async () => {
            const input = document.getElementById('share-result-url');
            try {
                await navigator.clipboard.writeText(input.value);
                showToast(t('shareModal.linkCopied'), 'success');
            } catch {
                // Fallback: select text for manual copy
                input.select();
            }
        });
    }
}
