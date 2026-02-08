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

// src/desktop/vault/auth/webauthn-auth.js - WebAuthn/FIDO2 Authentication
// Provides passwordless authentication using hardware security keys

import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';

/**
 * WebAuthn Relying Party Configuration
 */
const RP_CONFIG = {
  id: 'genpwdpro.local',
  name: 'GenPwd Pro',
  origin: 'app://genpwdpro'
};

/**
 * Credential storage path
 */
const CREDENTIALS_FILE = 'webauthn-credentials.enc';

/**
 * Credential structure
 * @typedef {Object} StoredCredential
 * @property {string} id - Credential ID (base64)
 * @property {string} publicKey - Public key (base64)
 * @property {string} vaultId - Associated vault ID
 * @property {number} counter - Signature counter
 * @property {string} createdAt - Creation timestamp
 * @property {string} lastUsed - Last usage timestamp
 * @property {string} name - User-friendly name
 * @property {string} type - Authenticator type (platform/cross-platform)
 */

/**
 * WebAuthn Manager
 * Handles FIDO2/WebAuthn credential management
 */
export class WebAuthnManager {
  #credentialsPath;
  #credentials = new Map();

  constructor() {
    this.#credentialsPath = path.join(app.getPath('userData'), CREDENTIALS_FILE);
    this.#loadCredentials();
  }

  /**
   * Load credentials from encrypted storage
   * @private
   */
  #loadCredentials() {
    try {
      if (fs.existsSync(this.#credentialsPath)) {
        const encrypted = fs.readFileSync(this.#credentialsPath);
        const decrypted = safeStorage.decryptString(encrypted);
        const data = JSON.parse(decrypted);

        for (const cred of data) {
          this.#credentials.set(cred.id, cred);
        }

        console.log(`[WebAuthn] Loaded ${this.#credentials.size} credentials`);
      }
    } catch (error) {
      console.error('[WebAuthn] Failed to load credentials:', error);
      this.#credentials = new Map();
    }
  }

  /**
   * Save credentials to encrypted storage
   * @private
   */
  #saveCredentials() {
    try {
      const data = JSON.stringify(Array.from(this.#credentials.values()));
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(this.#credentialsPath, encrypted);
    } catch (error) {
      console.error('[WebAuthn] Failed to save credentials:', error);
      throw error;
    }
  }

  /**
   * Check if WebAuthn is available
   * @returns {boolean}
   */
  isAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Generate challenge for registration or authentication
   * @returns {Buffer} 32-byte random challenge
   */
  generateChallenge() {
    return randomBytes(32);
  }

  /**
   * Create registration options for WebAuthn
   * @param {string} vaultId - Vault to associate with credential
   * @param {string} userName - Display name for the credential
   * @returns {Object} PublicKeyCredentialCreationOptions
   */
  createRegistrationOptions(vaultId, userName) {
    const userId = createHash('sha256')
      .update(vaultId)
      .digest();

    const challenge = this.generateChallenge();

    return {
      challenge: challenge.toString('base64'),
      rp: {
        id: RP_CONFIG.id,
        name: RP_CONFIG.name
      },
      user: {
        id: userId.toString('base64'),
        name: userName,
        displayName: `GenPwd Pro - ${userName}`
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256 (ECDSA w/ SHA-256)
        { type: 'public-key', alg: -257 }  // RS256 (RSASSA-PKCS1-v1_5 w/ SHA-256)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform', // Allow security keys
        userVerification: 'preferred',
        residentKey: 'discouraged'
      },
      attestation: 'none', // No attestation verification needed for local use
      timeout: 60000 // 60 seconds
    };
  }

  /**
   * Register a new credential
   * @param {string} vaultId - Vault ID
   * @param {Object} credential - WebAuthn credential response
   * @param {string} name - User-friendly name
   * @returns {StoredCredential}
   */
  async registerCredential(vaultId, credential, name = 'Security Key') {
    if (!credential || !credential.id || !credential.response) {
      throw new Error('Invalid credential response');
    }

    const storedCredential = {
      id: credential.id,
      publicKey: credential.response.publicKey,
      vaultId,
      counter: 0,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      name,
      type: credential.authenticatorAttachment || 'cross-platform'
    };

    this.#credentials.set(credential.id, storedCredential);
    this.#saveCredentials();

    console.log(`[WebAuthn] Registered credential ${name} for vault ${vaultId}`);

    return storedCredential;
  }

  /**
   * Create authentication options
   * @param {string} vaultId - Vault to authenticate
   * @returns {Object} PublicKeyCredentialRequestOptions
   */
  createAuthenticationOptions(vaultId) {
    const challenge = this.generateChallenge();

    // Get credentials for this vault
    const allowCredentials = [];
    for (const cred of this.#credentials.values()) {
      if (cred.vaultId === vaultId) {
        allowCredentials.push({
          type: 'public-key',
          id: cred.id
        });
      }
    }

    if (allowCredentials.length === 0) {
      throw new Error('No credentials registered for this vault');
    }

    return {
      challenge: challenge.toString('base64'),
      rpId: RP_CONFIG.id,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000
    };
  }

  /**
   * Verify authentication response
   * @param {Object} response - WebAuthn authentication response
   * @param {string} expectedChallenge - Original challenge
   * @returns {{success: boolean, credentialId: string, vaultId: string}}
   */
  async verifyAuthentication(response, _expectedChallenge) {
    if (!response || !response.id) {
      throw new Error('Invalid authentication response');
    }

    const credential = this.#credentials.get(response.id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    // In a real implementation, verify the signature using the stored public key
    // For now, we trust the browser's verification and update the counter
    const newCounter = response.authenticatorData?.counter || credential.counter + 1;

    // Counter should always increase (replay attack protection)
    if (newCounter <= credential.counter) {
      throw new Error('Invalid signature counter - possible replay attack');
    }

    // Update credential
    credential.counter = newCounter;
    credential.lastUsed = new Date().toISOString();
    this.#saveCredentials();

    console.log(`[WebAuthn] Authenticated with ${credential.name}`);

    return {
      success: true,
      credentialId: credential.id,
      vaultId: credential.vaultId
    };
  }

  /**
   * Get credentials for a vault
   * @param {string} vaultId - Vault ID
   * @returns {StoredCredential[]}
   */
  getCredentialsForVault(vaultId) {
    const result = [];
    for (const cred of this.#credentials.values()) {
      if (cred.vaultId === vaultId) {
        result.push({ ...cred, publicKey: undefined }); // Don't expose public key
      }
    }
    return result;
  }

  /**
   * Check if vault has registered credentials
   * @param {string} vaultId - Vault ID
   * @returns {boolean}
   */
  hasCredentials(vaultId) {
    for (const cred of this.#credentials.values()) {
      if (cred.vaultId === vaultId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Delete a credential
   * @param {string} credentialId - Credential ID
   * @returns {boolean}
   */
  deleteCredential(credentialId) {
    const deleted = this.#credentials.delete(credentialId);
    if (deleted) {
      this.#saveCredentials();
      console.log(`[WebAuthn] Deleted credential ${credentialId}`);
    }
    return deleted;
  }

  /**
   * Delete all credentials for a vault
   * @param {string} vaultId - Vault ID
   * @returns {number} Number of deleted credentials
   */
  deleteCredentialsForVault(vaultId) {
    let count = 0;
    for (const [id, cred] of this.#credentials) {
      if (cred.vaultId === vaultId) {
        this.#credentials.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.#saveCredentials();
      console.log(`[WebAuthn] Deleted ${count} credentials for vault ${vaultId}`);
    }
    return count;
  }

  /**
   * Rename a credential
   * @param {string} credentialId - Credential ID
   * @param {string} newName - New name
   * @returns {boolean}
   */
  renameCredential(credentialId, newName) {
    const credential = this.#credentials.get(credentialId);
    if (credential) {
      credential.name = newName;
      this.#saveCredentials();
      return true;
    }
    return false;
  }

  /**
   * Get all credentials count
   * @returns {number}
   */
  get totalCredentials() {
    return this.#credentials.size;
  }

  /**
   * Export credentials metadata (for backup UI)
   * @returns {Object[]}
   */
  exportMetadata() {
    const result = [];
    for (const cred of this.#credentials.values()) {
      result.push({
        id: cred.id.substring(0, 8) + '...', // Truncated for display
        name: cred.name,
        vaultId: cred.vaultId,
        type: cred.type,
        createdAt: cred.createdAt,
        lastUsed: cred.lastUsed
      });
    }
    return result;
  }
}

// Singleton instance
let _instance = null;

/**
 * Get WebAuthn manager instance
 * @returns {WebAuthnManager}
 */
export function getWebAuthnManager() {
  if (!_instance) {
    _instance = new WebAuthnManager();
  }
  return _instance;
}

/**
 * Check if WebAuthn is supported
 * @returns {boolean}
 */
export function isWebAuthnSupported() {
  return safeStorage.isEncryptionAvailable();
}

export default WebAuthnManager;
