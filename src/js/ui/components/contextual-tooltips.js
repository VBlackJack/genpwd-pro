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
 * Contextual Tooltips Component - BMAD UX Improvement
 * Provides rich explanatory tooltips for technical jargon.
 */

import { t } from '../../utils/i18n.js';

/**
 * Tooltip content keys mapped to i18n keys
 */
const TOOLTIP_KEYS = {
  entropy: 'tooltips.entropy',
  policy: 'tooltips.policy',
  leet: 'tooltips.leet',
  syllables: 'tooltips.syllables',
  passphrase: 'tooltips.passphrase',
  blocks: 'tooltips.blocks',
  configProfiles: 'tooltips.configProfiles',
  apiKeyPreset: 'tooltips.apiKeyPreset',
  bankingPreset: 'tooltips.bankingPreset',
  usageStats: 'tooltips.usageStats'
};

/**
 * Tooltip titles for display
 */
const TOOLTIP_TITLES = {
  entropy: 'Entropy',
  policy: 'Policy',
  leet: 'Leet Speak',
  syllables: 'Syllables Mode',
  passphrase: 'Passphrase Mode',
  blocks: 'Block Case',
  configProfiles: 'Configuration Profiles',
  apiKeyPreset: 'API Key Preset',
  bankingPreset: 'Banking Preset',
  usageStats: 'Usage Statistics'
};

let tooltipElement = null;
let showTimeout = null;
let hideTimeout = null;

const SHOW_DELAY = 500;
const HIDE_DELAY = 200;

/**
 * Create the tooltip element if it doesn't exist
 */
function ensureTooltipElement() {
  if (tooltipElement) return tooltipElement;

  tooltipElement = document.createElement('div');
  tooltipElement.className = 'contextual-tooltip';
  tooltipElement.setAttribute('role', 'tooltip');
  tooltipElement.setAttribute('aria-hidden', 'true');

  tooltipElement.innerHTML = `
    <div class="contextual-tooltip-title"></div>
    <div class="contextual-tooltip-content"></div>
  `;

  document.body.appendChild(tooltipElement);

  // Hide on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  });

  return tooltipElement;
}

/**
 * Show tooltip for a given element
 * @param {HTMLElement} target - The trigger element
 * @param {string} key - The tooltip key from TOOLTIP_KEYS
 */
function showTooltip(target, key) {
  if (!TOOLTIP_KEYS[key]) return;

  clearTimeout(hideTimeout);
  clearTimeout(showTimeout);

  showTimeout = setTimeout(() => {
    const tooltip = ensureTooltipElement();
    // Update content
    const title = TOOLTIP_TITLES[key] || key;
    const content = t(TOOLTIP_KEYS[key]);

    tooltip.querySelector('.contextual-tooltip-title').textContent = title;
    tooltip.querySelector('.contextual-tooltip-content').textContent = content;

    // Position tooltip
    positionTooltip(tooltip, target);

    // Show
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
  }, SHOW_DELAY);
}

/**
 * Hide the tooltip
 */
function hideTooltip() {
  clearTimeout(showTimeout);
  clearTimeout(hideTimeout);

  hideTimeout = setTimeout(() => {
    if (tooltipElement) {
      tooltipElement.classList.remove('visible');
      tooltipElement.setAttribute('aria-hidden', 'true');
    }
  }, HIDE_DELAY);
}

/**
 * Position the tooltip relative to the target
 * @param {HTMLElement} tooltip - The tooltip element
 * @param {HTMLElement} target - The trigger element
 */
function positionTooltip(tooltip, target) {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // Default: position below the target
  let top = targetRect.bottom + 8;
  let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

  // Prevent off-screen positioning
  const padding = 16;

  // Check right edge
  if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding;
  }

  // Check left edge
  if (left < padding) {
    left = padding;
  }

  // Check bottom edge - if not enough space, show above
  if (top + tooltipRect.height > window.innerHeight - padding) {
    top = targetRect.top - tooltipRect.height - 8;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

/**
 * Initialize contextual tooltips
 * Finds elements with data-tooltip-key attribute and binds events
 */
export function initContextualTooltips() {
  // Find all elements with tooltip triggers
  const triggers = document.querySelectorAll('[data-tooltip-key]');

  triggers.forEach(trigger => {
    const key = trigger.dataset.tooltipKey;

    // Mouse events
    trigger.addEventListener('mouseenter', () => showTooltip(trigger, key));
    trigger.addEventListener('mouseleave', () => hideTooltip());

    // Focus events for keyboard accessibility
    trigger.addEventListener('focus', () => showTooltip(trigger, key));
    trigger.addEventListener('blur', () => hideTooltip());

    // Add help cursor and visual hint
    trigger.classList.add('tooltip-trigger');
    trigger.setAttribute('tabindex', trigger.getAttribute('tabindex') || '0');
  });
}

/**
 * Add tooltip to an element programmatically
 * @param {HTMLElement} element - The element to add tooltip to
 * @param {string} key - The tooltip key
 */
export function addTooltip(element, key) {
  if (!element || !TOOLTIP_KEYS[key]) return;

  element.dataset.tooltipKey = key;
  element.classList.add('tooltip-trigger');
  element.setAttribute('tabindex', element.getAttribute('tabindex') || '0');

  element.addEventListener('mouseenter', () => showTooltip(element, key));
  element.addEventListener('mouseleave', () => hideTooltip());
  element.addEventListener('focus', () => showTooltip(element, key));
  element.addEventListener('blur', () => hideTooltip());
}

/**
 * Cleanup tooltip resources
 */
export function cleanupContextualTooltips() {
  clearTimeout(showTimeout);
  clearTimeout(hideTimeout);

  if (tooltipElement && tooltipElement.parentNode) {
    tooltipElement.parentNode.removeChild(tooltipElement);
    tooltipElement = null;
  }
}

export default {
  initContextualTooltips,
  addTooltip,
  cleanupContextualTooltips
};
