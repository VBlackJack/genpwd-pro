/**
 * @fileoverview Attachments Handler
 * File attachment rendering and utilities
 */

import { escapeHtml, formatFileSize } from '../utils/formatter.js';

/**
 * Get file icon based on MIME type
 * @param {string} mimeType - File MIME type
 * @returns {string} Emoji icon
 */
export function getFileIcon(mimeType) {
  if (!mimeType) return '📎';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('text')) return '📝';
  return '📎';
}

/**
 * Read file as Base64 data URL
 * @param {File} file - File to read
 * @returns {Promise<string>} Base64 data URL
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Render attachments UI section
 * @param {Object} options
 * @param {Object} options.entry - Entry with attachments
 * @param {boolean} options.isEditing - Whether in edit mode
 * @param {Function} options.t - Translation function
 * @returns {string} HTML string
 */
export function renderAttachmentsUI({ entry, isEditing, t = (k) => k }) {
  const attachments = entry.attachments || [];

  return `
    <div class="vault-detail-section">
      <div class="vault-detail-header">
         <h3 class="vault-detail-subtitle">${t('vault.labels.attachments')} (${attachments.length})</h3>
         ${isEditing ? `
           <div class="vault-file-drop-zone" id="file-drop-zone">
             <span class="drop-icon" aria-hidden="true">📎</span>
             <span class="drop-text">
               ${t('vault.attachments.dropLabel')}
               <button type="button" class="link-btn" id="btn-browse-files" aria-label="${t('vault.aria.browseForAttachments')}">${t('vault.actions.browse')}</button>
             </span>
             <input type="file" id="file-input" multiple class="vault-file-input-hidden" aria-label="${t('vault.aria.attachmentInput')}">
           </div>
         ` : ''}
      </div>

      <div class="vault-attachments-list">
        ${attachments.length === 0 ? `<div class="empty-text">${t('vault.attachments.none')}</div>` : ''}
        ${attachments.map((file, index) => `
          <div class="vault-attachment-item">
            <div class="attachment-icon">${getFileIcon(file.type)}</div>
            <div class="attachment-info">
              <div class="attachment-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
              <div class="attachment-meta">${formatFileSize(file.size)}</div>
            </div>
            <div class="attachment-actions">
              ${isEditing ? `
                <button type="button" class="vault-icon-btn danger" data-delete-attachment="${index}" title="${t('vault.common.delete')}" aria-label="${t('vault.aria.deleteAttachment', { name: escapeHtml(file.name) })}">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : `
                <button type="button" class="vault-icon-btn" data-download-attachment="${index}" title="${t('vault.actions.download')}" aria-label="${t('vault.aria.downloadAttachment', { name: escapeHtml(file.name) })}">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Download an attachment
 * @param {Object} file - Attachment file object with name and data
 * @returns {boolean} True if download initiated successfully
 */
export function downloadAttachment(file) {
  if (!file || !file.data) {
    return false;
  }

  // Validate data URL format to prevent XSS via malicious URLs
  if (!file.data.startsWith('data:') ||
      (!file.data.includes(';base64,') && !file.data.includes(','))) {
    return false;
  }

  // Validate MIME type is safe (block executables)
  const mimeType = extractMimeType(file.data);
  if (!isSafeMimeType(mimeType)) {
    return false;
  }

  // Validate file extension is safe
  if (!isAllowedFileType(file)) {
    return false;
  }

  let link = null;
  try {
    link = document.createElement('a');
    link.href = file.data;
    link.download = file.name || 'download';
    document.body.appendChild(link);
    link.click();
    return true;
  } catch (err) {
    // Silent fail - caller can handle UI feedback
    return false;
  } finally {
    // Always clean up DOM
    if (link && link.parentNode) {
      document.body.removeChild(link);
    }
  }
}

/** Maximum attachment size (5 MB) */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

/** Blocked executable file extensions */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr',  // Windows executables
  '.sh', '.bash', '.zsh', '.fish',                  // Unix shell scripts
  '.ps1', '.psm1', '.psd1',                         // PowerShell
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf',     // Script files
  '.dll', '.sys', '.drv',                           // Windows system files
  '.app', '.dmg', '.pkg',                           // macOS executables
  '.deb', '.rpm', '.appimage',                      // Linux packages
  '.jar', '.class',                                 // Java executables
  '.reg', '.inf',                                   // Windows registry/config
  '.hta', '.cpl', '.msc'                            // Windows special
]);

/** Blocked executable MIME types */
const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sharedlib',
  'application/x-shellscript',
  'application/x-sh',
  'application/x-csh',
  'application/x-powershell',
  'application/vnd.microsoft.portable-executable',
  'application/x-ms-shortcut',
  'application/x-msi',
  'application/x-apple-diskimage',
  'application/x-java-archive',
  'application/java-archive',
  'application/x-deb',
  'application/x-rpm',
  'application/x-appimage',
  'text/x-shellscript',
  'text/x-script.python',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/hta'
]);

/**
 * Extract MIME type from data URL
 * @param {string} dataUrl - Data URL string
 * @returns {string|null} MIME type or null if invalid
 */
function extractMimeType(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Check if MIME type is safe for download
 * @param {string} mimeType - MIME type to check
 * @returns {boolean} True if safe
 */
function isSafeMimeType(mimeType) {
  if (!mimeType) return true; // Allow if no MIME type (will use extension check)
  return !BLOCKED_MIME_TYPES.has(mimeType.toLowerCase());
}

/**
 * Validate file size
 * @param {File} file - File to validate
 * @returns {boolean} True if valid
 */
export function isValidAttachmentSize(file) {
  return file.size <= MAX_ATTACHMENT_SIZE;
}

/**
 * Validate file type - block potentially dangerous executables
 * @param {File|Object} file - File object with name property
 * @returns {boolean} True if file type is allowed
 */
export function isAllowedFileType(file) {
  if (!file?.name) return false;
  const name = file.name.toLowerCase();
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return true; // No extension is allowed
  const ext = name.slice(lastDot);
  return !BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Validate data URL format
 * @param {string} dataUrl - Data URL string to validate
 * @returns {boolean} True if valid data URL format
 */
export function isValidDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  // Must start with 'data:' and contain base64 marker or plain data
  return dataUrl.startsWith('data:') &&
         (dataUrl.includes(';base64,') || dataUrl.includes(','));
}
