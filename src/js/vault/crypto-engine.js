import { CryptoEngine } from './interfaces.js';

let tinkModulePromise = null;

function ensureSelf() {
  if (typeof globalThis.self === 'undefined') {
    globalThis.self = globalThis;
  }
}

async function getTink() {
  if (!tinkModulePromise) {
    ensureSelf();
    tinkModulePromise = import('tink-crypto').then((module) => {
      module.aead.register();
      return module;
    });
  }
  return tinkModulePromise;
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

export class TinkAeadCryptoEngine extends CryptoEngine {
  constructor(keysetHandle, tink) {
    super();
    this.keysetHandle = keysetHandle;
    this.tink = tink;
    this.primitivePromise = this.keysetHandle.getPrimitive(this.tink.aead.Aead);
  }

  static async generateKeyset() {
    const tink = await getTink();
    const handle = await tink.generateNewKeysetHandle(tink.aead.aes256GcmKeyTemplate());
    const serialized = tink.binaryInsecure.serializeKeyset(handle);
    return { keysetHandle: handle, serializedKeyset: serialized };
  }

  static async fromSerializedKeyset(serializedKeyset) {
    const tink = await getTink();
    const keyset = tink.binaryInsecure.deserializeKeyset(toUint8Array(serializedKeyset));
    return new TinkAeadCryptoEngine(keyset, tink);
  }

  static async fromKeysetHandle(keysetHandle) {
    const tink = await getTink();
    return new TinkAeadCryptoEngine(keysetHandle, tink);
  }

  serializeKeyset() {
    return this.tink.binaryInsecure.serializeKeyset(this.keysetHandle);
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

export async function createCryptoEngineFromMasterKey(serializedKeyset) {
  return TinkAeadCryptoEngine.fromSerializedKeyset(serializedKeyset);
}
