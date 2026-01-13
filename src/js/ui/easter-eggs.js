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
 * Easter Eggs - BMAD Phase 5
 * Hidden features and fun surprises
 */

import { getCelebration, CELEBRATION_TYPES } from './components/celebration.js';
import { showToast } from '../utils/toast.js';
import { t } from '../utils/i18n.js';

/** Konami code sequence */
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

/** Current index in Konami sequence */
let konamiIndex = 0;

/** Easter egg unlock state */
const easterEggState = {
  konamiUnlocked: false
};

/**
 * Trigger the Konami code easter egg
 */
function triggerKonamiEasterEgg() {
  if (easterEggState.konamiUnlocked) {
    // Already unlocked, just show celebration again
    getCelebration().celebrate(CELEBRATION_TYPES.MILESTONE, { count: 500 });
    return;
  }

  easterEggState.konamiUnlocked = true;

  // Epic rainbow celebration
  getCelebration().celebrate(CELEBRATION_TYPES.MILESTONE, { count: 1000 });

  // Show fun toast
  showToast(t('easterEggs.konami'), 'success', {
    className: 'easter-egg-toast'
  });

  // Save to localStorage that it was discovered
  try {
    const stored = JSON.parse(localStorage.getItem('genpwd-easter-eggs') || '{}');
    stored.konamiFound = new Date().toISOString();
    localStorage.setItem('genpwd-easter-eggs', JSON.stringify(stored));
  } catch {
    // Storage not available
  }
}

/**
 * Handle keydown for Konami code detection
 * @param {KeyboardEvent} e
 */
function handleKonamiKey(e) {
  const expectedKey = KONAMI_CODE[konamiIndex];

  if (e.key === expectedKey) {
    konamiIndex++;

    // Full sequence matched!
    if (konamiIndex === KONAMI_CODE.length) {
      triggerKonamiEasterEgg();
      konamiIndex = 0;
    }
  } else {
    // Reset on wrong key
    konamiIndex = 0;
  }
}

/**
 * Secret click pattern on logo (5 rapid clicks)
 */
let logoClickCount = 0;
let logoClickTimer = null;

function handleLogoClick() {
  logoClickCount++;

  // Clear previous timer
  if (logoClickTimer) {
    clearTimeout(logoClickTimer);
  }

  // Reset after 1 second
  logoClickTimer = setTimeout(() => {
    logoClickCount = 0;
  }, 1000);

  // 5 clicks triggers the easter egg
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    showDevCredits();
  }
}

/**
 * Show developer credits easter egg
 */
function showDevCredits() {
  showToast(t('easterEggs.credits'), 'info', {
    duration: 5000,
    className: 'easter-egg-toast'
  });
}

/**
 * Initialize all easter eggs
 */
export function initEasterEggs() {
  // Konami code listener
  document.addEventListener('keydown', handleKonamiKey);

  // Logo click easter egg
  const logo = document.querySelector('.app-logo, .logo, header h1');
  if (logo) {
    logo.addEventListener('click', handleLogoClick);
    logo.style.cursor = 'pointer';
  }

  // Load previous easter egg discoveries
  try {
    const stored = JSON.parse(localStorage.getItem('genpwd-easter-eggs') || '{}');
    if (stored.konamiFound) {
      easterEggState.konamiUnlocked = true;
    }
  } catch {
    // Storage not available
  }
}

export default {
  initEasterEggs
};
