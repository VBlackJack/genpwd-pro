/**
 * @fileoverview TOTP QR Modal Template
 * Modal for displaying TOTP QR codes
 */

import { escapeHtml } from '../utils/formatter.js';
import { generateQRCodeSVG } from '../../utils/qrcode.js';

/**
 * Build OTPAuth URI
 * @param {string} secret - TOTP secret
 * @param {string} issuer - Service name
 * @param {string} account - Account identifier
 * @returns {string} OTPAuth URI
 */
function buildOTPAuthURI(secret, issuer, account) {
  const label = issuer
    ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account || 'user')}`
    : encodeURIComponent(account || 'user');

  return `otpauth://totp/${label}?secret=${secret.toUpperCase().replace(/\s/g, '')}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Show TOTP QR code modal
 * @param {Object} options
 * @param {string} options.secret - TOTP secret
 * @param {string} options.issuer - Service name
 * @param {string} options.account - Account identifier
 * @param {Function} options.onClose - Called when modal is closed
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} Modal element
 */
export function showTOTPQRModal(options = {}) {
  const { secret, issuer, account, onClose, t = (k) => k } = options;

  // Build otpauth URI and generate QR
  const uri = buildOTPAuthURI(secret, issuer, account);
  const qrSvg = generateQRCodeSVG(uri, { size: 200 });

  // Create or reuse modal
  let modal = document.getElementById('totp-qr-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'totp-qr-modal';
    modal.className = 'vault-modal-overlay';
    modal.role = 'dialog';
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="vault-modal vault-modal-sm">
      <div class="vault-modal-header">
        <h3>${t('vault.totp.qrTitle') || 'TOTP QR Code'}</h3>
        <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body vault-qr-body">
        <div class="vault-qr-container">
          ${qrSvg}
        </div>
        <div class="vault-qr-info">
          <div class="vault-qr-label">${escapeHtml(issuer)}</div>
          <div class="vault-qr-account">${escapeHtml(account || 'user')}</div>
        </div>
        <p class="vault-qr-hint">${t('vault.totp.scanHint') || 'Scan with your authenticator app (Google Authenticator, Authy, etc.)'}</p>
      </div>
    </div>
  `;

  // Close handler
  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (onClose) onClose();
  };

  // Bind close events
  modal.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  return modal;
}
