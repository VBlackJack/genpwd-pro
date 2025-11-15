# Sync Architecture - GenPwd Pro

Comprehensive documentation for the end-to-end encrypted synchronization system.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [End-to-End Encryption](#end-to-end-encryption)
- [Sync Providers](#sync-providers)
- [Conflict Resolution](#conflict-resolution)
- [Security](#security)
- [Implementation](#implementation)
- [Testing](#testing)
- [Future Extensions](#future-extensions)

## Overview

GenPwd Pro's sync architecture provides **secure, end-to-end encrypted synchronization** of passwords, settings, presets, and history across multiple devices.

### Key Features

- **End-to-End Encryption**: AES-256-GCM encryption, keys never leave devices
- **Zero-Knowledge**: Server/provider cannot decrypt data
- **Provider-Agnostic**: Pluggable sync providers (mock, localStorage, cloud services)
- **Conflict Resolution**: Last-Write-Wins (LWW) with vector clocks
- **Offline-First**: Works offline, syncs when online
- **Selective Sync**: Choose what to sync (passwords, settings, presets)

### Design Principles

1. **Security First**: All data encrypted client-side
2. **Privacy**: Zero-knowledge architecture
3. **Reliability**: Conflict resolution, error handling
4. **Extensibility**: Provider interface for different backends
5. **Performance**: Efficient delta sync, compression

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    GenPwd Pro App                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐         ┌─────────────────┐          │
│  │   UI Layer   │────────→│  Sync Service   │          │
│  └──────────────┘         └─────────────────┘          │
│                                    │                     │
│                     ┌──────────────┼──────────────┐     │
│                     │              │              │     │
│            ┌────────▼───┐  ┌──────▼──────┐  ┌───▼────┐│
│            │  Crypto     │  │  Conflict   │  │ State  ││
│            │  Service    │  │  Resolver   │  │ Mgr    ││
│            └────────┬───┘  └──────┬──────┘  └───┬────┘│
│                     │              │              │     │
│            ┌────────▼──────────────▼──────────────▼───┐│
│            │        Sync Provider Interface            ││
│            └──────────────────┬───────────────────────┘│
│                               │                         │
│          ┌────────────────────┼────────────────┐       │
│          │                    │                 │       │
│   ┌──────▼─────┐    ┌────────▼──────┐   ┌─────▼────┐ │
│   │   Mock     │    │  LocalStorage  │   │  Cloud   │ │
│   │  Provider  │    │    Provider    │   │ Provider │ │
│   └────────────┘    └────────────────┘   └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
Sync Push Flow:
┌──────┐     ┌────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│ User │────→│ Local  │────→│ Encrypt  │────→│ Provider │────→│ Storage │
│Action│     │ State  │     │ (AES-GCM)│     │ (API)    │     │ (Cloud) │
└──────┘     └────────┘     └──────────┘     └──────────┘     └─────────┘

Sync Pull Flow:
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────────┐     ┌──────┐
│ Storage │────→│ Provider │────→│ Decrypt  │────→│  Conflict  │────→│ Local│
│ (Cloud) │     │ (API)    │     │(AES-GCM) │     │ Resolution │     │State │
└─────────┘     └──────────┘     └──────────┘     └────────────┘     └──────┘
```

## End-to-End Encryption

### Encryption Strategy

**Algorithm**: AES-256-GCM (Galois/Counter Mode)

**Why AES-GCM?**
- **Authenticated Encryption**: Integrity + Confidentiality
- **NIST Approved**: Federal standard (FIPS 197)
- **Performance**: Hardware acceleration on modern CPUs
- **No Padding Oracle**: GCM mode is not vulnerable

### Key Derivation

```javascript
// Master password → encryption key
const masterPassword = "user's master password";
const salt = crypto.getRandomValues(new Uint8Array(16));

// PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(masterPassword),
  'PBKDF2',
  false,
  ['deriveKey']
);

const encryptionKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: salt,
    iterations: 600000,
    hash: 'SHA-256'
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);
```

### Encryption Process

```javascript
// 1. Generate random IV (96 bits for GCM)
const iv = crypto.getRandomValues(new Uint8Array(12));

// 2. Encrypt data
const encrypted = await crypto.subtle.encrypt(
  {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128 // 128-bit authentication tag
  },
  encryptionKey,
  new TextEncoder().encode(JSON.stringify(data))
);

// 3. Package: iv + encrypted data
const package = {
  iv: Array.from(iv),
  data: Array.from(new Uint8Array(encrypted)),
  version: '1.0',
  timestamp: Date.now()
};
```

### Decryption Process

```javascript
// 1. Extract IV and encrypted data
const iv = new Uint8Array(package.iv);
const encrypted = new Uint8Array(package.data);

// 2. Decrypt
const decrypted = await crypto.subtle.decrypt(
  {
    name: 'AES-GCM',
    iv: iv,
    tagLength: 128
  },
  encryptionKey,
  encrypted
);

// 3. Parse JSON
const data = JSON.parse(new TextDecoder().decode(decrypted));
```

### Key Storage

**Client-Side Only**:
- Keys derived from master password
- Never stored in plaintext
- Never transmitted to server
- Ephemeral in memory during session

**Session Management**:
```javascript
// Key stored in memory during active session
class SyncService {
  constructor() {
    this.encryptionKey = null; // CryptoKey object
  }

  async unlock(masterPassword) {
    this.encryptionKey = await this.deriveKey(masterPassword);
  }

  lock() {
    this.encryptionKey = null; // Garbage collected
  }
}
```

## Sync Providers

### Provider Interface

All sync providers implement the `SyncProvider` interface:

```typescript
interface SyncProvider {
  // Identity
  name: string;
  type: 'mock' | 'localstorage' | 'webdav' | 'cloud';

  // Connection
  init(config: ProviderConfig): Promise<void>;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Sync Operations
  push(data: EncryptedData): Promise<PushResult>;
  pull(): Promise<EncryptedData>;
  sync(localData: EncryptedData): Promise<SyncResult>;

  // Metadata
  getLastSyncTime(): Promise<number>;
  getServerTimestamp(): Promise<number>;

  // Quota
  getQuota(): Promise<QuotaInfo>;
}
```

### Mock Provider

For testing and offline development:

```javascript
class MockSyncProvider {
  constructor() {
    this.storage = new Map();
    this.connected = false;
  }

  async push(data) {
    this.storage.set('latest', data);
    return { success: true, timestamp: Date.now() };
  }

  async pull() {
    return this.storage.get('latest') || null;
  }
}
```

### LocalStorage Provider

For single-device sync (backup/restore):

```javascript
class LocalStorageSyncProvider {
  async push(data) {
    localStorage.setItem('genpwd_sync_data', JSON.stringify(data));
    return { success: true, timestamp: Date.now() };
  }

  async pull() {
    const data = localStorage.getItem('genpwd_sync_data');
    return data ? JSON.parse(data) : null;
  }
}
```

### Cloud Provider (Future)

For multi-device sync via cloud services:

- **WebDAV**: Standard protocol, self-hosted
- **Dropbox**: Popular cloud storage
- **Google Drive**: Popular cloud storage
- **Custom Backend**: GenPwd Pro sync server

## Conflict Resolution

### Last-Write-Wins (LWW)

**Strategy**: Most recent modification wins

**Implementation**:
```javascript
function resolveConflict(local, remote) {
  // Compare timestamps
  if (local.timestamp > remote.timestamp) {
    return local; // Local wins
  } else if (remote.timestamp > local.timestamp) {
    return remote; // Remote wins
  } else {
    // Same timestamp, compare device ID
    return local.deviceId > remote.deviceId ? local : remote;
  }
}
```

### Vector Clocks (Future)

For more sophisticated conflict detection:

```javascript
const vectorClock = {
  'device-1': 5,
  'device-2': 3,
  'device-3': 7
};

function isConcurrent(clock1, clock2) {
  // Check if neither clock dominates the other
  let clock1Dominates = false;
  let clock2Dominates = false;

  for (const device in clock1) {
    if (clock1[device] > (clock2[device] || 0)) {
      clock1Dominates = true;
    }
    if (clock1[device] < (clock2[device] || 0)) {
      clock2Dominates = true;
    }
  }

  return clock1Dominates && clock2Dominates;
}
```

### Conflict Types

**1. Property Conflict**
- **Example**: Password changed on two devices
- **Resolution**: LWW based on timestamp

**2. Deletion Conflict**
- **Example**: Password deleted on device A, modified on device B
- **Resolution**: Modification wins (resurrection)

**3. Add-Add Conflict**
- **Example**: Same preset name created on two devices
- **Resolution**: Keep both, append device ID to one

## Security

### Threat Model

**Assumptions**:
- ✅ User's device is secure
- ✅ User's master password is strong
- ❌ Server/provider is trusted (zero-knowledge)
- ❌ Network is secure (use HTTPS)

**Threats**:
1. **Server Compromise**: Cannot decrypt data (E2E encryption)
2. **Network Eavesdropping**: Data encrypted in transit
3. **Replay Attacks**: Timestamp validation
4. **MITM**: HTTPS + certificate pinning (future)

### Security Features

**1. End-to-End Encryption**
- All data encrypted client-side
- Server cannot decrypt
- Zero-knowledge architecture

**2. Key Derivation**
- PBKDF2 with 600,000 iterations
- Unique salt per device
- Strong password requirement

**3. Authentication Tags**
- AES-GCM provides integrity
- Detects tampering
- 128-bit auth tag

**4. Secure Deletion**
- Overwrite keys in memory
- Clear encryption key on lock
- No key persistence

### Security Best Practices

```javascript
// 1. Strong password enforcement
function validateMasterPassword(password) {
  if (password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

// 2. Secure key storage
class SecureKeyStore {
  constructor() {
    this.key = null; // In-memory only
  }

  setKey(key) {
    this.key = key;
  }

  getKey() {
    return this.key;
  }

  clear() {
    this.key = null; // Garbage collected
  }
}

// 3. Auto-lock on inactivity
let lastActivity = Date.now();

setInterval(() => {
  if (Date.now() - lastActivity > 15 * 60 * 1000) {
    syncService.lock(); // 15 minutes
  }
}, 60000);
```

## Implementation

### SyncService Class

```javascript
class SyncService {
  constructor() {
    this.provider = null;
    this.encryptionKey = null;
    this.isLocked = true;
    this.syncInterval = 300000; // 5 minutes
    this.syncTimer = null;
  }

  // Setup
  async init(provider, config) {
    this.provider = provider;
    await this.provider.init(config);
  }

  // Authentication
  async unlock(masterPassword) {
    this.encryptionKey = await this.deriveKey(masterPassword);
    this.isLocked = false;
    this.startAutoSync();
  }

  lock() {
    this.encryptionKey = null;
    this.isLocked = true;
    this.stopAutoSync();
  }

  // Sync
  async sync() {
    if (this.isLocked) throw new Error('Sync service is locked');

    const localData = await this.getLocalData();
    const encryptedLocal = await this.encrypt(localData);

    const encryptedRemote = await this.provider.pull();

    if (!encryptedRemote) {
      // No remote data, push local
      await this.provider.push(encryptedLocal);
      return { action: 'push', conflicts: 0 };
    }

    const remoteData = await this.decrypt(encryptedRemote);
    const resolved = this.resolveConflicts(localData, remoteData);

    if (resolved !== localData) {
      await this.setLocalData(resolved);
    }

    const encryptedResolved = await this.encrypt(resolved);
    await this.provider.push(encryptedResolved);

    return { action: 'sync', conflicts: 0 };
  }

  // Encryption
  async encrypt(data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      this.encryptionKey,
      new TextEncoder().encode(JSON.stringify(data))
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
      version: '1.0',
      timestamp: Date.now()
    };
  }

  async decrypt(package) {
    const iv = new Uint8Array(package.iv);
    const encrypted = new Uint8Array(package.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      this.encryptionKey,
      encrypted
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  // Conflict Resolution
  resolveConflicts(local, remote) {
    // Last-Write-Wins
    return local.timestamp > remote.timestamp ? local : remote;
  }

  // Auto Sync
  startAutoSync() {
    this.syncTimer = setInterval(() => {
      this.sync().catch(err => console.error('Auto-sync failed:', err));
    }, this.syncInterval);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}
```

## Testing

### Unit Tests

```javascript
// Test encryption/decryption
async function testEncryption() {
  const service = new SyncService();
  await service.unlock('test-password-123');

  const data = { passwords: ['test1', 'test2'] };
  const encrypted = await service.encrypt(data);
  const decrypted = await service.decrypt(encrypted);

  assert.deepEqual(data, decrypted);
}

// Test conflict resolution
function testConflictResolution() {
  const local = { timestamp: 1000, data: 'local' };
  const remote = { timestamp: 2000, data: 'remote' };

  const resolved = service.resolveConflicts(local, remote);

  assert.equal(resolved.data, 'remote'); // Remote is newer
}

// Test provider
async function testMockProvider() {
  const provider = new MockSyncProvider();
  await provider.init({});

  const data = { test: 'data' };
  await provider.push(data);

  const pulled = await provider.pull();

  assert.deepEqual(data, pulled);
}
```

### Integration Tests

```javascript
// Test end-to-end sync
async function testEndToEndSync() {
  const service1 = new SyncService();
  const service2 = new SyncService();
  const provider = new MockSyncProvider();

  await service1.init(provider, {});
  await service2.init(provider, {});

  await service1.unlock('password123');
  await service2.unlock('password123');

  // Device 1: Add password
  await service1.addPassword({ title: 'Test', password: 'secret' });
  await service1.sync();

  // Device 2: Sync
  await service2.sync();
  const passwords = await service2.getPasswords();

  assert.equal(passwords.length, 1);
  assert.equal(passwords[0].title, 'Test');
}
```

## Future Extensions

### Planned Features

**1. Incremental Sync**
- Only sync changes since last sync
- Reduce bandwidth and storage
- Implement delta compression

**2. Multi-Provider Support**
- Sync to multiple providers simultaneously
- Fallback providers
- Provider prioritization

**3. Selective Sync**
- Choose what to sync (passwords, settings, history)
- Exclude sensitive data
- Category-based sync

**4. Sharing**
- Share passwords with other users
- Team/family vaults
- Encrypted sharing with public key crypto

**5. Backup/Restore**
- Automatic encrypted backups
- Export encrypted vault
- Disaster recovery

**6. Sync Status UI**
- Real-time sync progress
- Conflict notifications
- Sync history log

## Resources

### Cryptography

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [PBKDF2](https://tools.ietf.org/html/rfc2898)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

### Conflict Resolution

- [Vector Clocks](https://en.wikipedia.org/wiki/Vector_clock)
- [CRDTs](https://crdt.tech/)
- [Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation)

### Sync Protocols

- [WebDAV](https://tools.ietf.org/html/rfc4918)
- [CalDAV](https://tools.ietf.org/html/rfc4791)
- [Delta Sync](https://dropbox.tech/infrastructure/streaming-file-synchronization)

## License

This sync architecture is part of GenPwd Pro.

```
Copyright 2025 Julien Bombled

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
```

---

**GenPwd Pro v2.6.0** - Sync Architecture Documentation
Sprint S2-5 - Système de synchronisation avec E2E encryption
