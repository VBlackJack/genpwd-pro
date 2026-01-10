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
 * @fileoverview Changelog Modal (What's New)
 * Shows release notes and new features after app updates
 */

import { Modal } from './modal.js';
import { t } from '../../utils/i18n.js';
import { APP_VERSION } from '../../config/constants.js';

const STORAGE_KEY = 'genpwd-last-seen-version';

/**
 * Changelog Modal - Shows what's new in the latest version
 */
export class ChangelogModal extends Modal {
  #changelogData = null;

  constructor() {
    super('changelog-modal');
  }

  get template() {
    return `
      <div class="vault-modal-header">
        <h2 id="changelog-modal-title">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          ${t('changelog.title')}
        </h2>
        <button type="button" class="vault-modal-close" data-action="close" aria-label="${t('common.close')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="vault-modal-body changelog-modal-body">
        <div class="changelog-version-badge">
          <span class="version-label">v${APP_VERSION}</span>
        </div>
        <div id="changelog-content" class="changelog-content" role="region" aria-label="${t('changelog.releaseNotes')}">
          <div class="changelog-loading">
            <div class="vault-spinner"></div>
            <span>${t('common.loading')}</span>
          </div>
        </div>
      </div>
      <div class="vault-modal-footer">
        <button type="button" class="vault-btn vault-btn-primary" data-action="close">
          ${t('changelog.gotIt')}
        </button>
      </div>
    `;
  }

  /**
   * Check if we should show the changelog (new version detected)
   * @returns {boolean}
   */
  shouldShow() {
    try {
      const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
      return lastSeenVersion !== APP_VERSION;
    } catch {
      return false;
    }
  }

  /**
   * Mark the current version as seen
   */
  markAsSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      // Storage not available
    }
  }

  /**
   * Show the modal and load changelog content
   */
  show() {
    super.show();
    this.#loadChangelog();
  }

  /**
   * Hide modal and mark version as seen
   */
  hide() {
    this.markAsSeen();
    super.hide();
  }

  /**
   * Load and parse changelog content
   */
  async #loadChangelog() {
    const contentEl = document.getElementById('changelog-content');
    if (!contentEl) return;

    try {
      // Load changelog from file
      const response = await fetch('./CHANGELOG.md');
      if (!response.ok) throw new Error('Changelog not found');

      const markdown = await response.text();
      const html = this.#parseChangelog(markdown);
      contentEl.innerHTML = html;
    } catch {
      // Fallback to embedded changelog for current version
      contentEl.innerHTML = this.#getEmbeddedChangelog();
    }
  }

  /**
   * Parse changelog markdown and extract latest version(s)
   * @param {string} markdown - Raw markdown content
   * @returns {string} HTML content
   */
  #parseChangelog(markdown) {
    // Extract the latest 2 versions from changelog
    const versionPattern = /^## \[(\d+\.\d+\.\d+)\]/gm;
    const versions = [];
    let match;

    while ((match = versionPattern.exec(markdown)) !== null && versions.length < 2) {
      versions.push({
        version: match[1],
        index: match.index
      });
    }

    if (versions.length === 0) {
      return this.#getEmbeddedChangelog();
    }

    // Get content for latest version(s)
    let content = '';
    for (let i = 0; i < versions.length; i++) {
      const startIdx = versions[i].index;
      const endIdx = versions[i + 1]?.index || markdown.indexOf('---', startIdx + 100);
      const section = markdown.slice(startIdx, endIdx > startIdx ? endIdx : undefined);
      content += this.#markdownToHtml(section);
    }

    return content;
  }

  /**
   * Convert markdown section to HTML
   * @param {string} md - Markdown content
   * @returns {string} HTML
   */
  #markdownToHtml(md) {
    return md
      // Version headers
      .replace(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm,
        '<h3 class="changelog-version"><span class="version-number">v$1</span><span class="version-date">$2</span></h3>')
      // Subheaders with emojis
      .replace(/^### (.+)$/gm, '<h4 class="changelog-section">$1</h4>')
      // H4 headers
      .replace(/^#### (.+)$/gm, '<h5 class="changelog-subsection">$1</h5>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive li elements in ul
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="changelog-list">$&</ul>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Line breaks for remaining text
      .replace(/\n{2,}/g, '</p><p>')
      // Clean up empty paragraphs
      .replace(/<p>\s*<\/p>/g, '')
      // Wrap non-html text in paragraphs
      .replace(/^([^<\n].+)$/gm, (match) => {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      });
  }

  /**
   * Get embedded changelog for current version (fallback)
   * @returns {string} HTML content
   */
  #getEmbeddedChangelog() {
    return `
      <h3 class="changelog-version">
        <span class="version-number">v${APP_VERSION}</span>
      </h3>
      <h4 class="changelog-section">${t('changelog.highlights')}</h4>
      <ul class="changelog-list">
        <li><strong>${t('changelog.features.uxImprovements')}</strong> - ${t('changelog.features.uxImprovementsDesc')}</li>
        <li><strong>${t('changelog.features.accessibility')}</strong> - ${t('changelog.features.accessibilityDesc')}</li>
        <li><strong>${t('changelog.features.i18n')}</strong> - ${t('changelog.features.i18nDesc')}</li>
        <li><strong>${t('changelog.features.security')}</strong> - ${t('changelog.features.securityDesc')}</li>
      </ul>
      <p class="changelog-footer">
        <a href="https://github.com/VBlackJack/genpwd-pro/releases" target="_blank" rel="noopener">
          ${t('changelog.viewFullChangelog')}
        </a>
      </p>
    `;
  }

  /**
   * Check and show if needed (call on app startup)
   * @returns {boolean} Whether the modal was shown
   */
  checkAndShow() {
    if (this.shouldShow()) {
      this.show();
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const changelogModal = new ChangelogModal();
