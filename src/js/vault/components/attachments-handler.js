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

/**
 * Validate file size
 * @param {File} file - File to validate
 * @returns {boolean} True if valid
 */
export function isValidAttachmentSize(file) {
  return file.size <= MAX_ATTACHMENT_SIZE;
}
