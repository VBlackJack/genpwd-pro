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
// src/js/utils/selection-fix.js - Protection renforcée contre IndexSizeError

/**
 * Protection AGRESSIVE qui patche directement le prototype Selection
 * Pour intercepter même les références stockées par des extensions
 */
export function installSelectionProtection() {
  // Sauvegarder la méthode originale
  const originalGetRangeAt = Selection.prototype.getRangeAt;
  
  // Remplacer sur le prototype pour intercepter TOUS les appels
  Selection.prototype.getRangeAt = function(index) {
    try {
      // Vérifications de sécurité AVANT l'appel original
      if (!document.hasFocus()) {
        console.warn('🛡️ getRangeAt bloqué: Document sans focus');
        // Nettoyage préventif
        try {
          this.removeAllRanges();
        } catch (e) { /* ignore */ }
        throw new DOMException('Document not focused - selection access denied', 'IndexSizeError');
      }
      
      if (index < 0 || index >= this.rangeCount) {
        console.warn('🛡️ getRangeAt bloqué: Index invalide', { index, rangeCount: this.rangeCount });
        // Nettoyage préventif
        try {
          this.removeAllRanges();
        } catch (e) { /* ignore */ }
        throw new DOMException('Index is not valid', 'IndexSizeError');
      }
      
      if (this.rangeCount === 0) {
        console.warn('🛡️ getRangeAt bloqué: Aucune range disponible');
        throw new DOMException('No ranges available', 'IndexSizeError');
      }
      
      // Appel sécurisé à la méthode originale
      return originalGetRangeAt.call(this, index);
      
    } catch (error) {
      // Log pour debug mais sans polluer
      if (error.name === 'IndexSizeError') {
        console.warn('🛡️ IndexSizeError interceptée et gérée:', error.message);
      } else {
        console.error('🛡️ Erreur inattendue dans getRangeAt:', error);
      }
      
      // Nettoyage forcé
      try {
        this.removeAllRanges();
      } catch (e) { /* ignore */ }
      
      // Re-lancer l'erreur pour que le code appelant la gère
      throw error;
    }
  };

  // Protection supplémentaire sur window.getSelection
  const originalGetSelection = window.getSelection;
  window.getSelection = function() {
    const selection = originalGetSelection.call(this);
    // Le travail est déjà fait sur le prototype, on retourne juste la sélection
    return selection;
  };

  console.log('🛡️ Protection Selection RENFORCÉE installée (prototype + window)');
}

/**
 * Fonction pour forcer le focus et nettoyer les sélections corrompues
 */
export function focusAndCleanSelection() {
  try {
    // Forcer le focus de façon plus agressive
    if (!document.hasFocus()) {
      window.focus();
      if (document.body) {
        document.body.focus();
      }
      // Essayer de donner le focus à un élément focusable
      const focusable = document.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
      if (focusable) {
        focusable.focus();
        focusable.blur(); // Retirer le focus visuel
      }
    }

    // Nettoyage de toutes les sélections corrompues
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let needsCleaning = false;
      
      // Tester chaque range
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

// Fonctions utilitaires (inchangées)
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
