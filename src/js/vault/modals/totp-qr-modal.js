/**
 * @fileoverview TOTP QR Modal Template
 * Modal for displaying TOTP QR codes
 */

import { escapeHtml } from '../utils/formatter.js';
import { generateQRCodeSVG } from '../../utils/qrcode.js';

/**
 * Sanitize SVG content using DOM-based parsing (more secure than regex)
 * Removes dangerous elements, attributes, and potential XSS vectors
 * @param {string} svgContent - Raw SVG string
 * @returns {string} Sanitized SVG string
 */
function sanitizeSVG(svgContent) {
  // Allowed SVG elements (whitelist approach)
  const ALLOWED_ELEMENTS = new Set([
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline',
    'polygon', 'text', 'tspan', 'defs', 'use', 'symbol', 'title', 'desc'
  ]);

  // Allowed attributes (whitelist approach)
  const ALLOWED_ATTRS = new Set([
    'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
    'd', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2',
    'points', 'transform', 'opacity', 'fill-opacity', 'stroke-opacity',
    'id', 'class', 'style', 'xmlns', 'version'
  ]);

  // Dangerous patterns in style attribute
  const DANGEROUS_STYLE_PATTERNS = /url\s*\(|expression\s*\(|javascript:|@import/gi;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('SVG parsing failed');
    }

    const svg = doc.documentElement;
    if (svg.tagName.toLowerCase() !== 'svg') {
      throw new Error('Invalid SVG root element');
    }

    // Recursive sanitization
    const sanitizeNode = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // Remove disallowed elements entirely
        if (!ALLOWED_ELEMENTS.has(tagName)) {
          node.remove();
          return;
        }

        // Remove disallowed and dangerous attributes
        const attrsToRemove = [];
        for (const attr of node.attributes) {
          const attrName = attr.name.toLowerCase();

          // Remove event handlers (on*)
          if (attrName.startsWith('on')) {
            attrsToRemove.push(attr.name);
            continue;
          }

          // Remove xlink:href with javascript:
          if (attrName === 'xlink:href' || attrName === 'href') {
            if (attr.value.toLowerCase().trim().startsWith('javascript:')) {
              attrsToRemove.push(attr.name);
              continue;
            }
          }

          // Sanitize style attribute
          if (attrName === 'style' && DANGEROUS_STYLE_PATTERNS.test(attr.value)) {
            attrsToRemove.push(attr.name);
            continue;
          }

          // Remove non-whitelisted attributes (except data-* for flexibility)
          if (!ALLOWED_ATTRS.has(attrName) && !attrName.startsWith('data-')) {
            attrsToRemove.push(attr.name);
          }
        }

        attrsToRemove.forEach(attr => node.removeAttribute(attr));

        // Recursively sanitize children
        Array.from(node.children).forEach(sanitizeNode);
      }
    };

    sanitizeNode(svg);

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch {
    // If parsing fails, return empty SVG
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
  }
}

/** @type {AbortController|null} Current modal's abort controller */
let modalAbortController = null;

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

  // Validate required secret
  if (!secret) {
    return null;
  }

  // Cleanup previous modal listeners
  if (modalAbortController) {
    modalAbortController.abort();
  }
  modalAbortController = new AbortController();
  const { signal } = modalAbortController;

  // Build otpauth URI and generate QR with robust error handling
  const uri = buildOTPAuthURI(secret, issuer, account);
  let qrSvg;
  let hasError = false;
  try {
    qrSvg = generateQRCodeSVG(uri, { size: 200 });
    // Verify QR was actually generated (check for SVG content)
    if (!qrSvg || !qrSvg.includes('<svg') || qrSvg.includes('vault-qr-error')) {
      throw new Error('QR generation failed');
    }
    // Validate SVG format
    if (!qrSvg.match(/^<svg[^>]*>[\s\S]*<\/svg>$/)) {
      throw new Error('Invalid SVG format');
    }
    // Sanitize SVG to remove dangerous attributes/elements
    qrSvg = sanitizeSVG(qrSvg);
  } catch {
    hasError = true;
    qrSvg = `<div class="vault-qr-error" role="alert">${escapeHtml(t('vault.totp.qrError'))}</div>`;
  }

  // Create or reuse modal
  let modal = document.getElementById('totp-qr-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'totp-qr-modal';
    modal.className = 'vault-modal-overlay';
    modal.role = 'dialog';
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'totp-qr-modal-title');
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="vault-modal vault-modal-sm">
      <div class="vault-modal-header">
        <h3 id="totp-qr-modal-title">${escapeHtml(t('vault.totp.qrTitle'))}</h3>
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
        <p class="vault-qr-hint">${escapeHtml(t('vault.totp.scanHint'))}</p>
      </div>
    </div>
  `;

  // Close handler with cleanup
  const closeModal = () => {
    // Abort all listeners
    if (modalAbortController) {
      modalAbortController.abort();
      modalAbortController = null;
    }
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    if (onClose) onClose();
  };

  // Bind close events with AbortController for automatic cleanup
  modal.querySelector('[data-close-modal]')?.addEventListener('click', closeModal, { signal });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { signal });

  // Show modal
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  return modal;
}
