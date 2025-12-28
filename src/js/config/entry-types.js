/**
 * @fileoverview Entry Types Configuration
 * Defines vault entry types with icons, labels, and colors
 */

import { t } from '../utils/i18n.js';

/**
 * Get entry types with translated labels
 * @returns {Object} Entry types configuration
 */
export const getEntryTypes = () => ({
  login: { icon: '🔑', label: t('vault.detail.login'), color: '#60a5fa' },
  note: { icon: '📝', label: t('vault.detail.secureNote'), color: '#fbbf24' },
  card: { icon: '💳', label: t('vault.detail.creditCard'), color: '#f472b6' },
  identity: { icon: '👤', label: t('vault.detail.identity'), color: '#a78bfa' },
  ssh: { icon: '🔐', label: t('vault.detail.sshKey'), color: '#34d399' },
  preset: { icon: '⚙️', label: t('vault.detail.preset'), color: '#94a3b8' }
});

/**
 * Static entry types (for backward compatibility)
 */
export const ENTRY_TYPES = getEntryTypes();
