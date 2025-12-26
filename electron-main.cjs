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

// electron-main.js - Point d'entrée principal Electron pour GenPwd Pro
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  shell,
  ipcMain,
  dialog,
  clipboard,
  safeStorage,
  Notification,
  nativeImage,
  globalShortcut,
  powerMonitor,
  crashReporter,
  nativeTheme
} = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { version: APP_VERSION } = require('./package.json');

// ==================== MAIN PROCESS TRANSLATIONS ====================
// Simple i18n for tray menu and notifications (main process only)
const translations = {
  en: {
    trayTooltip: 'GenPwd Pro - Password Generator',
    showApp: 'Show GenPwd Pro',
    generatePassword: 'Generate password',
    lockVault: 'Lock vault',
    quit: 'Quit',
    passwordGenerated: 'Password generated',
    copiedToClipboard: 'Copied to clipboard (30s)',
    development: 'Development',
    // Context menu
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    undo: 'Undo',
    redo: 'Redo',
    // Close dialog
    minimizeToTray: 'Minimize to Tray',
    quitApp: 'Quit Application',
    closePromptTitle: 'Close GenPwd Pro?',
    closePromptDetail: 'GenPwd Pro can run in the background to keep your vault accessible. Choose "Quit" to completely close the application.'
  },
  fr: {
    trayTooltip: 'GenPwd Pro - Générateur de mots de passe',
    showApp: 'Afficher GenPwd Pro',
    generatePassword: 'Générer un mot de passe',
    lockVault: 'Verrouiller le coffre',
    quit: 'Quitter',
    passwordGenerated: 'Mot de passe généré',
    copiedToClipboard: 'Copié dans le presse-papier (30s)',
    development: 'Développement',
    // Context menu
    cut: 'Couper',
    copy: 'Copier',
    paste: 'Coller',
    selectAll: 'Tout sélectionner',
    undo: 'Annuler',
    redo: 'Rétablir',
    // Close dialog
    minimizeToTray: 'Réduire dans la barre',
    quitApp: 'Quitter l\'application',
    closePromptTitle: 'Fermer GenPwd Pro ?',
    closePromptDetail: 'GenPwd Pro peut continuer en arrière-plan pour garder votre coffre accessible. Choisissez "Quitter" pour fermer complètement.'
  },
  es: {
    trayTooltip: 'GenPwd Pro - Generador de contraseñas',
    showApp: 'Mostrar GenPwd Pro',
    generatePassword: 'Generar contraseña',
    lockVault: 'Bloquear bóveda',
    quit: 'Salir',
    passwordGenerated: 'Contraseña generada',
    copiedToClipboard: 'Copiado al portapapeles (30s)',
    development: 'Desarrollo',
    // Context menu
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    selectAll: 'Seleccionar todo',
    undo: 'Deshacer',
    redo: 'Rehacer',
    // Close dialog
    minimizeToTray: 'Minimizar a bandeja',
    quitApp: 'Cerrar aplicación',
    closePromptTitle: '¿Cerrar GenPwd Pro?',
    closePromptDetail: 'GenPwd Pro puede ejecutarse en segundo plano para mantener su bóveda accesible. Elija "Cerrar" para salir completamente.'
  }
};

function getMainTranslations() {
  const locale = app.getLocale().split('-')[0]; // Get language code (e.g., 'fr' from 'fr-FR')
  return translations[locale] || translations.en;
}

// ==================== WINDOWS SYSTEM INTEGRATION ====================

/**
 * Get Windows accent color from registry
 * @returns {Promise<{accent: string, accentLight: string, accentDark: string} | null>}
 */
async function getWindowsAccentColor() {
  if (process.platform !== 'win32') return null;

  return new Promise((resolve) => {
    try {
      // Read AccentColor from Windows registry (DWORD in ABGR format)
      const script = `
        try {
          $key = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\DWM'
          $accent = Get-ItemPropertyValue -Path $key -Name AccentColor -ErrorAction Stop
          # Convert DWORD (ABGR) to hex RGB
          $b = ($accent -band 0xFF)
          $g = (($accent -shr 8) -band 0xFF)
          $r = (($accent -shr 16) -band 0xFF)
          "#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b
        } catch {
          ""
        }
      `;

      const ps = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
      ], { windowsHide: true });

      let stdout = '';
      ps.stdout.on('data', d => stdout += d.toString());
      ps.on('close', () => {
        const color = stdout.trim();
        if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
          // Generate light and dark variants
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);

          // Light variant: increase brightness by 15%
          const lighten = (c) => Math.min(255, Math.round(c + (255 - c) * 0.15));
          const accentLight = `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`;

          // Dark variant: decrease brightness by 15%
          const darken = (c) => Math.max(0, Math.round(c * 0.85));
          const accentDark = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;

          resolve({ accent: color, accentLight, accentDark });
        } else {
          resolve(null);
        }
      });
      ps.on('error', () => resolve(null));
      setTimeout(() => {
        try { ps.kill(); } catch { }
        resolve(null);
      }, 3000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Check if running with elevated (admin) privileges
 * @returns {boolean}
 */
function isRunningAsAdmin() {
  if (process.platform !== 'win32') return false;

  try {
    // Try to access a protected registry key that requires admin
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize crash reporter for debugging
 */
function initCrashReporter() {
  try {
    crashReporter.start({
      productName: 'GenPwd Pro',
      companyName: 'Julien Bombled',
      submitURL: '', // Local crash dumps only (no remote submission)
      uploadToServer: false,
      ignoreSystemCrashHandler: false
    });
    console.log('[GenPwd Pro] Crash reporter initialized');
    console.log('[GenPwd Pro] Crash dumps location:', app.getPath('crashDumps'));
  } catch (error) {
    console.error('[GenPwd Pro] Failed to initialize crash reporter:', error.message);
  }
}

// ==================== AUTO-START MANAGEMENT ====================
/**
 * Get current auto-start status
 * @returns {boolean} Whether auto-start is enabled
 */
function getAutoStartEnabled() {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (error) {
    console.error('[GenPwd Pro] Failed to get auto-start settings:', error);
    return false;
  }
}

/**
 * Enable or disable auto-start on Windows login
 * @param {boolean} enable - Whether to enable auto-start
 * @returns {{success: boolean, verified: boolean, error?: string}} Result with verification
 */
function setAutoStartEnabled(enable) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true, // Start minimized to tray
      path: process.execPath,
      args: ['--hidden'] // Flag to start hidden
    });

    // Verify the setting was applied correctly
    const settings = app.getLoginItemSettings();
    const verified = settings.openAtLogin === enable;

    if (!verified) {
      console.warn(`[GenPwd Pro] Auto-start verification failed: expected ${enable}, got ${settings.openAtLogin}`);
      return { success: false, verified: false, error: 'Setting was not applied. Check permissions or antivirus.' };
    }

    console.log(`[GenPwd Pro] Auto-start ${enable ? 'enabled' : 'disabled'} (verified)`);
    return { success: true, verified: true };
  } catch (error) {
    console.error('[GenPwd Pro] Failed to set auto-start:', error);
    return { success: false, verified: false, error: error.message };
  }
}

// ==================== WINDOW STATE PERSISTENCE ====================
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const data = fs.readFileSync(WINDOW_STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.log('[GenPwd Pro] Could not load window state:', err.message);
  }
  return null;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;

  try {
    const bounds = win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized()
    };
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.log('[GenPwd Pro] Could not save window state:', err.message);
  }
}

// ==================== SINGLE INSTANCE LOCK ====================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[GenPwd Pro] Another instance is running. Exiting.');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();

      // Check for deep link in command line (Windows)
      const deepLink = commandLine.find(arg => arg.startsWith('genpwd://'));
      if (deepLink) {
        handleDeepLink(deepLink);
      }

      // Check for .gpdb vault file in command line (file association)
      const vaultFile = commandLine.find(arg => arg.endsWith('.gpdb'));
      if (vaultFile && fs.existsSync(vaultFile)) {
        console.log('[GenPwd Pro] Opening vault from file association:', vaultFile);
        mainWindow.webContents.send('vault:open-file', vaultFile);
      }
    }
  });
}

// ==================== DEEP LINKING PROTOCOL ====================
// Register as default handler for genpwd:// URLs
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('genpwd', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('genpwd');
}

// Handle deep link URLs
function handleDeepLink(url) {
  console.log('[GenPwd Pro] Deep link received:', url);

  // Validate deep link URL
  if (!url || typeof url !== 'string') {
    console.warn('[GenPwd Pro] Invalid deep link: not a string');
    return;
  }

  // Must start with our protocol
  if (!url.startsWith('genpwd://')) {
    console.warn('[GenPwd Pro] Invalid deep link: wrong protocol');
    return;
  }

  // Parse and validate the URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    console.warn('[GenPwd Pro] Invalid deep link: malformed URL');
    return;
  }

  // Allowed actions (whitelist)
  const allowedHosts = ['unlock', 'open', 'generate', 'settings'];
  if (!allowedHosts.includes(parsedUrl.host)) {
    console.warn(`[GenPwd Pro] Invalid deep link: unknown action '${parsedUrl.host}'`);
    return;
  }

  // Sanitize: only allow alphanumeric, dash, underscore in path segments
  const safePathRegex = /^[a-zA-Z0-9\-_\/]*$/;
  if (!safePathRegex.test(parsedUrl.pathname)) {
    console.warn('[GenPwd Pro] Invalid deep link: unsafe characters in path');
    return;
  }

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deep-link', url);
  }
}

// macOS: Handle open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Vault module (loaded dynamically as ESM)
let vaultModule = null;

// System tray
let tray = null;
let isQuitting = false;

// Compact mode state
let isCompactMode = false;
let normalBounds = null; // Store normal window bounds before compact mode

// Global hotkey configuration (Boss Key)
const GLOBAL_HOTKEY = 'CommandOrControl+Shift+P';

// Clipboard auto-clear timers
const clipboardTimers = new Map();

// ==================== QUICK PASSWORD GENERATOR ====================
// Simple password generator for tray menu (no UI needed)
function generateQuickPassword(length = 20) {
  const crypto = require('crypto');
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}
// Helper to get active window title
function getActiveWindowTitle() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve('');
      return;
    }

    // Robust PowerShell script with full type definition and error handling
    const script = `
try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FGWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  public static string GetTitle() {
    IntPtr h = GetForegroundWindow();
    StringBuilder sb = new StringBuilder(256);
    GetWindowText(h, sb, 256);
    return sb.ToString();
  }
}
"@
  [FGWindow]::GetTitle()
} catch {
  ""
}
`;

    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
    ], { windowsHide: true });

    let stdout = '';
    ps.stdout.on('data', d => stdout += d.toString());
    ps.on('close', () => resolve(stdout.trim()));
    ps.on('error', () => resolve(''));
    // Timeout - 10s for PowerShell + C# JIT compilation
    setTimeout(() => {
      try { ps.kill(); } catch { }
      resolve('');
    }, 10000);
  });
}

// ==================== IPC SECURITY ====================
/**
 * IPC Channel Naming Convention:
 * - namespace:action or namespace:resource:action
 * - Single-word actions are lowercase: vault:lock, vault:list
 * - Multi-word actions use kebab-case or camelCase per namespace:
 *   - Low-level APIs (auth, clipboard, window, fs): kebab-case (e.g., is-available, copy-secure)
 *   - High-level APIs (vault, vaultIO): camelCase (e.g., getState, selectFile)
 */

/**
 * Rate limiter for sensitive IPC operations
 * Prevents brute force attacks on auth handlers
 */
const rateLimiter = {
  /** @type {Map<string, { attempts: number, lockedUntil: number }>} */
  attempts: new Map(),
  MAX_ATTEMPTS: 10,
  LOCKOUT_MS: 60 * 1000, // 1 minute lockout

  /**
   * Check if operation is allowed
   * @param {string} key - Operation identifier
   * @returns {{ allowed: boolean, lockoutSeconds?: number }}
   */
  check(key) {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (record && record.lockedUntil && now >= record.lockedUntil) {
      record = { attempts: 0, lockedUntil: 0 };
      this.attempts.set(key, record);
    }

    if (record && record.lockedUntil && now < record.lockedUntil) {
      return { allowed: false, lockoutSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }

    if (!record) {
      record = { attempts: 1, lockedUntil: 0 };
    } else {
      record.attempts++;
    }

    if (record.attempts > this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_MS;
      this.attempts.set(key, record);
      return { allowed: false, lockoutSeconds: Math.ceil(this.LOCKOUT_MS / 1000) };
    }

    this.attempts.set(key, record);
    return { allowed: true };
  },

  reset(key) {
    this.attempts.delete(key);
  }
};

/**
 * Validate IPC event origin for security
 * Ensures requests come from legitimate renderer process
 */
function validateOrigin(event) {
  const webContents = event.sender;
  const url = webContents.getURL();

  // Allow only file:// protocol (our app)
  // devtools:// removed for security - prevents IPC access from DevTools console
  if (!url.startsWith('file://')) {
    console.error(`[GenPwd Pro] Blocked IPC from unauthorized origin: ${url}`);
    throw new Error('Unauthorized IPC origin');
  }
}

// Enhanced security configuration
const SECURITY_CONFIG = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false
};

let mainWindow;

// Create the main window
function createWindow() {
  // Load saved window state or use defaults
  const savedState = loadWindowState();

  // ==================== DPI SCALING SUPPORT ====================
  // Get primary display scale factor for proper sizing on high-DPI screens
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const workArea = primaryDisplay.workAreaSize;

  // Base dimensions (designed for 100% scaling)
  const baseWidth = 1000;
  const baseHeight = 800;
  const baseMinWidth = 900;
  const baseMinHeight = 650;

  // Calculate DPI-aware minimum dimensions
  // At high DPI (250%+), reduce minimum size to fit smaller logical screen areas
  // workArea is already in logical pixels
  let adjustedMinWidth = baseMinWidth;
  let adjustedMinHeight = baseMinHeight;

  // If screen is too small for base minimum, scale down proportionally
  if (workArea.width < baseMinWidth + 100) {
    adjustedMinWidth = Math.max(600, workArea.width - 50);
    console.log(`[GenPwd Pro] Adjusted minWidth for small screen: ${adjustedMinWidth}`);
  }
  if (workArea.height < baseMinHeight + 100) {
    adjustedMinHeight = Math.max(500, workArea.height - 50);
    console.log(`[GenPwd Pro] Adjusted minHeight for small screen: ${adjustedMinHeight}`);
  }

  // Apply scale factor for high-DPI displays (125%, 150%, 200%)
  // Electron handles this automatically for content, but window size needs adjustment
  const defaultWidth = savedState?.width || Math.min(baseWidth, workArea.width - 50);
  const defaultHeight = savedState?.height || Math.min(baseHeight, workArea.height - 50);

  const windowOptions = {
    width: defaultWidth,
    height: defaultHeight,
    minWidth: adjustedMinWidth,
    minHeight: adjustedMinHeight,
    title: 'GenPwd Pro',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      ...SECURITY_CONFIG,
      preload: path.join(__dirname, 'electron-preload.cjs')
    },
    autoHideMenuBar: false,
    show: false // Afficher seulement quand prêt
  };

  // Restore position if saved and valid
  if (savedState?.x !== undefined && savedState?.y !== undefined) {
    // Ensure at least 100px of window is visible on a connected display
    const displays = screen.getAllDisplays();
    const minVisiblePx = 100;
    const windowWidth = savedState.width || defaultWidth;
    const windowHeight = savedState.height || defaultHeight;

    const isOnScreen = displays.some(display => {
      const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
      // Calculate overlap between window and display
      const overlapLeft = Math.max(savedState.x, dx);
      const overlapRight = Math.min(savedState.x + windowWidth, dx + dw);
      const overlapTop = Math.max(savedState.y, dy);
      const overlapBottom = Math.min(savedState.y + windowHeight, dy + dh);
      const overlapWidth = overlapRight - overlapLeft;
      const overlapHeight = overlapBottom - overlapTop;
      // Window is visible if overlap is at least minVisiblePx in both dimensions
      return overlapWidth >= minVisiblePx && overlapHeight >= minVisiblePx;
    });

    if (isOnScreen) {
      windowOptions.x = savedState.x;
      windowOptions.y = savedState.y;
    } else {
      console.log('[GenPwd Pro] Saved window position off-screen, centering window');
    }
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Restore maximized state
  if (savedState?.isMaximized) {
    mainWindow.maximize();
  }

  // Charger l'application
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Afficher la fenêtre quand prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window state on resize/move (debounced)
  let saveStateTimeout = null;
  const debouncedSaveState = () => {
    if (saveStateTimeout) clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => saveWindowState(mainWindow), 500);
  };
  mainWindow.on('resize', debouncedSaveState);
  mainWindow.on('move', debouncedSaveState);

  // Ouvrir DevTools en mode développement
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Empêcher la navigation externe
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Permettre seulement la navigation vers l'application locale
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Gérer les liens externes
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Ouvrir les liens externes dans le navigateur par défaut
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // ==================== MINIMIZE TO TRAY ====================
  // Intercept close to minimize to tray instead of quitting
  // For password managers, keeping in tray is a security feature

  // Load saved close behavior preference
  let closeBehavior = 'ask'; // 'ask', 'minimize', 'quit'
  try {
    const prefsPath = path.join(app.getPath('userData'), 'close-behavior.json');
    if (fs.existsSync(prefsPath)) {
      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      closeBehavior = prefs.behavior || 'ask';
    }
  } catch (e) {
    console.log('[GenPwd Pro] No saved close behavior preference');
  }

  mainWindow.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault();

      // Apply saved preference
      if (closeBehavior === 'minimize') {
        mainWindow.hide();
        return false;
      } else if (closeBehavior === 'quit') {
        isQuitting = true;
        app.quit();
        return;
      }

      // Show dialog asking user preference (closeBehavior === 'ask')
      const t = getMainTranslations();

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: [
          t.minimizeToTray || 'Minimize to Tray',
          t.quitApp || 'Quit Application',
          t.alwaysMinimize || 'Always Minimize (Remember)'
        ],
        defaultId: 0,
        cancelId: 0,
        title: 'GenPwd Pro',
        message: t.closePromptTitle || 'Close GenPwd Pro?',
        detail: t.closePromptDetail || 'GenPwd Pro can run in the background to keep your vault accessible. Choose "Quit" to completely close the application.',
        icon: path.join(__dirname, 'assets', 'icon.ico')
      });

      if (response === 1) {
        // User chose to quit
        isQuitting = true;
        app.quit();
        return;
      } else if (response === 2) {
        // User chose "Always Minimize" - save preference
        try {
          const prefsPath = path.join(app.getPath('userData'), 'close-behavior.json');
          fs.writeFileSync(prefsPath, JSON.stringify({ behavior: 'minimize' }), 'utf8');
          closeBehavior = 'minimize';
          console.log('[GenPwd Pro] Saved close behavior: always minimize');
        } catch (e) {
          console.error('[GenPwd Pro] Failed to save close behavior:', e.message);
        }
      }

      // Minimize to tray
      mainWindow.hide();

      // Show notification (first 3 times per session to educate users)
      if (!mainWindow._trayNotificationCount) {
        mainWindow._trayNotificationCount = 0;
      }
      if (mainWindow._trayNotificationCount < 3 && Notification.isSupported()) {
        new Notification({
          title: 'GenPwd Pro',
          body: mainWindow._trayNotificationCount === 0
            ? 'App minimized to tray. Click the tray icon to restore, or right-click for options.'
            : 'Running in background. Right-click tray icon to quit.',
          icon: path.join(__dirname, 'assets', 'icon.ico'),
          silent: true
        }).show();
        mainWindow._trayNotificationCount++;
      }

      return false;
    }
  });

  // Cleanup lors de la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ==================== VISUAL PROTECTION ON BLUR ====================
  // Hide sensitive data when window loses focus (configurable)
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window:blur');
    }
  });

  mainWindow.on('focus', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window:focus');
    }
  });
}

// ==================== WINDOWS TASKBAR THUMBNAIL TOOLBAR ====================
// Provides quick action buttons in taskbar preview (Windows 7+)
function initThumbnailToolbar() {
  if (process.platform !== 'win32' || !mainWindow) return;

  try {
    // Create thumbnail toolbar buttons
    const buttons = [
      {
        tooltip: 'Generate Password',
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico')).resize({ width: 16, height: 16 }),
        click: () => {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('generate-password');
            mainWindow.show();
          }
        }
      },
      {
        tooltip: 'Lock Vault',
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico')).resize({ width: 16, height: 16 }),
        click: async () => {
          if (vaultModule) {
            const session = vaultModule.getSession();
            if (session && session.isUnlocked()) {
              await session.lock();
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('vault:locked');
              }
            }
          }
        }
      }
    ];

    mainWindow.setThumbnailToolbar(buttons);
    console.log('[GenPwd Pro] Taskbar thumbnail toolbar initialized');
  } catch (error) {
    console.error('[GenPwd Pro] Failed to set thumbnail toolbar:', error.message);
  }
}

// ==================== WINDOWS JUMP LIST ====================
// Provides quick access to common actions from taskbar right-click
function initJumpList() {
  if (process.platform !== 'win32') return;

  try {
    app.setJumpList([
      {
        type: 'tasks',
        items: [
          {
            type: 'task',
            title: 'Generate Password',
            description: 'Generate a new secure password',
            program: process.execPath,
            args: '--generate',
            iconPath: process.execPath,
            iconIndex: 0
          },
          {
            type: 'task',
            title: 'Open Vault',
            description: 'Open password vault',
            program: process.execPath,
            args: '--vault',
            iconPath: process.execPath,
            iconIndex: 0
          },
          {
            type: 'task',
            title: 'Lock Vault',
            description: 'Lock the vault immediately',
            program: process.execPath,
            args: '--lock',
            iconPath: process.execPath,
            iconIndex: 0
          }
        ]
      }
    ]);
    console.log('[GenPwd Pro] Windows Jump List initialized');
  } catch (error) {
    console.error('[GenPwd Pro] Failed to set Jump List:', error.message);
  }
}

// Update Jump List with recent vaults
function updateJumpListRecentVaults(recentVaults) {
  if (process.platform !== 'win32') return;

  try {
    const recentItems = recentVaults.slice(0, 5).map(vault => ({
      type: 'file',
      path: vault.path,
      title: vault.name || path.basename(vault.path)
    }));

    app.setJumpList([
      {
        type: 'recent',
        items: recentItems
      },
      {
        type: 'tasks',
        items: [
          {
            type: 'task',
            title: 'Generate Password',
            description: 'Generate a new secure password',
            program: process.execPath,
            args: '--generate',
            iconPath: process.execPath,
            iconIndex: 0
          },
          {
            type: 'task',
            title: 'Lock Vault',
            description: 'Lock the vault immediately',
            program: process.execPath,
            args: '--lock',
            iconPath: process.execPath,
            iconIndex: 0
          }
        ]
      }
    ]);
  } catch (error) {
    console.error('[GenPwd Pro] Failed to update Jump List:', error.message);
  }
}

// ==================== SYSTEM TRAY ====================
function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Resize for tray (16x16 on Windows)
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (error) {
    console.error('[GenPwd Pro] Failed to load tray icon:', error);
    // Create a simple fallback icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  const t = getMainTranslations();
  tray.setToolTip(t.trayTooltip);

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: t.showApp,
      accelerator: GLOBAL_HOTKEY,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: t.generatePassword,
      click: () => {
        const password = generateQuickPassword(20);
        clipboard.writeText(password);

        // Auto-clear after 30 seconds
        const timer = setTimeout(() => {
          const current = clipboard.readText();
          if (current === password) {
            clipboard.clear();
            console.log('[GenPwd Pro] Tray: Clipboard auto-cleared');
          }
        }, 30000);

        // Show notification
        if (Notification.isSupported()) {
          new Notification({
            title: t.passwordGenerated,
            body: t.copiedToClipboard,
            icon: path.join(__dirname, 'assets', 'icon.ico'),
            silent: true
          }).show();
        }

        console.log('[GenPwd Pro] Tray: Password generated and copied');
      }
    },
    {
      label: t.lockVault,
      click: async () => {
        if (vaultModule) {
          const session = vaultModule.getSession();
          if (session && session.isUnlocked()) {
            await session.lock();
            if (mainWindow) {
              mainWindow.webContents.send('vault:locked');
            }
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: t.quit,
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Click on tray icon toggles window visibility
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Double-click shows window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  console.log('[GenPwd Pro] System tray created');
}

// Create the application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Generate New Password',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('generate-password');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Vault',
      submenu: [
        {
          label: 'New Vault...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('vault:menu:create');
            }
          }
        },
        {
          label: 'Open Vault...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('vault:menu:open');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Lock',
          accelerator: 'CmdOrCtrl+L',
          click: async () => {
            if (vaultModule) {
              const session = vaultModule.getSession();
              if (session && session.isUnlocked()) {
                await session.lock();
              }
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'selectAll', label: 'Select All' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Full Screen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer Tools', accelerator: 'F12' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/VBlackJack/genpwd-pro');
          }
        },
        {
          label: 'Report a Bug',
          click: async () => {
            await shell.openExternal('https://github.com/VBlackJack/genpwd-pro/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About GenPwd Pro',
              message: `GenPwd Pro v${APP_VERSION}`,
              detail: 'Secure Password Manager\n\n' +
                'Copyright © 2025 Julien Bombled\n' +
                'Apache 2.0 License\n\n' +
                'Electron: ' + process.versions.electron + '\n' +
                'Chrome: ' + process.versions.chrome + '\n' +
                'Node.js: ' + process.versions.node,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // Menu Développement (only in development mode or unpackaged builds)
  // SECURITY: Hidden from end-users in production builds
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    template.push({
      label: 'Développement',
      submenu: [
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        {
          label: 'Recharger et effacer le cache',
          click: () => {
            mainWindow.webContents.session.clearCache();
            mainWindow.reload();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ==================== SECURE STORAGE IPC HANDLERS ====================
// Uses Windows DPAPI / macOS Keychain for encryption
//
// NOTE: These handlers return { success: boolean, data?, error? } objects
// for explicit error handling at the low-level API layer.
// This differs from vault handlers which throw errors for cleaner async/await usage.
// This is an intentional design choice for different abstraction levels.

// Check if safeStorage is available
ipcMain.handle('auth:is-available', (event) => {
  validateOrigin(event);
  return safeStorage.isEncryptionAvailable();
});

// Encrypt secret using OS-level encryption (DPAPI on Windows)
ipcMain.handle('auth:encrypt-secret', (event, text) => {
  validateOrigin(event);
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Secure storage not available' };
    }

    const encrypted = safeStorage.encryptString(text);
    // Return as base64 for easy storage
    return { success: true, data: encrypted.toString('base64') };
  } catch (error) {
    console.error('[GenPwd Pro] auth:encrypt-secret error:', error.message);
    return { success: false, error: error.message };
  }
});

// Decrypt secret using OS-level encryption
// Rate-limited to prevent brute force attacks
ipcMain.handle('auth:decrypt-secret', (event, base64Data) => {
  validateOrigin(event);

  // Check rate limit before processing
  const rateCheck = rateLimiter.check('auth:decrypt');
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${rateCheck.lockoutSeconds}s`,
      rateLimited: true
    };
  }

  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Secure storage not available' };
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    // Reset rate limit on success
    rateLimiter.reset('auth:decrypt');
    return { success: true, data: decrypted };
  } catch (error) {
    console.error('[GenPwd Pro] auth:decrypt-secret error:', error.message);
    return { success: false, error: error.message };
  }
});

// ==================== SMART CLIPBOARD IPC HANDLERS ====================
// Auto-clear clipboard after timeout (KeePass-style)

// Generate unique clipboard operation ID
let clipboardOpId = 0;
// Track if clipboard history warning has been shown
let clipboardHistoryWarningShown = false;

// Copy to clipboard with auto-clear
ipcMain.handle('clipboard:copy-secure', (event, text, ttlMs = 30000) => {
  validateOrigin(event);
  try {
    // Generate operation ID
    const opId = ++clipboardOpId;

    // Write to clipboard
    clipboard.writeText(text);

    // Show one-time warning about Windows Clipboard History (Win+V)
    if (process.platform === 'win32' && !clipboardHistoryWarningShown) {
      clipboardHistoryWarningShown = true;
      if (Notification.isSupported()) {
        new Notification({
          title: 'Security Tip',
          body: 'Windows Clipboard History (Win+V) may retain copied passwords. Consider disabling it in Windows Settings > System > Clipboard.',
          icon: path.join(__dirname, 'assets', 'icon.ico'),
          silent: true
        }).show();
      }
    }

    // Clear any existing timer for this type of content
    if (clipboardTimers.has('secure')) {
      clearTimeout(clipboardTimers.get('secure').timer);
    }

    // Notify renderer about clipboard countdown
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('clipboard:countdown-started', { opId, ttlMs });
    }

    // Set timer to clear clipboard
    const timer = setTimeout(() => {
      // Only clear if clipboard still contains our text
      const currentContent = clipboard.readText();
      if (currentContent === text) {
        clipboard.clear();
        console.log('[GenPwd Pro] Clipboard auto-cleared after timeout');

        // Notify renderer with clear message for toast
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('clipboard:cleared', { opId, message: 'Clipboard auto-cleared for security' });
        }
      }
      clipboardTimers.delete('secure');
    }, ttlMs);

    // Store timer reference
    clipboardTimers.set('secure', { timer, text, opId });

    return { success: true, opId, ttlMs };
  } catch (error) {
    console.error('[GenPwd Pro] clipboard:copy-secure error:', error.message);
    return { success: false, error: error.message };
  }
});

// Clear clipboard immediately
ipcMain.handle('clipboard:clear', (event) => {
  validateOrigin(event);
  try {
    // Cancel any pending timers
    for (const [key, { timer }] of clipboardTimers) {
      clearTimeout(timer);
    }
    clipboardTimers.clear();

    clipboard.clear();
    return { success: true };
  } catch (error) {
    console.error('[GenPwd Pro] clipboard:clear error:', error.message);
    return { success: false, error: error.message };
  }
});

// Get remaining time for clipboard auto-clear
ipcMain.handle('clipboard:get-ttl', (event) => {
  validateOrigin(event);
  const entry = clipboardTimers.get('secure');
  if (!entry) {
    return { active: false };
  }
  return { active: true, opId: entry.opId };
});

// ==================== WINDOW CONTROL IPC HANDLERS ====================

// Minimize to tray
ipcMain.handle('window:minimize-to-tray', (event) => {
  validateOrigin(event);
  if (mainWindow) {
    mainWindow.hide();
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

// Show window
ipcMain.handle('window:show', (event) => {
  validateOrigin(event);
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

// Check if window is visible
ipcMain.handle('window:is-visible', (event) => {
  validateOrigin(event);
  return mainWindow ? mainWindow.isVisible() : false;
});

// Quit application
ipcMain.handle('app:quit', (event) => {
  validateOrigin(event);
  isQuitting = true;
  app.quit();
  return { success: true };
});

// ==================== AUTO-START IPC ====================
// Get auto-start status
ipcMain.handle('app:get-autostart', (event) => {
  validateOrigin(event);
  return { enabled: getAutoStartEnabled() };
});

// Set auto-start status
ipcMain.handle('app:set-autostart', (event, enabled) => {
  validateOrigin(event);
  const result = setAutoStartEnabled(enabled);
  return {
    success: result.success,
    verified: result.verified,
    enabled: getAutoStartEnabled(),
    error: result.error
  };
});

// ==================== WINDOWS SYSTEM IPC ====================

// Get Windows accent color
ipcMain.handle('app:get-accent-color', async (event) => {
  validateOrigin(event);
  const colors = await getWindowsAccentColor();
  return colors || { accent: '#0078d4', accentLight: '#1a8cdb', accentDark: '#006cbd' };
});

// Get system info (admin status, platform details)
ipcMain.handle('app:get-system-info', (event) => {
  validateOrigin(event);
  return {
    isAdmin: isRunningAsAdmin(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome
  };
});

// ==================== COMPACT/OVERLAY MODE ====================
const COMPACT_SIZE = { width: 380, height: 640 };

// Toggle compact mode
ipcMain.handle('window:toggle-compact', (event) => {
  validateOrigin(event);
  if (!mainWindow) {
    return { success: false, error: 'No main window' };
  }

  if (!isCompactMode) {
    // Enter compact mode
    normalBounds = mainWindow.getBounds();

    mainWindow.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
    mainWindow.setSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setResizable(false);

    // Position in bottom-right corner of screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    mainWindow.setPosition(
      screenWidth - COMPACT_SIZE.width - 20,
      screenHeight - COMPACT_SIZE.height - 20
    );

    isCompactMode = true;
    mainWindow.webContents.send('window:compact-mode-changed', { compact: true });
    console.log('[GenPwd Pro] Entered compact mode');
  } else {
    // Exit compact mode
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(1200, 850);

    if (normalBounds) {
      mainWindow.setBounds(normalBounds);
    } else {
      mainWindow.setSize(1200, 1200);
      mainWindow.center();
    }

    isCompactMode = false;
    mainWindow.webContents.send('window:compact-mode-changed', { compact: false });
    console.log('[GenPwd Pro] Exited compact mode');
  }

  return { success: true, compact: isCompactMode };
});

// Get compact mode state
ipcMain.handle('window:is-compact', (event) => {
  validateOrigin(event);
  return { compact: isCompactMode };
});

// ==================== FILE SYSTEM IPC HANDLERS ====================

// Read binary file for KDBX import
ipcMain.handle('fs:read-binary', async (event, filePath) => {
  validateOrigin(event);
  try {
    // SECURITY: Validate path for directory traversal attacks
    const pathValidation = validateVaultPath(filePath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }

    // Security: validate path is a real file
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Read file as Buffer and return as ArrayBuffer
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, data: buffer };
  } catch (error) {
    console.error('[GenPwd Pro] fs:read-binary error:', error.message);
    return { success: false, error: error.message };
  }
});

// Show open file dialog for KDBX import
ipcMain.handle('fs:show-open-dialog', async (event, options = {}) => {
  validateOrigin(event);
  try {
    // Validate options
    const safeTitle = typeof options.title === 'string'
      ? options.title.slice(0, 255)
      : 'Ouvrir un fichier';

    // Validate filters array structure
    let safeFilters = [{ name: 'Tous les fichiers', extensions: ['*'] }];
    if (Array.isArray(options.filters) && options.filters.length > 0) {
      safeFilters = options.filters
        .filter(f => f && typeof f.name === 'string' && Array.isArray(f.extensions))
        .slice(0, 10) // Max 10 filters
        .map(f => ({
          name: String(f.name).slice(0, 100),
          extensions: f.extensions.filter(e => typeof e === 'string').slice(0, 20)
        }));
      if (safeFilters.length === 0) {
        safeFilters = [{ name: 'Tous les fichiers', extensions: ['*'] }];
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: safeTitle,
      filters: safeFilters,
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, canceled: true, filePath: null };
    }

    return { success: true, canceled: false, filePath: result.filePaths[0] };
  } catch (error) {
    console.error('[GenPwd Pro] fs:show-open-dialog error:', error.message);
    return { success: false, error: error.message };
  }
});

// ==================== VAULT I/O IPC HANDLERS ====================
// Low-level file operations for vault persistence

const ALLOWED_EXTENSIONS = ['.gpdb', '.gpd', '.json'];

// Allowed directories for vault operations
const ALLOWED_VAULT_DIRS = [
  app.getPath('userData'),
  app.getPath('documents'),
  app.getPath('home')
];

/**
 * Validate file extension for vault files
 * @param {string} filePath - Path to validate
 * @returns {boolean} True if extension is allowed
 */
function validateVaultExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Validate file path for security (prevent directory traversal)
 * @param {string} filePath - Path to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateVaultPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid file path' };
  }

  // Normalize the path to resolve any .. or .
  const normalizedPath = path.normalize(filePath);

  // Check for null bytes (path injection attack)
  if (normalizedPath.includes('\0')) {
    return { valid: false, error: 'Invalid path: contains null bytes' };
  }

  // Check for path traversal attempts (after normalization, .. shouldn't appear)
  if (normalizedPath.includes('..')) {
    return { valid: false, error: 'Invalid path: directory traversal not allowed' };
  }

  // Must be an absolute path
  if (!path.isAbsolute(normalizedPath)) {
    return { valid: false, error: 'Invalid path: must be absolute' };
  }

  // Check if path is within allowed directories
  const isAllowed = ALLOWED_VAULT_DIRS.some(allowedDir => {
    const normalizedAllowed = path.normalize(allowedDir);
    return normalizedPath.startsWith(normalizedAllowed + path.sep) || normalizedPath === normalizedAllowed;
  });

  if (!isAllowed) {
    return { valid: false, error: 'Invalid path: not in allowed directory' };
  }

  return { valid: true };
}

/**
 * Save vault data to file (atomic write)
 * Writes to temp file first, then renames to prevent corruption
 */
ipcMain.handle('vaultIO:save', async (event, { data, filePath }) => {
  validateOrigin(event);
  try {
    // Validate path for security (directory traversal protection)
    const pathValidation = validateVaultPath(filePath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }

    // Validate extension
    if (!validateVaultExtension(filePath)) {
      return { success: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }

    // Ensure directory exists (path is already validated as safe)
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Atomic write: write to temp file, then rename
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    // Handle both Buffer and string data
    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(tempPath, data);
    } else if (typeof data === 'string') {
      await fs.promises.writeFile(tempPath, data, 'utf-8');
    } else if (data instanceof Uint8Array) {
      await fs.promises.writeFile(tempPath, Buffer.from(data));
    } else {
      // Assume JSON object
      await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    }

    // Create backup of existing file if it exists
    try {
      await fs.promises.access(filePath);
      const backupPath = `${filePath}.bak`;
      await fs.promises.copyFile(filePath, backupPath);
    } catch {
      // File doesn't exist yet, no backup needed
    }

    // Atomic rename
    await fs.promises.rename(tempPath, filePath);

    console.log(`[GenPwd Pro] vaultIO:save - Saved to ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('[GenPwd Pro] vaultIO:save error:', error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Load vault data from file
 * Returns raw buffer or parsed JSON depending on file content
 */
ipcMain.handle('vaultIO:load', async (event, { filePath }) => {
  validateOrigin(event);
  try {
    // Validate path for security (directory traversal protection)
    const pathValidation = validateVaultPath(filePath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }

    // Validate extension
    if (!validateVaultExtension(filePath)) {
      return { success: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }

    // Check file exists
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      return { success: false, error: 'Path is not a file' };
    }

    // Read file
    const buffer = await fs.promises.readFile(filePath);

    // Try to parse as JSON, otherwise return raw buffer
    try {
      const content = buffer.toString('utf-8');
      const data = JSON.parse(content);
      console.log(`[GenPwd Pro] vaultIO:load - Loaded JSON from ${filePath}`);
      return { success: true, data, format: 'json', size: buffer.length };
    } catch {
      // Not JSON, return as buffer (for binary formats)
      console.log(`[GenPwd Pro] vaultIO:load - Loaded binary from ${filePath}`);
      return { success: true, data: buffer, format: 'binary', size: buffer.length };
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, error: 'File not found' };
    }
    console.error('[GenPwd Pro] vaultIO:load error:', error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Open file dialog for selecting vault files
 */
ipcMain.handle('vaultIO:selectFile', async (event) => {
  validateOrigin(event);
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Ouvrir un coffre',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpdb', 'gpd'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, canceled: true, filePath: null };
    }

    const filePath = result.filePaths[0];
    const stats = await fs.promises.stat(filePath);

    return {
      success: true,
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      size: stats.size
    };
  } catch (error) {
    console.error('[GenPwd Pro] vaultIO:selectFile error:', error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Save dialog for choosing vault save location
 */
ipcMain.handle('vaultIO:selectSaveLocation', async (event, { defaultName }) => {
  validateOrigin(event);
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Sauvegarder le coffre',
      defaultPath: defaultName || 'vault.gpdb',
      filters: [
        { name: 'GenPwd Vault', extensions: ['gpdb'] },
        { name: 'JSON Export', extensions: ['json'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true, filePath: null };
    }

    // Ensure proper extension
    let filePath = result.filePath;
    if (!validateVaultExtension(filePath)) {
      filePath += '.gpdb';
    }

    return {
      success: true,
      canceled: false,
      filePath,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    console.error('[GenPwd Pro] vaultIO:selectSaveLocation error:', error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Check if a file exists
 */
ipcMain.handle('vaultIO:exists', async (event, { filePath }) => {
  validateOrigin(event);
  try {
    // Validate path for security (directory traversal protection)
    const pathValidation = validateVaultPath(filePath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }

    await fs.promises.access(filePath, fs.constants.F_OK);
    return { success: true, exists: true };
  } catch {
    return { success: true, exists: false };
  }
});

/**
 * Get file info (size, modification date)
 */
ipcMain.handle('vaultIO:getFileInfo', async (event, { filePath }) => {
  validateOrigin(event);
  try {
    // Validate path for security (directory traversal protection)
    const pathValidation = validateVaultPath(filePath);
    if (!pathValidation.valid) {
      return { success: false, error: pathValidation.error };
    }

    const stats = await fs.promises.stat(filePath);
    return {
      success: true,
      info: {
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==================== AUTO-TYPE IPC HANDLERS ====================
// KeePass-style auto-typing into other applications
// Uses PowerShell SendKeys on Windows (no native modules required)

/**
 * Parse auto-type sequence and return array of actions
 * Supports: {USERNAME}, {PASSWORD}, {TAB}, {ENTER}, {DELAY N}
 */
function parseAutoTypeSequence(sequence, data) {
  const result = [];
  const regex = /\{([^}]+)\}|([^{]+)/g;
  let match;

  while ((match = regex.exec(sequence)) !== null) {
    if (match[1]) {
      // It's a placeholder like {USERNAME}
      const placeholder = match[1].toUpperCase();
      if (placeholder === 'USERNAME') {
        result.push({ type: 'text', value: data.username || '' });
      } else if (placeholder === 'PASSWORD') {
        result.push({ type: 'text', value: data.password || '' });
      } else if (placeholder === 'TAB') {
        result.push({ type: 'key', value: '{TAB}' });
      } else if (placeholder === 'ENTER') {
        result.push({ type: 'key', value: '{ENTER}' });
      } else if (placeholder.startsWith('DELAY ')) {
        // Bounds check: min 10ms, max 30000ms (30 seconds)
        const delayMs = Math.max(10, Math.min(30000, parseInt(placeholder.substring(6), 10) || 100));
        result.push({ type: 'delay', value: delayMs });
      } else if (placeholder === 'URL') {
        result.push({ type: 'text', value: data.url || '' });
      } else if (placeholder === 'NOTES') {
        result.push({ type: 'text', value: data.notes || '' });
      }
    } else if (match[2]) {
      // It's literal text
      result.push({ type: 'text', value: match[2] });
    }
  }

  return result;
}

/**
 * Escape text for PowerShell SendKeys
 * Special characters need escaping: +^%~(){}[]
 */
function escapeForSendKeys(text) {
  // Security: Limit text length to prevent memory issues (max 10KB)
  const MAX_TEXT_LENGTH = 10240;
  const safeText = typeof text === 'string' ? text.slice(0, MAX_TEXT_LENGTH) : '';

  // Characters that have special meaning in SendKeys
  const specialChars = /[+^%~(){}[\]]/g;
  return safeText.replace(specialChars, '{$&}');
}

/**
 * Build PowerShell script for auto-type
 */
function buildAutoTypePowerShell(actions) {
  const lines = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Start-Sleep -Milliseconds 300' // Initial delay - wait for target window focus stabilization
  ];

  for (const action of actions) {
    if (action.type === 'text') {
      const escaped = escapeForSendKeys(action.value);
      // Use single quotes and escape them for PowerShell
      const psString = escaped.replace(/'/g, "''");
      lines.push(`[System.Windows.Forms.SendKeys]::SendWait('${psString}')`);
    } else if (action.type === 'key') {
      // Keys like {TAB}, {ENTER} go directly
      lines.push(`[System.Windows.Forms.SendKeys]::SendWait('${action.value}')`);
    } else if (action.type === 'delay') {
      lines.push(`Start-Sleep -Milliseconds ${action.value}`);
    }
  }

  return lines.join('\n');
}

// Perform auto-type operation
ipcMain.handle('automation:perform-auto-type', async (event, { sequence, data, targetWindowTitle }) => {
  validateOrigin(event);
  try {
    // Only supported on Windows currently
    if (process.platform !== 'win32') {
      return { success: false, error: 'Auto-type currently only supported on Windows' };
    }

    // Validate inputs
    if (!sequence || !data) {
      return { success: false, error: 'Missing sequence or data' };
    }

    // Parse the sequence
    const actions = parseAutoTypeSequence(sequence, data);
    if (actions.length === 0) {
      return { success: false, error: 'No valid actions in sequence' };
    }

    // Minimize our window to focus the previous window
    // Check window state to avoid race conditions
    if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }

    // Wait for window switch
    // 1500ms delay for window focus stabilization (Windows animations)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Helper to safely restore window with guaranteed focus (Windows-specific)
    const safeRestore = () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
        mainWindow.restore();
        // Use setAlwaysOnTop temporarily to guarantee window comes to front on Windows
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.moveTop();
        // Remove always-on-top after brief delay to allow focus to settle
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(false);
          }
        }, 100);
      }
    };

    // SECURITY: Verify foreground window before typing sensitive data
    const foregroundTitle = await getActiveWindowTitle();
    if (!foregroundTitle) {
      safeRestore();
      return { success: false, error: 'Could not detect target window. Auto-type cancelled for security.' };
    }

    // Check for dangerous target windows (command prompts, terminals, etc.)
    const dangerousPatterns = [
      /cmd\.exe/i,
      /powershell/i,
      /terminal/i,
      /command prompt/i,
      /windows powershell/i,
      /pwsh/i,
      /bash/i,
      /git bash/i,
      /mintty/i,
      /conemu/i,
      /cmder/i,
      /administrator:/i
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(foregroundTitle));
    if (isDangerous) {
      console.warn('[GenPwd Pro] Auto-type blocked: dangerous target window detected:', foregroundTitle);

      // Notify renderer to show toast notification
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('autotype:blocked', {
          reason: 'security',
          windowTitle: foregroundTitle,
          message: 'Auto-type blocked: Cannot type into command-line windows for security reasons.'
        });
      }

      safeRestore();
      return {
        success: false,
        error: 'Auto-type blocked: Cannot type into command-line windows for security reasons.',
        blockedWindow: foregroundTitle
      };
    }

    // If a target window title was provided, verify it matches (partial match)
    if (targetWindowTitle && !foregroundTitle.toLowerCase().includes(targetWindowTitle.toLowerCase())) {
      console.warn('[GenPwd Pro] Auto-type target mismatch. Expected:', targetWindowTitle, 'Got:', foregroundTitle);
      safeRestore();
      return {
        success: false,
        error: `Target window mismatch. Expected "${targetWindowTitle}" but found "${foregroundTitle}".`,
        actualWindow: foregroundTitle
      };
    }

    console.log('[GenPwd Pro] Auto-type target verified:', foregroundTitle);

    // Build and execute PowerShell script using Base64 encoding for security
    // This prevents command injection attacks by encoding the entire script
    const psScript = buildAutoTypePowerShell(actions);
    const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');

    return new Promise((resolve) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', encodedScript
      ], {
        windowsHide: true
      });

      let stderr = '';

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
        // Always restore the main window after auto-type completes
        safeRestore();

        if (code === 0) {
          console.log('[GenPwd Pro] Auto-type completed successfully');
          resolve({ success: true });
        } else {
          console.error('[GenPwd Pro] Auto-type failed:', stderr);
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        }
      });

      ps.on('error', (error) => {
        console.error('[GenPwd Pro] Auto-type spawn error:', error.message);
        safeRestore();
        resolve({ success: false, error: error.message });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ps.kill();
        safeRestore();
        resolve({ success: false, error: 'Auto-type timed out' });
      }, 30000);
    });
  } catch (error) {
    console.error('[GenPwd Pro] automation:perform-auto-type error:', error.message);
    // Can't use safeRestore here as it's defined inside the try block
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    return { success: false, error: error.message };
  }
});

// Get default auto-type sequence
// Includes 50ms delays between fields for slow Windows forms compatibility
ipcMain.handle('automation:get-default-sequence', (event) => {
  validateOrigin(event);
  return '{USERNAME}{DELAY 50}{TAB}{DELAY 50}{PASSWORD}{DELAY 50}{ENTER}';
});

// Gestion du cycle de vie de l'application
const startHidden = process.argv.includes('--hidden');

app.whenReady().then(async () => {
  // Initialize crash reporter first (before any other code)
  initCrashReporter();

  // Check for admin mode and warn user (security risk for vault files)
  if (isRunningAsAdmin()) {
    console.warn('[GenPwd Pro] ⚠️ Running with administrator privileges');
    dialog.showMessageBox({
      type: 'warning',
      title: 'Security Warning',
      message: 'GenPwd Pro is running as Administrator',
      detail: 'Running as admin may cause vault files to have restricted permissions that other users cannot access.\n\nFor best security, run GenPwd Pro as a standard user.',
      buttons: ['I Understand'],
      defaultId: 0
    });
  }

  // Load vault module (ESM dynamic import)
  try {
    vaultModule = await import('./src/desktop/vault/index.js');
    vaultModule.registerVaultIPC(ipcMain);
    console.log('[GenPwd Pro] Vault IPC handlers registered');
  } catch (error) {
    console.error('[GenPwd Pro] Failed to load vault module:', error);
  }

  createWindow();
  createApplicationMenu();
  createTray();
  initJumpList();
  initThumbnailToolbar();

  // Handle hidden startup (auto-start)
  if (startHidden && mainWindow) {
    mainWindow.hide();
    console.log('[GenPwd Pro] Started hidden (auto-start mode)');
  }

  // Send Windows accent color to renderer after window is ready
  if (mainWindow && process.platform === 'win32') {
    mainWindow.webContents.on('did-finish-load', async () => {
      const colors = await getWindowsAccentColor();
      if (colors) {
        mainWindow.webContents.send('system:accent-color', colors);
        console.log('[GenPwd Pro] Sent Windows accent color:', colors.accent);
      }
    });
  }

  // ==================== GLOBAL HOTKEY (Boss Key) ====================
  // Register global shortcut to toggle window visibility
  try {
    const registered = globalShortcut.register(GLOBAL_HOTKEY, () => {
      if (!mainWindow) return;

      if (mainWindow.isVisible()) {
        mainWindow.hide();
        console.log('[GenPwd Pro] Boss Key: Window hidden');
      } else {
        mainWindow.show();
        mainWindow.focus();
        console.log('[GenPwd Pro] Boss Key: Window shown');
      }
    });

    if (registered) {
      console.log(`[GenPwd Pro] Global hotkey registered: ${GLOBAL_HOTKEY}`);
    } else {
      console.error(`[GenPwd Pro] Failed to register global hotkey: ${GLOBAL_HOTKEY}`);
    }
  } catch (error) {
    console.error('[GenPwd Pro] Global hotkey registration error:', error.message);
  }

  // ==================== GLOBAL AUTO-TYPE (KeePass Killer) ====================
  const GLOBAL_AUTOTYPE = 'CommandOrControl+Alt+A';

  try {
    globalShortcut.register(GLOBAL_AUTOTYPE, async () => {
      console.log('[GenPwd Pro] Global Auto-Type triggered');

      // Get Active Window Title
      const title = await getActiveWindowTitle();
      console.log(`[GenPwd Pro] Active Window: "${title}"`);

      if (title && mainWindow) {
        // Bring our window to invalid state (hidden) but notify renderer
        // Actually we want to stay hidden usually, unless match fails.
        // We send event to renderer to find match
        mainWindow.webContents.send('automation:global-autotype', { title });
      }
    });
    console.log(`[GenPwd Pro] Global Auto-Type registered: ${GLOBAL_AUTOTYPE}`);
  } catch (error) {
    console.error('[GenPwd Pro] Auto-Type registration error:', error);
  }

  // ==================== POWER MANAGEMENT (Security) ====================
  // Lock vault on system sleep/lock to require re-authentication
  powerMonitor.on('lock-screen', async () => {
    console.log('[GenPwd Pro] Screen locked - locking vault');
    if (vaultModule) {
      const session = vaultModule.getSession();
      if (session && session.isUnlocked()) {
        await session.lock();
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('vault:locked', { reason: 'screen-lock' });
        }
        // Show notification so user knows vault was locked
        if (Notification.isSupported()) {
          new Notification({
            title: 'GenPwd Pro - Vault Locked',
            body: 'Your vault was automatically locked for security when the screen was locked.',
            icon: path.join(__dirname, 'assets', 'icon.ico'),
            silent: true
          }).show();
        }
      }
    }
  });

  powerMonitor.on('suspend', async () => {
    console.log('[GenPwd Pro] System suspending - locking vault');
    if (vaultModule) {
      const session = vaultModule.getSession();
      if (session && session.isUnlocked()) {
        await session.lock();
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('vault:locked', { reason: 'suspend' });
        }
        // Show notification on resume (user won't see it during suspend)
        if (Notification.isSupported()) {
          new Notification({
            title: 'GenPwd Pro - Vault Locked',
            body: 'Your vault was automatically locked for security when the system went to sleep.',
            icon: path.join(__dirname, 'assets', 'icon.ico'),
            silent: true
          }).show();
        }
      }
    }
  });

  powerMonitor.on('resume', () => {
    console.log('[GenPwd Pro] System resumed from sleep');
    // Vault already locked on suspend, notify renderer to show unlock screen
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('vault:require-reauth', { reason: 'resume' });
    }
  });

  // Handle system shutdown - lock vault before quitting
  powerMonitor.on('shutdown', async () => {
    console.log('[GenPwd Pro] System shutting down - locking vault');
    if (vaultModule) {
      const session = vaultModule.getSession();
      if (session && session.isUnlocked()) {
        await session.lock();
      }
    }
  });

  // Handle app quit - ensure vault is locked
  app.on('before-quit', async (event) => {
    if (vaultModule) {
      const session = vaultModule.getSession();
      if (session && session.isUnlocked()) {
        console.log('[GenPwd Pro] App quitting - locking vault');
        event.preventDefault();
        await session.lock();
        app.quit();
      }
    }
  });

  // Set main window for vault events
  if (vaultModule && mainWindow) {
    vaultModule.setMainWindow(mainWindow);
  }

  // Handle deep link from initial launch (Windows)
  const deepLink = process.argv.find(arg => arg.startsWith('genpwd://'));
  if (deepLink) {
    // Delay to ensure window is ready
    setTimeout(() => handleDeepLink(deepLink), 1000);
  }

  app.on('activate', () => {
    // Sur macOS, recréer la fenêtre si elle n'existe pas
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (vaultModule && mainWindow) {
        vaultModule.setMainWindow(mainWindow);
      }
    } else if (mainWindow) {
      // Show window on dock icon click (macOS)
      mainWindow.show();
    }
  });
});

// Don't quit when all windows are closed (minimize to tray behavior)
app.on('window-all-closed', () => {
  // Only quit if isQuitting flag is set
  // On macOS, keep app in dock unless explicitly quit
  if (isQuitting || process.platform !== 'darwin') {
    // Don't quit - we're running in background
    // The tray will allow the user to quit
  }
});

// Clean up on quit
app.on('before-quit', () => {
  isQuitting = true;

  // Clear all clipboard timers
  for (const [key, { timer }] of clipboardTimers) {
    clearTimeout(timer);
  }
  clipboardTimers.clear();
});

// Destroy tray and unregister shortcuts on quit
app.on('will-quit', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  console.log('[GenPwd Pro] Global shortcuts unregistered');

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Sécurité: désactiver la création de nouvelles fenêtres
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
  });

  // ==================== NATIVE CONTEXT MENU ====================
  // Add standard cut/copy/paste context menu to all text inputs
  contents.on('context-menu', (e, params) => {
    const { editFlags, isEditable, selectionText } = params;
    const t = getMainTranslations();

    // Build context menu items based on context
    const menuTemplate = [];

    // For editable fields (inputs, textareas)
    if (isEditable) {
      menuTemplate.push(
        {
          label: t.undo || 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          enabled: editFlags.canUndo,
          click: () => contents.undo()
        },
        {
          label: t.redo || 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          enabled: editFlags.canRedo,
          click: () => contents.redo()
        },
        { type: 'separator' },
        {
          label: t.cut || 'Cut',
          accelerator: 'CmdOrCtrl+X',
          enabled: editFlags.canCut,
          click: () => contents.cut()
        },
        {
          label: t.copy || 'Copy',
          accelerator: 'CmdOrCtrl+C',
          enabled: editFlags.canCopy,
          click: () => contents.copy()
        },
        {
          label: t.paste || 'Paste',
          accelerator: 'CmdOrCtrl+V',
          enabled: editFlags.canPaste,
          click: () => contents.paste()
        },
        { type: 'separator' },
        {
          label: t.selectAll || 'Select All',
          accelerator: 'CmdOrCtrl+A',
          enabled: editFlags.canSelectAll,
          click: () => contents.selectAll()
        }
      );
    } else if (selectionText) {
      // For selected text (non-editable)
      menuTemplate.push({
        label: t.copy || 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: () => contents.copy()
      });
    }

    // Only show menu if we have items
    if (menuTemplate.length > 0) {
      const contextMenu = Menu.buildFromTemplate(menuTemplate);
      contextMenu.popup();
    }
  });
});

// Logging des erreurs
process.on('uncaughtException', (error) => {
  console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejetée non gérée:', reason);
});
