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

// electron-preload.js - Script de préchargement sécurisé
const { contextBridge, ipcRenderer } = require('electron');

// Exposer une API sécurisée au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Information sur la plateforme
  platform: process.platform,

  // Version de l'application
  version: '2.5.2',

  // Vérifier si on est dans Electron
  isElectron: true,

  // Écouter les événements du main process
  onGeneratePassword: (callback) => {
    ipcRenderer.on('generate-password', callback);
  }
});

// Log pour debug
console.log('GenPwd Pro - Preload script chargé');
console.log('Platform:', process.platform);
console.log('Electron version:', process.versions.electron);
