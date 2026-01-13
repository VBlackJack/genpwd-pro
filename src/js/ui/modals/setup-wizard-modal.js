/*
 * Copyright 2026 Julien Bombled
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
 * @fileoverview Setup Wizard Modal
 * Guides first-time users through vault setup with step-by-step instructions
 */

import { Modal } from './modal.js';
import { t } from '../../utils/i18n.js';
import { applyQuickPreset, QUICK_PRESETS } from '../components/quick-presets.js';

const STORAGE_KEY = 'genpwd-setup-completed';

/**
 * Setup Wizard Modal - Onboarding experience for first-time users
 */
export class SetupWizardModal extends Modal {
  #currentStep = 0;
  #totalSteps = 5;
  #onComplete = null;
  #selectedPreset = 'strong'; // BMAD: Default preset

  constructor() {
    super('setup-wizard-modal');
  }

  get template() {
    return `
      <div class="vault-modal-header setup-wizard-header">
        <div class="setup-wizard-progress">
          <div class="progress-steps" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="${this.#totalSteps}">
            ${this.#renderProgressSteps()}
          </div>
        </div>
        <button type="button" class="vault-modal-close" data-action="close" aria-label="${t('common.close')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body setup-wizard-body">
        <div id="setup-wizard-content">
          ${this.#renderStep(0)}
        </div>
      </div>
      <div class="vault-modal-footer setup-wizard-footer">
        <button type="button" class="vault-btn vault-btn-ghost" id="setup-wizard-skip">
          ${t('setupWizard.skip')}
        </button>
        <div class="setup-wizard-nav">
          <button type="button" class="vault-btn vault-btn-secondary" id="setup-wizard-back" disabled>
            ${t('setupWizard.back')}
          </button>
          <button type="button" class="vault-btn vault-btn-primary" id="setup-wizard-next">
            ${t('setupWizard.next')}
          </button>
        </div>
      </div>
    `;
  }

  #renderProgressSteps() {
    return Array.from({ length: this.#totalSteps }, (_, i) => `
      <div class="progress-step ${i === 0 ? 'active' : ''} ${i < this.#currentStep ? 'completed' : ''}" data-step="${i}">
        <span class="step-number">${i + 1}</span>
      </div>
    `).join('<div class="progress-line"></div>');
  }

  #renderStep(step) {
    const steps = [
      this.#renderWelcomeStep(),
      this.#renderSecurityStep(),
      this.#renderFeaturesStep(),
      this.#renderPresetsStep(),
      this.#renderReadyStep()
    ];
    return steps[step] || steps[0];
  }

  #renderWelcomeStep() {
    return `
      <div class="setup-step setup-step-welcome">
        <div class="setup-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <h2 class="setup-title">${t('setupWizard.welcome.title')}</h2>
        <p class="setup-description">${t('setupWizard.welcome.description')}</p>
        <ul class="setup-features-list">
          <li>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ${t('setupWizard.welcome.feature1')}
          </li>
          <li>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ${t('setupWizard.welcome.feature2')}
          </li>
          <li>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ${t('setupWizard.welcome.feature3')}
          </li>
        </ul>
      </div>
    `;
  }

  #renderSecurityStep() {
    return `
      <div class="setup-step setup-step-security">
        <div class="setup-icon setup-icon-security">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 class="setup-title">${t('setupWizard.security.title')}</h2>
        <p class="setup-description">${t('setupWizard.security.description')}</p>
        <div class="setup-info-cards">
          <div class="setup-info-card">
            <h4>${t('setupWizard.security.encryption')}</h4>
            <p>${t('setupWizard.security.encryptionDesc')}</p>
          </div>
          <div class="setup-info-card">
            <h4>${t('setupWizard.security.masterPassword')}</h4>
            <p>${t('setupWizard.security.masterPasswordDesc')}</p>
          </div>
          <div class="setup-info-card">
            <h4>${t('setupWizard.security.zeroKnowledge')}</h4>
            <p>${t('setupWizard.security.zeroKnowledgeDesc')}</p>
          </div>
        </div>
      </div>
    `;
  }

  #renderFeaturesStep() {
    return `
      <div class="setup-step setup-step-features">
        <div class="setup-icon setup-icon-features">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h2 class="setup-title">${t('setupWizard.features.title')}</h2>
        <p class="setup-description">${t('setupWizard.features.description')}</p>
        <div class="setup-features-grid">
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <span>${t('setupWizard.features.organization')}</span>
          </div>
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>${t('setupWizard.features.import')}</span>
          </div>
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <span>${t('setupWizard.features.generator')}</span>
          </div>
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>${t('setupWizard.features.audit')}</span>
          </div>
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span>${t('setupWizard.features.autofill')}</span>
          </div>
          <div class="setup-feature">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>${t('setupWizard.features.customization')}</span>
          </div>
        </div>
      </div>
    `;
  }

  #renderPresetsStep() {
    return `
      <div class="setup-step setup-step-presets">
        <div class="setup-icon setup-icon-presets">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M13 6l-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3 1.5 3 3 1.5-3 1.5z" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <h2 class="setup-title">${t('setupWizard.presets.title')}</h2>
        <p class="setup-description">${t('setupWizard.presets.description')}</p>
        <div class="setup-presets-grid">
          <button type="button" class="setup-preset-card ${this.#selectedPreset === 'strong' ? 'selected' : ''}" data-preset="strong">
            <span class="preset-icon">${QUICK_PRESETS.strong.icon}</span>
            <span class="preset-name">${t('quickPresets.strong')}</span>
            <span class="preset-desc">${t('quickPresets.strongDesc')}</span>
          </button>
          <button type="button" class="setup-preset-card ${this.#selectedPreset === 'simple' ? 'selected' : ''}" data-preset="simple">
            <span class="preset-icon">${QUICK_PRESETS.simple.icon}</span>
            <span class="preset-name">${t('quickPresets.simple')}</span>
            <span class="preset-desc">${t('quickPresets.simpleDesc')}</span>
          </button>
          <button type="button" class="setup-preset-card ${this.#selectedPreset === 'maximum' ? 'selected' : ''}" data-preset="maximum">
            <span class="preset-icon">${QUICK_PRESETS.maximum.icon}</span>
            <span class="preset-name">${t('quickPresets.maximum')}</span>
            <span class="preset-desc">${t('quickPresets.maximumDesc')}</span>
          </button>
        </div>
      </div>
    `;
  }

  #renderReadyStep() {
    return `
      <div class="setup-step setup-step-ready">
        <div class="setup-icon setup-icon-ready">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 class="setup-title">${t('setupWizard.ready.title')}</h2>
        <p class="setup-description">${t('setupWizard.ready.description')}</p>
        <div class="setup-cta">
          <button type="button" class="vault-btn vault-btn-primary vault-btn-lg" id="setup-create-vault">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            ${t('setupWizard.ready.createVault')}
          </button>
          <p class="setup-hint">${t('setupWizard.ready.hint')}</p>
        </div>
      </div>
    `;
  }

  /**
   * Check if setup wizard should be shown (first-time user)
   * @returns {boolean}
   */
  shouldShow() {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Mark setup as completed
   */
  markCompleted() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage not available
    }
  }

  /**
   * Show the wizard
   * @param {Function} [onComplete] - Callback when wizard completes
   */
  show(onComplete) {
    this.#onComplete = onComplete;
    this.#currentStep = 0;
    super.show();
    this.#updateContent();
    this.#bindEvents();
  }

  #bindEvents() {
    const modal = this.element;
    if (!modal) return;

    const nextBtn = modal.querySelector('#setup-wizard-next');
    const backBtn = modal.querySelector('#setup-wizard-back');
    const skipBtn = modal.querySelector('#setup-wizard-skip');
    const createBtn = modal.querySelector('#setup-create-vault');

    nextBtn?.addEventListener('click', () => this.#nextStep());
    backBtn?.addEventListener('click', () => this.#prevStep());
    skipBtn?.addEventListener('click', () => this.#skip());
    createBtn?.addEventListener('click', () => this.#complete());
  }

  #nextStep() {
    if (this.#currentStep < this.#totalSteps - 1) {
      this.#currentStep++;
      this.#updateContent();
    }
  }

  #prevStep() {
    if (this.#currentStep > 0) {
      this.#currentStep--;
      this.#updateContent();
    }
  }

  #updateContent() {
    const content = document.getElementById('setup-wizard-content');
    const nextBtn = document.getElementById('setup-wizard-next');
    const backBtn = document.getElementById('setup-wizard-back');
    const progress = this.element?.querySelector('.progress-steps');

    if (content) {
      content.innerHTML = this.#renderStep(this.#currentStep);
      // Rebind create vault button on last step
      if (this.#currentStep === this.#totalSteps - 1) {
        const createBtn = content.querySelector('#setup-create-vault');
        createBtn?.addEventListener('click', () => this.#complete());
      }
      // Bind preset card selection on presets step (step 3)
      if (this.#currentStep === 3) {
        this.#bindPresetCards();
      }
    }

    if (nextBtn) {
      nextBtn.textContent = this.#currentStep === this.#totalSteps - 1
        ? t('setupWizard.finish')
        : t('setupWizard.next');
      nextBtn.hidden = this.#currentStep === this.#totalSteps - 1;
    }

    if (backBtn) {
      backBtn.disabled = this.#currentStep === 0;
    }

    if (progress) {
      progress.setAttribute('aria-valuenow', String(this.#currentStep + 1));
      progress.querySelectorAll('.progress-step').forEach((step, i) => {
        step.classList.toggle('active', i === this.#currentStep);
        step.classList.toggle('completed', i < this.#currentStep);
      });
    }
  }

  #bindPresetCards() {
    const cards = this.element?.querySelectorAll('.setup-preset-card');
    cards?.forEach(card => {
      card.addEventListener('click', () => {
        // Remove selection from all cards
        cards.forEach(c => c.classList.remove('selected'));
        // Select clicked card
        card.classList.add('selected');
        // Store selection
        this.#selectedPreset = card.dataset.preset;
      });
    });
  }

  #skip() {
    this.markCompleted();
    this.hide();
  }

  #complete() {
    this.markCompleted();
    this.hide();

    // Apply selected preset - BMAD UX
    if (this.#selectedPreset) {
      applyQuickPreset(this.#selectedPreset, { silent: true });
    }

    if (typeof this.#onComplete === 'function') {
      this.#onComplete();
    }
  }

  /**
   * Check and show if needed (call on app startup)
   * @param {Function} [onComplete] - Callback when wizard completes
   * @returns {boolean} Whether the modal was shown
   */
  checkAndShow(onComplete) {
    if (this.shouldShow()) {
      this.show(onComplete);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const setupWizardModal = new SetupWizardModal();
