/**
 * @fileoverview Settings Modal
 * Centralized settings for GenPwd Pro
 */

import { Modal } from './modal.js';
import { showConfirm } from '../modal-manager.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';

export class SettingsModal extends Modal {
    constructor() {
        super('settings-modal');
        this.#injectModal();
        this.#attachEvents();
    }

    #injectModal() {
        if (document.getElementById(this._modalId)) return;

        const html = `
      <div class="vault-modal-overlay" id="${this._modalId}" hidden role="dialog" aria-modal="true" aria-labelledby="${this._modalId}-title">
        <div class="vault-modal vault-modal-md">
          <div class="vault-modal-header">
            <h3 id="${this._modalId}-title">${t('settingsModal.title')}</h3>
            <button type="button" class="vault-modal-close" aria-label="${t('common.close')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body no-padding">
            <div class="settings-layout">
              <div class="settings-sidebar" role="tablist" aria-label="${t('settingsModal.categories')}">
                <button class="settings-nav-item active" data-tab="general" role="tab" aria-selected="true" aria-controls="tab-general" id="settings-tab-general">${t('settingsModal.tabs.general')}</button>
                <button class="settings-nav-item" data-tab="shortcuts" role="tab" aria-selected="false" aria-controls="tab-shortcuts" id="settings-tab-shortcuts">${t('settingsModal.tabs.shortcuts')}</button>
                <button class="settings-nav-item" data-tab="security" role="tab" aria-selected="false" aria-controls="tab-security" id="settings-tab-security">${t('settingsModal.tabs.security')}</button>
                <button class="settings-nav-item danger" data-tab="danger" role="tab" aria-selected="false" aria-controls="tab-danger" id="settings-tab-danger">${t('settingsModal.tabs.danger')}</button>
              </div>
              <div class="settings-content">
                <!-- General Tab -->
                <div class="settings-tab active" id="tab-general" role="tabpanel" aria-labelledby="settings-tab-general" aria-hidden="false">
                  <div class="setting-group">
                    <label class="setting-label">${t('settingsModal.general.appearance')}</label>
                    <div class="setting-desc">${t('settingsModal.general.appearanceDesc')}</div>
                    <div class="setting-control">
                      <button class="vault-btn vault-btn-sm" id="btn-theme-toggle-settings">${t('settingsModal.general.toggleTheme')}</button>
                    </div>
                  </div>
                </div>

                <!-- Shortcuts Tab -->
                <div class="settings-tab" id="tab-shortcuts" role="tabpanel" aria-labelledby="settings-tab-shortcuts" aria-hidden="true" hidden>
                  <div class="setting-group">
                    <label class="setting-label">${t('settingsModal.shortcuts.title')}</label>
                    <div class="setting-desc">${t('settingsModal.shortcuts.description')}</div>
                  </div>
                  <div class="shortcuts-list">
                    <div class="shortcut-row shortcut-global">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.showHideApp')}</span>
                    </div>
                    <div class="shortcut-row shortcut-global">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>A</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.autoTypePassword')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>G</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.generatePasswords')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.copyAllPasswords')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>L</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.lockVault')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>,</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.openSettings')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Escape</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.closeModal')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Tab</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.navigate')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Enter</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.confirm')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>F4</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.exitApp')}</span>
                    </div>
                  </div>
                </div>

                <!-- Security Tab -->
                <div class="settings-tab" id="tab-security" role="tabpanel" aria-labelledby="settings-tab-security" aria-hidden="true" hidden>
                   <div class="setting-group">
                    <label class="setting-label">${t('settingsModal.security.autoLock')}</label>
                    <div class="setting-desc">${t('settingsModal.security.autoLockDesc')}</div>
                    <div class="setting-control">
                      <select class="vault-select" id="settings-autolock">
                        <option value="1">${t('settingsModal.security.minute1')}</option>
                        <option value="5">${t('settingsModal.security.minutes5')}</option>
                        <option value="15">${t('settingsModal.security.minutes15')}</option>
                        <option value="60">${t('settingsModal.security.hour1')}</option>
                        <option value="0">${t('settingsModal.security.never')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Danger Tab -->
                <div class="settings-tab" id="tab-danger" role="tabpanel" aria-labelledby="settings-tab-danger" aria-hidden="true" hidden>
                  <div class="vault-alert count-warning">
                    <div class="alert-icon">${t('settingsModal.danger.warning')}</div>
                    <div class="alert-content">
                      <strong>${t('settingsModal.danger.title')}</strong>
                      <p>${t('settingsModal.danger.irreversible')}</p>
                    </div>
                  </div>

                  <div class="setting-group danger-group">
                    <label class="setting-label text-danger">${t('settingsModal.danger.panicMode')}</label>
                    <div class="setting-desc">${t('settingsModal.danger.panicDesc')}</div>
                    <div class="setting-control">
                      <button class="vault-btn vault-btn-danger" id="btn-panic-nuke">
                        ${t('settingsModal.danger.destroyVault')}
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
        this._element = document.getElementById(this._modalId);
        this._setupBaseEventHandlers();
    }

    #attachEvents() {
        const modal = this.element;
        if (!modal) return;

        // Tab Navigation with ARIA support and keyboard navigation
        const navItems = modal.querySelectorAll('.settings-nav-item');
        const activateTab = (btn) => {
            // Update nav with aria-selected
            navItems.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
                b.setAttribute('tabindex', '-1');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            btn.setAttribute('tabindex', '0');
            btn.focus();

            // Update content with proper ARIA for screen readers
            const tabId = `tab-${btn.dataset.tab}`;
            modal.querySelectorAll('.settings-tab').forEach(t => {
                t.hidden = true;
                t.setAttribute('aria-hidden', 'true');
            });
            const activeTab = modal.querySelector(`#${tabId}`);
            activeTab.hidden = false;
            activeTab.setAttribute('aria-hidden', 'false');
        };

        navItems.forEach((btn, index) => {
            btn.addEventListener('click', () => activateTab(btn));

            // Arrow key navigation (WCAG 2.1 requirement)
            btn.addEventListener('keydown', (e) => {
                let targetIndex = index;
                switch (e.key) {
                    case 'ArrowDown':
                    case 'ArrowRight':
                        e.preventDefault();
                        targetIndex = (index + 1) % navItems.length;
                        break;
                    case 'ArrowUp':
                    case 'ArrowLeft':
                        e.preventDefault();
                        targetIndex = (index - 1 + navItems.length) % navItems.length;
                        break;
                    case 'Home':
                        e.preventDefault();
                        targetIndex = 0;
                        break;
                    case 'End':
                        e.preventDefault();
                        targetIndex = navItems.length - 1;
                        break;
                    default:
                        return;
                }
                activateTab(navItems[targetIndex]);
            });
        });

        // Panic Button
        const panicBtn = document.getElementById('btn-panic-nuke');
        panicBtn?.addEventListener('click', async () => {
            const firstConfirm = await showConfirm(
                t('settingsModal.danger.destroyConfirm1'),
                {
                    title: t('settingsModal.danger.destroyTitle'),
                    confirmLabel: t('settingsModal.danger.iUnderstand'),
                    danger: true
                }
            );
            if (!firstConfirm) return;

            // Double confirm for critical action
            const finalConfirm = await showConfirm(
                t('settingsModal.danger.finalConfirm'),
                {
                    title: t('settingsModal.danger.finalWarning'),
                    confirmLabel: t('settingsModal.danger.deleteEverything'),
                    danger: true
                }
            );
            if (finalConfirm) {
                try {
                    await window.vault.nuke();
                    showToast(t('settingsModal.danger.vaultDestroyed'), 'info');
                    window.location.reload(); // Reset UI
                } catch (err) {
                    showToast(t('vault.common.error') + ': ' + err.message, 'error');
                }
            }
        });

        // Theme Toggle delegation
        document.getElementById('btn-theme-toggle-settings')?.addEventListener('click', () => {
            document.getElementById('theme-toggle')?.click();
        });
    }
}
