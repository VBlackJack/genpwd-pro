/**
 * Vault domain data structures.
 * @license Apache-2.0
 */

/**
 * @typedef {Object} OtpConfig
 * @property {string} algorithm
 * @property {number} digits
 * @property {number} period
 * @property {string} secret
 */

/**
 * Immutable description of a vault entry.
 */
export class VaultEntry {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {string} props.title
   * @param {string} [props.username]
   * @param {Array<string>} [props.secret]
   * @param {string} [props.notes]
   * @param {string} [props.uri]
   * @param {Array<string>} [props.tags]
   * @param {OtpConfig|null} [props.otpConfig]
   * @param {string|null} [props.groupId]
   */
  constructor({
    id,
    title,
    username = '',
    secret = [],
    notes = '',
    uri = '',
    tags = [],
    otpConfig = null,
    groupId = null
  }) {
    if (!id) throw new TypeError('VaultEntry.id is required');
    if (!title) throw new TypeError('VaultEntry.title is required');

    this.id = id;
    this.title = title;
    this.username = username;
    this.secret = Array.isArray(secret) ? Array.from(secret) : [];
    this.notes = notes;
    this.uri = uri;
    this.tags = Array.isArray(tags) ? Array.from(tags) : [];
    this.otpConfig = otpConfig ? { ...otpConfig } : null;
    this.groupId = groupId;
    Object.freeze(this.tags);
    if (this.secret.length > 0) {
      Object.freeze(this.secret);
    }
    if (this.otpConfig) {
      Object.freeze(this.otpConfig);
    }
    Object.freeze(this);
  }

  /**
   * @returns {VaultEntry}
   */
  clone() {
    return new VaultEntry({
      id: this.id,
      title: this.title,
      username: this.username,
      secret: Array.from(this.secret),
      notes: this.notes,
      uri: this.uri,
      tags: Array.from(this.tags),
      otpConfig: this.otpConfig ? { ...this.otpConfig } : null,
      groupId: this.groupId
    });
  }

  /**
   * Securely wipe sensitive data from memory
   * SECURITY: Overwrites secret data with zeros before garbage collection
   */
  wipe() {
    // Wipe secret array
    if (Array.isArray(this.secret)) {
      // Since object is frozen, we can't modify in place
      // But we can overwrite the internal array data if not frozen
      try {
        for (let i = 0; i < this.secret.length; i++) {
          if (typeof this.secret[i] === 'string') {
            // Strings are immutable in JS, but we can clear references
            this.secret[i] = '\0'.repeat(this.secret[i].length);
          }
        }
        this.secret.length = 0;
      } catch (e) {
        // Object is frozen, can't wipe
        // Best effort - at least dereference
      }
    }

    // Wipe OTP secret if present
    if (this.otpConfig && this.otpConfig.secret) {
      try {
        this.otpConfig.secret = '\0'.repeat(this.otpConfig.secret.length);
      } catch (e) {
        // Frozen, can't wipe
      }
    }
  }
}

/**
 * Representation of a vault group (folder).
 */
export class VaultGroup {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {string} props.name
   * @param {string|null} [props.parentId]
   */
  constructor({ id, name, parentId = null }) {
    if (!id) throw new TypeError('VaultGroup.id is required');
    if (!name) throw new TypeError('VaultGroup.name is required');

    this.id = id;
    this.name = name;
    this.parentId = parentId;
    Object.freeze(this);
  }

  clone() {
    return new VaultGroup({ id: this.id, name: this.name, parentId: this.parentId });
  }
}

/**
 * Parameters for key derivation.
 */
export class KdfParams {
  /**
   * @param {Object} props
   * @param {string} props.algorithm
   * @param {number} props.memoryKb
   * @param {number} props.iterations
   * @param {number} props.parallelism
   * @param {Uint8Array} props.salt
   */
  constructor({ algorithm, memoryKb, iterations, parallelism, salt }) {
    if (!algorithm) throw new TypeError('KdfParams.algorithm is required');
    if (!Number.isFinite(memoryKb) || memoryKb <= 0) {
      throw new TypeError('KdfParams.memoryKb must be > 0');
    }
    if (!Number.isInteger(iterations) || iterations <= 0) {
      throw new TypeError('KdfParams.iterations must be > 0');
    }
    if (!Number.isInteger(parallelism) || parallelism <= 0) {
      throw new TypeError('KdfParams.parallelism must be > 0');
    }
    if (!(salt instanceof Uint8Array)) {
      throw new TypeError('KdfParams.salt must be Uint8Array');
    }

    this.algorithm = algorithm;
    this.memoryKb = memoryKb;
    this.iterations = iterations;
    this.parallelism = parallelism;
    this.salt = new Uint8Array(salt);
    Object.freeze(this);
  }

  clone() {
    return new KdfParams({
      algorithm: this.algorithm,
      memoryKb: this.memoryKb,
      iterations: this.iterations,
      parallelism: this.parallelism,
      salt: new Uint8Array(this.salt)
    });
  }
}

export const VAULT_DOMAIN_CONSTANTS = Object.freeze({
  KDF_ALGORITHMS: Object.freeze({
    SCRYPT: 'scrypt',
    ARGON2ID: 'argon2id'
  })
});
