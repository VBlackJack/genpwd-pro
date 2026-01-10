/**
 * @fileoverview Settings Modal
 * Centralized settings for GenPwd Pro
 */

import { Modal } from './modal.js';
import { showConfirm } from '../modal-manager.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../utils/i18n.js';
import {
  getCurrentTheme,
  getThemeMode,
  getAvailableThemes,
  applyTheme,
  setThemeMode,
  THEME_MODES
} from '../../utils/theme-manager.js';
import { THEME_ICONS, THEME_COLORS } from '../../config/theme-icons.js';

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
            <h2 id="${this._modalId}-title">${t('settingsModal.title')}</h2>
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
                <button class="settings-nav-item active" data-tab="appearance" role="tab" aria-selected="true" aria-controls="tab-appearance" id="settings-tab-appearance">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  ${t('settingsModal.tabs.appearance')}
                </button>
                <button class="settings-nav-item" data-tab="shortcuts" role="tab" aria-selected="false" aria-controls="tab-shortcuts" id="settings-tab-shortcuts">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h.01M18 16h.01"/></svg>
                  ${t('settingsModal.tabs.shortcuts')}
                </button>
                <button class="settings-nav-item" data-tab="security" role="tab" aria-selected="false" aria-controls="tab-security" id="settings-tab-security">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  ${t('settingsModal.tabs.security')}
                </button>
                <button class="settings-nav-item danger" data-tab="danger" role="tab" aria-selected="false" aria-controls="tab-danger" id="settings-tab-danger">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  ${t('settingsModal.tabs.danger')}
                </button>
              </div>
              <div class="settings-content">
                <!-- Appearance Tab -->
                <div class="settings-tab active" id="tab-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" aria-hidden="false">
                  <div class="setting-group">
                    <label class="setting-label">${t('settingsModal.appearance.theme')}</label>
                    <div class="setting-desc">${t('settingsModal.appearance.themeDesc')}</div>
                    <div class="theme-cards" id="settings-theme-cards">
                      <!-- Theme cards rendered dynamically -->
                    </div>
                  </div>
                  <div class="setting-group">
                    <label class="setting-label" id="label-follow-system">${t('settingsModal.appearance.systemTheme')}</label>
                    <div class="setting-desc" id="desc-follow-system">${t('settingsModal.appearance.systemThemeDesc')}</div>
                    <div class="setting-control">
                      <label class="toggle-switch">
                        <input type="checkbox" id="settings-follow-system" aria-labelledby="label-follow-system" aria-describedby="desc-follow-system">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div class="setting-group electron-only" id="settings-accent-group" style="display: none;">
                    <label class="setting-label" id="label-use-accent">${t('settingsModal.appearance.accentColor')}</label>
                    <div class="setting-desc" id="desc-use-accent">${t('settingsModal.appearance.accentColorDesc')}</div>
                    <div class="setting-control">
                      <label class="toggle-switch">
                        <input type="checkbox" id="settings-use-accent" checked aria-labelledby="label-use-accent" aria-describedby="desc-use-accent">
                        <span class="toggle-slider"></span>
                      </label>
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
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>G</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.generatePasswords')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>C</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.copyAllPasswords')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>R</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.runTests')}</span>
                    </div>
                    <div class="shortcut-row">
                      <span class="shortcut-keys"><kbd>Alt</kbd> + <kbd>S</kbd></span>
                      <span class="shortcut-desc">${t('settingsModal.shortcuts.exportResults')}</span>
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
                    <label class="setting-label" for="settings-autolock" id="label-autolock">${t('settingsModal.security.autoLock')}</label>
                    <div class="setting-desc" id="desc-autolock">${t('settingsModal.security.autoLockDesc')}</div>
                    <div class="setting-control">
                      <select class="vault-select" id="settings-autolock" aria-describedby="desc-autolock">
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

        // Initialize appearance settings
        this.#initAppearanceSettings();
    }

    /**
     * Initialize appearance settings tab
     * @private
     */
    #initAppearanceSettings() {
        // Render theme cards
        this.#renderThemeCards();

        // Follow system toggle
        const followSystemToggle = document.getElementById('settings-follow-system');
        if (followSystemToggle) {
            // Set initial state
            followSystemToggle.checked = getThemeMode() === THEME_MODES.SYSTEM;

            // Handle toggle
            followSystemToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    setThemeMode(THEME_MODES.SYSTEM);
                } else {
                    setThemeMode(THEME_MODES.MANUAL);
                }
                this.#renderThemeCards(); // Update active state
            });
        }

        // Show accent color option only in Electron
        if (window.electronAPI) {
            const accentGroup = document.getElementById('settings-accent-group');
            if (accentGroup) {
                accentGroup.style.display = '';
            }
        }

        // Listen for theme changes from header toggle
        window.addEventListener('theme:changed', () => {
            this.#renderThemeCards();
            const followSystemToggle = document.getElementById('settings-follow-system');
            if (followSystemToggle) {
                followSystemToggle.checked = getThemeMode() === THEME_MODES.SYSTEM;
            }
        });
    }

    /**
     * Render theme selection cards with color preview
     * @private
     */
    #renderThemeCards() {
        const container = document.getElementById('settings-theme-cards');
        if (!container) return;

        const themes = getAvailableThemes();
        const currentTheme = getCurrentTheme();
        const currentMode = getThemeMode();

        container.innerHTML = themes.map(theme => {
            const isActive = currentMode === THEME_MODES.MANUAL && currentTheme === theme.id;
            const icon = THEME_ICONS[theme.id] || THEME_ICONS.dark;
            const colors = THEME_COLORS[theme.id] || THEME_COLORS.dark;
            const themeName = t(`themes.${theme.id}`) || theme.name;

            return `
                <button type="button"
                        class="theme-card ${isActive ? 'active' : ''}"
                        data-theme="${theme.id}"
                        aria-pressed="${isActive}"
                        title="${themeName}">
                    <div class="theme-card-preview" aria-hidden="true">
                        <span class="theme-swatch" style="background: ${colors.bg}"></span>
                        <span class="theme-swatch" style="background: ${colors.text}"></span>
                        <span class="theme-swatch" style="background: ${colors.accent}"></span>
                    </div>
                    <span class="theme-card-icon" aria-hidden="true">${icon}</span>
                    <span class="theme-card-name">${themeName}</span>
                    ${isActive ? `<span class="theme-card-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </span>` : ''}
                </button>
            `;
        }).join('');

        // Attach click handlers with animation
        container.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const themeId = card.dataset.theme;

                // Add selection animation
                card.classList.add('selecting');
                setTimeout(() => card.classList.remove('selecting'), 200);

                setThemeMode(THEME_MODES.MANUAL);
                applyTheme(themeId);

                // Update follow system toggle
                const followSystemToggle = document.getElementById('settings-follow-system');
                if (followSystemToggle) {
                    followSystemToggle.checked = false;
                }

                // Re-render cards
                this.#renderThemeCards();
            });
        });
    }
}
