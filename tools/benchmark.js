#!/usr/bin/env node
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
 * Performance Benchmark Tool for GenPwd Pro
 *
 * Measures:
 * - Password generation time by mode (syllables, passphrase, leet)
 * - Batch generation performance (1, 10, 100, 1000 passwords)
 * - Memory usage
 * - DOM rendering performance (DocumentFragment vs innerHTML)
 *
 * Usage:
 *   node tools/benchmark.js
 */

import { performance, PerformanceObserver } from 'node:perf_hooks';
import { generateSyllables, generatePassphrase, generateLeet } from '../src/js/core/generators.js';
import { loadDictionary } from '../src/js/core/dictionaries.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

class Benchmark {
  constructor(name) {
    this.name = name;
    this.results = [];
  }

  /**
   * Run a benchmark test multiple times and calculate statistics
   */
  async run(testFn, iterations = 100) {
    console.log(`${colors.blue}Running: ${this.name}${colors.reset}`);

    const times = [];
    let memoryBefore = 0;
    let memoryAfter = 0;

    if (global.gc) {
      global.gc(); // Force GC if --expose-gc flag is used
      memoryBefore = process.memoryUsage().heapUsed;
    }

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testFn();
      const end = performance.now();
      times.push(end - start);
    }

    if (global.gc) {
      memoryAfter = process.memoryUsage().heapUsed;
    }

    const stats = this.calculateStats(times);
    stats.memoryDelta = memoryAfter - memoryBefore;

    this.results.push(stats);
    this.printStats(stats);

    return stats;
  }

  /**
   * Calculate statistical metrics from timing data
   */
  calculateStats(times) {
    const sorted = times.slice().sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;

    // Calculate standard deviation
    const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    return {
      iterations: times.length,
      mean: mean,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: stdDev,
      opsPerSec: 1000 / mean
    };
  }

  /**
   * Print benchmark statistics
   */
  printStats(stats) {
    console.log(`  ${colors.green}✓${colors.reset} ${this.name}`);
    console.log(`    Mean:     ${stats.mean.toFixed(3)} ms`);
    console.log(`    Median:   ${stats.median.toFixed(3)} ms`);
    console.log(`    Min:      ${stats.min.toFixed(3)} ms`);
    console.log(`    Max:      ${stats.max.toFixed(3)} ms`);
    console.log(`    P95:      ${stats.p95.toFixed(3)} ms`);
    console.log(`    P99:      ${stats.p99.toFixed(3)} ms`);
    console.log(`    Std Dev:  ${stats.stdDev.toFixed(3)} ms`);
    console.log(`    Ops/sec:  ${stats.opsPerSec.toFixed(0)}`);

    if (stats.memoryDelta) {
      const memoryMB = (stats.memoryDelta / 1024 / 1024).toFixed(2);
      console.log(`    Memory:   ${memoryMB} MB`);
    }
    console.log('');
  }

  /**
   * Compare with baseline and show improvement
   */
  static compare(baseline, optimized, metricName = 'mean') {
    const improvement = ((baseline[metricName] - optimized[metricName]) / baseline[metricName]) * 100;
    const symbol = improvement > 0 ? '↑' : '↓';
    const color = improvement > 0 ? colors.green : colors.red;

    console.log(`${color}${symbol} ${Math.abs(improvement).toFixed(1)}% ${improvement > 0 ? 'faster' : 'slower'}${colors.reset}`);
  }
}

// =============================================================================
// BENCHMARK TESTS
// =============================================================================

/**
 * Benchmark: Single password generation by mode
 */
async function benchmarkSingleGeneration() {
  console.log(`\n${colors.bright}=== Single Password Generation ===${colors.reset}\n`);

  const configSyllables = {
    length: 20,
    policy: 'standard',
    digits: 2,
    specials: 2,
    customSpecials: '!@#$%',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: 'mixte',
    useBlocks: false
  };

  const configPassphrase = {
    wordCount: 5,
    separator: '-',
    dictionary: 'french',
    digits: 2,
    specials: 2,
    customSpecials: '!@#$%',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: 'mixte'
  };

  const configLeet = {
    word: 'password',
    digits: 2,
    specials: 2,
    customSpecials: '!@#$%',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire'
  };

  // Pre-load dictionary to avoid affecting benchmark
  await loadDictionary('french');

  const syllablesBench = new Benchmark('Syllables Mode');
  await syllablesBench.run(() => generateSyllables(configSyllables), 1000);

  const passphraseBench = new Benchmark('Passphrase Mode');
  await passphraseBench.run(() => generatePassphrase(configPassphrase), 1000);

  const leetBench = new Benchmark('Leet Mode');
  await leetBench.run(() => generateLeet(configLeet), 1000);
}

/**
 * Benchmark: Batch password generation
 */
async function benchmarkBatchGeneration() {
  console.log(`\n${colors.bright}=== Batch Password Generation ===${colors.reset}\n`);

  const config = {
    length: 20,
    policy: 'standard',
    digits: 2,
    specials: 2,
    customSpecials: '!@#$%',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: 'mixte',
    useBlocks: false
  };

  const batchSizes = [10, 50, 100, 500, 1000];

  for (const size of batchSizes) {
    const bench = new Benchmark(`Generate ${size} passwords`);
    await bench.run(async () => {
      const results = [];
      for (let i = 0; i < size; i++) {
        results.push(await generateSyllables(config));
      }
      return results;
    }, 10);
  }
}

/**
 * Benchmark: Dictionary loading
 */
async function benchmarkDictionaryLoading() {
  console.log(`\n${colors.bright}=== Dictionary Loading ===${colors.reset}\n`);

  const dictionaries = ['french', 'english', 'latin'];

  for (const dict of dictionaries) {
    const bench = new Benchmark(`Load ${dict} dictionary`);
    await bench.run(() => loadDictionary(dict), 10);
  }
}

/**
 * Benchmark: DOM rendering performance
 * Simulates DocumentFragment vs innerHTML batch updates
 */
async function benchmarkDOMRendering() {
  console.log(`\n${colors.bright}=== DOM Rendering (Simulated) ===${colors.reset}\n`);

  // Note: This is a simplified benchmark since we're in Node.js
  // Real DOM benchmarks should be done in a browser environment

  const createMockPassword = (index) => ({
    value: `test-password-${index}`,
    entropy: 128.5,
    mode: 'syllables'
  });

  const passwords = Array.from({ length: 20 }, (_, i) => createMockPassword(i));

  // Simulate creating HTML strings (like old innerHTML approach)
  const htmlStringBench = new Benchmark('innerHTML approach (string concatenation)');
  await htmlStringBench.run(() => {
    let html = '';
    for (const pwd of passwords) {
      html += `<div class="pwd">${pwd.value}</div>`;
    }
    return html;
  }, 1000);

  // Simulate DocumentFragment approach
  const fragmentBench = new Benchmark('DocumentFragment approach (object creation)');
  await fragmentBench.run(() => {
    const elements = [];
    for (const pwd of passwords) {
      elements.push({ tag: 'div', className: 'pwd', text: pwd.value });
    }
    return elements;
  }, 1000);

  console.log(`${colors.yellow}Performance comparison:${colors.reset}`);
  Benchmark.compare(htmlStringBench.results[0], fragmentBench.results[0]);
}

/**
 * Benchmark: Memory usage under load
 */
async function benchmarkMemoryUsage() {
  console.log(`\n${colors.bright}=== Memory Usage ===${colors.reset}\n`);

  if (!global.gc) {
    console.log(`${colors.yellow}⚠ Run with --expose-gc for accurate memory measurements${colors.reset}\n`);
  }

  const config = {
    length: 20,
    policy: 'standard',
    digits: 2,
    specials: 2,
    customSpecials: '!@#$%',
    placeDigits: 'aleatoire',
    placeSpecials: 'aleatoire',
    caseMode: 'mixte',
    useBlocks: false
  };

  const memBefore = process.memoryUsage();

  // Generate 10,000 passwords
  const passwords = [];
  for (let i = 0; i < 10000; i++) {
    passwords.push(await generateSyllables(config));
  }

  const memAfter = process.memoryUsage();

  console.log(`Memory Before:`);
  console.log(`  Heap Used:     ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total:    ${(memBefore.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nMemory After (10,000 passwords):`);
  console.log(`  Heap Used:     ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total:    ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nMemory Delta:`);
  console.log(`  ${colors.green}+${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB${colors.reset}`);
  console.log(`  Per password:  ${((memAfter.heapUsed - memBefore.heapUsed) / 10000).toFixed(0)} bytes`);
  console.log('');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log(`\n${colors.bright}${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║         GenPwd Pro - Performance Benchmark Suite         ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);

  const startTime = performance.now();

  try {
    await benchmarkSingleGeneration();
    await benchmarkBatchGeneration();
    await benchmarkDictionaryLoading();
    await benchmarkDOMRendering();
    await benchmarkMemoryUsage();

    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n${colors.bright}${colors.green}✓ All benchmarks completed in ${totalTime}s${colors.reset}\n`);

    console.log(`${colors.yellow}💡 Performance Tips:${colors.reset}`);
    console.log(`  1. Use DocumentFragment for batch DOM updates (10x+ faster)`);
    console.log(`  2. Pre-load dictionaries during app initialization`);
    console.log(`  3. Use debounce/throttle for frequent events`);
    console.log(`  4. Enable Service Worker for instant cache responses`);
    console.log('');

  } catch (error) {
    console.error(`${colors.red}✗ Benchmark failed: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run benchmarks
main().catch(console.error);
