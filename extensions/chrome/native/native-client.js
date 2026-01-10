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
 * @fileoverview Native Messaging Client for GenPwd Pro Chrome extension
 * Communicates with the native host to access the Windows app vault
 */

const NATIVE_HOST_NAME = 'com.genpwdpro.nmh';
const CONNECTION_TIMEOUT = 5000;

let port = null;
let pendingRequests = new Map();
let requestIdCounter = 0;
let connectionState = 'disconnected'; // disconnected, connecting, connected, failed
let lastError = null;

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect to the native messaging host
 * @returns {Promise<boolean>} True if connected successfully
 */
export async function connect() {
  if (connectionState === 'connected' && port) {
    return true;
  }

  if (connectionState === 'connecting') {
    // Wait for existing connection attempt
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (connectionState !== 'connecting') {
          clearInterval(checkInterval);
          resolve(connectionState === 'connected');
        }
      }, 100);
    });
  }

  connectionState = 'connecting';
  lastError = null;

  return new Promise((resolve) => {
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      const connectionTimeout = setTimeout(() => {
        if (connectionState === 'connecting') {
          connectionState = 'failed';
          lastError = 'Connection timeout';
          port?.disconnect();
          port = null;
          resolve(false);
        }
      }, CONNECTION_TIMEOUT);

      port.onMessage.addListener((message) => {
        if (connectionState === 'connecting') {
          clearTimeout(connectionTimeout);
          connectionState = 'connected';
          console.log('[NativeClient] Connected to native host');
          resolve(true);
        }
        handleMessage(message);
      });

      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message || 'Disconnected';
        console.log('[NativeClient] Disconnected:', error);

        if (connectionState === 'connecting') {
          clearTimeout(connectionTimeout);
          connectionState = 'failed';
          lastError = error;
          resolve(false);
        } else {
          connectionState = 'disconnected';
        }

        port = null;

        // Reject all pending requests
        for (const [id, { reject }] of pendingRequests) {
          reject(new Error('Connection closed'));
        }
        pendingRequests.clear();
      });

      // Send initial ping to verify connection
      port.postMessage({ type: 'PING' });

    } catch (error) {
      connectionState = 'failed';
      lastError = error.message;
      console.error('[NativeClient] Connection error:', error);
      resolve(false);
    }
  });
}

/**
 * Disconnect from the native host
 */
export function disconnect() {
  if (port) {
    port.disconnect();
    port = null;
  }
  connectionState = 'disconnected';
  pendingRequests.clear();
}

/**
 * Check if connected to the native host
 * @returns {boolean}
 */
export function isConnected() {
  return connectionState === 'connected' && port !== null;
}

/**
 * Get the current connection state
 * @returns {{ state: string, error: string|null }}
 */
export function getConnectionState() {
  return { state: connectionState, error: lastError };
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle incoming messages from native host
 */
function handleMessage(message) {
  const { requestId, ...data } = message;

  if (requestId !== undefined && pendingRequests.has(requestId)) {
    const { resolve, reject, timeout } = pendingRequests.get(requestId);
    clearTimeout(timeout);
    pendingRequests.delete(requestId);

    if (data.success === false) {
      reject(new Error(data.error || 'Request failed'));
    } else {
      resolve(data);
    }
  }
}

/**
 * Send a request to the native host
 * @param {string} type Message type
 * @param {object} data Additional data
 * @returns {Promise<object>} Response from native host
 */
async function sendRequest(type, data = {}) {
  if (!isConnected()) {
    const connected = await connect();
    if (!connected) {
      throw new Error(lastError || 'Not connected to GenPwd Pro app');
    }
  }

  return new Promise((resolve, reject) => {
    const requestId = ++requestIdCounter;
    const message = { type, ...data };

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, 10000);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    try {
      port.postMessage(message);
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Check if the GenPwd Pro app is running and vault status
 * @returns {Promise<{success: boolean, status: string, vaultName?: string}>}
 */
export async function getStatus() {
  try {
    return await sendRequest('GET_STATUS');
  } catch (error) {
    return { success: false, status: 'disconnected', error: error.message };
  }
}

/**
 * Check if the vault is unlocked
 * @returns {Promise<{success: boolean, unlocked: boolean}>}
 */
export async function isUnlocked() {
  try {
    return await sendRequest('IS_UNLOCKED');
  } catch (error) {
    return { success: false, unlocked: false, error: error.message };
  }
}

/**
 * Get all entries (without passwords)
 * @returns {Promise<{success: boolean, entries: Array}>}
 */
export async function getEntries() {
  return await sendRequest('GET_ENTRIES');
}

/**
 * Get entries matching a domain
 * @param {string} domain The domain to match
 * @returns {Promise<{success: boolean, entries: Array}>}
 */
export async function getEntriesForDomain(domain) {
  return await sendRequest('GET_ENTRIES_FOR_DOMAIN', { domain });
}

/**
 * Search entries by query
 * @param {string} query Search query
 * @returns {Promise<{success: boolean, entries: Array}>}
 */
export async function searchEntries(query) {
  return await sendRequest('SEARCH_ENTRIES', { query });
}

/**
 * Get a single entry with full details (including password)
 * @param {string} id Entry ID
 * @returns {Promise<{success: boolean, entry: object}>}
 */
export async function getEntry(id) {
  return await sendRequest('GET_ENTRY', { id });
}

/**
 * Get TOTP code for an entry
 * @param {string} id Entry ID
 * @returns {Promise<{success: boolean, code: string, remaining: number}>}
 */
export async function getTOTP(id) {
  return await sendRequest('GET_TOTP', { id });
}

/**
 * Notify the app that an entry was filled (for audit)
 * @param {string} id Entry ID
 * @returns {Promise<{success: boolean}>}
 */
export async function notifyFill(id) {
  return await sendRequest('FILL_ENTRY', { id });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  connect,
  disconnect,
  isConnected,
  getConnectionState,
  getStatus,
  isUnlocked,
  getEntries,
  getEntriesForDomain,
  searchEntries,
  getEntry,
  getTOTP,
  notifyFill
};
