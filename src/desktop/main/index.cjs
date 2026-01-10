/*
 * Copyright 2026 Julien Bombled
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
 * Electron Main Process Modules
 *
 * This module exports all modularized components for the Electron main process.
 * Import this file instead of individual modules for cleaner code organization.
 *
 * Usage:
 *   const {
 *     ClipboardManager,
 *     PathValidator,
 *     RateLimiter,
 *     translations
 *   } = require('./src/desktop/main');
 *
 * @module desktop/main
 */

// Translations
const { translations, getMainTranslations, t } = require('./translations.cjs');

// Clipboard management
const { ClipboardManager, registerClipboardIPC } = require('./clipboard-manager.cjs');

// Security utilities
const {
  PathValidator,
  RateLimiter,
  SecureStorageWrapper,
  isRunningAsAdmin,
  devLog,
  devError
} = require('./security-utils.cjs');

module.exports = {
  // Translations
  translations,
  getMainTranslations,
  t,

  // Clipboard
  ClipboardManager,
  registerClipboardIPC,

  // Security
  PathValidator,
  RateLimiter,
  SecureStorageWrapper,
  isRunningAsAdmin,
  devLog,
  devError
};
