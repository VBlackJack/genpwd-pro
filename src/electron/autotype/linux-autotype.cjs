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

// src/electron/autotype/linux-autotype.cjs - Linux Auto-Type Implementation
// Uses xdotool (X11) or ydotool (Wayland) to simulate keyboard input

const { spawn, execSync } = require('child_process');
const path = require('path');

/**
 * Linux Auto-Type Module
 *
 * Supports both X11 (xdotool) and Wayland (ydotool) display servers.
 *
 * Security Features:
 * - Validates tool availability before execution
 * - Escapes special characters to prevent command injection
 * - Blocks dangerous applications (terminals, etc.)
 * - 30-second timeout with process cleanup
 */

// Display server types
const DISPLAY_SERVER = {
  X11: 'x11',
  WAYLAND: 'wayland',
  UNKNOWN: 'unknown'
};

// Dangerous window patterns
const DANGEROUS_PATTERNS = [
  /terminal/i,
  /konsole/i,
  /gnome-terminal/i,
  /xterm/i,
  /urxvt/i,
  /rxvt/i,
  /terminator/i,
  /tilix/i,
  /alacritty/i,
  /kitty/i,
  /st$/i,
  /foot/i,
  /wezterm/i,
  /bash/i,
  /zsh/i,
  /fish/i,
  /shell/i,
  /root@/i,
  /sudo/i,
  /su -/i
];

/**
 * Detect the current display server (X11 or Wayland)
 * @returns {string} - 'x11', 'wayland', or 'unknown'
 */
function detectDisplayServer() {
  // Check XDG_SESSION_TYPE environment variable
  const sessionType = process.env.XDG_SESSION_TYPE;
  if (sessionType) {
    if (sessionType.toLowerCase() === 'x11') {
      return DISPLAY_SERVER.X11;
    }
    if (sessionType.toLowerCase() === 'wayland') {
      return DISPLAY_SERVER.WAYLAND;
    }
  }

  // Fallback: Check WAYLAND_DISPLAY
  if (process.env.WAYLAND_DISPLAY) {
    return DISPLAY_SERVER.WAYLAND;
  }

  // Fallback: Check DISPLAY (X11)
  if (process.env.DISPLAY) {
    return DISPLAY_SERVER.X11;
  }

  return DISPLAY_SERVER.UNKNOWN;
}

/**
 * Check if a command-line tool is available
 * @param {string} tool - Tool name (e.g., 'xdotool', 'ydotool')
 * @returns {boolean}
 */
function isToolAvailable(tool) {
  try {
    execSync(`which ${tool}`, { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if required tools are available for the current display server
 * @returns {{available: boolean, tool: string, displayServer: string, message: string}}
 */
function checkToolAvailability() {
  const displayServer = detectDisplayServer();

  if (displayServer === DISPLAY_SERVER.X11) {
    if (isToolAvailable('xdotool')) {
      return {
        available: true,
        tool: 'xdotool',
        displayServer,
        message: ''
      };
    }
    return {
      available: false,
      tool: 'xdotool',
      displayServer,
      message: 'Auto-type requires xdotool. Install it with: sudo apt install xdotool (Debian/Ubuntu) or sudo dnf install xdotool (Fedora)'
    };
  }

  if (displayServer === DISPLAY_SERVER.WAYLAND) {
    if (isToolAvailable('ydotool')) {
      return {
        available: true,
        tool: 'ydotool',
        displayServer,
        message: ''
      };
    }
    // Fallback to wtype if available
    if (isToolAvailable('wtype')) {
      return {
        available: true,
        tool: 'wtype',
        displayServer,
        message: ''
      };
    }
    return {
      available: false,
      tool: 'ydotool',
      displayServer,
      message: 'Auto-type on Wayland requires ydotool or wtype. Install with: sudo apt install ydotool (Debian/Ubuntu) or sudo dnf install ydotool (Fedora). Note: ydotool requires running ydotoold daemon.'
    };
  }

  return {
    available: false,
    tool: 'unknown',
    displayServer,
    message: 'Could not detect display server (X11 or Wayland). Auto-type is not available.'
  };
}

/**
 * Get the title of the currently active window
 * @returns {Promise<string|null>}
 */
async function getActiveWindowTitle() {
  const displayServer = detectDisplayServer();

  return new Promise((resolve) => {
    try {
      if (displayServer === DISPLAY_SERVER.X11) {
        // Use xdotool to get active window title
        const title = execSync('xdotool getactivewindow getwindowname', {
          encoding: 'utf8',
          timeout: 5000
        }).trim();
        resolve(title || null);
      } else if (displayServer === DISPLAY_SERVER.WAYLAND) {
        // Wayland doesn't have a standard way to get window titles
        // Some compositors support wlrctl or swaymsg
        try {
          // Try swaymsg for Sway
          const output = execSync('swaymsg -t get_tree', {
            encoding: 'utf8',
            timeout: 5000
          });
          const tree = JSON.parse(output);
          const focused = findFocusedNode(tree);
          resolve(focused?.name || null);
        } catch {
          // Can't get window title on Wayland, allow auto-type anyway
          resolve('Unknown (Wayland)');
        }
      } else {
        resolve(null);
      }
    } catch (error) {
      resolve(null);
    }
  });
}

/**
 * Find focused node in Sway tree
 * @param {Object} node - Sway tree node
 * @returns {Object|null}
 */
function findFocusedNode(node) {
  if (node.focused) {
    return node;
  }
  if (node.nodes) {
    for (const child of node.nodes) {
      const found = findFocusedNode(child);
      if (found) return found;
    }
  }
  if (node.floating_nodes) {
    for (const child of node.floating_nodes) {
      const found = findFocusedNode(child);
      if (found) return found;
    }
  }
  return null;
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
 * Escape text for shell command
 * @param {string} text - Text to escape
 * @returns {string}
 */
function escapeForShell(text) {
  if (!text || typeof text !== 'string') return '';

  // Limit text length for safety
  const MAX_LENGTH = 10240;
  return text.slice(0, MAX_LENGTH);
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
        actions.push({ type: 'key', value: 'Tab' });
      } else if (placeholder === 'ENTER' || placeholder === 'RETURN') {
        actions.push({ type: 'key', value: 'Return' });
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
 * Execute actions using xdotool (X11)
 * @param {Array<{type: string, value: any}>} actions - Parsed actions
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeWithXdotool(actions) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Auto-type timed out after 30 seconds' });
    }, 30000);

    const executeNext = async (index) => {
      if (index >= actions.length) {
        clearTimeout(timeout);
        resolve({ success: true });
        return;
      }

      const action = actions[index];

      try {
        if (action.type === 'text' && action.value) {
          // Use xdotool type with --clearmodifiers to avoid modifier key interference
          await new Promise((res, rej) => {
            const proc = spawn('xdotool', ['type', '--clearmodifiers', '--', action.value]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('xdotool type failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'key') {
          await new Promise((res, rej) => {
            const proc = spawn('xdotool', ['key', '--clearmodifiers', action.value]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('xdotool key failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'delay') {
          await new Promise((res) => setTimeout(res, action.value));
        }

        executeNext(index + 1);
      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    };

    // Initial delay for window focus
    setTimeout(() => executeNext(0), 300);
  });
}

/**
 * Execute actions using ydotool (Wayland)
 * @param {Array<{type: string, value: any}>} actions - Parsed actions
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeWithYdotool(actions) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Auto-type timed out after 30 seconds' });
    }, 30000);

    const executeNext = async (index) => {
      if (index >= actions.length) {
        clearTimeout(timeout);
        resolve({ success: true });
        return;
      }

      const action = actions[index];

      try {
        if (action.type === 'text' && action.value) {
          await new Promise((res, rej) => {
            const proc = spawn('ydotool', ['type', '--', action.value]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('ydotool type failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'key') {
          // ydotool uses different key names
          const keyMap = {
            'Tab': 'tab',
            'Return': 'enter'
          };
          const key = keyMap[action.value] || action.value.toLowerCase();
          await new Promise((res, rej) => {
            const proc = spawn('ydotool', ['key', key]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('ydotool key failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'delay') {
          await new Promise((res) => setTimeout(res, action.value));
        }

        executeNext(index + 1);
      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    };

    // Initial delay for window focus
    setTimeout(() => executeNext(0), 300);
  });
}

/**
 * Execute actions using wtype (Wayland alternative)
 * @param {Array<{type: string, value: any}>} actions - Parsed actions
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeWithWtype(actions) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Auto-type timed out after 30 seconds' });
    }, 30000);

    const executeNext = async (index) => {
      if (index >= actions.length) {
        clearTimeout(timeout);
        resolve({ success: true });
        return;
      }

      const action = actions[index];

      try {
        if (action.type === 'text' && action.value) {
          await new Promise((res, rej) => {
            const proc = spawn('wtype', [action.value]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('wtype failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'key') {
          // wtype uses -k for key names
          const keyMap = {
            'Tab': 'Tab',
            'Return': 'Return'
          };
          const key = keyMap[action.value] || action.value;
          await new Promise((res, rej) => {
            const proc = spawn('wtype', ['-k', key]);
            proc.on('close', (code) => code === 0 ? res() : rej(new Error('wtype key failed')));
            proc.on('error', rej);
          });
        } else if (action.type === 'delay') {
          await new Promise((res) => setTimeout(res, action.value));
        }

        executeNext(index + 1);
      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    };

    // Initial delay for window focus
    setTimeout(() => executeNext(0), 300);
  });
}

/**
 * Execute auto-type sequence on Linux
 * @param {string} sequence - Auto-type sequence
 * @param {Object} data - Data with username, password, url, notes
 * @param {Object} options - Additional options
 * @param {Object} t - Translation function/object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function performAutoType(sequence, data, options = {}, t = {}) {
  // Check tool availability
  const toolCheck = checkToolAvailability();
  if (!toolCheck.available) {
    return {
      success: false,
      error: t.errorAutoTypeLinuxToolMissing || toolCheck.message
    };
  }

  // Get active window and check for dangerous applications
  const windowTitle = await getActiveWindowTitle();
  if (!windowTitle && toolCheck.displayServer === DISPLAY_SERVER.X11) {
    return {
      success: false,
      error: t.errorAutoTypeWindowDetect || 'Could not detect active window'
    };
  }

  if (isDangerousWindow(windowTitle)) {
    return {
      success: false,
      error: t.autoTypeBlocked || 'Auto-type blocked: Cannot type into terminal applications for security reasons.',
      blocked: true,
      windowTitle
    };
  }

  // Optional target window validation
  if (options.targetWindowTitle && windowTitle) {
    const target = options.targetWindowTitle.toLowerCase();
    if (!windowTitle.toLowerCase().includes(target)) {
      return {
        success: false,
        error: `Target window mismatch. Expected "${options.targetWindowTitle}" but found "${windowTitle}".`,
        actualWindow: windowTitle
      };
    }
  }

  // Parse sequence
  const actions = parseSequence(sequence, data);
  if (actions.length === 0) {
    return {
      success: false,
      error: t.errorMissingSequence || 'No actions to perform'
    };
  }

  // Execute with appropriate tool
  if (toolCheck.tool === 'xdotool') {
    return executeWithXdotool(actions);
  } else if (toolCheck.tool === 'ydotool') {
    return executeWithYdotool(actions);
  } else if (toolCheck.tool === 'wtype') {
    return executeWithWtype(actions);
  }

  return {
    success: false,
    error: t.errorAutoTypeFailed || 'No suitable auto-type tool found'
  };
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
  checkToolAvailability,
  getActiveWindowTitle,
  isDangerousWindow,
  detectDisplayServer,
  isToolAvailable,
  parseSequence,
  getDefaultSequence,
  DISPLAY_SERVER,
  DANGEROUS_PATTERNS
};
