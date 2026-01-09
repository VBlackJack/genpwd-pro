/**
 * @fileoverview Entry Templates Module
 * Pre-defined templates for quick entry creation
 */

import { t } from '../../utils/i18n.js';

/**
 * Simple debounce utility for input handlers
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Template category IDs with icons (static data)
 */
const TEMPLATE_CATEGORY_DATA = [
  { id: 'social', icon: '👥' },
  { id: 'email', icon: '📧' },
  { id: 'shopping', icon: '🛒' },
  { id: 'finance', icon: '💰' },
  { id: 'streaming', icon: '🎬' },
  { id: 'gaming', icon: '🎮' },
  { id: 'dev', icon: '💻' },
  { id: 'other', icon: '📁' }
];

/**
 * Get translated template categories
 * @returns {Array<{id: string, name: string, icon: string}>}
 */
export function getTemplateCategories() {
  return TEMPLATE_CATEGORY_DATA.map(cat => ({
    ...cat,
    name: t(`vault.templateCategories.${cat.id}`)
  }));
}

/**
 * Template categories (legacy export for compatibility)
 * @deprecated Use getTemplateCategories() for translated names
 */
export const TEMPLATE_CATEGORIES = TEMPLATE_CATEGORY_DATA;

/**
 * Entry templates data
 * @type {Array<{id: string, name: string, icon: string, category: string, type: string, url: string, suggestTotp: boolean}>}
 */
export const ENTRY_TEMPLATES = [
  // Social
  { id: 'google', name: 'Google', icon: '🔵', category: 'social', type: 'login', url: 'https://accounts.google.com', suggestTotp: true },
  { id: 'facebook', name: 'Facebook', icon: '📘', category: 'social', type: 'login', url: 'https://www.facebook.com', suggestTotp: true },
  { id: 'instagram', name: 'Instagram', icon: '📷', category: 'social', type: 'login', url: 'https://www.instagram.com', suggestTotp: true },
  { id: 'twitter', name: 'X (Twitter)', icon: '🐦', category: 'social', type: 'login', url: 'https://twitter.com', suggestTotp: true },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', category: 'social', type: 'login', url: 'https://www.linkedin.com', suggestTotp: true },
  { id: 'discord', name: 'Discord', icon: '🎮', category: 'social', type: 'login', url: 'https://discord.com', suggestTotp: true },
  { id: 'reddit', name: 'Reddit', icon: '🟠', category: 'social', type: 'login', url: 'https://www.reddit.com', suggestTotp: true },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', category: 'social', type: 'login', url: 'https://www.tiktok.com', suggestTotp: true },
  { id: 'snapchat', name: 'Snapchat', icon: '👻', category: 'social', type: 'login', url: 'https://www.snapchat.com', suggestTotp: true },
  { id: 'pinterest', name: 'Pinterest', icon: '📌', category: 'social', type: 'login', url: 'https://www.pinterest.com', suggestTotp: false },

  // Email
  { id: 'outlook', name: 'Outlook', icon: '📧', category: 'email', type: 'login', url: 'https://outlook.live.com', suggestTotp: true },
  { id: 'protonmail', name: 'ProtonMail', icon: '🔒', category: 'email', type: 'login', url: 'https://mail.proton.me', suggestTotp: true },
  { id: 'gmail', name: 'Gmail', icon: '✉️', category: 'email', type: 'login', url: 'https://mail.google.com', suggestTotp: true },
  { id: 'yahoo', name: 'Yahoo Mail', icon: '📨', category: 'email', type: 'login', url: 'https://mail.yahoo.com', suggestTotp: true },
  { id: 'icloud', name: 'iCloud Mail', icon: '☁️', category: 'email', type: 'login', url: 'https://www.icloud.com/mail', suggestTotp: true },

  // Shopping
  { id: 'amazon', name: 'Amazon', icon: '📦', category: 'shopping', type: 'login', url: 'https://www.amazon.fr', suggestTotp: true },
  { id: 'ebay', name: 'eBay', icon: '🛒', category: 'shopping', type: 'login', url: 'https://www.ebay.fr', suggestTotp: false },
  { id: 'aliexpress', name: 'AliExpress', icon: '🏪', category: 'shopping', type: 'login', url: 'https://www.aliexpress.com', suggestTotp: false },
  { id: 'etsy', name: 'Etsy', icon: '🎨', category: 'shopping', type: 'login', url: 'https://www.etsy.com', suggestTotp: true },

  // Finance
  { id: 'paypal', name: 'PayPal', icon: '💰', category: 'finance', type: 'login', url: 'https://www.paypal.com', suggestTotp: true },
  { id: 'bank', nameKey: 'bank', icon: '🏦', category: 'finance', type: 'login', url: '', suggestTotp: true },
  { id: 'card', nameKey: 'card', icon: '💳', category: 'finance', type: 'card', url: '', suggestTotp: false },
  { id: 'crypto', nameKey: 'cryptoWallet', icon: '₿', category: 'finance', type: 'login', url: '', suggestTotp: true },
  { id: 'revolut', name: 'Revolut', icon: '💸', category: 'finance', type: 'login', url: 'https://www.revolut.com', suggestTotp: true },

  // Streaming
  { id: 'netflix', name: 'Netflix', icon: '🎬', category: 'streaming', type: 'login', url: 'https://www.netflix.com', suggestTotp: false },
  { id: 'spotify', name: 'Spotify', icon: '🎧', category: 'streaming', type: 'login', url: 'https://www.spotify.com', suggestTotp: false },
  { id: 'disney', name: 'Disney+', icon: '🏰', category: 'streaming', type: 'login', url: 'https://www.disneyplus.com', suggestTotp: false },
  { id: 'twitch', name: 'Twitch', icon: '🟣', category: 'streaming', type: 'login', url: 'https://www.twitch.tv', suggestTotp: true },
  { id: 'youtube', name: 'YouTube', icon: '▶️', category: 'streaming', type: 'login', url: 'https://www.youtube.com', suggestTotp: true },
  { id: 'prime', name: 'Prime Video', icon: '📺', category: 'streaming', type: 'login', url: 'https://www.primevideo.com', suggestTotp: true },
  { id: 'hbo', name: 'HBO Max', icon: '🎭', category: 'streaming', type: 'login', url: 'https://www.max.com', suggestTotp: false },
  { id: 'apple-music', name: 'Apple Music', icon: '🎵', category: 'streaming', type: 'login', url: 'https://music.apple.com', suggestTotp: true },

  // Gaming
  { id: 'steam', name: 'Steam', icon: '🎮', category: 'gaming', type: 'login', url: 'https://store.steampowered.com', suggestTotp: true },
  { id: 'epic', name: 'Epic Games', icon: '🎯', category: 'gaming', type: 'login', url: 'https://www.epicgames.com', suggestTotp: true },
  { id: 'playstation', name: 'PlayStation', icon: '🎮', category: 'gaming', type: 'login', url: 'https://www.playstation.com', suggestTotp: true },
  { id: 'xbox', name: 'Xbox', icon: '🟢', category: 'gaming', type: 'login', url: 'https://www.xbox.com', suggestTotp: true },
  { id: 'nintendo', name: 'Nintendo', icon: '🍄', category: 'gaming', type: 'login', url: 'https://www.nintendo.com', suggestTotp: true },
  { id: 'battlenet', name: 'Battle.net', icon: '⚔️', category: 'gaming', type: 'login', url: 'https://battle.net', suggestTotp: true },
  { id: 'ubisoft', name: 'Ubisoft', icon: '🎲', category: 'gaming', type: 'login', url: 'https://www.ubisoft.com', suggestTotp: true },
  { id: 'ea', name: 'EA / Origin', icon: '🏈', category: 'gaming', type: 'login', url: 'https://www.ea.com', suggestTotp: true },

  // Dev
  { id: 'github', name: 'GitHub', icon: '🐙', category: 'dev', type: 'login', url: 'https://github.com', suggestTotp: true },
  { id: 'gitlab', name: 'GitLab', icon: '🦊', category: 'dev', type: 'login', url: 'https://gitlab.com', suggestTotp: true },
  { id: 'bitbucket', name: 'Bitbucket', icon: '🪣', category: 'dev', type: 'login', url: 'https://bitbucket.org', suggestTotp: true },
  { id: 'aws', name: 'AWS', icon: '☁️', category: 'dev', type: 'login', url: 'https://aws.amazon.com', suggestTotp: true },
  { id: 'azure', name: 'Azure', icon: '🔷', category: 'dev', type: 'login', url: 'https://azure.microsoft.com', suggestTotp: true },
  { id: 'gcp', name: 'Google Cloud', icon: '🌐', category: 'dev', type: 'login', url: 'https://console.cloud.google.com', suggestTotp: true },
  { id: 'slack', name: 'Slack', icon: '💬', category: 'dev', type: 'login', url: 'https://slack.com', suggestTotp: true },
  { id: 'jira', name: 'Jira', icon: '📋', category: 'dev', type: 'login', url: 'https://www.atlassian.com/jira', suggestTotp: true },
  { id: 'npm', name: 'NPM', icon: '📦', category: 'dev', type: 'login', url: 'https://www.npmjs.com', suggestTotp: true },
  { id: 'docker', name: 'Docker Hub', icon: '🐳', category: 'dev', type: 'login', url: 'https://hub.docker.com', suggestTotp: true },
  { id: 'vercel', name: 'Vercel', icon: '▲', category: 'dev', type: 'login', url: 'https://vercel.com', suggestTotp: true },
  { id: 'netlify', name: 'Netlify', icon: '🌿', category: 'dev', type: 'login', url: 'https://www.netlify.com', suggestTotp: true },

  // Other
  { id: 'wifi', name: 'WiFi', icon: '📶', category: 'other', type: 'login', url: '', suggestTotp: false },
  { id: 'identity', name: 'Identity', icon: '🪪', category: 'other', type: 'identity', url: '', suggestTotp: false },
  { id: 'secure-note', name: 'Secure Note', icon: '📝', category: 'other', type: 'note', url: '', suggestTotp: false },
  { id: 'server', name: 'Server / SSH', icon: '🖥️', category: 'other', type: 'login', url: '', suggestTotp: false },
  { id: 'database', name: 'Database', icon: '🗄️', category: 'other', type: 'login', url: '', suggestTotp: false },
  { id: 'api-key', name: 'API Key', icon: '🔑', category: 'other', type: 'note', url: '', suggestTotp: false },
  { id: 'license', name: 'Software License', icon: '📜', category: 'other', type: 'note', url: '', suggestTotp: false },
  { id: 'custom', name: 'Custom', icon: '✏️', category: 'other', type: 'login', url: '', suggestTotp: false }
];

/**
 * Get template display name (handles nameKey translation)
 * @param {Object} template - Template object
 * @returns {string} Display name
 */
function getTemplateName(template) {
  if (template.nameKey) {
    return t(`vault.templateNames.${template.nameKey}`);
  }
  return template.name;
}

/**
 * Get all templates with translated names
 * @returns {Array} Templates array
 */
export function getTemplates() {
  return ENTRY_TEMPLATES.map(tpl => ({
    ...tpl,
    name: getTemplateName(tpl)
  }));
}

/**
 * Get template by ID with translated name
 * @param {string} templateId - Template ID
 * @returns {Object|undefined} Template object
 */
export function getTemplateById(templateId) {
  const tpl = ENTRY_TEMPLATES.find(tpl => tpl.id === templateId);
  if (!tpl) return undefined;
  return { ...tpl, name: getTemplateName(tpl) };
}

/**
 * Get templates by category with translated names
 * @param {string} categoryId - Category ID
 * @returns {Array} Templates in category
 */
export function getTemplatesByCategory(categoryId) {
  return ENTRY_TEMPLATES
    .filter(tpl => tpl.category === categoryId)
    .map(tpl => ({ ...tpl, name: getTemplateName(tpl) }));
}

/**
 * Search templates by name
 * @param {string} query - Search query
 * @returns {Array} Matching templates
 */
export function searchTemplates(query) {
  const q = query.toLowerCase().trim();
  const templates = getTemplates();
  if (!q) return templates;
  return templates.filter(tpl => tpl.name.toLowerCase().includes(q));
}

/**
 * Render template item
 * @param {Object} template - Template object
 * @returns {string} HTML string
 */
export function renderTemplateItem(template) {
  return `
    <button type="button" class="vault-template-item" data-template-id="${template.id}" title="${template.name}" role="option">
      <span class="vault-template-icon" aria-hidden="true">${template.icon}</span>
      <span class="vault-template-name">${template.name}</span>
    </button>
  `;
}

/**
 * Render template category
 * @param {Object} category - Category object
 * @param {Array} templates - Templates in category
 * @returns {string} HTML string
 */
export function renderTemplateCategory(category, templates) {
  if (templates.length === 0) return '';

  return `
    <div class="vault-template-category" data-category="${category.id}">
      <div class="vault-template-category-header">${category.icon} ${category.name}</div>
      <div class="vault-template-items" role="listbox">
        ${templates.map(renderTemplateItem).join('')}
      </div>
    </div>
  `;
}

/**
 * Render template grid
 * @param {Object} options
 * @param {Array} options.templates - Templates to render (default: all translated)
 * @param {Array} options.categories - Categories to use (default: all translated)
 * @returns {string} HTML string
 */
export function renderTemplateGrid(options = {}) {
  const {
    templates = getTemplates(),
    categories = getTemplateCategories()
  } = options;

  return categories.map(cat => {
    const catTemplates = templates.filter(tpl => tpl.category === cat.id);
    return renderTemplateCategory(cat, catTemplates);
  }).join('');
}

/**
 * Render template picker section
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderTemplatePicker(options = {}) {
  const { t = (k) => k } = options;

  return `
    <div class="vault-template-section">
      <button type="button" class="vault-template-toggle" id="toggle-templates" aria-expanded="false" aria-controls="template-picker">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        ${t('vault.labels.useTemplate')}
        <svg class="vault-template-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div class="vault-template-picker" id="template-picker" hidden>
        <input type="text" class="vault-input vault-template-search" id="template-search" placeholder="${t('vault.placeholders.searchTemplate')}">
        <div class="vault-template-grid" id="template-grid">
          ${renderTemplateGrid()}
        </div>
      </div>
    </div>
  `;
}

/**
 * Create template picker controller
 * @param {Object} options
 * @param {Function} options.onTemplateSelected - Callback when template is selected
 * @param {Function} options.onTypeChange - Callback to update entry type
 * @param {Function} options.t - Translation function
 * @returns {Object} Controller with attach/detach methods
 */
export function createTemplatePickerController(options = {}) {
  const { onTemplateSelected, onTypeChange, t = (k) => k } = options;

  let isAttached = false;

  /**
   * Toggle template picker visibility
   */
  function togglePicker() {
    const picker = document.getElementById('template-picker');
    const toggle = document.getElementById('toggle-templates');
    if (!picker || !toggle) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    picker.hidden = isExpanded;
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    toggle.querySelector('.vault-template-chevron').style.transform = isExpanded ? '' : 'rotate(180deg)';

    // Focus search when opening
    if (!isExpanded) {
      document.getElementById('template-search')?.focus();
    }
  }

  /**
   * Filter templates by search query
   * @param {string} query - Search query
   */
  function filterTemplates(query) {
    const q = query.toLowerCase().trim();

    document.querySelectorAll('.vault-template-item').forEach(item => {
      const name = item.querySelector('.vault-template-name')?.textContent.toLowerCase() || '';
      item.style.display = !q || name.includes(q) ? '' : 'none';
    });

    // Hide empty categories
    document.querySelectorAll('.vault-template-category').forEach(cat => {
      const hasVisible = cat.querySelector('.vault-template-item:not([style*="display: none"])');
      cat.style.display = hasVisible ? '' : 'none';
    });
  }

  /**
   * Apply a template to the form
   * @param {string} templateId - Template ID
   */
  function applyTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return;

    // Set entry type
    const typeRadio = document.querySelector(`input[name="entry-type"][value="${template.type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
      if (onTypeChange) onTypeChange(template.type);
    }

    // Set title
    const titleInput = document.getElementById('entry-title');
    if (titleInput && template.name !== 'Custom') {
      titleInput.value = template.name;
    }

    // Wait for type fields to render, then set URL
    setTimeout(() => {
      if (template.url) {
        const urlInput = document.getElementById('entry-url');
        if (urlInput) urlInput.value = template.url;
      }

      // Show TOTP hint if suggested
      if (template.suggestTotp) {
        const totpField = document.getElementById('entry-totp');
        if (totpField) {
          totpField.placeholder = t('vault.hints.totpRecommended');
        }
      }
    }, 50);

    // Close picker
    const picker = document.getElementById('template-picker');
    const toggle = document.getElementById('toggle-templates');
    if (picker) picker.hidden = true;
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.vault-template-chevron').style.transform = '';
    }

    // Highlight selected template briefly
    document.querySelectorAll('.vault-template-item').forEach(item => item.classList.remove('selected'));
    const selectedItem = document.querySelector(`.vault-template-item[data-template-id="${templateId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }

    // Callback
    if (onTemplateSelected) onTemplateSelected(template);
  }

  /**
   * Attach event listeners
   */
  function attach() {
    if (isAttached) return;

    // Toggle button
    document.getElementById('toggle-templates')?.addEventListener('click', togglePicker);

    // Search input with debounce to prevent excessive DOM updates
    const debouncedFilter = debounce((value) => filterTemplates(value), 150);
    document.getElementById('template-search')?.addEventListener('input', (e) => {
      debouncedFilter(e.target.value);
    });

    // Template items
    document.querySelectorAll('.vault-template-item').forEach(item => {
      item.addEventListener('click', () => {
        const templateId = item.dataset.templateId;
        if (templateId) applyTemplate(templateId);
      });
    });

    isAttached = true;
  }

  /**
   * Detach event listeners (for cleanup)
   */
  function detach() {
    // Note: Would need to store handlers for proper cleanup
    isAttached = false;
  }

  return {
    attach,
    detach,
    togglePicker,
    filterTemplates,
    applyTemplate
  };
}
