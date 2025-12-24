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
// src/js/ui/modal.js - Modal and overlay management
import { getElement, addEventListener } from './dom.js';
import { safeLog } from '../utils/logger.js';

export function showAboutModal() {
  const modal = getElement('#about-modal');
  if (modal) {
    modal.classList.add('show');

    // Focus management for accessibility
    const closeBtn = getElement('#modal-close');
    if (closeBtn) closeBtn.focus();

    // Prevent body scroll
    document.body.classList.add('no-scroll');

    safeLog('About modal opened');
  }
}

export function hideAboutModal() {
  const modal = getElement('#about-modal');
  if (modal) {
    modal.classList.remove('show');

    // Restore body scroll
    document.body.classList.remove('no-scroll');

    // Return focus to button
    const aboutBtn = getElement('#btn-about');
    if (aboutBtn) aboutBtn.focus();

    safeLog('About modal closed');
  }
}

export function bindModalEvents() {
  // Open modal
  addEventListener(getElement('#btn-about'), 'click', showAboutModal);

  // Close modal - button
  addEventListener(getElement('#modal-close'), 'click', hideAboutModal);

  // Close modal - overlay click
  addEventListener(getElement('#about-modal'), 'click', (e) => {
    if (e.target === e.currentTarget) {
      hideAboutModal();
    }
  });

  // Close modal - Escape key
  addEventListener(document, 'keydown', (e) => {
    if (e.key === 'Escape' && getElement('#about-modal').classList.contains('show')) {
      hideAboutModal();
    }
  });

  safeLog('Modal events bound');
}
