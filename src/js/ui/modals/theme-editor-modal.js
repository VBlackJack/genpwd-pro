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

// src/js/ui/modals/theme-editor-modal.js - Theme Editor Modal

import { Modal } from '../modal.js';
import {
  THEME_VARIABLES,
  DEFAULT_THEME_TEMPLATE,
  createCustomTheme,
  updateCustomTheme,
  getCustomTheme,
  validateTheme,
  isValidColor
} from '../../utils/custom-theme-manager.js';
import { showToast } from '../../utils/toast.js';
import { i18n } from '../../utils/i18n.js';
import { isFeatureEnabled } from '../../core/enterprise/feature-flags.js';

/**
 * Theme Editor Modal
 *
 * Provides UI for:
 * - Creating new custom themes
 * - Editing existing themes
 * - Live preview of theme changes
 * - Color picker for each theme variable
 */
export class ThemeEditorModal extends Modal {
  constructor() {
    super('theme-editor-modal');
    this._onSave = null;
    this._onClose = null;
    this._editingTheme = null;
    this._currentValues = {};
    this._previewTimeout = null;
  }

  /**
   * Show the theme editor modal
   * @param {Object} options - Options
   * @param {string} options.themeId - Theme ID to edit (null for new theme)
   * @param {Function} options.onSave - Callback when theme is saved
   * @param {Function} options.onClose - Callback when modal closes
   */
  show(options = {}) {
    this._onSave = options.onSave;
    this._onClose = options.onClose;
    this._editingTheme = options.themeId ? getCustomTheme(options.themeId) : null;

    // Initialize current values
    this._currentValues = this._editingTheme
      ? { ...this._editingTheme.variables }
      : { ...DEFAULT_THEME_TEMPLATE };

    this.#ensureModalExists();
    this.#renderEditor();
    this.#attachEvents();
    super.show();

    // Apply initial preview
    this.#applyPreview();
  }

  /**
   * Create modal HTML if it doesn't exist
   * @private
   */
  #ensureModalExists() {
    if (document.getElementById(this.modalId)) {
      // Remove existing modal to refresh content
      document.getElementById(this.modalId)?.remove();
    }

    const t = (key, params) => i18n.t(key, params);
    const customThemesEnabled = isFeatureEnabled('custom-themes');
    const isEditing = !!this._editingTheme;

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-container modal-lg theme-editor-container">
        <div class="modal-header">
          <h2 class="modal-title">
            ${isEditing ? t('themes.custom.edit') : t('themes.custom.create')}
          </h2>
          <button class="modal-close" aria-label="${t('common.close')}">&times;</button>
        </div>

        <div class="modal-body">
          ${!customThemesEnabled ? `
            <div class="alert alert-warning">
              <strong>${t('enterprise.policyApplied')}</strong>
              <p>${t('enterprise.settingDisabled')}</p>
            </div>
          ` : ''}

          <div class="theme-editor-layout">
            <!-- Left Panel: Controls -->
            <div class="theme-editor-controls">
              <!-- Theme Info -->
              <div class="theme-info-section">
                <div class="form-group">
                  <label for="theme-name">${t('themes.custom.editor.name')}</label>
                  <input type="text"
                         id="theme-name"
                         class="form-input"
                         placeholder="${t('themes.custom.editor.namePlaceholder')}"
                         value="${this._editingTheme?.name || ''}"
                         ${!customThemesEnabled ? 'disabled' : ''}>
                </div>

                <div class="form-group">
                  <label for="theme-icon">${t('themes.custom.editor.icon')}</label>
                  <div class="icon-picker">
                    <input type="text"
                           id="theme-icon"
                           class="form-input icon-input"
                           maxlength="2"
                           value="${this._editingTheme?.icon || '🎨'}"
                           ${!customThemesEnabled ? 'disabled' : ''}>
                    <div class="icon-suggestions">
                      <button type="button" class="icon-btn" data-icon="🎨">🎨</button>
                      <button type="button" class="icon-btn" data-icon="🌙">🌙</button>
                      <button type="button" class="icon-btn" data-icon="☀️">☀️</button>
                      <button type="button" class="icon-btn" data-icon="🌊">🌊</button>
                      <button type="button" class="icon-btn" data-icon="🌲">🌲</button>
                      <button type="button" class="icon-btn" data-icon="🔥">🔥</button>
                      <button type="button" class="icon-btn" data-icon="💜">💜</button>
                      <button type="button" class="icon-btn" data-icon="🖤">🖤</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Color Variables by Category -->
              <div class="theme-variables-section">
                ${this.#renderVariablesByCategory(customThemesEnabled)}
              </div>
            </div>

            <!-- Right Panel: Preview -->
            <div class="theme-editor-preview">
              <h3>${t('themes.custom.editor.preview')}</h3>
              <div class="preview-container" id="theme-preview">
                ${this.#renderPreviewContent()}
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-reset-theme">
            ${t('themes.custom.editor.reset')}
          </button>
          <div class="footer-actions">
            <button class="btn btn-secondary" id="btn-cancel-theme">
              ${t('common.cancel')}
            </button>
            <button class="btn btn-primary" id="btn-save-theme" ${!customThemesEnabled ? 'disabled' : ''}>
              ${t('themes.custom.editor.save')}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Render variable inputs grouped by category
   * @private
   * @param {boolean} enabled - Whether inputs should be enabled
   * @returns {string} - HTML string
   */
  #renderVariablesByCategory(enabled) {
    const t = (key, params) => i18n.t(key, params);
    const categories = {};

    // Group variables by category
    for (const varDef of THEME_VARIABLES) {
      if (!categories[varDef.category]) {
        categories[varDef.category] = [];
      }
      categories[varDef.category].push(varDef);
    }

    let html = '';
    for (const [category, variables] of Object.entries(categories)) {
      const categoryKey = `themes.custom.editor.categories.${category}`;
      html += `
        <div class="variable-category">
          <h4 class="category-title">${t(categoryKey)}</h4>
          <div class="variable-grid">
            ${variables.map(v => this.#renderColorInput(v, enabled)).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render a color input for a variable
   * @private
   * @param {Object} varDef - Variable definition
   * @param {boolean} enabled - Whether input should be enabled
   * @returns {string} - HTML string
   */
  #renderColorInput(varDef, enabled) {
    const currentValue = this._currentValues[varDef.key] || DEFAULT_THEME_TEMPLATE[varDef.key];
    return `
      <div class="color-input-group">
        <label for="var-${varDef.key}" class="color-label">${varDef.label}</label>
        <div class="color-picker-wrapper">
          <input type="color"
                 id="color-${varDef.key}"
                 class="color-picker"
                 value="${currentValue}"
                 data-var="${varDef.key}"
                 ${!enabled ? 'disabled' : ''}>
          <input type="text"
                 id="text-${varDef.key}"
                 class="color-text"
                 value="${currentValue}"
                 data-var="${varDef.key}"
                 pattern="^#[0-9A-Fa-f]{6}$"
                 ${!enabled ? 'disabled' : ''}>
        </div>
      </div>
    `;
  }

  /**
   * Render preview content
   * @private
   * @returns {string} - HTML string
   */
  #renderPreviewContent() {
    return `
      <div class="preview-card">
        <div class="preview-header">
          <span class="preview-title">GenPwd Pro</span>
          <span class="preview-subtitle">Preview</span>
        </div>
        <div class="preview-body">
          <div class="preview-input-group">
            <label class="preview-label">Username</label>
            <input type="text" class="preview-input" value="john.doe@example.com" readonly>
          </div>
          <div class="preview-input-group">
            <label class="preview-label">Password</label>
            <input type="password" class="preview-input" value="••••••••••••" readonly>
          </div>
          <div class="preview-buttons">
            <button class="preview-btn preview-btn-primary">Generate</button>
            <button class="preview-btn preview-btn-secondary">Copy</button>
          </div>
          <div class="preview-password-list">
            <div class="preview-password-item">
              <span class="preview-password">Kx7mP#qL9nB$2w</span>
              <span class="preview-strength preview-strength-strong">Strong</span>
            </div>
            <div class="preview-password-item">
              <span class="preview-password">horse-battery-staple</span>
              <span class="preview-strength preview-strength-good">Good</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the editor content
   * @private
   */
  #renderEditor() {
    // Update input values
    for (const varDef of THEME_VARIABLES) {
      const colorInput = document.getElementById(`color-${varDef.key}`);
      const textInput = document.getElementById(`text-${varDef.key}`);
      const value = this._currentValues[varDef.key] || DEFAULT_THEME_TEMPLATE[varDef.key];

      if (colorInput) colorInput.value = value;
      if (textInput) textInput.value = value;
    }
  }

  /**
   * Attach event handlers
   * @private
   */
  #attachEvents() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;

    // Close buttons
    modal.querySelector('.modal-close')?.addEventListener('click', () => this.hide());
    modal.querySelector('#btn-cancel-theme')?.addEventListener('click', () => this.hide());

    // Overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hide();
    });

    // Icon picker
    modal.querySelectorAll('.icon-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const icon = e.target.dataset.icon;
        const iconInput = document.getElementById('theme-icon');
        if (iconInput) iconInput.value = icon;
      });
    });

    // Color pickers
    modal.querySelectorAll('.color-picker').forEach(picker => {
      picker.addEventListener('input', (e) => {
        const varKey = e.target.dataset.var;
        const value = e.target.value;
        this._currentValues[varKey] = value;

        // Sync text input
        const textInput = document.getElementById(`text-${varKey}`);
        if (textInput) textInput.value = value;

        this.#schedulePreviewUpdate();
      });
    });

    // Text inputs for colors
    modal.querySelectorAll('.color-text').forEach(input => {
      input.addEventListener('input', (e) => {
        const varKey = e.target.dataset.var;
        const value = e.target.value;

        if (isValidColor(value)) {
          this._currentValues[varKey] = value;

          // Sync color picker (only for valid hex)
          if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            const colorPicker = document.getElementById(`color-${varKey}`);
            if (colorPicker) colorPicker.value = value;
          }

          this.#schedulePreviewUpdate();
        }
      });
    });

    // Reset button
    modal.querySelector('#btn-reset-theme')?.addEventListener('click', () => {
      this._currentValues = { ...DEFAULT_THEME_TEMPLATE };
      this.#renderEditor();
      this.#applyPreview();
    });

    // Save button
    modal.querySelector('#btn-save-theme')?.addEventListener('click', () => {
      this.#handleSave();
    });
  }

  /**
   * Schedule a preview update (debounced)
   * @private
   */
  #schedulePreviewUpdate() {
    if (this._previewTimeout) {
      clearTimeout(this._previewTimeout);
    }
    this._previewTimeout = setTimeout(() => {
      this.#applyPreview();
    }, 50);
  }

  /**
   * Apply current values to preview
   * @private
   */
  #applyPreview() {
    const preview = document.getElementById('theme-preview');
    if (!preview) return;

    for (const [key, value] of Object.entries(this._currentValues)) {
      preview.style.setProperty(key, value);
    }
  }

  /**
   * Handle save button click
   * @private
   */
  #handleSave() {
    const t = (key, params) => i18n.t(key, params);
    const nameInput = document.getElementById('theme-name');
    const iconInput = document.getElementById('theme-icon');

    const themeData = {
      name: nameInput?.value?.trim() || '',
      icon: iconInput?.value || '🎨',
      variables: { ...this._currentValues }
    };

    // Validate
    const validation = validateTheme(themeData);
    if (!validation.valid) {
      showToast(validation.errors[0], 'error');
      return;
    }

    try {
      let savedTheme;
      if (this._editingTheme) {
        savedTheme = updateCustomTheme(this._editingTheme.id, themeData);
        showToast(t('themes.custom.toast.updated', { name: savedTheme.name }), 'success');
      } else {
        savedTheme = createCustomTheme(themeData);
        showToast(t('themes.custom.toast.created', { name: savedTheme.name }), 'success');
      }

      if (this._onSave) {
        this._onSave(savedTheme);
      }

      this.hide();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  /**
   * Hide modal and restore original theme
   */
  hide() {
    // Clear preview styles
    const preview = document.getElementById('theme-preview');
    if (preview) {
      for (const key of Object.keys(this._currentValues)) {
        preview.style.removeProperty(key);
      }
    }

    super.hide();

    if (this._onClose) {
      this._onClose();
    }
  }
}

// Singleton instance
let _instance = null;

/**
 * Get theme editor modal instance
 * @returns {ThemeEditorModal}
 */
export function getThemeEditorModal() {
  if (!_instance) {
    _instance = new ThemeEditorModal();
  }
  return _instance;
}

/**
 * Show theme editor modal
 * @param {Object} options - Options
 */
export function showThemeEditorModal(options = {}) {
  getThemeEditorModal().show(options);
}

export default ThemeEditorModal;
