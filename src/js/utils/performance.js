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

// src/js/utils/performance.js - Outils de mesure de performance

import { safeLog } from './logger.js';

/**
 * Stockage des benchmarks
 */
const benchmarkResults = new Map();

/**
 * Classe pour mesurer le temps d'exécution
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
 * Mesure le temps d'exécution d'une fonction
 * @param {string} name - Nom de la mesure
 * @param {Function} fn - Fonction à mesurer
 * @returns {Promise<{result: *, duration: number}>} Résultat et durée
 *
 * @example
 * const { result, duration } = await measurePerformance('password-gen', () => {
 *   return generateSyllables({ length: 20 });
 * });
 * console.log(`Génération en ${duration.toFixed(2)}ms`);
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

  // Sauvegarder le résultat
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
 * Exécute un benchmark N fois et calcule les statistiques
 * @param {string} name - Nom du benchmark
 * @param {Function} fn - Fonction à benchmarker
 * @param {number} iterations - Nombre d'itérations
 * @returns {Promise<Object>} Statistiques de performance
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
  safeLog(`🔬 Démarrage benchmark "${name}" (${iterations} itérations)`);

  const durations = [];
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const { duration } = await measurePerformance(`${name}-iter-${i}`, fn);
    durations.push(duration);
  }

  const totalTime = performance.now() - startTime;

  // Calcul des statistiques
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

  safeLog(`📊 Benchmark "${name}" terminé:`);
  safeLog(`   Moyenne: ${stats.mean.toFixed(2)}ms`);
  safeLog(`   Médiane: ${stats.median.toFixed(2)}ms`);
  safeLog(`   Min: ${stats.min.toFixed(2)}ms | Max: ${stats.max.toFixed(2)}ms`);
  safeLog(`   P95: ${stats.p95.toFixed(2)}ms | P99: ${stats.p99.toFixed(2)}ms`);
  safeLog(`   Écart-type: ${stats.stdDev.toFixed(2)}ms`);
  safeLog(`   Temps total: ${stats.totalTime.toFixed(2)}ms`);

  return stats;
}

/**
 * Calcule l'écart-type
 * @param {Array<number>} values - Valeurs
 * @returns {number} Écart-type
 */
function calculateStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Récupère les résultats de benchmarks
 * @param {string} [name] - Nom du benchmark (optionnel)
 * @returns {Array|Map} Résultats
 */
export function getBenchmarkResults(name = null) {
  if (name) {
    return benchmarkResults.get(name) || [];
  }
  return benchmarkResults;
}

/**
 * Efface les résultats de benchmarks
 * @param {string} [name] - Nom du benchmark à effacer (optionnel, efface tout si omis)
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

  // Afficher la comparaison
  safeLog('\n📊 COMPARAISON DES PERFORMANCES:');
  const sorted = Object.entries(results).sort((a, b) => a[1].mean - b[1].mean);

  sorted.forEach(([name, stats], index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    safeLog(`${emoji} ${name}: ${stats.mean.toFixed(2)}ms (±${stats.stdDev.toFixed(2)}ms)`);
  });

  return results;
}

/**
 * Mesure la mémoire utilisée (si disponible)
 * @returns {Object|null} Info mémoire
 */
export function measureMemory() {
  if (!performance.memory) {
    safeLog('API memory non disponible');
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

  safeLog(`💾 Mémoire: ${memory.usedMB}MB / ${memory.limitMB}MB`);
  return memory;
}

/**
 * Exporte les résultats de benchmarks au format JSON
 * @returns {string} JSON des résultats
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
