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

// ESLint v9 configuration (flat config)
export default [
  // Configuration pour les fichiers source ES modules
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        globalThis: 'readonly',
        fetch: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        JSON: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Error: 'readonly',
        TypeError: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
        Buffer: 'readonly',
        AbortController: 'readonly',
        DOMParser: 'readonly',
        Element: 'readonly',
        confirm: 'readonly',
        MessageChannel: 'readonly',
        process: 'readonly',
        Event: 'readonly',
        FileReader: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      // Strict: unused vars on exports/functions are errors
      // Catch errors can be unused (common pattern)
      'no-unused-vars': ['error', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none' // Allow unused catch binding
      }],
      'no-case-declarations': 'off',
      // Critical rules that should fail CI
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-ex-assign': 'error',
      'no-func-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-sparse-arrays': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error'
    }
  },

  // Configuration pour les outils Node.js
  {
    files: ['tools/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        crypto: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  },

  // Ignorer les fichiers de build et dépendances
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.min.js'
    ]
  }
];
