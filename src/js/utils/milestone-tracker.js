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
 * Milestone Tracker - BMAD Phase 6
 * Tracks and celebrates generation milestones
 */

import { t } from './i18n.js';
import { showToast } from './toast.js';
import { getCelebration, CELEBRATION_TYPES } from '../ui/components/celebration.js';

/** Generation milestones to celebrate */
const MILESTONES = [50, 100, 200, 500, 1000, 2000, 5000];

/** Storage key for tracking announced milestones */
const STORAGE_KEY = 'genpwd-milestones';

/** In-memory state of announced milestones */
let announcedMilestones = [];

/**
 * Load announced milestones from storage
 */
export function loadMilestones() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      announcedMilestones = JSON.parse(stored);
    }
  } catch {
    announcedMilestones = [];
  }
  return announcedMilestones;
}

/**
 * Save announced milestones to storage
 */
function saveMilestones() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(announcedMilestones));
  } catch {
    // Storage not available
  }
}

/**
 * Trigger milestone notification with celebration
 * @param {number} count - The milestone number
 */
function triggerMilestoneNotification(count) {
  showToast(
    t('milestones.reached', { count }),
    'success',
    {
      className: 'milestone-toast',
      duration: 4000
    }
  );

  // Mini celebration for milestone
  getCelebration().celebrate(CELEBRATION_TYPES.MILESTONE, { count: 40 });
}

/**
 * Check if a milestone was reached and trigger notification
 * @param {number} currentCount - Current total count
 * @param {number} previousCount - Previous total count
 * @returns {number|null} The milestone reached, or null
 */
export function checkMilestones(currentCount, previousCount) {
  // Load milestones if not already loaded
  if (announcedMilestones.length === 0) {
    loadMilestones();
  }

  for (const milestone of MILESTONES) {
    // Check if we just crossed this milestone
    if (previousCount < milestone && currentCount >= milestone) {
      // Check if not already announced
      if (!announcedMilestones.includes(milestone)) {
        announcedMilestones.push(milestone);
        saveMilestones();
        triggerMilestoneNotification(milestone);
        return milestone;
      }
    }
  }

  return null;
}

/**
 * Get the next milestone to reach
 * @param {number} currentCount - Current total count
 * @returns {number|null} Next milestone or null if all reached
 */
export function getNextMilestone(currentCount) {
  for (const milestone of MILESTONES) {
    if (currentCount < milestone) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get progress toward next milestone
 * @param {number} currentCount - Current total count
 * @returns {Object} Progress info { current, target, percent }
 */
export function getMilestoneProgress(currentCount) {
  const nextMilestone = getNextMilestone(currentCount);

  if (!nextMilestone) {
    return { current: currentCount, target: currentCount, percent: 100 };
  }

  // Find previous milestone for accurate progress
  let previousMilestone = 0;
  for (const milestone of MILESTONES) {
    if (milestone >= nextMilestone) break;
    if (currentCount >= milestone) {
      previousMilestone = milestone;
    }
  }

  const progress = currentCount - previousMilestone;
  const total = nextMilestone - previousMilestone;
  const percent = Math.round((progress / total) * 100);

  return {
    current: currentCount,
    target: nextMilestone,
    percent
  };
}

/**
 * Reset milestone tracking (for testing)
 */
export function resetMilestones() {
  announcedMilestones = [];
  saveMilestones();
}

export default {
  loadMilestones,
  checkMilestones,
  getNextMilestone,
  getMilestoneProgress,
  resetMilestones
};
