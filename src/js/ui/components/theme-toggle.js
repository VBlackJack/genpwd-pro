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
 * @fileoverview Theme Toggle Header Component
 * Provides quick theme switching from the header bar
 */

import {
  getCurrentTheme,
  getThemeMode,
  getAvailableThemes,
  cycleQuickTheme,
  applyTheme,
  setThemeMode,
  THEME_MODES
} from '../../utils/theme-manager.js';
import { THEME_ICONS } from '../../config/theme-icons.js';
import { t } from '../../utils/i18n.js';
import { showToast } from '../../utils/toast.js';

/**
 * Theme Toggle Component
 * Handles theme switching from header
 */
export class ThemeToggle {
  constructor() {
    this.button = null;
    this.dropdown = null;
    this.isDropdownOpen = false;
    this.longPressTimer = null;
    this.abortController = new AbortController();

    this.#init();
  }

  #init() {
    this.#injectButton();
    this.#attachEvents();
    this.#updateButtonState();

    // Listen for theme changes from other sources
    window.addEventListener('theme:changed', () => this.#updateButtonState());
  }

  #injectButton() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;

    // Find the about button to insert before it
    const aboutBtn = document.getElementById('btn-about');

    // Create the toggle button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle-btn';
    button.id = 'btn-theme-toggle';
    button.setAttribute('aria-label', t('header.themeToggle'));
    button.setAttribute('title', t('header.themeToggleTitle'));
    button.innerHTML = `
      <span class="theme-toggle-icon" aria-hidden="true"></span>
      <span class="theme-toggle-label">${t('header.theme')}</span>
    `;

    // Insert before about button or at the end
    if (aboutBtn) {
      headerRight.insertBefore(button, aboutBtn);
    } else {
      headerRight.appendChild(button);
    }

    this.button = button;
  }

  #attachEvents() {
    if (!this.button) return;

    // Click: cycle through quick themes
    this.button.addEventListener('click', () => {
      if (this.isDropdownOpen) {
        this.#closeDropdown();
        return;
      }
      this.#handleClick();
    });

    // Right-click: show full dropdown
    this.button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.#toggleDropdown();
    });

    // Long press for mobile: show dropdown
    this.button.addEventListener('pointerdown', () => {
      this.longPressTimer = setTimeout(() => {
        this.#toggleDropdown();
      }, 500);
    });

    this.button.addEventListener('pointerup', () => {
      clearTimeout(this.longPressTimer);
    });

    this.button.addEventListener('pointerleave', () => {
      clearTimeout(this.longPressTimer);
    });

    // Keyboard navigation
    this.button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.#handleClick();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.#toggleDropdown();
      }
    });

    // Close dropdown on outside click (with cleanup via AbortController)
    document.addEventListener('click', (e) => {
      if (this.isDropdownOpen && !this.button.contains(e.target) && !this.dropdown?.contains(e.target)) {
        this.#closeDropdown();
      }
    }, { signal: this.abortController.signal });

    // Close dropdown on Escape (with cleanup via AbortController)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isDropdownOpen) {
        this.#closeDropdown();
        this.button.focus();
      }
    }, { signal: this.abortController.signal });
  }

  #handleClick() {
    // Add rotation animation
    this.button.classList.add('cycling');
    setTimeout(() => this.button.classList.remove('cycling'), 350);

    const result = cycleQuickTheme();
    this.#updateButtonState();
    this.#showFeedback(result);
  }

  #updateButtonState() {
    if (!this.button) return;

    const mode = getThemeMode();
    const theme = getCurrentTheme();

    // Update icon based on mode/theme
    const iconContainer = this.button.querySelector('.theme-toggle-icon');
    if (iconContainer) {
      const iconKey = mode === THEME_MODES.SYSTEM ? 'system' : theme;
      iconContainer.innerHTML = THEME_ICONS[iconKey] || THEME_ICONS.dark;
    }

    // Update label
    const labelContainer = this.button.querySelector('.theme-toggle-label');
    if (labelContainer) {
      const labelKey = mode === THEME_MODES.SYSTEM ? 'themes.system' : `themes.${theme}`;
      labelContainer.textContent = t(labelKey);
    }

    // Update aria-label
    const currentLabel = mode === THEME_MODES.SYSTEM
      ? t('themes.system')
      : t(`themes.${theme}`);
    this.button.setAttribute('aria-label', `${t('header.themeToggle')}: ${currentLabel}`);
  }

  #showFeedback(result) {
    const themeName = result.mode === THEME_MODES.SYSTEM
      ? t('themes.system')
      : t(`themes.${result.theme}`);

    showToast(`${t('header.themeSwitched')}: ${themeName}`, 'info', 1500);
  }

  #toggleDropdown() {
    if (this.isDropdownOpen) {
      this.#closeDropdown();
    } else {
      this.#openDropdown();
    }
  }

  #openDropdown() {
    if (this.dropdown) {
      this.dropdown.remove();
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'theme-dropdown';
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-label', t('header.themeMenu'));

    const currentTheme = getCurrentTheme();
    const currentMode = getThemeMode();

    // System option
    const systemItem = this.#createDropdownItem({
      id: 'system',
      name: t('themes.system'),
      icon: THEME_ICONS.system,
      isActive: currentMode === THEME_MODES.SYSTEM
    });
    systemItem.addEventListener('click', () => {
      setThemeMode(THEME_MODES.SYSTEM);
      this.#updateButtonState();
      this.#closeDropdown();
    });
    dropdown.appendChild(systemItem);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'theme-dropdown-divider';
    dropdown.appendChild(divider);

    // Theme options
    getAvailableThemes().forEach(theme => {
      const item = this.#createDropdownItem({
        id: theme.id,
        name: t(`themes.${theme.id}`) || theme.name,
        icon: THEME_ICONS[theme.id] || theme.icon,
        isActive: currentMode === THEME_MODES.MANUAL && currentTheme === theme.id
      });
      item.addEventListener('click', () => {
        setThemeMode(THEME_MODES.MANUAL);
        applyTheme(theme.id);
        this.#updateButtonState();
        this.#closeDropdown();
      });
      dropdown.appendChild(item);
    });

    // Position dropdown
    this.button.style.position = 'relative';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.right = '0';
    dropdown.style.marginTop = '4px';

    this.button.appendChild(dropdown);
    this.dropdown = dropdown;
    this.isDropdownOpen = true;

    // Focus first item
    const firstItem = dropdown.querySelector('.theme-dropdown-item');
    firstItem?.focus();
  }

  #createDropdownItem({ id, name, icon, isActive }) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `theme-dropdown-item ${isActive ? 'active' : ''}`;
    item.setAttribute('role', 'menuitem');
    item.setAttribute('data-theme', id);
    item.innerHTML = `
      <span class="theme-dropdown-icon" aria-hidden="true">${typeof icon === 'string' && icon.startsWith('<') ? icon : icon}</span>
      <span class="theme-dropdown-name">${name}</span>
      <span class="theme-dropdown-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
    `;
    return item;
  }

  #closeDropdown() {
    if (this.dropdown) {
      this.dropdown.remove();
      this.dropdown = null;
    }
    this.isDropdownOpen = false;
  }

  /**
   * Destroy the component and clean up
   */
  destroy() {
    // Abort all document listeners
    this.abortController.abort();

    if (this.button) {
      this.button.remove();
    }
    this.#closeDropdown();
    window.removeEventListener('theme:changed', this.#updateButtonState);
  }
}

/**
 * Initialize theme toggle in header
 * @returns {ThemeToggle}
 */
export function initThemeToggle() {
  return new ThemeToggle();
}
