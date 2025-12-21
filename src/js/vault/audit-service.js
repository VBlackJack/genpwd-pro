/**
 * Audit Service - Security Analysis Engine
 * GenPwd Pro - Secure Password Vault
 *
 * Analyzes vault entries locally to identify security issues
 * and calculate an overall security score.
 */

/**
 * Calculate password entropy in bits
 * @param {string} password
 * @returns {number} Entropy in bits
 */
function calculateEntropy(password) {
  if (!password || password.length === 0) return 0;

  // Determine character set size
  let charsetSize = 0;
  const checks = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digits: /[0-9]/.test(password),
    symbols: /[^a-zA-Z0-9]/.test(password)
  };

  if (checks.lowercase) charsetSize += 26;
  if (checks.uppercase) charsetSize += 26;
  if (checks.digits) charsetSize += 10;
  if (checks.symbols) charsetSize += 32; // Common symbols

  if (charsetSize === 0) charsetSize = 26; // Fallback

  // Entropy = length * log2(charsetSize)
  const entropy = password.length * Math.log2(charsetSize);

  // Penalize patterns
  const penaltyMultiplier = getPatternPenalty(password);

  return entropy * penaltyMultiplier;
}

/**
 * Get pattern penalty multiplier (1.0 = no penalty, <1.0 = penalty)
 * @param {string} password
 * @returns {number}
 */
function getPatternPenalty(password) {
  let penalty = 1.0;
  const lower = password.toLowerCase();

  // Repeated characters (aaa, 111)
  if (/(.)\1{2,}/.test(password)) {
    penalty *= 0.8;
  }

  // Sequential characters (abc, 123)
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    penalty *= 0.85;
  }
  if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
    penalty *= 0.85;
  }

  // Keyboard patterns (qwerty, azerty)
  const keyboardPatterns = ['qwerty', 'azerty', 'qwertz', 'asdf', 'zxcv', '1234', 'password', 'admin'];
  for (const pattern of keyboardPatterns) {
    if (lower.includes(pattern)) {
      penalty *= 0.7;
      break;
    }
  }

  // Common words
  const commonWords = [
    'password', 'letmein', 'welcome', 'admin', 'login', 'master',
    'dragon', 'monkey', 'shadow', 'sunshine', 'princess', 'football',
    'baseball', 'iloveyou', 'trustno1', 'batman', 'superman'
  ];
  for (const word of commonWords) {
    if (lower.includes(word)) {
      penalty *= 0.5;
      break;
    }
  }

  // Year patterns (1990-2029)
  if (/(?:19[89]\d|20[012]\d)/.test(password)) {
    penalty *= 0.9;
  }

  return Math.max(0.3, penalty); // Minimum 30% of original entropy
}

/**
 * Get password strength level
 * @param {number} entropy
 * @returns {'critical'|'weak'|'medium'|'strong'|'excellent'}
 */
function getStrengthLevel(entropy) {
  if (entropy < 28) return 'critical';   // < 28 bits = cracked in seconds
  if (entropy < 36) return 'weak';       // < 36 bits = cracked in minutes
  if (entropy < 60) return 'medium';     // < 60 bits = cracked in hours/days
  if (entropy < 80) return 'strong';     // < 80 bits = cracked in years
  return 'excellent';                     // 80+ bits = practically uncrackable
}

/**
 * Hash a password for comparison (using SHA-256)
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Audit a single entry
 * @param {Object} entry - Vault entry
 * @returns {Promise<Object>} Audit result for this entry
 */
async function auditEntry(entry) {
  const password = entry.secret?.[0] || '';
  const result = {
    id: entry.id,
    title: entry.title,
    issues: [],
    entropy: 0,
    strength: 'critical',
    passwordHash: null,
    lastModified: entry.metadata?.modifiedAt || entry.metadata?.createdAt || null
  };

  if (!password) {
    result.issues.push({ type: 'empty', message: 'Aucun mot de passe défini' });
    return result;
  }

  // Calculate entropy
  result.entropy = calculateEntropy(password);
  result.strength = getStrengthLevel(result.entropy);

  // Hash for duplicate detection
  result.passwordHash = await hashPassword(password);

  // Check weakness
  if (result.entropy < 60) {
    result.issues.push({
      type: 'weak',
      message: `Mot de passe faible (${Math.round(result.entropy)} bits)`,
      severity: result.entropy < 36 ? 'critical' : 'warning'
    });
  }

  // Check age
  if (result.lastModified) {
    const ageMs = Date.now() - new Date(result.lastModified).getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365);
    if (ageYears > 1) {
      result.issues.push({
        type: 'old',
        message: `Non modifié depuis ${Math.floor(ageYears)} an(s)`,
        severity: 'info'
      });
    }
  }

  // Check if has 2FA
  result.has2FA = !!entry.otpConfig?.secret;

  return result;
}

/**
 * Perform a full security audit of the vault
 * @param {Array} entries - All vault entries
 * @returns {Promise<Object>} Full audit report
 */
export async function auditVault(entries) {
  const report = {
    timestamp: Date.now(),
    score: 100,
    totalEntries: entries.length,
    issues: {
      reused: [],      // Entries with reused passwords
      weak: [],        // Entries with weak passwords
      old: [],         // Entries with old passwords
      empty: [],       // Entries without passwords
      no2FA: []        // Entries without 2FA (for important accounts)
    },
    stats: {
      strongPasswords: 0,
      weakPasswords: 0,
      reusedPasswords: 0,
      oldPasswords: 0,
      with2FA: 0,
      averageEntropy: 0
    },
    entriesAudit: []
  };

  if (entries.length === 0) {
    return report;
  }

  // Audit each entry
  const passwordHashes = new Map(); // hash -> [entry ids]
  let totalEntropy = 0;

  for (const entry of entries) {
    const audit = await auditEntry(entry);
    report.entriesAudit.push(audit);

    // Track password hashes for duplicate detection
    if (audit.passwordHash) {
      if (!passwordHashes.has(audit.passwordHash)) {
        passwordHashes.set(audit.passwordHash, []);
      }
      passwordHashes.get(audit.passwordHash).push(audit.id);
    }

    // Categorize issues
    for (const issue of audit.issues) {
      if (issue.type === 'weak') {
        report.issues.weak.push({ id: audit.id, title: audit.title, ...issue });
      } else if (issue.type === 'old') {
        report.issues.old.push({ id: audit.id, title: audit.title, ...issue });
      } else if (issue.type === 'empty') {
        report.issues.empty.push({ id: audit.id, title: audit.title, ...issue });
      }
    }

    // Stats
    totalEntropy += audit.entropy;
    if (audit.strength === 'strong' || audit.strength === 'excellent') {
      report.stats.strongPasswords++;
    } else if (audit.strength === 'weak' || audit.strength === 'critical') {
      report.stats.weakPasswords++;
    }
    if (audit.has2FA) {
      report.stats.with2FA++;
    }
  }

  // Detect reused passwords
  for (const [hash, ids] of passwordHashes) {
    if (ids.length > 1) {
      const reusedEntries = ids.map(id => {
        const audit = report.entriesAudit.find(a => a.id === id);
        return { id, title: audit?.title || 'Unknown' };
      });
      report.issues.reused.push({
        type: 'reused',
        message: `Mot de passe partagé par ${ids.length} entrées`,
        entries: reusedEntries,
        severity: 'critical'
      });
      report.stats.reusedPasswords += ids.length;
    }
  }

  // Calculate stats
  report.stats.oldPasswords = report.issues.old.length;
  report.stats.averageEntropy = entries.length > 0 ? totalEntropy / entries.length : 0;

  // Calculate global score
  report.score = calculateGlobalScore(report);

  return report;
}

/**
 * Calculate global security score (0-100)
 * @param {Object} report - Audit report
 * @returns {number}
 */
function calculateGlobalScore(report) {
  if (report.totalEntries === 0) return 100;

  let score = 100;

  // Penalty for weak passwords (-5 each, max -40)
  const weakPenalty = Math.min(40, report.issues.weak.length * 5);
  score -= weakPenalty;

  // Penalty for reused passwords (-10 each group, max -30)
  const reusedPenalty = Math.min(30, report.issues.reused.length * 10);
  score -= reusedPenalty;

  // Penalty for old passwords (-2 each, max -20)
  const oldPenalty = Math.min(20, report.issues.old.length * 2);
  score -= oldPenalty;

  // Penalty for empty passwords (-3 each, max -15)
  const emptyPenalty = Math.min(15, report.issues.empty.length * 3);
  score -= emptyPenalty;

  // Bonus for 2FA coverage (up to +10)
  if (report.totalEntries > 0) {
    const coverage2FA = report.stats.with2FA / report.totalEntries;
    score += Math.floor(coverage2FA * 10);
  }

  // Bonus for high average entropy (up to +5)
  if (report.stats.averageEntropy >= 80) {
    score += 5;
  } else if (report.stats.averageEntropy >= 60) {
    score += 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get score color based on value
 * @param {number} score
 * @returns {string} CSS color variable or hex
 */
export function getScoreColor(score) {
  if (score >= 80) return 'var(--vault-success, #34d399)';
  if (score >= 60) return 'var(--vault-primary, #3b82f6)';
  if (score >= 40) return 'var(--vault-warning, #fbbf24)';
  return 'var(--vault-danger, #f87171)';
}

/**
 * Get score label
 * @param {number} score
 * @returns {string}
 */
export function getScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Très bon';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  if (score >= 20) return 'Faible';
  return 'Critique';
}

/**
 * Get recommendations based on audit report
 * @param {Object} report - Audit report
 * @returns {Array<{priority: string, message: string, action: string}>}
 */
export function getRecommendations(report) {
  const recommendations = [];

  // Critical: reused passwords
  if (report.issues.reused.length > 0) {
    recommendations.push({
      priority: 'critical',
      icon: '🔄',
      message: `${report.stats.reusedPasswords} mots de passe réutilisés`,
      action: 'Changez ces mots de passe immédiatement',
      filter: 'reused'
    });
  }

  // Critical: weak passwords
  const criticalWeak = report.issues.weak.filter(w => w.severity === 'critical');
  if (criticalWeak.length > 0) {
    recommendations.push({
      priority: 'critical',
      icon: '⚠️',
      message: `${criticalWeak.length} mot(s) de passe très faibles`,
      action: 'Utilisez des mots de passe plus longs et complexes',
      filter: 'weak'
    });
  }

  // Warning: weak passwords
  const warningWeak = report.issues.weak.filter(w => w.severity === 'warning');
  if (warningWeak.length > 0) {
    recommendations.push({
      priority: 'warning',
      icon: '🔐',
      message: `${warningWeak.length} mot(s) de passe à renforcer`,
      action: 'Augmentez la complexité de ces mots de passe',
      filter: 'weak'
    });
  }

  // Info: old passwords
  if (report.issues.old.length > 0) {
    recommendations.push({
      priority: 'info',
      icon: '📅',
      message: `${report.issues.old.length} mot(s) de passe ancien(s)`,
      action: 'Envisagez de les renouveler',
      filter: 'old'
    });
  }

  // Suggestion: enable 2FA
  const no2FACount = report.totalEntries - report.stats.with2FA;
  if (no2FACount > 0 && report.totalEntries > 0) {
    const percentage = Math.round((no2FACount / report.totalEntries) * 100);
    if (percentage > 50) {
      recommendations.push({
        priority: 'suggestion',
        icon: '🛡️',
        message: `${percentage}% des entrées sans 2FA`,
        action: 'Activez l\'authentification à deux facteurs',
        filter: 'no2fa'
      });
    }
  }

  return recommendations;
}

/**
 * Filter entries by issue type
 * @param {Object} report - Audit report
 * @param {string} filter - 'reused', 'weak', 'old', 'no2fa', 'all'
 * @returns {Array} Filtered entry IDs
 */
export function filterEntriesByIssue(report, filter) {
  switch (filter) {
    case 'reused': {
      const ids = new Set();
      for (const group of report.issues.reused) {
        for (const entry of group.entries) {
          ids.add(entry.id);
        }
      }
      return Array.from(ids);
    }
    case 'weak':
      return report.issues.weak.map(w => w.id);
    case 'old':
      return report.issues.old.map(o => o.id);
    case 'no2fa':
      return report.entriesAudit.filter(e => !e.has2FA).map(e => e.id);
    default:
      return report.entriesAudit.map(e => e.id);
  }
}
