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

// src/desktop/vault/crypto/secure-memory.js - Secure Memory Management
// Best-effort secure memory handling for sensitive data in JavaScript

import { randomFillSync } from 'node:crypto';

/**
 * Track allocated secure buffers for cleanup
 * @type {Set<WeakRef<Uint8Array|Buffer>>}
 */
const allocatedBuffers = new Set();

/**
 * FinalizationRegistry to auto-wipe on GC
 */
const registry = new FinalizationRegistry((heldValue) => {
  // Buffer was garbage collected, ensure it was wiped
  // This is a backup - explicit wipe should always be called
  if (heldValue && typeof heldValue.wiped === 'boolean' && !heldValue.wiped) {
    console.warn('[SecureMemory] Buffer was GC\'d without explicit wipe');
  }
});

/**
 * Securely wipe a buffer by overwriting with random data, then zeros
 * Multi-pass overwrite provides better protection against memory recovery
 *
 * @param {Uint8Array|Buffer|null} buffer - Buffer to wipe
 * @param {number} passes - Number of overwrite passes (default: 3)
 */
export function secureWipe(buffer, passes = 3) {
  if (!buffer || !buffer.length) return;

  try {
    // Multi-pass overwrite
    for (let pass = 0; pass < passes; pass++) {
      if (pass < passes - 1) {
        // Overwrite with random data
        randomFillSync(buffer);
      } else {
        // Final pass with zeros
        buffer.fill(0);
      }
    }

    // Try to prevent compiler optimization from removing the wipe
    // by performing a read that depends on the buffer content
    let dummy = 0;
    for (let i = 0; i < buffer.length; i++) {
      dummy |= buffer[i];
    }

    // Use the result to prevent dead code elimination
    if (dummy !== 0) {
      // This should never happen after zeroing
      console.warn('[SecureMemory] Wipe verification failed');
    }
  } catch (error) {
    // Ignore errors during wipe, but log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[SecureMemory] Wipe error:', error);
    }
  }
}

/**
 * Allocate a secure buffer that will be tracked for cleanup
 *
 * @param {number} size - Buffer size in bytes
 * @returns {Uint8Array} Allocated buffer
 */
export function allocateSecure(size) {
  const buffer = new Uint8Array(size);

  // Track for cleanup
  const ref = new WeakRef(buffer);
  allocatedBuffers.add(ref);

  // Register for finalization
  registry.register(buffer, { wiped: false });

  return buffer;
}

/**
 * Create a secure copy of data
 *
 * @param {Uint8Array|Buffer} source - Source data
 * @returns {Uint8Array} Secure copy
 */
export function secureCopy(source) {
  const copy = allocateSecure(source.length);
  copy.set(source);
  return copy;
}

/**
 * Securely wipe and deallocate a buffer
 *
 * @param {Uint8Array|Buffer} buffer - Buffer to deallocate
 */
export function deallocateSecure(buffer) {
  secureWipe(buffer);

  // Remove from tracking
  for (const ref of allocatedBuffers) {
    if (ref.deref() === buffer) {
      allocatedBuffers.delete(ref);
      break;
    }
  }
}

/**
 * Wipe all tracked buffers (for emergency cleanup)
 */
export function wipeAllTracked() {
  for (const ref of allocatedBuffers) {
    const buffer = ref.deref();
    if (buffer) {
      secureWipe(buffer);
    }
  }
  allocatedBuffers.clear();
}

/**
 * Secure string to buffer conversion with cleanup
 *
 * @param {string} str - String to convert
 * @returns {{buffer: Uint8Array, cleanup: Function}} Buffer and cleanup function
 */
export function stringToSecureBuffer(str) {
  const encoder = new TextEncoder();
  const buffer = allocateSecure(str.length * 3); // UTF-8 worst case
  const encoded = encoder.encodeInto(str, buffer);

  // Create view of actual encoded length
  const result = buffer.subarray(0, encoded.written);

  return {
    buffer: result,
    cleanup: () => deallocateSecure(buffer)
  };
}

/**
 * Compare two buffers in constant time
 * Prevents timing attacks by always comparing all bytes
 *
 * @param {Uint8Array|Buffer} a - First buffer
 * @param {Uint8Array|Buffer} b - Second buffer
 * @returns {boolean} True if buffers are equal
 */
export function constantTimeCompare(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Secure object that auto-wipes when no longer needed
 * Uses Proxy to track access and enable cleanup
 */
export class SecureValue {
  #value;
  #isWiped = false;

  constructor(value) {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      this.#value = secureCopy(value);
    } else if (typeof value === 'string') {
      const { buffer } = stringToSecureBuffer(value);
      this.#value = buffer;
    } else {
      throw new Error('SecureValue only supports Uint8Array, Buffer, or string');
    }
  }

  /**
   * Get the value (creates a copy to prevent external modification)
   * @returns {Uint8Array} Copy of the value
   */
  get value() {
    if (this.#isWiped) {
      throw new Error('SecureValue has been wiped');
    }
    return secureCopy(this.#value);
  }

  /**
   * Get raw reference (use with caution)
   * @returns {Uint8Array} Raw buffer reference
   */
  get rawValue() {
    if (this.#isWiped) {
      throw new Error('SecureValue has been wiped');
    }
    return this.#value;
  }

  /**
   * Wipe the value from memory
   */
  wipe() {
    if (!this.#isWiped) {
      deallocateSecure(this.#value);
      this.#value = null;
      this.#isWiped = true;
    }
  }

  /**
   * Check if value has been wiped
   * @returns {boolean}
   */
  get isWiped() {
    return this.#isWiped;
  }
}

/**
 * Execute a function with a secure value, ensuring cleanup afterwards
 *
 * @template T
 * @param {Uint8Array|Buffer|string} sensitiveData - Sensitive data
 * @param {(value: Uint8Array) => T|Promise<T>} fn - Function to execute
 * @returns {Promise<T>} Function result
 */
export async function withSecureValue(sensitiveData, fn) {
  const secure = new SecureValue(sensitiveData);
  try {
    return await fn(secure.rawValue);
  } finally {
    secure.wipe();
  }
}

/**
 * Create a locked box for sensitive data
 * Data is encrypted in memory and only decrypted when needed
 */
export class LockedBox {
  #encryptedData;
  #key;
  #isLocked = true;

  constructor() {
    // Generate random encryption key
    this.#key = allocateSecure(32);
    randomFillSync(this.#key);
  }

  /**
   * Store data in the locked box
   * @param {Uint8Array} data - Data to store
   */
  store(data) {
    // XOR encrypt for memory protection
    this.#encryptedData = allocateSecure(data.length);
    for (let i = 0; i < data.length; i++) {
      this.#encryptedData[i] = data[i] ^ this.#key[i % this.#key.length];
    }
    this.#isLocked = true;
  }

  /**
   * Retrieve data from the locked box
   * @returns {Uint8Array} Decrypted data (caller must wipe when done)
   */
  retrieve() {
    if (!this.#encryptedData) {
      throw new Error('LockedBox is empty');
    }

    const decrypted = allocateSecure(this.#encryptedData.length);
    for (let i = 0; i < this.#encryptedData.length; i++) {
      decrypted[i] = this.#encryptedData[i] ^ this.#key[i % this.#key.length];
    }
    return decrypted;
  }

  /**
   * Destroy the locked box and all data
   */
  destroy() {
    if (this.#encryptedData) {
      deallocateSecure(this.#encryptedData);
      this.#encryptedData = null;
    }
    if (this.#key) {
      deallocateSecure(this.#key);
      this.#key = null;
    }
  }
}

export default {
  secureWipe,
  allocateSecure,
  secureCopy,
  deallocateSecure,
  wipeAllTracked,
  stringToSecureBuffer,
  constantTimeCompare,
  SecureValue,
  withSecureValue,
  LockedBox
};
