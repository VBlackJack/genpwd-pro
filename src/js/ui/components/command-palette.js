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
 * Command Palette Component - BMAD Phase 5
 * Quick access to commands via Ctrl+K
 */

import { t } from '../../utils/i18n.js';
import { applyQuickPreset } from './quick-presets.js';
import { statsModal } from '../modals/stats-modal.js';
import { cycleTheme } from '../../utils/theme-manager.js';


/**
 * Available commands in the palette
 */
const COMMANDS = [
  {
    id: 'generate',
    icon: '⚡',
    shortcut: 'Alt+G',
    action: () => document.getElementById('btn-generate')?.click()
  },
  {
    id: 'copyAll',
    icon: '📋',
    shortcut: 'Alt+C',
    action: () => document.getElementById('btn-copy-all')?.click()
  },
  {
    id: 'clear',
    icon: '🗑️',
    shortcut: null,
    action: () => document.getElementById('btn-clear')?.click()
  },
  {
    id: 'stats',
    icon: '📊',
    shortcut: null,
    action: () => statsModal.show()
  },
  {
    id: 'presetStrong',
    icon: '🛡️',
    shortcut: null,
    action: () => applyQuickPreset('strong')
  },
  {
    id: 'presetSimple',
    icon: '💬',
    shortcut: null,
    action: () => applyQuickPreset('simple')
  },
  {
    id: 'presetMaximum',
    icon: '🔐',
    shortcut: null,
    action: () => applyQuickPreset('maximum')
  },
  {
    id: 'presetApiKey',
    icon: '🔑',
    shortcut: null,
    action: () => applyQuickPreset('apiKey')
  },
  {
    id: 'presetBanking',
    icon: '🏦',
    shortcut: null,
    action: () => applyQuickPreset('banking')
  },
  {
    id: 'theme',
    icon: '🎨',
    shortcut: null,
    action: () => cycleTheme()
  },
  {
    id: 'vault',
    icon: '🔒',
    shortcut: null,
    action: () => {
      const vaultTab = document.querySelector('[data-tab="vault"]');
      vaultTab?.click();
    }
  },
  {
    id: 'help',
    icon: '❓',
    shortcut: 'F1',
    action: () => {
      const helpSection = document.querySelector('.contextual-help');
      if (helpSection) {
        helpSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
];

/** Command palette state */
let isOpen = false;
let selectedIndex = 0;
let filteredCommands = [...COMMANDS];
let paletteElement = null;

/**
 * Fuzzy match a query against text
 * @param {string} query - Search query
 * @param {string} text - Text to search in
 * @returns {boolean} Whether there's a match
 */
function fuzzyMatch(query, text) {
  if (!query) return true;
  const pattern = query.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(pattern, 'i').test(text);
}

/**
 * Filter commands based on search query
 * @param {string} query - Search query
 */
function filterCommands(query) {
  filteredCommands = COMMANDS.filter(cmd => {
    const label = t(`commandPalette.commands.${cmd.id}`);
    return fuzzyMatch(query, label) || fuzzyMatch(query, cmd.id);
  });
  selectedIndex = 0;
  renderCommandList();
}

/**
 * Render the command list
 */
function renderCommandList() {
  const listEl = paletteElement?.querySelector('.command-list');
  if (!listEl) return;

  if (filteredCommands.length === 0) {
    listEl.innerHTML = `<div class="command-empty">${t('commandPalette.noResults')}</div>`;
    return;
  }

  listEl.innerHTML = filteredCommands.map((cmd, idx) => {
    const label = t(`commandPalette.commands.${cmd.id}`);
    const isSelected = idx === selectedIndex;
    return `
      <button type="button"
              class="command-item ${isSelected ? 'selected' : ''}"
              data-command="${cmd.id}"
              data-index="${idx}"
              role="option"
              aria-selected="${isSelected}">
        <span class="command-icon" aria-hidden="true">${cmd.icon}</span>
        <span class="command-label">${label}</span>
        ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
      </button>
    `;
  }).join('');
}

/**
 * Execute the selected command
 */
function executeSelected() {
  const cmd = filteredCommands[selectedIndex];
  if (cmd) {
    hide();
    cmd.action();
  }
}

/**
 * Handle keyboard navigation
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
  if (!isOpen) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % Math.max(1, filteredCommands.length);
      renderCommandList();
      break;

    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length);
      renderCommandList();
      break;

    case 'Enter':
      e.preventDefault();
      executeSelected();
      break;

    case 'Escape':
      e.preventDefault();
      hide();
      break;
  }
}

/**
 * Create the command palette element
 */
function createPaletteElement() {
  const overlay = document.createElement('div');
  overlay.id = 'command-palette';
  overlay.className = 'command-palette-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="command-palette" role="dialog" aria-modal="true" aria-label="${t('commandPalette.title')}">
      <input type="text"
             class="command-search"
             id="command-search-input"
             placeholder="${t('commandPalette.placeholder')}"
             autocomplete="off"
             spellcheck="false"
             aria-label="${t('commandPalette.placeholder')}">
      <div class="command-list" role="listbox" aria-label="${t('commandPalette.title')}">
        <!-- Commands rendered here -->
      </div>
      <div class="command-footer">
        <span class="command-hint">↑↓ ${t('commandPalette.navigate')}</span>
        <span class="command-hint">↵ ${t('commandPalette.select')}</span>
        <span class="command-hint">Esc ${t('commandPalette.close')}</span>
      </div>
    </div>
  `;

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hide();
    }
  });

  // Handle command item clicks
  overlay.addEventListener('click', (e) => {
    const item = e.target.closest('.command-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      selectedIndex = index;
      executeSelected();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Show the command palette
 */
export function show() {
  if (isOpen) return;

  if (!paletteElement) {
    paletteElement = createPaletteElement();
  }

  // Reset state
  filteredCommands = [...COMMANDS];
  selectedIndex = 0;

  // Show palette
  paletteElement.hidden = false;
  paletteElement.classList.add('active');
  isOpen = true;

  // Render initial list
  renderCommandList();

  // Focus search input
  const searchInput = paletteElement.querySelector('.command-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.addEventListener('input', (e) => {
      filterCommands(e.target.value);
    });
    requestAnimationFrame(() => searchInput.focus());
  }

  // Add keyboard handler
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Hide the command palette
 */
export function hide() {
  if (!isOpen) return;

  if (paletteElement) {
    paletteElement.hidden = true;
    paletteElement.classList.remove('active');
  }

  isOpen = false;
  document.removeEventListener('keydown', handleKeyDown);
}

/**
 * Toggle the command palette
 */
export function toggle() {
  if (isOpen) {
    hide();
  } else {
    show();
  }
}

/**
 * Initialize command palette with global keyboard shortcut
 */
export function initCommandPalette() {
  // Global Ctrl+K / Cmd+K handler
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggle();
    }
  });
}

export default {
  show,
  hide,
  toggle,
  initCommandPalette
};
