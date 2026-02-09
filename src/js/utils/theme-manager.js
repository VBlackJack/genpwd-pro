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

// src/js/utils/theme-manager.js - Theme manager

import { safeLog } from './logger.js';
import { safeGetItem, safeSetItem } from './storage-helper.js';
import { i18n } from './i18n.js';

/**
 * Available themes with their CSS variables
 */
const THEMES = {
  dark: {
    name: 'Dark',
    icon: '🌙',
    variables: {
      '--bg-primary': '#1a1d29',
      '--bg-secondary': '#232740',
      '--bg-tertiary': '#2a2f4a',
      '--bg-quaternary': '#1f2336',
      '--accent-cyan': '#00d4ff',
      '--accent-purple': '#8b5cf6',
      '--accent-green': '#10b981',
      '--accent-yellow': '#f59e0b',
      '--accent-red': '#ef4444',
      '--accent-blue': '#3b82f6',
      '--text-primary': '#e8ebf7',
      '--text-secondary': '#d1d5db',
      '--text-muted': '#aab2cf',
      '--border': '#373c59',
      '--border-hover': '#4f5578'
    }
  },

  light: {
    name: 'Light',
    icon: '☀️',
    variables: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f9fafb',
      '--bg-tertiary': '#f3f4f6',
      '--bg-quaternary': '#e5e7eb',
      '--accent-cyan': '#0891b2',
      '--accent-purple': '#7c3aed',
      '--accent-green': '#059669',
      '--accent-yellow': '#d97706',
      '--accent-red': '#dc2626',
      '--accent-blue': '#2563eb',
      '--text-primary': '#111827',
      '--text-secondary': '#374151',
      '--text-muted': '#6b7280',
      '--border': '#d1d5db',
      '--border-hover': '#9ca3af'
    }
  },

  'high-contrast': {
    name: 'High Contrast',
    icon: '⚫⚪',
    variables: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#1a1a1a',
      '--bg-tertiary': '#262626',
      '--bg-quaternary': '#0d0d0d',
      '--accent-cyan': '#00ffff',
      '--accent-purple': '#ff00ff',
      '--accent-green': '#00ff00',
      '--accent-yellow': '#ffff00',
      '--accent-red': '#ff0000',
      '--accent-blue': '#0000ff',
      '--text-primary': '#ffffff',
      '--text-secondary': '#f0f0f0',
      '--text-muted': '#d0d0d0',
      '--border': '#ffffff',
      '--border-hover': '#ffff00'
    }
  },

  ocean: {
    name: 'Ocean',
    icon: '🌊',
    variables: {
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--bg-tertiary': '#334155',
      '--bg-quaternary': '#1a2332',
      '--accent-cyan': '#06b6d4',
      '--accent-purple': '#a78bfa',
      '--accent-green': '#34d399',
      '--accent-yellow': '#fbbf24',
      '--accent-red': '#f87171',
      '--accent-blue': '#60a5fa',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#94a3b8',
      '--border': '#475569',
      '--border-hover': '#64748b'
    }
  },

  forest: {
    name: 'Forest',
    icon: '🌲',
    variables: {
      '--bg-primary': '#14291e',
      '--bg-secondary': '#1a3a2b',
      '--bg-tertiary': '#234a38',
      '--bg-quaternary': '#0f1f17',
      '--accent-cyan': '#2dd4bf',
      '--accent-purple': '#c084fc',
      '--accent-green': '#4ade80',
      '--accent-yellow': '#fcd34d',
      '--accent-red': '#fb7185',
      '--accent-blue': '#38bdf8',
      '--text-primary': '#ecfdf5',
      '--text-secondary': '#d1fae5',
      '--text-muted': '#a7f3d0',
      '--border': '#34d399',
      '--border-hover': '#6ee7b7'
    }
  }
};

const STORAGE_KEY = 'genpwd-theme';
const MODE_STORAGE_KEY = 'genpwd-theme-mode';
const TRANSITION_DURATION = 200; // ms

/**
 * Theme preference modes
 */
export const THEME_MODES = {
  SYSTEM: 'system',
  MANUAL: 'manual'
};

let currentTheme = 'dark';
let currentMode = THEME_MODES.SYSTEM;

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Applies a theme to the page
 * @param {string} themeName - Theme name to apply
 * @param {boolean} animate - Whether to animate the transition (default: true)
 */
export function applyTheme(themeName, animate = true) {
  const theme = THEMES[themeName];

  if (!theme) {
    safeLog(`Unknown theme: ${themeName}, falling back to 'dark'`);
    themeName = 'dark';
  }

  const root = document.documentElement;

  // Add transition class for smooth theme change (unless reduced motion or no animation)
  const shouldAnimate = animate && !prefersReducedMotion();
  if (shouldAnimate) {
    document.body.classList.add('theme-transitioning');
  }

  // Clear any inline CSS variables from a previous custom theme.
  // Built-in themes rely on CSS [data-theme] selectors — no inline styles needed.
  const allVarKeys = Object.keys(THEMES.dark.variables);
  allVarKeys.forEach((property) => {
    root.style.removeProperty(property);
  });

  // Save choice
  currentTheme = themeName;
  try {
    safeSetItem(STORAGE_KEY, themeName);
  } catch (e) {
    safeLog('Unable to save theme to localStorage');
  }

  // Update data-theme attribute on <html> for CSS [data-theme] selectors
  document.documentElement.setAttribute('data-theme', themeName);

  // Remove transition class after animation completes
  if (shouldAnimate) {
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, TRANSITION_DURATION);
  }

  // Dispatch custom event for other components to react
  window.dispatchEvent(new CustomEvent('theme:changed', {
    detail: { theme: themeName, mode: currentMode }
  }));

  safeLog(`Theme applied: ${themeName} (${theme.name})`);
}

/**
 * Gets the current theme
 * @returns {string} Current theme name
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Gets all available themes
 * @returns {Object} Theme dictionary
 */
export function getAvailableThemes() {
  return Object.entries(THEMES).map(([id, theme]) => ({
    id,
    name: theme.name,
    icon: theme.icon
  }));
}

/**
 * Gets the current theme mode
 * @returns {string} Current mode ('system' or 'manual')
 */
export function getThemeMode() {
  return currentMode;
}

/**
 * Sets the theme mode
 * @param {string} mode - 'system' or 'manual'
 */
export function setThemeMode(mode) {
  if (mode !== THEME_MODES.SYSTEM && mode !== THEME_MODES.MANUAL) {
    safeLog(`Invalid theme mode: ${mode}`);
    return;
  }

  currentMode = mode;

  try {
    safeSetItem(MODE_STORAGE_KEY, mode);
  } catch (e) {
    safeLog('Unable to save theme mode to localStorage');
  }

  // If switching to system mode, apply system preference
  if (mode === THEME_MODES.SYSTEM) {
    const systemTheme = getSystemPreferredTheme();
    applyTheme(systemTheme);
  }

  safeLog(`Theme mode set to: ${mode}`);
}

/**
 * Gets the system preferred theme
 * @returns {string} Theme name based on system preference
 */
export function getSystemPreferredTheme() {
  if (!window.matchMedia) return 'dark';

  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

  if (prefersHighContrast) return 'high-contrast';
  if (prefersLight) return 'light';
  return 'dark';
}

/**
 * Cycles through quick themes: System → Light → Dark → System
 * For header toggle button
 * @returns {Object} { theme: string, mode: string }
 */
export function cycleQuickTheme() {
  // Quick cycle order: system → light → dark → system
  if (currentMode === THEME_MODES.SYSTEM) {
    // System → Light (manual)
    currentMode = THEME_MODES.MANUAL;
    safeSetItem(MODE_STORAGE_KEY, THEME_MODES.MANUAL);
    applyTheme('light');
    return { theme: 'light', mode: THEME_MODES.MANUAL };
  } else if (currentTheme === 'light') {
    // Light → Dark (manual)
    applyTheme('dark');
    return { theme: 'dark', mode: THEME_MODES.MANUAL };
  } else {
    // Dark (or any other) → System
    currentMode = THEME_MODES.SYSTEM;
    safeSetItem(MODE_STORAGE_KEY, THEME_MODES.SYSTEM);
    // Clear saved theme to enable system detection
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
    const systemTheme = getSystemPreferredTheme();
    applyTheme(systemTheme);
    return { theme: systemTheme, mode: THEME_MODES.SYSTEM };
  }
}

/**
 * Loads saved theme or detects system preference
 */
export function loadSavedTheme() {
  let themeName = 'dark'; // Default

  // 1. Load mode preference
  try {
    const savedMode = safeGetItem(MODE_STORAGE_KEY);
    if (savedMode === THEME_MODES.SYSTEM || savedMode === THEME_MODES.MANUAL) {
      currentMode = savedMode;
    }
  } catch (e) {
    // Default to system mode
    currentMode = THEME_MODES.SYSTEM;
  }

  // 2. If manual mode, load saved theme
  if (currentMode === THEME_MODES.MANUAL) {
    try {
      const saved = safeGetItem(STORAGE_KEY);
      if (saved && THEMES[saved]) {
        themeName = saved;
        safeLog(`Theme loaded from localStorage: ${themeName} (manual mode)`);
        applyTheme(themeName, false); // No animation on load
        return;
      }
    } catch (e) {
      safeLog('Unable to read localStorage');
    }
  }

  // 3. System mode or no saved theme: detect system preference
  if (window.matchMedia) {
    themeName = getSystemPreferredTheme();
    safeLog(`Theme detected from system preferences: ${themeName}`);
  }

  applyTheme(themeName, false); // No animation on initial load
}

/**
 * State for system theme change listener
 * @private
 */
let systemThemeChangeHandler = null;
let systemThemeMediaQuery = null;

/**
 * Listens for system preference changes
 *
 * Note: To cleanup the listener, call unwatchSystemThemeChanges()
 * before destroying the application or during cleanup.
 */
export function watchSystemThemeChanges() {
  if (!window.matchMedia) return;

  // Cleanup any existing listener first
  unwatchSystemThemeChanges();

  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  systemThemeChangeHandler = () => {
    // Only change if in system mode
    if (currentMode === THEME_MODES.SYSTEM) {
      const newTheme = getSystemPreferredTheme();
      applyTheme(newTheme);
      safeLog(`Theme updated due to system change: ${newTheme}`);
    }
  };

  // addEventListener pour les navigateurs modernes
  if (systemThemeMediaQuery.addEventListener) {
    systemThemeMediaQuery.addEventListener('change', systemThemeChangeHandler);
  } else {
    // fallback pour les anciens navigateurs
    systemThemeMediaQuery.addListener(systemThemeChangeHandler);
  }

  safeLog('System theme change watcher initialized');
}

/**
 * Stops listening for system preference changes
 * Cleans up event listener to avoid memory leaks
 *
 * Call during application cleanup or before recreating the watcher
 */
export function unwatchSystemThemeChanges() {
  if (!systemThemeMediaQuery || !systemThemeChangeHandler) {
    return; // Nothing to cleanup
  }

  try {
    // removeEventListener pour les navigateurs modernes
    if (systemThemeMediaQuery.removeEventListener) {
      systemThemeMediaQuery.removeEventListener('change', systemThemeChangeHandler);
    } else {
      // fallback pour les anciens navigateurs
      systemThemeMediaQuery.removeListener(systemThemeChangeHandler);
    }

    safeLog('System theme change watcher cleaned up');
  } catch (err) {
    safeLog(`Error cleaning up system theme watcher: ${err.message}`);
  } finally {
    // Reset references
    systemThemeChangeHandler = null;
    systemThemeMediaQuery = null;
  }
}

/**
 * Cycles to the next theme in the list
 */
export function cycleTheme() {
  const themeIds = Object.keys(THEMES);
  const currentIndex = themeIds.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeIds.length;
  const nextTheme = themeIds[nextIndex];

  applyTheme(nextTheme);
  return nextTheme;
}

/**
 * Initializes the theme system
 */
export function initThemeSystem() {
  loadSavedTheme();
  watchSystemThemeChanges();
  safeLog('Theme system initialized');
}

/**
 * Creates a theme selector UI
 * @param {string} containerId - Container ID where to insert the selector
 */
export function createThemeSelector(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    safeLog(`Container ${containerId} not found for theme selector`);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-selector';

  const label = document.createElement('span');
  label.textContent = i18n.t('settings.themeLabel');
  label.className = 'theme-selector-label';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.id = 'theme-select';
  select.className = 'theme-select';

  // Add options
  getAvailableThemes().forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = `${theme.icon} ${theme.name}`;
    if (theme.id === currentTheme) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  // Event listener
  select.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });

  wrapper.appendChild(select);
  container.appendChild(wrapper);

  safeLog('Theme selector created');
}
