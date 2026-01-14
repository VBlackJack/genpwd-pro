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

// src/js/core/enterprise/feature-flags.js - Feature Flag System
// Centralized feature flag management based on enterprise policy

import { getPolicy, isEnterpriseMode } from './policy-loader.js';
import { safeLog } from '../../utils/logger.js';

/**
 * Feature flag definitions
 * Maps flag names to policy paths
 */
const FEATURE_MAP = {
  // Features section
  'plugins': 'features.allowPlugins',
  'export': 'features.allowExport',
  'import': 'features.allowImport',
  'clipboard': 'features.allowClipboardCopy',
  'autotype': 'features.allowAutoType',
  'generator': 'features.allowPasswordGenerator',
  'custom-themes': 'features.allowCustomThemes',

  // Security section
  'biometric': 'security.allowBiometricUnlock',

  // Sync section
  'personal-cloud': '!sync.disablePersonalCloud',  // Inverted flag

  // Updates section
  'auto-update': 'updates.autoUpdate'
};

/**
 * Feature restriction reasons
 * Provides user-friendly explanations for disabled features
 */
const RESTRICTION_REASONS = {
  'plugins': 'enterpriseFeatureDisabled',
  'export': 'enterpriseFeatureDisabled',
  'import': 'enterpriseFeatureDisabled',
  'clipboard': 'enterpriseFeatureDisabled',
  'autotype': 'enterpriseFeatureDisabled',
  'generator': 'enterpriseFeatureDisabled',
  'custom-themes': 'enterpriseFeatureDisabled',
  'biometric': 'enterpriseFeatureDisabled',
  'personal-cloud': 'enterpriseCloudRestricted',
  'auto-update': 'enterpriseUpdatePolicy'
};

/**
 * Get nested property from object using dot notation
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notated path (e.g., 'features.allowPlugins')
 * @returns {any} - Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Feature name (e.g., 'plugins', 'export')
 * @returns {boolean} - Whether feature is enabled
 */
export function isFeatureEnabled(featureName) {
  const flagPath = FEATURE_MAP[featureName];

  if (!flagPath) {
    safeLog(`FeatureFlags: Unknown feature '${featureName}', defaulting to enabled`);
    return true;
  }

  const policy = getPolicy();

  // Handle inverted flags (prefixed with !)
  const isInverted = flagPath.startsWith('!');
  const actualPath = isInverted ? flagPath.substring(1) : flagPath;

  const value = getNestedValue(policy, actualPath);

  // If value is undefined or null, feature is enabled by default
  if (value === undefined || value === null) {
    return true;
  }

  // Apply inversion if needed
  const enabled = isInverted ? !value : value;

  return enabled === true;
}

/**
 * Check if a feature is restricted by enterprise policy
 * @param {string} featureName - Feature name
 * @returns {{restricted: boolean, reason: string|null}}
 */
export function isFeatureRestricted(featureName) {
  if (!isEnterpriseMode()) {
    return { restricted: false, reason: null };
  }

  const enabled = isFeatureEnabled(featureName);

  if (!enabled) {
    return {
      restricted: true,
      reason: RESTRICTION_REASONS[featureName] || 'enterpriseFeatureDisabled'
    };
  }

  return { restricted: false, reason: null };
}

/**
 * Get all feature flags with their current states
 * @returns {Object} - Map of feature name to enabled state
 */
export function getAllFeatureFlags() {
  const flags = {};

  for (const featureName of Object.keys(FEATURE_MAP)) {
    flags[featureName] = {
      enabled: isFeatureEnabled(featureName),
      restricted: isFeatureRestricted(featureName).restricted
    };
  }

  return flags;
}

/**
 * Get list of restricted features
 * @returns {string[]} - Array of restricted feature names
 */
export function getRestrictedFeatures() {
  return Object.keys(FEATURE_MAP).filter(name => !isFeatureEnabled(name));
}

/**
 * Get list of enabled features
 * @returns {string[]} - Array of enabled feature names
 */
export function getEnabledFeatures() {
  return Object.keys(FEATURE_MAP).filter(name => isFeatureEnabled(name));
}

/**
 * Check if a specific cloud provider is allowed
 * @param {string} providerId - Provider ID (e.g., 'google-drive', 'onedrive')
 * @returns {boolean}
 */
export function isCloudProviderAllowed(providerId) {
  const policy = getPolicy();
  const allowedProviders = policy.sync?.allowedProviders;

  // If no restriction, all providers are allowed
  if (!allowedProviders || !Array.isArray(allowedProviders)) {
    return true;
  }

  // Empty array means no providers allowed
  if (allowedProviders.length === 0) {
    return false;
  }

  return allowedProviders.includes(providerId);
}

/**
 * Get list of allowed cloud providers
 * @returns {string[]|null} - Array of allowed provider IDs, or null for all
 */
export function getAllowedCloudProviders() {
  const policy = getPolicy();
  return policy.sync?.allowedProviders || null;
}

/**
 * Get minimum master password length
 * @returns {number}
 */
export function getMinMasterPasswordLength() {
  const policy = getPolicy();
  return policy.security?.minMasterPasswordLength || 8;
}

/**
 * Check if master password complexity is required
 * @returns {boolean}
 */
export function requiresMasterPasswordComplexity() {
  const policy = getPolicy();
  return policy.security?.requireMasterPasswordComplexity === true;
}

/**
 * Get maximum auto-lock timeout (in ms)
 * @returns {number|null} - Max timeout in ms, or null for no limit
 */
export function getMaxAutoLockTimeout() {
  const policy = getPolicy();
  return policy.security?.maxAutoLockTimeout || null;
}

/**
 * Check if auto-lock is forced
 * @returns {boolean}
 */
export function isAutoLockForced() {
  const policy = getPolicy();
  return policy.security?.forceAutoLock === true;
}

/**
 * Get enterprise server URL for sync
 * @returns {string|null}
 */
export function getEnterpriseServerUrl() {
  const policy = getPolicy();
  return policy.sync?.enterpriseServerUrl || null;
}

/**
 * Get update channel
 * @returns {'stable'|'beta'|'nightly'}
 */
export function getUpdateChannel() {
  const policy = getPolicy();
  return policy.updates?.updateChannel || 'stable';
}

/**
 * Get organization info
 * @returns {{name: string, logo: string}|null}
 */
export function getOrganizationInfo() {
  const policy = getPolicy();
  return policy.organization || null;
}

/**
 * Get branding info
 * @returns {Object}
 */
export function getBrandingInfo() {
  const policy = getPolicy();
  return policy.branding || {};
}

export default {
  isFeatureEnabled,
  isFeatureRestricted,
  getAllFeatureFlags,
  getRestrictedFeatures,
  getEnabledFeatures,
  isCloudProviderAllowed,
  getAllowedCloudProviders,
  getMinMasterPasswordLength,
  requiresMasterPasswordComplexity,
  getMaxAutoLockTimeout,
  isAutoLockForced,
  getEnterpriseServerUrl,
  getUpdateChannel,
  getOrganizationInfo,
  getBrandingInfo
};
