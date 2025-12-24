/**
 * Vault domain data structures.
 * @license Apache-2.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {'login' | 'card' | 'identity' | 'note' | 'ssh' | 'preset'} EntryType
 */

/**
 * @typedef {'text' | 'hidden' | 'url' | 'email' | 'date' | 'phone' | 'password'} FieldKind
 */

/**
 * @typedef {Object} CustomField
 * @property {string} id - Unique identifier for the field
 * @property {string} label - Display label (e.g., "Security Question")
 * @property {string} value - Field value
 * @property {FieldKind} kind - Type of field for UI rendering
 * @property {boolean} isSecured - If true, value should be masked and wiped from memory
 */

/**
 * @typedef {Object} EntryMetadata
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {number|null} lastUsedAt - Last usage timestamp
 * @property {number|null} expiresAt - Expiration timestamp for passwords
 * @property {number} usageCount - Number of times this entry was used
 */

/**
 * @typedef {Object} OtpConfig
 * @property {string} algorithm
 * @property {number} digits
 * @property {number} period
 * @property {string} secret
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Valid entry types
 * Note: Values aligned with vault-types.js and vault-ui.js
 * - 'card' (not 'credit_card')
 * - 'note' (not 'secure_note')
 */
export const ENTRY_TYPES = Object.freeze({
  // Primary types (canonical names)
  LOGIN: 'login',
  CARD: 'card',
  IDENTITY: 'identity',
  NOTE: 'note',
  SSH: 'ssh',
  PRESET: 'preset',
  // Legacy aliases for backwards compatibility
  CREDIT_CARD: 'card',
  SECURE_NOTE: 'note'
});

/**
 * Valid field kinds
 */
export const FIELD_KINDS = Object.freeze({
  TEXT: 'text',
  HIDDEN: 'hidden',
  URL: 'url',
  EMAIL: 'email',
  DATE: 'date',
  PHONE: 'phone',
  PASSWORD: 'password'
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a UUID v4
 * @returns {string}
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback using crypto.getRandomValues (CSPRNG)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/**
 * Deep freeze an object recursively
 * @param {any} obj
 * @returns {any}
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze arrays
  if (Array.isArray(obj)) {
    obj.forEach(item => deepFreeze(item));
    return Object.freeze(obj);
  }

  // Freeze object properties
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return Object.freeze(obj);
}

/**
 * Deep clone an object
 * @param {any} obj
 * @returns {any}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Uint8Array) {
    return new Uint8Array(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }

  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });
  return cloned;
}

/**
 * Securely overwrite a string in memory (best effort in JS)
 * @param {string} str
 * @returns {string}
 */
function secureWipeString(str) {
  if (typeof str !== 'string') return '';
  return '\0'.repeat(str.length);
}

// ============================================================================
// VAULT ENTRY CLASS
// ============================================================================

/**
 * Immutable description of a vault entry.
 * Supports multiple entry types (login, credit card, identity, secure note)
 * with custom fields, metadata, and visual customization.
 */
export class VaultEntry {
  /**
   * @param {Object} props
   * @param {string} props.id - Unique identifier (required)
   * @param {string} props.title - Entry title (required)
   * @param {EntryType} [props.type='login'] - Entry type
   * @param {string} [props.username] - Username/login
   * @param {Array<string>} [props.secret] - Password/secret data (array for history)
   * @param {string} [props.notes] - Notes
   * @param {string} [props.uri] - Associated URL
   * @param {Array<string>} [props.tags] - Tags for categorization
   * @param {OtpConfig|null} [props.otpConfig] - TOTP configuration
   * @param {string|null} [props.folderId] - Parent folder ID
   * @param {Array<CustomField>} [props.fields] - Custom fields
   * @param {EntryMetadata} [props.metadata] - Entry metadata
   * @param {string|null} [props.color] - Visual color code
   * @param {string|null} [props.icon] - Custom icon identifier
   */
  constructor({
    id,
    title,
    type = ENTRY_TYPES.LOGIN,
    username = '',
    secret = [],
    notes = '',
    uri = '',
    tags = [],
    otpConfig = null,
    folderId = null,
    fields = [],
    metadata = null,
    color = null,
    icon = null
  }) {
    // ===================
    // REQUIRED FIELDS
    // ===================
    if (!id || typeof id !== 'string') {
      throw new TypeError('VaultEntry.id is required and must be a string');
    }
    if (!title || typeof title !== 'string') {
      throw new TypeError('VaultEntry.title is required and must be a string');
    }

    // ===================
    // TYPE VALIDATION
    // ===================
    const validTypes = Object.values(ENTRY_TYPES);
    if (!validTypes.includes(type)) {
      throw new TypeError(`VaultEntry.type must be one of: ${validTypes.join(', ')}`);
    }

    // ===================
    // FIELDS VALIDATION
    // ===================
    if (!Array.isArray(fields)) {
      throw new TypeError('VaultEntry.fields must be an array');
    }
    const validFieldKinds = Object.values(FIELD_KINDS);
    const validatedFields = fields.map((field, index) => {
      if (!field || typeof field !== 'object') {
        throw new TypeError(`VaultEntry.fields[${index}] must be an object`);
      }

      const fieldId = field.id || generateUUID();
      const label = field.label || '';
      const value = field.value || '';
      const kind = field.kind || FIELD_KINDS.TEXT;
      const isSecured = Boolean(field.isSecured);

      if (typeof label !== 'string') {
        throw new TypeError(`VaultEntry.fields[${index}].label must be a string`);
      }
      if (typeof value !== 'string') {
        throw new TypeError(`VaultEntry.fields[${index}].value must be a string`);
      }
      if (!validFieldKinds.includes(kind)) {
        throw new TypeError(`VaultEntry.fields[${index}].kind must be one of: ${validFieldKinds.join(', ')}`);
      }

      return {
        id: fieldId,
        label,
        value,
        kind,
        isSecured
      };
    });

    // ===================
    // METADATA VALIDATION & DEFAULTS
    // ===================
    const now = Date.now();
    let validatedMetadata;

    if (metadata === null || metadata === undefined) {
      // Backward compatibility: create default metadata
      validatedMetadata = {
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
        expiresAt: null,
        usageCount: 0
      };
    } else {
      if (typeof metadata !== 'object') {
        throw new TypeError('VaultEntry.metadata must be an object');
      }

      const createdAt = metadata.createdAt ?? now;
      const updatedAt = metadata.updatedAt ?? now;
      const lastUsedAt = metadata.lastUsedAt ?? null;
      const expiresAt = metadata.expiresAt ?? null;
      const usageCount = metadata.usageCount ?? 0;

      // Type validation for metadata fields
      if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
        throw new TypeError('VaultEntry.metadata.createdAt must be a finite number');
      }
      if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
        throw new TypeError('VaultEntry.metadata.updatedAt must be a finite number');
      }
      if (lastUsedAt !== null && (typeof lastUsedAt !== 'number' || !Number.isFinite(lastUsedAt))) {
        throw new TypeError('VaultEntry.metadata.lastUsedAt must be null or a finite number');
      }
      if (expiresAt !== null && (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt))) {
        throw new TypeError('VaultEntry.metadata.expiresAt must be null or a finite number');
      }
      if (typeof usageCount !== 'number' || !Number.isInteger(usageCount) || usageCount < 0) {
        throw new TypeError('VaultEntry.metadata.usageCount must be a non-negative integer');
      }

      validatedMetadata = {
        createdAt,
        updatedAt,
        lastUsedAt,
        expiresAt,
        usageCount
      };
    }

    // ===================
    // OPTIONAL FIELDS VALIDATION
    // ===================
    if (color !== null && typeof color !== 'string') {
      throw new TypeError('VaultEntry.color must be null or a string');
    }
    if (icon !== null && typeof icon !== 'string') {
      throw new TypeError('VaultEntry.icon must be null or a string');
    }

    // ===================
    // ASSIGN PROPERTIES
    // ===================
    this.id = id;
    this.title = title;
    this.type = type;
    this.username = String(username);
    this.secret = Array.isArray(secret) ? Array.from(secret) : [];
    this.notes = String(notes);
    this.uri = String(uri);
    this.tags = Array.isArray(tags) ? Array.from(tags) : [];
    this.otpConfig = otpConfig ? { ...otpConfig } : null;
    this.folderId = folderId;
    this.fields = validatedFields;
    this.metadata = validatedMetadata;
    this.color = color;
    this.icon = icon;

    // ===================
    // DEEP FREEZE ALL
    // ===================
    deepFreeze(this.secret);
    deepFreeze(this.tags);
    deepFreeze(this.otpConfig);
    deepFreeze(this.fields);
    deepFreeze(this.metadata);
    Object.freeze(this);
  }

  /**
   * Check if the entry password has expired
   * @returns {boolean}
   */
  isExpired() {
    if (!this.metadata.expiresAt) {
      return false;
    }
    return Date.now() > this.metadata.expiresAt;
  }

  /**
   * Check if the entry will expire within the specified days
   * @param {number} days
   * @returns {boolean}
   */
  willExpireIn(days) {
    if (!this.metadata.expiresAt) {
      return false;
    }
    const threshold = Date.now() + (days * 24 * 60 * 60 * 1000);
    return this.metadata.expiresAt <= threshold;
  }

  /**
   * Get all secured custom fields
   * @returns {Array<CustomField>}
   */
  getSecuredFields() {
    return this.fields.filter(field => field.isSecured);
  }

  /**
   * Get a custom field by its ID
   * @param {string} fieldId
   * @returns {CustomField|undefined}
   */
  getFieldById(fieldId) {
    return this.fields.find(field => field.id === fieldId);
  }

  /**
   * Get a custom field by its label
   * @param {string} label
   * @returns {CustomField|undefined}
   */
  getFieldByLabel(label) {
    return this.fields.find(field => field.label === label);
  }

  /**
   * Create a deep clone of this entry
   * @returns {VaultEntry}
   */
  clone() {
    return new VaultEntry({
      id: this.id,
      title: this.title,
      type: this.type,
      username: this.username,
      secret: Array.from(this.secret),
      notes: this.notes,
      uri: this.uri,
      tags: Array.from(this.tags),
      otpConfig: this.otpConfig ? deepClone(this.otpConfig) : null,
      folderId: this.folderId,
      fields: deepClone(this.fields),
      metadata: deepClone(this.metadata),
      color: this.color,
      icon: this.icon
    });
  }

  /**
   * Create a copy with updated properties
   * Automatically updates metadata.updatedAt
   * @param {Partial<VaultEntry>} updates
   * @returns {VaultEntry}
   */
  copyWith(updates) {
    const now = Date.now();
    const newMetadata = {
      ...deepClone(this.metadata),
      updatedAt: now,
      ...(updates.metadata ? deepClone(updates.metadata) : {})
    };

    return new VaultEntry({
      id: this.id,
      title: this.title,
      type: this.type,
      username: this.username,
      secret: Array.from(this.secret),
      notes: this.notes,
      uri: this.uri,
      tags: Array.from(this.tags),
      otpConfig: this.otpConfig ? deepClone(this.otpConfig) : null,
      folderId: this.folderId,
      fields: deepClone(this.fields),
      metadata: newMetadata,
      color: this.color,
      icon: this.icon,
      ...updates
    });
  }

  /**
   * Record a usage of this entry
   * Updates lastUsedAt and increments usageCount
   * @returns {VaultEntry}
   */
  recordUsage() {
    const now = Date.now();
    return this.copyWith({
      metadata: {
        ...this.metadata,
        lastUsedAt: now,
        usageCount: this.metadata.usageCount + 1
      }
    });
  }

  /**
   * Securely wipe sensitive data from memory
   * SECURITY: Overwrites secret data with zeros before garbage collection
   * This includes the main secret, OTP secret, and all secured custom fields
   */
  wipe() {
    // Wipe secret array
    if (Array.isArray(this.secret)) {
      try {
        for (let i = 0; i < this.secret.length; i++) {
          if (typeof this.secret[i] === 'string') {
            this.secret[i] = secureWipeString(this.secret[i]);
          }
        }
        this.secret.length = 0;
      } catch (e) {
        // Object is frozen, can't wipe in place
        // Best effort - at least we tried to overwrite
      }
    }

    // Wipe OTP secret if present
    if (this.otpConfig && this.otpConfig.secret) {
      try {
        this.otpConfig.secret = secureWipeString(this.otpConfig.secret);
      } catch (e) {
        // Frozen, can't wipe
      }
    }

    // Wipe secured custom fields
    if (Array.isArray(this.fields)) {
      try {
        for (const field of this.fields) {
          if (field.isSecured && typeof field.value === 'string') {
            field.value = secureWipeString(field.value);
          }
        }
      } catch (e) {
        // Frozen, can't wipe
      }
    }

    // Wipe username (often sensitive)
    if (this.username) {
      try {
        this.username = secureWipeString(this.username);
      } catch (e) {
        // Frozen
      }
    }

    // Wipe notes (may contain sensitive info)
    if (this.notes) {
      try {
        this.notes = secureWipeString(this.notes);
      } catch (e) {
        // Frozen
      }
    }
  }

  /**
   * Convert to a plain object (for serialization)
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      username: this.username,
      secret: Array.from(this.secret),
      notes: this.notes,
      uri: this.uri,
      tags: Array.from(this.tags),
      otpConfig: this.otpConfig ? { ...this.otpConfig } : null,
      folderId: this.folderId,
      fields: deepClone(this.fields),
      metadata: deepClone(this.metadata),
      color: this.color,
      icon: this.icon
    };
  }

  /**
   * Create a VaultEntry from a plain object
   * @param {Object} obj
   * @returns {VaultEntry}
   */
  static fromJSON(obj) {
    return new VaultEntry(obj);
  }
}

// ============================================================================
// VAULT GROUP CLASS
// ============================================================================

/**
 * Representation of a vault group (folder).
 */
export class VaultGroup {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {string} props.name
   * @param {string|null} [props.parentId]
   * @param {string|null} [props.icon]
   * @param {string|null} [props.color]
   */
  constructor({ id, name, parentId = null, icon = null, color = null }) {
    if (!id) throw new TypeError('VaultGroup.id is required');
    if (!name) throw new TypeError('VaultGroup.name is required');

    this.id = id;
    this.name = name;
    this.parentId = parentId;
    this.icon = icon;
    this.color = color;
    Object.freeze(this);
  }

  clone() {
    return new VaultGroup({
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      icon: this.icon,
      color: this.color
    });
  }

  /**
   * Create a copy with updated properties
   * @param {Partial<VaultGroup>} updates
   * @returns {VaultGroup}
   */
  copyWith(updates) {
    return new VaultGroup({
      id: this.id,
      name: this.name,
      parentId: this.parentId,
      icon: this.icon,
      color: this.color,
      ...updates
    });
  }
}

// ============================================================================
// KDF PARAMS CLASS
// ============================================================================

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

// ============================================================================
// CONSTANTS EXPORT
// ============================================================================

export const VAULT_DOMAIN_CONSTANTS = Object.freeze({
  KDF_ALGORITHMS: Object.freeze({
    SCRYPT: 'scrypt',
    ARGON2ID: 'argon2id'
  }),
  ENTRY_TYPES,
  FIELD_KINDS
});
