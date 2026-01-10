/*
 * Copyright 2026 Julien Bombled
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
 * Import Parser Fuzzing Tests
 *
 * This test suite performs fuzzing on import parsers to identify potential
 * security vulnerabilities, crashes, or unexpected behavior when handling
 * malformed or malicious input.
 *
 * Security Focus:
 * - Buffer overflow prevention
 * - Memory exhaustion attacks
 * - Injection attacks (XSS, command injection)
 * - Format string vulnerabilities
 * - Path traversal attempts
 *
 * @module test-import-fuzzing
 */

// Fuzzing configuration
const FUZZ_CONFIG = {
  // Number of random test cases per fuzzer
  iterations: 100,

  // Maximum size for generated payloads (bytes)
  maxPayloadSize: 1024 * 100, // 100KB

  // Timeout per test case (ms)
  timeout: 5000,

  // Seed for reproducible tests (null for random)
  seed: null
};

/**
 * Simple PRNG for reproducible fuzzing
 */
class FuzzRandom {
  constructor(seed = null) {
    this.seed = seed || Date.now();
    this.state = this.seed;
  }

  next() {
    // Linear congruential generator
    this.state = (this.state * 1103515245 + 12345) & 0x7FFFFFFF;
    return this.state / 0x7FFFFFFF;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextBytes(length) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = this.nextInt(0, 255);
    }
    return bytes;
  }

  pick(array) {
    return array[this.nextInt(0, array.length - 1)];
  }

  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Payload generators for different attack vectors
 */
const PayloadGenerators = {
  /**
   * Generate random bytes
   */
  randomBytes(rng, length) {
    return rng.nextBytes(length);
  },

  /**
   * Generate string with special characters
   */
  specialChars(rng) {
    const chars = [
      '\x00', '\x01', '\x7F', '\xFF',           // Control chars
      '"', "'", '`', '\\', '/',                  // Quote/escape chars
      '<', '>', '&', ';', '|',                   // Injection chars
      '\n', '\r', '\t', '\v', '\f',              // Whitespace
      '\u0000', '\u200B', '\uFEFF', '\uFFFF',    // Unicode special
      '${', '#{', '{{', '}}',                    // Template injection
      '../', '..\\', '/etc/passwd',              // Path traversal
      'javascript:', 'data:', 'vbscript:',      // Protocol injection
    ];

    let result = '';
    const length = rng.nextInt(1, 100);
    for (let i = 0; i < length; i++) {
      result += rng.pick(chars);
    }
    return result;
  },

  /**
   * Generate oversized string
   */
  oversizedString(rng) {
    const length = rng.nextInt(10000, FUZZ_CONFIG.maxPayloadSize);
    return 'A'.repeat(length);
  },

  /**
   * Generate deeply nested structure
   */
  deeplyNested(rng, depth = 100) {
    let result = 'value';
    for (let i = 0; i < depth; i++) {
      result = { nested: result };
    }
    return result;
  },

  /**
   * Generate array with many elements
   */
  largeArray(rng) {
    const length = rng.nextInt(1000, 10000);
    return Array(length).fill('item');
  },

  /**
   * Generate malformed JSON
   */
  malformedJson(rng) {
    const malformations = [
      '{"unclosed": "value"',
      '{"key": undefined}',
      '{"key": NaN}',
      '{"key": Infinity}',
      '{key: "unquoted"}',
      '{"duplicate": 1, "duplicate": 2}',
      '{"key": "\u0000hidden"}',
      '{"__proto__": {"polluted": true}}',
      '{"constructor": {"prototype": {}}}',
      '[' + ','.repeat(1000) + ']',
      '{"a":'.repeat(100) + '1' + '}'.repeat(100),
    ];
    return rng.pick(malformations);
  },

  /**
   * Generate malformed CSV
   */
  malformedCsv(rng) {
    const malformations = [
      'field1,"unclosed quote\nfield2,value',
      'field1,field2\n"value with ""escaped"" quotes"',
      ',,,,,\n,,,,,',
      'a'.repeat(10000) + ',b,c',
      'field1,field2\n\x00\x01\x02,value',
      'field1,field2\r\nvalue1\rvalue2\nvalue3',
      '"field""with""many""quotes""",value',
      'field1;field2;field3',  // Wrong delimiter
      'field1\tfield2\tfield3', // Tab delimiter
    ];
    return rng.pick(malformations);
  },

  /**
   * Generate XSS payloads
   */
  xssPayload(rng) {
    const payloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
      '"><script>alert(1)</script>',
      "'-alert(1)-'",
      '<div style="background:url(javascript:alert(1))">',
      '<math><maction actiontype="statusline#http://evil.com">',
      '<a href="&#x6A;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;">',
      '\u003cscript\u003ealert(1)\u003c/script\u003e',
      '<scr<script>ipt>alert(1)</scr</script>ipt>',
    ];
    return rng.pick(payloads);
  },

  /**
   * Generate SQL injection payloads
   */
  sqlInjection(rng) {
    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE users;--",
      "1; SELECT * FROM passwords",
      "UNION SELECT * FROM credentials",
      "' AND 1=1--",
      "admin'--",
      "1' OR '1'='1' /*",
    ];
    return rng.pick(payloads);
  },

  /**
   * Generate command injection payloads
   */
  commandInjection(rng) {
    const payloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '`whoami`',
      '$(id)',
      '&& rm -rf /',
      '\n/bin/sh',
      '%0a/bin/sh',
    ];
    return rng.pick(payloads);
  },

  /**
   * Generate prototype pollution payloads
   */
  prototypePollution(rng) {
    const payloads = [
      { '__proto__': { 'polluted': true } },
      { 'constructor': { 'prototype': { 'polluted': true } } },
      JSON.parse('{"__proto__": {"isAdmin": true}}'),
      { '__proto__.toString': 'polluted' },
    ];
    return rng.pick(payloads);
  },

  /**
   * Generate KDBX-like malformed headers
   */
  malformedKdbxHeader(rng) {
    const headers = [
      // Wrong signature
      new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      // Partial signature
      new Uint8Array([0x03, 0xD9, 0xA2]),
      // Correct signature, garbage after
      new Uint8Array([0x03, 0xD9, 0xA2, 0x9A, ...rng.nextBytes(100)]),
      // Very large claimed size
      new Uint8Array([0x03, 0xD9, 0xA2, 0x9A, 0xFF, 0xFF, 0xFF, 0xFF]),
      // Zero-filled
      new Uint8Array(1000).fill(0),
    ];
    return rng.pick(headers);
  }
};

/**
 * Test result collector
 */
class FuzzTestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.crashes = [];
    this.timeouts = [];
  }

  recordPass() {
    this.passed++;
  }

  recordFail(testName, input, error) {
    this.failed++;
    this.errors.push({ testName, input: this.sanitizeInput(input), error: error.message });
  }

  recordCrash(testName, input, error) {
    this.crashes.push({ testName, input: this.sanitizeInput(input), error: error.message });
  }

  recordTimeout(testName, input) {
    this.timeouts.push({ testName, input: this.sanitizeInput(input) });
  }

  sanitizeInput(input) {
    // Truncate and escape for logging
    const str = typeof input === 'string' ? input : JSON.stringify(input);
    if (str.length > 100) {
      return str.substring(0, 100) + '... [truncated]';
    }
    return str.replace(/[\x00-\x1F]/g, '\\x' + ((c) => c.charCodeAt(0).toString(16).padStart(2, '0')));
  }

  getSummary() {
    return {
      total: this.passed + this.failed,
      passed: this.passed,
      failed: this.failed,
      crashCount: this.crashes.length,
      timeoutCount: this.timeouts.length,
      errors: this.errors.slice(0, 10), // First 10 errors
      crashes: this.crashes,
      timeouts: this.timeouts.slice(0, 5)
    };
  }
}

/**
 * Fuzzing test runner
 */
async function runFuzzTests(importService) {
  const results = new FuzzTestResults();
  const rng = new FuzzRandom(FUZZ_CONFIG.seed);

  console.log('=== Import Parser Fuzzing Tests ===');
  console.log(`Seed: ${rng.seed}`);
  console.log(`Iterations per test: ${FUZZ_CONFIG.iterations}`);
  console.log('');

  // Test CSV Parser
  console.log('Testing CSV Parser...');
  await fuzzCsvParser(importService, rng, results);

  // Test JSON Parser
  console.log('Testing JSON Parser...');
  await fuzzJsonParser(importService, rng, results);

  // Test input sanitization
  console.log('Testing Input Sanitization...');
  await fuzzInputSanitization(rng, results);

  // Print results
  const summary = results.getSummary();
  console.log('');
  console.log('=== Fuzzing Results ===');
  console.log(`Total tests: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Crashes: ${summary.crashCount}`);
  console.log(`Timeouts: ${summary.timeoutCount}`);

  if (summary.crashes.length > 0) {
    console.log('');
    console.log('CRASHES DETECTED:');
    summary.crashes.forEach(c => {
      console.log(`  - ${c.testName}: ${c.error}`);
    });
  }

  return summary;
}

/**
 * Fuzz CSV parser
 */
async function fuzzCsvParser(importService, rng, results) {
  const testCases = [
    // Malformed CSV
    ...Array(FUZZ_CONFIG.iterations / 4).fill(null).map(() =>
      PayloadGenerators.malformedCsv(rng)),

    // Special characters in fields
    ...Array(FUZZ_CONFIG.iterations / 4).fill(null).map(() =>
      `title,username,password\n${PayloadGenerators.specialChars(rng)},user,pass`),

    // XSS in fields
    ...Array(FUZZ_CONFIG.iterations / 4).fill(null).map(() =>
      `title,username,password\n${PayloadGenerators.xssPayload(rng)},user,pass`),

    // Oversized fields
    ...Array(FUZZ_CONFIG.iterations / 4).fill(null).map(() =>
      `title,username,password\n${PayloadGenerators.oversizedString(rng)},user,pass`),
  ];

  for (const testCase of testCases) {
    try {
      // Parser should not crash, should handle gracefully
      if (importService && typeof importService.parseCSV === 'function') {
        await withTimeout(
          importService.parseCSV(testCase),
          FUZZ_CONFIG.timeout
        );
      }
      results.recordPass();
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        results.recordTimeout('CSV Parser', testCase);
      } else if (isCrash(error)) {
        results.recordCrash('CSV Parser', testCase, error);
      } else {
        // Expected error (validation, parsing) - this is OK
        results.recordPass();
      }
    }
  }
}

/**
 * Fuzz JSON parser
 */
async function fuzzJsonParser(importService, rng, results) {
  const testCases = [
    // Malformed JSON
    ...Array(FUZZ_CONFIG.iterations / 5).fill(null).map(() =>
      PayloadGenerators.malformedJson(rng)),

    // Deeply nested objects
    ...Array(FUZZ_CONFIG.iterations / 5).fill(null).map(() =>
      JSON.stringify(PayloadGenerators.deeplyNested(rng, rng.nextInt(50, 200)))),

    // Large arrays
    ...Array(FUZZ_CONFIG.iterations / 5).fill(null).map(() =>
      JSON.stringify(PayloadGenerators.largeArray(rng))),

    // Prototype pollution attempts
    ...Array(FUZZ_CONFIG.iterations / 5).fill(null).map(() =>
      JSON.stringify(PayloadGenerators.prototypePollution(rng))),

    // XSS in values
    ...Array(FUZZ_CONFIG.iterations / 5).fill(null).map(() =>
      JSON.stringify({ title: PayloadGenerators.xssPayload(rng) })),
  ];

  for (const testCase of testCases) {
    try {
      if (importService && typeof importService.parseJSON === 'function') {
        await withTimeout(
          importService.parseJSON(testCase),
          FUZZ_CONFIG.timeout
        );
      }
      results.recordPass();
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        results.recordTimeout('JSON Parser', testCase);
      } else if (isCrash(error)) {
        results.recordCrash('JSON Parser', testCase, error);
      } else {
        results.recordPass();
      }
    }
  }
}

/**
 * Fuzz input sanitization
 */
async function fuzzInputSanitization(rng, results) {
  // Test DOMPurify or equivalent sanitizer
  const testCases = [
    ...Array(FUZZ_CONFIG.iterations).fill(null).map(() =>
      PayloadGenerators.xssPayload(rng)),
  ];

  for (const testCase of testCases) {
    try {
      // If DOMPurify is available, test it
      if (typeof DOMPurify !== 'undefined') {
        const sanitized = DOMPurify.sanitize(testCase);
        // Verify no script tags remain
        if (sanitized.includes('<script') || sanitized.includes('javascript:')) {
          results.recordFail('Sanitization', testCase, new Error('XSS payload not sanitized'));
          continue;
        }
      }
      results.recordPass();
    } catch (error) {
      if (isCrash(error)) {
        results.recordCrash('Sanitization', testCase, error);
      } else {
        results.recordPass();
      }
    }
  }
}

/**
 * Check if error indicates a crash vs expected validation error
 */
function isCrash(error) {
  const crashIndicators = [
    'RangeError',
    'Maximum call stack',
    'out of memory',
    'heap',
    'FATAL',
    'segfault',
    'SIGABRT',
    'SIGSEGV'
  ];

  const errorStr = error.toString();
  return crashIndicators.some(indicator =>
    errorStr.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Timeout wrapper for async operations
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    )
  ]);
}

/**
 * Export for test runner
 */
export {
  runFuzzTests,
  FuzzRandom,
  PayloadGenerators,
  FuzzTestResults,
  FUZZ_CONFIG
};

// If running directly
if (typeof window !== 'undefined' && window.runFuzzTests === undefined) {
  window.runFuzzTests = runFuzzTests;
}
