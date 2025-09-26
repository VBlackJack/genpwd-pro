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
// src/js/utils/selection-fix.js - Protection contre l'erreur IndexSizeError

/**
 * Vérifie si une sélection est valide et accessible
 * Corrige le bug où rangeCount > 0 mais getRangeAt(0) échoue
 */
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
      } catch (e) {
        // Ignore silencieusement
      }

      return null;
    }
  } catch (error) {
    console.error('Erreur dans safeGetSelection:', error);
    return null;
  }
}

/**
 * Remplace toute logique existante qui utilise window.getSelection()
 */
export function isTextSelected() {
  const selectionData = safeGetSelection();
  return selectionData && selectionData.text.length > 0;
}

/**
 * Récupère le texte sélectionné de façon sécurisée
 */
export function getSelectedText() {
  const selectionData = safeGetSelection();
  return selectionData ? selectionData.text : '';
}

/**
 * Protection globale à installer au démarrage
 * Remplace window.getSelection par une version sécurisée
 */
export function installSelectionProtection() {
  const originalGetSelection = window.getSelection;

  window.getSelection = function() {
    const selection = originalGetSelection.call(this);

    if (!selection) return selection;

    const originalGetRangeAt = selection.getRangeAt;
    selection.getRangeAt = function(index) {
      try {
        if (!document.hasFocus()) {
          throw new Error('Document not focused - selection access denied');
        }

        if (index < 0 || index >= this.rangeCount) {
          throw new DOMException('Index is not valid', 'IndexSizeError');
        }

        return originalGetRangeAt.call(this, index);
      } catch (error) {
        console.warn('getRangeAt intercepté:', error.message);

        try {
          this.removeAllRanges();
        } catch (e) {
          // Ignore
        }

        throw error;
      }
    };

    return selection;
  };

  console.log('✅ Protection Selection installée');
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
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      try {
        selection.getRangeAt(0);
      } catch (e) {
        console.log('Nettoyage sélection corrompue');
        selection.removeAllRanges();
      }
    }
  } catch (error) {
    console.warn('Erreur focusAndCleanSelection:', error.message);
  }
}

// Utilitaire pour debugging
export function debugSelection() {
  const selection = window.getSelection();
  console.log('=== DEBUG SELECTION ===');
  console.log('hasFocus:', document.hasFocus());
  console.log('selection:', selection);
  console.log('rangeCount:', selection?.rangeCount);

  if (selection && selection.rangeCount > 0) {
    try {
      const range = selection.getRangeAt(0);
      console.log('range valid:', !!range);
      console.log('collapsed:', range?.collapsed);
      console.log('text:', range?.toString());
    } catch (e) {
      console.log('getRangeAt ERROR:', e.message);
    }
  }
  console.log('=======================');
}
