/**
 * @fileoverview Secure Share Modal
 * Client-side encrypted sharing with passphrase protection
 */

import { escapeHtml } from '../utils/formatter.js';

/**
 * Extended word list for passphrase generation (128 words = 7 bits per word)
 * 4-word passphrase = 28 bits entropy, 6-word = 42 bits (recommended)
 */
const PASSPHRASE_WORDS = [
  // Nature - Animals
  'eagle', 'falcon', 'tiger', 'dragon', 'phoenix', 'wolf', 'bear', 'lion',
  'shark', 'whale', 'hawk', 'raven', 'panther', 'cobra', 'viper', 'jaguar',
  // Nature - Plants & Places
  'forest', 'garden', 'island', 'jungle', 'valley', 'ocean', 'river', 'storm',
  'canyon', 'summit', 'glacier', 'meadow', 'desert', 'tundra', 'lagoon', 'reef',
  // Fruits & Food
  'apple', 'banana', 'cherry', 'lemon', 'orange', 'mango', 'grape', 'melon',
  'peach', 'olive', 'walnut', 'almond', 'coffee', 'honey', 'pepper', 'ginger',
  // Elements & Materials
  'crystal', 'diamond', 'amber', 'bronze', 'silver', 'cobalt', 'titanium', 'carbon',
  'xenon', 'neon', 'argon', 'helium', 'plasma', 'granite', 'marble', 'quartz',
  // Actions & Adjectives
  'brave', 'swift', 'silent', 'cosmic', 'lunar', 'solar', 'stellar', 'primal',
  'ancient', 'frozen', 'blazing', 'golden', 'crimson', 'azure', 'violet', 'scarlet',
  // Objects & Concepts
  'palace', 'castle', 'tower', 'temple', 'harbor', 'beacon', 'anchor', 'compass',
  'shield', 'crown', 'throne', 'scepter', 'banner', 'crest', 'sigil', 'relic',
  // Time & Space
  'winter', 'autumn', 'spring', 'summer', 'midnight', 'twilight', 'sunrise', 'zenith',
  'epoch', 'era', 'century', 'moment', 'instant', 'eternal', 'infinite', 'prism',
  // Abstract & Modern
  'alpha', 'omega', 'delta', 'sigma', 'quantum', 'vector', 'cipher', 'matrix',
  'vortex', 'nexus', 'vertex', 'apex', 'zenith', 'nadir', 'origin', 'echo'
];

/**
 * Generate a random passphrase using CSPRNG
 * @param {number} wordCount - Number of words (default: 6 for ~42 bits entropy)
 * @returns {string} Passphrase with words separated by dashes
 */
export function generateSharePassphrase(wordCount = 6) {
  const randomBytes = new Uint8Array(wordCount);
  crypto.getRandomValues(randomBytes);

  const selected = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = randomBytes[i] % PASSPHRASE_WORDS.length;
    selected.push(PASSPHRASE_WORDS[idx]);
  }

  return selected.join('-');
}

/**
 * Build shareable data from entry
 * @param {Object} entry - Vault entry
 * @param {Object} options - Options
 * @param {number} options.expiresIn - Expiration in ms
 * @param {boolean} options.includeNotes - Include notes
 * @returns {Object} Shareable data object
 */
function buildShareData(entry, options = {}) {
  const { expiresIn = 86400000, includeNotes = false } = options;

  const shareData = {
    v: 1,
    type: entry.type,
    title: entry.title,
    data: {},
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresIn).toISOString()
  };

  // Include relevant fields based on entry type
  switch (entry.type) {
    case 'login':
      shareData.data.username = entry.data?.username || '';
      shareData.data.password = entry.data?.password || '';
      shareData.data.url = entry.data?.url || '';
      if (entry.data?.totp) shareData.data.totp = entry.data.totp;
      break;
    case 'card':
      shareData.data.holder = entry.data?.holder || '';
      shareData.data.number = entry.data?.number || '';
      shareData.data.expiry = entry.data?.expiry || '';
      shareData.data.cvv = entry.data?.cvv || '';
      break;
    case 'note':
      shareData.data.content = entry.data?.content || '';
      break;
    case 'identity':
      shareData.data.fullName = entry.data?.fullName || '';
      shareData.data.email = entry.data?.email || '';
      shareData.data.phone = entry.data?.phone || '';
      break;
  }

  if (includeNotes && entry.notes) {
    shareData.notes = entry.notes;
  }

  return shareData;
}

/**
 * Create encrypted share using Web Crypto API
 * @param {Object} entry - Vault entry to share
 * @param {string} passphrase - Encryption passphrase
 * @param {Object} options - Share options
 * @param {number} options.expiresIn - Expiration in ms (default: 24h)
 * @param {boolean} options.includeNotes - Include notes (default: false)
 * @returns {Promise<string>} Encrypted share string
 */
export async function createSecureShare(entry, passphrase, options = {}) {
  // Validate inputs
  if (!entry || typeof entry !== 'object') {
    throw new Error('Invalid entry provided');
  }
  if (!passphrase || typeof passphrase !== 'string' || passphrase.length < 4) {
    throw new Error('Invalid passphrase');
  }

  try {
    const shareData = buildShareData(entry, options);

    // Encrypt using Web Crypto API
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Using PBKDF2 with 100000 iterations for compatibility
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(shareData))
    );

    // Combine salt + iv + ciphertext and encode
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return `GENPWD:1:${btoa(String.fromCharCode(...result))}`;
  } catch (error) {
    // Re-throw with generic message to avoid exposing crypto internals
    throw new Error('Encryption failed');
  }
}

/**
 * Show secure share modal
 * @param {Object} options
 * @param {Object} options.entry - Entry to share
 * @param {Function} options.onCopy - Callback for copy operations (text, message)
 * @param {Function} options.onSuccess - Callback on successful generation (message)
 * @param {Function} options.onError - Callback on error (message)
 * @param {Function} options.t - Translation function
 * @returns {HTMLElement} The modal element
 */
export function showSecureShareModal(options = {}) {
  const { entry, onCopy, onSuccess, onError, t = (k) => k } = options;

  if (!entry) return null;

  // Remove existing modal
  document.getElementById('share-modal')?.remove();

  // Generate initial passphrase
  let currentPassphrase = generateSharePassphrase();

  const modal = document.createElement('div');
  modal.className = 'vault-modal-overlay';
  modal.id = 'share-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'share-modal-title');
  modal.innerHTML = `
    <div class="vault-modal">
      <div class="vault-modal-header">
        <h3 id="share-modal-title">${t('vault.share.title')} "${escapeHtml(entry.title)}"</h3>
        <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body">
        <p class="vault-share-warning">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          ${t('vault.share.encryptionWarning')}
        </p>

        <div class="vault-form-group">
          <label class="vault-label">${t('vault.share.passphrase')}</label>
          <div class="vault-share-passphrase">
            <input type="text" class="vault-input" id="share-passphrase" value="${currentPassphrase}" readonly>
            <button type="button" class="vault-btn vault-btn-secondary" id="regenerate-passphrase" title="${t('vault.share.regenerate')}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
            </button>
            <button type="button" class="vault-btn vault-btn-secondary" id="copy-passphrase" title="${t('vault.common.copy')}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <p class="vault-share-hint">${t('vault.share.passphraseHint')}</p>
        </div>

        <div class="vault-form-group">
          <label class="vault-label">${t('vault.share.expiration')}</label>
          <select class="vault-input vault-select" id="share-expiry">
            <option value="3600000">${t('vault.share.hour1')}</option>
            <option value="86400000" selected>${t('vault.share.hours24')}</option>
            <option value="604800000">${t('vault.share.days7')}</option>
            <option value="2592000000">${t('vault.share.days30')}</option>
          </select>
        </div>

        <div class="vault-form-group">
          <label class="vault-checkbox-label">
            <input type="checkbox" id="share-include-notes">
            <span>${t('vault.share.includeNotes')}</span>
          </label>
        </div>

        <div class="vault-share-result" id="share-result" hidden>
          <label class="vault-label">${t('vault.share.encryptedText')}</label>
          <textarea class="vault-input vault-textarea" id="share-output" rows="4" readonly></textarea>
          <button type="button" class="vault-btn vault-btn-primary" id="copy-share">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            ${t('vault.share.copyEncrypted')}
          </button>
        </div>

        <div class="vault-modal-actions">
          <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
          <button type="button" class="vault-btn vault-btn-primary" id="generate-share">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            ${t('vault.share.generate')}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();

  modal.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Regenerate passphrase
  modal.querySelector('#regenerate-passphrase')?.addEventListener('click', () => {
    currentPassphrase = generateSharePassphrase();
    const input = modal.querySelector('#share-passphrase');
    if (input) input.value = currentPassphrase;
  });

  // Copy passphrase
  modal.querySelector('#copy-passphrase')?.addEventListener('click', async () => {
    if (onCopy) {
      await onCopy(currentPassphrase, t('vault.messages.passphraseCopied'));
    }
  });

  // Generate share
  modal.querySelector('#generate-share')?.addEventListener('click', async () => {
    const generateBtn = modal.querySelector('#generate-share');
    const passphrase = modal.querySelector('#share-passphrase')?.value;
    const expiry = parseInt(modal.querySelector('#share-expiry')?.value || '86400000', 10);
    const includeNotes = modal.querySelector('#share-include-notes')?.checked || false;

    // Show loading state and disable button
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.setAttribute('aria-busy', 'true');
      generateBtn.dataset.originalText = generateBtn.textContent;
      generateBtn.innerHTML = `<span class="vault-spinner-small"></span> ${t('vault.common.generating')}`;
    }

    // Announce to screen readers
    let srAnnouncer = modal.querySelector('.share-sr-announcer');
    if (!srAnnouncer) {
      srAnnouncer = document.createElement('span');
      srAnnouncer.className = 'sr-only share-sr-announcer';
      srAnnouncer.setAttribute('role', 'status');
      srAnnouncer.setAttribute('aria-live', 'polite');
      modal.querySelector('.vault-modal-body')?.appendChild(srAnnouncer);
    }
    srAnnouncer.textContent = t('vault.aria.generatingShare');

    try {
      const shareText = await createSecureShare(entry, passphrase, {
        expiresIn: expiry,
        includeNotes
      });

      const outputEl = modal.querySelector('#share-output');
      if (outputEl) outputEl.value = shareText;

      const resultEl = modal.querySelector('#share-result');
      if (resultEl) resultEl.hidden = false;

      if (onSuccess) onSuccess(t('vault.messages.shareGenerated'));
    } catch (error) {
      if (onError) onError(t('vault.messages.generationError'));
    } finally {
      // Restore button state
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.removeAttribute('aria-busy');
        generateBtn.textContent = generateBtn.dataset.originalText || t('vault.actions.generateShare');
      }
    }
  });

  // Copy encrypted share
  modal.querySelector('#copy-share')?.addEventListener('click', async () => {
    const shareText = modal.querySelector('#share-output')?.value;
    if (shareText && onCopy) {
      await onCopy(shareText, t('vault.messages.encryptedTextCopied'));
    }
  });

  return modal;
}

/**
 * Close secure share modal
 */
export function closeSecureShareModal() {
  document.getElementById('share-modal')?.remove();
}
