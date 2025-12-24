/**
 * @fileoverview Share Modal (GenPwd Send)
 */

export class ShareModal {
    #modalId = 'share-modal';
    #isVisible = false;
    #currentSecret = null;
    #escapeHandler = null;

    constructor() {
        this.#injectModal();
        this.#attachEvents();
    }

    show(secretData) {
        this.#currentSecret = secretData;
        this.#isVisible = true;

        // Reset state
        document.getElementById('share-step-1').hidden = false;
        document.getElementById('share-step-2').hidden = true;
        document.getElementById('share-result-url').value = '';

        const modal = document.getElementById(this.#modalId);
        if (modal) {
            modal.hidden = false;
            // Add escape key handler
            this.#escapeHandler = (e) => {
                if (e.key === 'Escape') this.hide();
            };
            document.addEventListener('keydown', this.#escapeHandler);
        }
    }

    hide() {
        this.#isVisible = false;
        const modal = document.getElementById(this.#modalId);
        if (modal) modal.hidden = true;
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
            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate link';
            }
        });

        // Copy URL
        document.getElementById('btn-copy-share-url')?.addEventListener('click', () => {
            const input = document.getElementById('share-result-url');
            input.select();
            document.execCommand('copy');
            // Visual feedback
            const btn = document.getElementById('btn-copy-share-url');
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1500);
        });
    }
}
