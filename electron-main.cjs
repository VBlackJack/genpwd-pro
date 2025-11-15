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
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { version: APP_VERSION } = require('./package.json');

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

  // Cleanup lors de la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
        { role: 'togglefullscreen', label: 'Plein écran' }
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

  // Ajouter le menu DevTools en mode développement
  if (process.env.NODE_ENV === 'development') {
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

// Gestion du cycle de vie de l'application
app.whenReady().then(() => {
  createWindow();
  createApplicationMenu();

  app.on('activate', () => {
    // Sur macOS, recréer la fenêtre si elle n'existe pas
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
  // Sur macOS, garder l'app active jusqu'à Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
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
