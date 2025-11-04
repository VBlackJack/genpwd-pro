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

// src/js/utils/environment.js - Environment detection utilities

/**
 * Checks if the application is running in development mode
 * @returns {boolean} true if running in development environment
 * @example
 * if (isDevelopment()) {
 *   console.log('Debug mode enabled');
 * }
 */
export function isDevelopment() {
  return location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1' ||
         location.protocol === 'file:';
}

/**
 * Checks if the application is running in production mode
 * @returns {boolean} true if running in production environment
 * @example
 * if (isProduction()) {
 *   initAnalytics();
 * }
 */
export function isProduction() {
  return !isDevelopment();
}

/**
 * Gets the current environment name
 * @returns {string} 'development' or 'production'
 * @example
 * console.log(`Running in ${getEnvironment()} mode`);
 */
export function getEnvironment() {
  return isDevelopment() ? 'development' : 'production';
}
