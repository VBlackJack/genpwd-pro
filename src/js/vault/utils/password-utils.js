/**
 * @fileoverview Vault Password Utilities
 * Password strength calculation and generation
 */

/**
 * Get simple password strength level
 * @param {string} password - Password to check
 * @returns {'weak'|'medium'|'strong'|null} Strength level
 */
export function getPasswordStrength(password) {
  if (!password) return null;

  const len = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  // Minimum 12 chars + 3 char types = strong
  // Minimum 12 chars + 2 char types = medium
  // Below 12 chars = weak
  if (len >= 16 && variety >= 3) return 'strong';
  if (len >= 12 && variety >= 3) return 'strong';
  if (len >= 12 && variety >= 2) return 'medium';
  return 'weak';
}

/**
 * Calculate detailed password strength
 * @param {string} password - Password to analyze
 * @param {Function} t - Translation function (optional)
 * @returns {{level: string, label: string, percent: number, icon: string}}
 */
export function calculatePasswordStrength(password, t = null) {
  if (!password) return { level: 'none', label: '', percent: 0, icon: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Labels with i18n support
  const labels = t ? {
    weak: t('vault.detail.weak'),
    fair: t('vault.detail.fair'),
    good: t('vault.detail.good'),
    excellent: t('vault.detail.excellent')
  } : {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    excellent: 'Excellent'
  };

  const levels = [
    { level: 'weak', label: labels.weak, percent: 25 },
    { level: 'weak', label: labels.weak, percent: 25 },
    { level: 'fair', label: labels.fair, percent: 50 },
    { level: 'fair', label: labels.fair, percent: 50 },
    { level: 'good', label: labels.good, percent: 75 },
    { level: 'good', label: labels.good, percent: 75 },
    { level: 'strong', label: labels.good, percent: 100 },
    { level: 'strong', label: labels.excellent, percent: 100 }
  ];

  const result = levels[score] || levels[0];
  result.icon = getStrengthIcon(result.level);
  return result;
}

/**
 * Get SVG icon for password strength level
 * Provides visual redundancy for colorblind users
 * @param {string} level - Strength level (weak, fair, good, strong)
 * @returns {string} SVG icon HTML
 */
export function getStrengthIcon(level) {
  const icons = {
    weak: `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,
    fair: `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>`,
    good: `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
    strong: `<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <polyline points="9 12 11 14 15 10"></polyline>
    </svg>`
  };
  return icons[level] || '';
}

/**
 * Generate a random password
 * @param {Object} options - Generation options
 * @param {number} options.length - Password length (default: 20)
 * @param {boolean} options.uppercase - Include uppercase (default: true)
 * @param {boolean} options.lowercase - Include lowercase (default: true)
 * @param {boolean} options.numbers - Include numbers (default: true)
 * @param {boolean} options.symbols - Include symbols (default: true)
 * @returns {string} Generated password
 */
export function generatePassword(options = {}) {
  const {
    length = 20,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;

  let chars = '';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%&*_+-=.?';

  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, n => chars[n % chars.length]).join('');
}

/**
 * Calculate password age in days
 * @param {string|Date} modifiedAt - Last modification date
 * @returns {number} Age in days
 */
export function getPasswordAgeDays(modifiedAt) {
  if (!modifiedAt) return 0;
  const modified = new Date(modifiedAt);
  const now = new Date();
  return Math.floor((now - modified) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a password is duplicated across entries
 * @param {string} password - Password to check
 * @param {string} currentEntryId - Current entry ID to exclude
 * @param {Array} entries - All entries to check against
 * @returns {boolean} True if duplicated
 */
export function isPasswordDuplicated(password, currentEntryId, entries) {
  if (!password || !entries) return false;
  return entries.some(e =>
    e.id !== currentEntryId &&
    e.type === 'login' &&
    e.data?.password === password
  );
}

/**
 * Get password expiration status
 * @param {Object} entry - Entry to check
 * @param {Function} t - Translation function (optional)
 * @returns {{status: string, badge: string, daysLeft: number|null, label: string}}
 */
export function getExpiryStatus(entry, t = null) {
  const noExpiry = { status: 'none', badge: '', daysLeft: null, label: '' };

  if (entry.type !== 'login' || !entry.data?.expiresAt) {
    return noExpiry;
  }

  const expiresAt = new Date(entry.data.expiresAt);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  expiresAt.setHours(0, 0, 0, 0);

  const diffMs = expiresAt - now;
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Helper for translatable labels
  const getExpiredLabel = (days) => {
    if (t) return t('vault.expiry.expired', { days });
    return `Expired ${days} day${days > 1 ? 's' : ''} ago`;
  };
  const getExpiresTodayLabel = () => {
    if (t) return t('vault.expiry.expiresToday');
    return 'Expires today';
  };
  const getExpiresInLabel = (days) => {
    if (t) return t('vault.expiry.expiresIn', { days });
    return `Expires in ${days} day${days > 1 ? 's' : ''}`;
  };
  const getExpiresOnLabel = (date) => {
    if (t) return t('vault.expiry.expiresOn', { date: date.toLocaleDateString() });
    return `Expires on ${date.toLocaleDateString('en-US')}`;
  };

  if (daysLeft < 0) {
    // Expired
    const daysAgo = Math.abs(daysLeft);
    const label = getExpiredLabel(daysAgo);
    return {
      status: 'expired',
      badge: `<span class="vault-expiry-badge expired" title="${label}" role="img" aria-label="${label}"><span aria-hidden="true">⚠️</span></span>`,
      daysLeft,
      label
    };
  } else if (daysLeft === 0) {
    // Expires today
    const label = getExpiresTodayLabel();
    return {
      status: 'today',
      badge: `<span class="vault-expiry-badge today" title="${label}" role="img" aria-label="${label}"><span aria-hidden="true">⏰</span></span>`,
      daysLeft: 0,
      label
    };
  } else if (daysLeft <= 7) {
    // Expires within a week
    const label = getExpiresInLabel(daysLeft);
    return {
      status: 'soon',
      badge: `<span class="vault-expiry-badge soon" title="${label}" role="img" aria-label="${label}"><span aria-hidden="true">🕐</span></span>`,
      daysLeft,
      label
    };
  } else if (daysLeft <= 30) {
    // Expires within a month
    const label = getExpiresInLabel(daysLeft);
    return {
      status: 'warning',
      badge: `<span class="vault-expiry-badge warning" title="${label}" role="img" aria-label="${label}"><span aria-hidden="true">📅</span></span>`,
      daysLeft,
      label
    };
  }

  // Valid, not expiring soon
  return {
    status: 'valid',
    badge: '',
    daysLeft,
    label: getExpiresOnLabel(expiresAt)
  };
}
