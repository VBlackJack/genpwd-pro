/**
 * GenPwd Pro - Interactive Onboarding
 * Uses a lightweight custom implementation (no external dependencies)
 *
 * @author Julien Bombled
 * @license MIT
 */

import { sanitizeHTML } from '../utils/dom-sanitizer.js';

export class Onboarding {
  constructor() {
    this.currentStep = 0;
    this.tours = {
      main: [
        {
          id: 'welcome',
          title: '👋 Welcome to GenPwd Pro!',
          text: 'Generate secure, memorable passwords in seconds. Let me show you around!',
          attachTo: null,
          buttons: [
            {
              text: 'Skip Tour',
              action: () => this.completeTour(),
              secondary: true
            },
            {
              text: 'Start Tour',
              action: () => this.next()
            }
          ]
        },
        {
          id: 'generator',
          title: '🔐 Password Generator',
          text: 'Choose from three modes: <strong>Syllables</strong> (pronounceable), <strong>Passphrase</strong> (Diceware-style), or <strong>Leet</strong> speak.',
          attachTo: '#mode-select',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'length',
          title: '📏 Customize Length',
          text: 'Adjust password length or word count. We recommend <strong>16+ characters</strong> or <strong>5+ words</strong> for strong security.',
          attachTo: '#length-slider',
          position: 'top',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'options',
          title: '⚙️ Password Options',
          text: 'Add <strong>numbers</strong>, <strong>special characters</strong>, or change case. More complexity = stronger password!',
          attachTo: '#password-options',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'generate',
          title: '✨ Generate!',
          text: 'Click <strong>Generate</strong> to create your password. It\'s automatically copied to clipboard for 30 seconds.',
          attachTo: '#generate-button',
          position: 'top',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'entropy',
          title: '📊 Password Strength',
          text: 'Check your password\'s <strong>entropy</strong> (randomness). Higher is better! Aim for 60+ bits.',
          attachTo: '#entropy-display',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'vault',
          title: '🗄️ Vault Storage',
          text: 'Save passwords securely in your encrypted <strong>Vault</strong>. AES-256-GCM encryption, Argon2id key derivation.',
          attachTo: '#vault-button',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'settings',
          title: '⚙️ Settings & Features',
          text: 'Explore more features: <strong>Cloud Sync</strong>, <strong>Import/Export</strong>, <strong>TOTP 2FA</strong>, and <strong>Dark Mode</strong>!',
          attachTo: '#settings-button',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Finish', action: () => this.completeTour() }
          ]
        },
        {
          id: 'complete',
          title: '🎉 You\'re All Set!',
          text: 'You\'re ready to generate secure passwords. Need help? Check the <strong>Help</strong> section or visit our <a href="https://github.com/VBlackJack/genpwd-pro" target="_blank">GitHub</a>.',
          attachTo: null,
          buttons: [
            {
              text: 'Start Using GenPwd Pro',
              action: () => this.completeTour()
            }
          ]
        }
      ],
      vault: [
        {
          id: 'vault-intro',
          title: '🗄️ Vault Tour',
          text: 'Store passwords securely in your encrypted vault. Let\'s explore!',
          attachTo: null,
          buttons: [
            { text: 'Skip', action: () => this.completeTour(), secondary: true },
            { text: 'Start', action: () => this.next() }
          ]
        },
        {
          id: 'add-password',
          title: '➕ Add Password',
          text: 'Click here to add a new password entry to your vault.',
          attachTo: '#add-password-button',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'search',
          title: '🔍 Search & Filter',
          text: 'Quickly find passwords by name, website, or category.',
          attachTo: '#vault-search',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Next', action: () => this.next() }
          ]
        },
        {
          id: 'export',
          title: '📤 Import/Export',
          text: 'Export to JSON, CSV, or KDBX. Import from 1Password, LastPass, KeePass.',
          attachTo: '#export-button',
          position: 'bottom',
          buttons: [
            { text: 'Back', action: () => this.prev(), secondary: true },
            { text: 'Finish', action: () => this.completeTour() }
          ]
        }
      ]
    };

    this.activeTour = null;
    this.overlay = null;
    this.tooltipElement = null;
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

    const steps = this.tours[this.activeTour];
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
    this.overlay.addEventListener('click', () => {
      if (confirm('Skip the tour?')) {
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
      button.onclick = buttonConfig.action;

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
    progress.textContent = `Step ${this.currentStep + 1} of ${
      this.tours[this.activeTour].length
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
    Object.keys(this.tours).forEach((tourName) => {
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
