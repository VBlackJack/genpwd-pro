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
// src/js/utils/selection-fix.js - Utilitaires pour la protection Selection

/**
 * La protection principale est maintenant dans <head> de index.html
 * Ce module fournit juste les utilitaires complémentaires
 */
export function installSelectionProtection() {
  // Ne fait plus rien - protection déjà installée dans <head>
  console.log('🛡️ Protection Selection déjà active (installée dans <head>)');
}

/**
 * Fonction pour forcer le focus et nettoyer les sélections corrompues
 */
export function focusAndCleanSelection() {
  try {
    if (!document.hasFocus()) {
      window.focus();
      if (document.body) {
        document.body.focus();
      }
      const focusable = document.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
      if (focusable) {
        focusable.focus();
        focusable.blur();
      }
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let needsCleaning = false;
      
      for (let i = 0; i < selection.rangeCount; i++) {
        try {
          selection.getRangeAt(i);
        } catch (e) {
          needsCleaning = true;
          break;
        }
      }
      
      if (needsCleaning) {
        console.log('🧹 Nettoyage des sélections corrompues');
        selection.removeAllRanges();
      }
    }
  } catch (error) {
    console.warn('Erreur focusAndCleanSelection:', error.message);
  }
}

// Fonctions utilitaires inchangées
export function safeGetSelection() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    if (!document.hasFocus()) {
      console.warn('Selection active mais document sans focus - ignoré');
      return null;
    }
    try {
      const range = selection.getRangeAt(0);
      if (!range || range.collapsed) {
        return null;
      }
      return {
        selection,
        range,
        text: range.toString(),
        isValid: true
      };
    } catch (indexError) {
      console.warn('IndexSizeError évitée:', indexError.message);
      try {
        selection.removeAllRanges();
      } catch (e) { /* ignore */ }
      return null;
    }
  } catch (error) {
    console.error('Erreur dans safeGetSelection:', error);
    return null;
  }
}

export function isTextSelected() {
  const selectionData = safeGetSelection();
  return selectionData && selectionData.text.length > 0;
}

export function getSelectedText() {
  const selectionData = safeGetSelection();
  return selectionData ? selectionData.text : '';
}

export function debugSelection() {
  const selection = window.getSelection();
  console.log('=== DEBUG SELECTION ===');
  console.log('hasFocus:', document.hasFocus());
  console.log('selection:', selection);
  console.log('rangeCount:', selection?.rangeCount);
  console.log('Protection ultra-précoce active:', 
    typeof window.disableSelectionProtection === 'function');

  if (selection && selection.rangeCount > 0) {
    for (let i = 0; i < selection.rangeCount; i++) {
      try {
        const range = selection.getRangeAt(i);
        console.log(`Range ${i}:`, {
          valid: !!range,
          collapsed: range?.collapsed,
          text: range?.toString()
        });
      } catch (e) {
        console.log(`Range ${i} ERROR:`, e.message);
      }
    }
  }
  console.log('=======================');
}
