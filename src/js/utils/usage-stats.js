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
 * Usage Statistics Utility - BMAD UX Improvement
 * Tracks password generation statistics locally
 */

import { checkMilestones } from './milestone-tracker.js';

const STORAGE_KEY = 'genpwd-usage-stats';

/**
 * Default stats structure
 */
const DEFAULT_STATS = {
  totalGenerated: 0,
  totalCopied: 0,
  totalSaved: 0,
  modeBreakdown: {
    syllables: 0,
    passphrase: 0,
    leet: 0
  },
  entropySum: 0,
  entropyCount: 0,
  strongestEntropy: 0,
  firstUse: null,
  lastUse: null,
  // BMAD Phase 6: Daily history for activity chart
  dailyHistory: []
};

/** In-memory stats cache */
let stats = { ...DEFAULT_STATS };

/**
 * Load stats from storage
 */
export function loadStats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      stats = { ...DEFAULT_STATS, ...parsed };
    }
  } catch {
    stats = { ...DEFAULT_STATS };
  }
  return stats;
}

/**
 * Save stats to storage
 */
function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage not available
  }
}

/**
 * Get or create today's daily history entry - BMAD Phase 6
 * @returns {Object} Today's entry { date, generated, copied }
 */
function getTodayEntry() {
  const today = new Date().toISOString().split('T')[0];

  // Ensure dailyHistory exists
  if (!Array.isArray(stats.dailyHistory)) {
    stats.dailyHistory = [];
  }

  let todayEntry = stats.dailyHistory.find(d => d.date === today);

  if (!todayEntry) {
    todayEntry = { date: today, generated: 0, copied: 0 };
    stats.dailyHistory.push(todayEntry);

    // Keep only last 30 days
    if (stats.dailyHistory.length > 30) {
      stats.dailyHistory.shift();
    }
  }

  return todayEntry;
}

/**
 * Get current stats
 * @returns {Object} Current statistics
 */
export function getStats() {
  return { ...stats };
}

/**
 * Record a password generation
 * @param {Object} options
 * @param {string} options.mode - Generation mode (syllables, passphrase, leet)
 * @param {number} options.entropy - Entropy bits
 * @param {number} options.count - Number of passwords generated
 */
export function recordGeneration({ mode = 'syllables', entropy = 0, count = 1 } = {}) {
  const now = new Date().toISOString();

  // BMAD Phase 6: Track previous count for milestone check
  const previousCount = stats.totalGenerated;
  stats.totalGenerated += count;

  // BMAD Phase 6: Check for milestones
  checkMilestones(stats.totalGenerated, previousCount);

  // BMAD Phase 6: Update daily history
  const todayEntry = getTodayEntry();
  todayEntry.generated += count;

  // Update mode breakdown
  if (stats.modeBreakdown[mode] !== undefined) {
    stats.modeBreakdown[mode] += count;
  }

  // Update entropy stats
  if (entropy > 0) {
    stats.entropySum += entropy * count;
    stats.entropyCount += count;
    if (entropy > stats.strongestEntropy) {
      stats.strongestEntropy = entropy;
    }
  }

  // Update timestamps
  if (!stats.firstUse) {
    stats.firstUse = now;
  }
  stats.lastUse = now;

  saveStats();
}

/**
 * Record a copy action
 */
export function recordCopy() {
  stats.totalCopied++;

  // BMAD Phase 6: Update daily history
  const todayEntry = getTodayEntry();
  todayEntry.copied++;

  stats.lastUse = new Date().toISOString();
  saveStats();
}

/**
 * Record a save to vault action
 */
export function recordSave() {
  stats.totalSaved++;
  stats.lastUse = new Date().toISOString();
  saveStats();
}

/**
 * Get average entropy
 * @returns {number}
 */
export function getAverageEntropy() {
  if (stats.entropyCount === 0) return 0;
  return Math.round(stats.entropySum / stats.entropyCount);
}

/**
 * Get strongest entropy
 * @returns {number}
 */
export function getStrongestEntropy() {
  return stats.strongestEntropy;
}

/**
 * Get mode breakdown as percentages
 * @returns {Object}
 */
export function getModeBreakdown() {
  const total = stats.totalGenerated || 1;
  return {
    syllables: Math.round((stats.modeBreakdown.syllables / total) * 100),
    passphrase: Math.round((stats.modeBreakdown.passphrase / total) * 100),
    leet: Math.round((stats.modeBreakdown.leet / total) * 100)
  };
}

/**
 * Get daily history for activity chart - BMAD Phase 6
 * @param {number} days - Number of days to return (default 7)
 * @returns {Array} Array of daily entries sorted by date
 */
export function getDailyHistory(days = 7) {
  // Ensure dailyHistory exists
  if (!Array.isArray(stats.dailyHistory)) {
    return [];
  }

  // Get last N days
  const history = stats.dailyHistory.slice(-days);

  // Fill in missing days with zeros
  const result = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const existing = history.find(h => h.date === dateStr);
    result.push(existing || { date: dateStr, generated: 0, copied: 0 });
  }

  return result;
}

/**
 * Reset all stats
 */
export function resetStats() {
  stats = { ...DEFAULT_STATS, dailyHistory: [] };
  saveStats();
}

/**
 * Initialize stats (load from storage)
 */
export function initUsageStats() {
  loadStats();
}

export default {
  initUsageStats,
  loadStats,
  getStats,
  recordGeneration,
  recordCopy,
  recordSave,
  getAverageEntropy,
  getStrongestEntropy,
  getModeBreakdown,
  getDailyHistory,
  resetStats
};
