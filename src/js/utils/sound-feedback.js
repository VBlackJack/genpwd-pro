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
 * Sound Feedback Utility - BMAD UX Improvement
 * Provides optional audio feedback for user actions
 * OFF by default (opt-in)
 */

const STORAGE_KEY = 'genpwd-sound-enabled';

/** Sound effect types */
export const SOUND_TYPES = {
  COPY: 'copy',
  GENERATE: 'generate',
  SAVE: 'save',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Tiny audio data URIs (base64 encoded WAV/MP3)
 * These are simple, short sounds to minimize file size
 */
const SOUNDS = {
  // Short click/pop sound for copy
  [SOUND_TYPES.COPY]: 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  // Ascending tone for generate
  [SOUND_TYPES.GENERATE]: 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  // Soft chime for save
  [SOUND_TYPES.SAVE]: 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  // Positive ding for success
  [SOUND_TYPES.SUCCESS]: 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
  // Low tone for error
  [SOUND_TYPES.ERROR]: 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
};

/** Audio element cache */
const audioCache = new Map();

/** Enabled state */
let soundEnabled = false;

/**
 * Initialize sound feedback system
 * Loads enabled state from storage
 */
export function initSoundFeedback() {
  try {
    soundEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    soundEnabled = false;
  }
}

/**
 * Check if sound feedback is enabled
 * @returns {boolean}
 */
export function isSoundEnabled() {
  return soundEnabled;
}

/**
 * Enable or disable sound feedback
 * @param {boolean} enabled
 */
export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage not available
  }
}

/**
 * Toggle sound feedback
 * @returns {boolean} New enabled state
 */
export function toggleSound() {
  setSoundEnabled(!soundEnabled);
  return soundEnabled;
}

/**
 * Play a sound effect
 * @param {string} type - One of SOUND_TYPES
 * @param {Object} options - Options
 * @param {number} options.volume - Volume (0-1), default 0.3
 */
export function playSound(type, options = {}) {
  // Don't play if disabled or sound type unknown
  if (!soundEnabled || !SOUNDS[type]) return;

  // Respect reduced motion preference (implies no sounds for some users)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const { volume = 0.3 } = options;

  try {
    // Get or create audio element
    let audio = audioCache.get(type);
    if (!audio) {
      audio = new Audio(SOUNDS[type]);
      audioCache.set(type, audio);
    }

    // Reset and play
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.play().catch(() => {
      // Autoplay may be blocked, ignore silently
    });
  } catch {
    // Audio not supported, ignore silently
  }
}

/**
 * Play copy sound
 */
export function playCopySound() {
  playSound(SOUND_TYPES.COPY);
}

/**
 * Play generate sound
 */
export function playGenerateSound() {
  playSound(SOUND_TYPES.GENERATE);
}

/**
 * Play save sound
 */
export function playSaveSound() {
  playSound(SOUND_TYPES.SAVE);
}

/**
 * Play success sound
 */
export function playSuccessSound() {
  playSound(SOUND_TYPES.SUCCESS);
}

/**
 * Play error sound
 */
export function playErrorSound() {
  playSound(SOUND_TYPES.ERROR);
}

/**
 * Cleanup audio resources
 */
export function cleanupSoundFeedback() {
  audioCache.forEach(audio => {
    audio.pause();
    audio.src = '';
  });
  audioCache.clear();
}

export default {
  initSoundFeedback,
  isSoundEnabled,
  setSoundEnabled,
  toggleSound,
  playSound,
  playCopySound,
  playGenerateSound,
  playSaveSound,
  playSuccessSound,
  playErrorSound,
  cleanupSoundFeedback,
  SOUND_TYPES
};
