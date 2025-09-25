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
// src/js/ui/modal.js - Gestion des modaux et overlays
import { getElement, addEventListener } from './dom.js';
import { safeLog } from '../utils/logger.js';

export function showAboutModal() {
  const modal = getElement('#about-modal');
  if (modal) {
    modal.classList.add('show');
    
    // Focus management pour accessibilité
    const closeBtn = getElement('#modal-close');
    if (closeBtn) closeBtn.focus();
    
    // Empêcher scroll body
    document.body.style.overflow = 'hidden';
    
    safeLog('Modal À Propos ouvert');
  }
}

export function hideAboutModal() {
  const modal = getElement('#about-modal');
  if (modal) {
    modal.classList.remove('show');
    
    // Restaurer scroll body
    document.body.style.overflow = '';
    
    // Retourner focus au bouton
    const aboutBtn = getElement('#btn-about');
    if (aboutBtn) aboutBtn.focus();
    
    safeLog('Modal À Propos fermé');
  }
}

export function bindModalEvents() {
  // Ouvrir modal
  addEventListener(getElement('#btn-about'), 'click', showAboutModal);
  
  // Fermer modal - bouton
  addEventListener(getElement('#modal-close'), 'click', hideAboutModal);
  
  // Fermer modal - clic overlay
  addEventListener(getElement('#about-modal'), 'click', (e) => {
    if (e.target === e.currentTarget) {
      hideAboutModal();
    }
  });
  
  // Fermer modal - touche Escape
  addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape' && getElement('#about-modal').classList.contains('show')) {
      hideAboutModal();
    }
  });
  
  safeLog('Événements modal bindés');
}
