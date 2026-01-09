/**
 * @fileoverview Folder and Tag Modal Templates
 * Modal templates for folder and tag management
 */

import {
  renderModal,
  renderModalActions,
  renderFormInput,
  renderColorPicker,
  TAG_COLORS
} from './base-modal.js';
import { escapeHtml } from '../utils/formatter.js';

// Color validation for XSS prevention
const DEFAULT_TAG_COLOR = '#6b7280';
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/;

function sanitizeTagColor(color) {
  if (!color || typeof color !== 'string') return DEFAULT_TAG_COLOR;
  const trimmed = color.trim();
  return COLOR_PATTERN.test(trimmed) ? trimmed : DEFAULT_TAG_COLOR;
}

/**
 * Render add folder modal
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderAddFolderModal(options = {}) {
  const { t = (k) => k } = options;

  const content = `
    <form class="vault-modal-body" id="add-folder-form">
      ${renderFormInput({
        id: 'folder-name',
        label: t('vault.labels.folderName'),
        placeholder: t('vault.placeholders.folderExample'),
        required: true
      })}
      ${renderModalActions({
        submitText: t('vault.common.create'),
        t
      })}
    </form>
  `;

  return renderModal({
    id: 'add-folder-modal',
    title: t('vault.dialogs.newFolder'),
    content,
    t
  });
}

/**
 * Render add tag modal
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderAddTagModal(options = {}) {
  const { t = (k) => k } = options;

  const content = `
    <form class="vault-modal-body" id="add-tag-form">
      ${renderFormInput({
        id: 'tag-name',
        label: t('vault.labels.tagName'),
        placeholder: t('vault.placeholders.tagExample'),
        required: true,
        maxLength: 30
      })}
      <div class="vault-form-group">
        <label class="vault-label">${t('vault.labels.color')}</label>
        ${renderColorPicker({
          id: 'add-tag-colors',
          selectedColor: TAG_COLORS[0],
          inputId: 'tag-color'
        })}
      </div>
      ${renderModalActions({
        submitText: t('vault.common.create'),
        t
      })}
    </form>
  `;

  return renderModal({
    id: 'add-tag-modal',
    title: t('vault.dialogs.newTag'),
    content,
    t
  });
}

/**
 * Render edit tag modal
 * @param {Object} options - Options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderEditTagModal(options = {}) {
  const { t = (k) => k } = options;

  const content = `
    <form class="vault-modal-body" id="edit-tag-form">
      <input type="hidden" id="edit-tag-id">
      ${renderFormInput({
        id: 'edit-tag-name',
        label: t('vault.labels.tagName'),
        required: true,
        maxLength: 30
      })}
      <div class="vault-form-group">
        <label class="vault-label">${t('vault.labels.color')}</label>
        ${renderColorPicker({
          id: 'edit-tag-colors',
          inputId: 'edit-tag-color'
        })}
      </div>
      ${renderModalActions({
        showDelete: true,
        deleteText: t('vault.common.delete'),
        t
      })}
    </form>
  `;

  return renderModal({
    id: 'edit-tag-modal',
    title: t('vault.dialogs.editTag'),
    content,
    t
  });
}

/**
 * Render move to folder modal
 * @param {Object} options - Options
 * @param {Array} options.folders - Available folders
 * @param {string} options.currentFolderId - Current folder ID
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderMoveFolderModal(options = {}) {
  const { folders = [], currentFolderId = '', t = (k) => k } = options;

  const content = `
    <div class="vault-modal-body">
      <div class="vault-folder-picker" id="move-folder-list">
        <button type="button" class="vault-folder-option ${!currentFolderId ? 'selected' : ''}" data-folder-id="">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3h18v18H3z"></path>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
          <span>${t('vault.labels.noFolderRoot')}</span>
        </button>
        ${folders.map(f => `
          <button type="button" class="vault-folder-option ${f.id === currentFolderId ? 'selected' : ''}" data-folder-id="${f.id}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${escapeHtml(f.name)}</span>
          </button>
        `).join('')}
      </div>
      <div class="vault-modal-actions">
        <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
        <button type="button" class="vault-btn vault-btn-primary" id="btn-confirm-move">${t('vault.actions.move')}</button>
      </div>
    </div>
  `;

  return renderModal({
    id: 'move-folder-modal',
    title: t('vault.dialogs.moveToFolder'),
    content,
    t
  });
}

/**
 * Render bulk tag modal
 * @param {Object} options - Options
 * @param {Array} options.tags - Available tags
 * @param {Set} options.selectedTags - Currently selected tags
 * @param {number} options.entryCount - Number of selected entries
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderBulkTagModal(options = {}) {
  const { tags = [], selectedTags = new Set(), entryCount = 0, t = (k) => k } = options;

  const content = `
    <div class="vault-modal-body">
      <p class="vault-bulk-tag-info">
        ${t('vault.messages.selectTagsForEntries').replace('{count}', `<strong>${entryCount}</strong>`)}
      </p>
      <div class="vault-bulk-tag-list" id="bulk-tag-list">
        ${tags.length === 0 ? `
          <p class="vault-empty-tags">${t('vault.messages.noTagsCreate')}</p>
        ` : tags.map(tag => `
          <label class="vault-bulk-tag-item">
            <input type="checkbox" class="vault-checkbox" data-tag-id="${tag.id}"
                   ${selectedTags.has(tag.id) ? 'checked' : ''}>
            <span class="vault-bulk-tag-color" style="background-color: ${sanitizeTagColor(tag.color)}"></span>
            <span class="vault-bulk-tag-name">${escapeHtml(tag.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="vault-modal-actions">
        <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
        <button type="button" class="vault-btn vault-btn-primary" id="btn-apply-tags">${t('vault.actions.apply')}</button>
      </div>
    </div>
  `;

  return renderModal({
    id: 'bulk-tag-modal',
    title: t('vault.dialogs.manageTags'),
    content,
    t
  });
}
