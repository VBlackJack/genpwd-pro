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
 * @returns {{level: string, label: string, percent: number}}
 */
export function calculatePasswordStrength(password, t = null) {
  if (!password) return { level: 'none', label: '', percent: 0 };

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
    weak: t('vault.detail.weak') || 'Weak',
    fair: t('vault.detail.fair') || 'Fair',
    good: t('vault.detail.good') || 'Good',
    excellent: t('vault.detail.excellent') || 'Excellent'
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

  return levels[score] || levels[0];
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
 * @returns {{status: string, badge: string, daysLeft: number|null, label: string}}
 */
export function getExpiryStatus(entry) {
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

  if (daysLeft < 0) {
    // Expired
    const daysAgo = Math.abs(daysLeft);
    return {
      status: 'expired',
      badge: `<span class="vault-expiry-badge expired" title="Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago" role="img" aria-label="Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago"><span aria-hidden="true">⚠️</span></span>`,
      daysLeft,
      label: `Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`
    };
  } else if (daysLeft === 0) {
    // Expires today
    return {
      status: 'today',
      badge: '<span class="vault-expiry-badge today" title="Expires today" role="img" aria-label="Expires today"><span aria-hidden="true">⏰</span></span>',
      daysLeft: 0,
      label: "Expires today"
    };
  } else if (daysLeft <= 7) {
    // Expires within a week
    return {
      status: 'soon',
      badge: `<span class="vault-expiry-badge soon" title="Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}" role="img" aria-label="Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}"><span aria-hidden="true">🕐</span></span>`,
      daysLeft,
      label: `Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
    };
  } else if (daysLeft <= 30) {
    // Expires within a month
    return {
      status: 'warning',
      badge: `<span class="vault-expiry-badge warning" title="Expires in ${daysLeft} days" role="img" aria-label="Expires in ${daysLeft} days"><span aria-hidden="true">📅</span></span>`,
      daysLeft,
      label: `Expires in ${daysLeft} days`
    };
  }

  // Valid, not expiring soon
  return {
    status: 'valid',
    badge: '',
    daysLeft,
    label: `Expires on ${expiresAt.toLocaleDateString('en-US')}`
  };
}
