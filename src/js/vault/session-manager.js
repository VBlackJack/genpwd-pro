import { SessionManager } from './interfaces.js';

function cloneKey(key) {
  return new Uint8Array(key);
}

export class InMemorySessionManager extends SessionManager {
  constructor({ defaultTtlMs = 5 * 60 * 1000 } = {}) {
    super();
    this.defaultTtlMs = defaultTtlMs;
    this.masterKey = null;
    this.expiresAt = 0;
    this.biometricGate = null;
  }

  async storeKey(key, ttlMs = this.defaultTtlMs) {
    if (!(key instanceof Uint8Array)) {
      throw new TypeError('Master key must be a Uint8Array');
    }
    this.masterKey = cloneKey(key);
    this.expiresAt = Date.now() + ttlMs;
  }

  async getKey() {
    if (!this.masterKey || this.isExpired()) {
      return null;
    }
    if (this.biometricGate) {
      const allowed = await this.biometricGate();
      if (!allowed) {
        return null;
      }
    }
    return cloneKey(this.masterKey);
  }

  async clear() {
    if (this.masterKey) {
      this.masterKey.fill(0);
    }
    this.masterKey = null;
    this.expiresAt = 0;
  }

  async extend(ttlMs = this.defaultTtlMs) {
    if (!this.masterKey) {
      throw new Error('Session is not unlocked');
    }
    this.expiresAt = Date.now() + ttlMs;
  }

  isUnlocked() {
    return Boolean(this.masterKey) && !this.isExpired();
  }

  isExpired() {
    if (!this.masterKey) {
      return true;
    }
    return Date.now() > this.expiresAt;
  }

  registerBiometricGate(gate) {
    if (gate != null && typeof gate !== 'function') {
      throw new TypeError('Biometric gate must be a function or null');
    }
    this.biometricGate = gate;
  }
}
