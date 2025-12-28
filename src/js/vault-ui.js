/**
 * @fileoverview Vault UI Component - Professional Password Manager UX
 * Inspired by KeePassXC, RoboForm, and modern password managers
 *
 * Layout: 3-panel design
 * - Left sidebar: Folders, categories, filters
 * - Center: Entry list with quick actions
 * - Right: Entry detail panel
 *
 * v2.6.8 - Security Hardening:
 * - Inactivity manager with global event tracking
 * - Secure clipboard with content verification before clear
 * - Visual protection on window blur
 *
 * v2.6.4 - UX Improvements Phase 4:
 * - Multi-selection with checkboxes (Shift+click for range)
 * - Bulk actions (delete, move, export)
 * - Drag & drop entries between folders
 * - Export/Import JSON functionality
 *
 * v2.6.3 - UX Improvements Phase 3:
 * - Advanced search filters (type, strength, age)
 * - Favorite toggle in entry list
 * - Password strength indicator dots
 *
 * v2.6.2 - UX Improvements Phase 2:
 * - Undo delete with toast & progress bar
 * - Entry duplication, Password age indicator
 * - Keyboard shortcuts modal, View toggle, Auto-lock warning
 */

import { getInactivityManager } from './utils/inactivity-manager.js';
import { getSecureClipboard } from './utils/secure-clipboard.js';
import { showToast } from './utils/toast.js';
import { safeLog } from './utils/logger.js';
import { t } from './utils/i18n.js';
import { SyncSettingsModal } from './ui/modals/sync-settings-modal.js';
import { AliasService } from './services/alias-service.js';
import { AliasSettingsModal } from './ui/modals/alias-settings-modal.js';
import { SettingsModal } from './ui/modals/settings-modal.js';
import { showConfirm } from './ui/modal-manager.js';
import { SecurityDashboard } from './ui/views/security-dashboard.js';
import { ShareModal } from './ui/modals/share-modal.js';
import { DuressSetupModal } from './ui/modals/duress-setup-modal.js';
import { generateQRCodeSVG } from './utils/qrcode.js';

// Vault utility imports (Phase 6 modularization)
import { escapeHtml, formatDate, formatDateTime } from './vault/utils/formatter.js';
import { getPasswordStrength, isPasswordDuplicated } from './vault/utils/password-utils.js';

// Vault modals imports (Phase 6 modularization)
import { getTemplateById, renderTemplateGrid } from './vault/modals/entry-templates.js';
import { renderCustomFieldsSection, createCustomFieldElement } from './vault/modals/custom-fields.js';
import { renderAddFolderModal, renderAddTagModal, renderEditTagModal, renderMoveFolderModal } from './vault/modals/folder-tag-modals.js';
import { renderShortcutsModal } from './vault/modals/shortcuts-modal.js';
import { renderHealthDashboardModal as renderHealthDashboard } from './vault/modals/health-dashboard-modal.js';
import { renderImportModal, showExportFormatModal } from './vault/modals/import-export-modal.js';
import { renderCreateVaultModal, renderOpenExternalModal } from './vault/modals/vault-management.js';
import { renderAddEntryModal, renderEditEntryModal } from './vault/modals/entry-form.js';
import { showAutotypeModal } from './vault/modals/autotype-modal.js';
import { showTOTPQRModal } from './vault/modals/totp-qr-modal.js';

// Vault views imports (Phase 6 modularization)
import { renderLockScreen } from './vault/views/lock-screen.js';
import { renderEmptyState, renderNoSelection } from './vault/views/empty-states.js';

// Vault components imports (Phase 6 modularization)
import { showContextMenu } from './vault/components/context-menu.js';
import { showFolderContextMenu, FOLDER_ACTIONS } from './vault/components/folder-context-menu.js';
import { showPasswordGenerator as showPwdGenerator, generatePassword } from './vault/components/password-generator.js';
import { showTimeoutSettings } from './vault/components/timeout-settings.js';

// Vault services imports (Phase 6 modularization)
import { performExport, downloadExport } from './vault/services/export-service.js';

// Entry type configuration - function to get translated labels
const getEntryTypes = () => ({
  login: { icon: '🔑', label: t('vault.detail.login'), color: '#60a5fa' },
  note: { icon: '📝', label: t('vault.detail.secureNote'), color: '#fbbf24' },
  card: { icon: '💳', label: t('vault.detail.creditCard'), color: '#f472b6' },
  identity: { icon: '👤', label: t('vault.detail.identity'), color: '#a78bfa' },
  ssh: { icon: '🔐', label: t('vault.detail.sshKey'), color: '#34d399' },
  preset: { icon: '⚙️', label: t('vault.detail.preset'), color: '#94a3b8' }
});

// Alias for backward compatibility
const ENTRY_TYPES = getEntryTypes();

// Category filters - function to get translated labels
const getCategories = () => [
  { id: 'all', icon: '📁', label: t('vault.sidebar.all') },
  { id: 'favorites', icon: '⭐', label: t('vault.sidebar.favorites') },
  { id: 'recent', icon: '🕐', label: t('vault.sidebar.recent') },
  { id: 'login', icon: '🔑', label: t('vault.sidebar.logins') },
  { id: 'note', icon: '📝', label: t('vault.sidebar.notes') },
  { id: 'card', icon: '💳', label: t('vault.sidebar.cards') },
  { id: 'identity', icon: '👤', label: t('vault.sidebar.identities') }
];

// Sort options - function to get translated labels
const getSortOptions = () => [
  { id: 'title-asc', label: t('vault.sort.titleAZ') || 'Title A-Z', icon: '↑' },
  { id: 'title-desc', label: t('vault.sort.titleZA') || 'Title Z-A', icon: '↓' },
  { id: 'modified-desc', label: t('vault.detail.recentlyModified'), icon: '🕐' },
  { id: 'modified-asc', label: t('vault.sort.oldestFirst') || 'Oldest first', icon: '📅' },
  { id: 'type', label: t('vault.sort.byType') || 'By type', icon: '📂' }
];

/**
 * Vault UI Controller
 */
export class VaultUI {
  #container;
  #filterEntries;
  #syncSettingsModal;
  #aliasService;
  #aliasSettingsModal;
  #currentView = 'lock';
  #selectedEntry = null;
  #selectedCategory = 'all';
  #selectedFolder = null;
  #selectedTag = null;
  #entries = [];
  #folders = [];
  #tags = [];
  #vaultMetadata = null;
  #searchQuery = '';
  #sortBy = 'modified-desc';
  #autoLockTimer = null;
  #autoLockTimeout = 300; // Default 5 minutes, loaded from localStorage
  #autoLockSeconds = 300;
  #theme = 'dark'; // 'dark' or 'light'
  #clipboardTimeout = null;
  #isEditing = false;
  #editingData = {};
  #hasDirtyForm = false;
  #unsubscribeLocked = null;
  #unsubscribeUnlocked = null;
  #unsubscribeChanged = null;
  #focusTrapActive = false;
  #lastFocusedElement = null;
  /** @type {Map<string, Function>} Active focus trap handlers */
  #focusTrapHandlers = new Map();
  #pendingDelete = null;
  #undoTimeout = null;
  #viewMode = 'comfortable'; // 'comfortable' | 'compact'
  #isCompactMode = false; // Window compact/overlay mode
  #searchFilters = { type: null, strength: null, age: null };
  #autoLockWarningShown = false;
  #selectedEntries = new Set(); // Multi-selection
  #lastSelectedIndex = -1; // For shift-click range selection
  #draggedEntry = null; // For drag & drop
  #totpTimer = null; // TOTP update interval
  #pendingExportEntries = null; // Entries pending export
  #unsubscribeSyncStatus = null; // Sync status listener cleanup
  #faviconCache = new Map(); // Cached favicons
  #breachCache = new Map(); // Cached breach check results (password hash -> count)
  #lastBreachCheck = null; // Last breach check timestamp
  #pendingExternalPath = null; // Path for external vault creation/opening
  #lastAuditReport = null; // Last security audit report
  #auditFilterIds = null; // Set of entry IDs to filter by (from audit)
  #keyboardHandler = null; // Global keyboard shortcut handler
  /** @type {AbortController|null} AbortController for main view event cleanup */
  #mainViewAbortController = null;

  /** @type {Object} */
  #duressSetupModal;
  /** @type {Object} */
  #settingsModal;
  /** @type {SecurityDashboard} */
  #securityDashboard;
  /** @type {Object} */
  #shareModal;

  constructor(container) {
    this.#container = container;
    this.#syncSettingsModal = new SyncSettingsModal();
    this.#aliasService = new AliasService();
    this.#aliasSettingsModal = new AliasSettingsModal();
    this.#duressSetupModal = new DuressSetupModal();
    this.#settingsModal = new SettingsModal();
    this.#securityDashboard = new SecurityDashboard(container);
    this.#shareModal = new ShareModal();
  }

  async init() {
    if (!window.vault) {
      this.#renderNoVaultAPI();
      return;
    }

    // Subscribe to vault events
    this.#unsubscribeLocked = window.vault.on('locked', () => {
      this.#currentView = 'lock';
      this.#entries = [];
      this.#selectedEntry = null;
      this.#isEditing = false;
      this.#stopAutoLockTimer();
      this.#render();
    });

    this.#unsubscribeUnlocked = window.vault.on('unlocked', async () => {
      this.#currentView = 'main';
      await this.#loadData();
      this.#startAutoLockTimer();
      this.#render();

      // Check for breaches in background if enabled
      const autoCheckBreaches = localStorage.getItem('genpwd-vault-auto-breach-check') !== 'false';
      if (autoCheckBreaches) {
        // Delay to not block UI
        setTimeout(() => this.#checkBreaches(true), 2000);
      }
    });

    this.#unsubscribeChanged = window.vault.on('changed', async () => {
      await this.#loadData();
      // Refresh selected entry if it still exists
      if (this.#selectedEntry) {
        this.#selectedEntry = this.#entries.find(e => e.id === this.#selectedEntry.id) || null;
      }
      this.#render();
    });

    // Check initial state
    try {
      const state = await window.vault.getState();
      if (state.status === 'unlocked') {
        this.#currentView = 'main';
        await this.#loadData();
        this.#startAutoLockTimer();
      }
    } catch (error) {
      safeLog('[VaultUI] Init error:', error);
    }

    // Keyboard shortcuts
    this.#bindKeyboardShortcuts();

    // Initialize JS-based tooltips (escapes overflow:hidden containers)
    this.#initTooltips();

    // Visual protection on window blur (if enabled)
    this.#initVisualProtection();

    // Initialize Global Auto-Type (KeePass Killer)
    this.#initGlobalAutoType();

    // Initialize Cloud Sync Status
    this.#initSyncStatus();

    this.#render();
  }

  /**
   * Initialize Global Auto-Type handler
   * Listens for Ctrl+Alt+A from main process
   */
  #initGlobalAutoType() {
    if (window.electronAPI?.onGlobalAutoType) {
      window.electronAPI.onGlobalAutoType(async ({ title }) => {
        if (!title || this.#currentView !== 'main') {
          await window.electronAPI.showWindow();
          return;
        }

        // Smart Matching Heuristic
        const lowerTitle = title.toLowerCase();

        const matches = this.#entries.filter(e => {
          if (e.trash) return false;

          const eTitle = (e.title || '').toLowerCase();
          const eUrl = (e.url || '').toLowerCase();

          // 1. Strict containment (Entry Title inside Window Title)
          // e.g. Entry "Facebook" inside "Facebook - Login"
          if (eTitle && lowerTitle.includes(eTitle) && eTitle.length > 2) return true;

          // 2. URL Domain Check
          // e.g. Window "Login to GitHub" matches url "github.com"
          if (eUrl) {
            try {
              const hostname = new URL(eUrl).hostname.replace('www.', '').split('.')[0];
              if (hostname && lowerTitle.includes(hostname) && hostname.length > 3) return true;
            } catch { /* Invalid URL format - skip matching */ }
          }
          return false;
        });

        if (matches.length === 1) {
          // SINGLE MATCH -> Auto-Type immediately
          const entry = matches[0];
          const fullEntry = await window.vault.entries.get(entry.id); // Ensure full data (pwd)

          showToast(`Auto-Type: ${entry.title}`, 'info');

          const sequence = '{USERNAME}{TAB}{PASSWORD}{ENTER}';
          await window.electronAPI.performAutoType(sequence, {
            username: fullEntry.username,
            password: fullEntry.password
          });
        } else {
          // MULTIPLE OR NO MATCH -> Show Window & Filter
          await window.electronAPI.showWindow();

          // Clean up title for search (remove browser suffix if possible)
          // But raw title search is okay for now
          const cleanQuery = title.split(' - ')[0] || title;

          this.#searchQuery = cleanQuery;
          const searchInput = document.getElementById('vault-search');
          if (searchInput) {
            searchInput.value = cleanQuery;
            searchInput.focus();
            searchInput.select();
          }
          this.#filterEntries();

          if (matches.length > 1) {
            showToast(`${matches.length} matches found`, 'info');
          } else {
            showToast(t('vault.messages.noAutoMatchFound'), 'warning');
          }
        }
      });
    }
  }

  /** @type {Function|null} */
  #unsubscribeBlur = null;
  /** @type {Function|null} */
  #unsubscribeFocus = null;
  /** @type {boolean} */
  #visualProtectionEnabled = true;
  /** @type {boolean} */
  #isWindowBlurred = false;

  /**
   * Initialize visual protection on window blur/focus
   * Blurs sensitive data when window loses focus
   */
  #initVisualProtection() {
    // Load setting from localStorage
    const saved = localStorage.getItem('genpwd-vault-visual-protection');
    this.#visualProtectionEnabled = saved !== 'false'; // Default true

    if (window.electronAPI?.onWindowBlur) {
      this.#unsubscribeBlur = window.electronAPI.onWindowBlur(() => {
        if (this.#visualProtectionEnabled && this.#currentView === 'main') {
          this.#isWindowBlurred = true;
          this.#applyVisualProtection(true);
        }
      });
    }

    if (window.electronAPI?.onWindowFocus) {
      this.#unsubscribeFocus = window.electronAPI.onWindowFocus(() => {
        if (this.#isWindowBlurred) {
          this.#isWindowBlurred = false;
          this.#applyVisualProtection(false);
        }
      });
    }
  }

  /**
   * Apply or remove visual protection (blur effect)
   * @param {boolean} blur - Whether to blur sensitive content
   */
  #applyVisualProtection(blur) {
    const vaultApp = document.querySelector('.vault-app');
    if (!vaultApp) return;

    if (blur) {
      vaultApp.setAttribute('data-blurred', 'true');
    } else {
      vaultApp.removeAttribute('data-blurred');
    }
  }

  destroy() {
    if (this.#unsubscribeLocked) this.#unsubscribeLocked();
    if (this.#unsubscribeUnlocked) this.#unsubscribeUnlocked();
    if (this.#unsubscribeChanged) this.#unsubscribeChanged();
    if (this.#unsubscribeBlur) this.#unsubscribeBlur();
    if (this.#unsubscribeFocus) this.#unsubscribeFocus();
    if (this.#unsubscribeSyncStatus) this.#unsubscribeSyncStatus();
    // Clean up keyboard shortcuts handler
    if (this.#keyboardHandler) {
      document.removeEventListener('keydown', this.#keyboardHandler);
      this.#keyboardHandler = null;
    }
    this.#stopAutoLockTimer();

    // Clean up TOTP timer
    if (this.#totpTimer) {
      clearInterval(this.#totpTimer);
      this.#totpTimer = null;
    }

    // Clean up clipboard timeout
    if (this.#clipboardTimeout) {
      clearTimeout(this.#clipboardTimeout);
      this.#clipboardTimeout = null;
    }

    // Clean up tooltip timeout
    if (this.#tooltipTimeout) {
      clearTimeout(this.#tooltipTimeout);
      this.#tooltipTimeout = null;
    }

    // Clean up undo timeout
    if (this.#undoTimeout) {
      clearTimeout(this.#undoTimeout);
      this.#undoTimeout = null;
    }

    // Clean up main view event listeners
    if (this.#mainViewAbortController) {
      this.#mainViewAbortController.abort();
      this.#mainViewAbortController = null;
    }
  }

  async #loadData() {
    try {
      const [entries, folders, tags, metadata] = await Promise.all([
        window.vault.entries.getAll(),
        window.vault.folders.getAll(),
        window.vault.tags.getAll(),
        window.vault.getMetadata()
      ]);
      this.#entries = entries || [];
      this.#folders = folders || [];
      this.#tags = tags || [];
      this.#vaultMetadata = metadata || null;

      // Preload favicons in background
      this.#preloadFavicons();
    } catch (error) {
      safeLog('[VaultUI] Load error:', error);
    }
  }

  #render() {
    if (this.#currentView === 'lock') {
      this.#renderLockScreen();
    } else {
      this.#renderMainView();
    }
  }

  /**
   * Public method to refresh UI when language changes
   */
  refreshLanguage() {
    this.#render();
  }

  // ==================== LOCK SCREEN ====================

  // Lock screen HTML moved to ./vault/views/lock-screen.js
  #renderLockScreen() {
    this.#container.innerHTML = `
      ${renderLockScreen({ t })}
      ${renderCreateVaultModal({ t })}
      ${renderOpenExternalModal({ t })}
    `;

    this.#loadVaultList();
    this.#attachLockScreenEvents();
  }

  async #loadVaultList() {
    const container = document.getElementById('vault-selector');
    if (!container) return;

    try {
      const vaults = await window.vault.list();

      if (vaults.length === 0) {
        container.innerHTML = `
          <div class="vault-empty-small">
            <p>No vault found. Create one to get started.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="vault-list" role="listbox">
          ${vaults.map((v, i) => `
            <div class="vault-list-item ${i === 0 ? 'selected' : ''} ${v.isMissing ? 'vault-missing' : ''}"
                 data-vault-id="${v.id}"
                 role="option"
                 aria-selected="${i === 0}"
                 tabindex="${i === 0 ? 0 : -1}">
              <div class="vault-list-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="vault-list-info">
                <div class="vault-list-name">${escapeHtml(v.name || v.id.substring(0, 8))}</div>
                <div class="vault-list-meta">${v.isMissing ? '⚠️ ' + t('vault.messages.fileNotFound') : formatDate(v.modifiedAt)}</div>
              </div>
              <button type="button" class="vault-list-forget" data-vault-id="${v.id}" title="${t('vault.messages.forgetVault')}" aria-label="${t('vault.messages.forgetVault')}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div class="vault-list-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Click & keyboard events
      container.querySelectorAll('.vault-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
          // Don't select if clicking on forget button
          if (e.target.closest('.vault-list-forget')) return;
          this.#selectVaultItem(item, container);
        });
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.#selectVaultItem(item, container);
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = Array.from(container.querySelectorAll('.vault-list-item'));
            const currentIdx = items.indexOf(item);
            const nextIdx = e.key === 'ArrowDown'
              ? Math.min(currentIdx + 1, items.length - 1)
              : Math.max(currentIdx - 1, 0);
            this.#selectVaultItem(items[nextIdx], container);
            items[nextIdx].focus();
          }
        });
      });

      // Forget button events
      container.querySelectorAll('.vault-list-forget').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const vaultId = btn.dataset.vaultId;
          const vaultName = btn.closest('.vault-list-item')?.querySelector('.vault-list-name')?.textContent || vaultId;

          const confirmed = await showConfirm(t('vault.messages.forgetVaultConfirm', { name: vaultName }), {
            title: t('vault.actions.forgetVault') || 'Forget Vault',
            confirmLabel: t('common.forget') || 'Forget',
            danger: true
          });
          if (confirmed) {
            try {
              await window.vault.unregister(vaultId);
              this.#showToast(t('vault.messages.vaultForgotten'), 'success');
              this.#loadVaultList();
            } catch (error) {
              this.#showToast(error.message || t('vault.common.error'), 'error');
            }
          }
        });
      });

      // Check Windows Hello for first vault
      if (vaults.length > 0) {
        this.#updateHelloSection(vaults[0].id);
      }
    } catch (error) {
      container.innerHTML = `<div class="vault-error">${t('vault.messages.errorLoadingVaults')}</div>`;
    }
  }

  #selectVaultItem(item, container) {
    container.querySelectorAll('.vault-list-item').forEach(el => {
      el.classList.remove('selected');
      el.setAttribute('aria-selected', 'false');
      el.setAttribute('tabindex', '-1');
    });
    item.classList.add('selected');
    item.setAttribute('aria-selected', 'true');
    item.setAttribute('tabindex', '0');

    // Update Windows Hello section for selected vault
    const vaultId = item.dataset.vaultId;
    if (vaultId) {
      this.#updateHelloSection(vaultId);
    }
  }

  /**
   * Update Windows Hello section visibility
   * @param {string} vaultId - Selected vault ID
   */
  async #updateHelloSection(vaultId) {
    const helloSection = document.getElementById('hello-section');
    if (!helloSection) return;

    // Check if Windows Hello API is available
    if (!window.vault?.hello) {
      helloSection.hidden = true;
      return;
    }

    try {
      // Check if Windows Hello is available on this system
      const isAvailable = await window.vault.hello.isAvailable();
      if (!isAvailable) {
        helloSection.hidden = true;
        return;
      }

      // Check if Windows Hello is enabled for this vault
      const isEnabled = await window.vault.hello.isEnabled(vaultId);
      helloSection.hidden = !isEnabled;
    } catch (error) {
      safeLog('[VaultUI] Hello check error:', error);
      helloSection.hidden = true;
    }
  }

  #attachLockScreenEvents() {
    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
      const input = document.getElementById('vault-password');
      const btn = document.getElementById('toggle-password');
      if (input && btn) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.setAttribute('aria-label', isPassword ? t('vault.dialogs.hidePassword') : t('vault.quickUnlock.showPassword'));
        btn.setAttribute('aria-pressed', String(isPassword));
      }
    });

    // Unlock form
    document.getElementById('unlock-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selected = document.querySelector('.vault-list-item.selected');
      const password = document.getElementById('vault-password')?.value;

      if (!selected) {
        this.#showToast(t('vault.messages.selectVault'), 'warning');
        return;
      }
      if (!password) {
        this.#showToast(t('vault.messages.enterPassword'), 'warning');
        document.getElementById('vault-password')?.focus();
        return;
      }

      const btn = document.getElementById('btn-unlock');
      const progress = document.getElementById('unlock-progress');
      const btnIcon = btn?.querySelector('.btn-icon');
      const btnSpinner = btn?.querySelector('.btn-spinner');

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = t('vault.actions.unlocking');
      if (btnIcon) btnIcon.hidden = true;
      if (btnSpinner) btnSpinner.hidden = false;
      if (progress) {
        progress.hidden = false;
        // Animate progress bar
        const fill = progress.querySelector('.vault-progress-fill');
        if (fill) fill.style.width = '0%';
        this.#animateProgress(fill, 3000);
      }

      try {
        await window.vault.unlock(selected.dataset.vaultId, password);
      } catch (error) {
        this.#showDetailedError(
          error.message || t('vault.misc.incorrectPassword'),
          t('vault.messages.checkFileFormat')
        );
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = t('vault.lockScreen.unlock');
        if (btnIcon) btnIcon.hidden = false;
        if (btnSpinner) btnSpinner.hidden = true;
        if (progress) progress.hidden = true;
        document.getElementById('vault-password')?.select();
      }
    });

    // Create vault
    document.getElementById('btn-create-vault')?.addEventListener('click', () => {
      this.#openModal('create-vault-modal');
      document.getElementById('new-vault-name')?.focus();
    });

    // Windows Hello unlock
    document.getElementById('btn-hello-unlock')?.addEventListener('click', async () => {
      const selected = document.querySelector('.vault-list-item.selected');
      if (!selected) {
        this.#showToast(t('vault.messages.selectVault'), 'warning');
        return;
      }

      const btn = document.getElementById('btn-hello-unlock');
      const originalContent = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner"></span> ${t('common.verifying')}`;

      try {
        await window.vault.hello.unlock(selected.dataset.vaultId);
        // Success - vault:unlocked event will handle view switch
      } catch (error) {
        this.#showToast(error.message || t('vault.windowsHello.failed'), 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
    });

    // Open external vault file
    document.getElementById('btn-open-external')?.addEventListener('click', async () => {
      try {
        const result = await window.vault.showOpenDialog();
        if (result.canceled) return;

        // Store the file path and show password modal
        this.#pendingExternalPath = result.filePath;
        this.#openModal('open-external-modal');

        // Display the file path in the modal
        const pathDisplay = document.getElementById('external-vault-path');
        if (pathDisplay) {
          pathDisplay.textContent = result.filePath;
        }

        document.getElementById('external-vault-password')?.focus();
      } catch (error) {
        this.#showToast(error.message || t('vault.messages.errorSelectingFile'), 'error');
      }
    });

    this.#attachCreateVaultEvents();
    this.#attachExternalVaultEvents();
  }

  #animateProgress(element, duration) {
    if (!element) return;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 0.95);
      element.style.width = `${progress * 100}%`;
      if (progress < 0.95) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  // Create vault modal moved to ./vault/modals/vault-management.js

  #attachCreateVaultEvents() {
    const modal = document.getElementById('create-vault-modal');
    if (!modal) return;

    // Close buttons
    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#resetCreateVaultModal();
        this.#closeModal('create-vault-modal');
      });
    });

    // Location type radio buttons
    const locationRadios = modal.querySelectorAll('input[name="vault-location-type"]');
    const customLocationSection = document.getElementById('custom-location-section');

    locationRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'custom') {
          customLocationSection.hidden = false;
        } else {
          customLocationSection.hidden = true;
          this.#pendingExternalPath = null;
          const pathEl = document.getElementById('create-vault-location');
          if (pathEl) {
            pathEl.hidden = true;
            pathEl.textContent = '';
          }
        }
      });
    });

    // Browse button for custom location
    document.getElementById('btn-choose-location')?.addEventListener('click', async () => {
      const nameInput = document.getElementById('new-vault-name');
      const defaultName = nameInput?.value?.trim() || 'My Vault';

      try {
        const result = await window.vault.showSaveDialog(defaultName);
        if (!result.canceled && result.filePath) {
          this.#pendingExternalPath = result.filePath;
          const pathEl = document.getElementById('create-vault-location');
          if (pathEl) {
            pathEl.textContent = result.filePath;
            pathEl.hidden = false;
          }
        }
      } catch (error) {
        this.#showToast(t('vault.messages.selectionError'), 'error');
      }
    });

    // Check Windows Hello availability when modal opens
    this.#checkHelloAvailabilityForCreate();

    // Toggle password visibility
    modal.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.setAttribute('aria-pressed', String(isPassword));
          btn.setAttribute('aria-label', isPassword ? t('vault.dialogs.hidePassword') : t('vault.quickUnlock.showPassword'));
        }
      });
    });

    // Vault name validation
    const vaultNameInput = document.getElementById('new-vault-name');
    const vaultNameMessage = document.getElementById('vault-name-message');
    vaultNameInput?.addEventListener('input', () => {
      this.#validateField(vaultNameInput, vaultNameMessage, {
        required: true,
        minLength: 1,
        maxLength: 50,
        requiredMessage: t('vault.validation.fieldRequired'),
        maxLengthMessage: t('vault.validation.maxLength', { count: 50 })
      });
    });
    vaultNameInput?.addEventListener('blur', () => {
      this.#validateField(vaultNameInput, vaultNameMessage, {
        required: true,
        requiredMessage: t('vault.validation.fieldRequired')
      });
    });

    // Password strength and validation
    const vaultPasswordInput = document.getElementById('new-vault-password');
    const vaultPasswordMessage = document.getElementById('vault-password-message');
    vaultPasswordInput?.addEventListener('input', (e) => {
      // Strength indicator
      const strength = this.#calculatePasswordStrength(e.target.value);
      const el = document.getElementById('new-password-strength');
      if (el) {
        el.innerHTML = `
          <div class="vault-strength-bar">
            <div class="vault-strength-fill ${strength.level}"></div>
          </div>
          <span class="vault-strength-text ${strength.level}">${strength.label}</span>
        `;
        // CSP-compliant: set width via CSS custom property
        const fill = el.querySelector('.vault-strength-fill');
        if (fill) fill.style.setProperty('--strength-width', `${strength.percent}%`);
      }
      // Validation message
      this.#validateField(vaultPasswordInput, vaultPasswordMessage, {
        required: true,
        minLength: 12,
        requiredMessage: t('vault.validation.fieldRequired'),
        minLengthMessage: t('vault.validation.minLength', { count: 12 })
      });
      // Re-validate confirm if has value
      const confirmInput = document.getElementById('new-vault-confirm');
      const confirmMessage = document.getElementById('vault-confirm-message');
      if (confirmInput?.value) {
        this.#validatePasswordMatch(confirmInput, vaultPasswordInput, confirmMessage);
      }
    });

    // Confirm password validation
    const vaultConfirmInput = document.getElementById('new-vault-confirm');
    const vaultConfirmMessage = document.getElementById('vault-confirm-message');
    vaultConfirmInput?.addEventListener('input', () => {
      this.#validatePasswordMatch(vaultConfirmInput, vaultPasswordInput, vaultConfirmMessage);
    });
    vaultConfirmInput?.addEventListener('blur', () => {
      this.#validatePasswordMatch(vaultConfirmInput, vaultPasswordInput, vaultConfirmMessage);
    });

    // Form submit
    document.getElementById('create-vault-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-vault-name')?.value;
      const password = document.getElementById('new-vault-password')?.value;
      const confirm = document.getElementById('new-vault-confirm')?.value;
      const enableHello = document.getElementById('new-vault-hello')?.checked;

      if (password !== confirm) {
        this.#showToast(t('vault.messages.passwordsNoMatch'), 'error');
        return;
      }
      if (password.length < 12) {
        this.#showToast(t('vault.messages.minCharactersRequired', { count: 12 }), 'error');
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner-small"></span> ${t('common.creating')}`;

      try {
        // Use custom path if set (external vault)
        const customPath = this.#pendingExternalPath;
        const result = await window.vault.create(name, password, customPath);

        // Enable Windows Hello if requested
        if (enableHello && result.vaultId) {
          try {
            await window.vault.hello.enable(result.vaultId, password);
            this.#showToast(t('vault.messages.vaultCreatedWithHello'), 'success');
          } catch (helloError) {
            safeLog('[VaultUI] Windows Hello enable failed:', helloError);
            this.#showToast(t('vault.messages.vaultCreatedWithoutHello'), 'warning');
          }
        } else {
          this.#showToast(customPath ? t('vault.messages.vaultCreatedAt', { path: customPath }) : t('vault.messages.vaultCreatedSuccess'), 'success');
        }

        this.#closeModal('create-vault-modal');
        this.#pendingExternalPath = null; // Reset
        this.#loadVaultList();
      } catch (error) {
        this.#showToast(error.message || t('vault.common.error'), 'error');
        btn.disabled = false;
        btn.textContent = t('vault.actions.createVault');
      }
    });

    // Reset form state when modal closes
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.#resetCreateVaultModal();
      }
    });
  }

  #resetCreateVaultModal() {
    this.#pendingExternalPath = null;
    const customSection = document.getElementById('custom-location-section');
    const pathEl = document.getElementById('create-vault-location');
    const defaultRadio = document.querySelector('input[name="vault-location-type"][value="default"]');

    if (customSection) customSection.hidden = true;
    if (pathEl) {
      pathEl.hidden = true;
      pathEl.textContent = '';
    }
    if (defaultRadio) defaultRadio.checked = true;
  }

  async #checkHelloAvailabilityForCreate() {
    const helloOption = document.getElementById('create-hello-option');
    if (!helloOption) return;

    try {
      const isAvailable = await window.vault?.hello?.isAvailable();
      helloOption.hidden = !isAvailable;
    } catch {
      helloOption.hidden = true;
    }
  }

  // Open external modal moved to ./vault/modals/vault-management.js

  #attachExternalVaultEvents() {
    const modal = document.getElementById('open-external-modal');
    if (!modal) return;

    // Close buttons
    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#closeModal('open-external-modal');
        this.#pendingExternalPath = null;
      });
    });

    // Toggle password visibility
    modal.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.setAttribute('aria-pressed', String(isPassword));
        }
      });
    });

    // Form submit
    document.getElementById('open-external-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('external-vault-password')?.value;

      if (!password) {
        this.#showToast(t('vault.messages.enterPassword'), 'warning');
        return;
      }

      if (!this.#pendingExternalPath) {
        this.#showToast(t('vault.messages.noFileSelected'), 'error');
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner-small"></span> ${t('common.opening')}`;

      try {
        await window.vault.openFromPath(this.#pendingExternalPath, password);
        this.#closeModal('open-external-modal');
        this.#pendingExternalPath = null;
        this.#showToast(t('vault.messages.vaultOpenedSuccess'), 'success');
      } catch (error) {
        this.#showToast(error.message || t('vault.misc.incorrectPassword'), 'error');
        btn.disabled = false;
        btn.textContent = t('vault.actions.open');
        document.getElementById('external-vault-password')?.select();
      }
    });
  }

  // ==================== MAIN VIEW (3-panel layout) ====================

  #renderMainView() {
    const filteredEntries = this.#getFilteredEntries();

    this.#container.innerHTML = `
      <div class="vault-app" role="application" aria-label="Password Manager">
        <!-- Sidebar -->
        <aside class="vault-sidebar" role="navigation" aria-label="Vault navigation">
          <!-- Sidebar Collapse Toggle -->
          <button class="vault-sidebar-collapse" id="sidebar-collapse-btn"
                  aria-label="${t('vault.sidebar.collapse') || 'Toggle sidebar'}"
                  title="${t('vault.sidebar.collapse') || 'Toggle sidebar'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <!-- Vault Selector -->
          <div class="vault-selector-header">
            <button class="vault-current" id="vault-switcher" aria-haspopup="true" aria-expanded="false">
              <div class="vault-current-icon" data-vault-color="${this.#getVaultColor()}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="vault-current-info">
                <span class="vault-current-name">${escapeHtml(this.#vaultMetadata?.name || 'Vault')}</span>
                <span class="vault-current-meta">${this.#entries.length} entry(ies)</span>
              </div>
              <svg class="vault-current-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="vault-switcher-dropdown" id="vault-switcher-dropdown" hidden>
              <div class="vault-switcher-section">
                <div class="vault-switcher-label">Current vault</div>
                <div class="vault-switcher-item current">
                  <div class="vault-switcher-icon" data-vault-color="${this.#getVaultColor()}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <span class="vault-switcher-name">${escapeHtml(this.#vaultMetadata?.name || 'Vault')}</span>
                  <svg class="vault-switcher-check" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <div class="vault-switcher-divider"></div>
              <div class="vault-switcher-actions">
                <button class="vault-switcher-action" id="btn-switch-vault">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                  </svg>
                  <span>${t('vault.sidebar.switchVault')}</span>
                </button>
                <button class="vault-switcher-action" id="btn-create-new-vault">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  <span>${t('vault.sidebar.newVault')}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="vault-sidebar-header">
            <div class="vault-lock-timer" id="lock-timer" role="timer" aria-live="polite" aria-label="Verrouillage automatique">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span id="lock-countdown">${this.#formatTime(this.#autoLockTimeout)}</span>
              <button class="vault-timer-settings" id="timer-settings" title="Configure delay" aria-label="Configure lock delay">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
            <button class="vault-icon-btn" id="btn-lock" data-tooltip="Lock (Ctrl+L)" data-tooltip-pos="bottom" aria-label="Lock vault">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            <button class="vault-icon-btn vault-theme-toggle" id="theme-toggle" data-tooltip="Switch theme" data-tooltip-pos="bottom" aria-label="Toggle light/dark theme" aria-pressed="${this.#theme === 'light'}">
              <svg class="theme-icon-dark" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              <svg class="theme-icon-light" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </button>
            <button class="vault-icon-btn vault-hello-settings" id="hello-settings" data-tooltip="Windows Hello" data-tooltip-pos="bottom" aria-label="Configure Windows Hello" hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <circle cx="8.5" cy="10" r="1.5"/>
                <circle cx="15.5" cy="10" r="1.5"/>
                <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
              </svg>
            </button>
            </button>
            <button class="vault-icon-btn" id="btn-cloud-sync" data-tooltip="Cloud Sync" data-tooltip-pos="bottom" aria-label="Configure cloud sync">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
              </svg>
            </button>
            <button class="vault-icon-btn" id="btn-duress-setup" data-tooltip="Duress Mode" data-tooltip-pos="bottom" aria-label="Configure duress mode">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </button>
          </div>

          <div class="vault-sidebar-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="search" class="vault-search-input" id="vault-search"
                   placeholder="${t('vault.placeholders.searchCtrlF')}" value="${escapeHtml(this.#searchQuery)}"
                   aria-label="Search vault">
            <button class="vault-filter-btn ${this.#hasActiveFilters() ? 'active' : ''}" id="filter-btn"
                    title="Advanced filters" aria-haspopup="true" aria-expanded="false">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              ${this.#hasActiveFilters() ? '<span class="filter-badge"></span>' : ''}
            </button>
          </div>
          <div class="vault-filter-panel" id="filter-panel" hidden>
            <div class="vault-filter-section">
              <label class="vault-filter-label">${t('vault.filters.type')}</label>
              <div class="vault-filter-chips" id="filter-type">
                <button class="vault-chip ${!this.#searchFilters.type ? 'active' : ''}" data-filter-type="" aria-label="${t('vault.filters.ariaAllTypes')}">${t('vault.filters.allTypes')}</button>
                ${Object.entries(ENTRY_TYPES).map(([key, val]) => `
                  <button class="vault-chip ${this.#searchFilters.type === key ? 'active' : ''}" data-filter-type="${key}">
                    ${val.icon} ${val.label}
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="vault-filter-section">
              <label class="vault-filter-label">${t('vault.filters.passwordStrength')}</label>
              <div class="vault-filter-chips" id="filter-strength">
                <button class="vault-chip ${!this.#searchFilters.strength ? 'active' : ''}" data-filter-strength="" aria-label="${t('vault.filters.ariaAllStrengths')}">${t('vault.filters.allStrengths')}</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'weak' ? 'active' : ''}" data-filter-strength="weak" aria-label="${t('vault.filters.ariaLowStrength')}"><span aria-hidden="true">🔴</span> ${t('vault.filters.weak')}</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'medium' ? 'active' : ''}" data-filter-strength="medium" aria-label="${t('vault.filters.ariaMediumStrength')}"><span aria-hidden="true">🟡</span> ${t('vault.filters.medium')}</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'strong' ? 'active' : ''}" data-filter-strength="strong" aria-label="${t('vault.filters.ariaHighStrength')}"><span aria-hidden="true">🟢</span> ${t('vault.filters.strong')}</button>
              </div>
            </div>
            <div class="vault-filter-section">
              <label class="vault-filter-label">${t('vault.filters.passwordAge')}</label>
              <div class="vault-filter-chips" id="filter-age">
                <button class="vault-chip ${!this.#searchFilters.age ? 'active' : ''}" data-filter-age="" aria-label="${t('vault.filters.ariaAllAges')}">${t('vault.filters.allAges')}</button>
                <button class="vault-chip ${this.#searchFilters.age === 'recent' ? 'active' : ''}" data-filter-age="recent" aria-label="${t('vault.filters.ariaRecent')}">${t('vault.filters.recent')}</button>
                <button class="vault-chip ${this.#searchFilters.age === 'old' ? 'active' : ''}" data-filter-age="old" aria-label="${t('vault.filters.ariaOld')}">${t('vault.filters.old')}</button>
                <button class="vault-chip ${this.#searchFilters.age === 'expiring' ? 'active' : ''}" data-filter-age="expiring" aria-label="${t('vault.filters.ariaExpiring')}"><span aria-hidden="true">⏰</span> ${t('vault.filters.expiring')}</button>
                <button class="vault-chip ${this.#searchFilters.age === 'expired' ? 'active' : ''}" data-filter-age="expired" aria-label="${t('vault.filters.ariaExpired')}"><span aria-hidden="true">⚠️</span> ${t('vault.filters.expired')}</button>
              </div>
            </div>
            <div class="vault-filter-actions">
              <button class="vault-btn vault-btn-sm vault-btn-secondary" id="clear-filters" aria-label="${t('vault.filters.ariaReset')}">${t('vault.filters.reset')}</button>
            </div>
          </div>

          <nav class="vault-nav" aria-label="Categories">
            <div class="vault-nav-section">
              <div class="vault-nav-title">Categories</div>
              ${getCategories().map(cat => `
                <button class="vault-nav-item ${this.#selectedCategory === cat.id ? 'active' : ''}"
                        data-category="${cat.id}"
                        aria-current="${this.#selectedCategory === cat.id ? 'true' : 'false'}">
                  <span class="vault-nav-icon" aria-hidden="true">${cat.icon}</span>
                  <span class="vault-nav-label">${cat.label}</span>
                  <span class="vault-nav-count" aria-label="${this.#getCategoryCount(cat.id)} entries">${this.#getCategoryCount(cat.id)}</span>
                </button>
              `).join('')}
            </div>

            <div class="vault-nav-section">
              <div class="vault-nav-title vault-nav-title-with-action">
                <span>Folders</span>
                <button class="vault-nav-add-btn" id="btn-add-folder" title="${t('vault.dialogs.newFolder')}" aria-label="${t('vault.dialogs.newFolder')}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
              <div class="vault-folder-tree" role="tree" aria-label="Folders">
                ${this.#renderFolderTree()}
              </div>
            </div>

            <div class="vault-nav-section">
              <div class="vault-nav-title vault-nav-title-with-action">
                <span>Tags</span>
                <button class="vault-nav-add-btn" id="btn-add-tag" title="New tag" aria-label="Create tag">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
              ${this.#renderTagsList()}
            </div>
          </nav>

          <div class="vault-sidebar-footer">
            <div class="vault-sync-status" id="vault-sync-status" hidden>
               <span class="vault-sync-icon" id="vault-sync-icon"></span>
               <span class="vault-sync-text" id="vault-sync-text">Ready</span>
            </div>
            <button class="vault-btn vault-btn-outline vault-btn-full" id="btn-health-dashboard" title="Analyze password health" aria-label="Analyze password health">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              ${t('vault.sidebar.passwordHealth')}
            </button>
            <button class="vault-btn vault-btn-primary vault-btn-full" id="btn-add-entry">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              ${t('vault.sidebar.newEntry')}
            </button>
          </div>
        </aside>

        <!-- Entry List -->
        <main class="vault-list-panel" role="main">
          <div class="vault-list-header">
            <div class="vault-list-header-top">
              ${this.#renderBreadcrumb()}
              <span class="vault-list-count">${filteredEntries.length} entry(ies)</span>
            </div>
            <div class="vault-list-toolbar">
              <div class="vault-sort-dropdown">
                <button class="vault-sort-btn" id="sort-btn" aria-haspopup="listbox" aria-expanded="false">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="4" y1="6" x2="20" y2="6"></line>
                    <line x1="4" y1="12" x2="16" y2="12"></line>
                    <line x1="4" y1="18" x2="12" y2="18"></line>
                  </svg>
                  <span>${getSortOptions().find(s => s.id === this.#sortBy)?.label || 'Sort'}</span>
                </button>
                <div class="vault-sort-menu" id="sort-menu" role="listbox" hidden>
                  ${getSortOptions().map(opt => `
                    <button class="vault-sort-option ${this.#sortBy === opt.id ? 'active' : ''}"
                            data-sort="${opt.id}" role="option" aria-selected="${this.#sortBy === opt.id}">
                      <span class="sort-icon">${opt.icon}</span>
                      <span>${opt.label}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
              <button class="vault-view-toggle ${this.#viewMode === 'compact' ? 'compact' : ''}" id="view-toggle"
                      title="${this.#viewMode === 'compact' ? 'Comfortable view' : 'Compact view'}"
                      aria-label="Toggle display density"
                      aria-pressed="${this.#viewMode === 'compact'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  ${this.#viewMode === 'compact' ? `
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                  ` : `
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  `}
                </svg>
              </button>
              <button class="vault-help-btn" id="shortcuts-help" title="Keyboard shortcuts (?)" aria-label="Show keyboard shortcuts">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </button>
              <button class="vault-icon-btn vault-health-btn" id="health-dashboard" data-tooltip="Password Health" data-tooltip-pos="bottom" aria-label="Health dashboard">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </button>
              <div class="vault-toolbar-divider"></div>
              <button class="vault-icon-btn" id="btn-export" data-tooltip="Export" data-tooltip-pos="bottom" aria-label="Export entries">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="vault-icon-btn" id="btn-import" data-tooltip="Import" data-tooltip-pos="bottom" aria-label="Import entries">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </button>
              <div class="vault-toolbar-divider"></div>
              <button class="vault-icon-btn vault-save-btn" id="btn-save-vault" data-tooltip="Save as..." data-tooltip-pos="bottom" aria-label="Save vault">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              </button>
              <div class="vault-toolbar-divider"></div>
              <button class="vault-icon-btn vault-compact-btn" id="btn-compact-mode" data-tooltip="Mode compact (widget flottant)" data-tooltip-pos="bottom" aria-label="Basculer en mode compact">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Bulk Actions Bar -->
          <div class="vault-bulk-actions ${this.#selectedEntries.size > 0 ? 'visible' : ''}" id="bulk-actions">
            <label class="vault-checkbox-wrapper select-all">
              <input type="checkbox" class="vault-checkbox" id="select-all"
                     ${this.#selectedEntries.size === filteredEntries.length && filteredEntries.length > 0 ? 'checked' : ''}
                     aria-label="Select all">
              <span class="vault-checkbox-mark"></span>
            </label>
            <span class="vault-bulk-count">${this.#selectedEntries.size} selected</span>
            <div class="vault-bulk-buttons">
              <button class="vault-bulk-btn" id="bulk-move" title="Move to folder" aria-label="Move selected entries to folder">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Move
              </button>
              <button class="vault-bulk-btn" id="bulk-export" title="Export selection" aria-label="Export selected entries">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
              </button>
              <button class="vault-bulk-btn" id="bulk-tag" title="Manage tags" aria-label="Manage tags for selected entries">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                Tags
              </button>
              <button class="vault-bulk-btn vault-bulk-btn-danger" id="bulk-delete" title="Delete selection" aria-label="Delete selected entries">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete
              </button>
              <button class="vault-bulk-btn" id="bulk-cancel" title="Cancel selection" aria-label="Cancel selection">
                Cancel
              </button>
            </div>
          </div>

          <div class="vault-list-content ${this.#viewMode}" id="vault-entries" role="listbox" aria-label="Entry list">
            ${filteredEntries.length === 0
        ? renderEmptyState({ searchQuery: this.#searchQuery, t })
        : filteredEntries.map((entry, idx) => this.#renderEntryRow(entry, idx)).join('')
      }
          </div>
        </main>

        <!-- Detail Panel -->
        <aside class="vault-detail-panel ${this.#selectedEntry ? '' : 'empty'}" id="detail-panel"
               role="complementary" aria-label="Entry details">
          ${this.#selectedEntry ? this.#renderEntryDetail() : renderNoSelection()}
        </aside>
      </div>
      ${renderAddEntryModal({ entryTypes: ENTRY_TYPES, folders: this.#folders, tags: this.#tags, templateGridHtml: renderTemplateGrid(), t })}
      ${renderAddFolderModal({ t })}
      ${renderEditEntryModal({ t })}
      ${renderShortcutsModal({ t })}
      ${renderHealthDashboard({ t })}
      ${renderMoveFolderModal({ folders: this.#folders, t })}
      ${renderAddTagModal({ t })}
      ${renderEditTagModal({ t })}
      ${renderImportModal({ t })}
    `;

    this.#attachMainViewEvents();
    this.#applyCspCompliantStyles();
    this.#updateLockCountdown();
    this.#initTheme();
    this.#restoreSidebarState();
  }

  // ==================== FOLDER TREE VIEW ====================

  /** @type {Set<string>} Expanded folder IDs */
  #expandedFolders = new Set();

  /**
   * Build a hierarchical tree from flat folder list
   * @returns {Array} Tree structure with children arrays
   */
  #buildFolderTree() {
    const childMap = new Map(); // parentId -> children[]

    // First pass: group by parentId
    for (const folder of this.#folders) {
      const parentId = folder.parentId || null;
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId).push(folder);
    }

    // Build tree recursively
    const buildNode = (folder, depth = 0) => {
      const children = childMap.get(folder.id) || [];
      const entryCount = this.#entries.filter(e => e.folderId === folder.id).length;
      const descendantCount = this.#getDescendantEntryCount(folder.id, childMap);

      return {
        ...folder,
        depth,
        entryCount,
        totalCount: entryCount + descendantCount,
        children: children.map(child => buildNode(child, depth + 1)),
        hasChildren: children.length > 0
      };
    };

    // Start with root folders (no parent)
    const roots = childMap.get(null) || [];
    return roots.map(folder => buildNode(folder, 0));
  }

  /**
   * Get total entry count for all descendants of a folder
   */
  #getDescendantEntryCount(folderId, childMap) {
    let count = 0;
    const children = childMap.get(folderId) || [];
    for (const child of children) {
      count += this.#entries.filter(e => e.folderId === child.id).length;
      count += this.#getDescendantEntryCount(child.id, childMap);
    }
    return count;
  }

  /**
   * Render the folder tree as HTML
   */
  #renderFolderTree() {
    if (this.#folders.length === 0) {
      return '<div class="vault-nav-empty">No folders</div>';
    }

    const tree = this.#buildFolderTree();
    return this.#renderFolderNodes(tree);
  }

  /**
   * Render folder nodes recursively
   * @param {Array} nodes
   * @returns {string} HTML
   */
  #renderFolderNodes(nodes) {
    return nodes.map(node => {
      const isExpanded = this.#expandedFolders.has(node.id);
      const isSelected = this.#selectedFolder === node.id;
      const folderColor = this.#getFolderColor(node.id);
      const paddingLeft = node.depth * 16;

      const expandIcon = node.hasChildren ? `
        <button class="vault-folder-toggle ${isExpanded ? 'expanded' : ''}"
                data-folder-toggle="${node.id}"
                aria-expanded="${isExpanded}"
                aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${node.name}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      ` : '<span class="vault-folder-toggle-spacer"></span>';

      const folderIcon = isExpanded && node.hasChildren ? '📂' : '📁';

      let html = `
        <div class="vault-folder-node" role="treeitem" aria-selected="${isSelected}" data-folder-depth="${node.depth}">
          <button class="vault-nav-item vault-folder-item vault-nav-folder ${isSelected ? 'active' : ''}"
                  data-folder="${node.id}"
                  data-padding="${8 + paddingLeft}"
                  aria-current="${isSelected ? 'true' : 'false'}"
                  draggable="true">
            ${expandIcon}
            <span class="vault-nav-icon vault-folder-color" ${folderColor ? `data-folder-color="${folderColor}"` : ''} aria-hidden="true">${folderIcon}</span>
            <span class="vault-nav-label">${escapeHtml(node.name)}</span>
            <span class="vault-nav-count" title="${node.entryCount} in this folder, ${node.totalCount} total">${node.totalCount}</span>
          </button>
      `;

      // Render children if expanded
      if (node.hasChildren && isExpanded) {
        html += `<div class="vault-folder-children" role="group">${this.#renderFolderNodes(node.children)}</div>`;
      }

      html += '</div>';
      return html;
    }).join('');
  }

  /**
   * Toggle folder expansion state
   * @param {string} folderId
   */
  #toggleFolderExpand(folderId) {
    if (this.#expandedFolders.has(folderId)) {
      this.#expandedFolders.delete(folderId);
    } else {
      this.#expandedFolders.add(folderId);
    }
    // Re-render just the folder tree section
    const treeContainer = document.querySelector('.vault-folder-tree');
    if (treeContainer) {
      treeContainer.innerHTML = this.#renderFolderTree();
      this.#attachFolderTreeEvents();
      this.#applyCspCompliantStyles(treeContainer);
    }
  }

  /**
   * Attach event listeners to folder tree
   */
  #attachFolderTreeEvents() {
    // Toggle expand/collapse
    document.querySelectorAll('.vault-folder-toggle[data-folder-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleFolderExpand(btn.dataset.folderToggle);
      });
    });

    // Select folder
    document.querySelectorAll('.vault-folder-item[data-folder]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.vault-folder-toggle')) return;
        this.#selectedFolder = btn.dataset.folder;
        this.#selectedCategory = 'all';
        this.#selectedTag = null;
        this.#render();
      });

      // Context menu
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showFolderContextMenu({
          folderId: btn.dataset.folder,
          x: e.clientX,
          y: e.clientY,
          t,
          onAction: (action, folderId, x, y) => this.#handleFolderContextMenuAction(action, folderId, x, y)
        });
      });

      // Drag and drop
      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        btn.classList.add('drag-over');
      });
      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-over');
      });
      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        const folderId = btn.dataset.folder;
        if (this.#selectedEntries.size > 0) {
          await this.#moveEntriesToFolder([...this.#selectedEntries], folderId);
        } else if (this.#draggedEntry) {
          await this.#moveEntriesToFolder([this.#draggedEntry.id], folderId);
        }
      });
    });
  }

  // Folder context menu moved to ./vault/components/folder-context-menu.js

  /**
   * Handle folder context menu action
   * @param {string} action - Action type
   * @param {string} folderId - Folder ID
   * @param {number} x - X position for color picker
   * @param {number} y - Y position for color picker
   */
  async #handleFolderContextMenuAction(action, folderId, x, y) {
    try {
      switch (action) {
        case FOLDER_ACTIONS.RENAME:
          this.#showRenameFolderModal(folderId);
          break;
        case FOLDER_ACTIONS.ADD_SUBFOLDER:
          this.#showAddSubfolderModal(folderId);
          break;
        case FOLDER_ACTIONS.COLOR:
          this.#showFolderColorPicker(folderId, x, y);
          break;
        case FOLDER_ACTIONS.DELETE:
          await this.#confirmDeleteFolder(folderId);
          break;
      }
    } catch (error) {
      this.#showToast(error.message || t('vault.messages.operationFailed'), 'error');
    }
  }

  /**
   * Show modal to rename a folder
   */
  async #showRenameFolderModal(folderId) {
    const folder = this.#folders.find(f => f.id === folderId);
    if (!folder) return;

    const newName = prompt(t('vault.dialogs.newFolderName'), folder.name);
    if (newName && newName.trim() && newName !== folder.name) {
      try {
        await window.vault.folders.update(folderId, { name: newName.trim() });
        this.#showToast(t('vault.messages.folderRenamed'), 'success');
        await this.#loadData();
        this.#render();
      } catch (e) {
        this.#showToast(`${t('vault.common.error')}: ${e.message}`, 'error');
      }
    }
  }

  /**
   * Show modal to add a subfolder
   */
  async #showAddSubfolderModal(parentId) {
    const name = prompt(t('vault.dialogs.newSubfolderName'));
    if (name && name.trim()) {
      try {
        await window.vault.folders.add(name.trim(), parentId);
        // Auto-expand the parent
        this.#expandedFolders.add(parentId);
        this.#showToast(t('vault.messages.subfolderCreated'), 'success');
        await this.#loadData();
        this.#render();
      } catch (e) {
        this.#showToast(`${t('vault.common.error')}: ${e.message}`, 'error');
      }
    }
  }

  /**
   * Confirm and delete a folder
   */
  async #confirmDeleteFolder(folderId) {
    const folder = this.#folders.find(f => f.id === folderId);
    if (!folder) return;

    const entryCount = this.#entries.filter(e => e.folderId === folderId).length;
    const message = entryCount > 0
      ? t('vault.messages.deleteFolderWithEntriesConfirm', { name: folder.name, count: entryCount })
      : t('vault.messages.deleteFolderConfirm', { name: folder.name });

    const confirmed = await showConfirm(message, {
      title: t('vault.actions.deleteFolder') || 'Delete Folder',
      confirmLabel: t('common.delete') || 'Delete',
      danger: true
    });
    if (confirmed) {
      try {
        await window.vault.folders.delete(folderId, false); // Don't delete entries
        if (this.#selectedFolder === folderId) {
          this.#selectedFolder = null;
        }
        this.#showToast(t('vault.messages.folderDeleted'), 'success');
        await this.#loadData();
        this.#render();
      } catch (e) {
        this.#showToast(`${t('vault.common.error')}: ${e.message}`, 'error');
      }
    }
  }

  #renderBreadcrumb() {
    let label = t('vault.sidebar.allItems');

    if (this.#selectedTag) {
      const tag = this.#tags.find(t => t.id === this.#selectedTag);
      label = tag ? `🏷️ ${tag.name}` : 'Tag';
    } else if (this.#selectedFolder) {
      const folder = this.#folders.find(f => f.id === this.#selectedFolder);
      label = folder ? folder.name : 'Folder';
    } else if (this.#selectedCategory !== 'all') {
      const cat = getCategories().find(c => c.id === this.#selectedCategory);
      label = cat?.label || 'Category';
    }

    return `
      <nav class="vault-breadcrumb" aria-label="Breadcrumb">
        <span class="vault-breadcrumb-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Vault
</span>
        <span class="vault-breadcrumb-separator" aria-hidden="true">›</span>
        <span class="vault-breadcrumb-item current">${escapeHtml(label)}</span>
      </nav>
    `;
  }

  #renderEntryRow(entry, index) {
    const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
    const subtitle = entry.data?.username || entry.data?.url || type.label;
    const isSelected = this.#selectedEntry?.id === entry.id;
    const isMultiSelected = this.#selectedEntries.has(entry.id);
    const isFavorite = entry.favorite;
    const isPinned = entry.pinned;
    const strength = entry.type === 'login' && entry.data?.password
      ? getPasswordStrength(entry.data.password)
      : null;
    const isDuplicate = entry.type === 'login' && entry.data?.password
      ? isPasswordDuplicated(entry.data.password, entry.id, this.#entries)
      : false;
    const expiryStatus = this.#getExpiryStatus(entry);

    return `
      <div class="vault-entry-row ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${isPinned ? 'pinned' : ''}"
           data-entry-id="${entry.id}"
           data-entry-index="${index}"
           role="option"
           aria-selected="${isSelected || isMultiSelected}"
           tabindex="${isSelected ? 0 : -1}"
           draggable="true">
        <label class="vault-checkbox-wrapper" title="Select">
          <input type="checkbox" class="vault-checkbox" data-action="multi-select"
                 ${isMultiSelected ? 'checked' : ''} aria-label="Select ${escapeHtml(entry.title)}">
          <span class="vault-checkbox-mark"></span>
        </label>
        <button class="vault-fav-toggle ${isFavorite ? 'active' : ''}"
                data-action="toggle-favorite"
                title="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-label="${isFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                aria-pressed="${isFavorite}">
          ${isFavorite ? '★' : '☆'}
        </button>
        <div class="vault-entry-icon" data-type-color="${type.color}" aria-hidden="true">
          ${entry.data?.url ? this.#renderFaviconImg(entry.data.url, 20) : type.icon}
        </div>
        <div class="vault-entry-content">
          <div class="vault-entry-title">
            ${isPinned ? `<span class="vault-pin-badge" role="img" aria-label="${t('vault.entryCard.pinned')}"><span aria-hidden="true">📌</span></span>` : ''}
            ${escapeHtml(entry.title)}
            ${strength ? `<span class="vault-strength-dot ${strength}" role="img" aria-label="${t('vault.entryCard.strengthPrefix')}: ${t('vault.filters.' + strength)}" title="${t('vault.entryCard.strengthTitle')}: ${t('vault.filters.' + strength)}"></span>` : ''}
            ${isDuplicate ? `<span class="vault-duplicate-badge" role="img" aria-label="${t('vault.entryCard.reusedPassword')}" title="${t('vault.entryCard.reusedPassword')}"><span aria-hidden="true">🔁</span></span>` : ''}
            ${expiryStatus.badge}
          </div>
          <div class="vault-entry-subtitle">${escapeHtml(subtitle)}</div>
          ${this.#renderTagsInRow(entry)}
        </div>
        <div class="vault-entry-actions" role="group" aria-label="Quick actions">
          ${entry.type === 'login' && entry.data?.username ? `
            <button class="vault-quick-btn copy-user" data-action="copy-username"
                    title="${t('vault.actions.copyUsername')}" aria-label="${t('vault.actions.copyUsername')}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          ` : ''}
          ${entry.type === 'login' && entry.data?.password ? `
            <button class="vault-quick-btn copy-pass" data-action="copy-password"
                    title="${t('vault.actions.copyPassword')}" aria-label="${t('vault.actions.copyPassword')}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          ` : ''}
          ${entry.data?.url ? `
            <button class="vault-quick-btn open-url" data-action="open-url"
                    title="Open website" aria-label="Open website in new tab">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  #renderEntryDetail() {
    const entry = this.#selectedEntry;
    if (!entry) return '';

    const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;

    return `
      <div class="vault-detail-header">
        <div class="vault-detail-icon" data-type-color="${type.color}" aria-hidden="true">
          ${entry.data?.url ? this.#renderFaviconImg(entry.data.url, 32) : type.icon}
        </div>
        <div class="vault-detail-info">
          <h3 class="vault-detail-title">${escapeHtml(entry.title)}</h3>
          <span class="vault-detail-type">${type.label}</span>
          <div class="vault-detail-tags">${this.#renderTagsInDetail(entry)}</div>
        </div>
        <div class="vault-detail-actions" role="group" aria-label="${t('vault.aria.entryActions') || 'Entry actions'}">
          <button class="vault-icon-btn ${entry.favorite ? 'active' : ''}" id="btn-toggle-favorite"
                  data-tooltip="${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                  aria-label="${entry.favorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites')}"
                  aria-pressed="${entry.favorite}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${entry.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button class="vault-icon-btn" id="btn-edit-entry" data-tooltip="${t('vault.common.edit')} (E)" aria-label="${t('vault.dialogs.editEntry')}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="vault-icon-btn" id="btn-duplicate-entry" data-tooltip="${t('vault.common.duplicate')}" aria-label="${t('vault.common.duplicate')}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          ${entry.type === 'login' ? `
          <button class="vault-icon-btn autotype" id="btn-autotype" data-tooltip="${t('vault.actions.autoFill') || 'Auto-fill'} (Ctrl+Shift+U)" aria-label="${t('vault.actions.autoFill') || 'Auto-fill form'}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="6" y1="8" x2="6" y2="8"></line>
              <line x1="10" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="16" x2="14" y2="16"></line>
            </svg>
          </button>
          ` : ''}
          <button class="vault-icon-btn share" id="btn-share-entry" data-tooltip="${t('vault.share.title')}" aria-label="${t('vault.share.title')}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
          <button class="vault-icon-btn danger" id="btn-delete-entry" data-tooltip="${t('vault.common.delete')}" data-tooltip-pos="left" aria-label="${t('vault.common.delete')}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="vault-detail-body">
        ${this.#renderEntryFields(entry)}
        ${this.#renderCustomFieldsDisplay(entry)}
        ${this.#renderPasswordAge(entry)}

        <div class="vault-detail-meta">
          <div class="vault-meta-row">
            <div class="vault-meta-item">
              <span class="vault-meta-label">${t('vault.detail.created')}</span>
              <span class="vault-meta-value">${formatDateTime(entry.createdAt || entry.metadata?.createdAt)}</span>
            </div>
            <div class="vault-meta-item">
              <span class="vault-meta-label">${t('vault.detail.modified')}</span>
              <span class="vault-meta-value">${formatDateTime(entry.modifiedAt || entry.metadata?.updatedAt)}</span>
            </div>
          </div>
          ${entry.metadata?.lastUsedAt ? `
            <div class="vault-meta-row">
              <div class="vault-meta-item">
                <span class="vault-meta-label">Last used</span>
                <span class="vault-meta-value">${formatDateTime(entry.metadata.lastUsedAt)}</span>
              </div>
              <div class="vault-meta-item">
                <span class="vault-meta-label">Uses</span>
                <span class="vault-meta-value">${entry.metadata.usageCount || 0}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  #renderEntryFields(entry) {
    switch (entry.type) {
      case 'login':
        return `
          ${this.#renderField(t('vault.labels.username'), entry.data?.username, 'username', false, true)}
          ${this.#renderField(t('vault.labels.password'), entry.data?.password, 'password', true, true)}
          ${this.#renderPasswordHistory(entry)}
          ${entry.data?.totp ? this.#renderTOTPField(entry) : ''}
          ${this.#renderField(t('vault.labels.url'), entry.data?.url, 'url', false, true, true)}
          ${this.#renderExpirationField(entry)}
          ${entry.notes ? this.#renderNotesField(entry.notes) : ''}
        `;
      case 'note':
        return `
          <div class="vault-field vault-notes-field">
            <div class="vault-field-label-row">
              <label class="vault-field-label">${t('vault.fields.content') || 'Content'}</label>
              <div class="vault-notes-toggle">
                <button type="button" class="vault-notes-mode active" data-mode="preview" title="${t('vault.actions.preview') || 'Preview'}" aria-label="${t('vault.actions.previewMode') || 'Preview mode'}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <button type="button" class="vault-notes-mode" data-mode="source" title="${t('vault.actions.sourceMarkdown') || 'Source Markdown'}" aria-label="${t('vault.actions.editSourceMode') || 'Edit source mode'}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            <div class="vault-notes-content">
              <div class="vault-notes-preview markdown-body" data-mode="preview">
                ${this.#parseMarkdown(entry.data?.content || '')}
              </div>
              <pre class="vault-notes-source" data-mode="source" hidden>${escapeHtml(entry.data?.content || '')}</pre>
            </div>
          </div>
        `;
      case 'card':
        return `
          ${this.#renderField(t('vault.labels.holder'), entry.data?.holder)}
          ${this.#renderField(t('vault.labels.cardNumber'), entry.data?.number, 'number', true, true)}
          ${this.#renderField(t('vault.labels.expiration'), entry.data?.expiry)}
          ${this.#renderField(t('vault.labels.cvv') || 'CVV', entry.data?.cvv, 'cvv', true, true)}
        `;
      case 'identity':
        return `
          ${this.#renderField(t('vault.labels.fullName'), entry.data?.fullName)}
          ${this.#renderField(t('vault.labels.email'), entry.data?.email, 'email', false, true)}
          ${this.#renderField(t('vault.labels.phone'), entry.data?.phone, 'phone', false, true)}
        `;
      default:
        return '';
    }
  }

  /**
   * Render custom fields for display in the detail view
   * @param {Object} entry - The entry object
   * @returns {string} HTML string
   */
  #renderCustomFieldsDisplay(entry) {
    const fields = entry.data?.fields || entry.fields || [];
    if (!fields || fields.length === 0) return '';

    const fieldKindLabels = {
      text: 'Text',
      hidden: 'Hidden',
      password: 'Password',
      url: 'URL',
      email: 'Email',
      phone: 'Phone',
      date: 'Date'
    };

    return `
      <div class="vault-custom-fields-display">
        <div class="vault-section-divider">
          <span class="vault-section-divider-text">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            ${t('vault.labels.customFields')}
          </span>
        </div>
        ${fields.map(field => {
      const isMasked = field.isSecured || field.kind === 'hidden' || field.kind === 'password';
      const isUrl = field.kind === 'url';
      const isEmail = field.kind === 'email';
      const isPhone = field.kind === 'phone';
      const isDate = field.kind === 'date';

      // Format value based on type
      let displayValue = escapeHtml(field.value || '');
      if (isUrl && field.value) {
        displayValue = `<a href="${escapeHtml(field.value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(field.value)}</a>`;
      } else if (isEmail && field.value) {
        displayValue = `<a href="mailto:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
      } else if (isPhone && field.value) {
        displayValue = `<a href="tel:${escapeHtml(field.value)}">${escapeHtml(field.value)}</a>`;
      } else if (isDate && field.value) {
        try {
          const date = new Date(field.value);
          displayValue = date.toLocaleDateString('en-US');
        } catch {
          displayValue = escapeHtml(field.value);
        }
      }

      const maskedValue = isMasked ? '•'.repeat(Math.min((field.value || '').length, 24)) : displayValue;

      return `
            <div class="vault-field vault-custom-field-display" data-field-id="${escapeHtml(field.id || '')}" data-masked="${isMasked}">
              <div class="vault-field-label-row">
                <label class="vault-field-label">${escapeHtml(field.label)}</label>
                ${field.isSecured ? '<span class="vault-field-badge secure">🔒 Secured</span>' : ''}
                <span class="vault-field-kind-badge">${fieldKindLabels[field.kind] || field.kind}</span>
              </div>
              <div class="vault-field-value ${isMasked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(field.value || '')}">
                <span class="vault-field-text ${isMasked ? 'masked' : ''}" data-value="${escapeHtml(field.value || '')}">
                  ${isMasked ? maskedValue : displayValue}
                </span>
                <span class="vault-field-revealed">${escapeHtml(field.value || '')}</span>
                <div class="vault-field-actions">
                  ${isMasked ? `
                    <button class="vault-field-btn toggle-visibility" title="${t('vault.aria.toggleVisibility')}" aria-label="${t('vault.aria.toggleVisibility')}" aria-pressed="false">
                      <svg class="icon-show" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg class="icon-hide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" hidden>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </button>
                  ` : ''}
                  <button class="vault-field-btn copy-field" data-value="${escapeHtml(field.value || '')}" title="Copier" aria-label="Copier ${escapeHtml(field.label)}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  #renderField(label, value, key = '', masked = false, copyable = false, isUrl = false) {
    if (!value) return '';

    // Dynamic masking based on actual value length
    const maskedValue = masked ? '•'.repeat(Math.min(value.length, 24)) : escapeHtml(value);
    const strengthHtml = key === 'password' ? this.#renderPasswordStrength(value) : '';
    const breachHtml = key === 'password' ? '<div class="vault-breach-indicator" id="password-breach-indicator"></div>' : '';

    return `
      <div class="vault-field" data-key="${key}" data-masked="${masked}">
        <div class="vault-field-label-row">
          <label class="vault-field-label">${label}</label>
          ${masked ? `<span class="vault-field-hint">${t('vault.detail.hoverToReveal')}</span>` : ''}
          ${breachHtml}
        </div>
        <div class="vault-field-value ${masked ? 'vault-reveal-on-hover' : ''}" data-real-value="${escapeHtml(value)}">
          <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${escapeHtml(value)}">
            ${isUrl ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : maskedValue}
          </span>
          <span class="vault-field-revealed">${escapeHtml(value)}</span>
          <div class="vault-field-actions">
            ${masked ? `
              <button class="vault-field-btn toggle-visibility" title="${t('vault.aria.toggleVisibility')}" aria-label="${t('vault.aria.toggleVisibility')}" aria-pressed="false">
                <svg class="icon-show" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="icon-hide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" hidden>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            ` : ''}
            ${copyable ? `
              <button class="vault-field-btn copy-field" data-value="${escapeHtml(value)}" title="Copier" aria-label="Copier ${label}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
        ${strengthHtml}
      </div>
    `;
  }

  // ==================== EXPIRATION FIELD ====================

  #renderExpirationField(entry) {
    if (!entry.data?.expiresAt) return '';

    const status = this.#getExpiryStatus(entry);
    const expiresDate = new Date(entry.data.expiresAt);
    const formattedDate = expiresDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let statusClass = '';
    let statusIcon = '📅';
    switch (status.status) {
      case 'expired':
        statusClass = 'expired';
        statusIcon = '⚠️';
        break;
      case 'today':
        statusClass = 'today';
        statusIcon = '⏰';
        break;
      case 'soon':
        statusClass = 'soon';
        statusIcon = '🕐';
        break;
      case 'warning':
        statusClass = 'warning';
        statusIcon = '📅';
        break;
      default:
        statusClass = 'valid';
        statusIcon = '✅';
    }

    return `
      <div class="vault-field vault-expiry-field ${statusClass}">
        <div class="vault-field-label-row">
          <label class="vault-field-label">Password expiration</label>
        </div>
        <div class="vault-expiry-display ${statusClass}">
          <span class="vault-expiry-icon">${statusIcon}</span>
          <div class="vault-expiry-info">
            <span class="vault-expiry-date">${formattedDate}</span>
            <span class="vault-expiry-status">${status.label}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== MARKDOWN SUPPORT ====================

  #renderNotesField(notes) {
    if (!notes) return '';

    return `
      <div class="vault-field vault-notes-field">
        <div class="vault-field-label-row">
          <label class="vault-field-label">${t('vault.labels.notes')}</label>
          <div class="vault-notes-toggle">
            <button type="button" class="vault-notes-mode active" data-mode="preview" title="Preview">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="vault-notes-mode" data-mode="source" title="Source Markdown">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="vault-notes-content">
          <div class="vault-notes-preview markdown-body" data-mode="preview">
            ${this.#parseMarkdown(notes)}
          </div>
          <pre class="vault-notes-source" data-mode="source" hidden>${escapeHtml(notes)}</pre>
        </div>
      </div>
    `;
  }

  #parseMarkdown(text) {
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

  #renderTOTPField(entry) {
    const totpSecret = entry.data?.totp;
    if (!totpSecret) return '';

    return `
      <div class="vault-field vault-totp-field" data-key="totp" data-entry-id="${entry.id}">
        <div class="vault-field-label-row">
          <label class="vault-field-label">Code 2FA (TOTP)</label>
          <span class="vault-field-hint">(actualisation auto)</span>
        </div>
        <div class="vault-totp-display">
          <div class="vault-totp-code" data-secret="${escapeHtml(totpSecret)}">
            <span class="totp-digits">------</span>
          </div>
          <div class="vault-totp-timer">
            <svg class="totp-timer-ring" viewBox="0 0 36 36">
              <circle class="totp-timer-bg" cx="18" cy="18" r="16"></circle>
              <circle class="totp-timer-progress" cx="18" cy="18" r="16"></circle>
            </svg>
            <span class="totp-timer-text">--</span>
          </div>
          <button class="vault-field-btn copy-totp" title="Copier le code 2FA" aria-label="Copier le code 2FA">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="vault-field-btn show-totp-qr" data-secret="${escapeHtml(totpSecret)}" data-title="${escapeHtml(entry.title)}" data-account="${escapeHtml(entry.data?.username || '')}" title="${t('vault.aria.showQRCode')}" aria-label="${t('vault.aria.showQRCode')}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  #initTOTPFields() {
    // Clear existing timer
    if (this.#totpTimer) {
      clearInterval(this.#totpTimer);
      this.#totpTimer = null;
    }

    const totpFields = document.querySelectorAll('.vault-totp-field');
    if (totpFields.length === 0) return;

    const updateTOTP = async () => {
      for (const field of totpFields) {
        const codeContainer = field.querySelector('.vault-totp-code');
        const secret = codeContainer?.dataset.secret;
        if (!secret) continue;

        try {
          const result = await this.#generateTOTP(secret);
          const digitsEl = field.querySelector('.totp-digits');
          const timerText = field.querySelector('.totp-timer-text');
          const progressCircle = field.querySelector('.totp-timer-progress');

          if (digitsEl) {
            // Format code as "XXX XXX"
            const formatted = result.code.slice(0, 3) + ' ' + result.code.slice(3);
            digitsEl.textContent = formatted;
          }

          if (timerText) {
            timerText.textContent = result.remaining;
          }

          if (progressCircle) {
            const percent = (result.remaining / result.period) * 100;
            const circumference = 2 * Math.PI * 16;
            const offset = circumference - (percent / 100) * circumference;
            progressCircle.style.strokeDasharray = circumference;
            progressCircle.style.strokeDashoffset = offset;

            // Color based on time remaining
            if (result.remaining <= 5) {
              progressCircle.classList.add('critical');
              progressCircle.classList.remove('warning');
            } else if (result.remaining <= 10) {
              progressCircle.classList.add('warning');
              progressCircle.classList.remove('critical');
            } else {
              progressCircle.classList.remove('warning', 'critical');
            }
          }
        } catch (error) {
          const digitsEl = field.querySelector('.totp-digits');
          if (digitsEl) digitsEl.textContent = t('vault.common.error');
        }
      }
    };

    // Initial update
    updateTOTP();

    // Update every second
    this.#totpTimer = setInterval(updateTOTP, 1000);
  }

  async #generateTOTP(secret, options = {}) {
    // Use the dedicated TOTP service for RFC 6238 compliance
    const { generateTOTP } = await import('./vault/totp-service.js');
    const result = await generateTOTP(secret, options);
    return {
      code: result.code,
      remaining: result.remainingSeconds,
      period: result.period
    };
  }

  #parseOTPAuthURI(uri) {
    if (!uri.startsWith('otpauth://totp/')) {
      throw new Error('Invalid OTPAuth URI');
    }
    const url = new URL(uri);
    const params = url.searchParams;
    const secret = params.get('secret');
    if (!secret) throw new Error('Missing secret');

    let label = decodeURIComponent(url.pathname.replace('/totp/', ''));
    let issuer = params.get('issuer') || '';
    let account = label;
    if (label.includes(':')) {
      [issuer, account] = label.split(':');
    }

    return {
      secret: secret.toUpperCase().replace(/\s/g, ''),
      issuer,
      account,
      period: parseInt(params.get('period'), 10) || 30,
      digits: parseInt(params.get('digits'), 10) || 6
    };
  }

  #renderPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    return `
      <div class="vault-password-strength">
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}" data-strength-width="${strength.percent}"></div>
        </div>
        <span class="vault-strength-text ${strength.level}">${strength.label}</span>
      </div>
    `;
  }

  #renderPasswordHistory(entry) {
    const history = entry.data?.passwordHistory || [];
    if (history.length === 0) return '';

    const historyItems = history.map((h, idx) => {
      const date = new Date(h.changedAt);
      const relativeTime = this.#getRelativeTime(date);
      const maskedPwd = this.#maskHistoryPassword(h.password);

      return `
        <div class="vault-history-item" data-index="${idx}">
          <div class="vault-history-info">
            <span class="vault-history-password" title="Click to reveal">${maskedPwd}</span>
            <span class="vault-history-date">${relativeTime}</span>
            ${h.reason ? `<span class="vault-history-reason">${escapeHtml(h.reason)}</span>` : ''}
          </div>
          <div class="vault-history-actions">
            <button class="vault-field-btn copy-history-pwd" data-password="${escapeHtml(h.password)}" title="Copier">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="vault-field-btn restore-history-pwd" data-index="${idx}" title="Restaurer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="vault-password-history">
        <button class="vault-history-toggle" aria-expanded="false">
          <svg class="vault-history-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>Historique (${history.length})</span>
        </button>
        <div class="vault-history-list" hidden>
          ${historyItems}
        </div>
      </div>
    `;
  }

  #maskHistoryPassword(password) {
    if (!password) return '';
    if (password.length <= 4) return '••••';
    return password.substring(0, 2) + '•'.repeat(Math.min(password.length - 4, 6)) + password.slice(-2);
  }

  #getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)} wk ago`;
    return `${Math.floor(days / 30)} mo ago`;
  }

  #renderPasswordAge(entry) {
    // Only show for login entries with passwords
    if (entry.type !== 'login' || !entry.data?.password) return '';

    const modifiedAt = new Date(entry.modifiedAt);
    const now = new Date();
    const daysSinceModified = Math.floor((now - modifiedAt) / (1000 * 60 * 60 * 24));

    let ageClass = 'good';
    let ageLabel = t('vault.age.recent');
    let ageIcon = 'check';

    if (daysSinceModified > 365) {
      ageClass = 'critical';
      const years = Math.floor(daysSinceModified / 365);
      ageLabel = `${t('vault.age.years', { count: years })} - ${t('vault.age.renewalRecommended')}`;
      ageIcon = 'alert';
    } else if (daysSinceModified > 180) {
      ageClass = 'warning';
      ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
      ageIcon = 'clock';
    } else if (daysSinceModified > 90) {
      ageClass = 'fair';
      ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
      ageIcon = 'clock';
    } else if (daysSinceModified > 30) {
      ageLabel = t('vault.age.months', { count: Math.floor(daysSinceModified / 30) });
    } else {
      ageLabel = daysSinceModified === 0 ? t('vault.age.today') : t('vault.age.days', { count: daysSinceModified });
    }

    return `
      <div class="vault-password-age ${ageClass}">
        <div class="vault-age-icon">
          ${ageIcon === 'alert' ? `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          ` : ageIcon === 'clock' ? `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          ` : `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          `}
        </div>
        <div class="vault-age-info">
          <span class="vault-age-label">${t('vault.age.label')}</span>
          <span class="vault-age-value">${ageLabel}</span>
        </div>
      </div>
    `;
  }

  // Empty states and skeletons moved to ./vault/views/empty-states.js
  // Add entry modal moved to ./vault/modals/entry-form.js

  #applyTemplate(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return;

    // Set entry type
    const typeRadio = document.querySelector(`input[name="entry-type"][value="${template.type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
      this.#updateEntryTypeFields();
    }

    // Set title
    const titleInput = document.getElementById('entry-title');
    if (titleInput && template.name !== 'Custom') {
      titleInput.value = template.name;
    }

    // Wait for type fields to render, then set URL
    setTimeout(() => {
      if (template.url) {
        const urlInput = document.getElementById('entry-url');
        if (urlInput) urlInput.value = template.url;
      }

      // Show TOTP hint if suggested
      if (template.suggestTotp) {
        const totpField = document.getElementById('entry-totp');
        if (totpField) {
          totpField.placeholder = 'Recommended for this service';
        }
      }
    }, 50);

    // Close template picker
    const picker = document.getElementById('template-picker');
    const toggle = document.getElementById('toggle-templates');
    if (picker) picker.hidden = true;
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.vault-template-chevron').style.transform = '';
    }

    // Highlight selected template briefly
    document.querySelectorAll('.vault-template-item').forEach(item => item.classList.remove('selected'));
    const selectedItem = document.querySelector(`.vault-template-item[data-template-id="${templateId}"]`);
    if (selectedItem) selectedItem.classList.add('selected');

    this.#showToast(t('vault.messages.templateApplied', { name: template.name }), 'success');
  }

  // ==================== TAGS SYSTEM ====================

  #renderTagsList() {
    if (this.#tags.length === 0) {
      return `<div class="vault-nav-empty">${t('vault.sidebar.noTags')}</div>`;
    }

    return this.#tags.map(tag => {
      const tagColor = tag.color || '#6b7280';
      const count = this.#entries.filter(e => e.tags?.includes(tag.id)).length;
      return `
        <button class="vault-nav-item vault-tag-item ${this.#selectedTag === tag.id ? 'active' : ''}"
                data-tag="${tag.id}"
                aria-current="${this.#selectedTag === tag.id ? 'true' : 'false'}">
          <span class="vault-tag-dot" data-tag-color="${tagColor}" aria-hidden="true"></span>
          <span class="vault-nav-label">${escapeHtml(tag.name)}</span>
          <span class="vault-nav-count">${count}</span>
          <button class="vault-tag-edit-btn" data-edit-tag="${tag.id}" title="Edit tag" aria-label="Edit ${escapeHtml(tag.name)}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </button>
      `;
    }).join('');
  }

  #renderTagPicker(selectedTags = []) {
    const tagColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

    return `
      <div class="vault-tag-picker">
        <div class="vault-tag-picker-list">
          ${this.#tags.length === 0 ? '<div class="vault-tag-empty">No tags available</div>' :
        this.#tags.map(tag => `
              <label class="vault-tag-option ${selectedTags.includes(tag.id) ? 'selected' : ''}">
                <input type="checkbox" name="entry-tags" value="${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''}>
                <span class="vault-tag-chip" data-tag-color="${tag.color || '#6b7280'}">
                  ${escapeHtml(tag.name)}
                </span>
              </label>
            `).join('')
      }
        </div>
        <div class="vault-tag-picker-add">
          <input type="text" class="vault-input vault-input-sm" id="new-tag-name" placeholder="${t('vault.placeholders.newTag')}">
          <div class="vault-tag-color-picker" id="tag-color-picker">
            ${tagColors.map((color, i) => `
              <button type="button" class="vault-color-btn vault-color-option ${i === 0 ? 'selected' : ''}"
                      data-color="${color}"
                      title="Color ${i + 1}" aria-label="Color ${color}"></button>
            `).join('')}
          </div>
          <button type="button" class="vault-btn vault-btn-sm vault-btn-primary" id="btn-create-tag">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  #renderTagsInRow(entry) {
    if (!entry.tags || entry.tags.length === 0) return '';

    const entryTags = this.#tags.filter(t => entry.tags.includes(t.id));
    if (entryTags.length === 0) return '';

    return `
      <div class="vault-entry-tags">
        ${entryTags.slice(0, 3).map(tag => `
          <span class="vault-mini-tag" data-tag-color="${tag.color || '#6b7280'}" title="${escapeHtml(tag.name)}">
            ${escapeHtml(tag.name)}
          </span>
        `).join('')}
        ${entryTags.length > 3 ? `<span class="vault-mini-tag vault-more-tags">+${entryTags.length - 3}</span>` : ''}
      </div>
    `;
  }

  #renderTagsInDetail(entry) {
    if (!entry.tags || entry.tags.length === 0) return '';
    const entryTags = this.#tags.filter(t => entry.tags.includes(t.id));
    if (entryTags.length === 0) return '';

    return entryTags.map(tag => `
      <span class="vault-detail-tag" data-tag-color="${tag.color || '#6b7280'}">
        ${escapeHtml(tag.name)}
      </span>
    `).join('');
  }

  // Helper for attachments in detail view
  // See #renderAttachmentsUI definition below

  // Tag modals moved to ./vault/modals/folder-tag-modals.js

  /** @type {Object|null} Pending import data */
  #pendingImport = null;

  /**
   * Handle file selection for import
   */
  async #handleImportFile(file) {
    if (!file) return;

    const importPreview = document.getElementById('import-preview');
    const importSummary = document.getElementById('import-summary');
    const importWarnings = document.getElementById('import-warnings');
    const confirmBtn = document.getElementById('btn-import-confirm');

    try {
      // Show loading
      importPreview.hidden = false;
      importSummary.innerHTML = `<div class="vault-loading"><span class="vault-spinner"></span> ${t('common.analyzing')}</div>`;
      importWarnings.hidden = true;
      confirmBtn.disabled = true;

      // Read file content
      const content = await file.text();

      // Import dynamically
      const { importFromFile } = await import('./vault/import-service.js');
      const result = importFromFile(content, { filename: file.name });

      // Store for later
      this.#pendingImport = result;

      // Show summary
      importSummary.innerHTML = `
        <div class="vault-import-stats">
          <div class="vault-import-stat">
            <span class="vault-import-stat-value">${result.stats.importedEntries}</span>
            <span class="vault-import-stat-label">Entries</span>
          </div>
          <div class="vault-import-stat">
            <span class="vault-import-stat-value">${result.stats.importedGroups}</span>
            <span class="vault-import-stat-label">Folders</span>
          </div>
          <div class="vault-import-stat">
            <span class="vault-import-stat-value">${result.stats.customFieldsCount}</span>
            <span class="vault-import-stat-label">Fields</span>
          </div>
        </div>
        <div class="vault-import-file-info">
          <span class="vault-import-filename">${escapeHtml(file.name)}</span>
          <span class="vault-import-filesize">${(file.size / 1024).toFixed(1)} Ko</span>
        </div>
      `;

      // Show warnings if any
      if (result.warnings.length > 0 || result.errors.length > 0) {
        importWarnings.hidden = false;
        importWarnings.innerHTML = `
          ${result.errors.map(e => `<div class="vault-import-error">❌ ${escapeHtml(e)}</div>`).join('')}
          ${result.warnings.map(w => `<div class="vault-import-warning">⚠️ ${escapeHtml(w)}</div>`).join('')}
        `;
      }

      // Enable confirm button if we have entries
      confirmBtn.disabled = result.entries.length === 0;

    } catch (error) {
      importSummary.innerHTML = `<div class="vault-import-error">❌ ${t('vault.common.error')}: ${escapeHtml(error.message)}</div>`;
      confirmBtn.disabled = true;
    }
  }

  /**
   * Confirm and execute the import
   */
  async #confirmImport() {
    if (!this.#pendingImport) return;

    const includeGroups = document.getElementById('import-include-groups')?.checked ?? true;
    const confirmBtn = document.getElementById('btn-import-confirm');

    try {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span class="vault-spinner"></span> ${t('common.importing')}`;

      const { entries, groups } = this.#pendingImport;

      // Import groups first (if enabled)
      if (includeGroups && groups.length > 0) {
        for (const group of groups) {
          try {
            await window.vault.folders.add(group.name, group.parentId);
          } catch (e) {
            safeLog('[Import] Group creation error:', e.message);
          }
        }
      }

      // Import entries
      let importedCount = 0;
      for (const entry of entries) {
        try {
          // Convert VaultEntry to the format expected by the vault API
          const entryData = {
            username: entry.username || '',
            password: entry.secret?.[0] || '',
            url: entry.uri || '',
            notes: entry.notes || '',
            ...entry.fields?.reduce((acc, f) => {
              acc[f.label] = f.value;
              return acc;
            }, {})
          };

          // Handle TOTP if present
          if (entry.otpConfig) {
            entryData.totp = entry.otpConfig.secret;
          }

          await window.vault.entries.add(entry.type || 'login', entry.title, entryData);
          importedCount++;
        } catch (e) {
          safeLog('[Import] Entry creation error:', e.message);
        }
      }

      // Refresh data
      await this.#loadData();
      this.#render();

      this.#closeModal('import-modal');
      this.#showToast(t('vault.messages.entriesImported', { count: importedCount }), 'success');
      this.#pendingImport = null;

    } catch (error) {
      this.#showToast(t('vault.messages.importError', { message: error.message }), 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Importer
      `;
    }
  }

  async #createTag(name, color) {
    try {
      await window.vault.tags.add({ name: name.trim(), color });
      await this.#loadData();
      this.#showToast(t('vault.messages.tagCreated', { name }), 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || t('vault.messages.creationError'), 'error');
      return false;
    }
  }

  async #updateTag(tagId, name, color) {
    try {
      await window.vault.tags.update(tagId, { name: name.trim(), color });
      await this.#loadData();
      this.#showToast(t('vault.messages.tagModified'), 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || t('vault.messages.modificationError'), 'error');
      return false;
    }
  }

  async #deleteTag(tagId) {
    try {
      // Remove tag from all entries first
      for (const entry of this.#entries) {
        if (entry.tags?.includes(tagId)) {
          const newTags = entry.tags.filter(t => t !== tagId);
          await window.vault.entries.update(entry.id, { tags: newTags });
        }
      }
      await window.vault.tags.delete(tagId);
      if (this.#selectedTag === tagId) {
        this.#selectedTag = null;
      }
      await this.#loadData();
      this.#showToast(t('vault.messages.tagDeleted'), 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || t('vault.messages.deleteError'), 'error');
      return false;
    }
  }

  #openEditTagModal(tagId) {
    const tag = this.#tags.find(t => t.id === tagId);
    if (!tag) return;

    this.#openModal('edit-tag-modal');

    // Fill form
    document.getElementById('edit-tag-id').value = tag.id;
    document.getElementById('edit-tag-name').value = tag.name;
    document.getElementById('edit-tag-color').value = tag.color || '#6b7280';

    // Select color
    document.querySelectorAll('#edit-tag-colors .vault-color-option').forEach(btn => {
      btn.classList.remove('selected');
      btn.innerHTML = '';
      if (btn.dataset.color === (tag.color || '#6b7280')) {
        btn.classList.add('selected');
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      }
    });
  }

  #getTagCount(tagId) {
    return this.#entries.filter(e => e.tags?.includes(tagId)).length;
  }

  /**
   * Show bulk tag modal for selected entries
   */
  #showBulkTagModal() {
    // Calculate tag states for selected entries
    const selectedIds = [...this.#selectedEntries];
    const selectedEntries = this.#entries.filter(e => selectedIds.includes(e.id));
    const count = selectedEntries.length;

    // For each tag, count how many selected entries have it
    const tagStates = this.#tags.map(tag => {
      const entriesWithTag = selectedEntries.filter(e => e.tags?.includes(tag.id)).length;
      return {
        ...tag,
        state: entriesWithTag === 0 ? 'none' : entriesWithTag === count ? 'all' : 'partial',
        count: entriesWithTag
      };
    });

    // Create modal
    let modal = document.getElementById('bulk-tag-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bulk-tag-modal';
      modal.className = 'vault-modal-overlay';
      modal.role = 'dialog';
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3>Manage tags (${count} entr${count > 1 ? 'ies' : 'y'})</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vault-modal-body">
          ${this.#tags.length === 0 ? `
            <p class="vault-modal-empty">No tags available. Create a tag from the sidebar.</p>
          ` : `
            <p class="vault-modal-hint">Check to add, uncheck to remove</p>
            <div class="vault-bulk-tag-list">
              ${tagStates.map(tag => `
                <label class="vault-bulk-tag-item">
                  <input type="checkbox" class="vault-checkbox"
                         data-tag-id="${tag.id}"
                         ${tag.state === 'all' ? 'checked' : ''}
                         ${tag.state === 'partial' ? 'data-indeterminate="true"' : ''}>
                  <span class="vault-checkbox-mark ${tag.state === 'partial' ? 'partial' : ''}"></span>
                  <span class="vault-bulk-tag-dot" data-tag-color="${tag.color || '#6b7280'}"></span>
                  <span class="vault-bulk-tag-name">${escapeHtml(tag.name)}</span>
                  <span class="vault-bulk-tag-count">${tag.count}/${count}</span>
                </label>
              `).join('')}
            </div>
          `}
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="button" class="vault-btn vault-btn-primary" id="bulk-tag-apply" ${this.#tags.length === 0 ? 'disabled' : ''}>Appliquer</button>
          </div>
        </div>
      </div>
    `;

    // Set indeterminate state for partial checkboxes
    modal.querySelectorAll('[data-indeterminate="true"]').forEach(checkbox => {
      checkbox.indeterminate = true;
    });

    // Bind events
    modal.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.#closeModal('bulk-tag-modal');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.#closeModal('bulk-tag-modal');
    });

    modal.querySelector('#bulk-tag-apply')?.addEventListener('click', async () => {
      await this.#applyBulkTags(modal);
    });

    // Handle checkbox click to clear indeterminate
    modal.querySelectorAll('.vault-bulk-tag-item input').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        checkbox.indeterminate = false;
        checkbox.closest('.vault-bulk-tag-item').querySelector('.vault-checkbox-mark').classList.remove('partial');
      });
    });

    this.#openModal('bulk-tag-modal');
  }

  /**
   * Apply bulk tag changes
   */
  async #applyBulkTags(modal) {
    const selectedIds = [...this.#selectedEntries];
    const checkboxes = modal.querySelectorAll('.vault-bulk-tag-item input');
    let updated = 0;

    for (const entryId of selectedIds) {
      const entry = this.#entries.find(e => e.id === entryId);
      if (!entry) continue;

      let newTags = [...(entry.tags || [])];
      let changed = false;

      for (const checkbox of checkboxes) {
        const tagId = checkbox.dataset.tagId;
        const hasTag = newTags.includes(tagId);

        if (checkbox.checked && !hasTag) {
          newTags.push(tagId);
          changed = true;
        } else if (!checkbox.checked && !checkbox.indeterminate && hasTag) {
          newTags = newTags.filter(t => t !== tagId);
          changed = true;
        }
      }

      if (changed) {
        await window.vault.entries.update(entryId, { tags: newTags });
        updated++;
      }
    }

    this.#closeModal('bulk-tag-modal');
    await this.#loadData();
    this.#render();

    if (updated > 0) {
      this.#showToast(t('vault.messages.tagsUpdated', { count: updated }), 'success');
    }
  }

  // Add folder modal moved to ./vault/modals/folder-tag-modals.js
  // Edit entry modal moved to ./vault/modals/entry-form.js
  // Shortcuts modal moved to ./vault/modals/shortcuts-modal.js

  /**
   * Open health dashboard modal with fresh stats
   * Re-binds event listeners after re-rendering
   */
  async #openHealthDashboard() {
    // Run comprehensive audit using the audit service
    const { auditVault, getRecommendations, getScoreColor, getScoreLabel } = await import('./vault/audit-service.js');

    // Convert entries to the format expected by audit service
    const auditEntries = this.#entries.map(e => ({
      id: e.id,
      title: e.title,
      type: e.type,
      secret: e.data?.password ? [e.data.password] : [],
      otpConfig: e.data?.totp ? { secret: e.data.totp } : null,
      metadata: {
        createdAt: e.createdAt || e.metadata?.createdAt,
        modifiedAt: e.modifiedAt || e.metadata?.updatedAt
      }
    }));

    const report = await auditVault(auditEntries);
    const recommendations = getRecommendations(report);

    // Store report for filtering
    this.#lastAuditReport = report;

    // Re-render to get fresh stats
    const healthModal = document.getElementById('health-modal');
    if (healthModal) {
      healthModal.outerHTML = renderHealthDashboard({
        report,
        recommendations,
        getScoreColor,
        getScoreLabel,
        hasAuditFilter: !!this.#auditFilterIds,
        t
      });
    }

    // Open modal
    this.#openModal('health-modal');

    // Re-bind event listeners on the new modal
    const newModal = document.getElementById('health-modal');
    if (newModal) {
      // Close button
      newModal.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => this.#closeModal('health-modal'));
      });

      // Breach check button
      newModal.querySelector('#btn-check-breaches')?.addEventListener('click', () => {
        this.#checkBreaches();
      });

      // Clickable issue cards (filter entries)
      newModal.querySelectorAll('.vault-health-card[data-filter]').forEach(card => {
        card.addEventListener('click', async () => {
          try {
            const filter = card.dataset.filter;
            if (filter && this.#lastAuditReport) {
              const { filterEntriesByIssue } = await import('./vault/audit-service.js');
              const entryIds = filterEntriesByIssue(this.#lastAuditReport, filter);
              this.#closeModal('health-modal');
              // Filter the list to show only these entries
              this.#auditFilterIds = new Set(entryIds);
              this.#selectedCategory = 'all';
              this.#updateEntryList();
              this.#showToast(t('vault.messages.entriesFiltered', { count: entryIds.length }), 'info');
            }
          } catch (error) {
            this.#showToast(error.message || t('vault.messages.filterFailed'), 'error');
          }
        });
      });

      // Clickable recommendation items
      newModal.querySelectorAll('.vault-recommendation[data-filter]').forEach(item => {
        item.addEventListener('click', async () => {
          try {
            const filter = item.dataset.filter;
            if (filter && this.#lastAuditReport) {
              const { filterEntriesByIssue } = await import('./vault/audit-service.js');
              const entryIds = filterEntriesByIssue(this.#lastAuditReport, filter);
              this.#closeModal('health-modal');
              this.#auditFilterIds = new Set(entryIds);
              this.#selectedCategory = 'all';
              this.#updateEntryList();
            }
          } catch (error) {
            this.#showToast(error.message || t('vault.messages.filterFailed'), 'error');
          }
        });
      });

      // Clickable breach items
      newModal.querySelectorAll('.vault-breach-item[data-entry-id]').forEach(item => {
        item.addEventListener('click', () => {
          const entryId = item.dataset.entryId;
          if (entryId) {
            const entry = this.#entries.find(e => e.id === entryId);
            if (entry) {
              this.#closeModal('health-modal');
              this.#selectedEntry = entry;
              this.#updateDetailPanel();
            }
          }
        });
      });

      // Clear filter button
      newModal.querySelector('#btn-clear-audit-filter')?.addEventListener('click', () => {
        this.#auditFilterIds = null;
        this.#closeModal('health-modal');
        this.#updateEntryList();
      });
    }
  }

  #calculateHealthStats() {
    const logins = this.#entries.filter(e => e.type === 'login' && e.data?.password);
    const total = logins.length;

    if (total === 0) {
      return {
        score: 100,
        scoreClass: 'excellent',
        status: 'No username',
        total: 0,
        strong: 0,
        weak: 0,
        reused: 0,
        old: 0,
        expired: 0,
        issues: []
      };
    }

    // Count by strength
    let strong = 0, weak = 0; // medium = 0
    logins.forEach(entry => {
      const strength = getPasswordStrength(entry.data.password);
      if (strength === 'strong') strong++;
      else if (strength === 'medium') { /* medium++ */ }
      else weak++;
    });

    // Count reused passwords
    const passwordCounts = {};
    logins.forEach(entry => {
      const pwd = entry.data.password;
      passwordCounts[pwd] = (passwordCounts[pwd] || 0) + 1;
    });
    const reused = logins.filter(e => passwordCounts[e.data.password] > 1).length;

    // Count old passwords (by age) and expiring passwords (by expiresAt date)
    let old = 0, expired = 0, expiring = 0;
    logins.forEach(entry => {
      // Check expiration date first
      const expiryStatus = this.#getExpiryStatus(entry);
      if (expiryStatus.status === 'expired') {
        expired++;
      } else if (['today', 'soon', 'warning'].includes(expiryStatus.status)) {
        expiring++;
      }

      // Also check by password age
      const days = this.#getPasswordAgeDays(entry);
      if (days > 180) old++;
    });

    // Calculate score
    let score = 100;
    if (total > 0) {
      score -= (weak / total) * 40;
      score -= (reused / total) * 25;
      score -= (expired / total) * 20;
      score -= (expiring / total) * 10;
      score -= (old / total) * 5;
    }
    score = Math.max(0, Math.round(score));

    // Determine status
    let status, scoreClass;
    if (score >= 90) {
      status = t('vault.health.excellent');
      scoreClass = 'excellent';
    } else if (score >= 70) {
      status = t('vault.health.good');
      scoreClass = 'good';
    } else if (score >= 50) {
      status = t('vault.health.needsImprovement');
      scoreClass = 'medium';
    } else {
      status = t('vault.health.critical');
      scoreClass = 'poor';
    }

    // Build issues list
    const issues = [];
    if (weak > 0) {
      issues.push({
        severity: 'high',
        icon: '⚠️',
        iconLabel: t('vault.health.iconWarning'),
        message: t('vault.health.weakPasswords', { count: weak }),
        count: weak
      });
    }
    if (reused > 0) {
      issues.push({
        severity: 'high',
        icon: '🔁',
        iconLabel: t('vault.health.iconReused'),
        message: t('vault.health.reusedPasswords', { count: reused }),
        count: reused
      });
    }
    if (expired > 0) {
      issues.push({
        severity: 'high',
        icon: '⚠️',
        iconLabel: t('vault.health.iconExpired'),
        message: t('vault.health.expiredPasswords', { count: expired }),
        count: expired
      });
    }
    if (expiring > 0) {
      issues.push({
        severity: 'medium',
        icon: '⏰',
        iconLabel: t('vault.health.iconExpiring'),
        message: t('vault.health.expiringPasswords', { count: expiring }),
        count: expiring
      });
    }
    if (old > 0) {
      issues.push({
        severity: 'low',
        icon: '📅',
        iconLabel: t('vault.health.iconOld'),
        message: t('vault.health.oldPasswords', { count: old }),
        count: old
      });
    }

    return { score, scoreClass, status, total, strong, weak, reused, old, expired, expiring, issues };
  }

  async #checkBreaches(silent = false) {
    const btn = document.getElementById('btn-check-breaches');
    const resultsDiv = document.getElementById('breach-results');
    const loadingDiv = document.getElementById('breach-loading');
    const listDiv = document.getElementById('breach-list');

    if (!silent && (!btn || !resultsDiv || !loadingDiv || !listDiv)) return;

    // Show loading (non-silent mode only)
    if (!silent) {
      btn.disabled = true;
      btn.innerHTML = `<span class="vault-spinner-small"></span> ${t('common.checking')}`;
      resultsDiv.hidden = false;
      loadingDiv.hidden = false;
      listDiv.innerHTML = '';
    }

    const logins = this.#entries.filter(e => e.type === 'login' && e.data?.password);
    const compromised = [];
    let checked = 0;
    let newChecks = 0;

    // Check each password
    for (const entry of logins) {
      try {
        const hash = await this.#sha1(entry.data.password);

        // Check cache first
        if (this.#breachCache.has(hash)) {
          const cachedCount = this.#breachCache.get(hash);
          if (cachedCount > 0) {
            compromised.push({ entry, count: cachedCount });
          }
          checked++;
          continue;
        }

        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);

        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'Add-Padding': 'true' }
        });

        if (response.ok) {
          const text = await response.text();
          const lines = text.split('\r\n');
          let found = false;

          for (const line of lines) {
            const [hashSuffix, countStr] = line.split(':');
            if (hashSuffix === suffix) {
              const count = parseInt(countStr, 10) || 0;
              this.#breachCache.set(hash, count);
              if (count > 0) {
                compromised.push({ entry, count });
              }
              found = true;
              break;
            }
          }

          if (!found) {
            this.#breachCache.set(hash, 0);
          }
        }
        newChecks++;
      } catch (err) {
        safeLog(`[VaultUI] Breach check error for ${entry.id}:`, err);
      }

      checked++;

      if (!silent && loadingDiv) {
        loadingDiv.innerHTML = `<span class="vault-spinner-small"></span> Checking ${checked}/${logins.length}...`;
      }

      // Small delay to avoid rate limiting (only for new checks)
      if (newChecks > 0 && checked < logins.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Update last check timestamp
    this.#lastBreachCheck = Date.now();

    // Silent mode: just update entry list to show badges
    if (silent) {
      if (compromised.length > 0) {
        this.#showToast(t('vault.messages.compromisedDetected', { count: compromised.length }), 'warning', 5000);
        this.#updateEntryList(); // Refresh to show badges
      }
      return compromised.length;
    }

    // Show results (non-silent mode)
    loadingDiv.hidden = true;
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      Check for breaches (HIBP)
    `;

    if (compromised.length === 0) {
      listDiv.innerHTML = `
        <div class="vault-breach-safe">
          <span class="vault-breach-icon">✅</span>
          <span>No compromised passwords found in ${logins.length} checked</span>
        </div>
      `;
    } else {
      listDiv.innerHTML = `
        <div class="vault-breach-warning">
          <span class="vault-breach-icon">🚨</span>
          <span>${compromised.length} compromised password(s) out of ${logins.length}</span>
        </div>
        <ul class="vault-breach-list">
          ${compromised.map(({ entry, count }) => `
            <li class="vault-breach-item" data-entry-id="${entry.id}">
              <span class="vault-breach-title">${escapeHtml(entry.title)}</span>
              <span class="vault-breach-count">${this.#formatBreachCount(count)}</span>
            </li>
          `).join('')}
        </ul>
      `;

      // Make breach items clickable
      listDiv.querySelectorAll('.vault-breach-item').forEach(item => {
        item.addEventListener('click', () => {
          const entryId = item.dataset.entryId;
          const entry = this.#entries.find(e => e.id === entryId);
          if (entry) {
            this.#selectedEntry = entry;
            this.#closeModal('health-modal');
            this.#updateDetailPanel();
            this.#updateEntryList();
          }
        });
      });
    }

    // Refresh entry list to show breach badges
    this.#updateEntryList();
  }

  /**
   * Check if an entry's password has been breached (from cache)
   */
  #isPasswordBreached(entry) {
    if (entry.type !== 'login' || !entry.data?.password) return false;
    // We need the hash, but we can't compute async here, so check synchronously
    // This relies on cache being populated from previous check
    return false; // Will be implemented via async check
  }

  /**
   * Get breach count for an entry (async)
   */
  async #getBreachCount(entry) {
    if (entry.type !== 'login' || !entry.data?.password) return 0;
    const hash = await this.#sha1(entry.data.password);
    return this.#breachCache.get(hash) || 0;
  }

  async #sha1(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  #formatBreachCount(count) {
    if (count < 10) return `${count} fois`;
    if (count < 1000) return `${count}+ fois`;
    if (count < 1000000) return `${Math.floor(count / 1000)}K+ fois`;
    return `${Math.floor(count / 1000000)}M+ fois`;
  }

  // TOTP QR modal moved to ./vault/modals/totp-qr-modal.js

  #openEntryList() {
    this.#currentView = 'main';
    this.#render();
  }

  // Move folder modal moved to ./vault/modals/folder-tag-modals.js

  #exportEntries(entries) {
    if (entries.length === 0) {
      this.#showToast(t('vault.messages.noEntriesToExport'), 'warning');
      return;
    }

    // Store entries for export and show format selection modal
    this.#pendingExportEntries = entries;
    showExportFormatModal({
      count: entries.length,
      onFormatSelected: (format) => this.#performExport(format),
      t
    });
  }

  // Export format modal moved to ./vault/modals/import-export-modal.js

  #performExport(format) {
    const entries = this.#pendingExportEntries || [];
    if (entries.length === 0) return;

    try {
      const { content, filename, mimeType } = performExport(entries, format, this.#folders);
      downloadExport(content, filename, mimeType);
      this.#showToast(t('vault.messages.entriesExported', { count: entries.length, format: format.toUpperCase() }), 'success');
    } catch (err) {
      this.#showToast(t('vault.messages.exportFailed'), 'error');
    }
    this.#pendingExportEntries = null;
  }

  // Export methods moved to vault/services/export-service.js

  #triggerImport() {
    // Open the import modal (new unified import UI)
    this.#openModal('import-modal');
    this.#pendingImport = null;

    // Reset the preview
    const preview = document.getElementById('import-preview');
    if (preview) preview.hidden = true;

    // Attach import modal events
    this.#attachImportModalEvents();
  }

  /**
   * Attach event handlers for the import modal
   */
  #attachImportModalEvents() {
    const modal = document.getElementById('import-modal');
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');
    const browseBtn = document.getElementById('btn-import-browse');
    const confirmBtn = document.getElementById('btn-import-confirm');

    // Close buttons (X and Cancel)
    modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.#closeModal('import-modal'));
    });

    // Click on backdrop to close
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.#closeModal('import-modal');
      }
    });

    // Browse button
    browseBtn?.addEventListener('click', () => fileInput?.click());

    // File input change
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.#handleImportFile(file);
    });

    // Drag and drop
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.#handleImportFile(file);
    });

    // Confirm button
    confirmBtn?.addEventListener('click', () => this.#confirmImport());
  }

  /**
   * Legacy import method - kept for backwards compatibility
   * @deprecated Use #triggerImport() which opens the new modal
   */
  #triggerImportLegacy() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.xml,.kdbx';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        let imported = 0;

        if (file.name.endsWith('.csv')) {
          // Parse CSV import (toast shown internally with format info)
          await this.#importCSV(text);
          await this.#loadData();
          this.#render();
          return;
        } else if (file.name.endsWith('.xml')) {
          // KeePass XML import
          imported = await this.#importKeePassXML(text);
          await this.#loadData();
          this.#render();
          this.#showToast(t('vault.messages.keepassImported', { count: imported }), 'success', 4000);
          return;
        } else if (file.name.endsWith('.kdbx')) {
          this.#showToast(t('vault.messages.kdbxNotSupported'), 'warning', 5000);
          return;
        } else {
          // JSON import
          const data = JSON.parse(text);

          if (!data.entries || !Array.isArray(data.entries)) {
            throw new Error(t('vault.validation.invalidFormat'));
          }

          for (const entry of data.entries) {
            if (!entry.type || !entry.title) continue;
            await window.vault.entries.add(entry.type, entry.title, {
              ...entry.data,
              notes: entry.notes,
              folderId: entry.folderId,
              favorite: entry.favorite
            });
            imported++;
          }
        }

        await this.#loadData();
        this.#render();
        this.#showToast(t('vault.messages.entriesImported', { count: imported }), 'success');
      } catch (error) {
        safeLog('[VaultUI] Import error:', error);
        this.#showDetailedError(
          t('vault.messages.importError', { message: error.message || t('vault.messages.invalidFormat') }),
          t('vault.messages.checkFileFormat')
        );
      }
    });
    input.click();
  }

  // ==================== SAVE VAULT TO FILE ====================

  /**
   * Show modal to save vault to file
   * Prompts for password and file location
   */
  #showSaveVaultModal() {
    // Create modal if not exists
    let modal = document.getElementById('save-vault-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'save-vault-modal';
      modal.className = 'vault-modal-overlay';
      modal.role = 'dialog';
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    const entryCount = this.#entries?.length || 0;
    const folderCount = this.#folders?.length || 0;

    modal.innerHTML = `
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3>${t('vault.dialogs.saveVault')}</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form class="vault-modal-body" id="save-vault-form">
          <div class="vault-save-summary">
            <div class="vault-save-stat">
              <span class="vault-save-stat-value">${entryCount}</span>
              <span class="vault-save-stat-label">entry(ies)</span>
            </div>
            <div class="vault-save-stat">
              <span class="vault-save-stat-value">${folderCount}</span>
              <span class="vault-save-stat-label">folder(s)</span>
            </div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="save-vault-password">
              File password <span class="required">*</span>
            </label>
            <p class="vault-form-hint">This password protects the exported file. It can be different from the vault password.</p>
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="save-vault-password" placeholder="${t('vault.form.passwordPlaceholder')}" required aria-required="true" minlength="8" aria-invalid="false">
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="save-vault-password" aria-label="Show">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="save-vault-confirm">
              Confirm password <span class="required">*</span>
            </label>
            <input type="password" class="vault-input" id="save-vault-confirm" placeholder="${t('vault.form.confirmPlaceholder')}" required aria-required="true" minlength="8" aria-invalid="false">
          </div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="submit" class="vault-btn vault-btn-primary">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Sauvegarder sous...
            </button>
          </div>
        </form>
      </div>
    `;

    // Bind events
    modal.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.#closeModal('save-vault-modal');
    });

    modal.querySelector('.toggle-pwd-visibility')?.addEventListener('click', (_e) => {
      const input = document.getElementById('save-vault-password');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });

    modal.querySelector('#save-vault-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.#handleSaveVault();
    });

    // Open modal
    this.#openModal('save-vault-modal');
    document.getElementById('save-vault-password')?.focus();
  }

  /**
   * Handle vault save - validate and call file save
   */
  async #handleSaveVault() {
    const password = document.getElementById('save-vault-password')?.value;
    const confirm = document.getElementById('save-vault-confirm')?.value;

    // Validation
    if (!password || password.length < 8) {
      this.#showToast(t('vault.form.passwordMinLength'), 'warning');
      return;
    }

    if (password !== confirm) {
      this.#showToast(t('vault.messages.passwordsNoMatch'), 'warning');
      return;
    }

    try {
      // Check if vaultIO is available
      if (!window.vault?.io) {
        this.#showToast(t('vault.messages.desktopOnlyFeature'), 'error');
        return;
      }

      // Get save location
      const vaultName = this.#vaultMetadata?.name || 'vault';
      const result = await window.vault.io.selectSaveLocation(`${vaultName}.gpdb`);

      if (!result.success) {
        this.#showToast(result.error || t('vault.common.error'), 'error');
        return;
      }

      if (result.canceled) {
        return;
      }

      // Show loading state
      const submitBtn = document.querySelector('#save-vault-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="vault-spinner"></span> ${t('vault.actions.encrypting')}`;
      }

      // Prepare vault data
      const vaultData = {
        metadata: this.#vaultMetadata || {},
        entries: this.#entries || [],
        groups: this.#folders || [],
        tags: this.#tags || []
      };

      // Import io-service dynamically
      const { exportVaultToJSON } = await import('./vault/io-service.js');

      // Export and encrypt
      const encryptedJSON = await exportVaultToJSON(vaultData, password);

      // Save to file
      const saveResult = await window.vault.io.save(encryptedJSON, result.filePath);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Error saving vault');
      }

      this.#closeModal('save-vault-modal');
      this.#showToast(t('vault.messages.vaultSaved', { fileName: result.fileName }), 'success');
    } catch (error) {
      safeLog('[VaultUI] Save vault error:', error);
      this.#showToast(`${t('vault.common.error')}: ${error.message}`, 'error');

      // Reset button state
      const submitBtn = document.querySelector('#save-vault-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Sauvegarder sous...
        `;
      }
    }
  }

  // ==================== COMPACT/OVERLAY MODE ====================

  /**
   * Toggle compact mode (floating widget)
   */
  async #toggleCompactMode() {
    if (!window.electronAPI?.toggleCompactMode) {
      safeLog('[VaultUI] Compact mode not available (not in Electron)');
      return;
    }

    try {
      const result = await window.electronAPI.toggleCompactMode();
      if (result.success) {
        this.#handleCompactModeChange(result.compact);
      }
    } catch (error) {
      safeLog('[VaultUI] Compact mode error:', error);
    }
  }

  /**
   * Handle compact mode state change
   * @param {boolean} compact - Whether compact mode is active
   */
  #handleCompactModeChange(compact) {
    this.#isCompactMode = compact;

    // Toggle body class
    document.body.classList.toggle('mode-compact', compact);

    // Update button state
    const btn = document.getElementById('btn-compact-mode');
    if (btn) {
      btn.classList.toggle('active', compact);
      btn.setAttribute('aria-pressed', String(compact));
      btn.setAttribute('data-tooltip', compact ? 'Quitter le mode compact' : 'Mode compact (widget flottant)');

      // Change icon
      btn.innerHTML = compact
        ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
             <line x1="8" y1="21" x2="16" y2="21"></line>
             <line x1="12" y1="17" x2="12" y2="21"></line>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
             <line x1="12" y1="18" x2="12.01" y2="18"></line>
           </svg>`;
    }

    // Show toast
    this.#showToast(
      compact ? 'Compact mode enabled (Always on Top)' : 'Normal mode',
      'info'
    );
  }

  async #importKeePassXML(xmlText) {
    // Parse KeePass 2.x XML format
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(t('vault.messages.invalidXmlFormat'));
    }

    // Check if it's a KeePass file
    const root = doc.querySelector('KeePassFile');
    if (!root) {
      throw new Error(t('vault.messages.notKeePassFile'));
    }

    let imported = 0;
    const createdFolders = new Map(); // Map group path to folder ID

    // Process all groups recursively
    const processGroup = async (groupEl, parentPath = '') => {
      const nameEl = groupEl.querySelector(':scope > Name');
      const groupName = nameEl?.textContent || '';
      const currentPath = parentPath ? `${parentPath}/${groupName}` : groupName;

      // Skip Recycle Bin
      if (groupName === 'Recycle Bin' || groupName === 'Corbeille') {
        return;
      }

      // Create folder if it has a meaningful name and not root
      let folderId = null;
      if (groupName && groupName !== 'Root' && groupName !== 'Racine' && !createdFolders.has(currentPath)) {
        try {
          const folder = await window.vault.folders.add(groupName);
          folderId = folder?.id;
          createdFolders.set(currentPath, folderId);
        } catch {
          // Folder might already exist
        }
      } else if (createdFolders.has(currentPath)) {
        folderId = createdFolders.get(currentPath);
      }

      // Process entries in this group
      const entries = groupEl.querySelectorAll(':scope > Entry');
      for (const entryEl of entries) {
        const entry = this.#parseKeePassEntry(entryEl);
        if (entry.title && (entry.username || entry.password || entry.url)) {
          await window.vault.entries.add('login', entry.title, {
            username: entry.username,
            password: entry.password,
            url: entry.url,
            totp: entry.totp,
            notes: entry.notes,
            folderId: folderId
          });
          imported++;
        }
      }

      // Process subgroups
      const subGroups = groupEl.querySelectorAll(':scope > Group');
      for (const subGroup of subGroups) {
        await processGroup(subGroup, currentPath);
      }
    };

    // Find root group(s)
    const rootGroups = doc.querySelectorAll('Root > Group');
    for (const rootGroup of rootGroups) {
      await processGroup(rootGroup);
    }

    return imported;
  }

  #parseKeePassEntry(entryEl) {
    const entry = {
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
      totp: ''
    };

    // Parse String elements
    const strings = entryEl.querySelectorAll('String');
    for (const stringEl of strings) {
      const key = stringEl.querySelector('Key')?.textContent || '';
      const valueEl = stringEl.querySelector('Value');
      const value = valueEl?.textContent || '';

      switch (key) {
        case 'Title':
          entry.title = value;
          break;
        case 'UserName':
          entry.username = value;
          break;
        case 'Password':
          entry.password = value;
          break;
        case 'URL':
          entry.url = value;
          break;
        case 'Notes':
          entry.notes = value;
          break;
        case 'otp':
        case 'TOTP Seed':
        case 'TOTP':
          entry.totp = value;
          break;
      }
    }

    // Try to extract TOTP from notes if it contains otpauth://
    if (!entry.totp && entry.notes) {
      const otpMatch = entry.notes.match(/otpauth:\/\/totp[^\s]+/);
      if (otpMatch) {
        try {
          const url = new URL(otpMatch[0]);
          entry.totp = url.searchParams.get('secret') || '';
        } catch { /* Invalid otpauth URL - ignore */ }
      }
    }

    return entry;
  }

  async #importCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error(t('vault.messages.emptyCsvFile'));

    const headers = this.#parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Detect CSV format based on headers
    const format = this.#detectCSVFormat(headers);
    const formatNames = {
      keepass: 'KeePass',
      bitwarden: 'Bitwarden',
      lastpass: 'LastPass',
      '1password': '1Password',
      chrome: 'Chrome/Edge',
      firefox: 'Firefox',
      generic: 'Generic format'
    };

    let imported = 0;
    let withTotp = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.#parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const entry = this.#mapCSVToEntry(headers, values, format);
      if (entry && entry.title && entry.password) {
        await window.vault.entries.add('login', entry.title, {
          username: entry.username || '',
          password: entry.password || '',
          url: entry.url || '',
          totp: entry.totp || '',
          notes: entry.notes || ''
        });
        imported++;
        if (entry.totp) withTotp++;
      }
    }

    // Show format info in toast
    const totpInfo = withTotp > 0 ? ` (${withTotp} with 2FA)` : '';
    this.#showToast(t('vault.messages.formatImported', { format: formatNames[format], count: imported, totpInfo }), 'success', 4000);

    return imported;
  }

  #detectCSVFormat(headers) {
    const headerStr = headers.join(',');

    // KeePass format: Group,Title,Username,Password,URL,Notes,TOTP,Icon,Last Modified,Created
    // or: "Group","Title","Username","Password","URL","Notes"
    if (headerStr.includes('group') && headerStr.includes('title') &&
      (headerStr.includes('username') || headerStr.includes('user name'))) {
      return 'keepass';
    }

    // LastPass format: url,username,password,totp,extra,name,grouping,fav
    if (headerStr.includes('grouping') || (headerStr.includes('extra') && headerStr.includes('totp'))) {
      return 'lastpass';
    }

    // 1Password format: Title,Url,Username,Password,Notes,OTPAuth,Favorite,Archive
    if (headerStr.includes('title') && (headerStr.includes('otpauth') || headerStr.includes('archive'))) {
      return '1password';
    }

    // Bitwarden format: folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
    if (headerStr.includes('login_uri') || headerStr.includes('login_username') || headerStr.includes('reprompt')) {
      return 'bitwarden';
    }

    // Chrome format: name,url,username,password
    if (headers.length === 4 && headerStr.includes('name') && headerStr.includes('url')) {
      return 'chrome';
    }

    // Firefox format: url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged
    if (headerStr.includes('httprealm') || headerStr.includes('formactionorigin')) {
      return 'firefox';
    }

    return 'generic';
  }

  #mapCSVToEntry(headers, values, format) {
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });

    switch (format) {
      case 'keepass':
        // KeePass CSV: Group,Title,Username,Password,URL,Notes,TOTP,Icon
        // Also supports: "User Name" and "Password" headers
        return {
          title: row['title'] || row['entry'] || 'Import KeePass',
          username: row['username'] || row['user name'] || row['login'] || '',
          password: row['password'] || '',
          url: row['url'] || row['web site'] || '',
          totp: row['totp'] || row['otp'] || row['time-based one-time password'] || '',
          notes: row['notes'] || row['comments'] || '',
          folder: row['group'] || row['path'] || ''
        };

      case 'lastpass':
        return {
          title: row['name'] || row['url'] || 'Import LastPass',
          username: row['username'] || '',
          password: row['password'] || '',
          url: row['url'] || '',
          totp: row['totp'] || '',
          notes: row['extra'] || ''
        };

      case '1password':
        // Extract secret from otpauth:// URI
        let otpSecret1 = row['otpauth'] || '';
        if (otpSecret1.startsWith('otpauth://')) {
          try {
            const url = new URL(otpSecret1);
            otpSecret1 = url.searchParams.get('secret') || '';
          } catch { /* Invalid otpauth URL - ignore */ }
        }
        return {
          title: row['title'] || row['url'] || 'Import 1Password',
          username: row['username'] || '',
          password: row['password'] || '',
          url: row['url'] || '',
          totp: otpSecret1,
          notes: row['notes'] || ''
        };

      case 'bitwarden':
        return {
          title: row['name'] || row['login_uri'] || 'Import Bitwarden',
          username: row['login_username'] || '',
          password: row['login_password'] || '',
          url: row['login_uri'] || '',
          totp: row['login_totp'] || '',
          notes: row['notes'] || ''
        };

      case 'chrome':
        return {
          title: row['name'] || row['url'] || 'Import Chrome',
          username: row['username'] || '',
          password: row['password'] || '',
          url: row['url'] || '',
          totp: '',
          notes: row['note'] || ''
        };

      case 'firefox':
        return {
          title: this.#extractDomain(row['url']) || 'Import Firefox',
          username: row['username'] || '',
          password: row['password'] || '',
          url: row['url'] || '',
          totp: '',
          notes: ''
        };

      default:
        // Generic - try common header names
        return {
          title: row['name'] || row['title'] || row['site'] || row['url'] || 'Import',
          username: row['username'] || row['login'] || row['email'] || row['user'] || '',
          password: row['password'] || row['pass'] || row['pwd'] || '',
          url: row['url'] || row['website'] || row['site'] || row['uri'] || '',
          totp: row['totp'] || row['otp'] || row['2fa'] || row['authenticator'] || '',
          notes: row['notes'] || row['note'] || row['extra'] || row['comments'] || ''
        };
    }
  }

  #parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result.map(v => v.trim());
  }

  /**
   * Apply CSS custom properties from data attributes for CSP compliance
   * Called after innerHTML is set to apply dynamic styles via CSSOM
   * @param {Element} [container=document] - Container to search within
   */
  #applyCspCompliantStyles(container = document) {
    // Entry type colors
    container.querySelectorAll('[data-type-color]').forEach(el => {
      const color = el.dataset.typeColor;
      if (color) el.style.setProperty('--type-color', color);
    });

    // Tag colors
    container.querySelectorAll('[data-tag-color]').forEach(el => {
      const color = el.dataset.tagColor;
      if (color) el.style.setProperty('--tag-color', color);
    });

    // Vault icon colors
    container.querySelectorAll('[data-vault-color]').forEach(el => {
      const color = el.dataset.vaultColor;
      if (color) el.style.setProperty('--vault-icon-color', color);
    });

    // Folder colors
    container.querySelectorAll('[data-folder-color]').forEach(el => {
      const color = el.dataset.folderColor;
      if (color) el.style.setProperty('--folder-color', color);
    });

    // Folder item padding
    container.querySelectorAll('[data-padding]').forEach(el => {
      const padding = el.dataset.padding;
      if (padding) el.style.setProperty('padding-left', `${padding}px`);
    });

    // Favicon sizes
    container.querySelectorAll('[data-favicon-size]').forEach(el => {
      const size = el.dataset.faviconSize;
      if (size) el.style.setProperty('--favicon-size', `${size}px`);
    });

    // Strength bar widths
    container.querySelectorAll('[data-strength-width]').forEach(el => {
      const width = el.dataset.strengthWidth;
      if (width) el.style.setProperty('--strength-width', width);
    });

    // Color picker option colors
    container.querySelectorAll('[data-option-color]').forEach(el => {
      const color = el.dataset.optionColor;
      el.style.setProperty('--option-color', color || 'var(--vault-text-muted)');
    });
  }

  #attachMainViewEvents() {
    // Cleanup previous event listeners to prevent memory leaks
    if (this.#mainViewAbortController) {
      this.#mainViewAbortController.abort();
    }
    this.#mainViewAbortController = new AbortController();
    const signal = this.#mainViewAbortController.signal;

    // Welcome Screen Actions
    document.getElementById('btn-welcome-create')?.addEventListener('click', () => {
      this.#openModal('add-entry-modal');
    }, { signal });

    document.getElementById('btn-welcome-import')?.addEventListener('click', () => {
      this.#openModal('import-modal');
    }, { signal });

    // Lock button
    document.getElementById('btn-lock')?.addEventListener('click', () => this.#lock(), { signal });

    // Timer settings button
    document.getElementById('timer-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showTimeoutSettings({
        targetElement: document.getElementById('lock-timer'),
        currentTimeout: this.#autoLockTimeout,
        onTimeoutSelected: (newTimeout, label) => {
          this.#autoLockTimeout = newTimeout;
          this.#autoLockSeconds = newTimeout;
          try {
            localStorage.setItem('genpwd-vault-autolock-timeout', newTimeout.toString());
          } catch {
            // Storage not available
          }
          this.#showToast(t('vault.messages.timeoutSet', { value: label }), 'success');
        },
        t
      });
    }, { signal });

    // Theme toggle button
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.#toggleTheme();
    }, { signal });

    // Sidebar collapse toggle
    document.getElementById('sidebar-collapse-btn')?.addEventListener('click', () => {
      this.#toggleSidebar();
    }, { signal });

    // Cloud Sync button
    document.getElementById('btn-cloud-sync')?.addEventListener('click', () => {
      this.#syncSettingsModal.show();
    }, { signal });

    // Duress Setup button
    document.getElementById('btn-duress-setup')?.addEventListener('click', () => {
      this.#duressSetupModal.show();
    }, { signal });

    // Vault switcher dropdown
    const vaultSwitcher = document.getElementById('vault-switcher');
    const vaultDropdown = document.getElementById('vault-switcher-dropdown');
    if (vaultSwitcher && vaultDropdown) {
      vaultSwitcher.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !vaultDropdown.hidden;
        vaultDropdown.hidden = isOpen;
        vaultSwitcher.setAttribute('aria-expanded', !isOpen);
      }, { signal });

      // Keyboard navigation for vault switcher
      vaultSwitcher.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          vaultDropdown.hidden = false;
          vaultSwitcher.setAttribute('aria-expanded', 'true');
          // Focus first focusable element in dropdown
          const firstBtn = vaultDropdown.querySelector('button');
          firstBtn?.focus();
        } else if (e.key === 'Escape') {
          vaultDropdown.hidden = true;
          vaultSwitcher.setAttribute('aria-expanded', 'false');
        }
      }, { signal });

      // Close dropdown on Escape from within dropdown
      vaultDropdown.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          vaultDropdown.hidden = true;
          vaultSwitcher.setAttribute('aria-expanded', 'false');
          vaultSwitcher.focus();
        }
      }, { signal });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!vaultSwitcher.contains(e.target) && !vaultDropdown.contains(e.target)) {
          vaultDropdown.hidden = true;
          vaultSwitcher.setAttribute('aria-expanded', 'false');
        }
      }, { signal });

      // Switch vault button (lock and return to vault selection)
      document.getElementById('btn-switch-vault')?.addEventListener('click', async () => {
        vaultDropdown.hidden = true;
        await this.#lock();
      }, { signal });

      // Create new vault button
      document.getElementById('btn-create-new-vault')?.addEventListener('click', async () => {
        vaultDropdown.hidden = true;
        await this.#lock();
        // Small delay to ensure lock screen is rendered, then open create modal
        setTimeout(() => {
          this.#openModal('create-vault-modal');
        }, 100);
      }, { signal });
    }

    // Windows Hello settings button
    this.#initHelloSettings();

    // Search with debounce
    let searchTimeout;
    document.getElementById('vault-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.#searchQuery = e.target.value;
        this.#updateEntryList();
      }, 150);
    }, { signal });

    // Clear search button
    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
      this.#searchQuery = '';
      const searchInput = document.getElementById('vault-search');
      if (searchInput) searchInput.value = '';
      this.#updateEntryList();
    }, { signal });

    // Empty state: add first entry button
    document.getElementById('btn-add-first-entry')?.addEventListener('click', () => {
      this.#openModal('add-entry-modal');
    }, { signal });

    // Empty state: import first button
    document.getElementById('btn-import-first')?.addEventListener('click', () => {
      this.#openModal('import-modal');
    }, { signal });

    // Category navigation
    document.querySelectorAll('.vault-nav-item[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#selectedCategory = btn.dataset.category;
        this.#selectedFolder = null;
        this.#selectedEntry = null;
        this.#render();
      }, { signal });
    });

    // Folder tree navigation (with expand/collapse)
    this.#attachFolderTreeEvents();

    // Tag navigation
    document.querySelectorAll('.vault-nav-item[data-tag]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Ignore clicks on the edit button
        if (e.target.closest('.vault-tag-edit-btn')) return;
        this.#selectedTag = btn.dataset.tag;
        this.#selectedCategory = 'all';
        this.#selectedFolder = null;
        this.#selectedEntry = null;
        this.#render();
      }, { signal });
    });

    // Tag edit buttons
    document.querySelectorAll('[data-edit-tag]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#openEditTagModal(btn.dataset.editTag);
      }, { signal });
    });

    // Add tag button
    document.getElementById('btn-add-tag')?.addEventListener('click', () => {
      this.#openModal('add-tag-modal');
    }, { signal });

    // Sort dropdown
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    sortBtn?.addEventListener('click', () => {
      const isOpen = !sortMenu.hidden;
      sortMenu.hidden = isOpen;
      sortBtn.setAttribute('aria-expanded', !isOpen);
    }, { signal });

    // Keyboard navigation for sort button
    sortBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sortMenu.hidden = false;
        sortBtn.setAttribute('aria-expanded', 'true');
        const firstOption = sortMenu.querySelector('.vault-sort-option');
        firstOption?.focus();
      } else if (e.key === 'Escape') {
        sortMenu.hidden = true;
        sortBtn.setAttribute('aria-expanded', 'false');
      }
    }, { signal });

    const sortOptions = document.querySelectorAll('.vault-sort-option');
    const sortOptionsArray = Array.from(sortOptions);
    sortOptions.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        this.#sortBy = btn.dataset.sort;
        sortMenu.hidden = true;
        sortBtn?.setAttribute('aria-expanded', 'false');
        this.#updateEntryList();
      }, { signal });

      // Keyboard navigation within sort options
      btn.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            sortOptionsArray[(idx + 1) % sortOptionsArray.length]?.focus();
            break;
          case 'ArrowUp':
            e.preventDefault();
            sortOptionsArray[(idx - 1 + sortOptionsArray.length) % sortOptionsArray.length]?.focus();
            break;
          case 'Escape':
            e.preventDefault();
            sortMenu.hidden = true;
            sortBtn?.setAttribute('aria-expanded', 'false');
            sortBtn?.focus();
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            btn.click();
            sortBtn?.focus();
            break;
        }
      }, { signal });
    });

    // Close sort menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vault-sort-dropdown')) {
        sortMenu.hidden = true;
        sortBtn?.setAttribute('aria-expanded', 'false');
      }
    }, { signal });

    // Filter panel toggle
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    filterBtn?.addEventListener('click', () => {
      const isOpen = !filterPanel.hidden;
      filterPanel.hidden = isOpen;
      filterBtn.setAttribute('aria-expanded', !isOpen);
    }, { signal });

    // Filter chips - Type
    document.querySelectorAll('[data-filter-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.type = chip.dataset.filterType || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      }, { signal });
    });

    // Filter chips - Strength
    document.querySelectorAll('[data-filter-strength]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.strength = chip.dataset.filterStrength || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      }, { signal });
    });

    // Filter chips - Age
    document.querySelectorAll('[data-filter-age]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.age = chip.dataset.filterAge || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      }, { signal });
    });

    // Clear all filters
    document.getElementById('clear-filters')?.addEventListener('click', () => {
      this.#searchFilters = { type: null, strength: null, age: null };
      this.#updateFilterUI();
      this.#updateEntryList();
    });

    // Entry rows
    this.#attachEntryRowEvents();

    // Add entry button
    document.getElementById('btn-add-entry')?.addEventListener('click', () => {
      this.#openModal('add-entry-modal');
      this.#updateEntryTypeFields();
      document.getElementById('entry-title')?.focus();
    });

    // Add folder button
    document.getElementById('btn-add-folder')?.addEventListener('click', () => {
      this.#openModal('add-folder-modal');
      document.getElementById('folder-name')?.focus();
    });

    // Detail panel events
    this.#attachDetailPanelEvents();

    // Modal events
    this.#attachAddEntryEvents();
    this.#attachAddFolderEvents();
    this.#attachEditEntryEvents();
    this.#attachTagModalEvents();

    // View toggle button
    document.getElementById('view-toggle')?.addEventListener('click', () => {
      this.#viewMode = this.#viewMode === 'comfortable' ? 'compact' : 'comfortable';
      const btn = document.getElementById('view-toggle');
      const list = document.getElementById('vault-entries');
      if (btn) {
        btn.classList.toggle('compact', this.#viewMode === 'compact');
        btn.title = this.#viewMode === 'compact' ? 'Vue confortable' : 'Vue compacte';
        btn.setAttribute('aria-pressed', String(this.#viewMode === 'compact'));
      }
      if (list) {
        list.classList.toggle('compact', this.#viewMode === 'compact');
      }
    });

    // Keyboard shortcuts help button
    document.getElementById('shortcuts-help')?.addEventListener('click', () => {
      this.#openModal('shortcuts-modal');
    });

    // Shortcuts modal close button
    const shortcutsModal = document.getElementById('shortcuts-modal');
    shortcutsModal?.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.#closeModal('shortcuts-modal'));
    });

    // Health dashboard button (sidebar)
    document.getElementById('btn-health-dashboard')?.addEventListener('click', () => {
      this.#openHealthDashboard();
    });

    // Handle edit request from dashboard
    this.#container.addEventListener('edit-entry', (e) => {
      const entryId = e.detail.id;
      const entry = this.#entries.find(en => en.id === entryId);
      if (entry) {
        // Return to main view if needed
        this.#openEntryList();
        this.#selectedEntry = entry;
        this.#updateDetailPanel(); // Re-render logic needed?
        // Actually, just open edit modal directly
        this.#openEditModal(entry);
      }
    });

    // Health dashboard button (toolbar)
    document.getElementById('health-dashboard')?.addEventListener('click', () => {
      this.#openHealthDashboard();
    });

    // Bulk actions
    document.getElementById('select-all')?.addEventListener('change', (e) => {
      const entries = this.#getFilteredEntries();
      if (e.target.checked) {
        entries.forEach(entry => this.#selectedEntries.add(entry.id));
      } else {
        this.#selectedEntries.clear();
      }
      this.#updateBulkActionsUI();
    });

    document.getElementById('bulk-cancel')?.addEventListener('click', () => {
      this.#selectedEntries.clear();
      this.#updateBulkActionsUI();
    });

    document.getElementById('bulk-delete')?.addEventListener('click', async () => {
      if (this.#selectedEntries.size === 0) return;

      try {
        const count = this.#selectedEntries.size;
        const ids = [...this.#selectedEntries];

        // Remove from UI immediately
        this.#entries = this.#entries.filter(e => !this.#selectedEntries.has(e.id));
        this.#selectedEntries.clear();
        this.#selectedEntry = null;
        this.#updateEntryList();
        this.#updateDetailPanel();
        this.#updateBulkActionsUI();

        // Delete with toast
        this.#showToastWithUndo(
          `${count} entry(ies) deleted`,
          async () => {
            // Undo: reload data
            try {
              await this.#loadData();
              this.#updateEntryList();
              this.#showToast(t('vault.messages.restored'), 'success');
            } catch (error) {
              this.#showToast(error.message || t('vault.messages.restoreError'), 'error');
            }
          },
          async () => {
            // Confirm: delete for real
            try {
              for (const id of ids) {
                await window.vault.entries.delete(id);
              }
            } catch (error) {
              this.#showToast(error.message || t('vault.messages.deleteError'), 'error');
            }
          }
        );
      } catch (error) {
        this.#showToast(error.message || t('vault.messages.bulkDeleteFailed'), 'error');
      }
    });

    document.getElementById('bulk-move')?.addEventListener('click', () => {
      if (this.#selectedEntries.size === 0) return;
      this.#openModal('move-folder-modal');
    });

    document.getElementById('bulk-export')?.addEventListener('click', () => {
      if (this.#selectedEntries.size === 0) return;
      const entries = this.#entries.filter(e => this.#selectedEntries.has(e.id));
      this.#exportEntries(entries);
    });

    // Bulk tag
    document.getElementById('bulk-tag')?.addEventListener('click', () => {
      if (this.#selectedEntries.size === 0) return;
      this.#showBulkTagModal();
    });

    // Export all
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.#exportEntries(this.#entries);
    });

    // Import
    document.getElementById('btn-import')?.addEventListener('click', () => {
      this.#triggerImport();
    });

    // Save vault to file
    document.getElementById('btn-save-vault')?.addEventListener('click', () => {
      this.#showSaveVaultModal();
    });

    // Compact mode toggle button
    document.getElementById('btn-compact-mode')?.addEventListener('click', async () => {
      await this.#toggleCompactMode();
    });

    // Settings button
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.#settingsModal.show();
    });

    // Listen for compact mode changes from main process
    if (window.electronAPI?.onCompactModeChanged) {
      window.electronAPI.onCompactModeChanged(({ compact }) => {
        this.#handleCompactModeChange(compact);
      });
    }

    // Move folder modal
    document.querySelectorAll('#move-folder-modal .vault-folder-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const folderId = btn.dataset.folderId || null;
        await this.#moveEntriesToFolder([...this.#selectedEntries], folderId);
        this.#closeModal('move-folder-modal');
      });
    });

    // Global modal close handlers
    document.querySelectorAll('.vault-modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.#closeModal(modal.id);
        }
      });
    });
  }

  #attachEntryRowEvents() {
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      // Click to select
      row.addEventListener('click', (e) => {
        if (e.target.closest('.vault-quick-btn') || e.target.closest('.vault-fav-toggle')) return;
        const entry = this.#entries.find(en => en.id === row.dataset.entryId);
        if (entry) {
          this.#selectedEntry = entry;
          this.#updateDetailPanel();
          this.#updateEntrySelection();
        }
      });

      // Double-click to copy password (or open detail in compact mode)
      row.addEventListener('dblclick', async (e) => {
        if (e.target.closest('.vault-quick-btn') || e.target.closest('.vault-fav-toggle')) return;
        const entry = this.#entries.find(en => en.id === row.dataset.entryId);
        if (!entry) return;

        // Copy password if available, otherwise copy username
        if (entry.data?.password) {
          await this.#copyToClipboard(entry.data.password, t('vault.messages.passwordCopied'));
        } else if (entry.data?.username) {
          await this.#copyToClipboard(entry.data.username, t('vault.messages.usernameCopied'));
        } else if (entry.data?.content) {
          await this.#copyToClipboard(entry.data.content, t('vault.messages.contentCopied'));
        }
      });

      // Keyboard navigation
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          row.click();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const rows = Array.from(document.querySelectorAll('.vault-entry-row'));
          const currentIdx = rows.indexOf(row);
          const nextIdx = e.key === 'ArrowDown'
            ? Math.min(currentIdx + 1, rows.length - 1)
            : Math.max(currentIdx - 1, 0);
          rows[nextIdx].click();
          rows[nextIdx].focus();
        }
      });
    });

    // Quick action buttons
    document.querySelectorAll('.vault-quick-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('.vault-entry-row');
        const entry = this.#entries.find(en => en.id === row?.dataset.entryId);
        if (!entry) return;

        const action = btn.dataset.action;
        if (action === 'copy-username') {
          await this.#copyToClipboard(entry.data?.username, t('vault.messages.usernameCopied'));
        } else if (action === 'copy-password') {
          await this.#copyToClipboard(entry.data?.password, t('vault.messages.passwordCopied'));
        } else if (action === 'open-url' && entry.data?.url) {
          window.open(entry.data.url, '_blank', 'noopener,noreferrer');
        }
      });
    });

    // Favorite toggle buttons
    document.querySelectorAll('.vault-fav-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const row = btn.closest('.vault-entry-row');
        const entry = this.#entries.find(en => en.id === row?.dataset.entryId);
        if (!entry) return;

        try {
          const newFavorite = !entry.favorite;
          await window.vault.entries.update(entry.id, { favorite: newFavorite });
          entry.favorite = newFavorite;

          // Update UI immediately
          btn.classList.toggle('active', newFavorite);
          btn.textContent = newFavorite ? '★' : '☆';
          btn.title = newFavorite ? t('vault.actions.removeFromFavorites') : t('vault.actions.addToFavorites');
          btn.setAttribute('aria-pressed', newFavorite);

          this.#showToast(newFavorite ? t('vault.messages.addedToFavorites') : t('vault.messages.removedFromFavorites'), 'success');

          // Update category counts
          const favCount = document.querySelector('[data-category="favorites"] .vault-nav-count');
          if (favCount) {
            favCount.textContent = this.#entries.filter(e => e.favorite).length;
          }
        } catch (error) {
          this.#showToast(t('vault.messages.updateError'), 'error');
        }
      });
    });

    // Multi-select checkboxes
    document.querySelectorAll('.vault-checkbox[data-action="multi-select"]').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      checkbox.addEventListener('change', (e) => {
        const row = checkbox.closest('.vault-entry-row');
        const entryId = row?.dataset.entryId;
        const index = parseInt(row?.dataset.entryIndex || '0', 10);
        if (!entryId) return;

        if (e.shiftKey && this.#lastSelectedIndex >= 0) {
          // Range selection
          const entries = this.#getFilteredEntries();
          const start = Math.min(this.#lastSelectedIndex, index);
          const end = Math.max(this.#lastSelectedIndex, index);
          for (let i = start; i <= end; i++) {
            if (entries[i]) this.#selectedEntries.add(entries[i].id);
          }
        } else if (checkbox.checked) {
          this.#selectedEntries.add(entryId);
        } else {
          this.#selectedEntries.delete(entryId);
        }

        this.#lastSelectedIndex = index;
        this.#updateBulkActionsUI();
      });
    });

    // Drag & drop
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        this.#draggedEntry = this.#entries.find(en => en.id === row.dataset.entryId);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.entryId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        this.#draggedEntry = null;
        document.querySelectorAll('.vault-nav-item').forEach(item => {
          item.classList.remove('drag-over');
        });
      });
    });

    // Folder drop targets
    document.querySelectorAll('.vault-nav-item[data-folder]').forEach(folder => {
      folder.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        folder.classList.add('drag-over');
      });

      folder.addEventListener('dragleave', () => {
        folder.classList.remove('drag-over');
      });

      folder.addEventListener('drop', async (e) => {
        e.preventDefault();
        folder.classList.remove('drag-over');
        const folderId = folder.dataset.folder;

        if (this.#selectedEntries.size > 0) {
          // Move all selected entries
          await this.#moveEntriesToFolder([...this.#selectedEntries], folderId);
        } else if (this.#draggedEntry) {
          // Move single dragged entry
          await this.#moveEntriesToFolder([this.#draggedEntry.id], folderId);
        }
      });
    });

    // Context menu (right-click)
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const entry = this.#entries.find(en => en.id === row.dataset.entryId);
        if (entry) {
          showContextMenu({
            entry,
            x: e.clientX,
            y: e.clientY,
            getEntryTypes,
            t,
            onAction: (action, entry) => this.#handleContextMenuAction(action, entry)
          });
        }
      });
    });

    // Hover preview with delay
    let hoverTimeout = null;
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      row.addEventListener('mouseenter', (e) => {
        hoverTimeout = setTimeout(() => {
          const entry = this.#entries.find(en => en.id === row.dataset.entryId);
          if (entry) {
            this.#showEntryPreview(entry, e.clientX, e.clientY);
          }
        }, 500); // 500ms delay
      });

      row.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        this.#hideEntryPreview();
      });

      row.addEventListener('mousemove', (e) => {
        const preview = document.querySelector('.vault-entry-preview');
        if (preview) {
          this.#positionPreview(preview, e.clientX, e.clientY);
        }
      });
    });
  }

  // Context menu moved to ./vault/components/context-menu.js
  async #handleContextMenuAction(action, entry) {
    switch (action) {
      case 'copy-username':
        await this.#copyToClipboard(entry.data?.username, t('vault.messages.usernameCopied'));
        break;
      case 'copy-password':
        await this.#copyToClipboard(entry.data?.password, t('vault.messages.passwordCopied'));
        break;
      case 'open-url':
        if (entry.data?.url) window.open(entry.data.url, '_blank', 'noopener,noreferrer');
        break;
      case 'edit':
        this.#selectedEntry = entry;
        this.#updateDetailPanel();
        this.#openEditModal(entry);
        break;
      case 'duplicate':
        await this.#duplicateEntry(entry);
        break;
      case 'move':
        this.#selectedEntries.clear();
        this.#selectedEntries.add(entry.id);
        document.getElementById('move-folder-modal').outerHTML = renderMoveFolderModal({ folders: this.#folders, t });
        this.#openModal('move-folder-modal');
        break;
      case 'toggle-favorite':
        await this.#toggleEntryFavorite(entry);
        break;
      case 'toggle-pin':
        await this.#toggleEntryPin(entry);
        break;
      case 'delete': {
        const confirmed = await showConfirm(t('vault.messages.deleteEntryConfirm', { title: entry.title }), {
          type: 'danger',
          confirmLabel: t('common.delete') || 'Delete',
        });
        if (confirmed) this.#deleteEntryWithUndo(entry);
        break;
      }
    }
  }

  async #toggleEntryFavorite(entry) {
    try {
      const newFavorite = !entry.favorite;
      await window.vault.entries.update(entry.id, { favorite: newFavorite });
      entry.favorite = newFavorite;
      this.#showToast(newFavorite ? t('vault.messages.addedToFavorites') : t('vault.messages.removedFromFavorites'), 'success');
      this.#render();
      if (this.#selectedEntry?.id === entry.id) {
        this.#updateDetailPanel();
      }
    } catch (error) {
      this.#showToast(t('vault.messages.updateError'), 'error');
    }
  }

  async #toggleEntryPin(entry) {
    try {
      const newPinned = !entry.pinned;
      await window.vault.entries.update(entry.id, { pinned: newPinned });
      entry.pinned = newPinned;
      this.#showToast(newPinned ? t('vault.messages.pinnedToTop') : t('vault.messages.unpinned'), 'success');
      this.#render();
      if (this.#selectedEntry?.id === entry.id) {
        this.#updateDetailPanel();
      }
    } catch (error) {
      this.#showToast(t('vault.messages.updateError'), 'error');
    }
  }

  #showEntryPreview(entry, x, y) {
    this.#hideEntryPreview();

    const type = getEntryTypes()[entry.type] || ENTRY_TYPES.login;
    const preview = document.createElement('div');
    preview.className = 'vault-entry-preview';

    let fieldsHtml = '';

    if (entry.type === 'login') {
      if (entry.data?.username) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">${t('vault.labels.username')}</span>
            <span class="vault-preview-value">${escapeHtml(entry.data.username)}</span>
          </div>
        `;
      }
      if (entry.data?.password) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">${t('vault.labels.password')}</span>
            <span class="vault-preview-value vault-preview-password">••••••••••••</span>
          </div>
        `;
      }
      if (entry.data?.url) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">${t('vault.labels.url')}</span>
            <span class="vault-preview-value">${escapeHtml(entry.data.url)}</span>
          </div>
        `;
      }
    } else if (entry.type === 'card') {
      if (entry.data?.cardNumber) {
        const masked = '**** **** **** ' + (entry.data.cardNumber.slice(-4) || '****');
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Card number</span>
            <span class="vault-preview-value">${masked}</span>
          </div>
        `;
      }
      if (entry.data?.expiry) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Expiration</span>
            <span class="vault-preview-value">${escapeHtml(entry.data.expiry)}</span>
          </div>
        `;
      }
    } else if (entry.type === 'note') {
      if (entry.data?.note) {
        const truncated = entry.data.note.length > 100
          ? entry.data.note.slice(0, 100) + '...'
          : entry.data.note;
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Note</span>
            <span class="vault-preview-value">${escapeHtml(truncated)}</span>
          </div>
        `;
      }
    } else if (entry.type === 'identity') {
      if (entry.data?.fullName) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Nom</span>
            <span class="vault-preview-value">${escapeHtml(entry.data.fullName)}</span>
          </div>
        `;
      }
      if (entry.data?.email) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Email</span>
            <span class="vault-preview-value">${escapeHtml(entry.data.email)}</span>
          </div>
        `;
      }
    }

    // Add modified date
    if (entry.modifiedAt) {
      const modified = new Date(entry.modifiedAt).toLocaleDateString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">Modified</span>
          <span class="vault-preview-value">${modified}</span>
        </div>
      `;
    }

    preview.innerHTML = `
      <div class="vault-preview-header">
        <div class="vault-preview-icon" data-type-color="${type.color}">
          ${type.icon}
        </div>
        <span class="vault-preview-title">${escapeHtml(entry.title)}</span>
      </div>
      <div class="vault-preview-fields">
        ${fieldsHtml}
      </div>
    `;

    document.body.appendChild(preview);
    this.#positionPreview(preview, x, y);
  }

  #hideEntryPreview() {
    document.querySelector('.vault-entry-preview')?.remove();
  }

  #positionPreview(preview, x, y) {
    const rect = preview.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let posX = x + 15;
    let posY = y + 15;

    if (posX + rect.width > viewportW) posX = x - rect.width - 15;
    if (posY + rect.height > viewportH) posY = y - rect.height - 15;
    if (posX < 0) posX = 10;
    if (posY < 0) posY = 10;

    preview.style.left = `${posX}px`;
    preview.style.top = `${posY}px`;
  }

  #updateBulkActionsUI() {
    const bulkBar = document.getElementById('bulk-actions');
    const countEl = document.querySelector('.vault-bulk-count');
    const selectAllCheckbox = document.getElementById('select-all');
    const filteredEntries = this.#getFilteredEntries();

    if (bulkBar) {
      bulkBar.classList.toggle('visible', this.#selectedEntries.size > 0);
    }
    if (countEl) {
      countEl.textContent = `${this.#selectedEntries.size} selected`;
    }
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = this.#selectedEntries.size === filteredEntries.length && filteredEntries.length > 0;
      selectAllCheckbox.indeterminate = this.#selectedEntries.size > 0 && this.#selectedEntries.size < filteredEntries.length;
    }

    // Update row checkboxes
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      const checkbox = row.querySelector('.vault-checkbox[data-action="multi-select"]');
      const isSelected = this.#selectedEntries.has(row.dataset.entryId);
      row.classList.toggle('multi-selected', isSelected);
      if (checkbox) checkbox.checked = isSelected;
    });
  }

  async #moveEntriesToFolder(entryIds, folderId) {
    try {
      for (const id of entryIds) {
        await window.vault.entries.update(id, { folderId: folderId || null });
        const entry = this.#entries.find(e => e.id === id);
        if (entry) entry.folderId = folderId || null;
      }
      this.#selectedEntries.clear();
      this.#showToast(t('vault.messages.entriesMoved', { count: entryIds.length }), 'success');
      this.#render();
    } catch (error) {
      this.#showToast(t('vault.messages.moveError'), 'error');
    }
  }

  #updateEntryList() {
    const container = document.getElementById('vault-entries');
    const countEl = document.querySelector('.vault-list-count');
    const sortBtnText = document.querySelector('#sort-btn span');

    if (!container) return;

    const filteredEntries = this.#getFilteredEntries();

    if (countEl) {
      countEl.textContent = `${filteredEntries.length} entry/entries`;
    }

    if (sortBtnText) {
      sortBtnText.textContent = getSortOptions().find(s => s.id === this.#sortBy)?.label || 'Sort';
    }

    container.innerHTML = filteredEntries.length === 0
      ? renderEmptyState({ searchQuery: this.#searchQuery, t })
      : filteredEntries.map((entry, idx) => this.#renderEntryRow(entry, idx)).join('');

    this.#attachEntryRowEvents();
  }

  #updateFilterUI() {
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
      filterBtn.classList.toggle('active', this.#hasActiveFilters());
      const badge = filterBtn.querySelector('.filter-badge');
      if (this.#hasActiveFilters() && !badge) {
        filterBtn.insertAdjacentHTML('beforeend', '<span class="filter-badge"></span>');
      } else if (!this.#hasActiveFilters() && badge) {
        badge.remove();
      }
    }

    // Update type chips
    document.querySelectorAll('[data-filter-type]').forEach(chip => {
      chip.classList.toggle('active', (chip.dataset.filterType || null) === (this.#searchFilters.type || null));
    });

    // Update strength chips
    document.querySelectorAll('[data-filter-strength]').forEach(chip => {
      chip.classList.toggle('active', (chip.dataset.filterStrength || null) === (this.#searchFilters.strength || null));
    });

    // Update age chips
    document.querySelectorAll('[data-filter-age]').forEach(chip => {
      chip.classList.toggle('active', (chip.dataset.filterAge || null) === (this.#searchFilters.age || null));
    });
  }

  #updateEntrySelection() {
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      const isSelected = row.dataset.entryId === this.#selectedEntry?.id;
      row.classList.toggle('selected', isSelected);
      row.setAttribute('aria-selected', isSelected);
      row.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
  }

  #updateDetailPanel() {
    const panel = document.getElementById('detail-panel');
    if (!panel) return;

    panel.classList.toggle('empty', !this.#selectedEntry);
    panel.innerHTML = this.#selectedEntry ? this.#renderEntryDetail() : renderNoSelection();
    this.#attachDetailPanelEvents();

    // Update breach indicator asynchronously
    if (this.#selectedEntry && this.#selectedEntry.type === 'login' && this.#selectedEntry.data?.password) {
      this.#updateBreachIndicator(this.#selectedEntry);
    }
  }

  async #updateBreachIndicator(entry) {
    const indicator = document.getElementById('password-breach-indicator');
    if (!indicator) return;

    const breachCount = await this.#getBreachCount(entry);
    if (breachCount > 0) {
      indicator.innerHTML = `
        <span class="vault-breach-badge" title="This password has been exposed in ${this.#formatBreachCount(breachCount)} data breaches">
          🚨 Compromised
        </span>
      `;
      indicator.classList.add('visible');
    } else if (this.#lastBreachCheck) {
      // Only show "safe" if we've done a check
      indicator.innerHTML = `
        <span class="vault-safe-badge" title="This password has not been found in known breaches">
          ✅ Safe
        </span>
      `;
      indicator.classList.add('visible');
    }
  }

  #attachDetailPanelEvents() {
    // Share button
    document.getElementById('btn-share-entry')?.addEventListener('click', () => {
      if (this.#selectedEntry) {
        this.#shareModal.open(this.#selectedEntry);
      }
    });

    // Toggle visibility
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.closest('.vault-field');
        const textEl = field?.querySelector('.vault-field-text');
        if (!textEl) return;

        const isMasked = textEl.classList.contains('masked');
        const realValue = textEl.dataset.value;

        if (isMasked) {
          textEl.textContent = realValue;
          textEl.classList.remove('masked');
          btn.querySelector('.icon-show').hidden = true;
          btn.querySelector('.icon-hide').hidden = false;
          btn.setAttribute('aria-pressed', 'true');
          btn.setAttribute('aria-label', window.i18n?.t('vault.aria.hideValue') || 'Hide value');
        } else {
          textEl.textContent = '•'.repeat(Math.min(realValue.length, 24));
          textEl.classList.add('masked');
          btn.querySelector('.icon-show').hidden = false;
          btn.querySelector('.icon-hide').hidden = true;
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', window.i18n?.t('vault.aria.showValue') || 'Show value');
        }
      });
    });

    // Copy field
    document.querySelectorAll('.copy-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        const label = btn.closest('.vault-field')?.querySelector('.vault-field-label')?.textContent || 'Value';
        await this.#copyToClipboard(btn.dataset.value, `${label} copied`);
      });
    });

    // TOTP field
    this.#initTOTPFields();

    // Copy TOTP
    document.querySelectorAll('.copy-totp').forEach(btn => {
      btn.addEventListener('click', async () => {
        const totpField = btn.closest('.vault-totp-field');
        const codeEl = totpField?.querySelector('.totp-digits');
        const code = codeEl?.textContent?.replace(/\s/g, '');
        if (code && code !== '------') {
          await this.#copyToClipboard(code, t('vault.messages.codeCopied'));
        }
      });
    });

    // Click-to-copy on the TOTP code digits
    document.querySelectorAll('.vault-totp-code').forEach(el => {
      el.addEventListener('click', async () => {
        const code = el.querySelector('.totp-digits')?.textContent?.replace(/\s/g, '');
        if (code && code !== '------') {
          await this.#copyToClipboard(code, t('vault.messages.codeCopied'));
          // Visual feedback
          el.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.1)' },
            { transform: 'scale(1)' }
          ], { duration: 200 });
          el.style.color = 'var(--vault-primary)';
          setTimeout(() => el.style.color = '', 500);
        }
      });
      el.style.cursor = 'pointer';
      el.title = t('vault.aria.clickToCopy');
    });

    // Show TOTP QR Code
    document.querySelectorAll('.show-totp-qr').forEach(btn => {
      btn.addEventListener('click', () => {
        const secret = btn.dataset.secret;
        const issuer = btn.dataset.title || 'GenPwd';
        const account = btn.dataset.account || '';
        if (secret) {
          showTOTPQRModal({ secret, issuer, account, t });
        }
      });
    });

    // Password History toggle
    document.querySelectorAll('.vault-history-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = btn.nextElementSibling;
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !isExpanded);
        list.hidden = isExpanded;
        btn.querySelector('.vault-history-chevron').style.transform = isExpanded ? '' : 'rotate(180deg)';
      });
    });

    // Copy history password
    document.querySelectorAll('.copy-history-pwd').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.#copyToClipboard(btn.dataset.password, t('vault.messages.oldPasswordCopied'));
      });
    });

    // Restore password from history
    document.querySelectorAll('.restore-history-pwd').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!this.#selectedEntry) return;
        const index = parseInt(btn.dataset.index, 10);
        await this.#restorePasswordFromHistory(index);
      });
    });

    // Reveal history password on click
    document.querySelectorAll('.vault-history-password').forEach(el => {
      el.addEventListener('click', function () {
        const item = this.closest('.vault-history-item');
        const btn = item?.querySelector('.copy-history-pwd');
        const realPwd = btn?.dataset.password;
        if (realPwd) {
          const isRevealed = this.classList.toggle('revealed');
          this.textContent = isRevealed ? realPwd : this.dataset.masked || realPwd.substring(0, 2) + '••••••' + realPwd.slice(-2);
          if (!this.dataset.masked) this.dataset.masked = this.textContent;
        }
      });
    });

    // Favorite toggle
    document.getElementById('btn-toggle-favorite')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      try {
        await window.vault.entries.update(this.#selectedEntry.id, {
          favorite: !this.#selectedEntry.favorite
        });
        this.#showToast(this.#selectedEntry.favorite ? 'Removed from favorites' : 'Added to favorites', 'success');
      } catch (error) {
        this.#showToast(t('vault.common.error'), 'error');
      }
    });

    // Edit entry
    document.getElementById('btn-edit-entry')?.addEventListener('click', () => {
      if (!this.#selectedEntry) return;
      this.#openEditModal(this.#selectedEntry);
    });

    // Delete entry (with confirmation + undo)
    document.getElementById('btn-delete-entry')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      const confirmed = await showConfirm(t('vault.messages.deleteEntryConfirm', { title: this.#selectedEntry.title }), {
        type: 'danger',
        confirmLabel: t('common.delete') || 'Delete',
      });
      if (confirmed) {
        this.#deleteEntryWithUndo(this.#selectedEntry);
      }
    });

    // Duplicate entry
    document.getElementById('btn-duplicate-entry')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      await this.#duplicateEntry(this.#selectedEntry);
    });

    // Auto-type
    document.getElementById('btn-autotype')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      await this.#executeAutotype(this.#selectedEntry);
    });

    // Share entry
    document.getElementById('btn-share-entry')?.addEventListener('click', () => {
      if (!this.#selectedEntry) return;
      this.#showShareModal(this.#selectedEntry);
    });

    // Notes Markdown toggle (preview/source)
    document.querySelectorAll('.vault-notes-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.closest('.vault-notes-field');
        if (!field) return;

        const mode = btn.dataset.mode;
        const preview = field.querySelector('.vault-notes-preview');
        const source = field.querySelector('.vault-notes-source');

        // Toggle buttons
        field.querySelectorAll('.vault-notes-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle content
        if (mode === 'preview') {
          preview.hidden = false;
          source.hidden = true;
        } else {
          preview.hidden = true;
          source.hidden = false;
        }
      });
    });
  }

  async #deleteEntryWithUndo(entry) {
    // Store entry for potential restore
    this.#pendingDelete = { ...entry };
    const entryId = entry.id;
    const entryTitle = entry.title;

    // Remove from local list immediately (optimistic UI)
    this.#entries = this.#entries.filter(e => e.id !== entryId);
    this.#selectedEntry = null;
    this.#updateEntryList();
    this.#updateDetailPanel();

    // Show toast with undo
    this.#showToastWithUndo(
      `"${entryTitle}" deleted`,
      async () => {
        // Undo: restore entry
        if (this.#pendingDelete) {
          this.#entries.push(this.#pendingDelete);
          this.#pendingDelete = null;
          this.#updateEntryList();
          this.#showToast(t('vault.messages.restored'), 'success');
        }
      },
      async () => {
        // Confirm: actually delete
        try {
          await window.vault.entries.delete(entryId);
          this.#pendingDelete = null;
        } catch (error) {
          // Restore on error
          if (this.#pendingDelete) {
            this.#entries.push(this.#pendingDelete);
            this.#pendingDelete = null;
            this.#updateEntryList();
          }
          this.#showToast(t('vault.messages.deleteError'), 'error');
        }
      }
    );
  }

  async #duplicateEntry(entry) {
    try {
      const newData = { ...entry.data };
      const newEntry = await window.vault.entries.add(
        entry.type,
        `${entry.title} (copy)`,
        { ...newData, folderId: entry.folderId, notes: entry.notes, tags: entry.tags || [] }
      );
      this.#selectedEntry = newEntry;
      this.#showToast(t('vault.messages.entryDuplicated'), 'success');
    } catch (error) {
      this.#showToast(t('vault.messages.duplicationError'), 'error');
    }
  }

  async #restorePasswordFromHistory(historyIndex) {
    if (!this.#selectedEntry) return;

    const entry = this.#selectedEntry;
    const history = entry.data?.passwordHistory || [];

    if (historyIndex < 0 || historyIndex >= history.length) {
      this.#showToast(t('vault.messages.invalidIndex'), 'error');
      return;
    }

    const toRestore = history[historyIndex];
    const currentPassword = entry.data?.password;

    // Build new history: add current password, remove the restored one
    const newHistory = [
      {
        password: currentPassword,
        changedAt: new Date().toISOString(),
        reason: 'Restauration'
      },
      ...history.filter((_, idx) => idx !== historyIndex)
    ].slice(0, 10); // Keep max 10

    try {
      await window.vault.entries.update(entry.id, {
        data: {
          ...entry.data,
          password: toRestore.password,
          passwordHistory: newHistory
        }
      });
      this.#showToast(t('vault.messages.passwordRestored'), 'success');
    } catch (error) {
      this.#showToast(t('vault.messages.restoreError'), 'error');
    }
  }

  #addPasswordToHistory(entry, newPassword) {
    const currentPassword = entry.data?.password;
    if (!currentPassword || currentPassword === newPassword) return entry.data?.passwordHistory || [];

    const history = entry.data?.passwordHistory || [];
    const newHistory = [
      {
        password: currentPassword,
        changedAt: new Date().toISOString(),
        reason: t('vault.generator.manualChange')
      },
      ...history
    ].slice(0, 10); // Keep max 10

    return newHistory;
  }

  async #executeAutotype(entry) {
    if (!entry || entry.type !== 'login') return;

    const username = entry.data?.username || '';
    const password = entry.data?.password || '';
    const url = entry.data?.url || '';

    if (!username && !password) {
      this.#showToast(t('vault.messages.noDataToFill'), 'warning');
      return;
    }

    // Check if Electron auto-type is available (Phase 6 feature)
    if (window.electronAPI?.performAutoType) {
      try {
        this.#showToast(t('vault.messages.autoFillProgress'), 'info');

        // Get default sequence or custom one from entry
        const sequence = entry.data?.autoTypeSequence ||
          await window.electronAPI.getDefaultAutoTypeSequence?.() ||
          '{USERNAME}{TAB}{PASSWORD}{ENTER}';

        // Perform auto-type (minimizes window, types into focused app)
        const result = await window.electronAPI.performAutoType(sequence, {
          username,
          password,
          url,
          notes: entry.notes || ''
        });

        if (result.success) {
          this.#showToast(t('vault.messages.autoFillComplete'), 'success');
        } else {
          safeLog('[VaultUI] Auto-type failed:', result.error);
          this.#showToast(`${t('vault.common.error')}: ${result.error}`, 'error');
        }
      } catch (error) {
        safeLog('[VaultUI] Auto-type error:', error);
        this.#showToast(t('vault.messages.autoFillError'), 'error');
      }
    } else {
      // Fallback: Copy to clipboard with instructions
      showAutotypeModal({
        entry,
        onCopyUsername: async (u) => await this.#copyToClipboard(u, t('vault.messages.usernameCopied')),
        onCopyPassword: async (p) => await this.#copyToClipboard(p, t('vault.messages.passwordCopied')),
        t
      });
    }
  }

  // Autotype modal moved to ./vault/modals/autotype-modal.js

  #showShareModal(entry) {
    // Generate a random passphrase
    const passphrase = this.#generateSharePassphrase();

    const modal = document.createElement('div');
    modal.className = 'vault-modal-overlay';
    modal.id = 'share-modal';
    modal.innerHTML = `
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3>Partager "${escapeHtml(entry.title)}"</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="${t('vault.common.close')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vault-modal-body">
          <p class="vault-share-warning">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Data will be encrypted with the passphrase below.
          </p>

          <div class="vault-form-group">
            <label class="vault-label">Passphrase</label>
            <div class="vault-share-passphrase">
              <input type="text" class="vault-input" id="share-passphrase" value="${passphrase}" readonly>
              <button type="button" class="vault-btn vault-btn-secondary" id="regenerate-passphrase" title="Regenerate">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
              </button>
              <button type="button" class="vault-btn vault-btn-secondary" id="copy-passphrase" title="Copier">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <p class="vault-share-hint">Share this phrase separately (e.g., by phone)</p>
          </div>

          <div class="vault-form-group">
            <label class="vault-label">Expiration</label>
            <select class="vault-input vault-select" id="share-expiry">
              <option value="3600000">1 heure</option>
              <option value="86400000" selected>24 heures</option>
              <option value="604800000">7 days</option>
              <option value="2592000000">30 days</option>
            </select>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="share-include-notes">
              <span>Inclure les notes</span>
            </label>
          </div>

          <div class="vault-share-result" id="share-result" hidden>
            <label class="vault-label">Encrypted text to share</label>
            <textarea class="vault-input vault-textarea" id="share-output" rows="4" readonly></textarea>
            <button type="button" class="vault-btn vault-btn-primary" id="copy-share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy encrypted text
            </button>
          </div>

          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>${t('vault.common.cancel')}</button>
            <button type="button" class="vault-btn vault-btn-primary" id="generate-share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Generate share
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind events
    modal.querySelector('[data-close-modal]').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Regenerate passphrase
    modal.querySelector('#regenerate-passphrase').addEventListener('click', () => {
      const input = modal.querySelector('#share-passphrase');
      input.value = this.#generateSharePassphrase();
    });

    // Copy passphrase
    modal.querySelector('#copy-passphrase').addEventListener('click', async () => {
      const passphrase = modal.querySelector('#share-passphrase').value;
      await this.#copyToClipboard(passphrase, t('vault.messages.passphraseCopied'));
    });

    // Generate share
    modal.querySelector('#generate-share').addEventListener('click', async () => {
      const passphrase = modal.querySelector('#share-passphrase').value;
      const expiry = parseInt(modal.querySelector('#share-expiry').value, 10);
      const includeNotes = modal.querySelector('#share-include-notes').checked;

      try {
        const shareText = await this.#createSecureShare(entry, passphrase, { expiresIn: expiry, includeNotes });
        modal.querySelector('#share-output').value = shareText;
        modal.querySelector('#share-result').hidden = false;
        this.#showToast(t('vault.messages.shareGenerated'), 'success');
      } catch (error) {
        this.#showToast(t('vault.messages.generationError'), 'error');
      }
    });

    // Copy share
    modal.querySelector('#copy-share').addEventListener('click', async () => {
      const shareText = modal.querySelector('#share-output').value;
      await this.#copyToClipboard(shareText, t('vault.messages.encryptedTextCopied'));
    });
  }

  #generateSharePassphrase() {
    const words = [
      'pomme', 'banane', 'cerise', 'dragon', 'eagle', 'foret', 'jardin', 'harbor',
      'island', 'jungle', 'knight', 'citron', 'montagne', 'nature', 'ocean', 'palace',
      'queen', 'river', 'storm', 'tigre', 'umbrella', 'valley', 'winter', 'xenon',
      'yellow', 'zebre', 'alpha', 'brave', 'crystal', 'diamond', 'ember', 'falcon'
    ];

    // Use CSPRNG for secure word selection
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);

    const selected = [];
    for (let i = 0; i < 4; i++) {
      const idx = randomBytes[i] % words.length;
      selected.push(words[idx]);
    }

    return selected.join('-');
  }

  async #createSecureShare(entry, passphrase, options = {}) {
    const { expiresIn = 86400000, includeNotes = false } = options;

    // Build shareable data
    const shareData = {
      v: 1,
      type: entry.type,
      title: entry.title,
      data: {},
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn).toISOString()
    };

    // Include relevant fields
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

    // Using PBKDF2.LEGACY_ITERATIONS (100000) for share compatibility
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, // PBKDF2.LEGACY_ITERATIONS
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

    // Combine and encode
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return `GENPWD:1:${btoa(String.fromCharCode(...result))}`;
  }

  #openEditModal(entry) {
    // Clone entry data for editing session
    this.#editingData = { ...entry, data: { ...entry.data }, attachments: [...(entry.attachments || [])] };
    this.#renderEditModalContent(entry);
    this.#openModal('edit-entry-modal');
  }

  #renderEditModalContent(entry = this.#selectedEntry) {
    const modal = document.getElementById('edit-entry-modal');
    const fieldsContainer = document.getElementById('edit-entry-fields');
    if (!modal || !fieldsContainer) return;

    let fieldsHtml = `
      <div class="vault-form-group">
        <label class="vault-label" for="edit-title">Titre <span class="required">*</span></label>
        <input type="text" class="vault-input" id="edit-title" value="${escapeHtml(entry.title)}" required aria-required="true" aria-invalid="false">
      </div>
      <div class="vault-form-group">
        <label class="vault-label" for="edit-folder">${t('vault.labels.folder')}</label>
        <select class="vault-input vault-select" id="edit-folder">
          <option value="">No folder</option>
          ${this.#folders.map(f => `<option value="${f.id}" ${entry.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>
    `;

    switch (entry.type) {
      case 'login':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-username">Username / Email</label>
            <input type="text" class="vault-input" id="edit-username" value="${escapeHtml(entry.data?.username || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-password">${t('vault.labels.password')}</label>
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="edit-password" value="${escapeHtml(entry.data?.password || '')}">
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="edit-password" aria-label="Show">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button type="button" class="vault-input-btn" id="edit-generate-password" data-tooltip="Generate" aria-label="Generate password">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
              </button>
            </div>
            <div class="vault-password-strength" id="edit-password-strength"></div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-url">${t('vault.labels.url')}</label>
            <input type="url" class="vault-input" id="edit-url" value="${escapeHtml(entry.data?.url || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-totp">TOTP Key (2FA)</label>
            <div class="vault-input-group">
              <input type="text" class="vault-input mono" id="edit-totp" value="${escapeHtml(entry.data?.totp || '')}"
                     placeholder="${t('vault.placeholders.totpKeyExample')}" autocomplete="off" spellcheck="false">
              <button type="button" class="vault-input-btn" id="edit-scan-totp" data-tooltip="Scanner QR" aria-label="Scanner QR ou coller otpauth://">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
            </div>
            <span class="vault-field-hint">Secret Base32 ou URI otpauth://</span>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-expires">Password expiration</label>
            <div class="vault-expiry-picker">
              <select class="vault-input vault-select" id="edit-expires-preset">
                <option value="">Jamais</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">6 months</option>
                <option value="365">1 an</option>
                <option value="custom" ${entry.data?.expiresAt ? 'selected' : ''}>Custom date...</option>
              </select>
              <input type="date" class="vault-input" id="edit-expires"
                     value="${entry.data?.expiresAt || ''}" ${entry.data?.expiresAt ? '' : 'hidden'}>
            </div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-notes">${t('vault.labels.notes')}</label>
            <textarea class="vault-input vault-textarea" id="edit-notes" rows="3">${escapeHtml(entry.notes || '')}</textarea>
          </div>
        `;
        break;
      case 'note':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-content">Contenu</label>
            <textarea class="vault-input vault-textarea" id="edit-content" rows="8">${escapeHtml(entry.data?.content || '')}</textarea>
          </div>
        `;
        break;
      case 'card':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-holder">Holder</label>
            <input type="text" class="vault-input" id="edit-holder" value="${escapeHtml(entry.data?.holder || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-cardnumber">Card number</label>
            <input type="text" class="vault-input" id="edit-cardnumber" value="${escapeHtml(entry.data?.number || '')}">
          </div>
          <div class="vault-form-row">
            <div class="vault-form-group">
              <label class="vault-label" for="edit-expiry">Expiration</label>
              <input type="text" class="vault-input" id="edit-expiry" value="${escapeHtml(entry.data?.expiry || '')}" placeholder="${t('vault.placeholders.expiryFormat')}">
            </div>
            <div class="vault-form-group">
              <label class="vault-label" for="edit-cvv">CVV</label>
              <input type="password" class="vault-input" id="edit-cvv" value="${escapeHtml(entry.data?.cvv || '')}" maxlength="4">
            </div>
          </div>
        `;
        break;
      case 'identity':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-fullname">Full name</label>
            <input type="text" class="vault-input" id="edit-fullname" value="${escapeHtml(entry.data?.fullName || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-email">Email</label>
            <input type="email" class="vault-input" id="edit-email" value="${escapeHtml(entry.data?.email || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-phone">Phone</label>
            <input type="tel" class="vault-input" id="edit-phone" value="${escapeHtml(entry.data?.phone || '')}">
          </div>
        `;
        break;
    }

    // Add custom fields section
    const existingFields = entry.data?.fields || entry.fields || [];
    fieldsHtml += renderCustomFieldsSection({ existingFields, t });

    fieldsContainer.innerHTML = fieldsHtml;
    this.#hasDirtyForm = false;

    // Attach edit modal specific events
    setTimeout(() => {
      this.#attachEditModalDynamicEvents(entry, modal);
    }, 50);
  }

  #attachEditModalDynamicEvents(entry, modal) {
    // Attach custom fields events
    this.#attachCustomFieldsEvents();
    // Toggle password visibility
    modal.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    // Generate password with popover
    document.getElementById('edit-generate-password')?.addEventListener('click', (e) => {
      e.stopPropagation();
      showPwdGenerator({
        targetInputId: 'edit-password',
        onPasswordGenerated: (pwd, input) => {
          input.value = pwd;
          input.type = 'text';
          this.#updateEditPasswordStrength(pwd);
        },
        onCopy: () => this.#showToast(t('vault.common.copied'), 'success'),
        t
      });
    });

    // Password strength
    document.getElementById('edit-password')?.addEventListener('input', (e) => {
      this.#updateEditPasswordStrength(e.target.value);
    });

    // Initial password strength
    if (entry.type === 'login' && entry.data?.password) {
      this.#updateEditPasswordStrength(entry.data.password);
    }

    // Expiry preset dropdown for edit form
    const editExpiresPreset = document.getElementById('edit-expires-preset');
    const editExpiresInput = document.getElementById('edit-expires');
    editExpiresPreset?.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === 'custom') {
        editExpiresInput.hidden = false;
        editExpiresInput.focus();
      } else if (value) {
        editExpiresInput.hidden = true;
        // Calculate date from preset (days)
        const date = new Date();
        date.setDate(date.getDate() + parseInt(value, 10));
        editExpiresInput.value = date.toISOString().split('T')[0];
      } else {
        editExpiresInput.hidden = true;
        editExpiresInput.value = '';
      }
    });

    document.getElementById('edit-title')?.focus();
  }

  #renderAttachmentsUI(entry) {
    const attachments = entry.attachments || [];

    return `
      <div class="vault-detail-section">
        <div class="vault-detail-header">
           <h3 class="vault-detail-subtitle">Attachments (${attachments.length})</h3>
           ${this.#isEditing ? `
             <div class="vault-file-drop-zone" id="file-drop-zone">
               <span class="drop-icon">📎</span>
               <span class="drop-text">Drop your files here or <button type="button" class="link-btn" id="btn-browse-files">browse</button></span>
               <input type="file" id="file-input" multiple class="vault-file-input-hidden">
             </div>
           ` : ''}
        </div>
        
        <div class="vault-attachments-list">
          ${attachments.length === 0 ? '<div class="empty-text">No attachments</div>' : ''}
          ${attachments.map((file, index) => `
            <div class="vault-attachment-item">
              <div class="attachment-icon">${this.#getFileIcon(file.type)}</div>
              <div class="attachment-info">
                <div class="attachment-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="attachment-meta">${this.#formatFileSize(file.size)}</div>
              </div>
              <div class="attachment-actions">
                ${this.#isEditing ? `
                  <button type="button" class="vault-icon-btn danger" data-delete-attachment="${index}" title="Delete">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                ` : `
                  <button type="button" class="vault-icon-btn" data-download-attachment="${index}" title="Download">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  #getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('text')) return '📝';
    return '📎';
  }

  #formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  #initAttachmentsEvents() {
    const dropZone = document.getElementById('file-drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('btn-browse-files');

    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        this.#handleFiles(e.dataTransfer.files);
      });
    }

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => this.#handleFiles(fileInput.files));
    }

    // Delete handling
    this.#container.querySelectorAll('[data-delete-attachment]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.deleteAttachment, 10);
        this.#editingData.attachments.splice(index, 1);
        this.#renderEditModalContent(); // Re-render to update list
      });
    });

    // Download handling
    this.#container.querySelectorAll('[data-download-attachment]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.downloadAttachment, 10);
        this.#downloadAttachment(index);
      });
    });
  }

  async #handleFiles(fileList) {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB limit for JSON perf

    for (const file of fileList) {
      if (file.size > MAX_SIZE) {
        this.#showToast(t('vault.messages.fileTooLarge', { name: file.name }), 'error');
        continue;
      }

      try {
        const base64 = await this.#readFileAsBase64(file);
        if (!this.#editingData.attachments) this.#editingData.attachments = [];

        this.#editingData.attachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
          id: crypto.randomUUID()
        });

        this.#showToast(t('vault.messages.attachmentAdded', { name: file.name }), 'success');
      } catch (err) {
        safeLog('[VaultUI] File read error:', err);
        this.#showToast(t('vault.messages.fileReadError'), 'error');
      }
    }
    this.#renderEditModalContent();
  }

  #readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // Returns data:mime;base64,...
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  #downloadAttachment(index) {
    const entry = this.#selectedEntry;
    if (!entry || !entry.attachments) return;

    const file = entry.attachments[index];
    if (!file) return;

    try {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      this.#showToast(t('vault.messages.downloadError'), 'error');
    }
  }

  #updateEditPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    const el = document.getElementById('edit-password-strength');
    if (el) {
      el.innerHTML = `
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}"></div>
        </div>
        <span class="vault-strength-text ${strength.level}">${strength.label}</span>
      `;
      // CSP-compliant: set width via CSS custom property
      const fill = el.querySelector('.vault-strength-fill');
      if (fill) fill.style.setProperty('--strength-width', `${strength.percent}%`);
    }
  }

  #attachEditEntryEvents() {
    const modal = document.getElementById('edit-entry-modal');
    if (!modal) return;

    // Track form changes for dirty state
    const form = document.getElementById('edit-entry-form');
    if (form) {
      form.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('input', () => {
          this.#hasDirtyForm = true;
          this.#updateDirtyIndicator(modal, true);
        });
      });
    }

    // Close button with dirty check
    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (this.#hasDirtyForm) {
          const confirmed = await this.#showConfirmDialog(
            'Unsaved changes',
            'You have unsaved changes. Do you really want to close without saving?',
            { confirmText: 'Close without saving', confirmClass: 'vault-btn-danger' }
          );
          if (!confirmed) return;
        }
        this.#hasDirtyForm = false;
        this.#closeModal('edit-entry-modal');
      });
    });

    document.getElementById('edit-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.#selectedEntry) return;

      const title = document.getElementById('edit-title')?.value;
      const folderId = document.getElementById('edit-folder')?.value || null;

      if (!title) {
        this.#showToast(t('vault.messages.titleRequired'), 'warning');
        return;
      }

      const data = {};
      const entry = this.#selectedEntry;

      switch (entry.type) {
        case 'login':
          data.username = document.getElementById('edit-username')?.value || '';
          data.password = document.getElementById('edit-password')?.value || '';
          data.url = document.getElementById('edit-url')?.value || '';
          // Parse TOTP - support both Base32 and otpauth:// URI
          const totpInput = document.getElementById('edit-totp')?.value?.trim() || '';
          if (totpInput) {
            if (totpInput.startsWith('otpauth://')) {
              try {
                data.totp = this.#parseOTPAuthURI(totpInput).secret;
              } catch {
                data.totp = totpInput; // Keep as-is if parsing fails
              }
            } else {
              data.totp = totpInput.toUpperCase().replace(/\s/g, '');
            }
          }
          // Password expiration date
          const expiresValue = document.getElementById('edit-expires')?.value || '';
          if (expiresValue) {
            data.expiresAt = expiresValue;
          }
          break;
        case 'note':
          data.content = document.getElementById('edit-content')?.value || '';
          break;
        case 'card':
          data.holder = document.getElementById('edit-holder')?.value || '';
          data.number = document.getElementById('edit-cardnumber')?.value || '';
          data.expiry = document.getElementById('edit-expiry')?.value || '';
          data.cvv = document.getElementById('edit-cvv')?.value || '';
          break;
        case 'identity':
          data.fullName = document.getElementById('edit-fullname')?.value || '';
          data.email = document.getElementById('edit-email')?.value || '';
          data.phone = document.getElementById('edit-phone')?.value || '';
          break;
      }

      const notes = document.getElementById('edit-notes')?.value;

      // Add password history if password changed (for login type)
      if (entry.type === 'login' && data.password && data.password !== entry.data?.password) {
        data.passwordHistory = this.#addPasswordToHistory(entry, data.password);
      } else if (entry.type === 'login' && entry.data?.passwordHistory) {
        // Preserve existing history
        data.passwordHistory = entry.data.passwordHistory;
      }

      // Collect custom fields
      const customFields = this.#collectCustomFields();
      if (customFields.length > 0) {
        data.fields = customFields;
      }

      try {
        await window.vault.entries.update(entry.id, { title, folderId, data, notes });
        this.#hasDirtyForm = false;
        this.#closeModal('edit-entry-modal');
        this.#showToast(t('vault.messages.entryModified'), 'success');
      } catch (error) {
        this.#showToast(error.message || t('vault.common.error'), 'error');
      }
    });
  }

  /**
   * Update visual indicator for unsaved changes
   * @param {HTMLElement} modal - Modal element
   * @param {boolean} isDirty - Whether form has unsaved changes
   */
  #updateDirtyIndicator(modal, isDirty) {
    const title = modal.querySelector('.vault-modal-title');
    if (!title) return;

    let indicator = title.querySelector('.dirty-indicator');
    if (isDirty && !indicator) {
      indicator = document.createElement('span');
      indicator.className = 'dirty-indicator';
      indicator.setAttribute('aria-label', 'Unsaved changes');
      indicator.title = 'Unsaved changes';
      indicator.textContent = ' •';
      title.appendChild(indicator);
    } else if (!isDirty && indicator) {
      indicator.remove();
    }
  }

  #attachAddEntryEvents() {
    const modal = document.getElementById('add-entry-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.#closeModal('add-entry-modal'));
    });

    // Template toggle
    document.getElementById('toggle-templates')?.addEventListener('click', () => {
      const picker = document.getElementById('template-picker');
      const toggle = document.getElementById('toggle-templates');
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', !isExpanded);
      picker.hidden = isExpanded;
      toggle.querySelector('.vault-template-chevron').style.transform = isExpanded ? '' : 'rotate(180deg)';
    });

    // Template search with debounce
    let templateSearchTimeout;
    document.getElementById('template-search')?.addEventListener('input', (e) => {
      clearTimeout(templateSearchTimeout);
      templateSearchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.vault-template-item').forEach(item => {
          const name = item.querySelector('.vault-template-name')?.textContent.toLowerCase() || '';
          item.style.display = name.includes(query) ? '' : 'none';
        });
        // Show/hide categories
        document.querySelectorAll('.vault-template-category').forEach(cat => {
          const hasVisible = cat.querySelector('.vault-template-item:not([style*="display: none"])');
          cat.style.display = hasVisible ? '' : 'none';
        });
      }, 100);
    });

    // Template selection
    document.querySelectorAll('.vault-template-item').forEach(item => {
      item.addEventListener('click', () => {
        const templateId = item.dataset.templateId;
        this.#applyTemplate(templateId);
      });
    });

    // Type change
    document.querySelectorAll('input[name="entry-type"]').forEach(radio => {
      radio.addEventListener('change', () => this.#updateEntryTypeFields());
    });

    // Real-time validation for title field
    const titleInput = document.getElementById('entry-title');
    const titleMessage = document.getElementById('entry-title-message');
    titleInput?.addEventListener('input', () => {
      this.#validateField(titleInput, titleMessage, {
        required: true,
        minLength: 1,
        maxLength: 100,
        requiredMessage: t('vault.form.titleRequired'),
        minLengthMessage: t('vault.form.titleTooShort'),
        maxLengthMessage: t('vault.form.titleTooLong')
      });
    });
    titleInput?.addEventListener('blur', () => {
      this.#validateField(titleInput, titleMessage, {
        required: true,
        minLength: 1,
        requiredMessage: t('vault.form.titleRequired')
      });
    });

    // Form submit
    document.getElementById('add-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="entry-type"]:checked')?.value;
      const title = document.getElementById('entry-title')?.value;
      const folderId = document.getElementById('entry-folder')?.value || null;

      if (!type || !title) {
        this.#showToast(t('vault.messages.fillRequiredFields'), 'warning');
        return;
      }

      const data = this.#collectEntryFormData(type);

      // Validation
      if (type === 'login') {
        const url = document.getElementById('entry-url')?.value;
        if (url && !this.#isValidUrl(url)) {
          this.#showToast(t('vault.form.invalidUrl'), 'warning');
          return;
        }
      }

      if (type === 'identity') {
        const email = document.getElementById('entry-email')?.value;
        if (email && !this.#isValidEmail(email)) {
          this.#showToast(t('vault.form.invalidEmail'), 'warning');
          return;
        }
      }

      // Collect selected tags
      const selectedTags = Array.from(document.querySelectorAll('input[name="entry-tags"]:checked'))
        .map(cb => cb.value);

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner-small"></span>';

      try {
        const newEntry = await window.vault.entries.add(type, title, { ...data, folderId, tags: selectedTags });
        this.#closeModal('add-entry-modal');
        this.#selectedEntry = newEntry;
        this.#showToast(t('vault.messages.entryAdded'), 'success');
        // Reset form
        document.getElementById('add-entry-form')?.reset();
      } catch (error) {
        this.#showToast(error.message || t('vault.common.error'), 'error');
        btn.disabled = false;
        btn.textContent = t('vault.common.add');
      }
    });
  }

  #attachAddFolderEvents() {
    const modal = document.getElementById('add-folder-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => this.#closeModal('add-folder-modal'));
    });

    document.getElementById('add-folder-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('folder-name')?.value;

      if (!name) {
        this.#showToast(t('vault.messages.nameRequired'), 'warning');
        return;
      }

      try {
        await window.vault.folders.add(name);
        this.#closeModal('add-folder-modal');
        this.#showToast(t('vault.messages.folderCreated'), 'success');
        document.getElementById('add-folder-form')?.reset();
      } catch (error) {
        this.#showToast(error.message || t('vault.common.error'), 'error');
      }
    });
  }

  #attachTagModalEvents() {
    // Add tag modal
    const addTagModal = document.getElementById('add-tag-modal');
    if (addTagModal) {
      addTagModal.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => this.#closeModal('add-tag-modal'));
      });

      // Color selection
      document.querySelectorAll('#add-tag-colors .vault-color-option').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#add-tag-colors .vault-color-option').forEach(b => {
            b.classList.remove('selected');
            b.innerHTML = '';
          });
          btn.classList.add('selected');
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          document.getElementById('tag-color').value = btn.dataset.color;
        });
      });

      document.getElementById('add-tag-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('tag-name')?.value;
        const color = document.getElementById('tag-color')?.value;

        if (!name) {
          this.#showToast(t('vault.messages.nameRequired'), 'warning');
          return;
        }

        if (await this.#createTag(name, color)) {
          this.#closeModal('add-tag-modal');
          document.getElementById('add-tag-form')?.reset();
          // Reset color selection
          const firstColorBtn = document.querySelector('#add-tag-colors .vault-color-option');
          if (firstColorBtn) firstColorBtn.click();
        }
      });
    }

    // Edit tag modal
    const editTagModal = document.getElementById('edit-tag-modal');
    if (editTagModal) {
      editTagModal.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => this.#closeModal('edit-tag-modal'));
      });

      // Color selection
      document.querySelectorAll('#edit-tag-colors .vault-color-option').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#edit-tag-colors .vault-color-option').forEach(b => {
            b.classList.remove('selected');
            b.innerHTML = '';
          });
          btn.classList.add('selected');
          btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          document.getElementById('edit-tag-color').value = btn.dataset.color;
        });
      });

      // Delete tag button
      document.getElementById('btn-delete-tag')?.addEventListener('click', async () => {
        const tagId = document.getElementById('edit-tag-id')?.value;
        if (!tagId) return;

        const tag = this.#tags.find(t => t.id === tagId);
        const confirmed = await this.#showConfirmDialog(
          'Delete tag',
          `Are you sure you want to delete the tag "${tag?.name}"? It will be removed from all entries.`,
          { confirmText: 'Delete', confirmClass: 'vault-btn-danger' }
        );
        if (confirmed && await this.#deleteTag(tagId)) {
          this.#closeModal('edit-tag-modal');
        }
      });

      document.getElementById('edit-tag-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tagId = document.getElementById('edit-tag-id')?.value;
        const name = document.getElementById('edit-tag-name')?.value;
        const color = document.getElementById('edit-tag-color')?.value;

        if (!name) {
          this.#showToast(t('vault.messages.nameRequired'), 'warning');
          return;
        }

        if (await this.#updateTag(tagId, name, color)) {
          this.#closeModal('edit-tag-modal');
        }
      });
    }

    // Inline tag creation in add entry form
    document.getElementById('btn-create-tag')?.addEventListener('click', async () => {
      const nameInput = document.getElementById('new-tag-name');
      const name = nameInput?.value?.trim();
      if (!name) return;

      const colorBtn = document.querySelector('#tag-color-picker .vault-color-btn.selected');
      const color = colorBtn?.dataset.color || '#6b7280';

      if (await this.#createTag(name, color)) {
        nameInput.value = '';
        // Update the tag picker display
        const pickerList = document.querySelector('.vault-tag-picker-list');
        if (pickerList && this.#tags.length > 0) {
          const newTag = this.#tags[this.#tags.length - 1];
          pickerList.innerHTML = this.#tags.map(tag => `
            <label class="vault-tag-option">
              <input type="checkbox" name="entry-tags" value="${tag.id}">
              <span class="vault-tag-chip" data-tag-color="${tag.color || '#6b7280'}">
                ${escapeHtml(tag.name)}
              </span>
            </label>
          `).join('');
          // Auto-select the newly created tag
          const newCheckbox = pickerList.querySelector(`input[value="${newTag.id}"]`);
          if (newCheckbox) newCheckbox.checked = true;
        }
      }
    });

    // Color picker in add entry form
    document.querySelectorAll('#tag-color-picker .vault-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tag-color-picker .vault-color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  }

  #updateEntryTypeFields() {
    const type = document.querySelector('input[name="entry-type"]:checked')?.value || 'login';
    const container = document.getElementById('entry-type-fields');
    if (!container) return;

    const fields = {
      login: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-username">Username / Email</label>
          <div class="input-with-action">
            <input type="text" class="vault-input" id="entry-username" placeholder="${t('vault.form.userPlaceholder')}" autocomplete="username">
            <button type="button" class="vault-btn-icon" id="btn-create-alias" title="Generate Email Alias (Hide-My-Email)">
              <span class="icon">🕵️</span>
            </button>
          </div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-password">${t('vault.labels.password')}</label>
          <div class="vault-input-group">
            <input type="password" class="vault-input" id="entry-password" placeholder="••••••••" autocomplete="new-password">
            <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="entry-password" aria-label="Show">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="vault-input-btn" id="generate-password" data-tooltip="Generate" aria-label="Generate password">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
            </button>
          </div>
          <div class="vault-password-strength" id="entry-password-strength"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-url">${t('vault.labels.url')}</label>
          <input type="url" class="vault-input" id="entry-url" placeholder="${t('vault.placeholders.urlExample')}" aria-describedby="entry-url-message">
          <div class="vault-field-message" id="entry-url-message" role="alert" aria-live="polite"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-totp">TOTP Key (2FA)</label>
          <input type="text" class="vault-input mono" id="entry-totp" placeholder="${t('vault.placeholders.totpSecretExample')}" autocomplete="off" spellcheck="false">
          <span class="vault-field-hint">Optionnel - Secret Base32 ou URI otpauth://</span>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-expires">Password expiration</label>
          <div class="vault-expiry-picker">
            <select class="vault-input vault-select" id="entry-expires-preset">
              <option value="">Jamais</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">6 months</option>
              <option value="365">1 an</option>
              <option value="custom">Custom date...</option>
            </select>
            <input type="date" class="vault-input" id="entry-expires" hidden>
          </div>
          <span class="vault-field-hint">Visual reminder to renew the password</span>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-notes">${t('vault.labels.notes')}</label>
          <textarea class="vault-input vault-textarea" id="entry-notes" rows="2" placeholder="${t('vault.form.optionalNotes')}"></textarea>
        </div>
      `,
      note: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-content">Content <span class="required">*</span></label>
          <textarea class="vault-input vault-textarea" id="entry-content" rows="8" placeholder="${t('vault.form.secureNote')}" required></textarea>
        </div>
      `,
      card: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-holder">Holder</label>
          <input type="text" class="vault-input" id="entry-holder" placeholder="${t('vault.placeholders.holderExample')}" autocomplete="cc-name">
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-cardnumber">Card number</label>
          <input type="text" class="vault-input" id="entry-cardnumber" placeholder="${t('vault.placeholders.cardNumberExample')}" autocomplete="cc-number">
        </div>
        <div class="vault-form-row">
          <div class="vault-form-group">
            <label class="vault-label" for="entry-expiry">Expiration</label>
            <input type="text" class="vault-input" id="entry-expiry" placeholder="${t('vault.placeholders.expiryFormat')}" autocomplete="cc-exp">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="entry-cvv">CVV</label>
            <input type="password" class="vault-input" id="entry-cvv" placeholder="${t('vault.placeholders.cvvExample')}" maxlength="4" autocomplete="cc-csc">
          </div>
        </div>
      `,
      identity: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-fullname">Full name</label>
          <input type="text" class="vault-input" id="entry-fullname" placeholder="${t('vault.placeholders.fullNameExample')}" autocomplete="name">
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-email">Email</label>
          <input type="email" class="vault-input" id="entry-email" placeholder="${t('vault.placeholders.emailExample')}" autocomplete="email" aria-describedby="entry-email-message">
          <div class="vault-field-message" id="entry-email-message" role="alert" aria-live="polite"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-phone">Phone</label>
          <input type="tel" class="vault-input" id="entry-phone" placeholder="${t('vault.placeholders.phoneExample')}" autocomplete="tel">
        </div>
      `
    };

    container.innerHTML = (fields[type] || '') + renderCustomFieldsSection({ t });

    // Attach events for custom fields
    this.#attachCustomFieldsEvents();

    // Attach events for login type
    if (type === 'login') {
      // Alias Generator
      document.getElementById('btn-create-alias')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const input = document.getElementById('entry-username');

        if (!this.#aliasService.isConfigured) {
          this.#aliasSettingsModal.show(() => {
            if (this.#aliasService.isConfigured) btn.click();
          });
          return;
        }

        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="vault-spinner-small vault-spinner-inline"></span>';
        btn.disabled = true;

        try {
          const alias = await this.#aliasService.generateAlias(document.getElementById('entry-title').value || 'GenPwd Entry');
          input.value = alias;
          input.dispatchEvent(new Event('input', { bubbles: true }));

          btn.innerHTML = '<span class="icon">✅</span>';
          setTimeout(() => btn.innerHTML = originalHtml, 2000);
          this.#showToast(t('vault.messages.aliasGenerated'), 'success');
        } catch (err) {
          safeLog('[VaultUI] Alias generation error:', err);
          btn.innerHTML = '<span class="icon">❌</span>';
          setTimeout(() => btn.innerHTML = originalHtml, 2000);
          this.#showToast(err.message || t('vault.messages.aliasError'), 'error');
        } finally {
          btn.disabled = false;
        }
      });

      // Toggle password visibility
      container.querySelectorAll('.toggle-pwd-visibility').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.target);
          if (input) input.type = input.type === 'password' ? 'text' : 'password';
        });
      });

      // Generate password with popover
      document.getElementById('generate-password')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showPwdGenerator({
          targetInputId: 'entry-password',
          onPasswordGenerated: (pwd, input) => {
            input.value = pwd;
            input.type = 'text';
            this.#updateAddPasswordStrength(pwd);
          },
          onCopy: () => this.#showToast(t('vault.common.copied'), 'success'),
          t
        });
      });

      // Password strength
      document.getElementById('entry-password')?.addEventListener('input', (e) => {
        this.#updateAddPasswordStrength(e.target.value);
      });

      // URL real-time validation
      const urlInput = document.getElementById('entry-url');
      const urlMessage = document.getElementById('entry-url-message');
      urlInput?.addEventListener('input', () => {
        this.#validateField(urlInput, urlMessage, {
          url: true,
          urlMessage: t('vault.form.invalidUrl'),
          showSuccess: true,
          successMessage: t('vault.form.validUrl')
        });
      });
      urlInput?.addEventListener('blur', () => {
        this.#validateField(urlInput, urlMessage, {
          url: true,
          urlMessage: t('vault.form.invalidUrl')
        });
      });

      // Expiry preset dropdown
      const expiresPreset = document.getElementById('entry-expires-preset');
      const expiresInput = document.getElementById('entry-expires');
      expiresPreset?.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'custom') {
          expiresInput.hidden = false;
          expiresInput.focus();
        } else if (value) {
          expiresInput.hidden = true;
          // Calculate date from preset (days)
          const date = new Date();
          date.setDate(date.getDate() + parseInt(value, 10));
          expiresInput.value = date.toISOString().split('T')[0];
        } else {
          expiresInput.hidden = true;
          expiresInput.value = '';
        }
      });
    }

    // Email real-time validation for identity
    if (type === 'identity') {
      const emailInput = document.getElementById('entry-email');
      const emailMessage = document.getElementById('entry-email-message');
      emailInput?.addEventListener('input', () => {
        this.#validateField(emailInput, emailMessage, {
          email: true,
          emailMessage: t('vault.form.invalidEmail'),
          showSuccess: true,
          successMessage: t('vault.form.validEmail')
        });
      });
      emailInput?.addEventListener('blur', () => {
        this.#validateField(emailInput, emailMessage, {
          email: true,
          emailMessage: t('vault.form.invalidEmail')
        });
      });
    }
  }

  // ==================== CUSTOM FIELDS SECTION ====================

  /**
   * Attach event listeners for custom fields section
   */
  #attachCustomFieldsEvents() {
    const addBtn = document.getElementById('btn-add-custom-field');
    const container = document.getElementById('custom-fields-container');

    if (!addBtn || !container) return;

    // Add new field button
    addBtn.addEventListener('click', () => {
      const fieldCount = container.querySelectorAll('.vault-custom-field').length;
      const newField = document.createElement('div');
      newField.innerHTML = createCustomFieldElement(fieldCount, t);
      const fieldEl = newField.firstElementChild;
      container.appendChild(fieldEl);

      // Attach events to the new field
      this.#attachSingleFieldEvents(fieldEl);

      // Focus the label input
      fieldEl.querySelector('.vault-custom-field-label')?.focus();
    });

    // Attach events to existing fields
    container.querySelectorAll('.vault-custom-field').forEach(fieldEl => {
      this.#attachSingleFieldEvents(fieldEl);
    });
  }

  /**
   * Attach events to a single custom field element
   * @param {HTMLElement} fieldEl
   */
  #attachSingleFieldEvents(fieldEl) {
    // Remove field button
    fieldEl.querySelector('.vault-remove-field-btn')?.addEventListener('click', () => {
      fieldEl.remove();
    });

    // Kind selector - update input type when kind changes
    const kindSelect = fieldEl.querySelector('.vault-custom-field-kind');
    const valueInput = fieldEl.querySelector('.vault-custom-field-value');
    const securedCheckbox = fieldEl.querySelector('.vault-custom-field-secured input');

    const updateInputType = () => {
      const kind = kindSelect?.value;
      const isSecured = securedCheckbox?.checked;
      const shouldMask = kind === 'password' || kind === 'hidden' || isSecured;

      if (valueInput) {
        valueInput.type = shouldMask ? 'password' : 'text';

        // Add/remove toggle button
        const inputGroup = valueInput.closest('.vault-input-group');
        let toggleBtn = inputGroup?.querySelector('.toggle-pwd-visibility');

        if (shouldMask && !toggleBtn) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'vault-input-btn toggle-pwd-visibility';
          btn.setAttribute('aria-label', t('vault.aria.toggleVisibility'));
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          `;
          btn.addEventListener('click', () => {
            valueInput.type = valueInput.type === 'password' ? 'text' : 'password';
          });
          inputGroup.appendChild(btn);
        } else if (!shouldMask && toggleBtn) {
          toggleBtn.remove();
        }
      }
    };

    kindSelect?.addEventListener('change', updateInputType);
    securedCheckbox?.addEventListener('change', updateInputType);

    // Toggle visibility for password fields
    fieldEl.querySelector('.toggle-pwd-visibility')?.addEventListener('click', () => {
      if (valueInput) {
        valueInput.type = valueInput.type === 'password' ? 'text' : 'password';
      }
    });
  }

  /**
   * Collect custom fields from the form
   * @returns {Array<{label: string, value: string, kind: string, isSecured: boolean}>}
   */
  #collectCustomFields() {
    const container = document.getElementById('custom-fields-container');
    if (!container) return [];

    const fields = [];
    container.querySelectorAll('.vault-custom-field').forEach(fieldEl => {
      const label = fieldEl.querySelector('.vault-custom-field-label')?.value?.trim();
      const value = fieldEl.querySelector('.vault-custom-field-value')?.value || '';
      const kind = fieldEl.querySelector('.vault-custom-field-kind')?.value || 'text';
      const isSecured = fieldEl.querySelector('.vault-custom-field-secured input')?.checked || false;
      const existingId = fieldEl.dataset.fieldId;

      // Only include fields that have a label
      if (label) {
        fields.push({
          id: existingId || undefined, // Keep existing ID or let server generate new one
          label,
          value,
          kind,
          isSecured
        });
      }
    });

    return fields;
  }

  #updateAddPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    const el = document.getElementById('entry-password-strength');
    if (el) {
      el.innerHTML = `
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}"></div>
        </div>
        <span class="vault-strength-text ${strength.level}">${strength.label}</span>
      `;
      // CSP-compliant: set width via CSS custom property
      const fill = el.querySelector('.vault-strength-fill');
      if (fill) fill.style.setProperty('--strength-width', `${strength.percent}%`);
    }
  }

  #collectEntryFormData(type) {
    const data = {};
    const get = (id) => document.getElementById(id)?.value || '';

    switch (type) {
      case 'login':
        data.username = get('entry-username');
        data.password = get('entry-password');
        data.url = get('entry-url');
        // Parse TOTP - support both Base32 and otpauth:// URI
        const totpInput = get('entry-totp').trim();
        if (totpInput) {
          if (totpInput.startsWith('otpauth://')) {
            try {
              data.totp = this.#parseOTPAuthURI(totpInput).secret;
            } catch {
              data.totp = totpInput; // Keep as-is if parsing fails
            }
          } else {
            data.totp = totpInput.toUpperCase().replace(/\s/g, '');
          }
        }
        // Password expiration date
        const expiresValue = get('entry-expires');
        if (expiresValue) {
          data.expiresAt = expiresValue;
        }
        break;
      case 'note':
        data.content = get('entry-content');
        break;
      case 'card':
        data.holder = get('entry-holder');
        data.number = get('entry-cardnumber');
        data.expiry = get('entry-expiry');
        data.cvv = get('entry-cvv');
        break;
      case 'identity':
        data.fullName = get('entry-fullname');
        data.email = get('entry-email');
        data.phone = get('entry-phone');
        break;
    }

    const notes = document.getElementById('entry-notes')?.value;
    if (notes) data.notes = notes;

    // Collect custom fields
    const customFields = this.#collectCustomFields();
    if (customFields.length > 0) {
      data.fields = customFields;
    }

    return data;
  }

  // ==================== MODAL HELPERS ====================

  #openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    this.#lastFocusedElement = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Focus trap setup
    this.#setupFocusTrap(modal);
  }

  #closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Remove focus trap handler
    this.#removeFocusTrap(modal);

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');

    // Restore focus
    if (this.#lastFocusedElement && this.#lastFocusedElement.focus) {
      this.#lastFocusedElement.focus();
      this.#lastFocusedElement = null;
    }
  }

  #setupFocusTrap(modal) {
    // Remove any existing handler for this modal
    this.#removeFocusTrap(modal);

    const getFocusableElements = () => {
      return modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );
    };

    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: go to last element if on first
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: go to first element if on last
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.#closeModal(modal.id);
      }
    };

    modal.addEventListener('keydown', trapFocus);
    this.#focusTrapHandlers.set(modal.id, trapFocus);

    // Auto-focus first focusable element or modal content
    requestAnimationFrame(() => {
      const focusableElements = getFocusableElements();
      // Prefer input fields, then buttons
      const inputField = modal.querySelector('input:not([type="hidden"]):not([disabled])');
      const firstFocusable = inputField || focusableElements[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // Fallback: make modal content focusable
        const content = modal.querySelector('.modal-content');
        if (content) {
          content.setAttribute('tabindex', '-1');
          content.focus();
        }
      }
    });
  }

  #removeFocusTrap(modal) {
    const handler = this.#focusTrapHandlers.get(modal.id);
    if (handler) {
      modal.removeEventListener('keydown', handler);
      this.#focusTrapHandlers.delete(modal.id);
    }
  }

  async #showConfirmDialog(title, message, options = {}) {
    const {
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmClass = 'vault-btn-danger'
    } = options;

    return new Promise((resolve) => {
      // Create modal dynamically
      const modalId = 'confirm-dialog-modal';
      let modal = document.getElementById(modalId);

      // Remove existing if present
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'vault-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="vault-modal-backdrop"></div>
        <div class="vault-modal-content vault-modal-sm" role="alertdialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="vault-modal-header">
            <h3 id="confirm-dialog-title" class="vault-modal-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" class="modal-icon-warning">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              ${escapeHtml(title)}
            </h3>
          </div>
          <div class="vault-modal-body">
            <p id="confirm-dialog-message" class="confirm-dialog-message">${escapeHtml(message)}</p>
          </div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" id="confirm-dialog-cancel" aria-label="Cancel">${escapeHtml(cancelText)}</button>
            <button type="button" class="vault-btn ${confirmClass}" id="confirm-dialog-confirm" aria-label="Confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Setup event handlers
      const cleanup = () => {
        this.#closeModal(modalId);
        setTimeout(() => modal.remove(), 300);
      };

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      modal.querySelector('#confirm-dialog-confirm').addEventListener('click', handleConfirm);
      modal.querySelector('#confirm-dialog-cancel').addEventListener('click', handleCancel);
      modal.querySelector('.vault-modal-backdrop').addEventListener('click', handleCancel);

      // Open modal with focus trap
      this.#openModal(modalId);
    });
  }

  // ==================== HELPERS ====================

  #hasActiveFilters() {
    return !!(this.#searchFilters.type || this.#searchFilters.strength || this.#searchFilters.age);
  }

  #getPasswordAgeDays(entry) {
    if (!entry.modifiedAt) return 0;
    const modified = new Date(entry.modifiedAt);
    const now = new Date();
    return Math.floor((now - modified) / (1000 * 60 * 60 * 24));
  }

  #getFilteredEntries() {
    let entries = [...this.#entries];

    // Audit filter (from security dashboard)
    if (this.#auditFilterIds && this.#auditFilterIds.size > 0) {
      entries = entries.filter(e => this.#auditFilterIds.has(e.id));
    }

    // Search filter
    if (this.#searchQuery) {
      const q = this.#searchQuery.toLowerCase();
      entries = entries.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.data?.username?.toLowerCase().includes(q) ||
        e.data?.url?.toLowerCase().includes(q) ||
        e.data?.email?.toLowerCase().includes(q)
      );
    }

    // Advanced filters
    if (this.#searchFilters.type) {
      entries = entries.filter(e => e.type === this.#searchFilters.type);
    }

    if (this.#searchFilters.strength) {
      entries = entries.filter(e => {
        if (e.type !== 'login' || !e.data?.password) return false;
        return getPasswordStrength(e.data.password) === this.#searchFilters.strength;
      });
    }

    if (this.#searchFilters.age) {
      entries = entries.filter(e => {
        if (e.type !== 'login') return false;

        // Expiration-based filters
        if (this.#searchFilters.age === 'expiring' || this.#searchFilters.age === 'expired') {
          const expiryStatus = this.#getExpiryStatus(e);
          if (this.#searchFilters.age === 'expired') {
            return expiryStatus.status === 'expired';
          } else if (this.#searchFilters.age === 'expiring') {
            return ['today', 'soon', 'warning'].includes(expiryStatus.status);
          }
        }

        // Age-based filters (password age)
        const days = this.#getPasswordAgeDays(e);
        switch (this.#searchFilters.age) {
          case 'recent': return days <= 30;
          case 'old': return days > 180;
          default: return true;
        }
      });
    }

    // Category filter
    if (this.#selectedCategory === 'favorites') {
      entries = entries.filter(e => e.favorite);
    } else if (this.#selectedCategory === 'recent') {
      // Sort by modified and take top 10, then apply sort
      entries = entries.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 10);
    } else if (this.#selectedCategory !== 'all') {
      entries = entries.filter(e => e.type === this.#selectedCategory);
    }

    // Folder filter
    if (this.#selectedFolder) {
      entries = entries.filter(e => e.folderId === this.#selectedFolder);
    }

    // Tag filter
    if (this.#selectedTag) {
      entries = entries.filter(e => e.tags?.includes(this.#selectedTag));
    }

    // Sort (skip for 'recent' as it's already sorted)
    if (this.#selectedCategory !== 'recent') {
      entries = this.#sortEntries(entries);
    }

    return entries;
  }

  #sortEntries(entries) {
    // First sort by the selected method
    let sorted;
    switch (this.#sortBy) {
      case 'title-asc':
        sorted = entries.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'title-desc':
        sorted = entries.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      case 'modified-desc':
        sorted = entries.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        break;
      case 'modified-asc':
        sorted = entries.sort((a, b) => new Date(a.modifiedAt) - new Date(b.modifiedAt));
        break;
      case 'type':
        sorted = entries.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
        break;
      default:
        sorted = entries;
    }

    // Then move pinned entries to the top while maintaining their relative order
    const pinned = sorted.filter(e => e.pinned);
    const unpinned = sorted.filter(e => !e.pinned);
    return [...pinned, ...unpinned];
  }

  #getCategoryCount(categoryId) {
    if (categoryId === 'all') return this.#entries.length;
    if (categoryId === 'favorites') return this.#entries.filter(e => e.favorite).length;
    if (categoryId === 'recent') return Math.min(10, this.#entries.length);
    return this.#entries.filter(e => e.type === categoryId).length;
  }

  #calculatePasswordStrength(password) {
    if (!password) return { level: 'none', label: '', percent: 0 };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const levels = [
      { level: 'weak', label: t('vault.detail.weak'), percent: 25 },
      { level: 'weak', label: t('vault.detail.weak'), percent: 25 },
      { level: 'fair', label: t('vault.detail.fair'), percent: 50 },
      { level: 'fair', label: t('vault.detail.fair'), percent: 50 },
      { level: 'good', label: t('vault.detail.good'), percent: 75 },
      { level: 'good', label: t('vault.detail.good'), percent: 75 },
      { level: 'strong', label: t('vault.detail.good'), percent: 100 },
      { level: 'strong', label: t('vault.detail.excellent'), percent: 100 }
    ];

    return levels[score] || levels[0];
  }

  // Password generator moved to ./vault/components/password-generator.js

  #isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  #isValidEmail(string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string);
  }

  /**
   * Real-time field validation
   * @param {HTMLInputElement} input - The input element
   * @param {HTMLElement} messageEl - The message display element
   * @param {Object} rules - Validation rules
   */
  #validateField(input, messageEl, rules = {}) {
    if (!input || !messageEl) return true;

    const value = input.value.trim();
    let isValid = true;
    let message = '';
    let messageType = 'error';

    // Required check
    if (rules.required && !value) {
      isValid = false;
      message = rules.requiredMessage || t('vault.validation.fieldRequired');
    }
    // Min length check
    else if (rules.minLength && value.length < rules.minLength) {
      isValid = false;
      message = rules.minLengthMessage || t('vault.validation.minLength', { count: rules.minLength });
    }
    // Max length check
    else if (rules.maxLength && value.length > rules.maxLength) {
      isValid = false;
      message = rules.maxLengthMessage || t('vault.validation.maxLength', { count: rules.maxLength });
    }
    // Pattern check
    else if (rules.pattern && !rules.pattern.test(value)) {
      isValid = false;
      message = rules.patternMessage || t('vault.validation.invalidFormat');
    }
    // URL check
    else if (rules.url && value && !this.#isValidUrl(value)) {
      isValid = false;
      message = rules.urlMessage || t('vault.validation.invalidUrl');
    }
    // Email check
    else if (rules.email && value && !this.#isValidEmail(value)) {
      isValid = false;
      message = rules.emailMessage || t('vault.validation.invalidEmail');
    }
    // Valid
    else if (value && rules.showSuccess) {
      message = rules.successMessage || '✓';
      messageType = 'success';
    }

    // Update input classes and ARIA attributes
    input.classList.remove('is-valid', 'is-invalid');
    if (value) {
      input.classList.add(isValid ? 'is-valid' : 'is-invalid');
      input.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }

    // Ensure message element has an ID for aria-describedby
    if (!messageEl.id && input.id) {
      messageEl.id = `${input.id}-message`;
    }
    if (messageEl.id) {
      input.setAttribute('aria-describedby', messageEl.id);
    }

    // Update message
    if (message) {
      const icon = messageType === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
      messageEl.innerHTML = `${icon}<span>${message}</span>`;
      messageEl.className = `vault-field-message visible ${messageType}`;
      messageEl.setAttribute('role', 'alert');
      messageEl.setAttribute('aria-live', messageType === 'error' ? 'assertive' : 'polite');
    } else {
      messageEl.className = 'vault-field-message';
      messageEl.innerHTML = '';
      messageEl.removeAttribute('role');
      messageEl.removeAttribute('aria-live');
    }

    return isValid;
  }

  /**
   * Validate password confirmation match
   * @param {HTMLInputElement} confirmInput - The confirm input
   * @param {HTMLInputElement} passwordInput - The password input
   * @param {HTMLElement} messageEl - The message display element
   * @returns {boolean}
   */
  #validatePasswordMatch(confirmInput, passwordInput, messageEl) {
    if (!confirmInput || !passwordInput || !messageEl) return true;

    const password = passwordInput.value;
    const confirm = confirmInput.value.trim();
    let isValid = true;
    let message = '';
    let messageType = 'error';

    if (!confirm) {
      // Empty - no message but invalid
      isValid = false;
    } else if (confirm !== password) {
      isValid = false;
      message = t('vault.validation.passwordsNoMatch');
    } else {
      message = t('vault.validation.passwordsMatch');
      messageType = 'success';
    }

    // Update input classes and ARIA attributes
    confirmInput.classList.remove('is-valid', 'is-invalid');
    if (confirm) {
      confirmInput.classList.add(isValid ? 'is-valid' : 'is-invalid');
      confirmInput.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    } else {
      confirmInput.removeAttribute('aria-invalid');
    }

    // Ensure message element has an ID for aria-describedby
    if (!messageEl.id && confirmInput.id) {
      messageEl.id = `${confirmInput.id}-message`;
    }
    if (messageEl.id) {
      confirmInput.setAttribute('aria-describedby', messageEl.id);
    }

    // Update message
    if (message) {
      const icon = messageType === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
      messageEl.innerHTML = `${icon}<span>${message}</span>`;
      messageEl.className = `vault-field-message visible ${messageType}`;
      messageEl.setAttribute('role', 'alert');
      messageEl.setAttribute('aria-live', messageType === 'error' ? 'assertive' : 'polite');
    } else {
      messageEl.className = 'vault-field-message';
      messageEl.innerHTML = '';
      messageEl.removeAttribute('role');
      messageEl.removeAttribute('aria-live');
    }

    return isValid;
  }

  async #lock() {
    try {
      await window.vault.lock();
      this.#showToast(t('vault.messages.vaultLocked'), 'success');
    } catch (error) {
      this.#showToast(t('vault.common.error'), 'error');
    }
  }

  #startAutoLockTimer() {
    // Load saved timeout preference
    try {
      const savedTimeout = localStorage.getItem('genpwd-vault-autolock-timeout');
      if (savedTimeout) {
        this.#autoLockTimeout = parseInt(savedTimeout, 10);
      }
    } catch {
      // Use default timeout
    }
    this.#autoLockSeconds = this.#autoLockTimeout;

    // Initialize the inactivity manager for global event tracking
    const inactivityManager = getInactivityManager();
    inactivityManager.setTimeout(this.#autoLockTimeout);
    inactivityManager.setWarningCallback((_secondsRemaining) => {
      this.#showAutoLockWarning();
    });
    inactivityManager.start(() => {
      // Lock callback - triggered after inactivity
      this.#lock();
    });

    // Keep the local countdown timer for UI display
    this.#autoLockTimer = setInterval(() => {
      // Get remaining time from the inactivity manager
      const remaining = inactivityManager.getTimeRemaining();
      if (remaining !== Infinity) {
        this.#autoLockSeconds = remaining;
      } else {
        this.#autoLockSeconds--;
      }
      this.#updateLockCountdown();
    }, 1000);
  }

  #stopAutoLockTimer() {
    // Stop the inactivity manager
    getInactivityManager().stop();

    if (this.#autoLockTimer) {
      clearInterval(this.#autoLockTimer);
      this.#autoLockTimer = null;
    }
  }

  #updateLockCountdown() {
    const el = document.getElementById('lock-countdown');
    const timerContainer = document.getElementById('lock-timer');

    if (el) {
      const mins = Math.floor(this.#autoLockSeconds / 60);
      const secs = this.#autoLockSeconds % 60;
      el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Add warning classes
    if (timerContainer) {
      timerContainer.classList.remove('warning', 'critical');
      if (this.#autoLockSeconds <= 30) {
        timerContainer.classList.add('critical');
        // Show warning toast at 30 seconds
        if (this.#autoLockSeconds === 30) {
          this.#showAutoLockWarning();
        }
      } else if (this.#autoLockSeconds <= 60) {
        timerContainer.classList.add('warning');
      }
    }
  }

  #resetAutoLock() {
    this.#autoLockSeconds = this.#autoLockTimeout;
    this.#autoLockWarningShown = false;
    // Reset inactivity manager (this also calls window.vault.resetActivity)
    getInactivityManager().recordActivity();
  }

  #formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  #initTheme() {
    try {
      const savedTheme = localStorage.getItem('genpwd-vault-theme') || 'dark';
      this.#theme = savedTheme;
    } catch {
      this.#theme = 'dark';
    }
    this.#applyTheme();
  }

  #toggleTheme() {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('genpwd-vault-theme', this.#theme);
    } catch {
      // Storage not available
    }
    this.#applyTheme();
    this.#showToast(t('vault.messages.themeEnabled', { theme: this.#theme === 'dark' ? 'Dark' : 'Light' }), 'success');
  }

  /**
   * Toggle sidebar collapsed state
   */
  #toggleSidebar() {
    const sidebar = document.querySelector('.vault-sidebar');
    if (sidebar) {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      try {
        localStorage.setItem('genpwd-vault-sidebar-collapsed', isCollapsed);
      } catch {
        // Storage not available
      }
      // Update button aria-expanded
      const btn = document.getElementById('sidebar-collapse-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', String(!isCollapsed));
      }
    }
  }

  /**
   * Restore sidebar collapsed state from localStorage
   */
  #restoreSidebarState() {
    let isCollapsed = false;
    try {
      isCollapsed = localStorage.getItem('genpwd-vault-sidebar-collapsed') === 'true';
    } catch {
      // Storage not available
    }
    if (isCollapsed) {
      const sidebar = document.querySelector('.vault-sidebar');
      if (sidebar) {
        sidebar.classList.add('collapsed');
      }
      // Sync aria-expanded with restored state
      const btn = document.getElementById('sidebar-collapse-btn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
      }
    }
  }

  #applyTheme() {
    const vaultApp = document.querySelector('.vault-app');
    if (vaultApp) {
      vaultApp.setAttribute('data-vault-theme', this.#theme);
    }
    // Also update toggle button appearance and accessibility state
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.classList.toggle('light-mode', this.#theme === 'light');
      toggleBtn.setAttribute('aria-pressed', String(this.#theme === 'light'));
    }
  }

  /**
   * Get password expiration status
   * @param {Object} entry
   * @returns {{status: string, badge: string, daysLeft: number|null, label: string}}
   */
  #getExpiryStatus(entry) {
    const noExpiry = { status: 'none', badge: '', daysLeft: null, label: '' };

    if (entry.type !== 'login' || !entry.data?.expiresAt) {
      return noExpiry;
    }

    const expiresAt = new Date(entry.data.expiresAt);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    expiresAt.setHours(0, 0, 0, 0);

    const diffMs = expiresAt - now;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      // Expired
      const daysAgo = Math.abs(daysLeft);
      return {
        status: 'expired',
        badge: `<span class="vault-expiry-badge expired" title="Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago" role="img" aria-label="Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago"><span aria-hidden="true">⚠️</span></span>`,
        daysLeft,
        label: `Expired ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`
      };
    } else if (daysLeft === 0) {
      // Expires today
      return {
        status: 'today',
        badge: '<span class="vault-expiry-badge today" title="Expires today" role="img" aria-label="Expires today"><span aria-hidden="true">⏰</span></span>',
        daysLeft: 0,
        label: "Expires today"
      };
    } else if (daysLeft <= 7) {
      // Expires within a week
      return {
        status: 'soon',
        badge: `<span class="vault-expiry-badge soon" title="Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}" role="img" aria-label="Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}"><span aria-hidden="true">🕐</span></span>`,
        daysLeft,
        label: `Expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`
      };
    } else if (daysLeft <= 30) {
      // Expires within a month
      return {
        status: 'warning',
        badge: `<span class="vault-expiry-badge warning" title="Expires in ${daysLeft} days" role="img" aria-label="Expires in ${daysLeft} days"><span aria-hidden="true">📅</span></span>`,
        daysLeft,
        label: `Expires in ${daysLeft} days`
      };
    }

    // Valid, not expiring soon
    return {
      status: 'valid',
      badge: '',
      daysLeft,
      label: `Expires on ${expiresAt.toLocaleDateString('en-US')}`
    };
  }

  #getFolderColor(folderId) {
    try {
      const colors = JSON.parse(localStorage.getItem('genpwd-vault-folder-colors') || '{}');
      return colors[folderId] || null;
    } catch {
      return null;
    }
  }

  #setFolderColor(folderId, color) {
    try {
      const colors = JSON.parse(localStorage.getItem('genpwd-vault-folder-colors') || '{}');
      if (color) {
        colors[folderId] = color;
      } else {
        delete colors[folderId];
      }
      localStorage.setItem('genpwd-vault-folder-colors', JSON.stringify(colors));
    } catch {
      // Silently fail - folder colors are not critical
    }
  }

  #showFolderColorPicker(folderId, x, y) {
    document.querySelector('.vault-color-picker')?.remove();

    const folderColors = [
      { color: null, label: 'Default' },
      { color: '#ef4444', label: 'Red' },
      { color: '#f97316', label: 'Orange' },
      { color: '#eab308', label: 'Yellow' },
      { color: '#22c55e', label: 'Green' },
      { color: '#06b6d4', label: 'Cyan' },
      { color: '#3b82f6', label: 'Blue' },
      { color: '#8b5cf6', label: 'Purple' },
      { color: '#ec4899', label: 'Pink' }
    ];

    const currentColor = this.#getFolderColor(folderId);

    const picker = document.createElement('div');
    picker.className = 'vault-color-picker';
    picker.innerHTML = `
      <div class="vault-color-picker-header">Folder color</div>
      <div class="vault-color-picker-grid">
        ${folderColors.map(c => `
          <button class="vault-color-option ${c.color === currentColor || (!c.color && !currentColor) ? 'active' : ''}"
                  data-color="${c.color || ''}"
                  data-option-color="${c.color || ''}"
                  title="${c.label}">
            ${c.color === currentColor || (!c.color && !currentColor) ? '✓' : ''}
          </button>
        `).join('')}
      </div>
    `;

    // Apply CSP-compliant styles via CSSOM
    picker.querySelectorAll('[data-option-color]').forEach(btn => {
      const color = btn.dataset.optionColor;
      btn.style.setProperty('--option-color', color || 'var(--vault-text-muted)');
    });

    document.body.appendChild(picker);

    // Position
    const rect = picker.getBoundingClientRect();
    let posX = x;
    let posY = y;
    if (x + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
    if (y + rect.height > window.innerHeight) posY = window.innerHeight - rect.height - 10;
    picker.style.left = `${posX}px`;
    picker.style.top = `${posY}px`;

    // Event handlers
    picker.querySelectorAll('.vault-color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color || null;
        this.#setFolderColor(folderId, color);
        picker.remove();
        this.#render();
        this.#showToast(t('vault.messages.colorUpdated'), 'success');
      });
    });

    // Close on click outside
    setTimeout(() => {
      const handler = (e) => {
        if (!picker.contains(e.target)) {
          picker.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 0);
  }

  // ==================== WINDOWS HELLO ====================

  /**
   * Initialize Windows Hello settings button
   */
  async #initHelloSettings() {
    const helloBtn = document.getElementById('hello-settings');
    if (!helloBtn) return;

    // Check if Windows Hello API is available
    if (!window.vault?.hello) {
      helloBtn.hidden = true;
      return;
    }

    try {
      const isAvailable = await window.vault.hello.isAvailable();
      if (!isAvailable) {
        helloBtn.hidden = true;
        return;
      }

      // Show button and add event listener
      helloBtn.hidden = false;
      helloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#showHelloSettings();
      });

      // Update button state (enabled/disabled indicator)
      await this.#updateHelloButtonState();
    } catch (error) {
      safeLog('[VaultUI] Hello init error:', error);
      helloBtn.hidden = true;
    }
  }

  /**
   * Update Windows Hello button state
   */
  async #updateHelloButtonState() {
    const helloBtn = document.getElementById('hello-settings');
    if (!helloBtn || !window.vault?.hello) return;

    try {
      const state = await window.vault.getState();
      if (!state?.vaultId) return;

      const isEnabled = await window.vault.hello.isEnabled(state.vaultId);
      helloBtn.classList.toggle('hello-enabled', isEnabled);
      helloBtn.title = isEnabled ? 'Windows Hello (enabled)' : 'Windows Hello (disabled)';
    } catch (error) {
      safeLog('[VaultUI] Hello state check error:', error);
    }
  }

  /**
   * Show Windows Hello settings popover
   */
  async #showHelloSettings() {
    // Remove existing popover
    document.querySelector('.vault-hello-popover')?.remove();

    const helloBtn = document.getElementById('hello-settings');
    if (!helloBtn) return;

    try {
      const state = await window.vault.getState();
      if (!state?.vaultId) return;

      const isEnabled = await window.vault.hello.isEnabled(state.vaultId);

      const popover = document.createElement('div');
      popover.className = 'vault-hello-popover';
      popover.innerHTML = `
        <div class="vault-hello-header">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
            <circle cx="8.5" cy="10" r="1.5"/>
            <circle cx="15.5" cy="10" r="1.5"/>
            <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
          </svg>
          <span>Windows Hello</span>
        </div>
        <div class="vault-hello-body">
          <p class="vault-hello-description">
            ${isEnabled
          ? 'Windows Hello is enabled for this vault. You can unlock with your fingerprint or face.'
          : 'Enable Windows Hello to unlock this vault with your fingerprint or face.'
        }
          </p>
          ${isEnabled ? `
            <button class="vault-btn vault-btn-sm vault-btn-danger" id="hello-disable">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Disable
            </button>
          ` : `
            <button class="vault-btn vault-btn-sm vault-btn-primary" id="hello-enable">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Activer
            </button>
          `}
        </div>
      `;

      // Attach to body for proper z-index stacking
      document.body.appendChild(popover);

      // Position popover with forced pointer-events
      const btnRect = helloBtn.getBoundingClientRect();
      Object.assign(popover.style, {
        position: 'fixed',
        top: `${btnRect.bottom + 8}px`,
        right: `${window.innerWidth - btnRect.right}px`,
        zIndex: '99999',
        pointerEvents: 'auto'
      });

      // Force pointer-events on the button too
      const actionBtn = popover.querySelector('button');
      if (actionBtn) {
        actionBtn.style.pointerEvents = 'auto';
        actionBtn.style.cursor = 'pointer';
      }

      // Event delegation on popover - capture phase
      popover.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'hello-enable') {
          e.stopPropagation();
          popover.remove();
          this.#enableWindowsHello(state.vaultId);
        } else if (target.id === 'hello-disable') {
          e.stopPropagation();
          popover.remove();
          this.#disableWindowsHello(state.vaultId);
        }
      }, true); // Use capture phase

      // Close on click outside
      const closeHandler = (e) => {
        if (!popover.contains(e.target) && !e.target.closest('#hello-settings')) {
          popover.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      // Delay to avoid immediate close
      setTimeout(() => document.addEventListener('click', closeHandler), 200);
    } catch (error) {
      safeLog('[VaultUI] Hello settings error:', error);
      this.#showToast(t('vault.windowsHello.error'), 'error');
    }
  }

  /**
   * Enable Windows Hello for current vault
   * @param {string} vaultId - Vault ID
   */
  async #enableWindowsHello(vaultId) {
    // Need master password to enable Windows Hello
    const password = await this.#promptPassword(t('vault.windowsHello.enterPassword'));
    if (!password) return;

    try {
      this.#showToast(t('vault.windowsHello.enabling'), 'info');
      await window.vault.hello.enable(vaultId, password);
      this.#showToast(t('vault.windowsHello.enableSuccess'), 'success');
      await this.#updateHelloButtonState();
    } catch (error) {
      this.#showToast(error.message || t('vault.windowsHello.enableFailed'), 'error');
    }
  }

  /**
   * Disable Windows Hello for current vault
   * @param {string} vaultId - Vault ID
   */
  async #disableWindowsHello(vaultId) {
    try {
      await window.vault.hello.disable(vaultId);
      this.#showToast(t('vault.windowsHello.disableSuccess'), 'success');
      await this.#updateHelloButtonState();
    } catch (error) {
      safeLog('[VaultUI] Hello disable error:', error);
      this.#showToast(error.message || t('vault.windowsHello.disableFailed'), 'error');
    }
  }

  /**
   * Prompt user for password (simple modal)
   * @param {string} message - Prompt message
   * @returns {Promise<string|null>} Password or null if cancelled
   */
  #promptPassword(message) {
    return new Promise((resolve) => {
      const modalId = 'password-prompt-modal';
      const existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'vault-modal-overlay active';
      modal.innerHTML = `
        <div class="vault-modal vault-modal-sm">
          <div class="vault-modal-header">
            <h3>Verification required</h3>
            <button type="button" class="vault-modal-close" data-close aria-label="${t('vault.common.close')}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="pwd-prompt-form">
            <p class="vault-modal-message">${escapeHtml(message)}</p>
            <div class="vault-form-group">
              <div class="vault-input-group">
                <input type="password" class="vault-input" id="pwd-prompt-input"
                       placeholder="${t('vault.placeholders.password')}" autocomplete="current-password" required autofocus>
                <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="pwd-prompt-input">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close>Cancel</button>
              <button type="submit" class="vault-btn vault-btn-primary">Confirmer</button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      // Focus password input
      setTimeout(() => modal.querySelector('#pwd-prompt-input')?.focus(), 100);

      // Toggle password visibility
      modal.querySelector('.toggle-pwd-visibility')?.addEventListener('click', () => {
        const input = modal.querySelector('#pwd-prompt-input');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
      });

      // Close handlers
      const close = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
        resolve(null);
      };

      modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

      // Submit handler
      modal.querySelector('#pwd-prompt-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = modal.querySelector('#pwd-prompt-input')?.value;
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 200);
        resolve(password || null);
      });
    });
  }

  #bindKeyboardShortcuts() {
    // Store handler for cleanup in destroy()
    this.#keyboardHandler = async (e) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.vault-modal-overlay.active');
        if (activeModal) {
          this.#closeModal(activeModal.id);
          return;
        }
      }

      if (this.#currentView !== 'main') return;

      // Ctrl+L - Lock
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.#lock();
      }

      // Ctrl+F - Focus search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('vault-search')?.focus();
      }

      // Ctrl+N - New entry
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.#openModal('add-entry-modal');
        this.#updateEntryTypeFields();
      }

      // Ctrl+E - Edit selected entry
      if (e.ctrlKey && e.key === 'e' && this.#selectedEntry) {
        e.preventDefault();
        this.#openEditModal(this.#selectedEntry);
      }

      // Ctrl+D - Duplicate entry
      if (e.ctrlKey && e.key === 'd' && this.#selectedEntry) {
        e.preventDefault();
        this.#duplicateEntry(this.#selectedEntry);
      }

      // Delete - Delete selected entry (with confirmation)
      if (e.key === 'Delete' && !e.target.matches('input, textarea, select') && this.#selectedEntry) {
        e.preventDefault();
        const confirmed = await showConfirm(t('vault.messages.deleteEntryConfirm', { title: this.#selectedEntry.title }), {
          type: 'danger',
          confirmLabel: t('common.delete') || 'Delete',
        });
        if (confirmed) this.#deleteEntryWithUndo(this.#selectedEntry);
      }

      // ? - Show shortcuts modal
      if (e.key === '?' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        this.#openModal('shortcuts-modal');
      }

      // Ctrl+U - Copy username
      if (e.ctrlKey && e.key === 'u' && this.#selectedEntry?.data?.username) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.username, t('vault.messages.usernameCopied'));
      }

      // Ctrl+P - Copy password (custom handler, prevent print)
      if (e.ctrlKey && e.key === 'p' && this.#selectedEntry?.data?.password) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.password, t('vault.messages.passwordCopied'));
      }

      // Ctrl+Shift+U - Auto-type
      if (e.ctrlKey && e.shiftKey && e.key === 'U' && this.#selectedEntry?.type === 'login') {
        e.preventDefault();
        this.#executeAutotype(this.#selectedEntry);
      }

      // Arrow keys for entry navigation
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.target.matches('input, textarea, select')) {
        const entries = this.#getFilteredEntries();
        if (entries.length === 0) return;

        e.preventDefault();
        const currentIdx = this.#selectedEntry
          ? entries.findIndex(en => en.id === this.#selectedEntry.id)
          : -1;

        let nextIdx;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < entries.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : entries.length - 1;
        }

        this.#selectedEntry = entries[nextIdx];
        this.#updateDetailPanel();
        this.#updateEntrySelection();

        const row = document.querySelector(`[data-entry-id="${entries[nextIdx].id}"]`);
        row?.focus();
        row?.scrollIntoView({ block: 'nearest' });
      }

      // Reset auto-lock on any key
      this.#resetAutoLock();
    };
    document.addEventListener('keydown', this.#keyboardHandler);

    // Reset auto-lock on mouse activity
    this.#container.addEventListener('mousemove', () => this.#resetAutoLock(), { passive: true });
    this.#container.addEventListener('click', () => this.#resetAutoLock(), { passive: true });
  }

  /**
   * Copy text to clipboard with secure auto-clear
   * Uses SecureClipboard for content verification before clearing
   * @param {string} text - Text to copy
   * @param {string} message - Success toast message
   * @param {boolean} autoClear - Whether to auto-clear (default true)
   */
  async #copyToClipboard(text, message, autoClear = true) {
    if (!text) return;

    try {
      const secureClipboard = getSecureClipboard();

      // Set up clipboard cleared callback (once)
      if (!this.#clipboardClearedCallbackSet) {
        secureClipboard.setOnCleared((reason) => {
          if (reason === 'manual' || reason === 'timeout') {
            this.#showToast(t('vault.messages.clipboardCleared'), 'info');
          }
        });
        this.#clipboardClearedCallbackSet = true;
      }

      // Copy using secure clipboard (with content verification before clear)
      const success = await secureClipboard.copy(text, {
        secure: autoClear,
        label: message
      });

      if (success) {
        this.#showToast(message, 'success');
      } else {
        this.#showToast(t('vault.common.error'), 'error');
      }
    } catch {
      this.#showToast(t('vault.common.error'), 'error');
    }
  }

  /** @type {boolean} */
  #clipboardClearedCallbackSet = false;

  #showToast(message, type = 'info') {
    const container = document.getElementById('toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    // For error type, add an icon
    const icon = type === 'error'
      ? '<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : type === 'warning'
        ? '<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        : type === 'success'
          ? '<svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
          : '';

    toast.innerHTML = `
      ${icon}
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="${t('vault.common.close')}">&times;</button>
    `;

    container.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    requestAnimationFrame(() => toast.classList.add('show'));

    // Errors stay longer
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Show a detailed error toast with suggestion
   * @param {string} title - Error title
   * @param {string} suggestion - Helpful suggestion
   */
  #showDetailedError(title, suggestion) {
    const container = document.getElementById('toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast toast-error toast-detailed';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <div class="toast-content">
        <span class="toast-title">${escapeHtml(title)}</span>
        <span class="toast-suggestion">${escapeHtml(suggestion)}</span>
      </div>
      <button class="toast-close" aria-label="${t('vault.common.close')}">&times;</button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  #showToastWithUndo(message, onUndo, onConfirm, duration = 5000) {
    const container = document.getElementById('toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning toast-with-undo';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-undo-btn" aria-label="Undo">Undo</button>
      <button class="toast-close" aria-label="${t('vault.common.close')}">&times;</button>
      <div class="toast-progress"><div class="toast-progress-bar"></div></div>
    `;

    container.appendChild(toast);

    const progressBar = toast.querySelector('.toast-progress-bar');
    let undone = false;

    // Animate progress bar
    progressBar.style.transition = `width ${duration}ms linear`;
    requestAnimationFrame(() => {
      toast.classList.add('show');
      progressBar.style.width = '0%';
    });

    // Undo button
    toast.querySelector('.toast-undo-btn')?.addEventListener('click', async () => {
      undone = true;
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
      if (onUndo) await onUndo();
    });

    // Close button (confirm delete)
    toast.querySelector('.toast-close')?.addEventListener('click', async () => {
      if (!undone) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
        if (onConfirm) await onConfirm();
      }
    });

    // Auto-confirm after duration
    setTimeout(async () => {
      try {
        if (!undone && toast.parentNode) {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 300);
          if (onConfirm) await onConfirm();
        }
      } catch (err) {
        safeLog('[VaultUI] Undo toast callback failed:', err);
      }
    }, duration);
  }

  #showAutoLockWarning() {
    if (this.#autoLockWarningShown) return;
    this.#autoLockWarningShown = true;

    const container = document.getElementById('toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning toast-autolock-warning';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span class="toast-message">Auto-lock in 30 seconds</span>
      <button class="toast-action-btn" aria-label="Stay connected">Stay connected</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    // Reset timer on click
    toast.querySelector('.toast-action-btn')?.addEventListener('click', () => {
      this.#resetAutoLock();
      this.#autoLockWarningShown = false;
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    // Auto-remove after lock
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }
    }, 30000);
  }

  // Vault colors palette (Proton Pass style)
  static #VAULT_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
  ];

  /**
   * Get vault color based on vault ID hash
   * @returns {string} Hex color
   */
  #getVaultColor() {
    const vaultId = this.#vaultMetadata?.id;
    if (!vaultId) return VaultUI.#VAULT_COLORS[0];
    // Hash the vault ID to get a consistent color index
    let hash = 0;
    for (let i = 0; i < vaultId.length; i++) {
      hash = ((hash << 5) - hash) + vaultId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % VaultUI.#VAULT_COLORS.length;
    return VaultUI.#VAULT_COLORS[index];
  }

  // ==================== FAVICON HELPERS ====================

  #extractDomain(url) {
    if (!url) return null;
    try {
      let fullUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = `https://${url}`;
      }
      return new URL(fullUrl).hostname;
    } catch (e) {
      const match = url.match(/^(?:https?:\/\/)?([^\/\s:]+)/i);
      return match ? match[1] : null;
    }
  }

  #getFaviconUrl(domain) {
    // Google favicon service - most reliable
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }

  #getDefaultFaviconSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`;
  }

  #renderFaviconImg(url, size = 20) {
    const domain = this.#extractDomain(url);
    if (!domain) {
      return `<span class="vault-favicon-placeholder" data-favicon-size="${size}">${this.#getDefaultFaviconSvg()}</span>`;
    }
    const faviconUrl = this.#getFaviconUrl(domain);
    return `<img src="${faviconUrl}"
                 class="vault-favicon"
                 data-favicon-size="${size}"
                 alt=""
                 loading="lazy"
                 onerror="this.classList.add('vault-favicon-hidden');this.nextElementSibling.classList.add('vault-favicon-visible')">
            <span class="vault-favicon-placeholder vault-favicon-hidden" data-favicon-size="${size}">${this.#getDefaultFaviconSvg()}</span>`;
  }

  async #preloadFavicons() {
    const urls = this.#entries
      .filter(e => e.data?.url)
      .map(e => e.data.url);

    const uniqueDomains = [...new Set(urls.map(u => this.#extractDomain(u)).filter(Boolean))];

    // Preload images (browser will cache them)
    for (const domain of uniqueDomains) {
      if (!this.#faviconCache.has(domain)) {
        const img = new Image();
        img.src = this.#getFaviconUrl(domain);
        this.#faviconCache.set(domain, true);
      }
    }
  }

  // ==================== TOOLTIP SYSTEM ====================

  /** @type {HTMLElement|null} */
  #tooltipElement = null;

  /** @type {number|null} */
  #tooltipTimeout = null;

  /**
   * Initialize JS-based tooltip system
   * Tooltips are appended to body with position:fixed to escape overflow:hidden containers
   */
  #initTooltips() {
    // Create tooltip element once
    if (!this.#tooltipElement) {
      this.#tooltipElement = document.createElement('div');
      this.#tooltipElement.className = 'vault-tooltip-js';
      this.#tooltipElement.setAttribute('role', 'tooltip');
      this.#tooltipElement.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.#tooltipElement);
    }

    // Use event delegation on the container
    this.#container.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.#showTooltip(target);
      }
    }, true);

    this.#container.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.#hideTooltip();
      }
    }, true);

    // Hide tooltip on scroll
    this.#container.addEventListener('scroll', () => this.#hideTooltip(), true);
  }

  /**
   * Show tooltip for target element
   * @param {HTMLElement} target - Element with data-tooltip attribute
   */
  #showTooltip(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text || !this.#tooltipElement) return;

    // Clear any pending hide
    if (this.#tooltipTimeout) {
      clearTimeout(this.#tooltipTimeout);
      this.#tooltipTimeout = null;
    }

    // Set content
    this.#tooltipElement.textContent = text;

    // Get target position
    const rect = target.getBoundingClientRect();
    const tooltipPos = target.getAttribute('data-tooltip-pos') || 'top';

    // Make visible to measure
    this.#tooltipElement.style.visibility = 'hidden';
    this.#tooltipElement.style.display = 'block';

    const tooltipRect = this.#tooltipElement.getBoundingClientRect();
    const padding = 8;
    const arrowSize = 6;

    let top, left;

    switch (tooltipPos) {
      case 'bottom':
        top = rect.bottom + arrowSize + 2;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.left - tooltipRect.width - arrowSize - 2;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        left = rect.right + arrowSize + 2;
        break;
      case 'top':
      default:
        top = rect.top - tooltipRect.height - arrowSize - 2;
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        break;
    }

    // Viewport boundary checks
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal bounds
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // Vertical bounds - flip if needed
    if (top < padding && tooltipPos === 'top') {
      // Flip to bottom
      top = rect.bottom + arrowSize + 2;
      this.#tooltipElement.setAttribute('data-pos', 'bottom');
    } else if (top + tooltipRect.height > viewportHeight - padding && tooltipPos === 'bottom') {
      // Flip to top
      top = rect.top - tooltipRect.height - arrowSize - 2;
      this.#tooltipElement.setAttribute('data-pos', 'top');
    } else {
      this.#tooltipElement.setAttribute('data-pos', tooltipPos);
    }

    // Apply position
    this.#tooltipElement.style.top = `${top}px`;
    this.#tooltipElement.style.left = `${left}px`;
    this.#tooltipElement.style.visibility = 'visible';
    this.#tooltipElement.classList.add('visible');
    this.#tooltipElement.setAttribute('aria-hidden', 'false');
  }

  /**
   * Hide the tooltip
   */
  #hideTooltip() {
    if (!this.#tooltipElement) return;

    // Small delay to prevent flicker when moving between elements
    this.#tooltipTimeout = setTimeout(() => {
      this.#tooltipElement.classList.remove('visible');
      this.#tooltipElement.setAttribute('aria-hidden', 'true');
      this.#tooltipTimeout = null;
    }, 50);
  }

  #initSyncStatus() {
    if (!window.vault) return;

    this.#unsubscribeSyncStatus = window.vault.on('sync:status', (data) => {
      this.#updateSyncStatus(data);
    });
  }

  #updateSyncStatus(data) {
    const el = document.getElementById('vault-sync-status');
    const icon = document.getElementById('vault-sync-icon');
    const text = document.getElementById('vault-sync-text');

    if (!el || !data) return;

    el.hidden = false;
    el.className = 'vault-sync-status'; // reset

    // Clear timeout if exists
    if (this._syncStatusTimeout) {
      clearTimeout(this._syncStatusTimeout);
      this._syncStatusTimeout = null;
    }

    if (data.status === 'syncing') {
      el.classList.add('syncing');
      icon.className = 'vault-sync-icon vault-sync-spinner';
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
      text.textContent = data.message || t('vault.sync.syncing');
    } else if (data.status === 'synced') {
      el.classList.add('synced');
      icon.className = 'vault-sync-icon';
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      text.textContent = data.message || t('vault.sync.upToDate');

      // Hide after 5 seconds
      this._syncStatusTimeout = setTimeout(() => {
        el.hidden = true;
      }, 5000);
    } else if (data.status === 'error') {
      el.classList.add('error');
      icon.className = 'vault-sync-icon';
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      text.textContent = data.message || t('vault.sync.syncError');
    }
  }

  #renderNoVaultAPI() {
    this.#container.innerHTML = `
      <div class="vault-empty">
        <div class="vault-empty-icon">⚠️</div>
        <h3>Vault not available</h3>
        <p>The vault API is not available in this context.</p>
        <p class="vault-help-text">The vault requires the Electron application to work.</p>
      </div>
    `;
  }
}

export default VaultUI;
