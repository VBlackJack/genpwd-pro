/**
 * Vault domain abstractions.
 * @license Apache-2.0
 */

export class VaultRepository {
  async createGroup(/* group */) {
    throw new Error('Not implemented');
  }

  async updateGroup(/* group */) {
    throw new Error('Not implemented');
  }

  async deleteGroup(/* groupId */) {
    throw new Error('Not implemented');
  }

  async getGroupById(/* groupId */) {
    throw new Error('Not implemented');
  }

  async listGroups() {
    throw new Error('Not implemented');
  }

  async createEntry(/* entry */) {
    throw new Error('Not implemented');
  }

  async updateEntry(/* entry */) {
    throw new Error('Not implemented');
  }

  async deleteEntry(/* entryId */) {
    throw new Error('Not implemented');
  }

  async getEntryById(/* entryId */) {
    throw new Error('Not implemented');
  }

  async listEntriesByGroup(/* groupId */) {
    throw new Error('Not implemented');
  }

  async searchEntries(/* query, filters */) {
    throw new Error('Not implemented');
  }
}

export class CryptoEngine {
  async encrypt(/* plaintext, associatedData */) {
    throw new Error('Not implemented');
  }

  async decrypt(/* ciphertext, associatedData */) {
    throw new Error('Not implemented');
  }
}

export class KdfService {
  /**
   * @param {string|Uint8Array} passphrase
   * @param {import('./models.js').KdfParams} params
   * @param {number} [length]
   * @returns {Promise<Uint8Array>}
   */
  async deriveKey(passphrase, params, length = 32) {
    void passphrase;
    void params;
    void length;
    throw new Error('Not implemented');
  }

  /**
   * @param {Partial<import('./models.js').KdfParams>} options
   * @returns {import('./models.js').KdfParams}
   */
  createParams(/* options */) {
    throw new Error('Not implemented');
  }
}

export class SessionManager {
  /**
   * @param {Uint8Array} key
   * @param {number} ttlMs
   */
  async storeKey(/* key, ttlMs */) {
    throw new Error('Not implemented');
  }

  async getKey() {
    throw new Error('Not implemented');
  }

  async clear() {
    throw new Error('Not implemented');
  }

  async extend(/* ttlMs */) {
    throw new Error('Not implemented');
  }

  isUnlocked() {
    throw new Error('Not implemented');
  }

  registerBiometricGate(/* gate */) {
    throw new Error('Not implemented');
  }
}
