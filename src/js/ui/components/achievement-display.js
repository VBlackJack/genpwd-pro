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
 * Achievement Display Component - BMAD Phase 5
 * Renders achievement badges and progress indicators
 */

import { t } from '../../utils/i18n.js';
import {
  getAllAchievements,
  getAchievementProgress,
  getUnlockedCount,
  getTotalCount
} from '../../utils/achievement-manager.js';

/**
 * Render achievement badges for display in stats modal
 * @returns {string} HTML string of achievement badges
 */
export function renderAchievementBadges() {
  const achievements = getAllAchievements();
  const progress = getAchievementProgress();

  const badgesHtml = achievements.map(achievement => {
    const isUnlocked = achievement.unlocked;
    const prog = progress[achievement.id] || { percent: 0, current: 0, target: 1 };

    return `
      <div class="achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}"
           data-achievement="${achievement.id}"
           title="${t(`achievements.${achievement.id}.desc`)}">
        <span class="achievement-icon" aria-hidden="true">${achievement.icon}</span>
        <div class="achievement-info">
          <span class="achievement-name">${t(`achievements.${achievement.id}.name`)}</span>
          ${!isUnlocked ? `
            <div class="achievement-progress">
              <div class="achievement-progress-bar">
                <div class="achievement-progress-fill" data-width="${prog.percent}"></div>
              </div>
              <span class="achievement-progress-text">${prog.current}/${prog.target}</span>
            </div>
          ` : `
            <span class="achievement-unlocked-date">${formatUnlockDate(achievement.unlockedAt)}</span>
          `}
        </div>
      </div>
    `;
  }).join('');

  return badgesHtml;
}

/**
 * Render the achievements section for stats modal
 * @returns {string} HTML string of achievements section
 */
export function renderAchievementsSection() {
  const unlockedCount = getUnlockedCount();
  const totalCount = getTotalCount();

  return `
    <div class="stats-section achievements-section">
      <h3 class="stats-section-title">
        <span>${t('achievements.title')}</span>
        <span class="achievements-counter">${unlockedCount}/${totalCount}</span>
      </h3>
      <div class="achievements-grid">
        ${renderAchievementBadges()}
      </div>
    </div>
  `;
}

/**
 * Render compact achievement badge for header display
 * @returns {string} HTML string of compact badge
 */
export function renderCompactAchievementBadge() {
  const unlockedCount = getUnlockedCount();
  const totalCount = getTotalCount();

  if (unlockedCount === 0) {
    return '';
  }

  return `
    <button type="button" class="achievement-header-badge"
            id="achievement-header-badge"
            title="${t('achievements.title')}: ${unlockedCount}/${totalCount}"
            aria-label="${t('achievements.title')}: ${unlockedCount} ${t('achievements.of')} ${totalCount}">
      <span class="achievement-badge-icon" aria-hidden="true">🏆</span>
      <span class="achievement-badge-count">${unlockedCount}</span>
    </button>
  `;
}

/**
 * Format unlock date for display
 * @param {string|null} dateStr - ISO date string
 * @returns {string} Formatted date or empty string
 */
function formatUnlockDate(dateStr) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Apply progress bar widths (CSP-compliant)
 * @param {Element} container - Container element
 */
export function applyAchievementProgressWidths(container) {
  const bars = container?.querySelectorAll('.achievement-progress-fill[data-width]');
  bars?.forEach(bar => {
    const width = bar.getAttribute('data-width');
    if (width) {
      bar.style.setProperty('width', `${width}%`);
    }
  });
}

/**
 * Update achievement display when new achievement is unlocked
 * @param {string} achievementId - The achievement that was unlocked
 */
export function updateAchievementDisplay(achievementId) {
  // Update any visible achievement badges
  const badge = document.querySelector(`[data-achievement="${achievementId}"]`);
  if (badge) {
    badge.classList.remove('locked');
    badge.classList.add('unlocked', 'just-unlocked');

    // Remove animation class after animation completes
    setTimeout(() => {
      badge.classList.remove('just-unlocked');
    }, 1000);
  }

  // Update header badge counter
  const headerBadge = document.getElementById('achievement-header-badge');
  if (headerBadge) {
    const countEl = headerBadge.querySelector('.achievement-badge-count');
    if (countEl) {
      countEl.textContent = getUnlockedCount().toString();
    }
  }
}

/**
 * Mount the achievement badge in the header - BMAD Phase 6
 */
export function mountHeaderBadge() {
  const container = document.getElementById('header-achievement-container');
  if (!container) return;

  const badgeHtml = renderCompactAchievementBadge();
  container.innerHTML = badgeHtml;

  // Bind click handler to open stats modal
  const badge = document.getElementById('achievement-header-badge');
  if (badge) {
    badge.addEventListener('click', () => {
      // Dynamic import to avoid circular dependency
      import('../modals/stats-modal.js').then(({ statsModal }) => {
        statsModal.show();
      });
    });
  }
}

/**
 * Refresh the header badge (call after achievement unlocks)
 */
export function refreshHeaderBadge() {
  const container = document.getElementById('header-achievement-container');
  if (!container) return;

  const badgeHtml = renderCompactAchievementBadge();
  container.innerHTML = badgeHtml;

  // Re-bind click handler
  const badge = document.getElementById('achievement-header-badge');
  if (badge) {
    badge.addEventListener('click', () => {
      import('../modals/stats-modal.js').then(({ statsModal }) => {
        statsModal.show();
      });
    });
  }
}

/**
 * Add pulse animation to header badge - BMAD Phase 6
 */
export function pulseHeaderBadge() {
  const badge = document.getElementById('achievement-header-badge');
  if (!badge) return;

  badge.classList.add('pulse');
  setTimeout(() => {
    badge.classList.remove('pulse');
  }, 1500);
}

/**
 * Initialize achievement display listeners
 */
export function initAchievementDisplay() {
  // Listen for achievement unlock events
  window.addEventListener('achievement:unlocked', (e) => {
    const { id } = e.detail;
    updateAchievementDisplay(id);
    refreshHeaderBadge();
    pulseHeaderBadge();
  });

  // Mount header badge on init
  mountHeaderBadge();
}

export default {
  renderAchievementBadges,
  renderAchievementsSection,
  renderCompactAchievementBadge,
  applyAchievementProgressWidths,
  updateAchievementDisplay,
  initAchievementDisplay,
  mountHeaderBadge,
  refreshHeaderBadge,
  pulseHeaderBadge
};
