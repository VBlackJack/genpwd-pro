/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Vault Settings Modal
 * Comprehensive vault settings for auto-lock and security options
 */

import {
  getVaultSettingsService,
  LOCK_TIMEOUT_OPTIONS,
  CLIPBOARD_TIMEOUT_OPTIONS
} from '../services/vault-settings-service.js';
import { getBackupService, BACKUP_STATUS } from '../services/backup-service.js';

/**
 * Show vault settings modal
 * @param {Object} options
 * @param {Function} options.onSave - Callback when settings are saved
 * @param {Function} options.onSuccess - Callback on successful save (message)
 * @param {Function} options.onExport - Callback to trigger vault export
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The modal element
 */
export function showVaultSettingsModal(options = {}) {
  const { onSave, onSuccess, onExport, t = (k) => k } = options;
  const backupService = getBackupService();

  // Remove existing modal
  document.getElementById('vault-settings-modal')?.remove();

  const settings = getVaultSettingsService();
  const currentSettings = settings.getAll();

  const modal = document.createElement('div');
  modal.className = 'vault-modal-overlay';
  modal.id = 'vault-settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'vault-settings-title');
  modal.innerHTML = `
    <div class="vault-modal vault-settings-modal">
      <div class="vault-modal-header">
        <h3 id="vault-settings-title">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          ${t('vault.settings.title')}
        </h3>
        <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body">
        <!-- Auto-Lock Section -->
        <div class="vault-settings-section">
          <h4 class="vault-settings-section-title">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${t('vault.settings.lockSection')}
          </h4>

          <div class="vault-form-group">
            <label class="vault-label" for="setting-lock-timeout">${t('vault.settings.lockTimeout')}</label>
            <select class="vault-input vault-select" id="setting-lock-timeout">
              ${LOCK_TIMEOUT_OPTIONS.map(opt => `
                <option value="${opt.value}" ${opt.value === currentSettings.lockTimeout ? 'selected' : ''}>
                  ${t(opt.labelKey)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="setting-lock-minimize" ${currentSettings.lockOnMinimize ? 'checked' : ''}>
              <span>${t('vault.settings.lockOnMinimize')}</span>
            </label>
            <p class="vault-settings-hint">${t('vault.settings.lockOnMinimizeHint')}</p>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="setting-lock-blur" ${currentSettings.lockOnBlur ? 'checked' : ''}>
              <span>${t('vault.settings.lockOnBlur')}</span>
            </label>
            <p class="vault-settings-hint">${t('vault.settings.lockOnBlurHint')}</p>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="setting-lock-system-idle" ${currentSettings.lockOnSystemIdle ? 'checked' : ''}>
              <span>${t('vault.settings.lockOnSystemIdle')}</span>
            </label>
            <p class="vault-settings-hint">${t('vault.settings.lockOnSystemIdleHint')}</p>
          </div>
        </div>

        <!-- Security Section -->
        <div class="vault-settings-section">
          <h4 class="vault-settings-section-title">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            ${t('vault.settings.securitySection')}
          </h4>

          <div class="vault-form-group">
            <label class="vault-label" for="setting-clipboard-timeout">${t('vault.settings.clipboardClear')}</label>
            <select class="vault-input vault-select" id="setting-clipboard-timeout">
              ${CLIPBOARD_TIMEOUT_OPTIONS.map(opt => `
                <option value="${opt.value}" ${opt.value === currentSettings.clipboardClearTimeout ? 'selected' : ''}>
                  ${t(opt.labelKey)}
                </option>
              `).join('')}
            </select>
            <p class="vault-settings-hint">${t('vault.settings.clipboardClearHint')}</p>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="setting-require-password" ${currentSettings.requirePasswordToReveal ? 'checked' : ''}>
              <span>${t('vault.settings.requirePasswordReveal')}</span>
            </label>
            <p class="vault-settings-hint">${t('vault.settings.requirePasswordRevealHint')}</p>
          </div>
        </div>

        <!-- Backup Section -->
        <div class="vault-settings-section">
          <h4 class="vault-settings-section-title">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            ${t('vault.settings.backupSection')}
          </h4>

          ${renderBackupStatus(backupService, t, onExport)}
        </div>

        <div class="vault-modal-actions">
          <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
          <button type="button" class="vault-btn vault-btn-primary" id="save-vault-settings">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            ${t('common.save')}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  // Trigger reflow and add active class for CSS animation
  modal.offsetHeight;
  modal.classList.add('active');

  // Close handlers
  const closeModal = () => modal.remove();

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Escape key to close
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Save settings
  modal.querySelector('#save-vault-settings')?.addEventListener('click', () => {
    const newSettings = {
      lockTimeout: parseInt(modal.querySelector('#setting-lock-timeout').value, 10),
      lockOnMinimize: modal.querySelector('#setting-lock-minimize').checked,
      lockOnBlur: modal.querySelector('#setting-lock-blur').checked,
      lockOnSystemIdle: modal.querySelector('#setting-lock-system-idle').checked,
      clipboardClearTimeout: parseInt(modal.querySelector('#setting-clipboard-timeout').value, 10),
      requirePasswordToReveal: modal.querySelector('#setting-require-password').checked
    };

    settings.update(newSettings);

    if (onSave) {
      onSave(newSettings);
    }

    if (onSuccess) {
      onSuccess(t('vault.settings.saved'));
    }

    closeModal();
  });

  // Backup button handler
  modal.querySelector('#backup-now-btn')?.addEventListener('click', () => {
    closeModal();
    if (onExport) {
      onExport();
    }
  });

  // Focus first interactive element
  modal.querySelector('#setting-lock-timeout')?.focus();

  return modal;
}

/**
 * Render backup status section
 * @param {Object} backupService - Backup service instance
 * @param {Function} t - Translation function
 * @param {Function} onExport - Export callback
 * @returns {string} HTML string
 */
function renderBackupStatus(backupService, t, onExport) {
  const status = backupService.getBackupStatus();
  const lastBackupText = backupService.formatLastBackup('default', t);
  const backupData = backupService.getLastBackupData();

  const statusConfig = {
    [BACKUP_STATUS.NEVER]: {
      className: 'backup-status--warning',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    [BACKUP_STATUS.RECOMMENDED]: {
      className: 'backup-status--warning',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    [BACKUP_STATUS.RECENT]: {
      className: 'backup-status--success',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  };

  const config = statusConfig[status] || statusConfig[BACKUP_STATUS.NEVER];
  const showButton = status !== BACKUP_STATUS.RECENT || !onExport;

  return `
    <div class="vault-backup-status ${config.className}">
      <div class="backup-status-info">
        <svg class="backup-status-icon" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.iconPath}"></path>
        </svg>
        <div class="backup-status-text">
          <span class="backup-status-label">${lastBackupText}</span>
          ${backupData?.format ? `<span class="backup-status-format">${t('vault.backup.format', { format: backupData.format.toUpperCase() })}</span>` : ''}
        </div>
      </div>
      ${onExport ? `
        <button type="button" class="vault-btn vault-btn-sm ${status === BACKUP_STATUS.RECENT ? 'vault-btn-secondary' : 'vault-btn-primary'}" id="backup-now-btn">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          ${t('vault.backup.createNow')}
        </button>
      ` : ''}
    </div>
    ${status !== BACKUP_STATUS.RECENT ? `
      <p class="vault-settings-hint vault-settings-hint--warning">${t('vault.backup.reminder')}</p>
    ` : ''}
  `;
}
