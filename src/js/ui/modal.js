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
/**
 * @fileoverview Modal and overlay management
 * Handles the About modal dialog with accessibility support
 */
import { getElement, addEventListener } from './dom.js';
import { safeLog } from '../utils/logger.js';

/**
 * Shows the About modal dialog
 * Manages focus and prevents body scroll when open
 */
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

/**
 * Hides the About modal dialog
 * Restores body scroll and returns focus to the trigger button
 */
export function hideAboutModal() {
  const modal = getElement('#about-modal');
  if (modal) {
    // M-3: Animate exit before removing
    modal.classList.add('closing');

    const onEnd = () => {
      modal.classList.remove('show', 'closing');
      document.body.classList.remove('no-scroll');

      const aboutBtn = getElement('#btn-about');
      if (aboutBtn) aboutBtn.focus();

      safeLog('About modal closed');
    };

    // Respect reduced-motion: skip animation
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      onEnd();
    } else {
      modal.addEventListener('transitionend', onEnd, { once: true });
      // Safety fallback if transitionend never fires
      setTimeout(onEnd, 400);
    }
  }
}

/**
 * Binds all event handlers for the About modal
 * Handles open, close (button, overlay, escape key)
 */
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
