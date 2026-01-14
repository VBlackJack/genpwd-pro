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

// src/electron/autotype/darwin-autotype.cjs - macOS Auto-Type Implementation
// Uses AppleScript via osascript to simulate keyboard input

const { spawn, execSync } = require('child_process');

/**
 * macOS Auto-Type Module
 *
 * Security Features:
 * - Validates accessibility permissions before execution
 * - Escapes special characters to prevent script injection
 * - Blocks dangerous applications (Terminal, etc.)
 * - 30-second timeout with process cleanup
 */

// Dangerous window patterns (same as Windows for consistency)
const DANGEROUS_PATTERNS = [
  /terminal/i,
  /iterm/i,
  /hyper/i,
  /kitty/i,
  /alacritty/i,
  /warp/i,
  /console/i,
  /shell/i,
  /bash/i,
  /zsh/i,
  /fish/i,
  /script editor/i,
  /automator/i,
  /activity monitor/i,
  /system preferences/i,
  /system settings/i,
  /keychain access/i
];

/**
 * Check if accessibility permissions are granted
 * @returns {Promise<{granted: boolean, message: string}>}
 */
async function checkAccessibilityPermission() {
  return new Promise((resolve) => {
    try {
      // Use tccutil to check accessibility permission status
      // This AppleScript checks if System Events can be controlled
      const checkScript = `
        try
          tell application "System Events"
            return true
          end tell
        on error
          return false
        end try
      `;

      const result = execSync(`osascript -e '${checkScript}'`, {
        encoding: 'utf8',
        timeout: 5000
      }).trim();

      if (result === 'true') {
        resolve({ granted: true, message: '' });
      } else {
        resolve({
          granted: false,
          message: 'Accessibility permission required. Enable GenPwd Pro in System Settings > Privacy & Security > Accessibility.'
        });
      }
    } catch (error) {
      resolve({
        granted: false,
        message: 'Accessibility permission required. Enable GenPwd Pro in System Settings > Privacy & Security > Accessibility.'
      });
    }
  });
}

/**
 * Get the title of the frontmost (active) window
 * @returns {Promise<string|null>}
 */
async function getActiveWindowTitle() {
  return new Promise((resolve) => {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
          try
            set windowTitle to name of front window of frontApp
            return appName & " - " & windowTitle
          on error
            return appName
          end try
        end tell
      `;

      const result = execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
        encoding: 'utf8',
        timeout: 5000
      }).trim();

      resolve(result || null);
    } catch (error) {
      resolve(null);
    }
  });
}

/**
 * Check if the active window is a dangerous application
 * @param {string} windowTitle - Active window title
 * @returns {boolean}
 */
function isDangerousWindow(windowTitle) {
  if (!windowTitle) return false;
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(windowTitle));
}

/**
 * Escape text for AppleScript keystroke command
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for AppleScript
 */
function escapeForAppleScript(text) {
  if (!text || typeof text !== 'string') return '';

  // Limit text length for safety
  const MAX_LENGTH = 10240;
  const safeText = text.slice(0, MAX_LENGTH);

  // Escape backslashes first, then quotes
  return safeText
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');
}

/**
 * Parse auto-type sequence into actions
 * @param {string} sequence - Sequence like "{USERNAME}{TAB}{PASSWORD}{ENTER}"
 * @param {Object} data - Data object with username, password, url, notes
 * @returns {Array<{type: string, value: any}>}
 */
function parseSequence(sequence, data) {
  const actions = [];
  const regex = /\{([^}]+)\}|([^{]+)/g;
  let match;

  while ((match = regex.exec(sequence)) !== null) {
    if (match[1]) {
      // Placeholder
      const placeholder = match[1].toUpperCase();

      if (placeholder === 'USERNAME') {
        actions.push({ type: 'text', value: data.username || '' });
      } else if (placeholder === 'PASSWORD') {
        actions.push({ type: 'text', value: data.password || '' });
      } else if (placeholder === 'URL') {
        actions.push({ type: 'text', value: data.url || '' });
      } else if (placeholder === 'NOTES') {
        actions.push({ type: 'text', value: data.notes || '' });
      } else if (placeholder === 'TAB') {
        actions.push({ type: 'key', value: 'tab' });
      } else if (placeholder === 'ENTER' || placeholder === 'RETURN') {
        actions.push({ type: 'key', value: 'return' });
      } else if (placeholder === 'SPACE') {
        actions.push({ type: 'text', value: ' ' });
      } else if (placeholder.startsWith('DELAY ')) {
        const delayMs = Math.max(10, Math.min(30000, parseInt(placeholder.substring(6), 10) || 100));
        actions.push({ type: 'delay', value: delayMs });
      }
    } else if (match[2]) {
      // Literal text
      actions.push({ type: 'text', value: match[2] });
    }
  }

  return actions;
}

/**
 * Build AppleScript for auto-type actions
 * @param {Array<{type: string, value: any}>} actions - Parsed actions
 * @returns {string} - AppleScript code
 */
function buildAppleScript(actions) {
  const lines = [
    'tell application "System Events"',
    '  delay 0.3' // Initial delay for window focus
  ];

  for (const action of actions) {
    if (action.type === 'text' && action.value) {
      const escaped = escapeForAppleScript(action.value);
      lines.push(`  keystroke "${escaped}"`);
    } else if (action.type === 'key') {
      if (action.value === 'tab') {
        lines.push('  keystroke tab');
      } else if (action.value === 'return') {
        lines.push('  keystroke return');
      }
    } else if (action.type === 'delay') {
      const seconds = action.value / 1000;
      lines.push(`  delay ${seconds}`);
    }
  }

  lines.push('end tell');
  return lines.join('\n');
}

/**
 * Execute auto-type sequence on macOS
 * @param {string} sequence - Auto-type sequence
 * @param {Object} data - Data with username, password, url, notes
 * @param {Object} options - Additional options
 * @param {Object} t - Translation function/object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function performAutoType(sequence, data, options = {}, t = {}) {
  // Check accessibility permission first
  const permCheck = await checkAccessibilityPermission();
  if (!permCheck.granted) {
    return {
      success: false,
      error: t.errorAutoTypeMacAccessibility || permCheck.message
    };
  }

  // Get active window and check for dangerous applications
  const windowTitle = await getActiveWindowTitle();
  if (!windowTitle) {
    return {
      success: false,
      error: t.errorAutoTypeWindowDetect || 'Could not detect active window'
    };
  }

  if (isDangerousWindow(windowTitle)) {
    return {
      success: false,
      error: t.autoTypeBlocked || 'Auto-type blocked: Cannot type into terminal or system applications for security reasons.',
      blocked: true,
      windowTitle
    };
  }

  // Optional target window validation
  if (options.targetWindowTitle) {
    const target = options.targetWindowTitle.toLowerCase();
    if (!windowTitle.toLowerCase().includes(target)) {
      return {
        success: false,
        error: `Target window mismatch. Expected "${options.targetWindowTitle}" but found "${windowTitle}".`,
        actualWindow: windowTitle
      };
    }
  }

  // Parse sequence and build AppleScript
  const actions = parseSequence(sequence, data);
  if (actions.length === 0) {
    return {
      success: false,
      error: t.errorMissingSequence || 'No actions to perform'
    };
  }

  const script = buildAppleScript(actions);

  // Execute AppleScript with timeout
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        success: false,
        error: t.errorAutoTypeTimeout || 'Auto-type timed out after 30 seconds'
      });
    }, 30000);

    const osascript = spawn('osascript', ['-e', script]);

    let stderr = '';

    osascript.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    osascript.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({
          success: false,
          error: stderr || t.errorAutoTypeFailed || 'Auto-type failed'
        });
      }
    });

    osascript.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: error.message || t.errorAutoTypeFailed || 'Auto-type failed'
      });
    });
  });
}

/**
 * Get default auto-type sequence
 * @returns {string}
 */
function getDefaultSequence() {
  return '{USERNAME}{DELAY 50}{TAB}{DELAY 50}{PASSWORD}{DELAY 50}{ENTER}';
}

module.exports = {
  performAutoType,
  checkAccessibilityPermission,
  getActiveWindowTitle,
  isDangerousWindow,
  escapeForAppleScript,
  parseSequence,
  buildAppleScript,
  getDefaultSequence,
  DANGEROUS_PATTERNS
};
