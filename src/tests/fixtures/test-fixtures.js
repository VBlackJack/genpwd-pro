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
 * Shared test fixtures for PresetManager and HistoryManager tests
 * Reduces duplication across test suites
 */

/**
 * Mock localStorage for Node.js testing
 */
export class LocalStorageMock {
  constructor() {
    this.store = {};
    this.quotaExceeded = false;
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    if (this.quotaExceeded) {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      error.code = 22;
      throw error;
    }
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

/**
 * Create a comprehensive DOM mock for Node.js testing
 * Handles most common DOM operations needed by UI modules
 */
export function createDOMMock() {
  const createMockElement = () => ({
    textContent: '',
    innerHTML: '',
    className: '',
    style: {},
    dataset: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    focus: () => {},
    click: () => {},
    remove: () => {}
  });

  return {
    documentElement: {
      style: {},
      setAttribute: () => {},
      getAttribute: () => null
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
      style: {},
      setAttribute: () => {},
      getAttribute: () => null
    },
    getElementById: () => null,
    createElement: (tag) => ({
      ...createMockElement(),
      tagName: tag.toUpperCase()
    }),
    createTextNode: (text) => ({ nodeValue: text }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

/**
 * Sample preset configurations for testing
 */
export const SAMPLE_PRESETS = {
  basic: {
    mode: 'syllables',
    length: 12,
    digits: 1,
    specials: 1
  },
  strong: {
    mode: 'syllables',
    length: 20,
    digits: 2,
    specials: 2,
    policy: 'standard'
  },
  passphrase: {
    mode: 'passphrase',
    wordCount: 4,
    separator: '-',
    dictionary: 'french'
  }
};

/**
 * Sample history entries for testing
 */
export const SAMPLE_HISTORY_ENTRIES = [
  {
    password: 'Test123!',
    metadata: { mode: 'syllables', length: 12 },
    timestamp: new Date('2025-01-15T10:00:00Z')
  },
  {
    password: 'Sample@456',
    metadata: { mode: 'leet', baseWord: 'sample' },
    timestamp: new Date('2025-01-15T11:00:00Z')
  },
  {
    password: 'correct-horse-battery-staple',
    metadata: { mode: 'passphrase', wordCount: 4 },
    timestamp: new Date('2025-01-15T12:00:00Z')
  }
];

/**
 * Initialize global test environment with mocks
 * Call this at the beginning of test files
 */
export function setupTestEnvironment() {
  // Set up localStorage mock
  const localStorageMock = new LocalStorageMock();
  global.localStorage = localStorageMock;

  // Set up document mock
  if (typeof global.document === 'undefined') {
    global.document = createDOMMock();
  }

  // Set up requestAnimationFrame mock
  if (typeof global.requestAnimationFrame === 'undefined') {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }

  return { localStorageMock };
}

/**
 * Clean up test environment after tests
 */
export function teardownTestEnvironment() {
  if (global.localStorage) {
    global.localStorage.clear();
  }
}

/**
 * Helper to create a test runner with standard setup/teardown
 */
export class TestRunner {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  addTest(testName, fn) {
    this.tests.push({ name: testName, fn });
  }

  async run() {
    console.log(`🧪 Running ${this.name} Tests...\n`);

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
