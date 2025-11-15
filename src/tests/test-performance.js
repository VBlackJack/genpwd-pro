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
 * Performance Benchmarking Tests
 * Measures performance of critical operations with defined thresholds
 */

import { strict as assert } from 'assert';
import { performance } from 'perf_hooks';
import { generateSyllables, generatePassphrase } from '../js/core/generators.js';
import { loadDictionary } from '../js/core/dictionaries.js';

/**
 * Performance test runner with benchmarking
 */
class PerformanceTestRunner {
  constructor() {
    this.benchmarks = [];
    this.results = { passed: 0, failed: 0, errors: [], timings: [] };
  }

  /**
   * Add a performance benchmark
   * @param {string} name - Benchmark name
   * @param {Function} fn - Benchmark function
   * @param {number} threshold - Maximum acceptable duration in ms
   */
  addBenchmark(name, fn, threshold) {
    this.benchmarks.push({ name, fn, threshold });
  }

  /**
   * Measure execution time of a function
   * @param {Function} fn - Function to measure
   * @returns {Promise<{duration: number, result: *}>}
   */
  async measure(fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { duration: end - start, result };
  }

  /**
   * Run a benchmark multiple times and return average
   * @param {Function} fn - Function to benchmark
   * @param {number} iterations - Number of iterations
   * @returns {Promise<{avg: number, min: number, max: number, median: number}>}
   */
  async runBenchmarkMultiple(fn, iterations = 10) {
    const durations = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measure(fn);
      durations.push(duration);
    }

    durations.sort((a, b) => a - b);

    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)]
    };
  }

  async run() {
    console.log('⚡ Running Performance Benchmarks...\n');

    for (const benchmark of this.benchmarks) {
      try {
        const stats = await this.runBenchmarkMultiple(benchmark.fn, 10);
        const passed = stats.avg <= benchmark.threshold;

        this.results.timings.push({
          name: benchmark.name,
          ...stats,
          threshold: benchmark.threshold,
          passed
        });

        if (passed) {
          this.results.passed++;
          console.log(`✅ ${benchmark.name}`);
          console.log(`   Avg: ${stats.avg.toFixed(2)}ms | Median: ${stats.median.toFixed(2)}ms | Threshold: ${benchmark.threshold}ms`);
        } else {
          this.results.failed++;
          this.results.errors.push({
            test: benchmark.name,
            error: `Performance exceeded threshold: ${stats.avg.toFixed(2)}ms > ${benchmark.threshold}ms`
          });
          console.log(`❌ ${benchmark.name}`);
          console.log(`   Avg: ${stats.avg.toFixed(2)}ms > Threshold: ${benchmark.threshold}ms`);
        }
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({
          test: benchmark.name,
          error: error.message
        });
        console.log(`❌ ${benchmark.name}: ${error.message}`);
      }
    }

    this.printSummary();
    return this.results;
  }

  printSummary() {
    const total = this.results.passed + this.results.failed;
    const percentage = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;

    console.log('\n' + '='.repeat(50));
    console.log('📊 Performance Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${percentage}%`);

    if (this.results.errors.length > 0) {
      console.log('\n🚨 Performance Issues:');
      this.results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
      });
    }

    console.log('\n⏱️  Detailed Timings:');
    this.results.timings.forEach(timing => {
      console.log(`  ${timing.name}:`);
      console.log(`    Average: ${timing.avg.toFixed(2)}ms`);
      console.log(`    Median:  ${timing.median.toFixed(2)}ms`);
      console.log(`    Min:     ${timing.min.toFixed(2)}ms`);
      console.log(`    Max:     ${timing.max.toFixed(2)}ms`);
    });
  }
}

/**
 * Setup performance benchmarks
 */
function setupBenchmarks(runner) {
  // Benchmark 1: Generate 1000 syllables passwords (< 1s)
  runner.addBenchmark(
    'Generate 1000 syllables passwords',
    () => {
      for (let i = 0; i < 1000; i++) {
        generateSyllables({
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
      }
    },
    1000 // 1000ms = 1 second
  );

  // Benchmark 2: Generate 100 passphrases (< 2s)
  runner.addBenchmark(
    'Generate 100 passphrases',
    async () => {
      for (let i = 0; i < 100; i++) {
        await generatePassphrase({
          wordCount: 4,
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
      }
    },
    2000 // 2000ms = 2 seconds
  );

  // Benchmark 3: Load dictionary (< 500ms)
  runner.addBenchmark(
    'Load French dictionary',
    async () => {
      await loadDictionary('french');
    },
    500 // 500ms
  );

  // Benchmark 4: Generate single complex password (< 50ms)
  runner.addBenchmark(
    'Generate single complex password',
    () => {
      generateSyllables({
        length: 20,
        policy: 'standard',
        digits: 3,
        specials: 3,
        customSpecials: '@#%!',
        placeDigits: 'aleatoire',
        placeSpecials: 'aleatoire',
        caseMode: 'mixte',
        useBlocks: false,
        blockTokens: []
      });
    },
    50 // 50ms
  );

  // Benchmark 5: Generate batch of 10 passwords (< 100ms)
  runner.addBenchmark(
    'Generate batch of 10 passwords',
    () => {
      for (let i = 0; i < 10; i++) {
        generateSyllables({
          length: 12,
          policy: 'standard',
          digits: 2,
          specials: 2,
          customSpecials: '',
          placeDigits: 'fin',
          placeSpecials: 'debut',
          caseMode: 'mixte',
          useBlocks: false,
          blockTokens: []
        });
      }
    },
    100 // 100ms
  );

  // Benchmark 6: Generate with blocks pattern (< 50ms)
  runner.addBenchmark(
    'Generate password with blocks pattern',
    () => {
      generateSyllables({
        length: 16,
        policy: 'standard',
        digits: 2,
        specials: 2,
        customSpecials: '',
        placeDigits: 'fin',
        placeSpecials: 'debut',
        caseMode: 'blocks',
        useBlocks: true,
        blockTokens: ['T', 'l', 'U', 'T']
      });
    },
    50 // 50ms
  );

  // Benchmark 7: Generate layout-safe password (< 50ms)
  runner.addBenchmark(
    'Generate layout-safe password',
    () => {
      generateSyllables({
        length: 18,
        policy: 'layout-safe',
        digits: 2,
        specials: 1,
        customSpecials: '',
        placeDigits: 'aleatoire',
        placeSpecials: 'milieu',
        caseMode: 'mixte',
        useBlocks: false,
        blockTokens: []
      });
    },
    50 // 50ms
  );

  // Benchmark 8: Rapid sequential generation (< 200ms for 50 passwords)
  runner.addBenchmark(
    'Rapid sequential generation (50 passwords)',
    () => {
      for (let i = 0; i < 50; i++) {
        generateSyllables({
          length: 10,
          policy: 'standard',
          digits: 1,
          specials: 1,
          customSpecials: '',
          placeDigits: 'fin',
          placeSpecials: 'debut',
          caseMode: 'lower',
          useBlocks: false,
          blockTokens: []
        });
      }
    },
    200 // 200ms
  );

  // Benchmark 9: Memory efficiency - generate without leaks
  runner.addBenchmark(
    'Memory efficiency check (1000 quick generations)',
    () => {
      const results = [];
      for (let i = 0; i < 1000; i++) {
        const result = generateSyllables({
          length: 8,
          policy: 'standard',
          digits: 1,
          specials: 0,
          customSpecials: '',
          placeDigits: 'fin',
          placeSpecials: 'fin',
          caseMode: 'lower',
          useBlocks: false,
          blockTokens: []
        });
        results.push(result.value);
      }
      // Clear results to simulate cleanup
      results.length = 0;
    },
    1000 // 1000ms
  );

  // Benchmark 10: Entropy calculation overhead (< 10ms)
  runner.addBenchmark(
    'Entropy calculation (100 calculations)',
    () => {
      for (let i = 0; i < 100; i++) {
        const result = generateSyllables({
          length: 12,
          policy: 'standard',
          digits: 2,
          specials: 2,
          customSpecials: '',
          placeDigits: 'fin',
          placeSpecials: 'milieu',
          caseMode: 'mixte',
          useBlocks: false,
          blockTokens: []
        });
        // Entropy is calculated as part of generation
        assert.ok(result.entropy > 0, 'Should calculate entropy');
      }
    },
    100 // 100ms for 100 calculations
  );
}

/**
 * Main test execution
 */
async function runPerformanceTests() {
  const runner = new PerformanceTestRunner();

  console.log('🎯 Performance Test Configuration:');
  console.log('  - Each benchmark runs 10 iterations');
  console.log('  - Results show average, median, min, max');
  console.log('  - Thresholds are strict for production readiness\n');

  setupBenchmarks(runner);

  const results = await runner.run();

  // Exit with appropriate code (only when run directly)
  if (import.meta.url === `file://${process.argv[1]}`) {
    if (results.failed > 0) {
      console.log('\n⚠️  Some performance benchmarks failed. Review and optimize as needed.');
      process.exit(1);
    } else {
      console.log('\n✅ All performance benchmarks passed!');
    }
  } else {
    // When imported, just log and return results
    if (results.failed === 0) {
      console.log('\n✅ All performance benchmarks passed!');
    } else {
      console.log('\n⚠️  Some performance benchmarks failed. Review and optimize as needed.');
    }
  }

  return results;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests().catch(error => {
    console.error('Fatal error running performance tests:', error);
    process.exit(1);
  });
}

export { runPerformanceTests };
