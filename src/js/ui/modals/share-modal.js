/**
 * @fileoverview Share Modal (GenPwd Send)
 */

import { showToast } from '../../utils/toast.js';
import { setMainContentInert } from '../events.js';

export class ShareModal {
    #modalId = 'share-modal';
    #isVisible = false;
    #currentSecret = null;
    #escapeHandler = null;
    #focusTrapHandler = null;
    #previouslyFocusedElement = null;

    constructor() {
        this.#injectModal();
        this.#attachEvents();
    }

    show(secretData) {
        // Save previously focused element
        this.#previouslyFocusedElement = document.activeElement;
        this.#currentSecret = secretData;
        this.#isVisible = true;
        setMainContentInert(true);

        // Reset state
        document.getElementById('share-step-1').hidden = false;
        document.getElementById('share-step-2').hidden = true;
        document.getElementById('share-result-url').value = '';

        // Reset step indicator
        document.getElementById('share-step-indicator').textContent = 'Step 1 of 2';
        const dots = document.querySelectorAll('#share-modal .step-dot');
        dots.forEach((dot, i) => dot.classList.toggle('active', i === 0));

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
                const visibleFocusable = Array.from(focusable).filter(el => !el.closest('[hidden]'));
                const first = visibleFocusable[0];
                const last = visibleFocusable[visibleFocusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            };
            modal.addEventListener('keydown', this.#focusTrapHandler);
        }
    }

    hide() {
        this.#isVisible = false;
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

    #injectModal() {
        if (document.getElementById(this.#modalId)) return;

        const html = `
      <div class="vault-modal-overlay" id="${this.#modalId}" hidden role="dialog" aria-modal="true" aria-labelledby="${this.#modalId}-title">
        <div class="vault-modal vault-modal-md">
          <div class="vault-modal-header">
            <h3 id="${this.#modalId}-title">Secure Share (GenPwd Send)</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body">

            <!-- Step Progress Indicator -->
            <div class="step-indicator" aria-live="polite">
              <span class="step-current" id="share-step-indicator">Step 1 of 2</span>
              <div class="step-dots">
                <span class="step-dot active" aria-label="Step 1: Configuration"></span>
                <span class="step-dot" aria-label="Step 2: Result"></span>
              </div>
            </div>

            <!-- Step 1: Config -->
            <div id="share-step-1">
              <div class="vault-info-box">
                <p>Create a secure encrypted link to share this password. The decryption key will be included in the URL but never sent to the server.</p>
              </div>

              <div class="vault-form-group">
                <label class="vault-label">Expiration</label>
                <select class="vault-select" id="share-expiry">
                  <option value="1h">1 Hour</option>
                  <option value="1d" selected>1 Day</option>
                  <option value="7d">7 Days</option>
                </select>
              </div>

              <div class="vault-form-group">
                <label class="vault-checkbox-label">
                  <input type="checkbox" id="share-burn" checked>
                  <span>Burn after reading</span>
                </label>
              </div>

              <div class="vault-modal-actions">
                <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Cancel</button>
                <button type="button" class="vault-btn vault-btn-primary" id="btn-create-share">
                  Generate link
                </button>
              </div>
            </div>

            <!-- Step 2: Result -->
            <div id="share-step-2" hidden>
              <div class="vault-success-icon">✅</div>
              <h4 class="text-center">Link ready!</h4>

              <div class="vault-form-group">
                <label class="vault-label">Share Link</label>
                <div class="vault-input-group">
                  <input type="text" class="vault-input" id="share-result-url" readonly>
                  <button type="button" class="vault-input-btn" id="btn-copy-share-url" title="Copy">
                    📋
                  </button>
                </div>
              </div>

              <div class="vault-alert warning-alert">
                This link grants access to the secret. Only share it with the intended recipient.
              </div>

              <div class="vault-modal-actions">
                <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Close</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    #attachEvents() {
        const modal = document.getElementById(this.#modalId);
        if (!modal) return;

        // Backdrop click to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // Close buttons
        modal.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.hide());
        });

        // Create Share
        document.getElementById('btn-create-share')?.addEventListener('click', async () => {
            const expiry = document.getElementById('share-expiry').value;
            const burn = document.getElementById('share-burn').checked;

            const btn = document.getElementById('btn-create-share');
            btn.disabled = true;
            btn.textContent = 'Generating...';

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
                document.getElementById('share-step-indicator').textContent = 'Step 2 of 2';
                const dots = document.querySelectorAll('#share-modal .step-dot');
                dots.forEach((dot, i) => dot.classList.toggle('active', i === 1));
            } catch (err) {
                showToast('Error: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate link';
            }
        });

        // Copy URL
        document.getElementById('btn-copy-share-url')?.addEventListener('click', async () => {
            const input = document.getElementById('share-result-url');
            try {
                await navigator.clipboard.writeText(input.value);
            } catch {
                // Fallback: select text for manual copy
                input.select();
            }
            // Visual feedback
            const btn = document.getElementById('btn-copy-share-url');
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1500);
        });
    }
}
