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

// src/js/utils/performance.js - Performance measurement tools

import { safeLog } from './logger.js';

/**
 * Benchmark storage
 */
const benchmarkResults = new Map();

/**
 * Class for measuring execution time
 */
class PerformanceTimer {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
    return this;
  }

  stop() {
    if (!this.startTime) {
      throw new Error('Timer not started');
    }
    this.endTime = performance.now();
    return this.duration;
  }

  get duration() {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    return this.endTime - this.startTime;
  }
}

/**
 * Measures the execution time of a function
 * @param {string} name - Measurement name
 * @param {Function} fn - Function to measure
 * @returns {Promise<{result: *, duration: number}>} Result and duration
 *
 * @example
 * const { result, duration } = await measurePerformance('password-gen', () => {
 *   return generateSyllables({ length: 20 });
 * });
 * console.log(`Generated in ${duration.toFixed(2)}ms`);
 */
export async function measurePerformance(name, fn) {
  const timer = new PerformanceTimer(name);
  timer.start();

  let result;
  try {
    result = await fn();
  } catch (error) {
    timer.stop();
    throw error;
  }

  const duration = timer.stop();

  // Save result
  if (!benchmarkResults.has(name)) {
    benchmarkResults.set(name, []);
  }
  benchmarkResults.get(name).push({
    duration,
    timestamp: Date.now()
  });

  safeLog(`⏱️  ${name}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

/**
 * Executes a benchmark N times and calculates statistics
 * @param {string} name - Benchmark name
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations
 * @returns {Promise<Object>} Performance statistics
 *
 * @example
 * const stats = await benchmark('password-generation', () => {
 *   return generateSyllables({ length: 20, policy: 'standard' });
 * }, 1000);
 *
 * console.log(`Moyenne: ${stats.mean.toFixed(2)}ms`);
 * console.log(`Min: ${stats.min.toFixed(2)}ms, Max: ${stats.max.toFixed(2)}ms`);
 */
export async function benchmark(name, fn, iterations = 100) {
  safeLog(`🔬 Starting benchmark "${name}" (${iterations} iterations)`);

  const durations = [];
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const { duration } = await measurePerformance(`${name}-iter-${i}`, fn);
    durations.push(duration);
  }

  const totalTime = performance.now() - startTime;

  // Calculate statistics
  const sorted = [...durations].sort((a, b) => a - b);
  const stats = {
    name,
    iterations,
    totalTime: totalTime,
    durations: durations,
    min: Math.min(...durations),
    max: Math.max(...durations),
    mean: durations.reduce((a, b) => a + b, 0) / durations.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    stdDev: calculateStdDev(durations)
  };

  safeLog(`📊 Benchmark "${name}" completed:`);
  safeLog(`   Mean: ${stats.mean.toFixed(2)}ms`);
  safeLog(`   Median: ${stats.median.toFixed(2)}ms`);
  safeLog(`   Min: ${stats.min.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms`);
  safeLog(`   P95: ${stats.p95.toFixed(2)}ms | P99: ${stats.p99.toFixed(2)}ms`);
  safeLog(`   Std Dev: ${stats.stdDev.toFixed(2)}ms`);
  safeLog(`   Total time: ${stats.totalTime.toFixed(2)}ms`);

  return stats;
}

/**
 * Calculates the standard deviation
 * @param {Array<number>} values - Values
 * @returns {number} Standard deviation
 */
function calculateStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Gets benchmark results
 * @param {string} [name] - Benchmark name (optional)
 * @returns {Array|Map} Results
 */
export function getBenchmarkResults(name = null) {
  if (name) {
    return benchmarkResults.get(name) || [];
  }
  return benchmarkResults;
}

/**
 * Clears benchmark results
 * @param {string} [name] - Benchmark name to clear (optional, clears all if omitted)
 */
export function clearBenchmarkResults(name = null) {
  if (name) {
    benchmarkResults.delete(name);
  } else {
    benchmarkResults.clear();
  }
}

/**
 * Wrapper pour marquer une fonction avec un timer automatique
 * @param {string} name - Nom de la mesure
 * @param {Function} fn - Fonction à wrapper
 * @returns {Function} Fonction wrappée
 *
 * @example
 * const timedGenerate = withTimer('generate', generateSyllables);
 * const result = await timedGenerate({ length: 20 });
 */
export function withTimer(name, fn) {
  return async function(...args) {
    const { result } = await measurePerformance(name, () => fn(...args));
    return result;
  };
}

/**
 * Compare les performances de plusieurs fonctions
 * @param {Object} functions - Objet avec nom: fonction
 * @param {number} iterations - Nombre d'itérations par fonction
 * @returns {Promise<Object>} Résultats comparatifs
 *
 * @example
 * const results = await comparePerformance({
 *   'syllables': () => generateSyllables({ length: 20 }),
 *   'passphrase': () => generatePassphrase({ wordCount: 5 })
 * }, 100);
 */
export async function comparePerformance(functions, iterations = 100) {
  const results = {};

  for (const [name, fn] of Object.entries(functions)) {
    results[name] = await benchmark(name, fn, iterations);
  }

  // Display comparison
  safeLog('\n📊 PERFORMANCE COMPARISON:');
  const sorted = Object.entries(results).sort((a, b) => a[1].mean - b[1].mean);

  sorted.forEach(([name, stats], index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    safeLog(`${emoji} ${name}: ${stats.mean.toFixed(2)}ms (±${stats.stdDev.toFixed(2)}ms)`);
  });

  return results;
}

/**
 * Measures memory usage (if available)
 * @returns {Object|null} Memory info
 */
export function measureMemory() {
  if (!performance.memory) {
    safeLog('Memory API not available');
    return null;
  }

  const memory = {
    used: performance.memory.usedJSHeapSize,
    total: performance.memory.totalJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit,
    usedMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
    totalMB: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
    limitMB: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
  };

  safeLog(`💾 Memory: ${memory.usedMB}MB / ${memory.limitMB}MB`);
  return memory;
}

/**
 * Exports benchmark results as JSON
 * @returns {string} JSON results
 */
export function exportBenchmarkResults() {
  const data = {
    exported: new Date().toISOString(),
    userAgent: navigator.userAgent,
    benchmarks: {}
  };

  benchmarkResults.forEach((results, name) => {
    const durations = results.map(r => r.duration);
    data.benchmarks[name] = {
      count: results.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      results: results
    };
  });

  return JSON.stringify(data, null, 2);
}
