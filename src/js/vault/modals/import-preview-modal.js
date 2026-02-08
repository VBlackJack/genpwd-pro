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
 * @fileoverview Import Preview Modal
 * Shows preview of CSV/JSON import before committing (BMAD Anxiety reduction)
 */

import { createModal, closeModal } from '../../ui/modal-manager.js';
import { t } from '../../utils/i18n.js';
import { escapeHtml } from '../utils/formatter.js';
import { getIcon } from '../views/icons.js';

/** Maximum number of preview rows to show */
const MAX_PREVIEW_ROWS = 5;

/**
 * Parse and preview import data
 * @param {Object} options
 * @param {Array} options.entries - Parsed entries to import
 * @param {string} options.source - Source type ('csv', 'json', 'kdbx')
 * @param {Array} options.columns - Column names (for CSV)
 * @returns {Promise<{confirmed: boolean, entries: Array}>}
 */
export function showImportPreview(options) {
  return new Promise((resolve) => {
    const { entries = [], source = 'csv', columns = [] } = options;

    if (!entries || entries.length === 0) {
      resolve({ confirmed: false, entries: [] });
      return;
    }

    const modalId = 'import-preview-modal';
    const previewEntries = entries.slice(0, MAX_PREVIEW_ROWS);
    const hasMore = entries.length > MAX_PREVIEW_ROWS;

    const modal = createModal({
      id: modalId,
      title: t('vault.import.previewTitle'),
      content: renderPreviewContent({
        entries,
        previewEntries,
        hasMore,
        source,
        columns
      }),
      size: 'large',
      actions: [
        {
          id: 'cancel',
          label: t('common.cancel'),
          className: 'btn-secondary',
          onClick: () => {
            closeModal(modalId);
            resolve({ confirmed: false, entries: [] });
          }
        },
        {
          id: 'import',
          label: t('vault.import.confirmImport', { count: entries.length }),
          className: 'btn-primary',
          onClick: () => {
            closeModal(modalId);
            resolve({ confirmed: true, entries });
          }
        }
      ],
      onClose: () => resolve({ confirmed: false, entries: [] })
    });

    if (!modal) {
      resolve({ confirmed: false, entries: [] });
    }
  });
}

/**
 * Render preview content HTML
 * @param {Object} options
 * @returns {string} HTML content
 */
function renderPreviewContent(options = {}) {
  const { entries = [], previewEntries = [], hasMore = false, source = '', columns = [] } = options;

  const sourceIcon = getIcon('upload', { size: 20 });
  const sourceLabel = getSourceLabel(source);

  return `
    <div class="import-preview">
      <div class="import-preview-summary">
        <div class="import-preview-stat">
          ${sourceIcon}
          <span class="import-preview-stat-label">${sourceLabel}</span>
        </div>
        <div class="import-preview-stat import-preview-stat--primary">
          <span class="import-preview-stat-value">${entries.length}</span>
          <span class="import-preview-stat-label">${t('vault.import.entriesFound')}</span>
        </div>
      </div>

      ${columns.length > 0 ? renderColumnMapping(columns) : ''}

      <div class="import-preview-table-wrapper">
        <table class="import-preview-table">
          <thead>
            <tr>
              <th>${t('vault.fields.title')}</th>
              <th>${t('vault.fields.username')}</th>
              <th>${t('vault.fields.url')}</th>
            </tr>
          </thead>
          <tbody>
            ${previewEntries.map(entry => renderPreviewRow(entry)).join('')}
          </tbody>
        </table>
      </div>

      ${hasMore ? `
        <div class="import-preview-more">
          ${t('vault.import.andMore', { count: entries.length - MAX_PREVIEW_ROWS })}
        </div>
      ` : ''}

      <div class="import-preview-warning">
        ${getIcon('info', { size: 16 })}
        <span>${t('vault.import.warning')}</span>
      </div>
    </div>
  `;
}

/**
 * Render a single preview row
 * @param {Object} entry
 * @returns {string} HTML
 */
function renderPreviewRow(entry) {
  const title = entry.title || entry.name || t('vault.import.untitled');
  const username = entry.username || entry.user || entry.login || '-';
  const url = entry.url || entry.website || entry.site || '-';

  return `
    <tr>
      <td class="import-preview-title">${escapeHtml(truncate(title, 40))}</td>
      <td class="import-preview-username">${escapeHtml(truncate(username, 30))}</td>
      <td class="import-preview-url">${escapeHtml(truncate(url, 40))}</td>
    </tr>
  `;
}

/**
 * Render column mapping for CSV imports
 * @param {Array} columns
 * @returns {string} HTML
 */
function renderColumnMapping(columns) {
  const mappings = [
    { key: 'title', label: t('vault.fields.title') },
    { key: 'username', label: t('vault.fields.username') },
    { key: 'password', label: t('vault.fields.password') },
    { key: 'url', label: t('vault.fields.url') }
  ];

  const detectedMappings = mappings.map(m => {
    const match = columns.find(c =>
      c.toLowerCase().includes(m.key) ||
      c.toLowerCase().includes(m.label.toLowerCase())
    );
    return { ...m, detected: match || null };
  });

  return `
    <div class="import-preview-mapping">
      <h4>${t('vault.import.columnMapping')}</h4>
      <div class="import-preview-mapping-grid">
        ${detectedMappings.map(m => `
          <div class="import-preview-mapping-item ${m.detected ? 'mapped' : 'unmapped'}">
            <span class="mapping-field">${m.label}</span>
            <span class="mapping-arrow">${getIcon('chevronRight', { size: 14 })}</span>
            <span class="mapping-column">${m.detected ? escapeHtml(m.detected) : t('vault.import.notDetected')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Get source type label
 * @param {string} source
 * @returns {string}
 */
function getSourceLabel(source) {
  const labels = {
    csv: 'CSV',
    json: 'JSON',
    kdbx: 'KeePass',
    chrome: 'Chrome',
    firefox: 'Firefox',
    bitwarden: 'Bitwarden',
    lastpass: 'LastPass',
    onepassword: '1Password'
  };
  return labels[source] || source.toUpperCase();
}

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 1) + '\u2026';
}
