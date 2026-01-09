import { SessionManager } from './interfaces.js';
import { Result } from '../utils/result.js';

function cloneKey(key) {
  return new Uint8Array(key);
}

export class InMemorySessionManager extends SessionManager {
  constructor({ defaultTtlMs = 5 * 60 * 1000 } = {}) {
    super();
    this.defaultTtlMs = defaultTtlMs;
    this.masterKey = null;
    this.duressKey = null; // Key for the decoy vault
    this.isDuressMode = false; // Flag to indicate if we are in duress mode
    this.expiresAt = 0;
    this.biometricGate = null;
  }

  /**
   * Stores the master key in memory
   * @param {Uint8Array} key - The master key
   * @param {number} ttlMs - Time to live in milliseconds
   * @param {boolean} isDuress - Whether this is a duress key
   * @returns {Promise<Result<void, Error>>}
   */
  async storeKey(key, ttlMs = this.defaultTtlMs, isDuress = false) {
    if (!(key instanceof Uint8Array)) {
      return Result.err(new TypeError('Master key must be a Uint8Array'));
    }

    // Prevent double-unlock: clear existing keys before storing new one
    if (this.isUnlocked()) {
      await this.clear();
    }

    if (isDuress) {
      this.duressKey = cloneKey(key);
      this.isDuressMode = true;
      this.masterKey = null; // Ensure real master key is not stored
    } else {
      this.masterKey = cloneKey(key);
      this.isDuressMode = false;
      this.duressKey = null;
    }

    this.expiresAt = Date.now() + ttlMs;
    return Result.ok(undefined);
  }

  async getKey() {
    const activeKey = this.isDuressMode ? this.duressKey : this.masterKey;

    if (!activeKey || this.isExpired()) {
      return null;
    }
    if (this.biometricGate) {
      const allowed = await this.biometricGate();
      if (!allowed) {
        return null;
      }
      // SECURITY: Re-check expiration after biometric gate to prevent TOCTOU
      if (this.isExpired()) {
        return null;
      }
    }
    return cloneKey(activeKey);
  }

  async clear() {
    if (this.masterKey) {
      this.masterKey.fill(0);
    }
    if (this.duressKey) {
      this.duressKey.fill(0);
    }
    this.masterKey = null;
    this.duressKey = null;
    this.isDuressMode = false;
    this.expiresAt = 0;
  }

  /**
   * Extends the session TTL
   * @param {number} ttlMs - New time to live in milliseconds
   * @returns {Promise<Result<void, Error>>}
   */
  async extend(ttlMs = this.defaultTtlMs) {
    if (!this.masterKey && !this.duressKey) {
      return Result.err(new Error('Session is not unlocked'));
    }
    this.expiresAt = Date.now() + ttlMs;
    return Result.ok(undefined);
  }

  isUnlocked() {
    return (Boolean(this.masterKey) || Boolean(this.duressKey)) && !this.isExpired();
  }

  isExpired() {
    if (!this.masterKey && !this.duressKey) {
      return true;
    }
    return Date.now() > this.expiresAt;
  }

  /**
   * Registers a biometric gate function
   * @param {Function|null} gate - Gate function or null to disable
   * @returns {Result<void, Error>}
   */
  registerBiometricGate(gate) {
    if (gate != null && typeof gate !== 'function') {
      return Result.err(new TypeError('Biometric gate must be a function or null'));
    }
    this.biometricGate = gate;
    return Result.ok(undefined);
  }
}
