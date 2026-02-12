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

// src/js/ui/modals/plugin-manager-modal.js - Plugin Management UI

import { Modal } from '../modal.js';
import pluginManager from '../../utils/plugin-manager.js';
import { showToast } from '../../utils/toast.js';
import { i18n } from '../../utils/i18n.js';
import { isFeatureEnabled } from '../../core/enterprise/feature-flags.js';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const TRUSTED_REMOTE_PLUGIN_HOSTS = new Set([
  'plugins.genpwd.app'
]);

/**
 * Plugin Manager Modal
 *
 * Provides UI for:
 * - Viewing installed plugins
 * - Enabling/disabling plugins
 * - Installing plugins from URL
 * - Uninstalling plugins
 * - Viewing plugin statistics
 */
export class PluginManagerModal extends Modal {
  constructor() {
    super('plugin-manager-modal');
    this._onClose = null;
  }

  /**
   * Show the plugin manager modal
   * @param {Object} options - Options
   * @param {Function} options.onClose - Callback when modal closes
   */
  show(options = {}) {
    this._onClose = options.onClose;
    this.#ensureModalExists();
    this.#renderPluginList();
    this.#attachEvents();
    super.show();
  }

  /**
   * Create modal HTML if it doesn't exist
   * @private
   */
  #ensureModalExists() {
    if (document.getElementById(this.modalId)) return;

    const t = (key, params) => i18n.t(key, params);
    const pluginsEnabled = isFeatureEnabled('plugins');

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-container modal-lg">
        <div class="modal-header">
          <h2 class="modal-title">${t('plugins.manager.title')}</h2>
          <button class="modal-close" aria-label="${t('common.close')}">&times;</button>
        </div>

        <div class="modal-body">
          ${!pluginsEnabled ? `
            <div class="alert alert-warning">
              <strong>${t('enterprise.policyApplied')}</strong>
              <p>${t('enterprise.settingDisabled')}</p>
            </div>
          ` : ''}

          <!-- Stats Bar -->
          <div class="plugin-stats" id="plugin-stats">
            <div class="stat-item">
              <span class="stat-value" id="stat-total">0</span>
              <span class="stat-label">${t('plugins.manager.totalPlugins')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-enabled">0</span>
              <span class="stat-label">${t('plugins.manager.enabledPlugins')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="stat-hooks">0</span>
              <span class="stat-label">${t('plugins.manager.activeHooks')}</span>
            </div>
          </div>

          <!-- Install Section -->
          ${pluginsEnabled ? `
            <div class="plugin-install-section">
              <h3>${t('plugins.manager.installPlugin')}</h3>
              <div class="install-form">
                <input type="url"
                       id="plugin-url-input"
                       class="form-input"
                       placeholder="${t('plugins.manager.urlPlaceholder')}"
                       aria-label="${t('plugins.manager.urlPlaceholder')}">
                <button id="btn-install-plugin" class="btn btn-primary">
                  ${t('plugins.manager.install')}
                </button>
              </div>
              <p class="install-warning">
                <svg class="icon-warning" viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M12 2L1 21h22L12 2zm0 3.5L19.5 19H4.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                </svg>
                ${t('plugins.manager.securityWarning')}
              </p>
            </div>
          ` : ''}

          <!-- Plugin List -->
          <div class="plugin-list-section">
            <h3>${t('plugins.manager.installedPlugins')}</h3>
            <div id="plugin-list" class="plugin-list">
              <!-- Populated dynamically -->
            </div>
            <div id="no-plugins-message" class="no-plugins" style="display: none;">
              <p>${t('plugins.manager.noPlugins')}</p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-close-plugins">
            ${t('common.close')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Render the plugin list
   * @private
   */
  #renderPluginList() {
    const listContainer = document.getElementById('plugin-list');
    const noPluginsMsg = document.getElementById('no-plugins-message');
    const plugins = pluginManager.getAllPlugins();
    const pluginsEnabled = isFeatureEnabled('plugins');
    const t = (key, params) => i18n.t(key, params);

    // Update stats
    const stats = pluginManager.getStats();
    document.getElementById('stat-total').textContent = stats.totalPlugins;
    document.getElementById('stat-enabled').textContent = stats.enabledPlugins;
    document.getElementById('stat-hooks').textContent = stats.totalHooks;

    if (plugins.length === 0) {
      listContainer.innerHTML = '';
      noPluginsMsg.style.display = 'block';
      return;
    }

    noPluginsMsg.style.display = 'none';

    listContainer.innerHTML = plugins.map(plugin => `
      <div class="plugin-card ${plugin.enabled ? 'enabled' : 'disabled'}" data-plugin="${plugin.name}">
        <div class="plugin-header">
          <div class="plugin-info">
            <h4 class="plugin-name">${this.#escapeHtml(plugin.name)}</h4>
            <span class="plugin-version">${t('plugins.manager.version', { version: plugin.version })}</span>
          </div>
          <div class="plugin-toggle">
            <label class="toggle-switch">
              <input type="checkbox"
                     class="plugin-enabled-toggle"
                     data-plugin="${plugin.name}"
                     ${plugin.enabled ? 'checked' : ''}
                     ${!pluginsEnabled ? 'disabled' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <p class="plugin-description">${this.#escapeHtml(plugin.description)}</p>

        <div class="plugin-meta">
          <span class="plugin-author">${t('plugins.manager.author', { author: this.#escapeHtml(plugin.author) })}</span>
          ${plugin.hooks ? `
            <span class="plugin-hooks">${t('plugins.manager.hooks', { hooks: Object.keys(plugin.hooks).join(', ') })}</span>
          ` : ''}
          ${plugin._source ? `
            <span class="plugin-source">${t('plugins.manager.source', { source: plugin._source })}</span>
          ` : ''}
        </div>

        <div class="plugin-actions">
          <button class="btn btn-sm btn-danger btn-uninstall"
                  data-plugin="${plugin.name}"
                  ${!pluginsEnabled ? 'disabled' : ''}>
            ${t('plugins.manager.uninstall')}
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Attach event handlers
   * @private
   */
  #attachEvents() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Close button
    modal.querySelector('.modal-close')?.addEventListener('click', () => this.hide());
    modal.querySelector('#btn-close-plugins')?.addEventListener('click', () => this.hide());

    // Overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hide();
    });

    // Install button
    modal.querySelector('#btn-install-plugin')?.addEventListener('click', () => {
      this.#handleInstall();
    });

    // URL input enter key
    modal.querySelector('#plugin-url-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.#handleInstall();
      }
    });

    // Toggle switches
    modal.querySelectorAll('.plugin-enabled-toggle').forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const pluginName = e.target.dataset.plugin;
        if (e.target.checked) {
          pluginManager.enablePlugin(pluginName);
        } else {
          pluginManager.disablePlugin(pluginName);
        }
        this.#renderPluginList();
      });
    });

    // Uninstall buttons
    modal.querySelectorAll('.btn-uninstall').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pluginName = e.target.dataset.plugin;
        this.#handleUninstall(pluginName);
      });
    });
  }

  /**
   * Handle plugin installation
   * @private
   */
  async #handleInstall() {
    const input = document.getElementById('plugin-url-input');
    const url = input?.value?.trim();
    const t = (key, params) => i18n.t(key, params);

    if (!url) {
      showToast(t('plugins.manager.urlRequired'), 'warning');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      showToast(t('plugins.manager.invalidUrl'), 'error');
      return;
    }

    // Protocol and host allowlist validation
    const urlObj = new URL(url);
    const isElectronApp = typeof window.electronAPI !== 'undefined';
    const isLocalPluginHost = LOCALHOST_HOSTS.has(urlObj.hostname);
    const isLocalhostPage = LOCALHOST_HOSTS.has(window.location.hostname);

    if (urlObj.protocol === 'file:') {
      if (!isElectronApp) {
        showToast(t('toast.pluginFileProtocolDenied'), 'error');
        return;
      }
    } else if (urlObj.protocol === 'http:') {
      if (!isLocalhostPage || !isLocalPluginHost) {
        showToast(t('plugins.manager.httpsRequired'), 'error');
        return;
      }
    } else if (urlObj.protocol === 'https:') {
      if (!isLocalPluginHost && !TRUSTED_REMOTE_PLUGIN_HOSTS.has(urlObj.hostname)) {
        showToast(t('toast.pluginHostNotTrusted'), 'error');
        return;
      }
    } else {
      showToast(t('plugins.manager.invalidUrl'), 'error');
      return;
    }

    // Show loading state
    const installBtn = document.getElementById('btn-install-plugin');
    const originalText = installBtn.textContent;
    installBtn.disabled = true;
    installBtn.textContent = t('common.loading');

    try {
      const success = await pluginManager.loadPluginFromModule(url, 'user-installed');

      if (success) {
        input.value = '';
        this.#renderPluginList();
        this.#attachEvents();  // Re-attach for new elements
      }
    } finally {
      installBtn.disabled = false;
      installBtn.textContent = originalText;
    }
  }

  /**
   * Handle plugin uninstallation
   * @private
   * @param {string} pluginName - Plugin to uninstall
   */
  #handleUninstall(pluginName) {
    const t = (key, params) => i18n.t(key, params);

    if (!confirm(t('plugins.manager.confirmUninstall', { name: pluginName }))) {
      return;
    }

    const success = pluginManager.unregisterPlugin(pluginName);

    if (success) {
      this.#renderPluginList();
      this.#attachEvents();
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} str - String to escape
   * @returns {string}
   */
  #escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Hide modal and call callback
   */
  hide() {
    super.hide();
    if (this._onClose) {
      this._onClose();
    }
  }
}

// Singleton instance
let _instance = null;

/**
 * Get plugin manager modal instance
 * @returns {PluginManagerModal}
 */
export function getPluginManagerModal() {
  if (!_instance) {
    _instance = new PluginManagerModal();
  }
  return _instance;
}

/**
 * Show plugin manager modal
 * @param {Object} options - Options
 */
export function showPluginManagerModal(options = {}) {
  getPluginManagerModal().show(options);
}

export default PluginManagerModal;
