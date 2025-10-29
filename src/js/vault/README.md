# Vault domain module

The vault module provides the core abstractions required to implement a secure
password vault. It introduces domain models, repository contracts and
infrastructure adapters that can be re-used by both web and mobile
implementations.

## Overview

- **Domain models** – immutable representations of vault entries, groups and
  key-derivation parameters.
- **Interfaces** – abstract contracts for repositories, cryptographic engines,
  KDF services and session management.
- **Implementations**
  - `InMemoryVaultRepository` – simple repository useful for tests and prototypes.
  - `TinkAeadCryptoEngine` – AEAD encryption/decryption powered by Google Tink
    (AES-256-GCM).
  - `ScryptKdfService` – derives master keys with the Scrypt algorithm.
  - `InMemorySessionManager` – manages a master key in memory with TTL and
    biometric gating hooks.

The storage layer remains abstract. Future work can plug in persistent
implementations (Room + SQLCipher, IndexedDB, etc.) while re-using the same
interfaces and test suite.

## Usage

```js
import {
  TinkAeadCryptoEngine,
  ScryptKdfService,
  InMemorySessionManager
} from '../vault/index.js';

const { serializedKeyset } = await TinkAeadCryptoEngine.generateKeyset();
const crypto = await TinkAeadCryptoEngine.fromSerializedKeyset(serializedKeyset);
const kdf = new ScryptKdfService();
const params = kdf.createParams();
const masterKey = await kdf.deriveKey('passphrase', params);

const session = new InMemorySessionManager();
await session.storeKey(masterKey, 60_000);
```

See `src/js/vault/tests/contract-tests.js` for more detailed usage examples.
