/**
 * @fileoverview Vault Management Modals
 * Create and open external vault modals
 */

/**
 * Render the create vault modal
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} Modal HTML
 */
export function renderCreateVaultModal({ t = (k) => k } = {}) {
  return `
    <div class="vault-modal-overlay" id="create-vault-modal" role="dialog" aria-modal="true" aria-labelledby="create-vault-title">
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3 id="create-vault-title">New Vault</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form class="vault-modal-body" id="create-vault-form">
          <div class="vault-form-group">
            <label class="vault-label" for="new-vault-name">${t('vault.createModal.vaultName')} <span class="required" aria-label="${t('vault.form.required')}">*</span></label>
            <input type="text" class="vault-input" id="new-vault-name" placeholder="${t('vault.createModal.vaultNamePlaceholder')}" required aria-required="true" aria-describedby="vault-name-message" aria-invalid="false">
            <div class="vault-field-message" id="vault-name-message" role="alert" aria-live="polite"></div>
          </div>

          <!-- Location selector -->
          <fieldset class="vault-form-group vault-fieldset">
            <legend class="vault-label">${t('vault.createModal.location')}</legend>
            <div class="vault-location-options" role="radiogroup" aria-label="${t('vault.createModal.locationAria')}">
              <label class="vault-radio-option">
                <input type="radio" name="vault-location-type" value="default" checked>
                <span class="vault-radio-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  ${t('vault.createModal.defaultFolder')}
                </span>
              </label>
              <label class="vault-radio-option">
                <input type="radio" name="vault-location-type" value="custom">
                <span class="vault-radio-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  ${t('vault.createModal.chooseLocation')}
                </span>
              </label>
            </div>
            <div class="vault-custom-location" id="custom-location-section" hidden>
              <button type="button" class="vault-btn vault-btn-outline vault-btn-sm" id="btn-choose-location">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                ${t('vault.createModal.browse')}
              </button>
              <div class="vault-location-path" id="create-vault-location" hidden></div>
            </div>
          </fieldset>

          <div class="vault-form-group">
            <label class="vault-label" for="new-vault-password">${t('vault.createModal.masterPassword')} <span class="required" aria-label="${t('vault.form.required')}">*</span></label>
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="new-vault-password"
                     placeholder="${t('vault.createModal.passwordPlaceholder')}" required aria-required="true" minlength="12" aria-describedby="vault-password-message" aria-invalid="false">
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="new-vault-password" aria-label="${t('vault.lockScreen.showHide')}" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
            <div class="vault-password-strength" id="new-password-strength"></div>
            <div class="vault-field-message" id="vault-password-message" role="alert" aria-live="polite"></div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="new-vault-confirm">${t('vault.createModal.confirmPassword')} <span class="required" aria-label="${t('vault.form.required')}">*</span></label>
            <input type="password" class="vault-input" id="new-vault-confirm" placeholder="${t('vault.createModal.confirmPlaceholder')}" required aria-required="true" aria-describedby="vault-confirm-message" aria-invalid="false">
            <div class="vault-field-message" id="vault-confirm-message" role="alert" aria-live="polite"></div>
          </div>

          <!-- Windows Hello option (shown only if available) -->
          <div class="vault-form-group vault-hello-option" id="create-hello-option" hidden>
            <label class="vault-checkbox-option">
              <input type="checkbox" id="new-vault-hello">
              <span class="vault-checkbox-label">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <circle cx="8.5" cy="10" r="1.5"/>
                  <circle cx="15.5" cy="10" r="1.5"/>
                  <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
                </svg>
                ${t('vault.createModal.enableHello')}
              </span>
              <span class="vault-checkbox-hint">${t('vault.createModal.helloHint')}</span>
            </label>
          </div>

          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="submit" class="vault-btn vault-btn-primary">${t('vault.actions.createVault')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Render the open external vault modal
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} Modal HTML
 */
export function renderOpenExternalModal({ t = (k) => k } = {}) {
  return `
    <div class="vault-modal-overlay" id="open-external-modal" role="dialog" aria-modal="true" aria-labelledby="open-external-title">
      <div class="vault-modal vault-modal-sm">
        <div class="vault-modal-header">
          <h3 id="open-external-title">${t('vault.actions.openVault')}</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form class="vault-modal-body" id="open-external-form">
          <div class="vault-form-group">
            <label class="vault-label">${t('vault.externalModal.file')}</label>
            <div class="vault-location-path" id="external-vault-path"></div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="external-vault-password">${t('vault.createModal.masterPassword')} <span class="required">*</span></label>
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="external-vault-password"
                     placeholder="${t('vault.externalModal.passwordPlaceholder')}" required autocomplete="current-password"
                     aria-label="${t('vault.labels.password')}" aria-required="true">
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="external-vault-password" aria-label="${t('vault.lockScreen.showHide')}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="submit" class="vault-btn vault-btn-primary">${t('vault.actions.open')}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
