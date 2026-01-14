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

// src/js/core/enterprise/index.js - Enterprise Module Public API

// Policy Loader
export {
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
} from './policy-loader.js';

// Feature Flags
export {
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
} from './feature-flags.js';

/**
 * Enterprise Module
 *
 * Provides enterprise policy management for GenPwd Pro:
 *
 * 1. Policy Loading
 *    - Loads policy from system-wide config files
 *    - Validates against schema
 *    - Merges with defaults
 *
 * 2. Feature Flags
 *    - Centralized feature toggle system
 *    - Policy-driven restrictions
 *    - Provider allowlist
 *
 * 3. Security Policies
 *    - Password requirements
 *    - Auto-lock settings
 *    - Biometric unlock
 *
 * 4. Sync Policies
 *    - Provider restrictions
 *    - Enterprise server support
 *    - Personal cloud control
 *
 * DEPLOYMENT:
 * - Windows: C:\ProgramData\GenPwdPro\policy.json
 * - macOS: /Library/Application Support/GenPwdPro/policy.json
 * - Linux: /etc/genpwdpro/policy.json
 *
 * @module enterprise
 */
