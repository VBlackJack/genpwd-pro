import { webcrypto } from 'node:crypto';
import { InMemoryVaultRepository } from '../in-memory-repository.js';
import { VaultEntry, VaultGroup, VAULT_DOMAIN_CONSTANTS } from '../models.js';
import { TinkAeadCryptoEngine } from '../crypto-engine.js';
import { ScryptKdfService } from '../kdf-service.js';
import { InMemorySessionManager } from '../session-manager.js';

const cryptoApi = globalThis.crypto || webcrypto;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function testRepositoryCrud() {
  const repo = new InMemoryVaultRepository();
  const root = await repo.createGroup(new VaultGroup({ id: 'root', name: 'Root' }));
  assert(root.id === 'root', 'Root group id should match');

  const entry = new VaultEntry({
    id: 'entry-1',
    title: 'Email',
    username: 'user@example.com',
    secret: ['s', 'e', 'c', 'r', 'e', 't'],
    notes: 'Primary account',
    tags: ['personal'],
    groupId: 'root'
  });

  await repo.createEntry(entry);
  const fetched = await repo.getEntryById('entry-1');
  assert(fetched.title === 'Email', 'Entry title must be preserved');
  assert(fetched !== entry, 'Repository returns copies of entries');

  const mutatedSecret = fetched.secret.slice();
  mutatedSecret[0] = 'X';
  const original = await repo.getEntryById('entry-1');
  assert(original !== fetched, 'Repository should return new instances per read');
  assert(original.secret[0] === 's', 'Secrets must not be mutated by consumers');

  await repo.updateEntry(new VaultEntry({
    id: 'entry-1',
    title: 'Email Updated',
    username: 'user@example.com',
    secret: ['n', 'e', 'w'],
    notes: 'Rotated',
    tags: ['personal', 'important'],
    groupId: 'root'
  }));

  const updated = await repo.getEntryById('entry-1');
  assert(updated.title === 'Email Updated', 'Entry update should persist changes');

  const grouped = await repo.listEntriesByGroup('root');
  assert(grouped.length === 1 && grouped[0].id === 'entry-1', 'Group listing should include entry');

  await repo.deleteGroup('root');
  const afterDeletion = await repo.getEntryById('entry-1');
  assert(afterDeletion.groupId === null, 'Deleting group should detach entries');

  await repo.deleteEntry('entry-1');
  const missing = await repo.getEntryById('entry-1');
  assert(missing === null, 'Entry should be removed');
}

async function testRepositorySearch() {
  const repo = new InMemoryVaultRepository();
  await repo.createEntry(new VaultEntry({
    id: 'entry-1',
    title: 'GitHub',
    username: 'octocat',
    secret: ['1'],
    tags: ['dev', 'work'],
    notes: 'Main repository'
  }));
  await repo.createEntry(new VaultEntry({
    id: 'entry-2',
    title: 'Bank',
    username: 'finance',
    secret: ['2'],
    tags: ['finance'],
    notes: 'Savings'
  }));

  const results = await repo.searchEntries('git');
  assert(results.length === 1 && results[0].id === 'entry-1', 'Search should match titles');

  const tagResults = await repo.searchEntries('', { tags: ['dev'] });
  assert(tagResults.length === 1 && tagResults[0].id === 'entry-1', 'Search should filter by tags');
}

async function testCryptoEngine() {
  const kdfService = new ScryptKdfService({ keyLength: 32 });
  const kdfParams = kdfService.createParams();
  const kek = await kdfService.deriveKey('unit-test-passphrase', kdfParams);
  const associatedData = kdfParams.salt;

  const { encryptedKeyset } = await TinkAeadCryptoEngine.generateKeyset({
    keyEncryptionKey: kek,
    associatedData
  });
  const engine = await TinkAeadCryptoEngine.fromEncryptedKeyset(encryptedKeyset, kek, associatedData);

  const plaintext = new TextEncoder().encode('vault-secret');
  const ad = new TextEncoder().encode('metadata');
  const ciphertext = await engine.encrypt(plaintext, ad);

  assert(ciphertext instanceof Uint8Array && ciphertext.length > plaintext.length, 'Ciphertext should be Uint8Array');

  const decrypted = await engine.decrypt(ciphertext, ad);
  assert(new TextDecoder().decode(decrypted) === 'vault-secret', 'Decryption should recover plaintext');

  let threw = false;
  try {
    await engine.decrypt(ciphertext, new TextEncoder().encode('tampered'));
  } catch (error) {
    threw = true;
    assert(error instanceof Error, 'Decrypt should throw error');
  }
  assert(threw, 'Decrypting with wrong AD must fail');

  const exported = await engine.serializeKeyset(kek, associatedData);
  const restored = await TinkAeadCryptoEngine.fromEncryptedKeyset(exported, kek, associatedData);
  const decryptedRestored = await restored.decrypt(ciphertext, ad);
  assert(
    new TextDecoder().decode(decryptedRestored) === 'vault-secret',
    'Restored engine should decrypt correctly'
  );

  let wrongKeyFailure = false;
  const tamperedKey = new Uint8Array(kek);
  tamperedKey[0] ^= 0xff;
  try {
    await TinkAeadCryptoEngine.fromEncryptedKeyset(encryptedKeyset, tamperedKey, associatedData);
  } catch (error) {
    wrongKeyFailure = error instanceof Error;
  }
  assert(wrongKeyFailure, 'Decrypting with wrong key should fail');
}

async function testKdfService() {
  const service = new ScryptKdfService({ keyLength: 32 });
  const params = service.createParams();
  assert(params.algorithm === VAULT_DOMAIN_CONSTANTS.KDF_ALGORITHMS.SCRYPT, 'KDF algorithm should be scrypt');

  const keyA = await service.deriveKey('password', params);
  const keyB = await service.deriveKey('password', params);
  assert(equalBytes(keyA, keyB), 'Derivation should be deterministic with same params');

  const params2 = service.createParams({ salt: cryptoApi.getRandomValues(new Uint8Array(16)) });
  const keyC = await service.deriveKey('password', params2);
  assert(!equalBytes(keyA, keyC), 'Different salt should change derived key');
}

async function testSessionManager() {
  const manager = new InMemorySessionManager({ defaultTtlMs: 50 });
  const key = cryptoApi.getRandomValues(new Uint8Array(32));
  await manager.storeKey(key);
  assert(manager.isUnlocked(), 'Session should be unlocked after storing key');

  const retrieved = await manager.getKey();
  assert(retrieved && retrieved.length === key.length, 'Session returns key copy');
  retrieved[0] ^= 0xff;
  const retrieved2 = await manager.getKey();
  assert(retrieved2[0] !== retrieved[0], 'Key copy should not mutate stored value');

  await delay(60);
  assert(!manager.isUnlocked(), 'Key should expire after TTL');

  await manager.storeKey(key, 30);
  await manager.extend(30);
  assert(manager.isUnlocked(), 'Extending TTL keeps session active');

  let gateCalls = 0;
  manager.registerBiometricGate(async () => {
    gateCalls++;
    return gateCalls % 2 === 1;
  });

  const allowedKey = await manager.getKey();
  assert(allowedKey !== null, 'Biometric gate should allow on first attempt');
  const blockedKey = await manager.getKey();
  assert(blockedKey === null, 'Biometric gate should block when it returns false');

  await manager.clear();
  assert(!manager.isUnlocked(), 'Clearing session removes key');
}

export async function runVaultContractTests() {
  const tests = [
    ['VaultRepository CRUD', testRepositoryCrud],
    ['VaultRepository search', testRepositorySearch],
    ['Tink crypto engine', testCryptoEngine],
    ['Scrypt KDF service', testKdfService],
    ['Session manager', testSessionManager]
  ];

  const results = [];
  for (const [name, testFn] of tests) {
    try {
      await testFn();
      results.push({ name, status: 'pass' });
    } catch (error) {
      results.push({ name, status: 'fail', error });
    }
  }

  const failed = results.filter((r) => r.status === 'fail');
  if (failed.length > 0) {
    const messages = failed.map((r) => `${r.name}: ${r.error?.message || r.error}`);
    throw new Error(`Vault contract tests failed\n${messages.join('\n')}`);
  }

  return results;
}
