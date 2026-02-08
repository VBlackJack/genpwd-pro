import { SessionManager } from './interfaces.js';
import { Result } from '../utils/result.js';

/**
 * Generate a random mask of the given length using crypto.getRandomValues().
 * @param {number} length - Mask length in bytes
 * @returns {Uint8Array} Random mask
 */
function generateMask(length) {
  const mask = new Uint8Array(length);
  crypto.getRandomValues(mask);
  return mask;
}

/**
 * XOR a Uint8Array with a mask of equal length.
 * @param {Uint8Array} data - Source data
 * @param {Uint8Array} mask - XOR mask (same length as data)
 * @returns {Uint8Array} XOR result
 */
function xorBytes(data, mask) {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ mask[i];
  }
  return result;
}

function cloneKey(key) {
  return new Uint8Array(key);
}

/**
 * Simple async lock to prevent race conditions
 * SECURITY: Ensures getKey() operations are serialized to prevent TOCTOU attacks
 */
class AsyncLock {
  constructor() {
    this._locked = false;
    this._queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    } else {
      this._locked = false;
    }
  }
}

export class InMemorySessionManager extends SessionManager {
  constructor({ defaultTtlMs = 5 * 60 * 1000 } = {}) {
    super();
    this.defaultTtlMs = defaultTtlMs;
    // SECURITY: Keys are stored XOR-masked to prevent casual heap inspection.
    // Raw key is never kept in memory; only maskedKey and mask are stored.
    this._maskedMasterKey = null;
    this._masterMask = null;
    this._maskedDuressKey = null;
    this._duressMask = null;
    this.isDuressMode = false; // Flag to indicate if we are in duress mode
    this.expiresAt = 0;
    this.biometricGate = null;
    this._keyLock = new AsyncLock(); // SECURITY: Prevents race conditions in getKey()
  }

  /**
   * Stores a key in XOR-masked form.
   * @private
   * @param {Uint8Array} key - Raw key to mask and store
   * @param {'master'|'duress'} slot - Which key slot to use
   */
  _storeMasked(key, slot) {
    const cloned = cloneKey(key);
    const mask = generateMask(cloned.length);
    const masked = xorBytes(cloned, mask);
    // Wipe the plaintext clone immediately
    cloned.fill(0);

    if (slot === 'duress') {
      this._maskedDuressKey = masked;
      this._duressMask = mask;
    } else {
      this._maskedMasterKey = masked;
      this._masterMask = mask;
    }
  }

  /**
   * Retrieves and unmasks a stored key. Caller must wipe the returned buffer.
   * @private
   * @param {'master'|'duress'} slot - Which key slot to retrieve
   * @returns {Uint8Array|null} Unmasked key clone, or null if slot is empty
   */
  _retrieveMasked(slot) {
    const masked = slot === 'duress' ? this._maskedDuressKey : this._maskedMasterKey;
    const mask = slot === 'duress' ? this._duressMask : this._masterMask;
    if (!masked || !mask) return null;
    return xorBytes(masked, mask);
  }

  /**
   * Check whether a key slot has data stored.
   * @private
   * @param {'master'|'duress'} slot
   * @returns {boolean}
   */
  _hasKey(slot) {
    if (slot === 'duress') return Boolean(this._maskedDuressKey);
    return Boolean(this._maskedMasterKey);
  }

  /**
   * Wipe a key slot (masked data + mask).
   * @private
   * @param {'master'|'duress'} slot
   */
  _wipeSlot(slot) {
    if (slot === 'duress') {
      if (this._maskedDuressKey) this._maskedDuressKey.fill(0);
      if (this._duressMask) this._duressMask.fill(0);
      this._maskedDuressKey = null;
      this._duressMask = null;
    } else {
      if (this._maskedMasterKey) this._maskedMasterKey.fill(0);
      if (this._masterMask) this._masterMask.fill(0);
      this._maskedMasterKey = null;
      this._masterMask = null;
    }
  }

  async storeKey(key, ttlMs = this.defaultTtlMs, isDuress = false) {
    if (!(key instanceof Uint8Array)) {
      return Result.err(new TypeError('Master key must be a Uint8Array'));
    }

    // Prevent double-unlock: clear existing keys before storing new one
    if (this.isUnlocked()) {
      await this.clear();
    }

    if (isDuress) {
      this._storeMasked(key, 'duress');
      this.isDuressMode = true;
      this._wipeSlot('master'); // Ensure real master key is not stored
    } else {
      this._storeMasked(key, 'master');
      this.isDuressMode = false;
      this._wipeSlot('duress');
    }

    this.expiresAt = Date.now() + ttlMs;
    return Result.ok(undefined);
  }

  async getKey() {
    // SECURITY: Acquire lock to prevent race conditions between concurrent getKey() calls
    await this._keyLock.acquire();
    try {
      const slot = this.isDuressMode ? 'duress' : 'master';

      if (!this._hasKey(slot) || this.isExpired()) {
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
      return this._retrieveMasked(slot);
    } finally {
      this._keyLock.release();
    }
  }

  async clear() {
    this._wipeSlot('master');
    this._wipeSlot('duress');
    this.isDuressMode = false;
    this.expiresAt = 0;
  }

  /**
   * Extends the session TTL
   * @param {number} ttlMs - New time to live in milliseconds
   * @returns {Promise<Result<void, Error>>}
   */
  async extend(ttlMs = this.defaultTtlMs) {
    if (!this._hasKey('master') && !this._hasKey('duress')) {
      return Result.err(new Error('Session is not unlocked'));
    }
    this.expiresAt = Date.now() + ttlMs;
    return Result.ok(undefined);
  }

  isUnlocked() {
    return (this._hasKey('master') || this._hasKey('duress')) && !this.isExpired();
  }

  isExpired() {
    if (!this._hasKey('master') && !this._hasKey('duress')) {
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
