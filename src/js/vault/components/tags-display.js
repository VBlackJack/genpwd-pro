/**
 * @fileoverview Tags Display Components
 * Rendering functions for tags in various contexts
 */

import { escapeHtml } from '../utils/formatter.js';
import { t } from '../../utils/i18n.js';

/** Default tag color */
const DEFAULT_TAG_COLOR = '#6b7280';

/**
 * Strict color validation patterns
 * - Hex: #RGB or #RRGGBB (case insensitive)
 * - RGB: rgb(0-255, 0-255, 0-255)
 * - RGBA: rgba(0-255, 0-255, 0-255, 0-1)
 */
const HEX_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const RGB_COLOR_PATTERN = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const RGBA_COLOR_PATTERN = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/;

/**
 * Validate RGB values are within 0-255 range
 * @param {string[]} values - RGB value strings
 * @returns {boolean} True if all values are valid
 */
function isValidRgbRange(values) {
  return values.every(v => {
    const num = parseInt(v, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate and sanitize tag color (strict validation to prevent injection)
 * @param {string} color - Color value to validate
 * @returns {string} Valid color or default
 */
function sanitizeTagColor(color) {
  if (!color || typeof color !== 'string') return DEFAULT_TAG_COLOR;
  const trimmed = color.trim();

  // Check hex format
  if (HEX_COLOR_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Check rgb format with range validation
  const rgbMatch = trimmed.match(RGB_COLOR_PATTERN);
  if (rgbMatch && isValidRgbRange([rgbMatch[1], rgbMatch[2], rgbMatch[3]])) {
    return trimmed;
  }

  // Check rgba format with range validation
  const rgbaMatch = trimmed.match(RGBA_COLOR_PATTERN);
  if (rgbaMatch && isValidRgbRange([rgbaMatch[1], rgbaMatch[2], rgbaMatch[3]])) {
    return trimmed;
  }

  return DEFAULT_TAG_COLOR;
}

/**
 * Tag colors with semantic keys for accessibility
 */
const TAG_COLOR_DATA = [
  { color: '#ef4444', key: 'red' },
  { color: '#f97316', key: 'orange' },
  { color: '#eab308', key: 'yellow' },
  { color: '#22c55e', key: 'green' },
  { color: '#14b8a6', key: 'cyan' },
  { color: '#3b82f6', key: 'blue' },
  { color: '#8b5cf6', key: 'purple' },
  { color: '#ec4899', key: 'pink' }
];

/** Default tag colors for picker */
export const TAG_COLORS = TAG_COLOR_DATA.map(c => c.color);

/**
 * Get tag colors with translated labels
 * @returns {Array<{color: string, label: string}>}
 */
export function getTagColors() {
  return TAG_COLOR_DATA.map(c => ({
    color: c.color,
    label: t(`vault.colors.${c.key}`)
  }));
}

/**
 * Render tags list in sidebar
 * @param {Object} options
 * @param {Array} options.tags - All tags
 * @param {Array} options.entries - All entries (to count)
 * @param {string|null} options.selectedTag - Currently selected tag ID
 * @returns {string} HTML string
 */
export function renderTagsList({ tags, entries, selectedTag }) {
  if (!tags || tags.length === 0) {
    return `<div class="vault-nav-empty">${t('vault.sidebar.noTags')}</div>`;
  }

  return tags.map(tag => {
    const tagColor = sanitizeTagColor(tag.color);
    const count = entries.filter(e => e.tags?.includes(tag.id)).length;
    const isActive = selectedTag === tag.id;

    return `
      <button class="vault-nav-item vault-tag-item ${isActive ? 'active' : ''}"
              data-tag="${tag.id}"
              ${isActive ? 'aria-current="page"' : ''}>
        <span class="vault-tag-dot" data-tag-color="${tagColor}" aria-hidden="true"></span>
        <span class="vault-nav-label">${escapeHtml(tag.name)}</span>
        <span class="vault-nav-count">${count}</span>
        <button class="vault-tag-edit-btn" data-edit-tag="${tag.id}" title="${t('vault.actions.editTag')}" aria-label="${t('vault.common.edit')} ${escapeHtml(tag.name)}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </button>
    `;
  }).join('');
}

/**
 * Render tag picker for entry form
 * @param {Object} options
 * @param {Array} options.tags - All available tags
 * @param {Array} options.selectedTags - Currently selected tag IDs
 * @returns {string} HTML string
 */
export function renderTagPicker({ tags, selectedTags = [] }) {
  return `
    <div class="vault-tag-picker">
      <div class="vault-tag-picker-list">
        ${!tags || tags.length === 0 ? `<div class="vault-tag-empty">${t('vault.messages.noTags')}</div>` :
          tags.map(tag => `
            <label class="vault-tag-option ${selectedTags.includes(tag.id) ? 'selected' : ''}">
              <input type="checkbox" name="entry-tags" value="${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''}>
              <span class="vault-tag-chip" data-tag-color="${sanitizeTagColor(tag.color)}">
                ${escapeHtml(tag.name)}
              </span>
            </label>
          `).join('')
        }
      </div>
      <div class="vault-tag-picker-add">
        <input type="text" class="vault-input vault-input-sm" id="new-tag-name" placeholder="${t('vault.placeholders.newTag')}">
        <div class="vault-tag-color-picker" id="tag-color-picker">
          ${getTagColors().map((c, i) => `
            <button type="button" class="vault-color-btn vault-color-option ${i === 0 ? 'selected' : ''}"
                    data-color="${c.color}"
                    title="${c.label}" aria-label="${c.label}"></button>
          `).join('')}
        </div>
        <button type="button" class="vault-btn vault-btn-sm vault-btn-primary" id="btn-create-tag">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render tags in entry list row (compact)
 * @param {Object} options
 * @param {Object} options.entry - Entry object
 * @param {Array} options.tags - All tags
 * @param {number} [options.maxVisible=3] - Max tags to show before "+N"
 * @returns {string} HTML string
 */
export function renderTagsInRow({ entry, tags, maxVisible = 3 }) {
  if (!entry.tags || entry.tags.length === 0) return '';

  const entryTags = tags.filter(tag => entry.tags.includes(tag.id));
  if (entryTags.length === 0) return '';

  return `
    <div class="vault-entry-tags">
      ${entryTags.slice(0, maxVisible).map(tag => `
        <span class="vault-mini-tag" data-tag-color="${sanitizeTagColor(tag.color)}" title="${escapeHtml(tag.name)}">
          ${escapeHtml(tag.name)}
        </span>
      `).join('')}
      ${entryTags.length > maxVisible ? `<span class="vault-mini-tag vault-more-tags">+${entryTags.length - maxVisible}</span>` : ''}
    </div>
  `;
}

/**
 * Render tags in entry detail view
 * @param {Object} options
 * @param {Object} options.entry - Entry object
 * @param {Array} options.tags - All tags
 * @returns {string} HTML string
 */
export function renderTagsInDetail({ entry, tags }) {
  if (!entry.tags || entry.tags.length === 0) return '';

  const entryTags = tags.filter(tag => entry.tags.includes(tag.id));
  if (entryTags.length === 0) return '';

  return entryTags.map(tag => `
    <span class="vault-detail-tag" data-tag-color="${sanitizeTagColor(tag.color)}">
      ${escapeHtml(tag.name)}
    </span>
  `).join('');
}
