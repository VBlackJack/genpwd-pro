/**
 * GenPwd Pro - Interactive Onboarding
 * Uses a lightweight custom implementation (no external dependencies)
 *
 * @author Julien Bombled
 * @license MIT
 */

import { showConfirm } from './modal-manager.js';
import { t } from '../utils/i18n.js';

export class Onboarding {
  constructor() {
    this.currentStep = 0;
    this.tours = null; // Initialized lazily to allow i18n loading
  }

  /**
   * Get tours with translated content (lazy initialization)
   * @returns {Object} Tours configuration
   */
  getTours() {
    if (this.tours) return this.tours;

    this.tours = {
      main: [
        {
          id: 'welcome',
          title: t('onboarding.main.welcome.title'),
          text: t('onboarding.main.welcome.text'),
          attachTo: null,
          buttons: [
            {
              text: t('onboarding.buttons.skipTour'),
              action: () => this.completeTour(),
              secondary: true
            },
            {
              text: t('onboarding.buttons.startTour'),
              action: () => this.next()
            }
          ]
        },
        {
          id: 'generator',
          title: t('onboarding.main.generator.title'),
          text: t('onboarding.main.generator.text'),
          attachTo: '#mode-select',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'length',
          title: t('onboarding.main.length.title'),
          text: t('onboarding.main.length.text'),
          attachTo: '#syll-len',
          position: 'top',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'options',
          title: t('onboarding.main.options.title'),
          text: t('onboarding.main.options.text'),
          attachTo: '#section-params-content',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'generate',
          title: t('onboarding.main.generate.title'),
          text: t('onboarding.main.generate.text'),
          attachTo: '#btn-generate',
          position: 'top',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'results',
          title: t('onboarding.main.results.title'),
          text: t('onboarding.main.results.text'),
          attachTo: '#results-list',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'vault',
          title: t('onboarding.main.vault.title'),
          text: t('onboarding.main.vault.text'),
          attachTo: '#vault-status-indicator',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'about',
          title: t('onboarding.main.about.title'),
          text: t('onboarding.main.about.text'),
          attachTo: '#btn-about',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.finish'), action: () => this.completeTour() }
          ]
        },
        {
          id: 'complete',
          title: t('onboarding.main.complete.title'),
          text: t('onboarding.main.complete.text'),
          attachTo: null,
          buttons: [
            {
              text: t('onboarding.buttons.startUsing'),
              action: () => this.completeTour()
            }
          ]
        }
      ],
      vault: [
        {
          id: 'vault-intro',
          title: t('onboarding.vault.intro.title'),
          text: t('onboarding.vault.intro.text'),
          attachTo: null,
          buttons: [
            { text: t('onboarding.buttons.skip'), action: () => this.completeTour(), secondary: true },
            { text: t('onboarding.buttons.start'), action: () => this.next() }
          ]
        },
        {
          id: 'add-password',
          title: t('onboarding.vault.addPassword.title'),
          text: t('onboarding.vault.addPassword.text'),
          attachTo: '.vault-add-btn',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'search',
          title: t('onboarding.vault.search.title'),
          text: t('onboarding.vault.search.text'),
          attachTo: '.vault-search-input',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.next'), action: () => this.next() }
          ]
        },
        {
          id: 'export',
          title: t('onboarding.vault.export.title'),
          text: t('onboarding.vault.export.text'),
          attachTo: '.vault-import-btn',
          position: 'bottom',
          buttons: [
            { text: t('onboarding.buttons.back'), action: () => this.prev(), secondary: true },
            { text: t('onboarding.buttons.finish'), action: () => this.completeTour() }
          ]
        }
      ]
    };

    return this.tours;
  }

  /**
   * Start a tour
   * @param {string} tourName - Name of the tour ('main' or 'vault')
   */
  start(tourName = 'main') {
    // Check if user has completed this tour before
    if (this.hasCompletedTour(tourName)) {
      return;
    }

    this.activeTour = tourName;
    this.currentStep = 0;
    this.overlay = null;
    this.tooltipElement = null;

    // Create overlay and tooltip
    this.createOverlay();
    this.showStep(0);
  }

  /**
   * Show a specific step
   * @param {number} stepIndex
   */
  showStep(stepIndex) {
    if (!this.activeTour) return;

    const tours = this.getTours();
    const steps = tours[this.activeTour];
    if (stepIndex < 0 || stepIndex >= steps.length) return;

    this.currentStep = stepIndex;
    const step = steps[stepIndex];

    // Remove existing tooltip
    if (this.tooltipElement) {
      this.tooltipElement.remove();
    }

    // Create tooltip
    this.tooltipElement = this.createTooltip(step);

    // Position tooltip
    if (step.attachTo) {
      this.positionTooltip(step.attachTo, step.position || 'bottom');
      this.highlightElement(step.attachTo);
    } else {
      // Center tooltip
      this.centerTooltip();
    }

    // Add to DOM
    document.body.appendChild(this.tooltipElement);
  }

  /**
   * Go to next step
   */
  next() {
    this.showStep(this.currentStep + 1);
  }

  /**
   * Go to previous step
   */
  prev() {
    this.showStep(this.currentStep - 1);
  }

  /**
   * Complete tour and mark as done
   */
  completeTour() {
    if (this.activeTour) {
      this.markTourCompleted(this.activeTour);
    }

    // Remove overlay and tooltip
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }

    this.activeTour = null;
    this.currentStep = 0;
  }

  /**
   * Create overlay
   */
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'onboarding-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 9998;
      backdrop-filter: blur(2px);
    `;

    // Click overlay to skip tour
    this.overlay.addEventListener('click', async () => {
      const confirmed = await showConfirm('Skip the tour?', {
        title: 'Skip Tour',
        confirmLabel: 'Skip',
        cancelLabel: 'Continue'
      });
      if (confirmed) {
        this.completeTour();
      }
    });

    document.body.appendChild(this.overlay);
  }

  /**
   * Create tooltip element
   * @param {Object} step
   * @returns {HTMLElement}
   */
  createTooltip(step) {
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      max-width: 400px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      padding: 24px;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = step.title;
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    `;

    // Text
    const text = document.createElement('p');
    text.innerHTML = step.text;
    text.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #4a4a4a;
    `;

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;

    // Create buttons
    step.buttons.forEach((buttonConfig) => {
      const button = document.createElement('button');
      button.textContent = buttonConfig.text;
      button.addEventListener('click', buttonConfig.action);

      if (buttonConfig.secondary) {
        button.style.cssText = `
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: white;
          color: #4a4a4a;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        `;

        button.onmouseenter = () => {
          button.style.background = '#f5f5f5';
        };
        button.onmouseleave = () => {
          button.style.background = 'white';
        };
      } else {
        button.style.cssText = `
          padding: 10px 20px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        `;

        button.onmouseenter = () => {
          button.style.transform = 'translateY(-2px)';
          button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        };
        button.onmouseleave = () => {
          button.style.transform = 'translateY(0)';
          button.style.boxShadow = 'none';
        };
      }

      buttonsContainer.appendChild(button);
    });

    // Progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = `
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
      text-align: center;
    `;
    const tours = this.getTours();
    progress.textContent = `${t('onboarding.progress.step')} ${this.currentStep + 1} ${t('onboarding.progress.of')} ${
      tours[this.activeTour].length
    }`;

    tooltip.appendChild(title);
    tooltip.appendChild(text);
    tooltip.appendChild(buttonsContainer);
    tooltip.appendChild(progress);

    return tooltip;
  }

  /**
   * Position tooltip relative to target element
   * @param {string} selector
   * @param {string} position
   */
  positionTooltip(selector, position = 'bottom') {
    const target = document.querySelector(selector);
    if (!target || !this.tooltipElement) return;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 20;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;

      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;

      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - 20;
        break;

      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.right + 20;
        break;

      default:
        top = targetRect.bottom + 20;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    }

    // Ensure tooltip is within viewport
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  /**
   * Center tooltip in viewport
   */
  centerTooltip() {
    if (!this.tooltipElement) return;

    this.tooltipElement.style.top = '50%';
    this.tooltipElement.style.left = '50%';
    this.tooltipElement.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Highlight target element
   * @param {string} selector
   */
  highlightElement(selector) {
    const target = document.querySelector(selector);
    if (!target) return;

    // Remove existing highlights
    document.querySelectorAll('.onboarding-highlight').forEach((el) => {
      el.classList.remove('onboarding-highlight');
    });

    // Add highlight
    target.classList.add('onboarding-highlight');
    target.style.position = 'relative';
    target.style.zIndex = '10000';
  }

  /**
   * Check if user has completed a tour
   * @param {string} tourName
   * @returns {boolean}
   */
  hasCompletedTour(tourName) {
    const completed = localStorage.getItem(`onboarding_${tourName}_completed`);
    return completed === 'true';
  }

  /**
   * Mark tour as completed
   * @param {string} tourName
   */
  markTourCompleted(tourName) {
    localStorage.setItem(`onboarding_${tourName}_completed`, 'true');
  }

  /**
   * Reset all tours (for testing)
   */
  resetTours() {
    const tours = this.getTours();
    Object.keys(tours).forEach((tourName) => {
      localStorage.removeItem(`onboarding_${tourName}_completed`);
    });
  }
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .onboarding-highlight {
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.5), 0 0 0 8px rgba(102, 126, 234, 0.3);
    border-radius: 8px;
    transition: all 0.3s ease;
  }
`;
document.head.appendChild(style);

// Export singleton instance
export const onboarding = new Onboarding();

// Auto-start main tour on first visit
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Wait 1 second to let page fully load
    setTimeout(() => {
      if (!onboarding.hasCompletedTour('main')) {
        onboarding.start('main');
      }
    }, 1000);
  });
}
