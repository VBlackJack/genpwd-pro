/**
 * @fileoverview Settings Modal
 * Centralized settings for GenPwd Pro
 */

import { showConfirm } from '../modal-manager.js';
import { showToast } from '../../utils/toast.js';
import { setMainContentInert } from '../events.js';

export class SettingsModal {
    #modalId = 'settings-modal';
    #isVisible = false;
    #escapeHandler = null;
    #focusTrapHandler = null;
    #previouslyFocusedElement = null;

    constructor() {
        this.#injectModal();
        this.#attachEvents();
    }

    show() {
        // Save previously focused element for restoration
        this.#previouslyFocusedElement = document.activeElement;
        this.#isVisible = true;
        setMainContentInert(true);
        const modal = document.getElementById(this.#modalId);
        if (modal) {
            modal.hidden = false;
            // Focus first focusable element
            requestAnimationFrame(() => {
                modal.querySelector('button, [tabindex]:not([tabindex="-1"])')?.focus();
            });
            // Add escape key handler
            this.#escapeHandler = (e) => {
                if (e.key === 'Escape') this.hide();
            };
            document.addEventListener('keydown', this.#escapeHandler);
            // Add focus trap
            this.#focusTrapHandler = (e) => {
                if (e.key !== 'Tab') return;
                const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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
        // Restore focus to previously focused element
        if (this.#previouslyFocusedElement && typeof this.#previouslyFocusedElement.focus === 'function') {
            this.#previouslyFocusedElement.focus();
            this.#previouslyFocusedElement = null;
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
              <div class="settings-sidebar" role="tablist" aria-label="Settings categories">
                <button class="settings-nav-item active" data-tab="general" role="tab" aria-selected="true" aria-controls="tab-general" id="settings-tab-general">General</button>
                <button class="settings-nav-item" data-tab="shortcuts" role="tab" aria-selected="false" aria-controls="tab-shortcuts" id="settings-tab-shortcuts">Shortcuts</button>
                <button class="settings-nav-item" data-tab="security" role="tab" aria-selected="false" aria-controls="tab-security" id="settings-tab-security">Security</button>
                <button class="settings-nav-item danger" data-tab="danger" role="tab" aria-selected="false" aria-controls="tab-danger" id="settings-tab-danger">Danger Zone</button>
              </div>
              <div class="settings-content">
                <!-- General Tab -->
                <div class="settings-tab active" id="tab-general" role="tabpanel" aria-labelledby="settings-tab-general">
                  <div class="setting-group">
                    <label class="setting-label">Appearance</label>
                    <div class="setting-desc">Customize application appearance</div>
                    <div class="setting-control">
                      <button class="vault-btn vault-btn-sm" id="btn-theme-toggle-settings">Toggle Light/Dark Theme</button>
                    </div>
                  </div>
                </div>

                <!-- Shortcuts Tab -->
                <div class="settings-tab" id="tab-shortcuts" role="tabpanel" aria-labelledby="settings-tab-shortcuts" hidden>
                  <div class="setting-group">
                    <label class="setting-label">Keyboard Shortcuts</label>
                    <div class="setting-desc">Quick actions to boost your productivity</div>
                  </div>
                  <div class="shortcuts-list">
                    <div class="shortcut-row" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid var(--accent-blue);">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd></span>
                      <span class="shortcut-desc">🌐 Show/Hide app (global)</span>
                    </div>
                    <div class="shortcut-row" style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid var(--accent-blue);">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>A</kbd></span>
                      <span class="shortcut-desc">🌐 Auto-type password (global)</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>G</kbd></span>
                      <span class="shortcut-desc">Generate new passwords</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd></span>
                      <span class="shortcut-desc">Copy all passwords</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>L</kbd></span>
                      <span class="shortcut-desc">Lock vault</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>,</kbd></span>
                      <span class="shortcut-desc">Open settings</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Escape</kbd></span>
                      <span class="shortcut-desc">Close modal / Cancel action</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Tab</kbd></span>
                      <span class="shortcut-desc">Navigate between elements</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Enter</kbd></span>
                      <span class="shortcut-desc">Confirm / Submit</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>F4</kbd></span>
                      <span class="shortcut-desc">Exit application</span>
                    </div>
                  </div>
                </div>

                <!-- Security Tab -->
                <div class="settings-tab" id="tab-security" role="tabpanel" aria-labelledby="settings-tab-security" hidden>
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
                <div class="settings-tab" id="tab-danger" role="tabpanel" aria-labelledby="settings-tab-danger" hidden>
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

        // Tab Navigation with ARIA support
        modal.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update nav with aria-selected
                modal.querySelectorAll('.settings-nav-item').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');

                // Update content with proper ARIA for screen readers
                const tabId = `tab-${btn.dataset.tab}`;
                modal.querySelectorAll('.settings-tab').forEach(t => {
                    t.hidden = true;
                    t.setAttribute('aria-hidden', 'true');
                });
                const activeTab = modal.querySelector(`#${tabId}`);
                activeTab.hidden = false;
                activeTab.setAttribute('aria-hidden', 'false');
            });
        });

        // Panic Button
        const panicBtn = document.getElementById('btn-panic-nuke');
        panicBtn?.addEventListener('click', async () => {
            const firstConfirm = await showConfirm(
                'This action will PERMANENTLY DESTROY this vault. There will be NO way to undo this.',
                {
                    title: '⚠️ Destroy Vault',
                    confirmLabel: 'I Understand',
                    danger: true
                }
            );
            if (!firstConfirm) return;

            // Double confirm for critical action
            const finalConfirm = await showConfirm(
                'FINAL CONFIRMATION: Delete everything?',
                {
                    title: '⛔ Final Warning',
                    confirmLabel: 'Delete Everything',
                    danger: true
                }
            );
            if (finalConfirm) {
                try {
                    await window.vault.nuke();
                    showToast('Vault destroyed.', 'info');
                    window.location.reload(); // Reset UI
                } catch (err) {
                    showToast('Error: ' + err.message, 'error');
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
