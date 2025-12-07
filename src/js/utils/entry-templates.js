/**
 * @fileoverview Entry Templates
 * Predefined templates for common sites and services
 *
 * @version 2.6.8
 */

/**
 * @typedef {Object} EntryTemplate
 * @property {string} id - Unique template identifier
 * @property {string} name - Display name
 * @property {string} icon - Emoji icon
 * @property {string} category - Category (social, finance, email, etc.)
 * @property {string} type - Entry type (login, card, identity)
 * @property {Object} data - Default data values
 * @property {string} [data.url] - Default URL
 * @property {string} [data.username] - Default username placeholder
 * @property {boolean} [suggestTotp] - Suggest enabling TOTP
 */

export const ENTRY_TEMPLATES = [
  // ==================== SOCIAL ====================
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://accounts.google.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://www.facebook.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://www.instagram.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://twitter.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://www.linkedin.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://www.tiktok.com',
      username: ''
    },
    suggestTotp: false
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://discord.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🟠',
    category: 'social',
    type: 'login',
    data: {
      url: 'https://www.reddit.com',
      username: ''
    },
    suggestTotp: true
  },

  // ==================== EMAIL ====================
  {
    id: 'outlook',
    name: 'Outlook / Microsoft',
    icon: '📧',
    category: 'email',
    type: 'login',
    data: {
      url: 'https://outlook.live.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    icon: '📬',
    category: 'email',
    type: 'login',
    data: {
      url: 'https://mail.yahoo.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'protonmail',
    name: 'ProtonMail',
    icon: '🔒',
    category: 'email',
    type: 'login',
    data: {
      url: 'https://mail.proton.me',
      username: ''
    },
    suggestTotp: true
  },

  // ==================== SHOPPING ====================
  {
    id: 'amazon',
    name: 'Amazon',
    icon: '📦',
    category: 'shopping',
    type: 'login',
    data: {
      url: 'https://www.amazon.fr',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'ebay',
    name: 'eBay',
    icon: '🛒',
    category: 'shopping',
    type: 'login',
    data: {
      url: 'https://www.ebay.fr',
      username: ''
    },
    suggestTotp: false
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    icon: '🛍️',
    category: 'shopping',
    type: 'login',
    data: {
      url: 'https://www.aliexpress.com',
      username: ''
    },
    suggestTotp: false
  },

  // ==================== FINANCE ====================
  {
    id: 'paypal',
    name: 'PayPal',
    icon: '💰',
    category: 'finance',
    type: 'login',
    data: {
      url: 'https://www.paypal.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'bank-generic',
    name: 'Banque (générique)',
    icon: '🏦',
    category: 'finance',
    type: 'login',
    data: {
      url: '',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'credit-card',
    name: 'Carte bancaire',
    icon: '💳',
    category: 'finance',
    type: 'card',
    data: {
      holder: '',
      number: '',
      expiry: '',
      cvv: ''
    },
    suggestTotp: false
  },

  // ==================== STREAMING ====================
  {
    id: 'netflix',
    name: 'Netflix',
    icon: '🎬',
    category: 'streaming',
    type: 'login',
    data: {
      url: 'https://www.netflix.com',
      username: ''
    },
    suggestTotp: false
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🎧',
    category: 'streaming',
    type: 'login',
    data: {
      url: 'https://www.spotify.com',
      username: ''
    },
    suggestTotp: false
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    icon: '🏰',
    category: 'streaming',
    type: 'login',
    data: {
      url: 'https://www.disneyplus.com',
      username: ''
    },
    suggestTotp: false
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    category: 'streaming',
    type: 'login',
    data: {
      url: 'https://www.youtube.com',
      username: ''
    },
    suggestTotp: true // Same as Google
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: '🟣',
    category: 'streaming',
    type: 'login',
    data: {
      url: 'https://www.twitch.tv',
      username: ''
    },
    suggestTotp: true
  },

  // ==================== GAMING ====================
  {
    id: 'steam',
    name: 'Steam',
    icon: '🎮',
    category: 'gaming',
    type: 'login',
    data: {
      url: 'https://store.steampowered.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'epic-games',
    name: 'Epic Games',
    icon: '🎯',
    category: 'gaming',
    type: 'login',
    data: {
      url: 'https://www.epicgames.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'playstation',
    name: 'PlayStation Network',
    icon: '🎮',
    category: 'gaming',
    type: 'login',
    data: {
      url: 'https://www.playstation.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'xbox',
    name: 'Xbox Live',
    icon: '🟢',
    category: 'gaming',
    type: 'login',
    data: {
      url: 'https://www.xbox.com',
      username: ''
    },
    suggestTotp: true
  },

  // ==================== DEV / WORK ====================
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://github.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://gitlab.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    icon: '🪣',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://bitbucket.org',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'aws',
    name: 'Amazon AWS',
    icon: '☁️',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://aws.amazon.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    icon: '🔷',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://portal.azure.com',
      username: ''
    },
    suggestTotp: true
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    category: 'dev',
    type: 'login',
    data: {
      url: 'https://slack.com',
      username: ''
    },
    suggestTotp: true
  },

  // ==================== OTHER ====================
  {
    id: 'wifi',
    name: 'WiFi',
    icon: '📶',
    category: 'other',
    type: 'login',
    data: {
      url: '',
      username: '' // SSID
    },
    suggestTotp: false
  },
  {
    id: 'identity-card',
    name: 'Carte d\'identité',
    icon: '🪪',
    category: 'other',
    type: 'identity',
    data: {
      fullName: '',
      email: '',
      phone: ''
    },
    suggestTotp: false
  },
  {
    id: 'custom',
    name: 'Personnalisé',
    icon: '✏️',
    category: 'other',
    type: 'login',
    data: {
      url: '',
      username: ''
    },
    suggestTotp: false
  }
];

// Categories for grouping templates
export const TEMPLATE_CATEGORIES = [
  { id: 'social', name: 'Réseaux sociaux', icon: '👥' },
  { id: 'email', name: 'Email', icon: '📧' },
  { id: 'shopping', name: 'Shopping', icon: '🛒' },
  { id: 'finance', name: 'Finance', icon: '💰' },
  { id: 'streaming', name: 'Streaming', icon: '🎬' },
  { id: 'gaming', name: 'Jeux', icon: '🎮' },
  { id: 'dev', name: 'Dev / Travail', icon: '💻' },
  { id: 'other', name: 'Autre', icon: '📁' }
];

/**
 * Get template by ID
 * @param {string} id
 * @returns {EntryTemplate|null}
 */
export function getTemplateById(id) {
  return ENTRY_TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Get templates by category
 * @param {string} category
 * @returns {EntryTemplate[]}
 */
export function getTemplatesByCategory(category) {
  return ENTRY_TEMPLATES.filter(t => t.category === category);
}

/**
 * Search templates
 * @param {string} query
 * @returns {EntryTemplate[]}
 */
export function searchTemplates(query) {
  const q = query.toLowerCase();
  return ENTRY_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.id.toLowerCase().includes(q)
  );
}

/**
 * Get grouped templates by category
 * @returns {Map<string, EntryTemplate[]>}
 */
export function getGroupedTemplates() {
  const grouped = new Map();
  for (const cat of TEMPLATE_CATEGORIES) {
    grouped.set(cat.id, getTemplatesByCategory(cat.id));
  }
  return grouped;
}

export default {
  ENTRY_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateById,
  getTemplatesByCategory,
  searchTemplates,
  getGroupedTemplates
};
