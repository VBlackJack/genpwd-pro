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
 * @returns {{level: string, label: string, percent: number}}
 */
export function calculatePasswordStrength(password) {
  if (!password) return { level: 'none', label: '', percent: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { level: 'weak', label: 'Weak', percent: 25 },
    { level: 'weak', label: 'Weak', percent: 25 },
    { level: 'fair', label: 'Fair', percent: 50 },
    { level: 'fair', label: 'Fair', percent: 50 },
    { level: 'good', label: 'Good', percent: 75 },
    { level: 'good', label: 'Good', percent: 75 },
    { level: 'strong', label: 'Strong', percent: 100 },
    { level: 'strong', label: 'Excellent', percent: 100 }
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
