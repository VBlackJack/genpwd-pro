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
 * @fileoverview Native Messaging Host for GenPwd Pro Chrome Extension
 * Bridges communication between Chrome extension and the Electron app
 * via Windows named pipe.
 */

const net = require('net');
const path = require('path');

// ============================================================================
// CONSTANTS
// ============================================================================

const PIPE_NAME = '\\\\.\\pipe\\genpwd-pro';
const PIPE_RETRY_INTERVAL = 1000;
const PIPE_MAX_RETRIES = 5;
const MESSAGE_TIMEOUT = 10000;

// ============================================================================
// LOGGING (to stderr, not stdout - stdout is for Chrome messages)
// ============================================================================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };
  process.stderr.write(JSON.stringify(logEntry) + '\n');
}

// ============================================================================
// NATIVE MESSAGING PROTOCOL
// ============================================================================

/**
 * Read a message from stdin (Chrome Native Messaging protocol)
 * Messages are prefixed with 4-byte little-endian length
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    // Read 4-byte length prefix
    const lengthBuffer = Buffer.alloc(4);
    let bytesRead = 0;

    const readLength = () => {
      const chunk = process.stdin.read(4 - bytesRead);
      if (chunk === null) {
        process.stdin.once('readable', readLength);
        return;
      }

      chunk.copy(lengthBuffer, bytesRead);
      bytesRead += chunk.length;

      if (bytesRead < 4) {
        process.stdin.once('readable', readLength);
        return;
      }

      const messageLength = lengthBuffer.readUInt32LE(0);

      if (messageLength === 0) {
        resolve(null);
        return;
      }

      if (messageLength > 1024 * 1024) {
        reject(new Error('Message too large'));
        return;
      }

      // Read message content
      const messageBuffer = Buffer.alloc(messageLength);
      let messageBytesRead = 0;

      const readContent = () => {
        const contentChunk = process.stdin.read(messageLength - messageBytesRead);
        if (contentChunk === null) {
          process.stdin.once('readable', readContent);
          return;
        }

        contentChunk.copy(messageBuffer, messageBytesRead);
        messageBytesRead += contentChunk.length;

        if (messageBytesRead < messageLength) {
          process.stdin.once('readable', readContent);
          return;
        }

        try {
          const message = JSON.parse(messageBuffer.toString('utf8'));
          resolve(message);
        } catch (e) {
          reject(new Error('Invalid JSON message'));
        }
      };

      readContent();
    };

    readLength();
  });
}

/**
 * Write a message to stdout (Chrome Native Messaging protocol)
 * Messages are prefixed with 4-byte little-endian length
 */
function writeMessage(message) {
  const messageString = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageString, 'utf8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);
}

// ============================================================================
// NAMED PIPE CLIENT
// ============================================================================

let pipeClient = null;
let pendingRequests = new Map();
let requestIdCounter = 0;

/**
 * Connect to the GenPwd Pro Electron app via named pipe
 */
function connectToPipe(retries = 0) {
  return new Promise((resolve, reject) => {
    pipeClient = net.createConnection(PIPE_NAME, () => {
      log('info', 'Connected to GenPwd Pro app');
      resolve(true);
    });

    pipeClient.on('error', (err) => {
      log('error', 'Pipe connection error', { error: err.message });

      if (retries < PIPE_MAX_RETRIES) {
        setTimeout(() => {
          connectToPipe(retries + 1).then(resolve).catch(reject);
        }, PIPE_RETRY_INTERVAL);
      } else {
        reject(new Error('Could not connect to GenPwd Pro app. Is it running?'));
      }
    });

    pipeClient.on('close', () => {
      log('info', 'Pipe connection closed');
      pipeClient = null;

      // Reject all pending requests
      for (const [id, { reject }] of pendingRequests) {
        reject(new Error('Connection closed'));
      }
      pendingRequests.clear();
    });

    // Handle incoming data from pipe
    let dataBuffer = '';
    pipeClient.on('data', (data) => {
      dataBuffer += data.toString('utf8');

      // Messages are newline-delimited JSON
      const lines = dataBuffer.split('\n');
      dataBuffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            handlePipeResponse(response);
          } catch (e) {
            log('error', 'Invalid JSON from pipe', { data: line });
          }
        }
      }
    });
  });
}

/**
 * Handle response from the Electron app
 */
function handlePipeResponse(response) {
  const { requestId, ...data } = response;

  if (requestId && pendingRequests.has(requestId)) {
    const { resolve, timeout } = pendingRequests.get(requestId);
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    resolve(data);
  } else {
    log('warn', 'Received response for unknown request', { requestId });
  }
}

/**
 * Send a request to the Electron app and wait for response
 */
function sendToPipe(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!pipeClient || pipeClient.destroyed) {
      reject(new Error('Not connected to GenPwd Pro app'));
      return;
    }

    const requestId = ++requestIdCounter;
    const request = { requestId, action, ...data };

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }, MESSAGE_TIMEOUT);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    pipeClient.write(JSON.stringify(request) + '\n');
  });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle messages from Chrome extension
 */
async function handleExtensionMessage(message) {
  const { type, ...data } = message;

  try {
    switch (type) {
      case 'PING':
        return { success: true, pong: true };

      case 'GET_STATUS':
        return await sendToPipe('getStatus');

      case 'IS_UNLOCKED':
        return await sendToPipe('isUnlocked');

      case 'GET_ENTRIES':
        return await sendToPipe('getEntries', data);

      case 'GET_ENTRIES_FOR_DOMAIN':
        return await sendToPipe('getEntriesForDomain', { domain: data.domain });

      case 'SEARCH_ENTRIES':
        return await sendToPipe('searchEntries', { query: data.query });

      case 'GET_ENTRY':
        return await sendToPipe('getEntry', { id: data.id });

      case 'GET_TOTP':
        return await sendToPipe('getTOTP', { id: data.id });

      case 'FILL_ENTRY':
        return await sendToPipe('fillEntry', { id: data.id });

      default:
        return { success: false, error: `Unknown message type: ${type}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log('info', 'GenPwd Pro Native Host starting');

  // Set stdin to raw mode for binary reading
  process.stdin.setEncoding(null);

  // Try to connect to the Electron app
  try {
    await connectToPipe();
  } catch (error) {
    log('error', 'Failed to connect to GenPwd Pro app', { error: error.message });
    writeMessage({ success: false, error: 'GenPwd Pro app is not running' });
    process.exit(1);
  }

  // Main message loop
  while (true) {
    try {
      const message = await readMessage();

      if (message === null) {
        log('info', 'Received empty message, exiting');
        break;
      }

      log('debug', 'Received message from extension', { type: message.type });

      const response = await handleExtensionMessage(message);
      writeMessage(response);

    } catch (error) {
      log('error', 'Error processing message', { error: error.message });
      writeMessage({ success: false, error: error.message });
    }
  }

  // Cleanup
  if (pipeClient) {
    pipeClient.end();
  }

  log('info', 'GenPwd Pro Native Host exiting');
  process.exit(0);
}

// Handle process signals
process.on('SIGINT', () => {
  log('info', 'Received SIGINT');
  if (pipeClient) pipeClient.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM');
  if (pipeClient) pipeClient.end();
  process.exit(0);
});

// Start
main().catch((error) => {
  log('error', 'Fatal error', { error: error.message });
  process.exit(1);
});
