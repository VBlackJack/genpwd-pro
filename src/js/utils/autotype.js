/**
 * @fileoverview Auto-type Simulation
 * Keyboard simulation for automatic form filling
 *
 * @version 2.6.8
 */

import { safeLog } from './logger.js';

/**
 * Default auto-type sequence
 * {USERNAME} - Insert username
 * {PASSWORD} - Insert password
 * {TAB} - Tab key
 * {ENTER} - Enter key
 * {DELAY:ms} - Wait for ms milliseconds
 */
const DEFAULT_SEQUENCE = '{USERNAME}{TAB}{PASSWORD}{ENTER}';

/**
 * Parse auto-type sequence into steps
 * @param {string} sequence
 * @returns {Array<{type: string, value?: string}>}
 */
export function parseSequence(sequence) {
  const steps = [];
  const regex = /\{([^}]+)\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(sequence)) !== null) {
    // Add literal text before this placeholder
    if (match.index > lastIndex) {
      steps.push({ type: 'text', value: sequence.slice(lastIndex, match.index) });
    }

    const placeholder = match[1];

    if (placeholder === 'USERNAME') {
      steps.push({ type: 'username' });
    } else if (placeholder === 'PASSWORD') {
      steps.push({ type: 'password' });
    } else if (placeholder === 'TOTP') {
      steps.push({ type: 'totp' });
    } else if (placeholder === 'TAB') {
      steps.push({ type: 'key', value: 'Tab' });
    } else if (placeholder === 'ENTER') {
      steps.push({ type: 'key', value: 'Enter' });
    } else if (placeholder.startsWith('DELAY:')) {
      const ms = parseInt(placeholder.slice(6)) || 100;
      steps.push({ type: 'delay', value: ms });
    } else {
      // Unknown placeholder, treat as literal
      steps.push({ type: 'text', value: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < sequence.length) {
    steps.push({ type: 'text', value: sequence.slice(lastIndex) });
  }

  return steps;
}

/**
 * Execute auto-type sequence
 * @param {Object} entry - Vault entry
 * @param {Object} [options]
 * @param {string} [options.sequence] - Custom sequence
 * @param {number} [options.typeDelay=50] - Delay between keystrokes (ms)
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<boolean>}
 */
export async function executeAutotype(entry, options = {}) {
  const {
    sequence = DEFAULT_SEQUENCE,
    typeDelay = 50,
    onProgress
  } = options;

  const steps = parseSequence(sequence);
  safeLog(`[Autotype] Executing ${steps.length} steps`);

  // Check if running in Electron with autotype support
  if (window.electronAPI?.performAutoType) {
    return executeElectronAutotype(entry, steps, { typeDelay, onProgress });
  }

  // Fallback: Browser-based simulation (limited)
  return executeBrowserAutotype(entry, steps, { typeDelay, onProgress });
}

/**
 * Execute auto-type using Electron IPC
 * Uses the unified performAutoType API which handles minimize, typing, and keys
 */
async function executeElectronAutotype(entry, steps, options) {
  const { onProgress } = options;

  try {
    // Build sequence string from steps
    const sequenceParts = steps.map(step => {
      switch (step.type) {
        case 'username': return '{USERNAME}';
        case 'password': return '{PASSWORD}';
        case 'totp': return '{TOTP}';
        case 'key':
          if (step.value === 'Tab') return '{TAB}';
          if (step.value === 'Enter') return '{ENTER}';
          return '';
        case 'delay': return `{DELAY ${step.value}}`;
        case 'text': return step.value;
        default: return '';
      }
    });

    const sequence = sequenceParts.join('');
    onProgress?.(1, 2, 'executing');

    // Use the unified performAutoType API
    const result = await window.electronAPI.performAutoType(sequence, {
      username: entry.data?.username || '',
      password: entry.data?.password || ''
    });

    onProgress?.(2, 2, 'done');

    if (result.success) {
      safeLog('[Autotype] Sequence completed');
      return true;
    } else {
      safeLog(`[Autotype] Failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    safeLog(`[Autotype] Error: ${error.message}`);
    return false;
  }
}

/**
 * Execute auto-type using browser APIs (clipboard-based)
 * Limited: can only copy to clipboard
 */
async function executeBrowserAutotype(entry, steps, options) {
  const { onProgress } = options;

  // Browser mode: Just prepare the data and show instructions
  const username = entry.data?.username || '';
  // Password not needed for simple clipboard instructions
  // const password = entry.data?.password || '';

  onProgress?.(1, 2, 'preparing');

  // Build the sequence description
  const sequenceDescription = steps.map(step => {
    switch (step.type) {
      case 'username': return `Coller: ${username.substring(0, 3)}***`;
      case 'password': return 'Coller: ********';
      case 'key': return `Touche: ${step.value}`;
      case 'delay': return `Attendre: ${step.value}ms`;
      default: return step.type;
    }
  }).join(' → ');

  safeLog(`[Autotype] Browser mode - sequence: ${sequenceDescription}`);

  // Copy username to clipboard first
  try {
    await navigator.clipboard.writeText(username);
    onProgress?.(2, 2, 'clipboard');
    return true;
  } catch (error) {
    safeLog(`[Autotype] Clipboard error: ${error.message}`);
    return false;
  }
}

/**
 * Check if auto-type is available
 * @returns {Object} Availability info
 */
export function getAutotypeCapabilities() {
  const hasElectron = !!window.electronAPI?.performAutoType;
  const hasClipboard = !!navigator.clipboard;

  return {
    available: hasElectron || hasClipboard,
    mode: hasElectron ? 'electron' : (hasClipboard ? 'clipboard' : 'none'),
    features: {
      keySimulation: hasElectron,
      minimize: hasElectron,
      clipboard: hasClipboard
    }
  };
}

/**
 * Create quick auto-type (username + tab + password + enter)
 * @param {Object} entry
 * @returns {Promise<boolean>}
 */
export async function quickAutotype(entry) {
  return executeAutotype(entry, {
    sequence: '{USERNAME}{TAB}{PASSWORD}{ENTER}'
  });
}

/**
 * Create custom auto-type sequence builder
 */
export class AutotypeSequenceBuilder {
  #steps = [];

  username() {
    this.#steps.push('{USERNAME}');
    return this;
  }

  password() {
    this.#steps.push('{PASSWORD}');
    return this;
  }

  totp() {
    this.#steps.push('{TOTP}');
    return this;
  }

  tab() {
    this.#steps.push('{TAB}');
    return this;
  }

  enter() {
    this.#steps.push('{ENTER}');
    return this;
  }

  delay(ms) {
    this.#steps.push(`{DELAY:${ms}}`);
    return this;
  }

  text(value) {
    this.#steps.push(value);
    return this;
  }

  build() {
    return this.#steps.join('');
  }
}

// Helper for future browser-based autotype with delays
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  parseSequence,
  executeAutotype,
  getAutotypeCapabilities,
  quickAutotype,
  AutotypeSequenceBuilder,
  DEFAULT_SEQUENCE
};
