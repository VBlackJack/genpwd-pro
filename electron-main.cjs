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
  globalShortcut
} = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { version: APP_VERSION } = require('./package.json');

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

    const script = `
      $code = @'
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
      '@
      $win32 = Add-Type -MemberDefinition $code -Name "Win32" -Namespace Win32 -PassThru
      $handle = $win32::GetForegroundWindow()
      $title = New-Object System.Text.StringBuilder 256
      $win32::GetWindowText($handle, $title, 256) | Out-Null
      $title.ToString()
    `;

    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
    ], { windowsHide: true });

    let stdout = '';
    ps.stdout.on('data', d => stdout += d.toString());
    ps.on('close', () => resolve(stdout.trim()));
    ps.on('error', () => resolve(''));
    // Timeout
    setTimeout(() => {
      try { ps.kill(); } catch { }
      resolve('');
    }, 2000);
  });
}

// ==================== IPC SECURITY ====================
/**
 * Validate IPC event origin for security
 * Ensures requests come from legitimate renderer process
 */
function validateOrigin(event) {
  const webContents = event.sender;
  const url = webContents.getURL();

  // Allow file:// protocol (our app) and devtools
  if (!url.startsWith('file://') && !url.startsWith('devtools://')) {
    console.error(`[GenPwd Pro] Blocked IPC from unauthorized origin: ${url}`);
    throw new Error('Unauthorized IPC origin');
  }
}

// Configuration de sécurité renforcée
const SECURITY_CONFIG = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false
};

let mainWindow;

// Créer la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1200,
    minWidth: 1200,
    minHeight: 850,
    title: 'GenPwd Pro',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      ...SECURITY_CONFIG,
      preload: path.join(__dirname, 'electron-preload.cjs')
    },
    autoHideMenuBar: false,
    show: false // Afficher seulement quand prêt
  });

  // Charger l'application
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Afficher la fenêtre quand prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

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
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // Show notification (only once per session)
      if (!mainWindow._trayNotificationShown && Notification.isSupported()) {
        new Notification({
          title: 'GenPwd Pro',
          body: 'L\'application continue en arrière-plan. Cliquez sur l\'icône pour la rouvrir.',
          icon: path.join(__dirname, 'assets', 'icon.ico'),
          silent: true
        }).show();
        mainWindow._trayNotificationShown = true;
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
  tray.setToolTip('GenPwd Pro - Générateur de mots de passe');

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Afficher GenPwd Pro',
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
      label: 'Générer un mot de passe',
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
            title: 'Mot de passe généré',
            body: 'Copié dans le presse-papier (30s)',
            icon: path.join(__dirname, 'assets', 'icon.ico'),
            silent: true
          }).show();
        }

        console.log('[GenPwd Pro] Tray: Password generated and copied');
      }
    },
    {
      label: 'Verrouiller le coffre',
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
      label: 'Quitter',
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

// Créer le menu de l'application
function createApplicationMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Générer nouveau mot de passe',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('generate-password');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Coffre',
      submenu: [
        {
          label: 'Nouveau coffre...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('vault:menu:create');
            }
          }
        },
        {
          label: 'Ouvrir coffre...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('vault:menu:open');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Verrouiller',
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
      label: 'Édition',
      submenu: [
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Recharger (force)' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoomer' },
        { role: 'zoomOut', label: 'Dézoomer' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Outils développeur', accelerator: 'F12' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/VBlackJack/genpwd-pro');
          }
        },
        {
          label: 'Signaler un bug',
          click: async () => {
            await shell.openExternal('https://github.com/VBlackJack/genpwd-pro/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'À propos',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos de GenPwd Pro',
              message: `GenPwd Pro v${APP_VERSION}`,
              detail: 'Générateur de mots de passe sécurisé\n\n' +
                'Copyright © 2025 Julien Bombled\n' +
                'Licence Apache 2.0\n\n' +
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

  // Menu Développement (toujours disponible pour debug)
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

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ==================== SECURE STORAGE IPC HANDLERS ====================
// Uses Windows DPAPI / macOS Keychain for encryption

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
ipcMain.handle('auth:decrypt-secret', (event, base64Data) => {
  validateOrigin(event);
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { success: false, error: 'Secure storage not available' };
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
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

// Copy to clipboard with auto-clear
ipcMain.handle('clipboard:copy-secure', (event, text, ttlMs = 30000) => {
  validateOrigin(event);
  try {
    // Generate operation ID
    const opId = ++clipboardOpId;

    // Write to clipboard
    clipboard.writeText(text);

    // Clear any existing timer for this type of content
    if (clipboardTimers.has('secure')) {
      clearTimeout(clipboardTimers.get('secure').timer);
    }

    // Set timer to clear clipboard
    const timer = setTimeout(() => {
      // Only clear if clipboard still contains our text
      const currentContent = clipboard.readText();
      if (currentContent === text) {
        clipboard.clear();
        console.log('[GenPwd Pro] Clipboard auto-cleared after timeout');

        // Notify renderer
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('clipboard:cleared', { opId });
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
ipcMain.handle('fs:show-open-dialog', async (event, options) => {
  validateOrigin(event);
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'Ouvrir un fichier',
      filters: options.filters || [{ name: 'Tous les fichiers', extensions: ['*'] }],
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
 * Save vault data to file (atomic write)
 * Writes to temp file first, then renames to prevent corruption
 */
ipcMain.handle('vaultIO:save', async (event, { data, filePath }) => {
  validateOrigin(event);
  try {
    // Validate extension
    if (!validateVaultExtension(filePath)) {
      return { success: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` };
    }

    // Ensure directory exists
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
        const delayMs = parseInt(placeholder.substring(6), 10) || 100;
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
  // Characters that have special meaning in SendKeys
  const specialChars = /[+^%~(){}[\]]/g;
  return text.replace(specialChars, '{$&}');
}

/**
 * Build PowerShell script for auto-type
 */
function buildAutoTypePowerShell(actions) {
  const lines = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Start-Sleep -Milliseconds 100' // Small initial delay
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
ipcMain.handle('automation:perform-auto-type', async (event, { sequence, data }) => {
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
    if (mainWindow) {
      mainWindow.minimize();
    }

    // Wait for window switch
    await new Promise(resolve => setTimeout(resolve, 500));

    // Build and execute PowerShell script
    const psScript = buildAutoTypePowerShell(actions);

    return new Promise((resolve) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psScript
      ], {
        windowsHide: true
      });

      let stderr = '';

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ps.on('close', (code) => {
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
        resolve({ success: false, error: error.message });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        ps.kill();
        resolve({ success: false, error: 'Auto-type timed out' });
      }, 30000);
    });
  } catch (error) {
    console.error('[GenPwd Pro] automation:perform-auto-type error:', error.message);
    return { success: false, error: error.message };
  }
});

// Get default auto-type sequence
ipcMain.handle('automation:get-default-sequence', (event) => {
  validateOrigin(event);
  return '{USERNAME}{TAB}{PASSWORD}{ENTER}';
});

// Gestion du cycle de vie de l'application
app.whenReady().then(async () => {
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
});

// Logging des erreurs
process.on('uncaughtException', (error) => {
  console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejetée non gérée:', reason);
});
