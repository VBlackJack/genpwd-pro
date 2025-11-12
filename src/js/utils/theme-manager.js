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

// src/js/utils/theme-manager.js - Gestionnaire de thèmes

import { safeLog } from './logger.js';
import { safeGetItem, safeSetItem } from './storage-helper.js';

/**
 * Thèmes disponibles avec leurs variables CSS
 */
const THEMES = {
  dark: {
    name: 'Sombre',
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
    name: 'Clair',
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
    name: 'Contraste Élevé',
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
    name: 'Océan',
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
    name: 'Forêt',
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
let currentTheme = 'dark';

/**
 * Applique un thème à la page
 * @param {string} themeName - Nom du thème à appliquer
 */
export function applyTheme(themeName) {
  const theme = THEMES[themeName];

  if (!theme) {
    safeLog(`Thème inconnu: ${themeName}, fallback vers 'dark'`);
    themeName = 'dark';
  }

  const root = document.documentElement;
  const variables = THEMES[themeName].variables;

  // Appliquer toutes les variables CSS
  Object.entries(variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Sauvegarder le choix
  currentTheme = themeName;
  try {
    safeSetItem(STORAGE_KEY, themeName);
  } catch (e) {
    safeLog('Impossible de sauvegarder le thème dans localStorage');
  }

  // Mettre à jour l'attribut data-theme pour CSS avancé
  document.body.setAttribute('data-theme', themeName);

  safeLog(`Thème appliqué: ${themeName} (${theme.name})`);
}

/**
 * Récupère le thème actuel
 * @returns {string} Nom du thème actuel
 */
export function getCurrentTheme() {
  return currentTheme;
}

/**
 * Récupère tous les thèmes disponibles
 * @returns {Object} Dictionnaire des thèmes
 */
export function getAvailableThemes() {
  return Object.entries(THEMES).map(([id, theme]) => ({
    id,
    name: theme.name,
    icon: theme.icon
  }));
}

/**
 * Charge le thème sauvegardé ou détecte la préférence système
 */
export function loadSavedTheme() {
  let themeName = 'dark'; // Par défaut

  // 1. Vérifier localStorage
  try {
    const saved = safeGetItem(STORAGE_KEY);
    if (saved && THEMES[saved]) {
      themeName = saved;
      safeLog(`Thème chargé depuis localStorage: ${themeName}`);
      applyTheme(themeName);
      return;
    }
  } catch (e) {
    safeLog('Impossible de lire localStorage');
  }

  // 2. Détecter la préférence système
  if (window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    if (prefersHighContrast) {
      themeName = 'high-contrast';
    } else if (prefersLight) {
      themeName = 'light';
    } else if (prefersDark) {
      themeName = 'dark';
    }

    safeLog(`Thème détecté depuis préférences système: ${themeName}`);
  }

  applyTheme(themeName);
}

/**
 * Écoute les changements de préférence système
 */
export function watchSystemThemeChanges() {
  if (!window.matchMedia) return;

  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e) => {
    // Ne changer que si aucun thème n'est explicitement sauvegardé
    try {
      const hasSavedTheme = safeGetItem(STORAGE_KEY);
      if (!hasSavedTheme) {
        applyTheme(e.matches ? 'dark' : 'light');
        safeLog('Thème mis à jour suite au changement système');
      }
    } catch (err) {
      safeLog('Erreur lors du changement de thème système');
    }
  };

  // addEventListener pour les navigateurs modernes
  if (darkModeQuery.addEventListener) {
    darkModeQuery.addEventListener('change', handleChange);
  } else {
    // fallback pour les anciens navigateurs
    darkModeQuery.addListener(handleChange);
  }
}

/**
 * Bascule vers le thème suivant dans la liste
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
 * Initialise le système de thèmes
 */
export function initThemeSystem() {
  loadSavedTheme();
  watchSystemThemeChanges();
  safeLog('Système de thèmes initialisé');
}

/**
 * Crée un sélecteur de thème UI
 * @param {string} containerId - ID du conteneur où insérer le sélecteur
 */
export function createThemeSelector(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    safeLog(`Conteneur ${containerId} introuvable pour le sélecteur de thème`);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'theme-selector';

  const label = document.createElement('span');
  label.textContent = 'Thème:';
  label.className = 'theme-selector-label';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.id = 'theme-select';
  select.className = 'theme-select';

  // Ajouter les options
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

  safeLog('Sélecteur de thème créé');
}
