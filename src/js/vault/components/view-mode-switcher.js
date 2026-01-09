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
 * @fileoverview View Mode Switcher Component
 * Allows switching between compact, comfortable, and grid view modes
 */

import { t } from '../../utils/i18n.js';
import { safeGetItem, safeSetItem } from '../../utils/storage-helper.js';

/**
 * Available view modes
 */
export const VIEW_MODES = {
  COMPACT: 'compact',
  COMFORTABLE: 'comfortable',
  GRID: 'grid'
};

/**
 * Available group by options
 */
export const GROUP_BY_OPTIONS = {
  NONE: 'none',
  TYPE: 'type',
  FOLDER: 'folder',
  STRENGTH: 'strength'
};

const STORAGE_KEY = 'genpwd_vault_view_mode';
const GROUP_STORAGE_KEY = 'genpwd_vault_group_by';

let currentViewMode = VIEW_MODES.COMFORTABLE;
let currentGroupBy = GROUP_BY_OPTIONS.NONE;
let onChangeCallback = null;

/**
 * Initialize view mode from storage
 * @returns {string} Current view mode
 */
export function initViewMode() {
  const stored = safeGetItem(STORAGE_KEY);
  if (stored && Object.values(VIEW_MODES).includes(stored)) {
    currentViewMode = stored;
  }

  const storedGroup = safeGetItem(GROUP_STORAGE_KEY);
  if (storedGroup && Object.values(GROUP_BY_OPTIONS).includes(storedGroup)) {
    currentGroupBy = storedGroup;
  }

  return currentViewMode;
}

/**
 * Get current view mode
 * @returns {string} Current view mode
 */
export function getViewMode() {
  return currentViewMode;
}

/**
 * Get current group by option
 * @returns {string} Current group by option
 */
export function getGroupBy() {
  return currentGroupBy;
}

/**
 * Set view mode and persist to storage
 * @param {string} mode - View mode to set
 */
export function setViewMode(mode) {
  if (!Object.values(VIEW_MODES).includes(mode)) {
    return;
  }
  currentViewMode = mode;
  safeSetItem(STORAGE_KEY, mode);

  // Update UI classes
  updateViewModeClasses();

  // Trigger callback if set
  if (typeof onChangeCallback === 'function') {
    onChangeCallback({ viewMode: mode, groupBy: currentGroupBy });
  }
}

/**
 * Set group by option and persist to storage
 * @param {string} groupBy - Group by option to set
 */
export function setGroupBy(groupBy) {
  if (!Object.values(GROUP_BY_OPTIONS).includes(groupBy)) {
    return;
  }
  currentGroupBy = groupBy;
  safeSetItem(GROUP_STORAGE_KEY, groupBy);

  // Trigger callback if set
  if (typeof onChangeCallback === 'function') {
    onChangeCallback({ viewMode: currentViewMode, groupBy });
  }
}

/**
 * Set callback for view mode changes
 * @param {Function} callback - Callback function
 */
export function onViewModeChange(callback) {
  onChangeCallback = callback;
}

/**
 * Update CSS classes on entry list based on view mode
 */
function updateViewModeClasses() {
  const entryList = document.querySelector('.vault-entry-list');
  if (!entryList) return;

  // Remove all view mode classes
  entryList.classList.remove(
    'view-compact',
    'view-comfortable',
    'view-grid'
  );

  // Add current view mode class
  entryList.classList.add(`view-${currentViewMode}`);
}

/**
 * Render the view mode switcher component
 * @returns {string} HTML string
 */
export function renderViewModeSwitcher() {
  const isCompact = currentViewMode === VIEW_MODES.COMPACT;
  const isComfortable = currentViewMode === VIEW_MODES.COMFORTABLE;
  const isGrid = currentViewMode === VIEW_MODES.GRID;

  return `
    <div class="vault-view-switcher" role="group" aria-label="${t('vault.view.viewMode')}">
      <button type="button"
              class="vault-view-btn ${isCompact ? 'active' : ''}"
              data-view-mode="${VIEW_MODES.COMPACT}"
              title="${t('vault.view.compact')}"
              aria-label="${t('vault.view.compact')}"
              aria-pressed="${isCompact}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <button type="button"
              class="vault-view-btn ${isComfortable ? 'active' : ''}"
              data-view-mode="${VIEW_MODES.COMFORTABLE}"
              title="${t('vault.view.comfortable')}"
              aria-label="${t('vault.view.comfortable')}"
              aria-pressed="${isComfortable}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="4" rx="1"></rect>
          <rect x="3" y="10" width="7" height="4" rx="1"></rect>
          <rect x="3" y="17" width="7" height="4" rx="1"></rect>
          <line x1="13" y1="5" x2="21" y2="5"></line>
          <line x1="13" y1="12" x2="21" y2="12"></line>
          <line x1="13" y1="19" x2="21" y2="19"></line>
        </svg>
      </button>
      <button type="button"
              class="vault-view-btn ${isGrid ? 'active' : ''}"
              data-view-mode="${VIEW_MODES.GRID}"
              title="${t('vault.view.grid')}"
              aria-label="${t('vault.view.grid')}"
              aria-pressed="${isGrid}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Render the group by dropdown
 * @returns {string} HTML string
 */
export function renderGroupByDropdown() {
  return `
    <div class="vault-group-by">
      <select class="vault-group-select"
              aria-label="${t('vault.view.groupBy')}"
              data-action="change-group-by">
        <option value="${GROUP_BY_OPTIONS.NONE}" ${currentGroupBy === GROUP_BY_OPTIONS.NONE ? 'selected' : ''}>
          ${t('vault.view.groupByNone')}
        </option>
        <option value="${GROUP_BY_OPTIONS.TYPE}" ${currentGroupBy === GROUP_BY_OPTIONS.TYPE ? 'selected' : ''}>
          ${t('vault.view.groupByType')}
        </option>
        <option value="${GROUP_BY_OPTIONS.FOLDER}" ${currentGroupBy === GROUP_BY_OPTIONS.FOLDER ? 'selected' : ''}>
          ${t('vault.view.groupByFolder')}
        </option>
        <option value="${GROUP_BY_OPTIONS.STRENGTH}" ${currentGroupBy === GROUP_BY_OPTIONS.STRENGTH ? 'selected' : ''}>
          ${t('vault.view.groupByStrength')}
        </option>
      </select>
    </div>
  `;
}

/**
 * Render combined toolbar with view switcher and group by
 * @returns {string} HTML string
 */
export function renderViewToolbar() {
  return `
    <div class="vault-view-toolbar">
      ${renderViewModeSwitcher()}
      ${renderGroupByDropdown()}
    </div>
  `;
}

/**
 * Initialize event listeners for view mode switcher
 * @param {HTMLElement} container - Container element
 */
export function initViewModeSwitcherEvents(container) {
  if (!container) return;

  // View mode buttons
  container.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-mode]');
    if (viewBtn) {
      const mode = viewBtn.dataset.viewMode;
      setViewMode(mode);

      // Update button states
      container.querySelectorAll('[data-view-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.viewMode === mode);
        btn.setAttribute('aria-pressed', btn.dataset.viewMode === mode);
      });
    }
  });

  // Group by select
  container.addEventListener('change', (e) => {
    if (e.target.matches('[data-action="change-group-by"]')) {
      setGroupBy(e.target.value);
    }
  });
}
