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
 * Achievement Manager - BMAD Phase 5
 * Tracks and awards achievements based on user statistics
 */

import { t } from './i18n.js';
import { getStats } from './usage-stats.js';
import { showToast } from './toast.js';
import { getCelebration, CELEBRATION_TYPES } from '../ui/components/celebration.js';

const STORAGE_KEY = 'genpwd-achievements';

/**
 * Achievement definitions
 */
export const ACHIEVEMENTS = {
  firstPassword: {
    id: 'firstPassword',
    icon: '🎯',
    threshold: 1,
    stat: 'totalGenerated'
  },
  generator10: {
    id: 'generator10',
    icon: '⭐',
    threshold: 10,
    stat: 'totalGenerated'
  },
  generator100: {
    id: 'generator100',
    icon: '🏆',
    threshold: 100,
    stat: 'totalGenerated'
  },
  strongPassword: {
    id: 'strongPassword',
    icon: '💪',
    threshold: 128,
    stat: 'strongestEntropy'
  },
  vaultSaver: {
    id: 'vaultSaver',
    icon: '🔐',
    threshold: 10,
    stat: 'totalSaved'
  },
  copyMaster: {
    id: 'copyMaster',
    icon: '📋',
    threshold: 50,
    stat: 'totalCopied'
  },
  allModes: {
    id: 'allModes',
    icon: '🎨',
    type: 'special',
    check: (stats) => stats.modeBreakdown.syllables > 0 &&
                       stats.modeBreakdown.passphrase > 0 &&
                       stats.modeBreakdown.leet > 0
  }
};

/** In-memory achievements state */
let achievementsState = {
  unlockedIds: [],
  unlockedAt: {}
};

/**
 * Load achievements from storage
 */
export function loadAchievements() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      achievementsState = {
        unlockedIds: parsed.unlockedIds || [],
        unlockedAt: parsed.unlockedAt || {}
      };
    }
  } catch {
    achievementsState = { unlockedIds: [], unlockedAt: {} };
  }
  return achievementsState;
}

/**
 * Save achievements to storage
 */
function saveAchievements() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(achievementsState));
  } catch {
    // Storage not available
  }
}

/**
 * Check if an achievement is unlocked
 * @param {string} id - Achievement ID
 * @returns {boolean}
 */
export function isAchievementUnlocked(id) {
  return achievementsState.unlockedIds.includes(id);
}

/**
 * Get confetti particle count by achievement tier - BMAD Phase 6
 * @param {string} id - Achievement ID
 * @returns {number} Number of confetti particles
 */
function getConfettiCountByTier(id) {
  const tiers = {
    firstPassword: 30,    // Small celebration
    generator10: 50,      // Medium
    generator100: 150,    // Large milestone
    strongPassword: 100,  // Medium-large
    vaultSaver: 80,       // Medium
    copyMaster: 80,       // Medium
    allModes: 200         // Special achievement - big celebration
  };
  return tiers[id] || 50;
}

/**
 * Unlock an achievement
 * @param {string} id - Achievement ID
 * @returns {boolean} True if newly unlocked
 */
function unlockAchievement(id) {
  if (isAchievementUnlocked(id)) return false;

  achievementsState.unlockedIds.push(id);
  achievementsState.unlockedAt[id] = new Date().toISOString();
  saveAchievements();

  // Show celebration toast
  const achievement = ACHIEVEMENTS[id];
  if (achievement) {
    showAchievementToast(id, achievement);

    // BMAD Phase 6: Trigger confetti celebration
    const confettiCount = getConfettiCountByTier(id);
    getCelebration().celebrate(CELEBRATION_TYPES.MILESTONE, {
      count: confettiCount
    });
  }

  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('achievement:unlocked', {
    detail: { id, achievement }
  }));

  return true;
}

/**
 * Show achievement unlock toast - Enhanced for BMAD Phase 6
 * @param {string} id - Achievement ID
 * @param {Object} achievement - Achievement definition
 */
function showAchievementToast(id, achievement) {
  const name = t(`achievements.${id}.name`);
  const message = `${achievement.icon} ${t('achievements.unlocked')}: ${name}`;

  showToast(message, 'success', {
    className: 'achievement-toast',
    duration: 5000  // Longer duration for achievements
  });
}

/**
 * Check all achievements against current stats
 * @param {Object} stats - Current usage stats (optional, will fetch if not provided)
 * @returns {Array} Array of newly unlocked achievement IDs
 */
export function checkAchievements(stats = null) {
  const currentStats = stats || getStats();
  const newlyUnlocked = [];

  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (isAchievementUnlocked(id)) continue;

    let shouldUnlock = false;

    if (achievement.type === 'special' && typeof achievement.check === 'function') {
      // Special achievement with custom check function
      shouldUnlock = achievement.check(currentStats);
    } else if (achievement.stat && achievement.threshold !== undefined) {
      // Standard threshold-based achievement
      const currentValue = currentStats[achievement.stat] || 0;
      shouldUnlock = currentValue >= achievement.threshold;
    }

    if (shouldUnlock) {
      unlockAchievement(id);
      newlyUnlocked.push(id);
    }
  }

  return newlyUnlocked;
}

/**
 * Get all unlocked achievements
 * @returns {Array} Array of unlocked achievement objects with metadata
 */
export function getUnlockedAchievements() {
  return achievementsState.unlockedIds.map(id => ({
    ...ACHIEVEMENTS[id],
    unlockedAt: achievementsState.unlockedAt[id]
  }));
}

/**
 * Get all achievements with unlock status
 * @returns {Array}
 */
export function getAllAchievements() {
  return Object.entries(ACHIEVEMENTS).map(([id, achievement]) => ({
    ...achievement,
    unlocked: isAchievementUnlocked(id),
    unlockedAt: achievementsState.unlockedAt[id] || null
  }));
}

/**
 * Get achievement progress for display
 * @returns {Object} Progress info
 */
export function getAchievementProgress() {
  const stats = getStats();
  const progress = {};

  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (achievement.type === 'special') {
      progress[id] = {
        current: achievement.check(stats) ? 1 : 0,
        target: 1,
        percent: achievement.check(stats) ? 100 : 0
      };
    } else if (achievement.stat && achievement.threshold) {
      const current = stats[achievement.stat] || 0;
      progress[id] = {
        current: Math.min(current, achievement.threshold),
        target: achievement.threshold,
        percent: Math.min(100, Math.round((current / achievement.threshold) * 100))
      };
    }
  }

  return progress;
}

/**
 * Get count of unlocked achievements
 * @returns {number}
 */
export function getUnlockedCount() {
  return achievementsState.unlockedIds.length;
}

/**
 * Get total number of achievements
 * @returns {number}
 */
export function getTotalCount() {
  return Object.keys(ACHIEVEMENTS).length;
}

/**
 * Initialize achievements (load from storage)
 */
export function initAchievements() {
  loadAchievements();
}

/**
 * Reset all achievements (for testing)
 */
export function resetAchievements() {
  achievementsState = { unlockedIds: [], unlockedAt: {} };
  saveAchievements();
}

export default {
  ACHIEVEMENTS,
  initAchievements,
  loadAchievements,
  checkAchievements,
  isAchievementUnlocked,
  getUnlockedAchievements,
  getAllAchievements,
  getAchievementProgress,
  getUnlockedCount,
  getTotalCount,
  resetAchievements
};
