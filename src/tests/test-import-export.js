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

// src/tests/test-import-export.js - Tests for Import/Export Service

import { ImportExportService } from '../js/services/import-export-service.js';

/**
 * Test Suite for Import/Export Service
 */
export function runImportExportTests() {
  console.log('🧪 Running Import/Export Service Tests...\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Helper function to run a test
  function test(name, fn) {
    results.total++;
    try {
      fn();
      results.passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      results.errors.push({ name, error: error.message });
      console.error(`❌ ${name}: ${error.message}`);
    }
  }

  // Helper to assert
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  // Create service instance
  const service = new ImportExportService();

  // ========== CSV PARSING TESTS ==========

  test('Parse simple CSV', () => {
    const csv = 'name,age,city\nJohn,30,Paris\nJane,25,London';
    const rows = service.parseCSV(csv);

    assert(rows.length === 2, 'Should have 2 rows');
    assert(rows[0].name === 'John', 'First row name should be John');
    assert(rows[1].city === 'London', 'Second row city should be London');
  });

  test('Parse CSV with quoted values', () => {
    const csv = 'title,description\n"Hello, World","A \"quote\" test"';
    const rows = service.parseCSV(csv);

    assert(rows.length === 1, 'Should have 1 row');
    assert(rows[0].title === 'Hello, World', 'Should handle commas in quotes');
    assert(rows[0].description === 'A "quote" test', 'Should handle escaped quotes');
  });

  // ========== KEEPASS TESTS ==========

  test('Import KeePass CSV', () => {
    const csv = `Account,Login Name,Password,Web Site,Comments
MyAccount,user@example.com,SecurePass123,https://example.com,Test note`;

    const entries = service.importKeePassCSV(csv);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'MyAccount', 'Title should match');
    assert(entries[0].username === 'user@example.com', 'Username should match');
    assert(entries[0].password === 'SecurePass123', 'Password should match');
    assert(entries[0].url === 'https://example.com', 'URL should match');
  });

  test('Export to KeePass CSV', () => {
    const entries = [{
      title: 'Test Entry',
      username: 'testuser',
      password: 'testpass',
      url: 'https://test.com',
      notes: 'Test notes'
    }];

    const csv = service.exportKeePassCSV(entries);

    assert(csv.includes('Account'), 'Should have Account header');
    assert(csv.includes('Test Entry'), 'Should have entry title');
    assert(csv.includes('testuser'), 'Should have username');
    assert(csv.includes('testpass'), 'Should have password');
  });

  test('Import KeePass XML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Root>
    <Group>
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>Test Entry</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>user@test.com</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value>TestPass123</Value>
        </String>
        <String>
          <Key>URL</Key>
          <Value>https://test.com</Value>
        </String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>`;

    const entries = service.importKeePassXML(xml);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'Test Entry', 'Title should match');
    assert(entries[0].username === 'user@test.com', 'Username should match');
  });

  // ========== BITWARDEN TESTS ==========

  test('Import Bitwarden JSON', () => {
    const json = `{
      "encrypted": false,
      "items": [
        {
          "type": 1,
          "name": "Test Login",
          "notes": "Test notes",
          "favorite": false,
          "login": {
            "username": "testuser",
            "password": "testpass",
            "uris": [{"uri": "https://test.com"}]
          }
        }
      ]
    }`;

    const entries = service.importBitwardenJSON(json);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'Test Login', 'Title should match');
    assert(entries[0].username === 'testuser', 'Username should match');
    assert(entries[0].password === 'testpass', 'Password should match');
    assert(entries[0].url === 'https://test.com', 'URL should match');
  });

  test('Export to Bitwarden JSON', () => {
    const entries = [{
      title: 'Test Entry',
      username: 'testuser',
      password: 'testpass',
      url: 'https://test.com',
      notes: 'Test notes'
    }];

    const json = service.exportBitwardenJSON(entries);
    const data = JSON.parse(json);

    assert(data.items.length === 1, 'Should have 1 item');
    assert(data.items[0].name === 'Test Entry', 'Name should match');
    assert(data.items[0].login.username === 'testuser', 'Username should match');
  });

  // ========== LASTPASS TESTS ==========

  test('Import LastPass CSV', () => {
    const csv = `url,username,password,extra,name,grouping,fav
https://test.com,testuser,testpass,Test notes,Test Entry,Folder,0`;

    const entries = service.importLastPassCSV(csv);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'Test Entry', 'Title should match');
    assert(entries[0].username === 'testuser', 'Username should match');
    assert(entries[0].url === 'https://test.com', 'URL should match');
  });

  test('Export to LastPass CSV', () => {
    const entries = [{
      title: 'Test Entry',
      username: 'testuser',
      password: 'testpass',
      url: 'https://test.com',
      notes: 'Test notes'
    }];

    const csv = service.exportLastPassCSV(entries);

    assert(csv.includes('url'), 'Should have url header');
    assert(csv.includes('https://test.com'), 'Should have URL');
    assert(csv.includes('testuser'), 'Should have username');
  });

  // ========== 1PASSWORD TESTS ==========

  test('Import 1Password CSV', () => {
    const csv = `Title,URL,Username,Password,Notes,Category
Test Entry,https://test.com,testuser,testpass,Test notes,Login`;

    const entries = service.import1PasswordCSV(csv);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'Test Entry', 'Title should match');
    assert(entries[0].url === 'https://test.com', 'URL should match');
  });

  test('Export to 1Password CSV', () => {
    const entries = [{
      title: 'Test Entry',
      username: 'testuser',
      password: 'testpass',
      url: 'https://test.com',
      notes: 'Test notes'
    }];

    const csv = service.export1PasswordCSV(entries);

    assert(csv.includes('Title'), 'Should have Title header');
    assert(csv.includes('Test Entry'), 'Should have title');
  });

  // ========== GENERIC FORMAT TESTS ==========

  test('Import Generic JSON', () => {
    const json = `{
      "entries": [
        {
          "title": "Test",
          "username": "user",
          "password": "pass",
          "url": "https://test.com"
        }
      ]
    }`;

    const entries = service.importGenericJSON(json);

    assert(entries.length === 1, 'Should import 1 entry');
    assert(entries[0].title === 'Test', 'Title should match');
  });

  test('Export to Generic JSON', () => {
    const entries = [{
      title: 'Test',
      username: 'user',
      password: 'pass'
    }];

    const json = service.exportGenericJSON(entries);
    const data = JSON.parse(json);

    assert(data.count === 1, 'Should have count');
    assert(data.entries.length === 1, 'Should have entries array');
  });

  // ========== SECURITY TESTS ==========

  test('Sanitize malicious input', () => {
    const malicious = '<script>alert("XSS")</script>';
    const sanitized = service.sanitize(malicious);

    assert(!sanitized.includes('<script>'), 'Should remove script tags');
    assert(!sanitized.includes('alert'), 'Should remove alert call');
  });

  test('Validate URL - Accept valid URLs', () => {
    const validUrl = 'https://example.com/path?query=value';
    const result = service.validateUrl(validUrl);

    assert(result === validUrl, 'Valid HTTPS URL should pass');
  });

  test('Validate URL - Reject javascript protocol', () => {
    const maliciousUrl = 'javascript:alert("XSS")';
    const result = service.validateUrl(maliciousUrl);

    assert(result === '', 'JavaScript protocol should be rejected');
  });

  test('Validate URL - Reject invalid URLs', () => {
    const invalidUrl = 'not-a-url';
    const result = service.validateUrl(invalidUrl);

    assert(result === '', 'Invalid URL should be rejected');
  });

  // ========== MAIN IMPORT/EXPORT METHODS ==========

  test('Main import method - KeePass CSV', () => {
    const csv = `Account,Login Name,Password,Web Site,Comments
Test,user,pass,https://test.com,notes`;

    const entries = service.import(csv, 'keepass-csv');

    assert(entries.length === 1, 'Should import via main method');
  });

  test('Main export method - Bitwarden JSON', () => {
    const entries = [{
      title: 'Test',
      username: 'user',
      password: 'pass'
    }];

    const result = service.export(entries, 'bitwarden-json');

    assert(result.length > 0, 'Should export via main method');
    assert(result.includes('bitwarden'), 'Should be valid JSON') || assert(result.includes('items'), 'Should have items');
  });

  test('Unsupported format throws error', () => {
    let errorThrown = false;
    try {
      service.import('data', 'unsupported-format');
    } catch (error) {
      errorThrown = true;
    }

    assert(errorThrown, 'Should throw error for unsupported format');
  });

  test('Get format info', () => {
    const info = service.getFormatInfo('keepass-csv');

    assert(info !== null, 'Should return format info');
    assert(info.name === 'KeePass CSV', 'Name should match');
    assert(info.extension === '.csv', 'Extension should match');
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach(err => {
      console.log(`  - ${err.name}: ${err.error}`);
    });
  }

  console.log('='.repeat(50) + '\n');

  return {
    success: results.failed === 0,
    results
  };
}

// Auto-run tests if in Node.js environment
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('test-import-export.js')) {
  runImportExportTests();
}

export default runImportExportTests;
