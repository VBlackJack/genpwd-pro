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

// src/js/utils/batch-processor.js - Batch processing for async operations

import { PERFORMANCE } from '../config/ui-constants.js';
import { safeLog } from './logger.js';

/**
 * Processes an array of items in batches to prevent memory overload
 * @param {Array<*>} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} [batchSize] - Number of items per batch (default: 10)
 * @returns {Promise<Array<*>>} Array of processed results
 */
export async function processBatch(items, processor, batchSize = PERFORMANCE.MAX_BATCH_SIZE) {
  if (!Array.isArray(items)) {
    throw new Error('processBatch: items must be an array');
  }

  if (typeof processor !== 'function') {
    throw new Error('processBatch: processor must be a function');
  }

  const results = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  safeLog(`processBatch: Processing ${items.length} items in ${totalBatches} batches of ${batchSize}`);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    safeLog(`processBatch: Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((item, index) => processor(item, i + index))
    );

    results.push(...batchResults);

    // Small delay between batches to prevent UI freeze
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, PERFORMANCE.BATCH_DELAY));
    }
  }

  safeLog(`processBatch: Completed processing ${results.length} items`);
  return results;
}

/**
 * Processes items with a concurrency limit (pLimit style)
 * @param {Array<*>} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} [concurrency] - Maximum concurrent operations (default: 10)
 * @returns {Promise<Array<*>>} Array of processed results
 */
export async function processWithLimit(items, processor, concurrency = 10) {
  if (!Array.isArray(items)) {
    throw new Error('processWithLimit: items must be an array');
  }

  if (typeof processor !== 'function') {
    throw new Error('processWithLimit: processor must be a function');
  }

  const results = [];
  const executing = [];

  for (const [index, item] of items.entries()) {
    const promise = Promise.resolve().then(() => processor(item, index));
    results.push(promise);

    if (concurrency <= items.length) {
      const execution = promise.then(() => executing.splice(executing.indexOf(execution), 1));
      executing.push(execution);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

export default {
  processBatch,
  processWithLimit
};
