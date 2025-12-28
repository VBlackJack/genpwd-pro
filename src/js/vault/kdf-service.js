import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { KdfService } from './interfaces.js';
import { KdfParams, VAULT_DOMAIN_CONSTANTS } from './models.js';

const scrypt = promisify(scryptCallback);
const DEFAULT_SALT_LENGTH = 16;
const DEFAULT_ITERATIONS = 65536; // Must be power of two for scrypt N parameter.
const DEFAULT_PARALLELISM = 1;
const DEFAULT_MEMORY_KB = 65536; // 64 MB effective target.

// SECURITY: Maximum bounds to prevent integer overflow and DoS
const MAX_MEMORY_KB = 1024 * 1024; // 1 GB maximum
const MAX_ITERATIONS = 2 ** 24;    // ~16 million iterations max
const MAX_PARALLELISM = 16;        // Reasonable parallelism limit
const MIN_SALT_LENGTH = 8;         // Minimum salt length

function computeBlockSize(memoryKb, iterations) {
  const bytes = memoryKb * 1024;
  const blockSize = Math.max(1, Math.round(bytes / (128 * iterations)));
  return blockSize;
}

function normalizePassphrase(passphrase) {
  if (passphrase instanceof Uint8Array) {
    return passphrase;
  }
  if (typeof passphrase === 'string') {
    return new TextEncoder().encode(passphrase);
  }
  throw new TypeError('Passphrase must be string or Uint8Array');
}

export class ScryptKdfService extends KdfService {
  constructor({ keyLength = 32 } = {}) {
    super();
    this.keyLength = keyLength;
  }

  createParams({
    salt = randomBytes(DEFAULT_SALT_LENGTH),
    memoryKb = DEFAULT_MEMORY_KB,
    iterations = DEFAULT_ITERATIONS,
    parallelism = DEFAULT_PARALLELISM
  } = {}) {
    // Validate iterations (must be power of two and within bounds)
    if (!Number.isInteger(iterations) || iterations <= 0 || (iterations & (iterations - 1)) !== 0) {
      throw new TypeError('Scrypt iterations must be a power of two greater than zero');
    }
    if (iterations > MAX_ITERATIONS) {
      throw new RangeError(`Scrypt iterations exceeds maximum (${MAX_ITERATIONS})`);
    }

    // Validate memory (must be positive and within bounds)
    if (!Number.isFinite(memoryKb) || memoryKb <= 0) {
      throw new TypeError('Scrypt memoryKb must be greater than zero');
    }
    if (memoryKb > MAX_MEMORY_KB) {
      throw new RangeError(`Scrypt memoryKb exceeds maximum (${MAX_MEMORY_KB} KB / 1 GB)`);
    }

    // Validate parallelism (must be positive integer within bounds)
    if (!Number.isInteger(parallelism) || parallelism <= 0) {
      throw new TypeError('Scrypt parallelism must be a positive integer');
    }
    if (parallelism > MAX_PARALLELISM) {
      throw new RangeError(`Scrypt parallelism exceeds maximum (${MAX_PARALLELISM})`);
    }

    // Validate salt
    if (!(salt instanceof Uint8Array)) {
      salt = new Uint8Array(salt);
    }
    if (salt.length < MIN_SALT_LENGTH) {
      throw new RangeError(`Salt must be at least ${MIN_SALT_LENGTH} bytes`);
    }

    return new KdfParams({
      algorithm: VAULT_DOMAIN_CONSTANTS.KDF_ALGORITHMS.SCRYPT,
      memoryKb,
      iterations,
      parallelism,
      salt: new Uint8Array(salt)
    });
  }

  async deriveKey(passphrase, params, length = this.keyLength) {
    if (!(params instanceof KdfParams)) {
      throw new TypeError('Expected KdfParams instance');
    }
    if (params.algorithm !== VAULT_DOMAIN_CONSTANTS.KDF_ALGORITHMS.SCRYPT) {
      throw new Error(`Unsupported KDF algorithm: ${params.algorithm}`);
    }
    const N = params.iterations;
    const r = computeBlockSize(params.memoryKb, params.iterations);
    const p = params.parallelism;
    const maxmem = Math.max(32 * 1024 * 1024, params.memoryKb * 1024 * 2);
    const derived = await scrypt(normalizePassphrase(passphrase), Buffer.from(params.salt), length, {
      N,
      r,
      p,
      maxmem
    });
    return new Uint8Array(derived);
  }
}

export const DefaultKdfService = ScryptKdfService;
