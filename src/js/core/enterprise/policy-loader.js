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

// src/js/core/enterprise/policy-loader.js - Enterprise Policy Loader
// Loads and validates enterprise policies from admin-deployed configuration files

import { safeLog } from '../../utils/logger.js';

/**
 * Enterprise Policy Schema Version
 */
export const POLICY_SCHEMA_VERSION = '1.0';

/**
 * Default policy values (used when no enterprise policy is deployed)
 */
export const DEFAULT_POLICY = {
  '$schema': `genpwd-enterprise-policy-v${POLICY_SCHEMA_VERSION}`,
  'organization': null,
  'security': {
    'minMasterPasswordLength': 8,
    'requireMasterPasswordComplexity': false,
    'maxAutoLockTimeout': null,  // null = no restriction
    'forceAutoLock': false,
    'allowBiometricUnlock': true,
    'maxDecryptAttempts': 5
  },
  'sync': {
    'allowedProviders': null,  // null = all providers allowed
    'enterpriseServerUrl': null,
    'disablePersonalCloud': false,
    'requireSync': false
  },
  'features': {
    'allowPlugins': true,
    'allowExport': true,
    'allowImport': true,
    'allowClipboardCopy': true,
    'allowAutoType': true,
    'allowPasswordGenerator': true,
    'allowCustomThemes': true
  },
  'updates': {
    'autoUpdate': true,
    'updateChannel': 'stable',
    'checkInterval': 86400000  // 24 hours
  },
  'branding': {
    'customLogo': null,
    'customTitle': null,
    'supportUrl': null,
    'supportEmail': null
  }
};

/**
 * Policy loading state
 */
let _loadedPolicy = null;
let _policyLoadError = null;
let _isPolicyLoaded = false;

/**
 * Get enterprise policy file paths by platform
 * @returns {string[]} - Array of potential policy file paths
 */
export function getPolicyPaths() {
  if (typeof window.electronAPI === 'undefined') {
    return [];  // Web mode - no file system access
  }

  const platform = window.electronAPI.platform;

  switch (platform) {
    case 'win32':
      return [
        // Primary: ProgramData (admin deployed)
        'C:\\ProgramData\\GenPwdPro\\policy.json',
        // Fallback: AppData (user-specific)
        `${process.env?.APPDATA || ''}\\GenPwdPro\\policy.json`
      ].filter(p => p);

    case 'darwin':
      return [
        // Primary: System-wide (admin deployed via MDM)
        '/Library/Application Support/GenPwdPro/policy.json',
        // Fallback: User-specific
        `${process.env?.HOME || ''}/Library/Application Support/GenPwdPro/policy.json`
      ].filter(p => p);

    case 'linux':
      return [
        // Primary: System-wide (admin deployed)
        '/etc/genpwdpro/policy.json',
        // Fallback: User-specific
        `${process.env?.HOME || ''}/.config/genpwdpro/policy.json`
      ].filter(p => p);

    default:
      return [];
  }
}

/**
 * Validate policy structure against schema
 * @param {Object} policy - Policy object to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePolicy(policy) {
  const errors = [];

  if (!policy || typeof policy !== 'object') {
    errors.push('Policy must be a valid JSON object');
    return { valid: false, errors };
  }

  // Validate schema version
  if (policy.$schema && !policy.$schema.includes('genpwd-enterprise-policy')) {
    errors.push(`Invalid schema: ${policy.$schema}`);
  }

  // Validate security settings
  if (policy.security) {
    const sec = policy.security;

    if (sec.minMasterPasswordLength !== undefined) {
      if (typeof sec.minMasterPasswordLength !== 'number' || sec.minMasterPasswordLength < 1) {
        errors.push('security.minMasterPasswordLength must be a positive number');
      }
      if (sec.minMasterPasswordLength > 128) {
        errors.push('security.minMasterPasswordLength cannot exceed 128');
      }
    }

    if (sec.maxAutoLockTimeout !== undefined && sec.maxAutoLockTimeout !== null) {
      if (typeof sec.maxAutoLockTimeout !== 'number' || sec.maxAutoLockTimeout < 0) {
        errors.push('security.maxAutoLockTimeout must be a non-negative number');
      }
    }

    if (sec.maxDecryptAttempts !== undefined) {
      if (typeof sec.maxDecryptAttempts !== 'number' || sec.maxDecryptAttempts < 1) {
        errors.push('security.maxDecryptAttempts must be a positive number');
      }
    }
  }

  // Validate sync settings
  if (policy.sync) {
    const sync = policy.sync;

    if (sync.allowedProviders !== undefined && sync.allowedProviders !== null) {
      if (!Array.isArray(sync.allowedProviders)) {
        errors.push('sync.allowedProviders must be an array or null');
      }
    }

    if (sync.enterpriseServerUrl !== undefined && sync.enterpriseServerUrl !== null) {
      try {
        new URL(sync.enterpriseServerUrl);
      } catch {
        errors.push('sync.enterpriseServerUrl must be a valid URL');
      }
    }
  }

  // Validate features
  if (policy.features) {
    const features = policy.features;
    const booleanFeatures = [
      'allowPlugins', 'allowExport', 'allowImport',
      'allowClipboardCopy', 'allowAutoType', 'allowPasswordGenerator',
      'allowCustomThemes'
    ];

    for (const feature of booleanFeatures) {
      if (features[feature] !== undefined && typeof features[feature] !== 'boolean') {
        errors.push(`features.${feature} must be a boolean`);
      }
    }
  }

  // Validate updates
  if (policy.updates) {
    const updates = policy.updates;

    if (updates.updateChannel !== undefined) {
      const validChannels = ['stable', 'beta', 'nightly'];
      if (!validChannels.includes(updates.updateChannel)) {
        errors.push(`updates.updateChannel must be one of: ${validChannels.join(', ')}`);
      }
    }

    if (updates.checkInterval !== undefined) {
      if (typeof updates.checkInterval !== 'number' || updates.checkInterval < 3600000) {
        errors.push('updates.checkInterval must be at least 3600000 (1 hour)');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge user policy with defaults
 * @param {Object} userPolicy - User/admin policy
 * @returns {Object} - Merged policy
 */
export function mergeWithDefaults(userPolicy) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_POLICY));

  if (!userPolicy) return merged;

  // Deep merge
  const deepMerge = (target, source) => {
    for (const key of Object.keys(source)) {
      if (source[key] !== undefined) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    return target;
  };

  return deepMerge(merged, userPolicy);
}

/**
 * Load enterprise policy from file system
 * Called from Electron main process
 * @returns {Promise<Object>} - Loaded and validated policy
 */
export async function loadPolicy() {
  if (_isPolicyLoaded) {
    return _loadedPolicy || DEFAULT_POLICY;
  }

  const paths = getPolicyPaths();

  if (paths.length === 0) {
    safeLog('Enterprise: No policy paths available (web mode)');
    _loadedPolicy = DEFAULT_POLICY;
    _isPolicyLoaded = true;
    return _loadedPolicy;
  }

  // Try each path in order
  for (const policyPath of paths) {
    try {
      // Request policy file via IPC
      if (window.electronAPI?.readEnterprisePolicy) {
        const result = await window.electronAPI.readEnterprisePolicy(policyPath);

        if (result.success && result.data) {
          const policy = JSON.parse(result.data);

          // Validate policy
          const validation = validatePolicy(policy);
          if (!validation.valid) {
            safeLog(`Enterprise: Policy validation failed: ${validation.errors.join(', ')}`);
            _policyLoadError = validation.errors.join(', ');
            continue;
          }

          // Merge with defaults
          _loadedPolicy = mergeWithDefaults(policy);
          _isPolicyLoaded = true;

          safeLog(`Enterprise: Policy loaded from ${policyPath}`);
          if (_loadedPolicy.organization?.name) {
            safeLog(`Enterprise: Managed by ${_loadedPolicy.organization.name}`);
          }

          return _loadedPolicy;
        }
      }
    } catch (error) {
      safeLog(`Enterprise: Failed to load policy from ${policyPath}: ${error.message}`);
    }
  }

  // No policy found - use defaults
  safeLog('Enterprise: No policy file found, using defaults');
  _loadedPolicy = DEFAULT_POLICY;
  _isPolicyLoaded = true;
  return _loadedPolicy;
}

/**
 * Get currently loaded policy
 * @returns {Object} - Current policy (or defaults if not loaded)
 */
export function getPolicy() {
  return _loadedPolicy || DEFAULT_POLICY;
}

/**
 * Check if enterprise policy is active (non-default)
 * @returns {boolean}
 */
export function isEnterpriseMode() {
  const policy = getPolicy();
  return policy.organization !== null;
}

/**
 * Get policy load error if any
 * @returns {string|null}
 */
export function getPolicyLoadError() {
  return _policyLoadError;
}

/**
 * Reset policy (for testing)
 */
export function resetPolicy() {
  _loadedPolicy = null;
  _policyLoadError = null;
  _isPolicyLoaded = false;
}

export default {
  loadPolicy,
  getPolicy,
  isEnterpriseMode,
  validatePolicy,
  mergeWithDefaults,
  getPolicyPaths,
  getPolicyLoadError,
  resetPolicy,
  DEFAULT_POLICY,
  POLICY_SCHEMA_VERSION
};
