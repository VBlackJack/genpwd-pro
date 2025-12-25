import { KEYSET_ENVELOPE } from '../config/crypto-constants.js';

const KEYSET_ENVELOPE_VERSION = KEYSET_ENVELOPE.VERSION;
const KEYSET_ENVELOPE_IV_BYTES = KEYSET_ENVELOPE.IV_BYTES;

let tinkModulePromise = null;
let cryptoModulePromise = null;

function ensureSelf() {
  if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
  }
}

async function getTink() {
  if (!tinkModulePromise) {
    ensureSelf();
    tinkModulePromise = import('tink-crypto')
      .then((module) => {
        module.aead.register();
        return module;
      })
      .catch((error) => {
        // Reset promise so next call will retry
        tinkModulePromise = null;
        throw new Error(`Failed to load tink-crypto module: ${error.message}`);
      });
  }
  return tinkModulePromise;
}

async function getCryptoApi() {
  if (globalThis.crypto && typeof globalThis.crypto.subtle !== 'undefined') {
    return globalThis.crypto;
  }
  if (!cryptoModulePromise) {
    cryptoModulePromise = import('node:crypto')
      .then(({ webcrypto }) => webcrypto)
      .catch((error) => {
        // Reset promise so next call will retry
        cryptoModulePromise = null;
        throw new Error(`Failed to load node:crypto module: ${error.message}`);
      });
  }
  return cryptoModulePromise;
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  throw new TypeError('Expected Uint8Array, ArrayBufferView or string');
}

function normalizeKeyEncryptionKey(key) {
  if (!(key instanceof Uint8Array)) {
    throw new TypeError('keyEncryptionKey must be a Uint8Array');
  }
  if (key.length < 16) {
    throw new TypeError('keyEncryptionKey must be at least 16 bytes');
  }
  return new Uint8Array(key);
}

function wipeBytes(bytes) {
  if (bytes && bytes.fill) {
    bytes.fill(0);
  }
}

async function importAesGcmKey(rawKey, usages) {
  const cryptoApi = await getCryptoApi();
  return cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, usages);
}

async function encryptKeyMaterial(plaintext, keyEncryptionKey, associatedData = new Uint8Array()) {
  const cryptoApi = await getCryptoApi();
  const keyMaterial = toUint8Array(plaintext);
  const kek = normalizeKeyEncryptionKey(keyEncryptionKey);
  const ad = toUint8Array(associatedData);
  const cryptoKey = await importAesGcmKey(kek, ['encrypt']);
  const iv = cryptoApi.getRandomValues(new Uint8Array(KEYSET_ENVELOPE_IV_BYTES));
  const ciphertextBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: ad },
    cryptoKey,
    keyMaterial
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const result = new Uint8Array(1 + KEYSET_ENVELOPE_IV_BYTES + ciphertext.length);
  result[0] = KEYSET_ENVELOPE_VERSION;
  result.set(iv, 1);
  result.set(ciphertext, 1 + KEYSET_ENVELOPE_IV_BYTES);
  wipeBytes(kek);
  wipeBytes(keyMaterial);
  return result;
}

async function decryptKeyMaterial(encrypted, keyEncryptionKey, associatedData = new Uint8Array()) {
  const cryptoApi = await getCryptoApi();
  const payload = toUint8Array(encrypted);
  if (payload.length <= 1 + KEYSET_ENVELOPE_IV_BYTES) {
    throw new Error('Encrypted keyset payload is too short');
  }
  const version = payload[0];
  if (version !== KEYSET_ENVELOPE_VERSION) {
    throw new Error(`Unsupported encrypted keyset version: ${version}`);
  }
  const iv = payload.slice(1, 1 + KEYSET_ENVELOPE_IV_BYTES);
  const ciphertext = payload.slice(1 + KEYSET_ENVELOPE_IV_BYTES);
  const kek = normalizeKeyEncryptionKey(keyEncryptionKey);
  const ad = toUint8Array(associatedData);
  const cryptoKey = await importAesGcmKey(kek, ['decrypt']);
  try {
    const plaintextBuffer = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: ad },
      cryptoKey,
      ciphertext
    );
    const plaintext = new Uint8Array(plaintextBuffer);
    wipeBytes(kek);
    return plaintext;
  } catch (cause) {
    wipeBytes(kek);
    const error = new Error('Unable to decrypt keyset');
    error.cause = cause;
    throw error;
  }
}

export class TinkAeadCryptoEngine extends CryptoEngine {
  constructor(keysetHandle, tink) {
    super();
    this.keysetHandle = keysetHandle;
    this.tink = tink;
    this.primitivePromise = this.keysetHandle.getPrimitive(this.tink.aead.Aead);
  }

  static async generateKeyset({ keyEncryptionKey, associatedData = new Uint8Array() } = {}) {
    if (!keyEncryptionKey) {
      throw new TypeError('keyEncryptionKey is required to generate a secure keyset');
    }
    const tink = await getTink();
    const handle = await tink.generateNewKeysetHandle(tink.aead.aes256GcmKeyTemplate());
    const serialized = tink.binaryInsecure.serializeKeyset(handle);
    try {
      const encryptedKeyset = await encryptKeyMaterial(serialized, keyEncryptionKey, associatedData);
      return { keysetHandle: handle, encryptedKeyset };
    } finally {
      wipeBytes(serialized);
    }
  }

  static async fromEncryptedKeyset(encryptedKeyset, keyEncryptionKey, associatedData = new Uint8Array()) {
    if (!encryptedKeyset) {
      throw new TypeError('encryptedKeyset is required');
    }
    if (!keyEncryptionKey) {
      throw new TypeError('keyEncryptionKey is required to decrypt the keyset');
    }
    const tink = await getTink();
    const serialized = await decryptKeyMaterial(encryptedKeyset, keyEncryptionKey, associatedData);
    try {
      const keyset = tink.binaryInsecure.deserializeKeyset(serialized);
      return new TinkAeadCryptoEngine(keyset, tink);
    } finally {
      wipeBytes(serialized);
    }
  }

  static async fromKeysetHandle(keysetHandle) {
    const tink = await getTink();
    return new TinkAeadCryptoEngine(keysetHandle, tink);
  }

  async serializeKeyset(keyEncryptionKey, associatedData = new Uint8Array()) {
    if (!keyEncryptionKey) {
      throw new TypeError('keyEncryptionKey is required to serialize the keyset');
    }
    const serialized = this.tink.binaryInsecure.serializeKeyset(this.keysetHandle);
    try {
      return await encryptKeyMaterial(serialized, keyEncryptionKey, associatedData);
    } finally {
      wipeBytes(serialized);
    }
  }

  async encrypt(plaintext, associatedData = new Uint8Array()) {
    const primitive = await this.primitivePromise;
    return primitive.encrypt(toUint8Array(plaintext), toUint8Array(associatedData));
  }

  async decrypt(ciphertext, associatedData = new Uint8Array()) {
    const primitive = await this.primitivePromise;
    return primitive.decrypt(toUint8Array(ciphertext), toUint8Array(associatedData));
  }
}

// NOTE: createCryptoEngineFromMasterKey was removed as dead code.
// If needed, use: TinkAeadCryptoEngine.fromEncryptedKeyset(encryptedKeyset, keyEncryptionKey, associatedData)
