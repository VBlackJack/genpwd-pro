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
 * @fileoverview Centralized theme icons and color definitions
 * Ensures visual consistency across all theme-related UI components
 */

/**
 * SVG icons for each theme
 * @type {Object.<string, string>}
 */
export const THEME_ICONS = {
  system: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
  </svg>`,

  light: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>`,

  dark: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>`,

  'high-contrast': `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"></path>
  </svg>`,

  ocean: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12c.6-.5 1.2-1 2.5-1 2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2c1.3 0 1.9-.5 2.5-1"></path>
    <path d="M2 7c.6-.5 1.2-1 2.5-1 2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2c1.3 0 1.9-.5 2.5-1"></path>
    <path d="M2 17c.6-.5 1.2-1 2.5-1 2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2c1.3 0 1.9-.5 2.5-1"></path>
  </svg>`,

  forest: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2L7 10h3l-4 8h12l-4-8h3L12 2z"></path>
    <line x1="12" y1="18" x2="12" y2="22"></line>
  </svg>`
};

/**
 * Color palette for each theme
 * Used for preview swatches in theme selection
 * @type {Object.<string, {bg: string, text: string, accent: string}>}
 */
export const THEME_COLORS = {
  dark: {
    bg: '#0f1424',
    text: '#f0f2f5',
    accent: '#a855f7'
  },
  light: {
    bg: '#f8fafc',
    text: '#1e293b',
    accent: '#7c3aed'
  },
  'high-contrast': {
    bg: '#000000',
    text: '#ffffff',
    accent: '#ffff00'
  },
  ocean: {
    bg: '#0c1929',
    text: '#e0f2fe',
    accent: '#0ea5e9'
  },
  forest: {
    bg: '#0f1a14',
    text: '#ecfdf5',
    accent: '#22c55e'
  }
};

/**
 * Get SVG icon for a theme
 * @param {string} themeId - Theme identifier
 * @returns {string} SVG markup
 */
export function getThemeIcon(themeId) {
  return THEME_ICONS[themeId] || THEME_ICONS.dark;
}

/**
 * Get color palette for a theme
 * @param {string} themeId - Theme identifier
 * @returns {{bg: string, text: string, accent: string}} Color palette
 */
export function getThemeColors(themeId) {
  return THEME_COLORS[themeId] || THEME_COLORS.dark;
}
