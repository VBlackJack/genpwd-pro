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
 * Configuration Profile Manager - BMAD Phase 4
 * Manages saved configuration profiles for quick switching
 */

const STORAGE_KEY = 'genpwd-config-profiles';
const MAX_PROFILES = 10;

/** In-memory profiles cache */
let profiles = [];

/**
 * Profile structure
 * @typedef {Object} Profile
 * @property {string} id - Unique identifier (UUID)
 * @property {string} name - User-given profile name
 * @property {Object} settings - Generator settings snapshot
 * @property {string} createdAt - ISO 8601 timestamp
 * @property {string} lastUsed - ISO 8601 timestamp
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Load profiles from storage
 * @returns {Array<Profile>}
 */
export function loadProfiles() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      profiles = JSON.parse(stored);
      // Sort by lastUsed (most recent first)
      profiles.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    }
  } catch {
    profiles = [];
  }
  return profiles;
}

/**
 * Save profiles to storage
 */
function saveProfiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Storage not available
  }
}

/**
 * Get all profiles
 * @returns {Array<Profile>}
 */
export function getProfiles() {
  return [...profiles];
}

/**
 * Get a profile by ID
 * @param {string} id - Profile ID
 * @returns {Profile|null}
 */
export function getProfileById(id) {
  return profiles.find(p => p.id === id) || null;
}

/**
 * Create a new profile from current settings
 * @param {string} name - Profile name
 * @param {Object} settings - Current generator settings
 * @returns {Profile|null} The created profile or null if max reached
 */
export function createProfile(name, settings) {
  if (profiles.length >= MAX_PROFILES) {
    return null;
  }

  const now = new Date().toISOString();
  const profile = {
    id: generateUUID(),
    name: name.trim() || `Profile ${profiles.length + 1}`,
    settings: { ...settings },
    createdAt: now,
    lastUsed: now
  };

  profiles.unshift(profile);
  saveProfiles();
  return profile;
}

/**
 * Update a profile's settings
 * @param {string} id - Profile ID
 * @param {Object} settings - New settings to save
 * @returns {boolean} Success
 */
export function updateProfile(id, settings) {
  const profile = profiles.find(p => p.id === id);
  if (!profile) return false;

  profile.settings = { ...settings };
  profile.lastUsed = new Date().toISOString();
  saveProfiles();
  return true;
}

/**
 * Rename a profile
 * @param {string} id - Profile ID
 * @param {string} newName - New name
 * @returns {boolean} Success
 */
export function renameProfile(id, newName) {
  const profile = profiles.find(p => p.id === id);
  if (!profile) return false;

  profile.name = newName.trim();
  saveProfiles();
  return true;
}

/**
 * Delete a profile
 * @param {string} id - Profile ID
 * @returns {boolean} Success
 */
export function deleteProfile(id) {
  const index = profiles.findIndex(p => p.id === id);
  if (index === -1) return false;

  profiles.splice(index, 1);
  saveProfiles();
  return true;
}

/**
 * Mark a profile as used (updates lastUsed timestamp)
 * @param {string} id - Profile ID
 */
export function markProfileUsed(id) {
  const profile = profiles.find(p => p.id === id);
  if (profile) {
    profile.lastUsed = new Date().toISOString();
    // Re-sort by lastUsed
    profiles.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    saveProfiles();
  }
}

/**
 * Get the number of profiles
 * @returns {number}
 */
export function getProfileCount() {
  return profiles.length;
}

/**
 * Check if max profiles reached
 * @returns {boolean}
 */
export function isMaxProfilesReached() {
  return profiles.length >= MAX_PROFILES;
}

/**
 * Initialize profiles (load from storage)
 */
export function initProfiles() {
  loadProfiles();
}

/**
 * Get profile settings for applying
 * @param {string} id - Profile ID
 * @returns {Object|null} Settings object or null
 */
export function getProfileSettings(id) {
  const profile = getProfileById(id);
  if (!profile) return null;

  markProfileUsed(id);
  return { ...profile.settings };
}

export default {
  initProfiles,
  loadProfiles,
  getProfiles,
  getProfileById,
  getProfileSettings,
  createProfile,
  updateProfile,
  renameProfile,
  deleteProfile,
  markProfileUsed,
  getProfileCount,
  isMaxProfilesReached
};
