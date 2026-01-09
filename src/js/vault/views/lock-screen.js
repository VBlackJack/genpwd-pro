/**
 * @fileoverview Lock Screen View
 * Renders the vault lock/unlock screen
 */

/**
 * Render the lock screen HTML
 * @param {Object} options
 * @param {Function} options.t - Translation function
 * @returns {string} Lock screen HTML
 */
export function renderLockScreen({ t = (k) => k } = {}) {
  return `
    <div class="vault-lock-screen">
      <div class="vault-lock-content">
        <div class="vault-lock-icon">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            <circle cx="12" cy="16" r="1"></circle>
          </svg>
        </div>
        <h2>${t('vault.lockScreen.title')}</h2>
        <p class="vault-lock-subtitle">${t('vault.lockScreen.subtitle')}</p>

        <div class="vault-selector" id="vault-selector" role="listbox" aria-label="${t('vault.aria.vaultSelection')}">
          <div class="vault-loading"><div class="vault-spinner"></div></div>
        </div>

        <form class="vault-unlock-form" id="unlock-form">
          <div class="vault-input-group">
            <input type="password" class="vault-input" id="vault-password"
                   placeholder="${t('vault.lockScreen.masterPassword')}" autocomplete="current-password"
                   aria-label="${t('vault.lockScreen.masterPassword')}" aria-required="true">
            <button type="button" class="vault-input-btn" id="toggle-password"
                    title="${t('vault.lockScreen.showHide')}" aria-label="${t('vault.lockScreen.showHide')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          <button type="submit" class="vault-btn vault-btn-primary vault-btn-full" id="btn-unlock">
            <svg class="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
            <svg class="btn-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" hidden>
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" stroke-linecap="round"/>
            </svg>
            <span class="btn-text">${t('vault.lockScreen.unlock')}</span>
          </button>
          <div class="vault-unlock-progress" id="unlock-progress" hidden>
            <div class="vault-progress-bar"><div class="vault-progress-fill"></div></div>
            <span class="vault-progress-text">${t('vault.lockScreen.derivingKey')}</span>
          </div>
        </form>

        <!-- Windows Hello Button (shown when available) -->
        <div class="vault-hello-section" id="hello-section" hidden>
          <div class="vault-hello-divider">
            <span>${t('vault.lockScreen.or')}</span>
          </div>
          <button type="button" class="vault-btn vault-btn-hello" id="btn-hello-unlock">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <circle cx="8.5" cy="10" r="1.5"/>
              <circle cx="15.5" cy="10" r="1.5"/>
              <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
            </svg>
            <span>Windows Hello</span>
          </button>
        </div>

        <div class="vault-lock-actions">
          <button type="button" class="vault-link-btn" id="btn-create-vault">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            ${t('vault.lockScreen.newVault')}
          </button>
          <span class="vault-action-divider">|</span>
          <button type="button" class="vault-link-btn" id="btn-open-external">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            ${t('vault.lockScreen.openFile')}
          </button>
        </div>
      </div>
    </div>
  `;
}
