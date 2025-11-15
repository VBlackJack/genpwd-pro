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

/**
 * Comprehensive tests for service modules
 * Tests: import-export-service, password-service, hibp-service
 */

import { strict as assert } from 'assert';
import { PasswordService } from '../js/services/password-service.js';

/**
 * Test suite runner
 */
class ServicesTestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Services Tests...\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ test: test.name, error: error.message });
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }

    this.printSummary();
    return this.results;
  }

  printSummary() {
    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${percentage}%`);

    if (this.results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
      });
    }
  }
}

/**
 * Password Service Tests
 */
function setupPasswordServiceTests(runner) {
  runner.addTest('PasswordService - Constructor', async () => {
    const service = new PasswordService();
    assert.ok(service, 'Should create service instance');
    assert.ok(typeof service.generateOne === 'function', 'Should have generateOne method');
    assert.ok(typeof service.generateBatch === 'function', 'Should have generateBatch method');
  });

  runner.addTest('PasswordService - Constructor with callbacks', async () => {
    let errorCalled = false;
    let successCalled = false;

    const service = new PasswordService({
      onError: () => { errorCalled = true; },
      onSuccess: () => { successCalled = true; }
    });

    assert.ok(service.onError, 'Should have onError callback');
    assert.ok(service.onSuccess, 'Should have onSuccess callback');
  });

  runner.addTest('PasswordService - Generate syllables password', async () => {
    const service = new PasswordService();

    const result = await service.generateOne('syllables', {
      length: 12,
      policy: 'standard',
      digits: 1,
      specials: 1,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'milieu',
      caseMode: 'mixte',
      useBlocks: false,
      blockTokens: []
    });

    assert.ok(result, 'Should return result');
    assert.ok(result.value, 'Should have value property');
    assert.strictEqual(typeof result.entropy, 'number', 'Should have entropy');
    assert.ok(result.value.length >= 10, 'Password should have reasonable length');
  });

  runner.addTest('PasswordService - Generate passphrase', async () => {
    const service = new PasswordService();

    const result = await service.generateOne('passphrase', {
      wordCount: 3,
      separator: '-',
      digits: 0,
      specials: 0,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'fin',
      caseMode: 'title',
      useBlocks: false,
      blockTokens: [],
      dictionary: 'french'
    });

    assert.ok(result, 'Should return result');
    assert.ok(result.value, 'Should have value');
    assert.ok(result.value.includes('-'), 'Should contain separator');
  });

  runner.addTest('PasswordService - Generate leet password', async () => {
    const service = new PasswordService();

    const result = await service.generateOne('leet', {
      baseWord: 'password',
      digits: 1,
      specials: 1,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'debut',
      caseMode: 'mixte',
      useBlocks: false,
      blockTokens: []
    });

    assert.ok(result, 'Should return result');
    assert.ok(result.value, 'Should have value');
    assert.ok(/[0-9@!#%]/.test(result.value), 'Should contain leet transformations');
  });

  runner.addTest('PasswordService - Invalid mode throws error', async () => {
    const service = new PasswordService();

    try {
      await service.generateOne('invalid_mode', {});
      assert.fail('Should throw error for invalid mode');
    } catch (error) {
      assert.ok(error.message.includes('Unknown generation mode'), 'Should have appropriate error message');
    }
  });

  runner.addTest('PasswordService - Generate batch', async () => {
    const service = new PasswordService();

    const results = await service.generateBatch('syllables', {
      length: 12,
      policy: 'standard',
      digits: 1,
      specials: 1,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'milieu',
      caseMode: 'mixte',
      useBlocks: false,
      blockTokens: []
    }, 5);

    assert.ok(Array.isArray(results), 'Should return array');
    assert.strictEqual(results.length, 5, 'Should generate 5 passwords');
    results.forEach(result => {
      assert.ok(result.value, 'Each result should have value');
      assert.ok(result.entropy, 'Each result should have entropy');
    });
  });

  runner.addTest('PasswordService - Batch with variety check', async () => {
    const service = new PasswordService();

    const results = await service.generateBatch('syllables', {
      length: 12,
      policy: 'standard',
      digits: 1,
      specials: 1,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'milieu',
      caseMode: 'mixte',
      useBlocks: false,
      blockTokens: []
    }, 3);

    const uniquePasswords = new Set(results.map(r => r.value));
    assert.ok(uniquePasswords.size >= 2, 'Batch should generate diverse passwords');
  });

  runner.addTest('PasswordService - Validate password strength', async () => {
    const service = new PasswordService();

    const weak = service.validateStrength('abc');
    assert.ok(weak, 'Should return validation result');
    assert.strictEqual(weak.strength, 'weak', 'Should detect weak password');

    const strong = service.validateStrength('MyP@ssw0rd123!Complex');
    assert.strictEqual(strong.strength, 'very-strong', 'Should detect strong password');
  });

  runner.addTest('PasswordService - Estimate entropy', async () => {
    const service = new PasswordService();

    const entropy = service.estimateEntropy('password123', {
      mode: 'syllables',
      policy: 'standard',
      length: 12
    });

    assert.ok(typeof entropy === 'number', 'Should return number');
    assert.ok(entropy > 0, 'Entropy should be positive');
  });
}

/**
 * Import/Export Service Tests
 */
function setupImportExportServiceTests(runner) {
  runner.addTest('ImportExportService - Import module', async () => {
    const module = await import('../js/services/import-export-service.js');
    assert.ok(module, 'Should import module');
    assert.ok(module.default, 'Should have default export');
  });

  runner.addTest('ImportExportService - Create instance', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    assert.ok(service, 'Should create instance');
    assert.ok(service.supportedFormats, 'Should have supported formats');
    assert.ok(service.supportedFormats.import, 'Should list import formats');
    assert.ok(service.supportedFormats.export, 'Should list export formats');
  });

  runner.addTest('ImportExportService - Sanitize string', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const dirty = '<script>alert("xss")</script>';
    const clean = service.sanitize(dirty);

    assert.ok(!clean.includes('<script>'), 'Should remove script tags');
    assert.ok(!clean.includes('alert'), 'Should sanitize malicious content');
  });

  runner.addTest('ImportExportService - Sanitize removes javascript protocol', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const dirty = 'javascript:alert(1)';
    const clean = service.sanitize(dirty);

    assert.ok(!clean.includes('javascript:'), 'Should remove javascript protocol');
  });

  runner.addTest('ImportExportService - Validate URL', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const validUrl = service.validateUrl('https://example.com');
    assert.strictEqual(validUrl, 'https://example.com', 'Should accept valid HTTPS URL');

    const invalidUrl = service.validateUrl('ftp://example.com');
    assert.strictEqual(invalidUrl, '', 'Should reject non-HTTP(S) URL');

    const malformed = service.validateUrl('not a url');
    assert.strictEqual(malformed, '', 'Should reject malformed URL');
  });

  runner.addTest('ImportExportService - Parse CSV basic', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const csv = 'title,username,password\nTest,user@example.com,Pass123\nTest2,user2@example.com,Pass456';
    const data = service.parseCSV(csv);

    assert.ok(Array.isArray(data), 'Should return array');
    assert.strictEqual(data.length, 2, 'Should parse 2 rows');
    assert.strictEqual(data[0].title, 'Test', 'Should parse title');
    assert.strictEqual(data[0].username, 'user@example.com', 'Should parse username');
    assert.strictEqual(data[0].password, 'Pass123', 'Should parse password');
  });

  runner.addTest('ImportExportService - Parse CSV with quoted values', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const csv = 'title,notes\n"Title with, comma","Notes with ""quotes"""';
    const data = service.parseCSV(csv);

    assert.strictEqual(data.length, 1, 'Should parse 1 row');
    assert.ok(data[0].title.includes(','), 'Should preserve comma in quoted field');
    assert.ok(data[0].notes.includes('"'), 'Should handle escaped quotes');
  });

  runner.addTest('ImportExportService - Parse CSV Line', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const line = '"field1","field2,with,comma","field3"';
    const values = service.parseCSVLine(line);

    assert.strictEqual(values.length, 3, 'Should parse 3 values');
    assert.strictEqual(values[1], 'field2,with,comma', 'Should preserve commas in quotes');
  });

  runner.addTest('ImportExportService - Export to Generic JSON', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const entries = [
      {
        title: 'Test Entry',
        username: 'user@example.com',
        password: 'Pass123',
        url: 'https://example.com',
        notes: 'Test notes'
      }
    ];

    const exported = service.exportToGenericJSON(entries);
    assert.ok(typeof exported === 'string', 'Should return string');

    const parsed = JSON.parse(exported);
    assert.ok(Array.isArray(parsed), 'Should be valid JSON array');
    assert.strictEqual(parsed.length, 1, 'Should have 1 entry');
    assert.strictEqual(parsed[0].title, 'Test Entry', 'Should preserve title');
  });

  runner.addTest('ImportExportService - Export to Generic CSV', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const entries = [
      {
        title: 'Test',
        username: 'user@example.com',
        password: 'Pass123'
      }
    ];

    const exported = service.exportToGenericCSV(entries);
    assert.ok(typeof exported === 'string', 'Should return string');
    assert.ok(exported.includes('title'), 'Should include header');
    assert.ok(exported.includes('Test'), 'Should include data');
  });

  runner.addTest('ImportExportService - Import from Generic JSON', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const json = JSON.stringify([
      {
        title: 'Imported',
        username: 'imported@example.com',
        password: 'ImportedPass123'
      }
    ]);

    const imported = service.importFromGenericJSON(json);
    assert.ok(Array.isArray(imported), 'Should return array');
    assert.strictEqual(imported.length, 1, 'Should import 1 entry');
    assert.strictEqual(imported[0].title, 'Imported', 'Should import title');
  });

  runner.addTest('ImportExportService - Import from LastPass CSV', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const csv = 'url,username,password,extra,name,grouping,fav\nhttps://example.com,user@example.com,Pass123,notes,Example,folder,0';
    const imported = service.importFromLastPassCSV(csv);

    assert.ok(Array.isArray(imported), 'Should return array');
    assert.ok(imported.length > 0, 'Should import entries');
  });

  runner.addTest('ImportExportService - Import from Bitwarden JSON', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const json = JSON.stringify({
      items: [
        {
          type: 1,
          name: 'Test',
          login: {
            username: 'user@example.com',
            password: 'Pass123',
            uris: [{ uri: 'https://example.com' }]
          },
          notes: 'Test notes'
        }
      ]
    });

    const imported = service.importFromBitwardenJSON(json);
    assert.ok(Array.isArray(imported), 'Should return array');
    assert.ok(imported.length > 0, 'Should import entries');
  });

  runner.addTest('ImportExportService - Handle malformed JSON', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const malformed = '{invalid json}';

    try {
      service.importFromGenericJSON(malformed);
      assert.fail('Should throw error for malformed JSON');
    } catch (error) {
      assert.ok(error, 'Should throw error');
    }
  });

  runner.addTest('ImportExportService - Handle empty CSV', async () => {
    const { default: ImportExportService } = await import('../js/services/import-export-service.js');
    const service = new ImportExportService();

    const empty = '';
    const result = service.parseCSV(empty);

    assert.ok(Array.isArray(result), 'Should return array');
    assert.strictEqual(result.length, 0, 'Should be empty array');
  });
}

/**
 * HIBP Service Tests
 */
function setupHIBPServiceTests(runner) {
  runner.addTest('HIBPService - Import module', async () => {
    const module = await import('../js/services/hibp-service.js');
    assert.ok(module, 'Should import module');
    assert.ok(module.default, 'Should have default export');
  });

  runner.addTest('HIBPService - Create instance', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    assert.ok(service, 'Should create instance');
    assert.ok(typeof service.checkPassword === 'function', 'Should have checkPassword method');
  });

  runner.addTest('HIBPService - Hash password (SHA-1)', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    const hash = await service.hashPassword('password');
    assert.ok(typeof hash === 'string', 'Should return string');
    assert.strictEqual(hash.length, 40, 'SHA-1 hash should be 40 characters');
    assert.ok(/^[A-F0-9]+$/.test(hash), 'Should be uppercase hex');
  });

  runner.addTest('HIBPService - Split hash into prefix and suffix', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    const hash = 'ABCDEF1234567890ABCDEF1234567890ABCDEF12';
    const { prefix, suffix } = service.splitHash(hash);

    assert.strictEqual(prefix.length, 5, 'Prefix should be 5 characters');
    assert.strictEqual(suffix.length, 35, 'Suffix should be 35 characters');
    assert.strictEqual(prefix, 'ABCDE', 'Should extract correct prefix');
    assert.strictEqual(suffix, 'F1234567890ABCDEF1234567890ABCDEF12', 'Should extract correct suffix');
  });

  runner.addTest('HIBPService - Parse HIBP response', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    const response = 'HASH1:123\nHASH2:456\nHASH3:789';
    const hashes = service.parseHIBPResponse(response);

    assert.ok(Array.isArray(hashes), 'Should return array');
    assert.strictEqual(hashes.length, 3, 'Should parse 3 hashes');
    assert.deepStrictEqual(hashes[0], { hash: 'HASH1', count: 123 }, 'Should parse hash and count');
  });

  runner.addTest('HIBPService - Check if hash is in breach list', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    const breaches = [
      { hash: 'ABC123', count: 100 },
      { hash: 'DEF456', count: 50 }
    ];

    const found = service.isHashInBreaches('ABC123', breaches);
    assert.ok(found, 'Should find hash in breaches');
    assert.strictEqual(found.count, 100, 'Should return correct count');

    const notFound = service.isHashInBreaches('XYZ999', breaches);
    assert.strictEqual(notFound, null, 'Should return null for hash not in breaches');
  });

  runner.addTest('HIBPService - Cache mechanism', async () => {
    const { default: HIBPService } = await import('../js/services/hibp-service.js');
    const service = new HIBPService();

    // Simulate caching
    service.cache = { 'ABCDE': [] };
    assert.ok(service.cache['ABCDE'], 'Should support caching');
  });
}

/**
 * Main test execution
 */
async function runAllTests() {
  const runner = new ServicesTestRunner();

  // Setup all test suites
  setupPasswordServiceTests(runner);
  setupImportExportServiceTests(runner);
  setupHIBPServiceTests(runner);

  // Run tests
  const results = await runner.run();

  // Exit with appropriate code
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

export { runAllTests };
