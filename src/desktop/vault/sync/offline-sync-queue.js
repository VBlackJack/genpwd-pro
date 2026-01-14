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

// src/desktop/vault/sync/offline-sync-queue.js - Offline Sync Queue
// Queues sync operations when offline and processes them when online

import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app, net } from 'electron';

/**
 * Operation types
 */
const OperationType = {
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  DELETE: 'delete',
  METADATA: 'metadata'
};

/**
 * Operation status
 */
const OperationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Queue entry structure
 * @typedef {Object} QueueEntry
 * @property {string} id - Unique operation ID
 * @property {string} type - Operation type
 * @property {string} vaultId - Vault identifier
 * @property {string} status - Current status
 * @property {number} createdAt - Creation timestamp
 * @property {number} attempts - Number of retry attempts
 * @property {number} lastAttempt - Last attempt timestamp
 * @property {Object} data - Operation-specific data
 * @property {string|null} error - Last error message
 */

/**
 * Offline Sync Queue
 * Manages sync operations when network is unavailable
 */
export class OfflineSyncQueue extends EventEmitter {
  #queuePath;
  #queue = [];
  #isProcessing = false;
  #isOnline = true;
  #maxRetries = 5;
  #retryDelayMs = 30000; // 30 seconds
  #checkIntervalMs = 60000; // 1 minute
  #checkInterval = null;

  constructor() {
    super();
    this.#queuePath = path.join(app.getPath('userData'), 'sync-queue.json');
    this.#loadQueue();
    this.#startNetworkMonitoring();
  }

  /**
   * Load queue from disk
   * @private
   */
  #loadQueue() {
    try {
      if (fs.existsSync(this.#queuePath)) {
        const data = fs.readFileSync(this.#queuePath, 'utf8');
        this.#queue = JSON.parse(data);

        // Reset in-progress operations to pending
        for (const entry of this.#queue) {
          if (entry.status === OperationStatus.IN_PROGRESS) {
            entry.status = OperationStatus.PENDING;
          }
        }

        console.log(`[OfflineQueue] Loaded ${this.#queue.length} queued operations`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
      this.#queue = [];
    }
  }

  /**
   * Save queue to disk
   * @private
   */
  #saveQueue() {
    try {
      fs.writeFileSync(this.#queuePath, JSON.stringify(this.#queue, null, 2));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }

  /**
   * Start monitoring network status
   * @private
   */
  #startNetworkMonitoring() {
    // Check initial status
    this.#isOnline = net.isOnline();

    // Monitor for changes
    this.#checkInterval = setInterval(() => {
      const wasOnline = this.#isOnline;
      this.#isOnline = net.isOnline();

      if (!wasOnline && this.#isOnline) {
        console.log('[OfflineQueue] Network restored, processing queue...');
        this.emit('online');
        this.processQueue();
      } else if (wasOnline && !this.#isOnline) {
        console.log('[OfflineQueue] Network lost, queuing operations...');
        this.emit('offline');
      }
    }, this.#checkIntervalMs);
  }

  /**
   * Generate unique operation ID
   * @private
   * @returns {string}
   */
  #generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if currently online
   * @returns {boolean}
   */
  get isOnline() {
    return this.#isOnline;
  }

  /**
   * Get queue length
   * @returns {number}
   */
  get length() {
    return this.#queue.filter(e => e.status === OperationStatus.PENDING).length;
  }

  /**
   * Add upload operation to queue
   * @param {string} vaultId - Vault identifier
   * @param {string} localPath - Local file path
   * @param {Object} options - Additional options
   * @returns {string} Operation ID
   */
  queueUpload(vaultId, localPath, options = {}) {
    return this.#addToQueue({
      type: OperationType.UPLOAD,
      vaultId,
      data: { localPath, ...options }
    });
  }

  /**
   * Add download operation to queue
   * @param {string} vaultId - Vault identifier
   * @param {string} localPath - Local destination path
   * @param {Object} options - Additional options
   * @returns {string} Operation ID
   */
  queueDownload(vaultId, localPath, options = {}) {
    return this.#addToQueue({
      type: OperationType.DOWNLOAD,
      vaultId,
      data: { localPath, ...options }
    });
  }

  /**
   * Add delete operation to queue
   * @param {string} vaultId - Vault identifier
   * @param {string} remoteId - Remote file ID
   * @returns {string} Operation ID
   */
  queueDelete(vaultId, remoteId) {
    return this.#addToQueue({
      type: OperationType.DELETE,
      vaultId,
      data: { remoteId }
    });
  }

  /**
   * Add operation to queue
   * @private
   * @param {Object} operation - Operation details
   * @returns {string} Operation ID
   */
  #addToQueue(operation) {
    // Check for duplicate pending operations
    const existing = this.#queue.find(
      e => e.vaultId === operation.vaultId &&
           e.type === operation.type &&
           e.status === OperationStatus.PENDING
    );

    if (existing) {
      // Update existing operation
      existing.data = operation.data;
      existing.createdAt = Date.now();
      this.#saveQueue();
      console.log(`[OfflineQueue] Updated existing ${operation.type} for ${operation.vaultId}`);
      return existing.id;
    }

    const entry = {
      id: this.#generateId(),
      type: operation.type,
      vaultId: operation.vaultId,
      status: OperationStatus.PENDING,
      createdAt: Date.now(),
      attempts: 0,
      lastAttempt: null,
      data: operation.data,
      error: null
    };

    this.#queue.push(entry);
    this.#saveQueue();

    console.log(`[OfflineQueue] Queued ${operation.type} for ${operation.vaultId}`);
    this.emit('queued', entry);

    // Try processing immediately if online
    if (this.#isOnline && !this.#isProcessing) {
      this.processQueue();
    }

    return entry.id;
  }

  /**
   * Process pending operations in queue
   * @param {Function} syncHandler - Function to execute sync operations
   */
  async processQueue(syncHandler = null) {
    if (this.#isProcessing) {
      console.log('[OfflineQueue] Already processing');
      return;
    }

    if (!this.#isOnline) {
      console.log('[OfflineQueue] Offline, skipping queue processing');
      return;
    }

    this.#isProcessing = true;
    this.emit('processing-start');

    const pendingOps = this.#queue.filter(
      e => e.status === OperationStatus.PENDING
    );

    console.log(`[OfflineQueue] Processing ${pendingOps.length} operations...`);

    for (const entry of pendingOps) {
      if (!this.#isOnline) {
        console.log('[OfflineQueue] Lost connection, pausing...');
        break;
      }

      try {
        entry.status = OperationStatus.IN_PROGRESS;
        entry.attempts++;
        entry.lastAttempt = Date.now();
        this.#saveQueue();

        this.emit('operation-start', entry);

        if (syncHandler) {
          await syncHandler(entry);
        } else {
          // Default: emit event for external handling
          await new Promise((resolve, reject) => {
            this.emit('execute', entry, resolve, reject);
          });
        }

        entry.status = OperationStatus.COMPLETED;
        entry.error = null;
        this.emit('operation-complete', entry);

      } catch (error) {
        console.error(`[OfflineQueue] Operation ${entry.id} failed:`, error);
        entry.error = error.message;

        if (entry.attempts >= this.#maxRetries) {
          entry.status = OperationStatus.FAILED;
          this.emit('operation-failed', entry);
        } else {
          // Retry later
          entry.status = OperationStatus.PENDING;
          this.emit('operation-retry', entry);
        }
      }

      this.#saveQueue();
    }

    // Clean up completed operations
    this.#cleanup();

    this.#isProcessing = false;
    this.emit('processing-complete');
  }

  /**
   * Remove completed operations
   * @private
   */
  #cleanup() {
    const before = this.#queue.length;
    this.#queue = this.#queue.filter(
      e => e.status === OperationStatus.PENDING ||
           e.status === OperationStatus.FAILED
    );

    if (this.#queue.length < before) {
      console.log(`[OfflineQueue] Cleaned up ${before - this.#queue.length} completed operations`);
      this.#saveQueue();
    }
  }

  /**
   * Cancel a pending operation
   * @param {string} operationId - Operation ID
   * @returns {boolean} True if cancelled
   */
  cancel(operationId) {
    const entry = this.#queue.find(e => e.id === operationId);
    if (entry && entry.status === OperationStatus.PENDING) {
      entry.status = OperationStatus.CANCELLED;
      this.#saveQueue();
      this.emit('operation-cancelled', entry);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending operations for a vault
   * @param {string} vaultId - Vault identifier
   * @returns {number} Number of cancelled operations
   */
  cancelByVault(vaultId) {
    let count = 0;
    for (const entry of this.#queue) {
      if (entry.vaultId === vaultId && entry.status === OperationStatus.PENDING) {
        entry.status = OperationStatus.CANCELLED;
        count++;
      }
    }
    if (count > 0) {
      this.#saveQueue();
    }
    return count;
  }

  /**
   * Get pending operations
   * @returns {QueueEntry[]}
   */
  getPending() {
    return this.#queue.filter(e => e.status === OperationStatus.PENDING);
  }

  /**
   * Get failed operations
   * @returns {QueueEntry[]}
   */
  getFailed() {
    return this.#queue.filter(e => e.status === OperationStatus.FAILED);
  }

  /**
   * Retry failed operations
   */
  retryFailed() {
    for (const entry of this.#queue) {
      if (entry.status === OperationStatus.FAILED) {
        entry.status = OperationStatus.PENDING;
        entry.attempts = 0;
        entry.error = null;
      }
    }
    this.#saveQueue();
    this.processQueue();
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.#queue.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const entry of this.#queue) {
      switch (entry.status) {
        case OperationStatus.PENDING: stats.pending++; break;
        case OperationStatus.IN_PROGRESS: stats.inProgress++; break;
        case OperationStatus.COMPLETED: stats.completed++; break;
        case OperationStatus.FAILED: stats.failed++; break;
        case OperationStatus.CANCELLED: stats.cancelled++; break;
      }
    }

    return stats;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.#queue = [];
    this.#saveQueue();
    this.emit('cleared');
  }

  /**
   * Destroy the queue manager
   */
  destroy() {
    if (this.#checkInterval) {
      clearInterval(this.#checkInterval);
      this.#checkInterval = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
let _instance = null;

/**
 * Get offline sync queue instance
 * @returns {OfflineSyncQueue}
 */
export function getOfflineSyncQueue() {
  if (!_instance) {
    _instance = new OfflineSyncQueue();
  }
  return _instance;
}

export { OperationType, OperationStatus };

export default OfflineSyncQueue;
