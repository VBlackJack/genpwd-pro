/**
 * @fileoverview Password Health Analyzer
 * Analyzes vault entries for security issues
 *
 * @version 2.6.7
 */

import { safeLog } from './logger.js';
import { checkPasswordBreach } from './breach-check.js';

/**
 * Calculate password strength score (0-100)
 * @param {string} password
 * @returns {{score: number, level: string, issues: string[]}}
 */
export function analyzePasswordStrength(password) {
  if (!password) return { score: 0, level: 'none', issues: ['Pas de mot de passe'] };

  const issues = [];
  let score = 0;

  // Length scoring (max 30 points)
  const len = password.length;
  if (len >= 16) score += 30;
  else if (len >= 12) score += 25;
  else if (len >= 8) score += 15;
  else if (len >= 6) score += 5;

  if (len < 8) issues.push('Trop court (< 8 caractères)');
  if (len < 12) issues.push('Longueur recommandée: 12+ caractères');

  // Character variety (max 40 points)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLower) score += 10;
  if (hasUpper) score += 10;
  if (hasDigit) score += 10;
  if (hasSpecial) score += 10;

  if (!hasLower || !hasUpper) issues.push('Mélangez majuscules et minuscules');
  if (!hasDigit) issues.push('Ajoutez des chiffres');
  if (!hasSpecial) issues.push('Ajoutez des caractères spéciaux');

  // Entropy bonus (max 20 points)
  const uniqueChars = new Set(password).size;
  const uniqueRatio = uniqueChars / len;
  score += Math.min(20, Math.round(uniqueRatio * 25));

  if (uniqueRatio < 0.5) issues.push('Trop de caractères répétés');

  // Pattern penalties
  if (/^[a-z]+$/i.test(password)) {
    score -= 10;
    issues.push('Que des lettres');
  }
  if (/^[0-9]+$/.test(password)) {
    score -= 20;
    issues.push('Que des chiffres');
  }
  if (/(.)\1{2,}/.test(password)) {
    score -= 5;
    issues.push('Séquences répétitives');
  }
  if (/^(123|abc|qwerty|azerty|password|motdepasse)/i.test(password)) {
    score -= 30;
    issues.push('Pattern commun détecté');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level;
  if (score >= 80) level = 'strong';
  else if (score >= 60) level = 'good';
  else if (score >= 40) level = 'fair';
  else if (score >= 20) level = 'weak';
  else level = 'critical';

  return { score, level, issues };
}

/**
 * Find duplicate passwords across entries
 * @param {Array<{id: string, data: {password: string}}>} entries
 * @returns {Map<string, string[]>} Map of password hash to entry IDs
 */
export function findDuplicates(entries) {
  const passwordMap = new Map();

  for (const entry of entries) {
    const pwd = entry.data?.password;
    if (!pwd) continue;

    // Use simple hash for grouping (not cryptographic)
    const hash = simpleHash(pwd);
    if (!passwordMap.has(hash)) {
      passwordMap.set(hash, []);
    }
    passwordMap.get(hash).push(entry.id);
  }

  // Filter to only duplicates (2+ entries with same password)
  const duplicates = new Map();
  for (const [hash, ids] of passwordMap) {
    if (ids.length > 1) {
      duplicates.set(hash, ids);
    }
  }

  return duplicates;
}

/**
 * Simple non-cryptographic hash for grouping
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Analyze password age
 * @param {Date|string} modifiedAt
 * @returns {{days: number, level: string, label: string}}
 */
export function analyzePasswordAge(modifiedAt) {
  const modified = new Date(modifiedAt);
  const now = new Date();
  const days = Math.floor((now - modified) / (1000 * 60 * 60 * 24));

  let level, label;
  if (days > 365) {
    level = 'critical';
    label = `${Math.floor(days / 365)} an(s) - Renouvellement urgent`;
  } else if (days > 180) {
    level = 'warning';
    label = `${Math.floor(days / 30)} mois - Renouvellement conseillé`;
  } else if (days > 90) {
    level = 'fair';
    label = `${Math.floor(days / 30)} mois`;
  } else if (days > 30) {
    level = 'good';
    label = `${days} jours`;
  } else {
    level = 'recent';
    label = 'Récent';
  }

  return { days, level, label };
}

/**
 * @typedef {Object} HealthReport
 * @property {number} totalEntries
 * @property {number} totalWithPassword
 * @property {number} overallScore
 * @property {Object} strength - Strength breakdown
 * @property {Object} duplicates - Duplicate info
 * @property {Object} age - Age breakdown
 * @property {Object} breached - Breach info
 * @property {Array} issues - Top issues to address
 */

/**
 * Generate comprehensive health report for vault entries
 * @param {Array} entries - Vault entries
 * @param {Object} options
 * @param {boolean} [options.checkBreaches=false] - Also check HIBP (slow)
 * @returns {Promise<HealthReport>}
 */
export async function generateHealthReport(entries, options = {}) {
  const { checkBreaches = false } = options;

  const loginEntries = entries.filter(e => e.type === 'login' && e.data?.password);
  const report = {
    totalEntries: entries.length,
    totalWithPassword: loginEntries.length,
    overallScore: 0,
    strength: {
      strong: [],
      good: [],
      fair: [],
      weak: [],
      critical: []
    },
    duplicates: {
      count: 0,
      groups: [],
      affectedEntries: []
    },
    age: {
      recent: [],
      good: [],
      fair: [],
      warning: [],
      critical: []
    },
    breached: {
      checked: false,
      compromised: [],
      safe: 0
    },
    issues: [],
    entries: [] // Detailed per-entry analysis
  };

  if (loginEntries.length === 0) {
    report.issues.push({ type: 'info', message: 'Aucune entrée avec mot de passe' });
    return report;
  }

  // Analyze each entry
  let totalScore = 0;
  for (const entry of loginEntries) {
    const pwd = entry.data.password;
    const strengthResult = analyzePasswordStrength(pwd);
    const ageResult = analyzePasswordAge(entry.modifiedAt);

    // Add to strength buckets
    report.strength[strengthResult.level].push(entry.id);

    // Add to age buckets
    report.age[ageResult.level].push(entry.id);

    // Store detailed analysis
    report.entries.push({
      id: entry.id,
      title: entry.title,
      strength: strengthResult,
      age: ageResult
    });

    totalScore += strengthResult.score;
  }

  // Find duplicates
  const duplicateMap = findDuplicates(loginEntries);
  report.duplicates.count = duplicateMap.size;
  for (const [, ids] of duplicateMap) {
    report.duplicates.groups.push(ids);
    report.duplicates.affectedEntries.push(...ids);
  }

  // Check breaches if requested
  if (checkBreaches) {
    report.breached.checked = true;
    for (const entry of loginEntries) {
      try {
        const result = await checkPasswordBreach(entry.data.password);
        if (result.breached) {
          report.breached.compromised.push({
            id: entry.id,
            title: entry.title,
            count: result.count
          });
        } else {
          report.breached.safe++;
        }
      } catch (err) {
        safeLog(`[HealthReport] Breach check error for ${entry.id}: ${err.message}`);
      }
    }
  }

  // Calculate overall score
  const strengthScore = (
    (report.strength.strong.length * 100) +
    (report.strength.good.length * 75) +
    (report.strength.fair.length * 50) +
    (report.strength.weak.length * 25) +
    (report.strength.critical.length * 0)
  ) / loginEntries.length;

  const duplicatePenalty = Math.min(30, report.duplicates.affectedEntries.length * 5);
  const agePenalty = Math.min(20, (report.age.warning.length + report.age.critical.length * 2) * 3);
  const breachPenalty = report.breached.compromised.length * 10;

  report.overallScore = Math.max(0, Math.round(strengthScore - duplicatePenalty - agePenalty - breachPenalty));

  // Generate top issues
  if (report.strength.critical.length > 0) {
    report.issues.push({
      type: 'critical',
      message: `${report.strength.critical.length} mot(s) de passe critique(s)`,
      count: report.strength.critical.length
    });
  }
  if (report.strength.weak.length > 0) {
    report.issues.push({
      type: 'warning',
      message: `${report.strength.weak.length} mot(s) de passe faible(s)`,
      count: report.strength.weak.length
    });
  }
  if (report.duplicates.count > 0) {
    report.issues.push({
      type: 'warning',
      message: `${report.duplicates.affectedEntries.length} entrées partagent ${report.duplicates.count} mot(s) de passe`,
      count: report.duplicates.count
    });
  }
  if (report.age.critical.length > 0) {
    report.issues.push({
      type: 'critical',
      message: `${report.age.critical.length} mot(s) de passe de plus d'un an`,
      count: report.age.critical.length
    });
  }
  if (report.breached.compromised.length > 0) {
    report.issues.push({
      type: 'critical',
      message: `${report.breached.compromised.length} mot(s) de passe compromis(s)`,
      count: report.breached.compromised.length
    });
  }

  // Sort issues by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  report.issues.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

  safeLog(`[HealthReport] Generated report: score=${report.overallScore}, entries=${loginEntries.length}`);

  return report;
}

/**
 * Get score color/class based on score value
 * @param {number} score
 * @returns {string}
 */
export function getScoreLevel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

export default {
  analyzePasswordStrength,
  findDuplicates,
  analyzePasswordAge,
  generateHealthReport,
  getScoreLevel
};
