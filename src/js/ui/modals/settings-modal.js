/**
 * @fileoverview Settings Modal
 * Centralized settings for GenPwd Pro
 */

export class SettingsModal {
    #modalId = 'settings-modal';
    #isVisible = false;
    #escapeHandler = null;

    constructor() {
        this.#injectModal();
        this.#attachEvents();
    }

    show() {
        this.#isVisible = true;
        const modal = document.getElementById(this.#modalId);
        if (modal) {
            modal.hidden = false;
            // Focus interactions
            modal.querySelector('button')?.focus();
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

    #injectModal() {
        if (document.getElementById(this.#modalId)) return;

        const html = `
      <div class="vault-modal-overlay" id="${this.#modalId}" hidden role="dialog" aria-modal="true" aria-labelledby="${this.#modalId}-title">
        <div class="vault-modal vault-modal-md">
          <div class="vault-modal-header">
            <h3 id="${this.#modalId}-title">Settings</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body no-padding">
            <div class="settings-layout">
              <div class="settings-sidebar">
                <button class="settings-nav-item active" data-tab="general">General</button>
                <button class="settings-nav-item" data-tab="security">Security</button>
                <button class="settings-nav-item danger" data-tab="danger">Danger Zone</button>
              </div>
              <div class="settings-content">
                <!-- General Tab -->
                <div class="settings-tab active" id="tab-general">
                  <div class="setting-group">
                    <label class="setting-label">Appearance</label>
                    <div class="setting-desc">Customize application appearance</div>
                    <div class="setting-control">
                      <button class="vault-btn vault-btn-sm" id="btn-theme-toggle-settings">Toggle Light/Dark Theme</button>
                    </div>
                  </div>
                </div>

                <!-- Security Tab -->
                <div class="settings-tab" id="tab-security" hidden>
                   <div class="setting-group">
                    <label class="setting-label">Auto-Lock</label>
                    <div class="setting-desc">Lock vault after a period of inactivity</div>
                    <div class="setting-control">
                      <select class="vault-select" id="settings-autolock">
                        <option value="1">1 minute</option>
                        <option value="5">5 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="0">Never (not recommended)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Danger Tab -->
                <div class="settings-tab" id="tab-danger" hidden>
                  <div class="vault-alert count-warning">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                      <strong>Danger Zone</strong>
                      <p>Actions here are irreversible.</p>
                    </div>
                  </div>

                  <div class="setting-group danger-group">
                    <label class="setting-label text-danger">Panic Mode (Nuclear Option)</label>
                    <div class="setting-desc">Permanently destroys the vault and all its data. No recovery possible.</div>
                    <div class="setting-control">
                      <button class="vault-btn vault-btn-danger" id="btn-panic-nuke">
                        ☢️ DESTROY VAULT
                      </button>
                    </div>
                  </div>
                </div>
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

        // Tab Navigation
        modal.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update nav
                modal.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update content
                const tabId = `tab-${btn.dataset.tab}`;
                modal.querySelectorAll('.settings-tab').forEach(t => t.hidden = true);
                modal.querySelector(`#${tabId}`).hidden = false;
            });
        });

        // Panic Button
        const panicBtn = document.getElementById('btn-panic-nuke');
        panicBtn?.addEventListener('click', async () => {
            if (confirm('⚠️ ARE YOU SURE?\n\nThis action will PERMANENTLY DESTROY this vault.\nThere will be NO way to undo this.')) {
                // Double confirm
                if (confirm('FINAL CONFIRMATION: Delete everything?')) {
                    try {
                        await window.vault.nuke();
                        alert('Vault destroyed.');
                        window.location.reload(); // Reset UI
                    } catch (err) {
                        alert('Error: ' + err.message);
                    }
                }
            }
        });

        // Theme Toggle delegation
        document.getElementById('btn-theme-toggle-settings')?.addEventListener('click', () => {
            document.getElementById('theme-toggle')?.click();
        });
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
}
