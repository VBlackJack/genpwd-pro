import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { KdfService } from './interfaces.js';
import { KdfParams, VAULT_DOMAIN_CONSTANTS } from './models.js';

const scrypt = promisify(scryptCallback);
const DEFAULT_SALT_LENGTH = 16;
const DEFAULT_ITERATIONS = 65536; // Must be power of two for scrypt N parameter.
const DEFAULT_PARALLELISM = 1;
const DEFAULT_MEMORY_KB = 65536; // 64 MB effective target.

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
    if (!Number.isInteger(iterations) || iterations <= 0 || (iterations & (iterations - 1)) !== 0) {
      throw new TypeError('Scrypt iterations must be a power of two greater than zero');
    }
    if (!Number.isFinite(memoryKb) || memoryKb <= 0) {
      throw new TypeError('Scrypt memoryKb must be greater than zero');
    }
    if (!Number.isInteger(parallelism) || parallelism <= 0) {
      throw new TypeError('Scrypt parallelism must be a positive integer');
    }
    if (!(salt instanceof Uint8Array)) {
      salt = new Uint8Array(salt);
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
