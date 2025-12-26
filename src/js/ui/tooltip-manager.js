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

// src/js/ui/tooltip-manager.js
// Singleton tooltip - Premium look, bypasses overflow:hidden

let tooltipEl = null;
let tooltipController = null;

/**
 * Initialize tooltip system with proper cleanup support
 */
export function initTooltips() {
  // Clean up any previous listeners
  cleanupTooltips();

  // Create AbortController for cleanup
  tooltipController = new AbortController();
  const signal = tooltipController.signal;

  // Create the singleton element if it doesn't exist
  if (!document.getElementById('app-tooltip')) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'app-tooltip';
    document.body.appendChild(tooltipEl);
  } else {
    tooltipEl = document.getElementById('app-tooltip');
  }

  // Event delegation for mouseover
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[title]');

    if (target) {
      const text = target.getAttribute('title');
      if (!text) return;

      // Prevent native browser tooltip
      target.setAttribute('data-title', text);
      target.removeAttribute('title');

      showTooltip(target, text);
    }
  }, { signal });

  // Event delegation for mouseout
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-title]');
    if (target) {
      // Restore title attribute for accessibility
      target.setAttribute('title', target.getAttribute('data-title'));
      target.removeAttribute('data-title');

      hideTooltip();
    }
  }, { signal });

  // Keyboard accessibility: hide tooltip on focus change (Tab away)
  document.addEventListener('focusout', (e) => {
    const target = e.target.closest('[data-title]');
    if (target) {
      // Restore title attribute for accessibility
      target.setAttribute('title', target.getAttribute('data-title'));
      target.removeAttribute('data-title');
      hideTooltip();
    }
  }, { signal });

  // Also hide tooltip on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tooltipEl?.classList.contains('visible')) {
      hideTooltip();
      // Restore any active data-title attributes
      document.querySelectorAll('[data-title]').forEach(el => {
        el.setAttribute('title', el.getAttribute('data-title'));
        el.removeAttribute('data-title');
      });
    }
  }, { signal });
}

/**
 * Cleanup tooltip event listeners
 */
export function cleanupTooltips() {
  if (tooltipController) {
    tooltipController.abort();
    tooltipController = null;
  }
  if (tooltipEl) {
    hideTooltip();
  }
}

function showTooltip(element, text) {
  tooltipEl.textContent = text;
  tooltipEl.classList.add('visible');

  // Position calculations
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();

  // Center above the button
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

  // Prevent going off-screen (left/right edges)
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }

  // If tooltip would go above viewport, show below instead
  if (top < 10) {
    top = rect.bottom + 8;
  }

  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.left = `${left}px`;
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
  }
}
