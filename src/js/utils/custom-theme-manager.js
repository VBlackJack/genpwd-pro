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

// src/js/utils/custom-theme-manager.js - Custom Theme Management
// Allows users to create, edit, and share custom themes

import { safeLog } from './logger.js';

/**
 * Storage key for custom themes
 */
const STORAGE_KEY = 'genpwd-custom-themes';

/**
 * Theme schema version
 */
const THEME_SCHEMA_VERSION = '1.0';

/**
 * Required CSS variables for a complete theme
 */
export const THEME_VARIABLES = [
  { key: '--bg-primary', label: 'Background Primary', category: 'background' },
  { key: '--bg-secondary', label: 'Background Secondary', category: 'background' },
  { key: '--bg-tertiary', label: 'Background Tertiary', category: 'background' },
  { key: '--bg-quaternary', label: 'Background Quaternary', category: 'background' },
  { key: '--accent-cyan', label: 'Accent Cyan', category: 'accent' },
  { key: '--accent-purple', label: 'Accent Purple', category: 'accent' },
  { key: '--accent-green', label: 'Accent Green', category: 'accent' },
  { key: '--accent-yellow', label: 'Accent Yellow', category: 'accent' },
  { key: '--accent-red', label: 'Accent Red', category: 'accent' },
  { key: '--accent-blue', label: 'Accent Blue', category: 'accent' },
  { key: '--text-primary', label: 'Text Primary', category: 'text' },
  { key: '--text-secondary', label: 'Text Secondary', category: 'text' },
  { key: '--text-muted', label: 'Text Muted', category: 'text' },
  { key: '--border', label: 'Border', category: 'border' },
  { key: '--border-hover', label: 'Border Hover', category: 'border' }
];

/**
 * Default theme template (dark theme)
 */
export const DEFAULT_THEME_TEMPLATE = {
  '--bg-primary': '#1a1d29',
  '--bg-secondary': '#232740',
  '--bg-tertiary': '#2d3250',
  '--bg-quaternary': '#373d5c',
  '--accent-cyan': '#00d4ff',
  '--accent-purple': '#a855f7',
  '--accent-green': '#10b981',
  '--accent-yellow': '#f59e0b',
  '--accent-red': '#ef4444',
  '--accent-blue': '#3b82f6',
  '--text-primary': '#e8ebf7',
  '--text-secondary': '#a0a8c4',
  '--text-muted': '#6b7280',
  '--border': '#3d4466',
  '--border-hover': '#4d5580'
};

/**
 * Custom theme object structure
 * @typedef {Object} CustomTheme
 * @property {string} id - Unique theme ID
 * @property {string} name - Display name
 * @property {string} icon - Emoji or icon
 * @property {string} author - Theme author
 * @property {string} version - Theme version
 * @property {Object} variables - CSS variable values
 * @property {Object} metadata - Additional metadata
 * @property {string} metadata.createdAt - ISO date string
 * @property {string} metadata.modifiedAt - ISO date string
 * @property {string} metadata.basedOn - Original theme ID
 * @property {string} metadata.schemaVersion - Schema version
 */

/**
 * Get all custom themes
 * @returns {CustomTheme[]}
 */
export function getCustomThemes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) || [];
  } catch (error) {
    safeLog(`CustomThemes: Failed to load: ${error.message}`);
    return [];
  }
}

/**
 * Save custom themes to storage
 * @param {CustomTheme[]} themes - Themes to save
 */
function saveCustomThemes(themes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch (error) {
    safeLog(`CustomThemes: Failed to save: ${error.message}`);
    throw error;
  }
}

/**
 * Generate unique theme ID
 * @returns {string}
 */
function generateThemeId() {
  return `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate theme structure
 * @param {Object} theme - Theme to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTheme(theme) {
  const errors = [];

  if (!theme || typeof theme !== 'object') {
    errors.push('Theme must be an object');
    return { valid: false, errors };
  }

  // Required fields
  if (!theme.name || typeof theme.name !== 'string' || theme.name.trim().length === 0) {
    errors.push('Theme name is required');
  }

  if (theme.name && theme.name.length > 50) {
    errors.push('Theme name must be 50 characters or less');
  }

  if (!theme.variables || typeof theme.variables !== 'object') {
    errors.push('Theme variables are required');
  } else {
    // Validate all required variables are present
    for (const varDef of THEME_VARIABLES) {
      const value = theme.variables[varDef.key];
      if (!value) {
        errors.push(`Missing variable: ${varDef.key}`);
      } else if (!isValidColor(value)) {
        errors.push(`Invalid color for ${varDef.key}: ${value}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a string is a valid CSS color
 * @param {string} color - Color string to validate
 * @returns {boolean}
 */
export function isValidColor(color) {
  if (!color || typeof color !== 'string') return false;

  // Hex colors
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) return true;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return true;
  if (/^#[0-9A-Fa-f]{8}$/.test(color)) return true;

  // RGB/RGBA
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*[\d.]+)?\s*\)$/.test(color)) return true;

  // HSL/HSLA
  if (/^hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(,\s*[\d.]+)?\s*\)$/.test(color)) return true;

  // Named colors (basic set)
  const namedColors = ['black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'transparent'];
  if (namedColors.includes(color.toLowerCase())) return true;

  return false;
}

/**
 * Create a new custom theme
 * @param {Object} themeData - Theme data
 * @param {string} themeData.name - Theme name
 * @param {string} themeData.icon - Theme icon (emoji)
 * @param {Object} themeData.variables - CSS variables
 * @param {string} themeData.basedOn - Original theme ID
 * @returns {CustomTheme} - Created theme
 */
export function createCustomTheme(themeData) {
  const validation = validateTheme(themeData);
  if (!validation.valid) {
    throw new Error(`Invalid theme: ${validation.errors.join(', ')}`);
  }

  const now = new Date().toISOString();
  const theme = {
    id: generateThemeId(),
    name: themeData.name.trim(),
    icon: themeData.icon || '🎨',
    author: themeData.author || 'User',
    version: '1.0.0',
    variables: { ...themeData.variables },
    metadata: {
      createdAt: now,
      modifiedAt: now,
      basedOn: themeData.basedOn || null,
      schemaVersion: THEME_SCHEMA_VERSION
    }
  };

  const themes = getCustomThemes();
  themes.push(theme);
  saveCustomThemes(themes);

  safeLog(`CustomThemes: Created theme "${theme.name}" (${theme.id})`);

  return theme;
}

/**
 * Update an existing custom theme
 * @param {string} themeId - Theme ID to update
 * @param {Object} updates - Fields to update
 * @returns {CustomTheme|null} - Updated theme or null if not found
 */
export function updateCustomTheme(themeId, updates) {
  const themes = getCustomThemes();
  const index = themes.findIndex(t => t.id === themeId);

  if (index === -1) {
    safeLog(`CustomThemes: Theme not found: ${themeId}`);
    return null;
  }

  const theme = themes[index];

  // Apply updates
  if (updates.name !== undefined) theme.name = updates.name.trim();
  if (updates.icon !== undefined) theme.icon = updates.icon;
  if (updates.variables !== undefined) {
    // Validate new variables
    const testTheme = { ...theme, variables: updates.variables };
    const validation = validateTheme(testTheme);
    if (!validation.valid) {
      throw new Error(`Invalid variables: ${validation.errors.join(', ')}`);
    }
    theme.variables = { ...updates.variables };
  }

  theme.metadata.modifiedAt = new Date().toISOString();

  saveCustomThemes(themes);
  safeLog(`CustomThemes: Updated theme "${theme.name}"`);

  return theme;
}

/**
 * Delete a custom theme
 * @param {string} themeId - Theme ID to delete
 * @returns {boolean} - Success
 */
export function deleteCustomTheme(themeId) {
  const themes = getCustomThemes();
  const index = themes.findIndex(t => t.id === themeId);

  if (index === -1) {
    safeLog(`CustomThemes: Theme not found: ${themeId}`);
    return false;
  }

  const theme = themes[index];
  themes.splice(index, 1);
  saveCustomThemes(themes);

  safeLog(`CustomThemes: Deleted theme "${theme.name}"`);

  return true;
}

/**
 * Get a specific custom theme by ID
 * @param {string} themeId - Theme ID
 * @returns {CustomTheme|null}
 */
export function getCustomTheme(themeId) {
  const themes = getCustomThemes();
  return themes.find(t => t.id === themeId) || null;
}

/**
 * Export theme to JSON string
 * @param {string} themeId - Theme ID to export
 * @returns {string|null} - JSON string or null if not found
 */
export function exportTheme(themeId) {
  const theme = getCustomTheme(themeId);
  if (!theme) return null;

  // Create export object (without internal metadata)
  const exportData = {
    '$schema': `genpwd-theme-v${THEME_SCHEMA_VERSION}`,
    name: theme.name,
    icon: theme.icon,
    author: theme.author,
    version: theme.version,
    variables: theme.variables,
    exportedAt: new Date().toISOString()
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import theme from JSON string
 * @param {string} jsonString - JSON theme data
 * @returns {CustomTheme} - Imported theme
 */
export function importTheme(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Validate schema
  if (data.$schema && !data.$schema.includes('genpwd-theme')) {
    throw new Error('Invalid theme schema');
  }

  // Create theme from imported data
  return createCustomTheme({
    name: data.name || 'Imported Theme',
    icon: data.icon || '📦',
    author: data.author || 'Imported',
    variables: data.variables,
    basedOn: 'imported'
  });
}

/**
 * Duplicate an existing theme
 * @param {string} themeId - Theme ID to duplicate
 * @param {string} newName - Name for the duplicate
 * @returns {CustomTheme} - New theme
 */
export function duplicateTheme(themeId, newName) {
  const original = getCustomTheme(themeId);
  if (!original) {
    throw new Error('Theme not found');
  }

  return createCustomTheme({
    name: newName || `${original.name} (Copy)`,
    icon: original.icon,
    variables: { ...original.variables },
    basedOn: original.id
  });
}

/**
 * Get theme variables as CSS string
 * @param {CustomTheme} theme - Theme object
 * @returns {string} - CSS variable declarations
 */
export function getThemeCSS(theme) {
  if (!theme?.variables) return '';

  const lines = Object.entries(theme.variables)
    .map(([key, value]) => `  ${key}: ${value};`);

  return `:root {\n${lines.join('\n')}\n}`;
}

/**
 * Apply theme to document
 * @param {CustomTheme} theme - Theme to apply
 */
export function applyCustomTheme(theme) {
  if (!theme?.variables) return;

  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(key, value);
  }

  // Set theme attribute for CSS selectors
  document.body.setAttribute('data-theme', theme.id);

  safeLog(`CustomThemes: Applied theme "${theme.name}"`);
}

export default {
  getCustomThemes,
  getCustomTheme,
  createCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  exportTheme,
  importTheme,
  duplicateTheme,
  validateTheme,
  isValidColor,
  getThemeCSS,
  applyCustomTheme,
  THEME_VARIABLES,
  DEFAULT_THEME_TEMPLATE,
  THEME_SCHEMA_VERSION
};
