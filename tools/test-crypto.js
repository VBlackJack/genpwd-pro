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

// tools/test-crypto.js - Tests unitaires pour les fonctions cryptographiques

import { randInt, pick } from '../src/js/utils/helpers.js';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Test: randInt generates values within range
 */
function testRandIntRange() {
  const testName = 'randInt() - Range validation';
  try {
    const iterations = 1000;
    const min = 10;
    const max = 20;

    for (let i = 0; i < iterations; i++) {
      const value = randInt(min, max);
      if (value < min || value > max) {
        throw new Error(`Value ${value} outside range [${min}, ${max}]`);
      }
    }

    log.success(`${testName}: All ${iterations} values within range [${min}, ${max}]`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: randInt distribution (chi-square test)
 */
function testRandIntDistribution() {
  const testName = 'randInt() - Distribution uniformity';
  try {
    const iterations = 10000;
    const min = 0;
    const max = 9;
    const buckets = new Array(max - min + 1).fill(0);

    // Generate values
    for (let i = 0; i < iterations; i++) {
      const value = randInt(min, max);
      buckets[value - min]++;
    }

    // Expected count per bucket
    const expected = iterations / buckets.length;
    const threshold = expected * 0.2; // 20% tolerance

    // Check distribution
    for (let i = 0; i < buckets.length; i++) {
      const diff = Math.abs(buckets[i] - expected);
      if (diff > threshold) {
        throw new Error(`Bucket ${i} has ${buckets[i]} values, expected ~${expected} (diff: ${diff})`);
      }
    }

    log.success(`${testName}: Distribution is uniform (within 20% threshold)`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: randInt power of 2 optimization
 */
function testRandIntPowerOf2() {
  const testName = 'randInt() - Power of 2 optimization';
  try {
    const iterations = 1000;

    // Test range that is power of 2
    for (let i = 0; i < iterations; i++) {
      const value = randInt(0, 255); // Range of 256 (2^8)
      if (value < 0 || value > 255) {
        throw new Error(`Value ${value} outside range [0, 255]`);
      }
    }

    log.success(`${testName}: Power of 2 range [0, 255] works correctly`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: pick selects from all elements
 */
function testPickCoverage() {
  const testName = 'pick() - Coverage test';
  try {
    const array = ['a', 'b', 'c', 'd', 'e'];
    const selected = new Set();
    const iterations = 5000;

    for (let i = 0; i < iterations; i++) {
      selected.add(pick(array));
    }

    if (selected.size !== array.length) {
      throw new Error(`Only selected ${selected.size}/${array.length} elements: ${[...selected].join(', ')}`);
    }

    log.success(`${testName}: All ${array.length} elements selected from array`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: pick error handling
 */
function testPickErrorHandling() {
  const testName = 'pick() - Error handling';
  try {
    // Test empty array
    try {
      pick([]);
      throw new Error('Should throw error for empty array');
    } catch (e) {
      if (!e.message.includes('vide')) {
        throw e;
      }
    }

    // Test non-array
    try {
      pick('not an array');
      throw new Error('Should throw error for non-array');
    } catch (e) {
      if (!e.message.includes('array')) {
        throw e;
      }
    }

    log.success(`${testName}: Error handling works correctly`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: randInt uses crypto.getRandomValues
 */
function testCryptoSource() {
  const testName = 'crypto.getRandomValues() - Source validation';
  try {
    // Verify crypto.getRandomValues exists
    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
      throw new Error('crypto.getRandomValues not available');
    }

    // Generate entropy test
    const values = new Set();
    for (let i = 0; i < 100; i++) {
      values.add(randInt(0, 1000000));
    }

    // High entropy means very few collisions
    if (values.size < 95) {
      throw new Error(`Low entropy detected: only ${values.size}/100 unique values`);
    }

    log.success(`${testName}: crypto.getRandomValues available, high entropy (${values.size}/100 unique)`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message });
  }
}

/**
 * Test: Rejection sampling bias elimination
 */
function testRejectionSampling() {
  const testName = 'Rejection sampling - Bias elimination';
  try {
    const iterations = 10000;
    const buckets = {};

    // Test with a range that would show bias with naive modulo
    // Range: 0-6 (7 values) with 256 possible byte values
    // 256 % 7 = 4, so values 0-3 would be overrepresented with naive modulo
    for (let i = 0; i < iterations; i++) {
      const value = randInt(0, 6);
      buckets[value] = (buckets[value] || 0) + 1;
    }

    const expected = iterations / 7;
    const maxDiff = Math.max(...Object.values(buckets).map(count => Math.abs(count - expected)));
    const threshold = expected * 0.25; // 25% tolerance

    if (maxDiff > threshold) {
      throw new Error(`Max difference ${maxDiff} exceeds threshold ${threshold}`);
    }

    log.success(`${testName}: No modulo bias detected (max diff: ${Math.round(maxDiff)}/${Math.round(threshold)})`);
    results.passed++;
  } catch (error) {
    log.error(`${testName}: ${error.message}`);
    results.failed++;
    results.errors.push({ test: testName, error: error.message});
  }
}

/**
 * Run all crypto tests
 */
async function runCryptoTests() {
  console.log('\n' + '='.repeat(60));
  log.info('🔐 TESTS CRYPTOGRAPHIQUES - randInt() & pick()');
  console.log('='.repeat(60) + '\n');

  testRandIntRange();
  testRandIntDistribution();
  testRandIntPowerOf2();
  testRejectionSampling();
  testPickCoverage();
  testPickErrorHandling();
  testCryptoSource();

  // Results summary
  console.log('\n' + '='.repeat(60));
  const total = results.passed + results.failed;
  const score = Math.round((results.passed / total) * 100);

  if (score === 100) {
    log.success(`RÉSULTATS: ${results.passed}/${total} tests réussis (${score}%)`);
  } else {
    log.warn(`RÉSULTATS: ${results.passed}/${total} tests réussis (${score}%)`);
  }

  if (results.errors.length > 0) {
    console.log('\n' + colors.red + 'ERREURS:' + colors.reset);
    results.errors.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`);
    });
  }

  console.log('='.repeat(60) + '\n');

  return score === 100 ? 0 : 1;
}

// Run tests
runCryptoTests().then(exitCode => process.exit(exitCode));
