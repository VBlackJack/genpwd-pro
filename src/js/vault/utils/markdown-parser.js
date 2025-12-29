/**
 * @fileoverview Simple Markdown Parser
 * Lightweight markdown to HTML conversion for vault notes
 */

import { escapeHtml } from './formatter.js';

/**
 * Parse markdown text to HTML
 * Supports: headers, bold, italic, strikethrough, links, code blocks,
 * inline code, blockquotes, lists, checkboxes, horizontal rules
 *
 * @param {string} text - Markdown text to parse
 * @returns {string} HTML string
 */
export function parseMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headers (# ## ### #### ##### ######)
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Blockquotes (> text)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule (--- or ***)
  html = html.replace(/^(---|\*\*\*)$/gm, '<hr>');

  // Checkboxes (- [ ] or - [x])
  html = html.replace(/\[ \]/g, '<input type="checkbox" disabled>');
  html = html.replace(/\[x\]/gi, '<input type="checkbox" disabled checked>');

  // Paragraphs (double newline)
  html = html.replace(/\n\n+/g, '</p><p>');
  // Single newlines become <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<(?:h[1-6]|ul|ol|blockquote|pre|hr)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h[1-6]|ul|ol|blockquote|pre|hr)>)<\/p>/g, '$1');

  return html;
}

/**
 * Render notes field HTML with markdown support
 * @param {string} notes - Notes text (markdown)
 * @param {Function} t - Translation function
 * @returns {string} HTML string for notes field
 */
export function renderNotesFieldHTML(notes, t = (k) => k) {
  if (!notes) return '';

  return `
    <div class="vault-field vault-notes-field">
      <div class="vault-field-label-row">
        <label class="vault-field-label">${t('vault.labels.notes')}</label>
        <div class="vault-notes-toggle">
          <button type="button" class="vault-notes-mode active" data-mode="preview" title="${t('vault.actions.preview')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button type="button" class="vault-notes-mode" data-mode="source" title="${t('vault.actions.sourceMarkdown')}">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div class="vault-notes-content">
        <div class="vault-notes-preview markdown-body" data-mode="preview">
          ${parseMarkdown(notes)}
        </div>
        <pre class="vault-notes-source" data-mode="source" hidden>${escapeHtml(notes)}</pre>
      </div>
    </div>
  `;
}
