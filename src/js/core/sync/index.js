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

// src/js/core/sync/index.js - Zero-Trust Sync Engine Public API

// Models
export {
  CloudResult,
  CloudErrorType,
  VaultSyncMetadata,
  VaultSyncData,
  SyncState,
  ConflictStrategy
} from './models.js';

// Abstract Provider
export {
  CloudProvider,
  ProviderRegistry,
  providerRegistry
} from './cloud-provider.js';

// Concrete Providers
export { GoogleDriveProvider, getGoogleDriveProvider } from './providers/google-drive-provider.js';

/**
 * Zero-Trust Sync Engine
 *
 * Phase 3 implementation providing:
 *
 * 1. CloudResult Architecture
 *    - Type-safe success/error handling
 *    - HTTP status code mapping
 *    - Network error detection
 *    - Recoverable vs non-recoverable errors
 *
 * 2. Abstract CloudProvider Interface
 *    - authenticate() - OAuth/token management
 *    - uploadVault() - Encrypted data upload
 *    - downloadVault() - Encrypted data download
 *    - listVaults() - List synced vaults
 *    - deleteVault() - Remove vault from cloud
 *
 * 3. Google Drive Provider
 *    - Uses appDataFolder (hidden, secure)
 *    - OAuth 2.0 with refresh tokens
 *    - Multipart upload for efficiency
 *    - File caching for performance
 *
 * SECURITY PRINCIPLES:
 * - Providers ONLY handle encrypted data
 * - Encryption happens in sync-service.js via vault-crypto.js
 * - Providers never see plaintext content
 * - Zero-trust: assume network is compromised
 *
 * @module sync
 */
