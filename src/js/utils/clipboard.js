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
// src/js/utils/clipboard.js - Gestion renforcée du presse-papiers

import { safeLog } from './logger.js';

/**
 * Force le focus sur la fenêtre de façon robuste
 */
async function ensureDocumentFocus() {
  if (document.hasFocus()) {
    return true;
  }

  try {
    window.focus();

    if (document.body) {
      document.body.focus();
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    const hasFocus = document.hasFocus();
    if (!hasFocus) {
      safeLog("⚠️  Impossible d'obtenir le focus - clipboard pourrait échouer");
    }

    return hasFocus;
  } catch (error) {
    safeLog(`Erreur focus: ${error.message}`);
    return false;
  }
}

export async function copyToClipboard(text) {
  if (!text) return false;

  try {
    await ensureDocumentFocus();

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (clipboardError) {
        safeLog(`Clipboard API échoué: ${clipboardError.message}`);
      }
    }

    return await fallbackCopyTextToClipboard(text);
  } catch (err) {
    safeLog(`Erreur copie clipboard: ${err.message}`);
    return await fallbackCopyTextToClipboard(text);
  }
}

async function fallbackCopyTextToClipboard(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    Object.assign(textArea.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '0',
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1'
    });

    document.body.appendChild(textArea);

    let focusAttempts = 0;
    const maxAttempts = 3;

    while (focusAttempts < maxAttempts) {
      try {
        textArea.focus();
        textArea.select();

        if (textArea.selectionStart === 0 && textArea.selectionEnd === text.length) {
          break;
        }
      } catch (e) {
        safeLog(`Tentative focus ${focusAttempts + 1} échouée: ${e.message}`);
      }

      focusAttempts++;

      if (focusAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!successful) {
      safeLog('⚠️  execCommand(copy) a retourné false');
    }

    return successful;
  } catch (err) {
    safeLog(`Erreur fallback clipboard: ${err.message}`);
    return false;
  }
}

/**
 * 🔧 NOUVEAU: Fonction de test pour diagnostiquer les problèmes
 */
export function testClipboardCapabilities() {
  console.log('=== TEST CLIPBOARD ===');
  console.log('navigator.clipboard:', !!navigator.clipboard);
  console.log('isSecureContext:', window.isSecureContext);
  console.log('document.hasFocus():', document.hasFocus());
  console.log('execCommand support:', document.queryCommandSupported('copy'));

  copyToClipboard('test').then(result => {
    console.log('Test copie result:', result);
  });

  console.log('======================');
}
