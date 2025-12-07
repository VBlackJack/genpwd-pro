/**
 * @fileoverview Vault UI Component - Professional Password Manager UX
 * Inspired by KeePassXC, RoboForm, and modern password managers
 *
 * Layout: 3-panel design
 * - Left sidebar: Folders, categories, filters
 * - Center: Entry list with quick actions
 * - Right: Entry detail panel
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

// Entry type configuration
const ENTRY_TYPES = {
  login: { icon: '🔑', label: 'Identifiant', color: '#60a5fa' },
  note: { icon: '📝', label: 'Note sécurisée', color: '#fbbf24' },
  card: { icon: '💳', label: 'Carte bancaire', color: '#f472b6' },
  identity: { icon: '👤', label: 'Identité', color: '#a78bfa' },
  ssh: { icon: '🔐', label: 'Clé SSH', color: '#34d399' },
  preset: { icon: '⚙️', label: 'Preset', color: '#94a3b8' }
};

// Category filters
const CATEGORIES = [
  { id: 'all', icon: '📁', label: 'Tous' },
  { id: 'favorites', icon: '⭐', label: 'Favoris' },
  { id: 'recent', icon: '🕐', label: 'Récents' },
  { id: 'login', icon: '🔑', label: 'Identifiants' },
  { id: 'note', icon: '📝', label: 'Notes' },
  { id: 'card', icon: '💳', label: 'Cartes' },
  { id: 'identity', icon: '👤', label: 'Identités' }
];

// Sort options
const SORT_OPTIONS = [
  { id: 'title-asc', label: 'Titre A-Z', icon: '↑' },
  { id: 'title-desc', label: 'Titre Z-A', icon: '↓' },
  { id: 'modified-desc', label: 'Modifié récemment', icon: '🕐' },
  { id: 'modified-asc', label: 'Plus ancien', icon: '📅' },
  { id: 'type', label: 'Par type', icon: '📂' }
];

/**
 * Vault UI Controller
 */
export class VaultUI {
  #container;
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
  #searchFilters = { type: null, strength: null, age: null };
  #autoLockWarningShown = false;
  #selectedEntries = new Set(); // Multi-selection
  #lastSelectedIndex = -1; // For shift-click range selection
  #draggedEntry = null; // For drag & drop
  #totpTimer = null; // TOTP update interval
  #pendingExportEntries = null; // Entries pending export
  #faviconCache = new Map(); // Cached favicons
  #breachCache = new Map(); // Cached breach check results (password hash -> count)
  #lastBreachCheck = null; // Last breach check timestamp
  #pendingExternalPath = null; // Path for external vault creation/opening

  constructor(container) {
    this.#container = container;
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
      const autoCheckBreaches = localStorage.getItem('vault-auto-breach-check') !== 'false';
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
      console.error('[VaultUI] Init error:', error);
    }

    // Keyboard shortcuts
    this.#bindKeyboardShortcuts();

    // Initialize JS-based tooltips (escapes overflow:hidden containers)
    this.#initTooltips();

    this.#render();
  }

  destroy() {
    if (this.#unsubscribeLocked) this.#unsubscribeLocked();
    if (this.#unsubscribeUnlocked) this.#unsubscribeUnlocked();
    if (this.#unsubscribeChanged) this.#unsubscribeChanged();
    this.#stopAutoLockTimer();
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
      console.error('[VaultUI] Load error:', error);
    }
  }

  #render() {
    if (this.#currentView === 'lock') {
      this.#renderLockScreen();
    } else {
      this.#renderMainView();
    }
  }

  // ==================== LOCK SCREEN ====================

  #renderLockScreen() {
    this.#container.innerHTML = `
      <div class="vault-lock-screen">
        <div class="vault-lock-content">
          <div class="vault-lock-icon">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <circle cx="12" cy="16" r="1"></circle>
            </svg>
          </div>
          <h2>Coffre-fort</h2>
          <p class="vault-lock-subtitle">Sélectionnez un coffre et entrez votre mot de passe</p>

          <div class="vault-selector" id="vault-selector" role="listbox" aria-label="Sélection du coffre">
            <div class="vault-loading"><div class="vault-spinner"></div></div>
          </div>

          <form class="vault-unlock-form" id="unlock-form">
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="vault-password"
                     placeholder="Mot de passe principal" autocomplete="current-password"
                     aria-label="Mot de passe principal">
              <button type="button" class="vault-input-btn" id="toggle-password"
                      title="Afficher/Masquer" aria-label="Afficher le mot de passe" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
            <button type="submit" class="vault-btn vault-btn-primary vault-btn-full" id="btn-unlock">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
              </svg>
              <span class="btn-text">Déverrouiller</span>
            </button>
            <div class="vault-unlock-progress" id="unlock-progress" hidden>
              <div class="vault-progress-bar"><div class="vault-progress-fill"></div></div>
              <span class="vault-progress-text">Dérivation de la clé...</span>
            </div>
          </form>

          <!-- Windows Hello Button (shown when available) -->
          <div class="vault-hello-section" id="hello-section" hidden>
            <div class="vault-hello-divider">
              <span>ou</span>
            </div>
            <button type="button" class="vault-btn vault-btn-hello" id="btn-hello-unlock">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5">
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
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Nouveau coffre
            </button>
            <span class="vault-action-divider">|</span>
            <button type="button" class="vault-link-btn" id="btn-open-external">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              Ouvrir un fichier...
            </button>
          </div>
        </div>
      </div>
      ${this.#renderCreateVaultModal()}
      ${this.#renderOpenExternalModal()}
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
            <p>Aucun coffre trouvé. Créez-en un pour commencer.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="vault-list" role="listbox">
          ${vaults.map((v, i) => `
            <div class="vault-list-item ${i === 0 ? 'selected' : ''}"
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
                <div class="vault-list-name">${this.#escapeHtml(v.name || v.id.substring(0, 8))}</div>
                <div class="vault-list-meta">${this.#formatDate(v.modifiedAt)}</div>
              </div>
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
        item.addEventListener('click', () => this.#selectVaultItem(item, container));
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

      // Check Windows Hello for first vault
      if (vaults.length > 0) {
        this.#updateHelloSection(vaults[0].id);
      }
    } catch (error) {
      container.innerHTML = `<div class="vault-error">Erreur de chargement des coffres</div>`;
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
      console.error('[VaultUI] Hello check error:', error);
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
        btn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        btn.setAttribute('aria-pressed', String(isPassword));
      }
    });

    // Unlock form
    document.getElementById('unlock-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selected = document.querySelector('.vault-list-item.selected');
      const password = document.getElementById('vault-password')?.value;

      if (!selected) {
        this.#showToast('Sélectionnez un coffre', 'warning');
        return;
      }
      if (!password) {
        this.#showToast('Entrez votre mot de passe', 'warning');
        document.getElementById('vault-password')?.focus();
        return;
      }

      const btn = document.getElementById('btn-unlock');
      const progress = document.getElementById('unlock-progress');

      btn.disabled = true;
      btn.querySelector('.btn-text').textContent = 'Déverrouillage...';
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
          error.message || 'Mot de passe incorrect',
          'Vérifiez votre saisie et réessayez'
        );
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Déverrouiller';
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
        this.#showToast('Sélectionnez un coffre', 'warning');
        return;
      }

      const btn = document.getElementById('btn-hello-unlock');
      const originalContent = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner"></span> Vérification...';

      try {
        await window.vault.hello.unlock(selected.dataset.vaultId);
        // Success - vault:unlocked event will handle view switch
      } catch (error) {
        this.#showToast(error.message || 'Échec Windows Hello', 'error');
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
        this.#showToast(error.message || 'Erreur lors de la sélection du fichier', 'error');
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

  #renderCreateVaultModal() {
    return `
      <div class="vault-modal-overlay" id="create-vault-modal" role="dialog" aria-modal="true" aria-labelledby="create-vault-title">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="create-vault-title">Nouveau coffre</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="create-vault-form">
            <div class="vault-form-group">
              <label class="vault-label" for="new-vault-name">Nom du coffre <span class="required" aria-label="obligatoire">*</span></label>
              <input type="text" class="vault-input" id="new-vault-name" placeholder="Mon coffre" required aria-describedby="vault-name-message">
              <div class="vault-field-message" id="vault-name-message" role="alert" aria-live="polite"></div>
            </div>

            <!-- Location selector -->
            <div class="vault-form-group">
              <label class="vault-label">Emplacement</label>
              <div class="vault-location-options">
                <label class="vault-radio-option">
                  <input type="radio" name="vault-location-type" value="default" checked>
                  <span class="vault-radio-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    Dossier par défaut
                  </span>
                </label>
                <label class="vault-radio-option">
                  <input type="radio" name="vault-location-type" value="custom">
                  <span class="vault-radio-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Choisir un emplacement...
                  </span>
                </label>
              </div>
              <div class="vault-custom-location" id="custom-location-section" hidden>
                <button type="button" class="vault-btn vault-btn-outline vault-btn-sm" id="btn-choose-location">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Parcourir...
                </button>
                <div class="vault-location-path" id="create-vault-location" hidden></div>
              </div>
            </div>

            <div class="vault-form-group">
              <label class="vault-label" for="new-vault-password">Mot de passe principal <span class="required" aria-label="obligatoire">*</span></label>
              <div class="vault-input-group">
                <input type="password" class="vault-input" id="new-vault-password"
                       placeholder="Minimum 12 caractères" required minlength="12" aria-describedby="vault-password-message">
                <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="new-vault-password" aria-label="Afficher le mot de passe" aria-pressed="false">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
              <div class="vault-password-strength" id="new-password-strength"></div>
              <div class="vault-field-message" id="vault-password-message" role="alert" aria-live="polite"></div>
            </div>
            <div class="vault-form-group">
              <label class="vault-label" for="new-vault-confirm">Confirmer le mot de passe <span class="required" aria-label="obligatoire">*</span></label>
              <input type="password" class="vault-input" id="new-vault-confirm" placeholder="Retapez le mot de passe" required aria-describedby="vault-confirm-message">
              <div class="vault-field-message" id="vault-confirm-message" role="alert" aria-live="polite"></div>
            </div>

            <!-- Windows Hello option (shown only if available) -->
            <div class="vault-form-group vault-hello-option" id="create-hello-option" hidden>
              <label class="vault-checkbox-option">
                <input type="checkbox" id="new-vault-hello">
                <span class="vault-checkbox-label">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <circle cx="8.5" cy="10" r="1.5"/>
                    <circle cx="15.5" cy="10" r="1.5"/>
                    <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
                  </svg>
                  Activer Windows Hello
                </span>
                <span class="vault-checkbox-hint">Déverrouillez avec votre visage ou empreinte</span>
              </label>
            </div>

            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Créer le coffre</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

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
      const defaultName = nameInput?.value?.trim() || 'Mon coffre';

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
        this.#showToast('Erreur lors de la sélection', 'error');
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
          btn.setAttribute('aria-label', isPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
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
        requiredMessage: 'Le nom du coffre est obligatoire',
        maxLengthMessage: 'Maximum 50 caractères'
      });
    });
    vaultNameInput?.addEventListener('blur', () => {
      this.#validateField(vaultNameInput, vaultNameMessage, {
        required: true,
        requiredMessage: 'Le nom du coffre est obligatoire'
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
            <div class="vault-strength-fill ${strength.level}" style="width: ${strength.percent}%"></div>
          </div>
          <span class="vault-strength-text ${strength.level}">${strength.label}</span>
        `;
      }
      // Validation message
      this.#validateField(vaultPasswordInput, vaultPasswordMessage, {
        required: true,
        minLength: 12,
        requiredMessage: 'Le mot de passe est obligatoire',
        minLengthMessage: 'Minimum 12 caractères requis'
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
        this.#showToast('Les mots de passe ne correspondent pas', 'error');
        return;
      }
      if (password.length < 12) {
        this.#showToast('Minimum 12 caractères requis', 'error');
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner-small"></span> Création...';

      try {
        // Use custom path if set (external vault)
        const customPath = this.#pendingExternalPath;
        const result = await window.vault.create(name, password, customPath);

        // Enable Windows Hello if requested
        if (enableHello && result.vaultId) {
          try {
            await window.vault.hello.enable(result.vaultId, password);
            this.#showToast('Coffre créé avec Windows Hello activé', 'success');
          } catch (helloError) {
            console.error('Windows Hello enable failed:', helloError);
            this.#showToast('Coffre créé (Windows Hello non activé)', 'warning');
          }
        } else {
          this.#showToast(customPath ? `Coffre créé à ${customPath}` : 'Coffre créé avec succès', 'success');
        }

        this.#closeModal('create-vault-modal');
        this.#pendingExternalPath = null; // Reset
        this.#loadVaultList();
      } catch (error) {
        this.#showToast(error.message || 'Erreur de création', 'error');
        btn.disabled = false;
        btn.textContent = 'Créer le coffre';
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
    } catch (error) {
      console.log('Windows Hello not available:', error);
      helloOption.hidden = true;
    }
  }

  #renderOpenExternalModal() {
    return `
      <div class="vault-modal-overlay" id="open-external-modal" role="dialog" aria-modal="true" aria-labelledby="open-external-title">
        <div class="vault-modal vault-modal-sm">
          <div class="vault-modal-header">
            <h3 id="open-external-title">Ouvrir un coffre</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="open-external-form">
            <div class="vault-form-group">
              <label class="vault-label">Fichier</label>
              <div class="vault-location-path" id="external-vault-path"></div>
            </div>
            <div class="vault-form-group">
              <label class="vault-label" for="external-vault-password">Mot de passe principal <span class="required">*</span></label>
              <div class="vault-input-group">
                <input type="password" class="vault-input" id="external-vault-password"
                       placeholder="Mot de passe du coffre" required autocomplete="current-password">
                <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="external-vault-password" aria-label="Afficher le mot de passe">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Ouvrir</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

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
        this.#showToast('Entrez le mot de passe', 'warning');
        return;
      }

      if (!this.#pendingExternalPath) {
        this.#showToast('Aucun fichier sélectionné', 'error');
        return;
      }

      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<span class="vault-spinner-small"></span> Ouverture...';

      try {
        await window.vault.openFromPath(this.#pendingExternalPath, password);
        this.#closeModal('open-external-modal');
        this.#pendingExternalPath = null;
        this.#showToast('Coffre ouvert avec succès', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Mot de passe incorrect ou fichier invalide', 'error');
        btn.disabled = false;
        btn.textContent = 'Ouvrir';
        document.getElementById('external-vault-password')?.select();
      }
    });
  }

  // ==================== MAIN VIEW (3-panel layout) ====================

  #renderMainView() {
    const filteredEntries = this.#getFilteredEntries();

    this.#container.innerHTML = `
      <div class="vault-app" role="application" aria-label="Gestionnaire de mots de passe">
        <!-- Sidebar -->
        <aside class="vault-sidebar" role="navigation" aria-label="Navigation du coffre">
          <!-- Vault Selector -->
          <div class="vault-selector-header">
            <button class="vault-current" id="vault-switcher" aria-haspopup="true" aria-expanded="false">
              <div class="vault-current-icon" style="background: ${this.#getVaultColor()}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="vault-current-info">
                <span class="vault-current-name">${this.#escapeHtml(this.#vaultMetadata?.name || 'Coffre')}</span>
                <span class="vault-current-meta">${this.#entries.length} entrée(s)</span>
              </div>
              <svg class="vault-current-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="vault-switcher-dropdown" id="vault-switcher-dropdown" hidden>
              <div class="vault-switcher-section">
                <div class="vault-switcher-label">Coffre actuel</div>
                <div class="vault-switcher-item current">
                  <div class="vault-switcher-icon" style="background: ${this.#getVaultColor()}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <span class="vault-switcher-name">${this.#escapeHtml(this.#vaultMetadata?.name || 'Coffre')}</span>
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
                  <span>Changer de coffre</span>
                </button>
                <button class="vault-switcher-action" id="btn-create-new-vault">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                  <span>Nouveau coffre</span>
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
              <button class="vault-timer-settings" id="timer-settings" title="Configurer le délai" aria-label="Configurer le délai de verrouillage">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
            <button class="vault-icon-btn" id="btn-lock" data-tooltip="Verrouiller (Ctrl+L)" data-tooltip-pos="bottom" aria-label="Verrouiller le coffre">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            <button class="vault-icon-btn vault-theme-toggle" id="theme-toggle" data-tooltip="Changer de thème" data-tooltip-pos="bottom" aria-label="Basculer thème clair/sombre" aria-pressed="${this.#theme === 'light'}">
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
            <button class="vault-icon-btn vault-hello-settings" id="hello-settings" data-tooltip="Windows Hello" data-tooltip-pos="bottom" aria-label="Configurer Windows Hello" hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <circle cx="8.5" cy="10" r="1.5"/>
                <circle cx="15.5" cy="10" r="1.5"/>
                <path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>
              </svg>
            </button>
          </div>

          <div class="vault-sidebar-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="search" class="vault-search-input" id="vault-search"
                   placeholder="Rechercher... (Ctrl+F)" value="${this.#escapeHtml(this.#searchQuery)}"
                   aria-label="Rechercher dans le coffre">
            <button class="vault-filter-btn ${this.#hasActiveFilters() ? 'active' : ''}" id="filter-btn"
                    title="Filtres avancés" aria-haspopup="true" aria-expanded="false">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              ${this.#hasActiveFilters() ? '<span class="filter-badge"></span>' : ''}
            </button>
          </div>
          <div class="vault-filter-panel" id="filter-panel" hidden>
            <div class="vault-filter-section">
              <label class="vault-filter-label">Type</label>
              <div class="vault-filter-chips" id="filter-type">
                <button class="vault-chip ${!this.#searchFilters.type ? 'active' : ''}" data-filter-type="">Tous</button>
                ${Object.entries(ENTRY_TYPES).map(([key, val]) => `
                  <button class="vault-chip ${this.#searchFilters.type === key ? 'active' : ''}" data-filter-type="${key}">
                    ${val.icon} ${val.label}
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="vault-filter-section">
              <label class="vault-filter-label">Force du mot de passe</label>
              <div class="vault-filter-chips" id="filter-strength">
                <button class="vault-chip ${!this.#searchFilters.strength ? 'active' : ''}" data-filter-strength="">Tous</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'weak' ? 'active' : ''}" data-filter-strength="weak" aria-label="Force faible"><span aria-hidden="true">🔴</span> Faible</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'medium' ? 'active' : ''}" data-filter-strength="medium" aria-label="Force moyenne"><span aria-hidden="true">🟡</span> Moyen</button>
                <button class="vault-chip ${this.#searchFilters.strength === 'strong' ? 'active' : ''}" data-filter-strength="strong" aria-label="Force élevée"><span aria-hidden="true">🟢</span> Fort</button>
              </div>
            </div>
            <div class="vault-filter-section">
              <label class="vault-filter-label">Âge du mot de passe</label>
              <div class="vault-filter-chips" id="filter-age">
                <button class="vault-chip ${!this.#searchFilters.age ? 'active' : ''}" data-filter-age="">Tous</button>
                <button class="vault-chip ${this.#searchFilters.age === 'recent' ? 'active' : ''}" data-filter-age="recent">Récent (&lt;30j)</button>
                <button class="vault-chip ${this.#searchFilters.age === 'old' ? 'active' : ''}" data-filter-age="old">Ancien (&gt;180j)</button>
                <button class="vault-chip ${this.#searchFilters.age === 'expiring' ? 'active' : ''}" data-filter-age="expiring" aria-label="Expire bientôt"><span aria-hidden="true">⏰</span> Expire bientôt</button>
                <button class="vault-chip ${this.#searchFilters.age === 'expired' ? 'active' : ''}" data-filter-age="expired" aria-label="Expiré"><span aria-hidden="true">⚠️</span> Expiré</button>
              </div>
            </div>
            <div class="vault-filter-actions">
              <button class="vault-btn vault-btn-sm vault-btn-secondary" id="clear-filters">Réinitialiser</button>
            </div>
          </div>

          <nav class="vault-nav" aria-label="Catégories">
            <div class="vault-nav-section">
              <div class="vault-nav-title">Catégories</div>
              ${CATEGORIES.map(cat => `
                <button class="vault-nav-item ${this.#selectedCategory === cat.id ? 'active' : ''}"
                        data-category="${cat.id}"
                        aria-current="${this.#selectedCategory === cat.id ? 'true' : 'false'}">
                  <span class="vault-nav-icon" aria-hidden="true">${cat.icon}</span>
                  <span class="vault-nav-label">${cat.label}</span>
                  <span class="vault-nav-count" aria-label="${this.#getCategoryCount(cat.id)} entrées">${this.#getCategoryCount(cat.id)}</span>
                </button>
              `).join('')}
            </div>

            <div class="vault-nav-section">
              <div class="vault-nav-title vault-nav-title-with-action">
                <span>Dossiers</span>
                <button class="vault-nav-add-btn" id="btn-add-folder" title="Nouveau dossier" aria-label="Créer un dossier">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
              ${this.#folders.length === 0 ? `
                <div class="vault-nav-empty">Aucun dossier</div>
              ` : this.#folders.map(folder => {
                const folderColor = this.#getFolderColor(folder.id);
                return `
                <button class="vault-nav-item ${this.#selectedFolder === folder.id ? 'active' : ''}"
                        data-folder="${folder.id}"
                        aria-current="${this.#selectedFolder === folder.id ? 'true' : 'false'}">
                  <span class="vault-nav-icon vault-folder-color" style="${folderColor ? `color: ${folderColor}` : ''}" aria-hidden="true">📂</span>
                  <span class="vault-nav-label">${this.#escapeHtml(folder.name)}</span>
                  <span class="vault-nav-count">${this.#entries.filter(e => e.folderId === folder.id).length}</span>
                </button>
              `}).join('')}
            </div>

            <div class="vault-nav-section">
              <div class="vault-nav-title vault-nav-title-with-action">
                <span>Tags</span>
                <button class="vault-nav-add-btn" id="btn-add-tag" title="Nouveau tag" aria-label="Créer un tag">
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
            <button class="vault-btn vault-btn-outline vault-btn-full" id="btn-health-dashboard" title="Analyser la santé des mots de passe">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              Santé des mots de passe
            </button>
            <button class="vault-btn vault-btn-primary vault-btn-full" id="btn-add-entry">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nouvelle entrée
            </button>
          </div>
        </aside>

        <!-- Entry List -->
        <main class="vault-list-panel" role="main">
          <div class="vault-list-header">
            <div class="vault-list-header-top">
              ${this.#renderBreadcrumb()}
              <span class="vault-list-count">${filteredEntries.length} entrée(s)</span>
            </div>
            <div class="vault-list-toolbar">
              <div class="vault-sort-dropdown">
                <button class="vault-sort-btn" id="sort-btn" aria-haspopup="listbox" aria-expanded="false">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="4" y1="6" x2="20" y2="6"></line>
                    <line x1="4" y1="12" x2="16" y2="12"></line>
                    <line x1="4" y1="18" x2="12" y2="18"></line>
                  </svg>
                  <span>${SORT_OPTIONS.find(s => s.id === this.#sortBy)?.label || 'Trier'}</span>
                </button>
                <div class="vault-sort-menu" id="sort-menu" role="listbox" hidden>
                  ${SORT_OPTIONS.map(opt => `
                    <button class="vault-sort-option ${this.#sortBy === opt.id ? 'active' : ''}"
                            data-sort="${opt.id}" role="option" aria-selected="${this.#sortBy === opt.id}">
                      <span class="sort-icon">${opt.icon}</span>
                      <span>${opt.label}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
              <button class="vault-view-toggle ${this.#viewMode === 'compact' ? 'compact' : ''}" id="view-toggle"
                      title="${this.#viewMode === 'compact' ? 'Vue confortable' : 'Vue compacte'}"
                      aria-label="Basculer la densité d'affichage"
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
              <button class="vault-help-btn" id="shortcuts-help" title="Raccourcis clavier (?)" aria-label="Afficher les raccourcis clavier">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </button>
              <button class="vault-icon-btn vault-health-btn" id="health-dashboard" data-tooltip="Santé des mots de passe" data-tooltip-pos="bottom" aria-label="Tableau de bord santé">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </button>
              <div class="vault-toolbar-divider"></div>
              <button class="vault-icon-btn" id="btn-export" data-tooltip="Exporter" data-tooltip-pos="bottom" aria-label="Exporter les entrées">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="vault-icon-btn" id="btn-import" data-tooltip="Importer" data-tooltip-pos="bottom" aria-label="Importer des entrées">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- Bulk Actions Bar -->
          <div class="vault-bulk-actions ${this.#selectedEntries.size > 0 ? 'visible' : ''}" id="bulk-actions">
            <label class="vault-checkbox-wrapper select-all">
              <input type="checkbox" class="vault-checkbox" id="select-all"
                     ${this.#selectedEntries.size === filteredEntries.length && filteredEntries.length > 0 ? 'checked' : ''}
                     aria-label="Tout sélectionner">
              <span class="vault-checkbox-mark"></span>
            </label>
            <span class="vault-bulk-count">${this.#selectedEntries.size} sélectionné(s)</span>
            <div class="vault-bulk-buttons">
              <button class="vault-bulk-btn" id="bulk-move" title="Déplacer vers un dossier">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Déplacer
              </button>
              <button class="vault-bulk-btn" id="bulk-export" title="Exporter la sélection">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Exporter
              </button>
              <button class="vault-bulk-btn" id="bulk-tag" title="Gérer les tags">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                Tags
              </button>
              <button class="vault-bulk-btn vault-bulk-btn-danger" id="bulk-delete" title="Supprimer la sélection">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Supprimer
              </button>
              <button class="vault-bulk-btn" id="bulk-cancel" title="Annuler la sélection">
                Annuler
              </button>
            </div>
          </div>

          <div class="vault-list-content ${this.#viewMode}" id="vault-entries" role="listbox" aria-label="Liste des entrées">
            ${filteredEntries.length === 0
              ? this.#renderEmptyState()
              : filteredEntries.map((entry, idx) => this.#renderEntryRow(entry, idx)).join('')
            }
          </div>
        </main>

        <!-- Detail Panel -->
        <aside class="vault-detail-panel ${this.#selectedEntry ? '' : 'empty'}" id="detail-panel"
               role="complementary" aria-label="Détails de l'entrée">
          ${this.#selectedEntry ? this.#renderEntryDetail() : this.#renderNoSelection()}
        </aside>
      </div>
      ${this.#renderAddEntryModal()}
      ${this.#renderAddFolderModal()}
      ${this.#renderEditEntryModal()}
      ${this.#renderShortcutsModal()}
      ${this.#renderHealthDashboardModal()}
      ${this.#renderMoveFolderModal()}
      ${this.#renderAddTagModal()}
      ${this.#renderEditTagModal()}
    `;

    this.#attachMainViewEvents();
    this.#updateLockCountdown();
    this.#initTheme();
  }

  #renderBreadcrumb() {
    let label = 'Tous les éléments';

    if (this.#selectedTag) {
      const tag = this.#tags.find(t => t.id === this.#selectedTag);
      label = tag ? `🏷️ ${tag.name}` : 'Tag';
    } else if (this.#selectedFolder) {
      const folder = this.#folders.find(f => f.id === this.#selectedFolder);
      label = folder ? folder.name : 'Dossier';
    } else if (this.#selectedCategory !== 'all') {
      const cat = CATEGORIES.find(c => c.id === this.#selectedCategory);
      label = cat?.label || 'Catégorie';
    }

    return `
      <nav class="vault-breadcrumb" aria-label="Fil d'Ariane">
        <span class="vault-breadcrumb-item">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Coffre
        </span>
        <span class="vault-breadcrumb-separator" aria-hidden="true">›</span>
        <span class="vault-breadcrumb-item current">${this.#escapeHtml(label)}</span>
      </nav>
    `;
  }

  #renderEntryRow(entry, index) {
    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
    const subtitle = entry.data?.username || entry.data?.url || type.label;
    const isSelected = this.#selectedEntry?.id === entry.id;
    const isMultiSelected = this.#selectedEntries.has(entry.id);
    const isFavorite = entry.favorite;
    const isPinned = entry.pinned;
    const strength = entry.type === 'login' && entry.data?.password
      ? this.#getPasswordStrength(entry.data.password)
      : null;
    const isDuplicate = entry.type === 'login' && entry.data?.password
      ? this.#isPasswordDuplicated(entry.data.password, entry.id)
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
        <label class="vault-checkbox-wrapper" title="Sélectionner">
          <input type="checkbox" class="vault-checkbox" data-action="multi-select"
                 ${isMultiSelected ? 'checked' : ''} aria-label="Sélectionner ${this.#escapeHtml(entry.title)}">
          <span class="vault-checkbox-mark"></span>
        </label>
        <button class="vault-fav-toggle ${isFavorite ? 'active' : ''}"
                data-action="toggle-favorite"
                title="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                aria-label="${isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                aria-pressed="${isFavorite}">
          ${isFavorite ? '★' : '☆'}
        </button>
        <div class="vault-entry-icon" style="background: ${type.color}20; color: ${type.color}" aria-hidden="true">
          ${entry.data?.url ? this.#renderFaviconImg(entry.data.url, 20) : type.icon}
        </div>
        <div class="vault-entry-content">
          <div class="vault-entry-title">
            ${isPinned ? '<span class="vault-pin-badge" role="img" aria-label="Épinglé"><span aria-hidden="true">📌</span></span>' : ''}
            ${this.#escapeHtml(entry.title)}
            ${strength ? `<span class="vault-strength-dot ${strength}" role="img" aria-label="Force du mot de passe: ${strength === 'strong' ? 'Fort' : strength === 'medium' ? 'Moyen' : 'Faible'}" title="Force: ${strength === 'strong' ? 'Fort' : strength === 'medium' ? 'Moyen' : 'Faible'}"></span>` : ''}
            ${isDuplicate ? '<span class="vault-duplicate-badge" role="img" aria-label="Mot de passe réutilisé" title="Mot de passe réutilisé"><span aria-hidden="true">🔁</span></span>' : ''}
            ${expiryStatus.badge}
          </div>
          <div class="vault-entry-subtitle">${this.#escapeHtml(subtitle)}</div>
          ${this.#renderTagsInRow(entry)}
        </div>
        <div class="vault-entry-actions" role="group" aria-label="Actions rapides">
          ${entry.type === 'login' && entry.data?.username ? `
            <button class="vault-quick-btn copy-user" data-action="copy-username"
                    title="Copier l'identifiant" aria-label="Copier l'identifiant">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          ` : ''}
          ${entry.type === 'login' && entry.data?.password ? `
            <button class="vault-quick-btn copy-pass" data-action="copy-password"
                    title="Copier le mot de passe" aria-label="Copier le mot de passe">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          ` : ''}
          ${entry.data?.url ? `
            <button class="vault-quick-btn open-url" data-action="open-url"
                    title="Ouvrir le site" aria-label="Ouvrir le site dans un nouvel onglet">
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

    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;

    return `
      <div class="vault-detail-header">
        <div class="vault-detail-icon" style="background: ${type.color}20; color: ${type.color}" aria-hidden="true">
          ${entry.data?.url ? this.#renderFaviconImg(entry.data.url, 32) : type.icon}
        </div>
        <div class="vault-detail-info">
          <h3 class="vault-detail-title">${this.#escapeHtml(entry.title)}</h3>
          <span class="vault-detail-type">${type.label}</span>
          <div class="vault-detail-tags">${this.#renderTagsInDetail(entry)}</div>
        </div>
        <div class="vault-detail-actions" role="group" aria-label="Actions sur l'entrée">
          <button class="vault-icon-btn ${entry.favorite ? 'active' : ''}" id="btn-toggle-favorite"
                  data-tooltip="${entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                  aria-label="${entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
                  aria-pressed="${entry.favorite}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${entry.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button class="vault-icon-btn" id="btn-edit-entry" data-tooltip="Modifier (E)" aria-label="Modifier l'entrée">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="vault-icon-btn" id="btn-duplicate-entry" data-tooltip="Dupliquer" aria-label="Dupliquer l'entrée">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          ${entry.type === 'login' ? `
          <button class="vault-icon-btn autotype" id="btn-autotype" data-tooltip="Auto-remplir (Ctrl+Shift+U)" aria-label="Auto-remplir le formulaire">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="6" y1="8" x2="6" y2="8"></line>
              <line x1="10" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="16" x2="14" y2="16"></line>
            </svg>
          </button>
          ` : ''}
          <button class="vault-icon-btn share" id="btn-share-entry" data-tooltip="Partager" aria-label="Partager de manière sécurisée">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </button>
          <button class="vault-icon-btn danger" id="btn-delete-entry" data-tooltip="Supprimer" data-tooltip-pos="left" aria-label="Supprimer l'entrée">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="vault-detail-body">
        ${this.#renderEntryFields(entry)}
        ${this.#renderPasswordAge(entry)}

        <div class="vault-detail-meta">
          <div class="vault-meta-item">
            <span class="vault-meta-label">Créé le</span>
            <span class="vault-meta-value">${this.#formatDateTime(entry.createdAt)}</span>
          </div>
          <div class="vault-meta-item">
            <span class="vault-meta-label">Modifié le</span>
            <span class="vault-meta-value">${this.#formatDateTime(entry.modifiedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  #renderEntryFields(entry) {
    switch (entry.type) {
      case 'login':
        return `
          ${this.#renderField('Identifiant', entry.data?.username, 'username', false, true)}
          ${this.#renderField('Mot de passe', entry.data?.password, 'password', true, true)}
          ${this.#renderPasswordHistory(entry)}
          ${entry.data?.totp ? this.#renderTOTPField(entry) : ''}
          ${this.#renderField('URL', entry.data?.url, 'url', false, true, true)}
          ${this.#renderExpirationField(entry)}
          ${entry.notes ? this.#renderNotesField(entry.notes) : ''}
        `;
      case 'note':
        return `
          <div class="vault-field vault-notes-field">
            <div class="vault-field-label-row">
              <label class="vault-field-label">Contenu</label>
              <div class="vault-notes-toggle">
                <button type="button" class="vault-notes-mode active" data-mode="preview" title="Aperçu">
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
                ${this.#parseMarkdown(entry.data?.content || '')}
              </div>
              <pre class="vault-notes-source" data-mode="source" hidden>${this.#escapeHtml(entry.data?.content || '')}</pre>
            </div>
          </div>
        `;
      case 'card':
        return `
          ${this.#renderField('Titulaire', entry.data?.holder)}
          ${this.#renderField('Numéro', entry.data?.number, 'number', true, true)}
          ${this.#renderField('Expiration', entry.data?.expiry)}
          ${this.#renderField('CVV', entry.data?.cvv, 'cvv', true, true)}
        `;
      case 'identity':
        return `
          ${this.#renderField('Nom complet', entry.data?.fullName)}
          ${this.#renderField('Email', entry.data?.email, 'email', false, true)}
          ${this.#renderField('Téléphone', entry.data?.phone, 'phone', false, true)}
        `;
      default:
        return '';
    }
  }

  #renderField(label, value, key = '', masked = false, copyable = false, isUrl = false) {
    if (!value) return '';

    // Dynamic masking based on actual value length
    const maskedValue = masked ? '•'.repeat(Math.min(value.length, 24)) : this.#escapeHtml(value);
    const strengthHtml = key === 'password' ? this.#renderPasswordStrength(value) : '';
    const breachHtml = key === 'password' ? '<div class="vault-breach-indicator" id="password-breach-indicator"></div>' : '';

    return `
      <div class="vault-field" data-key="${key}" data-masked="${masked}">
        <div class="vault-field-label-row">
          <label class="vault-field-label">${label}</label>
          ${masked ? '<span class="vault-field-hint">(survoler pour révéler)</span>' : ''}
          ${breachHtml}
        </div>
        <div class="vault-field-value ${masked ? 'vault-reveal-on-hover' : ''}" data-real-value="${this.#escapeHtml(value)}">
          <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${this.#escapeHtml(value)}">
            ${isUrl ? `<a href="${this.#escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${this.#escapeHtml(value)}</a>` : maskedValue}
          </span>
          <span class="vault-field-revealed">${this.#escapeHtml(value)}</span>
          <div class="vault-field-actions">
            ${masked ? `
              <button class="vault-field-btn toggle-visibility" title="Afficher/Masquer" aria-label="Afficher ou masquer la valeur" aria-pressed="false">
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
              <button class="vault-field-btn copy-field" data-value="${this.#escapeHtml(value)}" title="Copier" aria-label="Copier ${label}">
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
    const formattedDate = expiresDate.toLocaleDateString('fr-FR', {
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
          <label class="vault-field-label">Expiration du mot de passe</label>
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
          <label class="vault-field-label">Notes</label>
          <div class="vault-notes-toggle">
            <button type="button" class="vault-notes-mode active" data-mode="preview" title="Aperçu">
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
          <pre class="vault-notes-source" data-mode="source" hidden>${this.#escapeHtml(notes)}</pre>
        </div>
      </div>
    `;
  }

  #parseMarkdown(text) {
    if (!text) return '';

    let html = this.#escapeHtml(text);

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
          <div class="vault-totp-code" data-secret="${this.#escapeHtml(totpSecret)}">
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
          <button class="vault-field-btn show-totp-qr" data-secret="${this.#escapeHtml(totpSecret)}" data-title="${this.#escapeHtml(entry.title)}" data-account="${this.#escapeHtml(entry.data?.username || '')}" title="Afficher QR Code" aria-label="Afficher QR Code">
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
          if (digitsEl) digitsEl.textContent = 'Erreur';
        }
      }
    };

    // Initial update
    updateTOTP();

    // Update every second
    this.#totpTimer = setInterval(updateTOTP, 1000);
  }

  async #generateTOTP(secret, options = {}) {
    const { period = 30, digits = 6, timestamp = Date.now() } = options;

    // Base32 decode
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = '';
    for (const char of cleanedInput) {
      const idx = alphabet.indexOf(char);
      if (idx !== -1) bits += idx.toString(2).padStart(5, '0');
    }
    const keyBytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    const key = new Uint8Array(keyBytes);

    // Counter
    const timeStep = Math.floor(timestamp / 1000 / period);
    const counter = new Uint8Array(8);
    let temp = timeStep;
    for (let i = 7; i >= 0; i--) {
      counter[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    // HMAC-SHA1
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counter);
    const hmac = new Uint8Array(signature);

    // Dynamic truncation
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    const code = otp.toString().padStart(digits, '0');
    const elapsed = (timestamp / 1000) % period;
    const remaining = Math.ceil(period - elapsed);

    return { code, remaining, period };
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
      period: parseInt(params.get('period')) || 30,
      digits: parseInt(params.get('digits')) || 6
    };
  }

  #renderPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    return `
      <div class="vault-password-strength">
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}" style="width: ${strength.percent}%"></div>
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
            <span class="vault-history-password" title="Cliquer pour révéler">${maskedPwd}</span>
            <span class="vault-history-date">${relativeTime}</span>
            ${h.reason ? `<span class="vault-history-reason">${this.#escapeHtml(h.reason)}</span>` : ''}
          </div>
          <div class="vault-history-actions">
            <button class="vault-field-btn copy-history-pwd" data-password="${this.#escapeHtml(h.password)}" title="Copier">
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

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  }

  #renderPasswordAge(entry) {
    // Only show for login entries with passwords
    if (entry.type !== 'login' || !entry.data?.password) return '';

    const modifiedAt = new Date(entry.modifiedAt);
    const now = new Date();
    const daysSinceModified = Math.floor((now - modifiedAt) / (1000 * 60 * 60 * 24));

    let ageClass = 'good';
    let ageLabel = 'Récent';
    let ageIcon = 'check';

    if (daysSinceModified > 365) {
      ageClass = 'critical';
      ageLabel = `${Math.floor(daysSinceModified / 365)} an(s) - Renouvellement conseillé`;
      ageIcon = 'alert';
    } else if (daysSinceModified > 180) {
      ageClass = 'warning';
      ageLabel = `${Math.floor(daysSinceModified / 30)} mois`;
      ageIcon = 'clock';
    } else if (daysSinceModified > 90) {
      ageClass = 'fair';
      ageLabel = `${Math.floor(daysSinceModified / 30)} mois`;
      ageIcon = 'clock';
    } else if (daysSinceModified > 30) {
      ageLabel = `${Math.floor(daysSinceModified / 30)} mois`;
    } else {
      ageLabel = daysSinceModified === 0 ? "Aujourd'hui" : `${daysSinceModified} jour(s)`;
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
          <span class="vault-age-label">Âge du mot de passe</span>
          <span class="vault-age-value">${ageLabel}</span>
        </div>
      </div>
    `;
  }

  #renderEmptyState() {
    if (this.#searchQuery) {
      return `
        <div class="vault-empty-state">
          <div class="vault-empty-illustration" aria-hidden="true">
            <svg viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="50" cy="45" r="28" stroke-dasharray="4 2" opacity="0.3"/>
              <circle cx="50" cy="45" r="20"/>
              <line x1="64" y1="59" x2="85" y2="80" stroke-width="3" stroke-linecap="round"/>
              <path d="M45 42 L50 48 L58 38" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
            </svg>
          </div>
          <h3 class="vault-empty-title">Aucun résultat</h3>
          <p class="vault-empty-text">Aucune entrée ne correspond à "<strong>${this.#escapeHtml(this.#searchQuery)}</strong>"</p>
          <div class="vault-empty-actions">
            <button class="vault-btn vault-btn-secondary" id="btn-clear-search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Effacer la recherche
            </button>
          </div>
          <div class="vault-empty-tips">
            <span class="vault-empty-tip">Essayez des termes plus courts ou vérifiez l'orthographe</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="vault-empty-state">
        <div class="vault-empty-illustration" aria-hidden="true">
          <svg viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="25" y="30" width="70" height="50" rx="4" stroke-dasharray="4 2" opacity="0.3"/>
            <rect x="35" y="25" width="50" height="40" rx="3"/>
            <circle cx="60" cy="45" r="8"/>
            <line x1="60" y1="50" x2="60" y2="55" stroke-width="2" stroke-linecap="round"/>
            <path d="M45 70 L60 60 L75 70" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
          </svg>
        </div>
        <h3 class="vault-empty-title">Votre coffre est vide</h3>
        <p class="vault-empty-text">Commencez à sécuriser vos mots de passe dès maintenant</p>
        <div class="vault-empty-actions">
          <button class="vault-btn vault-btn-primary" id="btn-add-first-entry">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Ajouter une entrée
          </button>
          <button class="vault-btn vault-btn-secondary" id="btn-import-first">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Importer depuis un fichier
          </button>
        </div>
        <div class="vault-empty-tips">
          <span class="vault-empty-tip">Utilisez <kbd>Ctrl</kbd>+<kbd>N</kbd> pour ajouter rapidement</span>
        </div>
      </div>
    `;
  }

  #renderNoSelection() {
    return `
      <div class="vault-detail-placeholder">
        <div class="vault-detail-placeholder-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <p>Sélectionnez une entrée pour voir les détails</p>
        <div class="vault-shortcut-hints">
          <div class="vault-shortcut-hint">
            <kbd>↑</kbd><kbd>↓</kbd> Naviguer
          </div>
          <div class="vault-shortcut-hint">
            <kbd>Ctrl</kbd>+<kbd>N</kbd> Nouvelle entrée
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render skeleton loading placeholders for entries
   * @param {number} count - Number of skeleton items
   */
  #renderEntrySkeleton(count = 5) {
    return `
      <div class="vault-skeleton-list" aria-hidden="true" role="status" aria-label="Chargement des entrées">
        ${Array(count).fill('').map(() => `
          <div class="vault-skeleton-entry">
            <div class="vault-skeleton vault-skeleton-icon"></div>
            <div class="vault-skeleton-content">
              <div class="vault-skeleton vault-skeleton-title"></div>
              <div class="vault-skeleton vault-skeleton-subtitle"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render skeleton loading for detail panel
   */
  #renderDetailSkeleton() {
    return `
      <div class="vault-skeleton-detail" aria-hidden="true" role="status" aria-label="Chargement des détails">
        <div class="vault-skeleton-detail-header">
          <div class="vault-skeleton vault-skeleton-icon-lg"></div>
          <div class="vault-skeleton-info">
            <div class="vault-skeleton vault-skeleton-title-lg"></div>
            <div class="vault-skeleton vault-skeleton-badge"></div>
          </div>
        </div>
        <div class="vault-skeleton-detail-body">
          <div class="vault-skeleton-field">
            <div class="vault-skeleton vault-skeleton-label"></div>
            <div class="vault-skeleton vault-skeleton-input"></div>
          </div>
          <div class="vault-skeleton-field">
            <div class="vault-skeleton vault-skeleton-label"></div>
            <div class="vault-skeleton vault-skeleton-input"></div>
          </div>
          <div class="vault-skeleton-field">
            <div class="vault-skeleton vault-skeleton-label"></div>
            <div class="vault-skeleton vault-skeleton-input"></div>
          </div>
        </div>
      </div>
    `;
  }

  #renderAddEntryModal() {
    return `
      <div class="vault-modal-overlay" id="add-entry-modal" role="dialog" aria-modal="true" aria-labelledby="add-entry-title">
        <div class="vault-modal vault-modal-lg">
          <div class="vault-modal-header">
            <h3 id="add-entry-title">Nouvelle entrée</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="add-entry-form">
            <!-- Template Selector -->
            <div class="vault-template-section">
              <button type="button" class="vault-template-toggle" id="toggle-templates" aria-expanded="false">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Utiliser un template
                <svg class="vault-template-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <div class="vault-template-picker" id="template-picker" hidden>
                <input type="text" class="vault-input vault-template-search" id="template-search" placeholder="Rechercher un template...">
                <div class="vault-template-grid" id="template-grid">
                  ${this.#renderTemplateGrid()}
                </div>
              </div>
            </div>

            <div class="vault-type-selector" role="radiogroup" aria-label="Type d'entrée">
              ${Object.entries(ENTRY_TYPES).filter(([k]) => k !== 'preset' && k !== 'ssh').map(([key, type]) => `
                <label class="vault-type-option">
                  <input type="radio" name="entry-type" value="${key}" ${key === 'login' ? 'checked' : ''}>
                  <span class="vault-type-card" style="--type-color: ${type.color}">
                    <span class="vault-type-icon">${type.icon}</span>
                    <span class="vault-type-label">${type.label}</span>
                  </span>
                </label>
              `).join('')}
            </div>

            <div class="vault-form-group">
              <label class="vault-label" for="entry-title">Titre <span class="required" aria-label="obligatoire">*</span></label>
              <input type="text" class="vault-input" id="entry-title" placeholder="Ex: Gmail, Amazon..." required aria-describedby="entry-title-message">
              <div class="vault-field-message" id="entry-title-message" role="alert" aria-live="polite"></div>
            </div>

            <div class="vault-form-group">
              <label class="vault-label" for="entry-folder">Dossier</label>
              <select class="vault-input vault-select" id="entry-folder">
                <option value="">Aucun dossier</option>
                ${this.#folders.map(f => `<option value="${f.id}">${this.#escapeHtml(f.name)}</option>`).join('')}
              </select>
            </div>

            <div class="vault-form-group">
              <label class="vault-label">Tags</label>
              ${this.#renderTagPicker([])}
            </div>

            <div id="entry-type-fields"></div>

            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Ajouter</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #renderTemplateGrid() {
    const categories = [
      { id: 'social', name: 'Réseaux sociaux', icon: '👥' },
      { id: 'email', name: 'Email', icon: '📧' },
      { id: 'shopping', name: 'Shopping', icon: '🛒' },
      { id: 'finance', name: 'Finance', icon: '💰' },
      { id: 'streaming', name: 'Streaming', icon: '🎬' },
      { id: 'gaming', name: 'Jeux', icon: '🎮' },
      { id: 'dev', name: 'Dev / Travail', icon: '💻' },
      { id: 'other', name: 'Autre', icon: '📁' }
    ];

    const templates = this.#getTemplates();

    return categories.map(cat => {
      const catTemplates = templates.filter(t => t.category === cat.id);
      if (catTemplates.length === 0) return '';

      return `
        <div class="vault-template-category">
          <div class="vault-template-category-header">${cat.icon} ${cat.name}</div>
          <div class="vault-template-items">
            ${catTemplates.map(t => `
              <button type="button" class="vault-template-item" data-template-id="${t.id}" title="${t.name}">
                <span class="vault-template-icon">${t.icon}</span>
                <span class="vault-template-name">${t.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  #getTemplates() {
    return [
      // Social
      { id: 'google', name: 'Google', icon: '🔵', category: 'social', type: 'login', url: 'https://accounts.google.com', suggestTotp: true },
      { id: 'facebook', name: 'Facebook', icon: '📘', category: 'social', type: 'login', url: 'https://www.facebook.com', suggestTotp: true },
      { id: 'instagram', name: 'Instagram', icon: '📷', category: 'social', type: 'login', url: 'https://www.instagram.com', suggestTotp: true },
      { id: 'twitter', name: 'X (Twitter)', icon: '🐦', category: 'social', type: 'login', url: 'https://twitter.com', suggestTotp: true },
      { id: 'linkedin', name: 'LinkedIn', icon: '💼', category: 'social', type: 'login', url: 'https://www.linkedin.com', suggestTotp: true },
      { id: 'discord', name: 'Discord', icon: '🎮', category: 'social', type: 'login', url: 'https://discord.com', suggestTotp: true },
      { id: 'reddit', name: 'Reddit', icon: '🟠', category: 'social', type: 'login', url: 'https://www.reddit.com', suggestTotp: true },
      // Email
      { id: 'outlook', name: 'Outlook', icon: '📧', category: 'email', type: 'login', url: 'https://outlook.live.com', suggestTotp: true },
      { id: 'protonmail', name: 'ProtonMail', icon: '🔒', category: 'email', type: 'login', url: 'https://mail.proton.me', suggestTotp: true },
      // Shopping
      { id: 'amazon', name: 'Amazon', icon: '📦', category: 'shopping', type: 'login', url: 'https://www.amazon.fr', suggestTotp: true },
      { id: 'ebay', name: 'eBay', icon: '🛒', category: 'shopping', type: 'login', url: 'https://www.ebay.fr', suggestTotp: false },
      // Finance
      { id: 'paypal', name: 'PayPal', icon: '💰', category: 'finance', type: 'login', url: 'https://www.paypal.com', suggestTotp: true },
      { id: 'bank', name: 'Banque', icon: '🏦', category: 'finance', type: 'login', url: '', suggestTotp: true },
      { id: 'card', name: 'Carte bancaire', icon: '💳', category: 'finance', type: 'card', url: '', suggestTotp: false },
      // Streaming
      { id: 'netflix', name: 'Netflix', icon: '🎬', category: 'streaming', type: 'login', url: 'https://www.netflix.com', suggestTotp: false },
      { id: 'spotify', name: 'Spotify', icon: '🎧', category: 'streaming', type: 'login', url: 'https://www.spotify.com', suggestTotp: false },
      { id: 'disney', name: 'Disney+', icon: '🏰', category: 'streaming', type: 'login', url: 'https://www.disneyplus.com', suggestTotp: false },
      { id: 'twitch', name: 'Twitch', icon: '🟣', category: 'streaming', type: 'login', url: 'https://www.twitch.tv', suggestTotp: true },
      // Gaming
      { id: 'steam', name: 'Steam', icon: '🎮', category: 'gaming', type: 'login', url: 'https://store.steampowered.com', suggestTotp: true },
      { id: 'epic', name: 'Epic Games', icon: '🎯', category: 'gaming', type: 'login', url: 'https://www.epicgames.com', suggestTotp: true },
      { id: 'playstation', name: 'PlayStation', icon: '🎮', category: 'gaming', type: 'login', url: 'https://www.playstation.com', suggestTotp: true },
      // Dev
      { id: 'github', name: 'GitHub', icon: '🐙', category: 'dev', type: 'login', url: 'https://github.com', suggestTotp: true },
      { id: 'gitlab', name: 'GitLab', icon: '🦊', category: 'dev', type: 'login', url: 'https://gitlab.com', suggestTotp: true },
      { id: 'aws', name: 'AWS', icon: '☁️', category: 'dev', type: 'login', url: 'https://aws.amazon.com', suggestTotp: true },
      { id: 'slack', name: 'Slack', icon: '💬', category: 'dev', type: 'login', url: 'https://slack.com', suggestTotp: true },
      // Other
      { id: 'wifi', name: 'WiFi', icon: '📶', category: 'other', type: 'login', url: '', suggestTotp: false },
      { id: 'identity', name: 'Identité', icon: '🪪', category: 'other', type: 'identity', url: '', suggestTotp: false },
      { id: 'custom', name: 'Personnalisé', icon: '✏️', category: 'other', type: 'login', url: '', suggestTotp: false }
    ];
  }

  #applyTemplate(templateId) {
    const template = this.#getTemplates().find(t => t.id === templateId);
    if (!template) return;

    // Set entry type
    const typeRadio = document.querySelector(`input[name="entry-type"][value="${template.type}"]`);
    if (typeRadio) {
      typeRadio.checked = true;
      this.#updateEntryTypeFields();
    }

    // Set title
    const titleInput = document.getElementById('entry-title');
    if (titleInput && template.name !== 'Personnalisé') {
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
          totpField.placeholder = 'Recommandé pour ce service';
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

    this.#showToast(`Template "${template.name}" appliqué`, 'success');
  }

  // ==================== TAGS SYSTEM ====================

  #renderTagsList() {
    if (this.#tags.length === 0) {
      return '<div class="vault-nav-empty">Aucun tag</div>';
    }

    return this.#tags.map(tag => {
      const tagColor = tag.color || '#6b7280';
      const count = this.#entries.filter(e => e.tags?.includes(tag.id)).length;
      return `
        <button class="vault-nav-item vault-tag-item ${this.#selectedTag === tag.id ? 'active' : ''}"
                data-tag="${tag.id}"
                aria-current="${this.#selectedTag === tag.id ? 'true' : 'false'}">
          <span class="vault-tag-dot" style="background: ${tagColor}" aria-hidden="true"></span>
          <span class="vault-nav-label">${this.#escapeHtml(tag.name)}</span>
          <span class="vault-nav-count">${count}</span>
          <button class="vault-tag-edit-btn" data-edit-tag="${tag.id}" title="Modifier le tag" aria-label="Modifier ${this.#escapeHtml(tag.name)}">
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
          ${this.#tags.length === 0 ? '<div class="vault-tag-empty">Aucun tag disponible</div>' :
            this.#tags.map(tag => `
              <label class="vault-tag-option ${selectedTags.includes(tag.id) ? 'selected' : ''}">
                <input type="checkbox" name="entry-tags" value="${tag.id}" ${selectedTags.includes(tag.id) ? 'checked' : ''}>
                <span class="vault-tag-chip" style="--tag-color: ${tag.color || '#6b7280'}">
                  ${this.#escapeHtml(tag.name)}
                </span>
              </label>
            `).join('')
          }
        </div>
        <div class="vault-tag-picker-add">
          <input type="text" class="vault-input vault-input-sm" id="new-tag-name" placeholder="Nouveau tag...">
          <div class="vault-tag-color-picker" id="tag-color-picker">
            ${tagColors.map((color, i) => `
              <button type="button" class="vault-color-btn ${i === 0 ? 'selected' : ''}"
                      data-color="${color}" style="background: ${color}"
                      title="Couleur ${i + 1}" aria-label="Couleur ${color}"></button>
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
          <span class="vault-mini-tag" style="--tag-color: ${tag.color || '#6b7280'}" title="${this.#escapeHtml(tag.name)}">
            ${this.#escapeHtml(tag.name)}
          </span>
        `).join('')}
        ${entryTags.length > 3 ? `<span class="vault-mini-tag vault-more-tags">+${entryTags.length - 3}</span>` : ''}
      </div>
    `;
  }

  #renderTagsInDetail(entry) {
    if (!entry.tags || entry.tags.length === 0) {
      return '<span class="vault-no-tags">Aucun tag</span>';
    }

    const entryTags = this.#tags.filter(t => entry.tags.includes(t.id));
    return entryTags.map(tag => `
      <span class="vault-detail-tag" style="--tag-color: ${tag.color || '#6b7280'}">
        ${this.#escapeHtml(tag.name)}
      </span>
    `).join('');
  }

  #renderAddTagModal() {
    const tagColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

    return `
      <div class="vault-modal-overlay" id="add-tag-modal" role="dialog" aria-modal="true" aria-labelledby="add-tag-title">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="add-tag-title">Nouveau tag</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="add-tag-form">
            <div class="vault-form-group">
              <label class="vault-label" for="tag-name">Nom du tag <span class="required">*</span></label>
              <input type="text" class="vault-input" id="tag-name" placeholder="Ex: Important, À vérifier..." required maxlength="30">
            </div>
            <div class="vault-form-group">
              <label class="vault-label">Couleur</label>
              <div class="vault-color-grid" id="add-tag-colors">
                ${tagColors.map((color, i) => `
                  <button type="button" class="vault-color-option ${i === 0 ? 'selected' : ''}"
                          data-color="${color}" style="background: ${color}">
                    ${i === 0 ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                  </button>
                `).join('')}
              </div>
              <input type="hidden" id="tag-color" value="${tagColors[0]}">
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Créer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #renderEditTagModal() {
    const tagColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

    return `
      <div class="vault-modal-overlay" id="edit-tag-modal" role="dialog" aria-modal="true" aria-labelledby="edit-tag-title">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="edit-tag-title">Modifier le tag</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="edit-tag-form">
            <input type="hidden" id="edit-tag-id">
            <div class="vault-form-group">
              <label class="vault-label" for="edit-tag-name">Nom du tag <span class="required">*</span></label>
              <input type="text" class="vault-input" id="edit-tag-name" required maxlength="30">
            </div>
            <div class="vault-form-group">
              <label class="vault-label">Couleur</label>
              <div class="vault-color-grid" id="edit-tag-colors">
                ${tagColors.map(color => `
                  <button type="button" class="vault-color-option" data-color="${color}" style="background: ${color}"></button>
                `).join('')}
              </div>
              <input type="hidden" id="edit-tag-color">
            </div>
            <div class="vault-modal-actions vault-modal-actions-split">
              <button type="button" class="vault-btn vault-btn-danger" id="btn-delete-tag">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Supprimer
              </button>
              <div class="vault-modal-actions-right">
                <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
                <button type="submit" class="vault-btn vault-btn-primary">Enregistrer</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  async #createTag(name, color) {
    try {
      await window.vault.tags.add({ name: name.trim(), color });
      await this.#loadData();
      this.#showToast(`Tag "${name}" créé`, 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || 'Erreur de création', 'error');
      return false;
    }
  }

  async #updateTag(tagId, name, color) {
    try {
      await window.vault.tags.update(tagId, { name: name.trim(), color });
      await this.#loadData();
      this.#showToast('Tag modifié', 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || 'Erreur de modification', 'error');
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
      this.#showToast('Tag supprimé', 'success');
      return true;
    } catch (error) {
      this.#showToast(error.message || 'Erreur de suppression', 'error');
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
          <h3>Gérer les tags (${count} entrée${count > 1 ? 's' : ''})</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vault-modal-body">
          ${this.#tags.length === 0 ? `
            <p class="vault-modal-empty">Aucun tag disponible. Créez un tag depuis la barre latérale.</p>
          ` : `
            <p class="vault-modal-hint">Cochez pour ajouter, décochez pour retirer</p>
            <div class="vault-bulk-tag-list">
              ${tagStates.map(tag => `
                <label class="vault-bulk-tag-item">
                  <input type="checkbox" class="vault-checkbox"
                         data-tag-id="${tag.id}"
                         ${tag.state === 'all' ? 'checked' : ''}
                         ${tag.state === 'partial' ? 'data-indeterminate="true"' : ''}>
                  <span class="vault-checkbox-mark ${tag.state === 'partial' ? 'partial' : ''}"></span>
                  <span class="vault-bulk-tag-dot" style="background: ${tag.color || '#6b7280'}"></span>
                  <span class="vault-bulk-tag-name">${this.#escapeHtml(tag.name)}</span>
                  <span class="vault-bulk-tag-count">${tag.count}/${count}</span>
                </label>
              `).join('')}
            </div>
          `}
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
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
      this.#showToast(`Tags mis à jour sur ${updated} entrée${updated > 1 ? 's' : ''}`, 'success');
    }
  }

  #renderAddFolderModal() {
    return `
      <div class="vault-modal-overlay" id="add-folder-modal" role="dialog" aria-modal="true" aria-labelledby="add-folder-title">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="add-folder-title">Nouveau dossier</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="add-folder-form">
            <div class="vault-form-group">
              <label class="vault-label" for="folder-name">Nom du dossier <span class="required">*</span></label>
              <input type="text" class="vault-input" id="folder-name" placeholder="Ex: Travail, Personnel..." required>
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Créer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #renderEditEntryModal() {
    return `
      <div class="vault-modal-overlay" id="edit-entry-modal" role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
        <div class="vault-modal vault-modal-lg">
          <div class="vault-modal-header">
            <h3 id="edit-entry-title">Modifier l'entrée</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="edit-entry-form">
            <div id="edit-entry-fields"></div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #renderShortcutsModal() {
    return `
      <div class="vault-modal-overlay" id="shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <div class="vault-modal vault-modal-shortcuts">
          <div class="vault-modal-header">
            <h3 id="shortcuts-title">Raccourcis clavier</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body vault-shortcuts-body">
            <div class="vault-shortcuts-section">
              <h4>Navigation</h4>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>↑</kbd> <kbd>↓</kbd></span>
                <span class="vault-shortcut-desc">Naviguer dans la liste</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Enter</kbd></span>
                <span class="vault-shortcut-desc">Sélectionner l'entrée</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>F</kbd></span>
                <span class="vault-shortcut-desc">Rechercher</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Esc</kbd></span>
                <span class="vault-shortcut-desc">Fermer la modale / Désélectionner</span>
              </div>
            </div>
            <div class="vault-shortcuts-section">
              <h4>Actions</h4>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
                <span class="vault-shortcut-desc">Nouvelle entrée</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>E</kbd></span>
                <span class="vault-shortcut-desc">Modifier l'entrée</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>D</kbd></span>
                <span class="vault-shortcut-desc">Dupliquer l'entrée</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Delete</kbd></span>
                <span class="vault-shortcut-desc">Supprimer l'entrée</span>
              </div>
            </div>
            <div class="vault-shortcuts-section">
              <h4>Copie rapide</h4>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>U</kbd></span>
                <span class="vault-shortcut-desc">Copier l'identifiant</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>P</kbd></span>
                <span class="vault-shortcut-desc">Copier le mot de passe</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>L</kbd></span>
                <span class="vault-shortcut-desc">Verrouiller le coffre</span>
              </div>
              <div class="vault-shortcut-row">
                <span class="vault-shortcut-keys"><kbd>?</kbd></span>
                <span class="vault-shortcut-desc">Afficher cette aide</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open health dashboard modal with fresh stats
   * Re-binds event listeners after re-rendering
   */
  #openHealthDashboard() {
    // Re-render to get fresh stats
    const healthModal = document.getElementById('health-modal');
    if (healthModal) {
      healthModal.outerHTML = this.#renderHealthDashboardModal();
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
    }
  }

  #renderHealthDashboardModal() {
    const stats = this.#calculateHealthStats();

    return `
      <div class="vault-modal-overlay" id="health-modal" role="dialog" aria-modal="true" aria-labelledby="health-title">
        <div class="vault-modal vault-modal-health">
          <div class="vault-modal-header">
            <h3 id="health-title">Santé des mots de passe</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body">
            <div class="vault-health-score">
              <div class="vault-health-circle ${stats.scoreClass}">
                <span class="vault-health-value">${stats.score}</span>
                <span class="vault-health-label">/ 100</span>
              </div>
              <div class="vault-health-status">${stats.status}</div>
            </div>

            <div class="vault-health-grid">
              <div class="vault-health-card vault-health-total">
                <div class="vault-health-card-value">${stats.total}</div>
                <div class="vault-health-card-label">Total des identifiants</div>
              </div>
              <div class="vault-health-card vault-health-strong">
                <div class="vault-health-card-value">${stats.strong}</div>
                <div class="vault-health-card-label">Mots de passe forts</div>
              </div>
              <div class="vault-health-card vault-health-weak">
                <div class="vault-health-card-value">${stats.weak}</div>
                <div class="vault-health-card-label">Mots de passe faibles</div>
              </div>
              <div class="vault-health-card vault-health-reused">
                <div class="vault-health-card-value">${stats.reused}</div>
                <div class="vault-health-card-label">Mots de passe réutilisés</div>
              </div>
              <div class="vault-health-card vault-health-old">
                <div class="vault-health-card-value">${stats.old}</div>
                <div class="vault-health-card-label">Anciens (&gt; 6 mois)</div>
              </div>
              <div class="vault-health-card vault-health-expiring">
                <div class="vault-health-card-value">${stats.expiring}</div>
                <div class="vault-health-card-label">Expirent bientôt</div>
              </div>
              <div class="vault-health-card vault-health-expired">
                <div class="vault-health-card-value">${stats.expired}</div>
                <div class="vault-health-card-label">Expirés</div>
              </div>
            </div>

            ${stats.issues.length > 0 ? `
              <div class="vault-health-issues">
                <h4>Problèmes à corriger</h4>
                <ul class="vault-health-issue-list" role="list">
                  ${stats.issues.map(issue => `
                    <li class="vault-health-issue ${issue.severity}" role="listitem">
                      <span class="vault-health-issue-icon" role="img" aria-label="${issue.iconLabel}"><span aria-hidden="true">${issue.icon}</span></span>
                      <span class="vault-health-issue-text">${issue.message}</span>
                      ${issue.count ? `<span class="vault-health-issue-count" aria-label="${issue.count} éléments">${issue.count}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : `
              <div class="vault-health-success">
                <span class="vault-health-success-icon" role="img" aria-label="Félicitations"><span aria-hidden="true">🎉</span></span>
                <span>Excellent ! Tous vos mots de passe sont sécurisés.</span>
              </div>
            `}

            <div class="vault-health-actions">
              <button class="vault-btn vault-btn-outline" id="btn-check-breaches">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Vérifier les fuites (HIBP)
              </button>
            </div>

            <div class="vault-health-breaches" id="breach-results" hidden>
              <h4>Résultats de la vérification</h4>
              <div class="vault-breach-loading" id="breach-loading">
                <span class="vault-spinner-small"></span>
                Vérification en cours...
              </div>
              <div class="vault-breach-results" id="breach-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #calculateHealthStats() {
    const logins = this.#entries.filter(e => e.type === 'login' && e.data?.password);
    const total = logins.length;

    if (total === 0) {
      return {
        score: 100,
        scoreClass: 'excellent',
        status: 'Aucun identifiant',
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
    let strong = 0, medium = 0, weak = 0;
    logins.forEach(entry => {
      const strength = this.#getPasswordStrength(entry.data.password);
      if (strength === 'strong') strong++;
      else if (strength === 'medium') medium++;
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
      status = 'Excellent';
      scoreClass = 'excellent';
    } else if (score >= 70) {
      status = 'Bon';
      scoreClass = 'good';
    } else if (score >= 50) {
      status = 'À améliorer';
      scoreClass = 'medium';
    } else {
      status = 'Critique';
      scoreClass = 'poor';
    }

    // Build issues list
    const issues = [];
    if (weak > 0) {
      issues.push({
        severity: 'high',
        icon: '⚠️',
        iconLabel: 'Attention',
        message: `${weak} mot(s) de passe faible(s) à renforcer`,
        count: weak
      });
    }
    if (reused > 0) {
      issues.push({
        severity: 'high',
        icon: '🔁',
        iconLabel: 'Réutilisé',
        message: `${reused} mot(s) de passe réutilisé(s)`,
        count: reused
      });
    }
    if (expired > 0) {
      issues.push({
        severity: 'high',
        icon: '⚠️',
        iconLabel: 'Expiré',
        message: `${expired} mot(s) de passe expiré(s)`,
        count: expired
      });
    }
    if (expiring > 0) {
      issues.push({
        severity: 'medium',
        icon: '⏰',
        iconLabel: 'Expire bientôt',
        message: `${expiring} mot(s) de passe bientôt expiré(s)`,
        count: expiring
      });
    }
    if (old > 0) {
      issues.push({
        severity: 'low',
        icon: '📅',
        iconLabel: 'Ancien',
        message: `${old} mot(s) de passe ancien(s) (> 6 mois)`,
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
      btn.innerHTML = '<span class="vault-spinner-small"></span> Vérification...';
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
        console.warn(`[VaultUI] Breach check error for ${entry.id}:`, err);
      }

      checked++;

      if (!silent && loadingDiv) {
        loadingDiv.innerHTML = `<span class="vault-spinner-small"></span> Vérification ${checked}/${logins.length}...`;
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
        this.#showToast(`⚠️ ${compromised.length} mot(s) de passe compromis détecté(s)`, 'warning', 5000);
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
      Vérifier les fuites (HIBP)
    `;

    if (compromised.length === 0) {
      listDiv.innerHTML = `
        <div class="vault-breach-safe">
          <span class="vault-breach-icon">✅</span>
          <span>Aucun mot de passe compromis trouvé sur ${logins.length} vérifié(s)</span>
        </div>
      `;
    } else {
      listDiv.innerHTML = `
        <div class="vault-breach-warning">
          <span class="vault-breach-icon">🚨</span>
          <span>${compromised.length} mot(s) de passe compromis sur ${logins.length}</span>
        </div>
        <ul class="vault-breach-list">
          ${compromised.map(({ entry, count }) => `
            <li class="vault-breach-item" data-entry-id="${entry.id}">
              <span class="vault-breach-title">${this.#escapeHtml(entry.title)}</span>
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

  #showTOTPQRModal(secret, issuer, account) {
    // Build otpauth URI
    const label = issuer
      ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account || 'user')}`
      : encodeURIComponent(account || 'user');
    const uri = `otpauth://totp/${label}?secret=${secret.toUpperCase().replace(/\s/g, '')}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Generate QR code SVG
    const qrSvg = this.#generateQRCode(uri);

    // Create modal
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
          <h3>QR Code TOTP</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
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
            <div class="vault-qr-label">${this.#escapeHtml(issuer)}</div>
            <div class="vault-qr-account">${this.#escapeHtml(account || 'user')}</div>
          </div>
          <p class="vault-qr-hint">Scannez avec votre application d'authentification (Google Authenticator, Authy, etc.)</p>
        </div>
      </div>
    `;

    // Bind close events
    modal.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.#closeModal('totp-qr-modal');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.#closeModal('totp-qr-modal');
    });

    this.#openModal('totp-qr-modal');
  }

  #generateQRCode(data) {
    // Simple QR code generation using SVG
    // Calculate version based on data length
    const dataLen = data.length;
    let version = 2;
    if (dataLen > 47) version = 3;
    if (dataLen > 77) version = 4;
    if (dataLen > 114) version = 5;
    if (dataLen > 154) version = 6;

    const modules = 17 + version * 4;
    const size = 200;
    const margin = 4;
    const totalSize = modules + margin * 2;
    const scale = size / totalSize;

    // Generate pattern from data
    let binary = '';
    for (const char of data) {
      binary += char.charCodeAt(0).toString(2).padStart(8, '0');
    }
    while (binary.length < modules * modules * 2) {
      binary += binary;
    }

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" class="vault-qr-svg">`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;

    // Finder patterns
    const drawFinder = (x, y) => {
      svg += `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/>`;
      svg += `<rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/>`;
      svg += `<rect x="${x+2}" y="${y+2}" width="3" height="3" fill="#000"/>`;
    };

    drawFinder(margin, margin);
    drawFinder(margin + modules - 7, margin);
    drawFinder(margin, margin + modules - 7);

    // Timing patterns
    for (let i = 8; i < modules - 8; i++) {
      if (i % 2 === 0) {
        svg += `<rect x="${margin + i}" y="${margin + 6}" width="1" height="1" fill="#000"/>`;
        svg += `<rect x="${margin + 6}" y="${margin + i}" width="1" height="1" fill="#000"/>`;
      }
    }

    // Data modules
    const isReserved = (x, y) => {
      if (x < 9 && y < 9) return true;
      if (x >= modules - 8 && y < 9) return true;
      if (x < 9 && y >= modules - 8) return true;
      if (x === 6 || y === 6) return true;
      return false;
    };

    let bitIdx = 0;
    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        if (!isReserved(x, y) && binary[bitIdx % binary.length] === '1') {
          svg += `<rect x="${margin + x}" y="${margin + y}" width="1" height="1" fill="#000"/>`;
        }
        if (!isReserved(x, y)) bitIdx++;
      }
    }

    svg += '</svg>';
    return svg;
  }

  #renderMoveFolderModal() {
    return `
      <div class="vault-modal-overlay" id="move-folder-modal" role="dialog" aria-modal="true" aria-labelledby="move-folder-title">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 id="move-folder-title">Déplacer vers un dossier</h3>
            <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="vault-modal-body vault-folder-list">
            <button class="vault-folder-option" data-folder-id="">
              <span class="vault-folder-icon">📁</span>
              <span class="vault-folder-name">Aucun dossier (racine)</span>
            </button>
            ${this.#folders.map(f => `
              <button class="vault-folder-option" data-folder-id="${f.id}">
                <span class="vault-folder-icon">📂</span>
                <span class="vault-folder-name">${this.#escapeHtml(f.name)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  #exportEntries(entries) {
    if (entries.length === 0) {
      this.#showToast('Aucune entrée à exporter', 'warning');
      return;
    }

    // Store entries for export and show format selection modal
    this.#pendingExportEntries = entries;
    this.#showExportFormatModal();
  }

  #showExportFormatModal() {
    // Create modal if not exists
    let modal = document.getElementById('export-format-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'export-format-modal';
      modal.className = 'vault-modal-overlay';
      modal.role = 'dialog';
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    const count = this.#pendingExportEntries?.length || 0;
    modal.innerHTML = `
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3>Exporter ${count} entrée(s)</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vault-modal-body">
          <p class="vault-modal-hint">Choisissez le format d'export :</p>
          <div class="vault-export-formats">
            <button class="vault-export-format-btn" data-format="json">
              <span class="vault-export-format-icon">📦</span>
              <span class="vault-export-format-name">JSON (GenPwd)</span>
              <span class="vault-export-format-desc">Format natif avec toutes les données</span>
            </button>
            <button class="vault-export-format-btn" data-format="bitwarden">
              <span class="vault-export-format-icon">🔐</span>
              <span class="vault-export-format-name">Bitwarden CSV</span>
              <span class="vault-export-format-desc">Compatible Bitwarden</span>
            </button>
            <button class="vault-export-format-btn" data-format="lastpass">
              <span class="vault-export-format-icon">🔒</span>
              <span class="vault-export-format-name">LastPass CSV</span>
              <span class="vault-export-format-desc">Compatible LastPass</span>
            </button>
            <button class="vault-export-format-btn" data-format="1password">
              <span class="vault-export-format-icon">🗝️</span>
              <span class="vault-export-format-name">1Password CSV</span>
              <span class="vault-export-format-desc">Compatible 1Password</span>
            </button>
            <button class="vault-export-format-btn" data-format="chrome">
              <span class="vault-export-format-icon">🌐</span>
              <span class="vault-export-format-name">Chrome / Edge CSV</span>
              <span class="vault-export-format-desc">Compatible navigateurs</span>
            </button>
            <button class="vault-export-format-btn" data-format="keepass">
              <span class="vault-export-format-icon">🔑</span>
              <span class="vault-export-format-name">KeePass XML</span>
              <span class="vault-export-format-desc">Compatible KeePass 2.x</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind events
    modal.querySelector('[data-close-modal]')?.addEventListener('click', () => {
      this.#closeModal('export-format-modal');
    });

    modal.querySelectorAll('.vault-export-format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        this.#performExport(format);
        this.#closeModal('export-format-modal');
      });
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.#closeModal('export-format-modal');
    });

    this.#openModal('export-format-modal');
  }

  #performExport(format) {
    const entries = this.#pendingExportEntries || [];
    if (entries.length === 0) return;

    const date = new Date().toISOString().split('T')[0];
    let content, filename, mimeType;

    if (format === 'json') {
      // Native JSON format
      const exportData = {
        version: '2.6.8',
        exportedAt: new Date().toISOString(),
        entries: entries.map(e => ({
          type: e.type,
          title: e.title,
          data: e.data,
          notes: e.notes,
          favorite: e.favorite,
          folderId: e.folderId,
          createdAt: e.createdAt,
          modifiedAt: e.modifiedAt
        }))
      };
      content = JSON.stringify(exportData, null, 2);
      filename = `vault-export-${date}.json`;
      mimeType = 'application/json';
    } else if (format === 'keepass') {
      // KeePass 2.x XML format
      content = this.#exportToKeePassXML(entries);
      filename = `vault-export-${date}.xml`;
      mimeType = 'application/xml;charset=utf-8';
    } else {
      // CSV formats
      content = this.#exportToCSV(entries, format);
      filename = `vault-export-${format}-${date}.csv`;
      mimeType = 'text/csv;charset=utf-8';
      // Add BOM for Excel compatibility
      content = '\ufeff' + content;
    }

    // Download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.#showToast(`${entries.length} entrée(s) exportée(s) (${format.toUpperCase()})`, 'success');
    this.#pendingExportEntries = null;
  }

  #exportToCSV(entries, format) {
    const escapeCSV = (val) => {
      if (!val) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const buildRow = (fields) => fields.map(escapeCSV).join(',');
    const logins = entries.filter(e => e.type === 'login');

    let headers, mapRow;

    switch (format) {
      case 'bitwarden':
        headers = ['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'];
        mapRow = (e) => ['', e.favorite ? '1' : '', 'login', e.title, e.notes || '', '', '0', e.data?.url || '', e.data?.username || '', e.data?.password || '', e.data?.totp || ''];
        break;
      case 'lastpass':
        headers = ['url', 'username', 'password', 'totp', 'extra', 'name', 'grouping', 'fav'];
        mapRow = (e) => [e.data?.url || '', e.data?.username || '', e.data?.password || '', e.data?.totp || '', e.notes || '', e.title, '', e.favorite ? '1' : '0'];
        break;
      case '1password':
        headers = ['Title', 'Url', 'Username', 'Password', 'OTPAuth', 'Notes'];
        mapRow = (e) => {
          let otpauth = '';
          if (e.data?.totp) {
            const issuer = e.title || 'GenPwd';
            const account = e.data?.username || 'user';
            otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${e.data.totp}&issuer=${encodeURIComponent(issuer)}`;
          }
          return [e.title, e.data?.url || '', e.data?.username || '', e.data?.password || '', otpauth, e.notes || ''];
        };
        break;
      case 'chrome':
      default:
        headers = ['name', 'url', 'username', 'password', 'note'];
        mapRow = (e) => [e.title, e.data?.url || '', e.data?.username || '', e.data?.password || '', e.notes || ''];
        break;
    }

    const rows = [buildRow(headers)];
    for (const entry of logins) {
      rows.push(buildRow(mapRow(entry)));
    }

    return rows.join('\r\n');
  }

  /**
   * Export entries to KeePass 2.x XML format
   * Compatible with KeePass 2.x import
   */
  #exportToKeePassXML(entries) {
    const escapeXML = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString();
      return new Date(dateStr).toISOString();
    };

    // Generate UUID v4-like
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }).toUpperCase();
    };

    // Group entries by folder
    const entriesByFolder = new Map();
    entriesByFolder.set('', []); // Root entries

    for (const entry of entries) {
      const folderId = entry.folderId || '';
      if (!entriesByFolder.has(folderId)) {
        entriesByFolder.set(folderId, []);
      }
      entriesByFolder.get(folderId).push(entry);
    }

    // Build entry XML
    const buildEntry = (entry) => {
      const uuid = generateUUID();
      const createdAt = formatDate(entry.createdAt);
      const modifiedAt = formatDate(entry.modifiedAt);

      // Build notes with extra info
      let notes = entry.notes || '';
      if (entry.type === 'card') {
        notes = `Type: Carte bancaire\n` +
          `Titulaire: ${entry.data?.holder || ''}\n` +
          `Numéro: ${entry.data?.number || ''}\n` +
          `Expiration: ${entry.data?.expiry || ''}\n` +
          `CVV: ${entry.data?.cvv || ''}\n` +
          (notes ? `\n${notes}` : '');
      } else if (entry.type === 'identity') {
        notes = `Type: Identité\n` +
          `Nom: ${entry.data?.fullName || ''}\n` +
          `Email: ${entry.data?.email || ''}\n` +
          `Téléphone: ${entry.data?.phone || ''}\n` +
          (notes ? `\n${notes}` : '');
      } else if (entry.type === 'note') {
        notes = entry.data?.content || notes;
      }

      // Add TOTP to notes if present (KeePass format: otpauth://)
      if (entry.data?.totp) {
        const issuer = escapeXML(entry.title || 'GenPwd');
        const account = escapeXML(entry.data?.username || 'user');
        const totpUri = `otpauth://totp/${issuer}:${account}?secret=${entry.data.totp}&issuer=${issuer}`;
        notes += (notes ? '\n\n' : '') + `TOTP: ${totpUri}`;
      }

      return `
			<Entry>
				<UUID>${uuid}</UUID>
				<IconID>0</IconID>
				<ForegroundColor />
				<BackgroundColor />
				<OverrideURL />
				<Tags>${entry.favorite ? 'Favori' : ''}</Tags>
				<Times>
					<CreationTime>${createdAt}</CreationTime>
					<LastModificationTime>${modifiedAt}</LastModificationTime>
					<LastAccessTime>${modifiedAt}</LastAccessTime>
					<ExpiryTime>${entry.data?.expiresAt ? formatDate(entry.data.expiresAt) : modifiedAt}</ExpiryTime>
					<Expires>${entry.data?.expiresAt ? 'True' : 'False'}</Expires>
					<UsageCount>0</UsageCount>
				</Times>
				<String>
					<Key>Title</Key>
					<Value>${escapeXML(entry.title)}</Value>
				</String>
				<String>
					<Key>UserName</Key>
					<Value>${escapeXML(entry.data?.username || entry.data?.email || '')}</Value>
				</String>
				<String>
					<Key>Password</Key>
					<Value Protected="True">${escapeXML(entry.data?.password || '')}</Value>
				</String>
				<String>
					<Key>URL</Key>
					<Value>${escapeXML(entry.data?.url || '')}</Value>
				</String>
				<String>
					<Key>Notes</Key>
					<Value>${escapeXML(notes)}</Value>
				</String>
			</Entry>`;
    };

    // Build group (folder) XML
    const buildGroup = (name, entries, isRoot = false) => {
      const uuid = generateUUID();
      const entriesXML = entries.map(buildEntry).join('');

      return `
		<Group>
			<UUID>${uuid}</UUID>
			<Name>${escapeXML(name)}</Name>
			<Notes />
			<IconID>${isRoot ? '48' : '0'}</IconID>
			<IsExpanded>True</IsExpanded>
			<DefaultAutoTypeSequence />
			<EnableAutoType>null</EnableAutoType>
			<EnableSearching>null</EnableSearching>
			<LastTopVisibleEntry>AAAAAAAAAAAAAAAAAAAAAA==</LastTopVisibleEntry>
			${entriesXML}
		</Group>`;
    };

    // Build folder groups
    let groupsXML = '';

    // Root entries first
    const rootEntries = entriesByFolder.get('') || [];

    // Add folder groups
    for (const [folderId, folderEntries] of entriesByFolder) {
      if (folderId === '') continue; // Skip root, handled separately
      const folder = this.#folders.find(f => f.id === folderId);
      const folderName = folder?.name || 'Dossier';
      groupsXML += buildGroup(folderName, folderEntries);
    }

    // Build full XML
    const now = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<KeePassFile>
	<Meta>
		<Generator>GenPwd Pro</Generator>
		<DatabaseName>GenPwd Pro Export</DatabaseName>
		<DatabaseDescription>Exported from GenPwd Pro</DatabaseDescription>
		<DefaultUserName />
		<MaintenanceHistoryDays>365</MaintenanceHistoryDays>
		<Color />
		<MasterKeyChanged>${now}</MasterKeyChanged>
		<RecycleBinEnabled>False</RecycleBinEnabled>
	</Meta>
	<Root>
		<Group>
			<UUID>${generateUUID()}</UUID>
			<Name>GenPwd Pro</Name>
			<Notes>Exported from GenPwd Pro - ${now}</Notes>
			<IconID>48</IconID>
			<IsExpanded>True</IsExpanded>
			${rootEntries.map(buildEntry).join('')}
			${groupsXML}
		</Group>
	</Root>
</KeePassFile>`;

    return xml;
  }

  #triggerImport() {
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
          this.#showToast(`KeePass XML: ${imported} entrée(s) importée(s)`, 'success', 4000);
          return;
        } else if (file.name.endsWith('.kdbx')) {
          this.#showToast('Les fichiers .kdbx ne sont pas supportés. Exportez en XML depuis KeePass.', 'warning', 5000);
          return;
        } else {
          // JSON import
          const data = JSON.parse(text);

          if (!data.entries || !Array.isArray(data.entries)) {
            throw new Error('Format invalide');
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
        this.#showToast(`${imported} entrée(s) importée(s)`, 'success');
      } catch (error) {
        console.error('[VaultUI] Import error:', error);
        this.#showDetailedError(
          'Erreur d\'import: ' + (error.message || 'format invalide'),
          'Vérifiez le format du fichier (CSV ou JSON requis)'
        );
      }
    });
    input.click();
  }

  async #importKeePassXML(xmlText) {
    // Parse KeePass 2.x XML format
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Format XML invalide');
    }

    // Check if it's a KeePass file
    const root = doc.querySelector('KeePassFile');
    if (!root) {
      throw new Error('Ce n\'est pas un fichier KeePass XML');
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
        } catch {}
      }
    }

    return entry;
  }

  async #importCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('Fichier CSV vide');

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
      generic: 'Format générique'
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
    const totpInfo = withTotp > 0 ? ` (${withTotp} avec 2FA)` : '';
    this.#showToast(`${formatNames[format]}: ${imported} entrées importées${totpInfo}`, 'success', 4000);

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
          } catch {}
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

  #attachMainViewEvents() {
    // Lock button
    document.getElementById('btn-lock')?.addEventListener('click', () => this.#lock());

    // Timer settings button
    document.getElementById('timer-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#showTimeoutSettings();
    });

    // Theme toggle button
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.#toggleTheme();
    });

    // Vault switcher dropdown
    const vaultSwitcher = document.getElementById('vault-switcher');
    const vaultDropdown = document.getElementById('vault-switcher-dropdown');
    if (vaultSwitcher && vaultDropdown) {
      vaultSwitcher.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !vaultDropdown.hidden;
        vaultDropdown.hidden = isOpen;
        vaultSwitcher.setAttribute('aria-expanded', !isOpen);
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!vaultSwitcher.contains(e.target) && !vaultDropdown.contains(e.target)) {
          vaultDropdown.hidden = true;
          vaultSwitcher.setAttribute('aria-expanded', 'false');
        }
      });

      // Switch vault button (lock and return to vault selection)
      document.getElementById('btn-switch-vault')?.addEventListener('click', async () => {
        vaultDropdown.hidden = true;
        await this.#lock();
      });

      // Create new vault button
      document.getElementById('btn-create-new-vault')?.addEventListener('click', async () => {
        vaultDropdown.hidden = true;
        await this.#lock();
        // Small delay to ensure lock screen is rendered, then open create modal
        setTimeout(() => {
          this.#openModal('create-vault-modal');
        }, 100);
      });
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
    });

    // Clear search button
    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
      this.#searchQuery = '';
      const searchInput = document.getElementById('vault-search');
      if (searchInput) searchInput.value = '';
      this.#updateEntryList();
    });

    // Empty state: add first entry button
    document.getElementById('btn-add-first-entry')?.addEventListener('click', () => {
      this.#openModal('add-entry-modal');
    });

    // Empty state: import first button
    document.getElementById('btn-import-first')?.addEventListener('click', () => {
      this.#openModal('import-modal');
    });

    // Category navigation
    document.querySelectorAll('.vault-nav-item[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#selectedCategory = btn.dataset.category;
        this.#selectedFolder = null;
        this.#selectedEntry = null;
        this.#render();
      });
    });

    // Folder navigation
    document.querySelectorAll('.vault-nav-item[data-folder]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#selectedFolder = btn.dataset.folder;
        this.#selectedCategory = 'all';
        this.#selectedEntry = null;
        this.#render();
      });

      // Right-click for color picker
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.#showFolderColorPicker(btn.dataset.folder, e.clientX, e.clientY);
      });
    });

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
      });
    });

    // Tag edit buttons
    document.querySelectorAll('[data-edit-tag]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#openEditTagModal(btn.dataset.editTag);
      });
    });

    // Add tag button
    document.getElementById('btn-add-tag')?.addEventListener('click', () => {
      this.#openModal('add-tag-modal');
    });

    // Sort dropdown
    const sortBtn = document.getElementById('sort-btn');
    const sortMenu = document.getElementById('sort-menu');
    sortBtn?.addEventListener('click', () => {
      const isOpen = !sortMenu.hidden;
      sortMenu.hidden = isOpen;
      sortBtn.setAttribute('aria-expanded', !isOpen);
    });

    document.querySelectorAll('.vault-sort-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#sortBy = btn.dataset.sort;
        sortMenu.hidden = true;
        sortBtn?.setAttribute('aria-expanded', 'false');
        this.#updateEntryList();
      });
    });

    // Close sort menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vault-sort-dropdown')) {
        sortMenu.hidden = true;
        sortBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    // Filter panel toggle
    const filterBtn = document.getElementById('filter-btn');
    const filterPanel = document.getElementById('filter-panel');
    filterBtn?.addEventListener('click', () => {
      const isOpen = !filterPanel.hidden;
      filterPanel.hidden = isOpen;
      filterBtn.setAttribute('aria-expanded', !isOpen);
    });

    // Filter chips - Type
    document.querySelectorAll('[data-filter-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.type = chip.dataset.filterType || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      });
    });

    // Filter chips - Strength
    document.querySelectorAll('[data-filter-strength]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.strength = chip.dataset.filterStrength || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      });
    });

    // Filter chips - Age
    document.querySelectorAll('[data-filter-age]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.#searchFilters.age = chip.dataset.filterAge || null;
        this.#updateFilterUI();
        this.#updateEntryList();
      });
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
        `${count} entrée(s) supprimée(s)`,
        async () => {
          // Undo: reload data
          await this.#loadData();
          this.#updateEntryList();
          this.#showToast('Restauré', 'success');
        },
        async () => {
          // Confirm: delete for real
          for (const id of ids) {
            await window.vault.entries.delete(id);
          }
        }
      );
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
          await this.#copyToClipboard(entry.data?.username, 'Identifiant copié');
        } else if (action === 'copy-password') {
          await this.#copyToClipboard(entry.data?.password, 'Mot de passe copié');
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
          btn.title = newFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
          btn.setAttribute('aria-pressed', newFavorite);

          this.#showToast(newFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris', 'success');

          // Update category counts
          const favCount = document.querySelector('[data-category="favorites"] .vault-nav-count');
          if (favCount) {
            favCount.textContent = this.#entries.filter(e => e.favorite).length;
          }
        } catch (error) {
          this.#showToast('Erreur de mise à jour', 'error');
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
        const index = parseInt(row?.dataset.entryIndex || '0');
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
          this.#showContextMenu(entry, e.clientX, e.clientY);
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

  #showContextMenu(entry, x, y) {
    // Remove existing context menu
    document.querySelector('.vault-context-menu')?.remove();

    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
    const menu = document.createElement('div');
    menu.className = 'vault-context-menu';
    menu.innerHTML = `
      <div class="vault-ctx-header">
        <span class="vault-ctx-icon" style="color: ${type.color}">${type.icon}</span>
        <span class="vault-ctx-title">${this.#escapeHtml(entry.title)}</span>
      </div>
      <div class="vault-ctx-divider"></div>
      ${entry.type === 'login' && entry.data?.username ? `
        <button class="vault-ctx-item" data-action="copy-username">
          <span class="vault-ctx-item-icon">👤</span>
          Copier l'identifiant
        </button>
      ` : ''}
      ${entry.type === 'login' && entry.data?.password ? `
        <button class="vault-ctx-item" data-action="copy-password">
          <span class="vault-ctx-item-icon">🔑</span>
          Copier le mot de passe
        </button>
      ` : ''}
      ${entry.data?.url ? `
        <button class="vault-ctx-item" data-action="open-url">
          <span class="vault-ctx-item-icon">🔗</span>
          Ouvrir le site
        </button>
      ` : ''}
      <div class="vault-ctx-divider"></div>
      <button class="vault-ctx-item" data-action="edit">
        <span class="vault-ctx-item-icon">✏️</span>
        Modifier
      </button>
      <button class="vault-ctx-item" data-action="duplicate">
        <span class="vault-ctx-item-icon">📋</span>
        Dupliquer
      </button>
      <button class="vault-ctx-item" data-action="move">
        <span class="vault-ctx-item-icon">📁</span>
        Déplacer vers...
      </button>
      <button class="vault-ctx-item" data-action="toggle-favorite">
        <span class="vault-ctx-item-icon">${entry.favorite ? '☆' : '★'}</span>
        ${entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      </button>
      <button class="vault-ctx-item" data-action="toggle-pin">
        <span class="vault-ctx-item-icon">${entry.pinned ? '📍' : '📌'}</span>
        ${entry.pinned ? 'Désépingler' : 'Épingler en haut'}
      </button>
      <div class="vault-ctx-divider"></div>
      <button class="vault-ctx-item vault-ctx-danger" data-action="delete">
        <span class="vault-ctx-item-icon">🗑️</span>
        Supprimer
      </button>
    `;

    // Position the menu
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Adjust if menu goes off-screen
    let posX = x;
    let posY = y;
    if (x + rect.width > viewportW) posX = viewportW - rect.width - 10;
    if (y + rect.height > viewportH) posY = viewportH - rect.height - 10;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    // Event handlers
    const closeMenu = () => menu.remove();

    menu.querySelectorAll('.vault-ctx-item').forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.action;
        closeMenu();

        switch (action) {
          case 'copy-username':
            await this.#copyToClipboard(entry.data?.username, 'Identifiant copié');
            break;
          case 'copy-password':
            await this.#copyToClipboard(entry.data?.password, 'Mot de passe copié');
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
            this.#renderMoveFolderModal();
            this.#openModal('move-folder-modal');
            break;
          case 'toggle-favorite':
            await this.#toggleEntryFavorite(entry);
            break;
          case 'toggle-pin':
            await this.#toggleEntryPin(entry);
            break;
          case 'delete':
            this.#deleteEntryWithUndo(entry);
            break;
        }
      });
    });

    // Close on click outside or Escape
    setTimeout(() => {
      const handler = (e) => {
        if (!menu.contains(e.target)) {
          closeMenu();
          document.removeEventListener('click', handler);
          document.removeEventListener('keydown', escHandler);
        }
      };
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeMenu();
          document.removeEventListener('click', handler);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('click', handler);
      document.addEventListener('keydown', escHandler);
    }, 0);
  }

  async #toggleEntryFavorite(entry) {
    try {
      const newFavorite = !entry.favorite;
      await window.vault.entries.update(entry.id, { favorite: newFavorite });
      entry.favorite = newFavorite;
      this.#showToast(newFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris', 'success');
      this.#render();
      if (this.#selectedEntry?.id === entry.id) {
        this.#updateDetailPanel();
      }
    } catch (error) {
      this.#showToast('Erreur de mise à jour', 'error');
    }
  }

  async #toggleEntryPin(entry) {
    try {
      const newPinned = !entry.pinned;
      await window.vault.entries.update(entry.id, { pinned: newPinned });
      entry.pinned = newPinned;
      this.#showToast(newPinned ? 'Épinglé en haut' : 'Désépinglé', 'success');
      this.#render();
      if (this.#selectedEntry?.id === entry.id) {
        this.#updateDetailPanel();
      }
    } catch (error) {
      this.#showToast('Erreur de mise à jour', 'error');
    }
  }

  #showEntryPreview(entry, x, y) {
    this.#hideEntryPreview();

    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
    const preview = document.createElement('div');
    preview.className = 'vault-entry-preview';

    let fieldsHtml = '';

    if (entry.type === 'login') {
      if (entry.data?.username) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Identifiant</span>
            <span class="vault-preview-value">${this.#escapeHtml(entry.data.username)}</span>
          </div>
        `;
      }
      if (entry.data?.password) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Mot de passe</span>
            <span class="vault-preview-value vault-preview-password">••••••••••••</span>
          </div>
        `;
      }
      if (entry.data?.url) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">URL</span>
            <span class="vault-preview-value">${this.#escapeHtml(entry.data.url)}</span>
          </div>
        `;
      }
    } else if (entry.type === 'card') {
      if (entry.data?.cardNumber) {
        const masked = '**** **** **** ' + (entry.data.cardNumber.slice(-4) || '****');
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Numéro de carte</span>
            <span class="vault-preview-value">${masked}</span>
          </div>
        `;
      }
      if (entry.data?.expiry) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Expiration</span>
            <span class="vault-preview-value">${this.#escapeHtml(entry.data.expiry)}</span>
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
            <span class="vault-preview-value">${this.#escapeHtml(truncated)}</span>
          </div>
        `;
      }
    } else if (entry.type === 'identity') {
      if (entry.data?.fullName) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Nom</span>
            <span class="vault-preview-value">${this.#escapeHtml(entry.data.fullName)}</span>
          </div>
        `;
      }
      if (entry.data?.email) {
        fieldsHtml += `
          <div class="vault-preview-field">
            <span class="vault-preview-label">Email</span>
            <span class="vault-preview-value">${this.#escapeHtml(entry.data.email)}</span>
          </div>
        `;
      }
    }

    // Add modified date
    if (entry.modifiedAt) {
      const modified = new Date(entry.modifiedAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      fieldsHtml += `
        <div class="vault-preview-field">
          <span class="vault-preview-label">Modifié</span>
          <span class="vault-preview-value">${modified}</span>
        </div>
      `;
    }

    preview.innerHTML = `
      <div class="vault-preview-header">
        <div class="vault-preview-icon" style="background: ${type.color}20; color: ${type.color}">
          ${type.icon}
        </div>
        <span class="vault-preview-title">${this.#escapeHtml(entry.title)}</span>
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
      countEl.textContent = `${this.#selectedEntries.size} sélectionné(s)`;
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
      this.#showToast(`${entryIds.length} entrée(s) déplacée(s)`, 'success');
      this.#render();
    } catch (error) {
      this.#showToast('Erreur de déplacement', 'error');
    }
  }

  #updateEntryList() {
    const container = document.getElementById('vault-entries');
    const countEl = document.querySelector('.vault-list-count');
    const sortBtnText = document.querySelector('#sort-btn span');

    if (!container) return;

    const filteredEntries = this.#getFilteredEntries();

    if (countEl) {
      countEl.textContent = `${filteredEntries.length} entrée(s)`;
    }

    if (sortBtnText) {
      sortBtnText.textContent = SORT_OPTIONS.find(s => s.id === this.#sortBy)?.label || 'Trier';
    }

    container.innerHTML = filteredEntries.length === 0
      ? this.#renderEmptyState()
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
    panel.innerHTML = this.#selectedEntry ? this.#renderEntryDetail() : this.#renderNoSelection();
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
        <span class="vault-breach-badge" title="Ce mot de passe a été exposé dans ${this.#formatBreachCount(breachCount)} fuites de données">
          🚨 Compromis
        </span>
      `;
      indicator.classList.add('visible');
    } else if (this.#lastBreachCheck) {
      // Only show "safe" if we've done a check
      indicator.innerHTML = `
        <span class="vault-safe-badge" title="Ce mot de passe n'a pas été trouvé dans les fuites connues">
          ✅ Sûr
        </span>
      `;
      indicator.classList.add('visible');
    }
  }

  #attachDetailPanelEvents() {
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
          btn.setAttribute('aria-label', 'Masquer la valeur');
        } else {
          textEl.textContent = '•'.repeat(Math.min(realValue.length, 24));
          textEl.classList.add('masked');
          btn.querySelector('.icon-show').hidden = false;
          btn.querySelector('.icon-hide').hidden = true;
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('aria-label', 'Afficher la valeur');
        }
      });
    });

    // Copy field
    document.querySelectorAll('.copy-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        const label = btn.closest('.vault-field')?.querySelector('.vault-field-label')?.textContent || 'Valeur';
        await this.#copyToClipboard(btn.dataset.value, `${label} copié`);
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
          await this.#copyToClipboard(code, 'Code 2FA copié');
        }
      });
    });

    // Show TOTP QR Code
    document.querySelectorAll('.show-totp-qr').forEach(btn => {
      btn.addEventListener('click', () => {
        const secret = btn.dataset.secret;
        const title = btn.dataset.title || 'GenPwd';
        const account = btn.dataset.account || '';
        if (secret) {
          this.#showTOTPQRModal(secret, title, account);
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
        await this.#copyToClipboard(btn.dataset.password, 'Ancien mot de passe copié');
      });
    });

    // Restore password from history
    document.querySelectorAll('.restore-history-pwd').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!this.#selectedEntry) return;
        const index = parseInt(btn.dataset.index);
        await this.#restorePasswordFromHistory(index);
      });
    });

    // Reveal history password on click
    document.querySelectorAll('.vault-history-password').forEach(el => {
      el.addEventListener('click', function() {
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
        this.#showToast(this.#selectedEntry.favorite ? 'Retiré des favoris' : 'Ajouté aux favoris', 'success');
      } catch (error) {
        this.#showToast('Erreur', 'error');
      }
    });

    // Edit entry
    document.getElementById('btn-edit-entry')?.addEventListener('click', () => {
      if (!this.#selectedEntry) return;
      this.#openEditModal(this.#selectedEntry);
    });

    // Delete entry (with undo)
    document.getElementById('btn-delete-entry')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      this.#deleteEntryWithUndo(this.#selectedEntry);
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
      `"${entryTitle}" supprimé`,
      async () => {
        // Undo: restore entry
        if (this.#pendingDelete) {
          this.#entries.push(this.#pendingDelete);
          this.#pendingDelete = null;
          this.#updateEntryList();
          this.#showToast('Restauré', 'success');
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
          this.#showToast('Erreur de suppression', 'error');
        }
      }
    );
  }

  async #duplicateEntry(entry) {
    try {
      const newData = { ...entry.data };
      const newEntry = await window.vault.entries.add(
        entry.type,
        `${entry.title} (copie)`,
        { ...newData, folderId: entry.folderId, notes: entry.notes, tags: entry.tags || [] }
      );
      this.#selectedEntry = newEntry;
      this.#showToast('Entrée dupliquée', 'success');
    } catch (error) {
      this.#showToast('Erreur de duplication', 'error');
    }
  }

  async #restorePasswordFromHistory(historyIndex) {
    if (!this.#selectedEntry) return;

    const entry = this.#selectedEntry;
    const history = entry.data?.passwordHistory || [];

    if (historyIndex < 0 || historyIndex >= history.length) {
      this.#showToast('Index invalide', 'error');
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
      this.#showToast('Mot de passe restauré', 'success');
    } catch (error) {
      this.#showToast('Erreur de restauration', 'error');
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
        reason: 'Changement manuel'
      },
      ...history
    ].slice(0, 10); // Keep max 10

    return newHistory;
  }

  async #executeAutotype(entry) {
    if (!entry || entry.type !== 'login') return;

    const username = entry.data?.username || '';
    const password = entry.data?.password || '';

    if (!username && !password) {
      this.#showToast('Aucune donnée à remplir', 'warning');
      return;
    }

    // Check if Electron autotype is available
    if (window.electronAPI?.autotype) {
      try {
        this.#showToast('Auto-remplissage en cours...', 'info');

        // Minimize the app
        await window.electronAPI.autotype.minimize();

        // Wait for focus to change
        await new Promise(r => setTimeout(r, 500));

        // Type sequence: username, tab, password, enter
        if (username) {
          await window.electronAPI.autotype.type(username);
          await new Promise(r => setTimeout(r, 100));
        }

        await window.electronAPI.autotype.sendKey('Tab');
        await new Promise(r => setTimeout(r, 100));

        if (password) {
          await window.electronAPI.autotype.type(password);
          await new Promise(r => setTimeout(r, 100));
        }

        await window.electronAPI.autotype.sendKey('Enter');

        this.#showToast('Auto-remplissage terminé', 'success');
      } catch (error) {
        console.error('[VaultUI] Autotype error:', error);
        this.#showToast('Erreur auto-remplissage', 'error');
      }
    } else {
      // Fallback: Copy to clipboard with instructions
      this.#showAutotypeModal(entry);
    }
  }

  #showAutotypeModal(entry) {
    const username = entry.data?.username || '';
    const password = entry.data?.password || '';

    const modal = document.createElement('div');
    modal.className = 'vault-modal-overlay';
    modal.id = 'autotype-modal';
    modal.innerHTML = `
      <div class="vault-modal vault-modal-sm">
        <div class="vault-modal-header">
          <h3>Auto-remplissage manuel</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="vault-modal-body">
          <p class="vault-modal-hint">L'auto-remplissage automatique nécessite l'application Electron.</p>
          <p class="vault-modal-hint">Copiez les valeurs ci-dessous :</p>
          <div class="vault-autotype-steps">
            <div class="vault-autotype-step">
              <span class="vault-autotype-label">1. Identifiant</span>
              <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-user">
                Copier "${username.substring(0, 10)}${username.length > 10 ? '...' : ''}"
              </button>
            </div>
            <div class="vault-autotype-step">
              <span class="vault-autotype-label">2. Mot de passe</span>
              <button class="vault-btn vault-btn-sm vault-btn-primary" id="copy-autotype-pass">
                Copier ••••••••
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind events
    modal.querySelector('[data-close-modal]').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('#copy-autotype-user').addEventListener('click', async () => {
      await this.#copyToClipboard(username, 'Identifiant copié');
    });

    modal.querySelector('#copy-autotype-pass').addEventListener('click', async () => {
      await this.#copyToClipboard(password, 'Mot de passe copié');
    });

    // Auto-focus modal
    modal.querySelector('button').focus();
  }

  #showShareModal(entry) {
    // Generate a random passphrase
    const passphrase = this.#generateSharePassphrase();

    const modal = document.createElement('div');
    modal.className = 'vault-modal-overlay';
    modal.id = 'share-modal';
    modal.innerHTML = `
      <div class="vault-modal">
        <div class="vault-modal-header">
          <h3>Partager "${this.#escapeHtml(entry.title)}"</h3>
          <button type="button" class="vault-modal-close" data-close-modal aria-label="Fermer">
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
            Les données seront chiffrées avec la phrase de passe ci-dessous.
          </p>

          <div class="vault-form-group">
            <label class="vault-label">Phrase de passe</label>
            <div class="vault-share-passphrase">
              <input type="text" class="vault-input" id="share-passphrase" value="${passphrase}" readonly>
              <button type="button" class="vault-btn vault-btn-secondary" id="regenerate-passphrase" title="Régénérer">
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
            <p class="vault-share-hint">Partagez cette phrase séparément (ex: par téléphone)</p>
          </div>

          <div class="vault-form-group">
            <label class="vault-label">Expiration</label>
            <select class="vault-input vault-select" id="share-expiry">
              <option value="3600000">1 heure</option>
              <option value="86400000" selected>24 heures</option>
              <option value="604800000">7 jours</option>
              <option value="2592000000">30 jours</option>
            </select>
          </div>

          <div class="vault-form-group">
            <label class="vault-checkbox-label">
              <input type="checkbox" id="share-include-notes">
              <span>Inclure les notes</span>
            </label>
          </div>

          <div class="vault-share-result" id="share-result" hidden>
            <label class="vault-label">Texte chiffré à partager</label>
            <textarea class="vault-input vault-textarea" id="share-output" rows="4" readonly></textarea>
            <button type="button" class="vault-btn vault-btn-primary" id="copy-share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copier le texte chiffré
            </button>
          </div>

          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" data-close-modal>Annuler</button>
            <button type="button" class="vault-btn vault-btn-primary" id="generate-share">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Générer le partage
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
      await this.#copyToClipboard(passphrase, 'Phrase de passe copiée');
    });

    // Generate share
    modal.querySelector('#generate-share').addEventListener('click', async () => {
      const passphrase = modal.querySelector('#share-passphrase').value;
      const expiry = parseInt(modal.querySelector('#share-expiry').value);
      const includeNotes = modal.querySelector('#share-include-notes').checked;

      try {
        const shareText = await this.#createSecureShare(entry, passphrase, { expiresIn: expiry, includeNotes });
        modal.querySelector('#share-output').value = shareText;
        modal.querySelector('#share-result').hidden = false;
        this.#showToast('Partage généré', 'success');
      } catch (error) {
        this.#showToast('Erreur de génération', 'error');
      }
    });

    // Copy share
    modal.querySelector('#copy-share').addEventListener('click', async () => {
      const shareText = modal.querySelector('#share-output').value;
      await this.#copyToClipboard(shareText, 'Texte chiffré copié');
    });
  }

  #generateSharePassphrase() {
    const words = [
      'pomme', 'banane', 'cerise', 'dragon', 'eagle', 'foret', 'jardin', 'harbor',
      'island', 'jungle', 'knight', 'citron', 'montagne', 'nature', 'ocean', 'palace',
      'queen', 'river', 'storm', 'tigre', 'umbrella', 'valley', 'winter', 'xenon',
      'yellow', 'zebre', 'alpha', 'brave', 'crystal', 'diamond', 'ember', 'falcon'
    ];

    const selected = [];
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor(Math.random() * words.length);
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

    // Combine and encode
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return `GENPWD:1:${btoa(String.fromCharCode(...result))}`;
  }

  #openEditModal(entry) {
    const modal = document.getElementById('edit-entry-modal');
    const fieldsContainer = document.getElementById('edit-entry-fields');
    if (!modal || !fieldsContainer) return;

    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;

    let fieldsHtml = `
      <div class="vault-form-group">
        <label class="vault-label" for="edit-title">Titre <span class="required">*</span></label>
        <input type="text" class="vault-input" id="edit-title" value="${this.#escapeHtml(entry.title)}" required>
      </div>
      <div class="vault-form-group">
        <label class="vault-label" for="edit-folder">Dossier</label>
        <select class="vault-input vault-select" id="edit-folder">
          <option value="">Aucun dossier</option>
          ${this.#folders.map(f => `<option value="${f.id}" ${entry.folderId === f.id ? 'selected' : ''}>${this.#escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>
    `;

    switch (entry.type) {
      case 'login':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-username">Identifiant / Email</label>
            <input type="text" class="vault-input" id="edit-username" value="${this.#escapeHtml(entry.data?.username || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-password">Mot de passe</label>
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="edit-password" value="${this.#escapeHtml(entry.data?.password || '')}">
              <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="edit-password" aria-label="Afficher">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button type="button" class="vault-input-btn" id="edit-generate-password" data-tooltip="Générer" aria-label="Générer un mot de passe">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
              </button>
            </div>
            <div class="vault-password-strength" id="edit-password-strength"></div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-url">URL</label>
            <input type="url" class="vault-input" id="edit-url" value="${this.#escapeHtml(entry.data?.url || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-totp">Clé TOTP (2FA)</label>
            <div class="vault-input-group">
              <input type="text" class="vault-input mono" id="edit-totp" value="${this.#escapeHtml(entry.data?.totp || '')}"
                     placeholder="JBSWY3DPEHPK3PXP..." autocomplete="off" spellcheck="false">
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
            <label class="vault-label" for="edit-expires">Expiration du mot de passe</label>
            <div class="vault-expiry-picker">
              <select class="vault-input vault-select" id="edit-expires-preset">
                <option value="">Jamais</option>
                <option value="30">30 jours</option>
                <option value="60">60 jours</option>
                <option value="90">90 jours</option>
                <option value="180">6 mois</option>
                <option value="365">1 an</option>
                <option value="custom" ${entry.data?.expiresAt ? 'selected' : ''}>Date personnalisée...</option>
              </select>
              <input type="date" class="vault-input" id="edit-expires"
                     value="${entry.data?.expiresAt || ''}" ${entry.data?.expiresAt ? '' : 'hidden'}>
            </div>
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-notes">Notes</label>
            <textarea class="vault-input vault-textarea" id="edit-notes" rows="3">${this.#escapeHtml(entry.notes || '')}</textarea>
          </div>
        `;
        break;
      case 'note':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-content">Contenu</label>
            <textarea class="vault-input vault-textarea" id="edit-content" rows="8">${this.#escapeHtml(entry.data?.content || '')}</textarea>
          </div>
        `;
        break;
      case 'card':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-holder">Titulaire</label>
            <input type="text" class="vault-input" id="edit-holder" value="${this.#escapeHtml(entry.data?.holder || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-cardnumber">Numéro de carte</label>
            <input type="text" class="vault-input" id="edit-cardnumber" value="${this.#escapeHtml(entry.data?.number || '')}">
          </div>
          <div class="vault-form-row">
            <div class="vault-form-group">
              <label class="vault-label" for="edit-expiry">Expiration</label>
              <input type="text" class="vault-input" id="edit-expiry" value="${this.#escapeHtml(entry.data?.expiry || '')}" placeholder="MM/AA">
            </div>
            <div class="vault-form-group">
              <label class="vault-label" for="edit-cvv">CVV</label>
              <input type="password" class="vault-input" id="edit-cvv" value="${this.#escapeHtml(entry.data?.cvv || '')}" maxlength="4">
            </div>
          </div>
        `;
        break;
      case 'identity':
        fieldsHtml += `
          <div class="vault-form-group">
            <label class="vault-label" for="edit-fullname">Nom complet</label>
            <input type="text" class="vault-input" id="edit-fullname" value="${this.#escapeHtml(entry.data?.fullName || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-email">Email</label>
            <input type="email" class="vault-input" id="edit-email" value="${this.#escapeHtml(entry.data?.email || '')}">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="edit-phone">Téléphone</label>
            <input type="tel" class="vault-input" id="edit-phone" value="${this.#escapeHtml(entry.data?.phone || '')}">
          </div>
        `;
        break;
    }

    fieldsContainer.innerHTML = fieldsHtml;
    this.#hasDirtyForm = false;
    this.#openModal('edit-entry-modal');

    // Attach edit modal specific events
    setTimeout(() => {
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
        this.#showPasswordGenerator('edit-password', (pwd) => this.#updateEditPasswordStrength(pwd));
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
          date.setDate(date.getDate() + parseInt(value));
          editExpiresInput.value = date.toISOString().split('T')[0];
        } else {
          editExpiresInput.hidden = true;
          editExpiresInput.value = '';
        }
      });

      document.getElementById('edit-title')?.focus();
    }, 50);
  }

  #updateEditPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    const el = document.getElementById('edit-password-strength');
    if (el) {
      el.innerHTML = `
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}" style="width: ${strength.percent}%"></div>
        </div>
        <span class="vault-strength-text ${strength.level}">${strength.label}</span>
      `;
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
            'Modifications non enregistrées',
            'Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer sans sauvegarder ?',
            { confirmText: 'Fermer sans sauvegarder', confirmClass: 'vault-btn-danger' }
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
        this.#showToast('Le titre est requis', 'warning');
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

      try {
        await window.vault.entries.update(entry.id, { title, folderId, data, notes });
        this.#hasDirtyForm = false;
        this.#closeModal('edit-entry-modal');
        this.#showToast('Entrée modifiée', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Erreur', 'error');
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
      indicator.setAttribute('aria-label', 'Modifications non enregistrées');
      indicator.title = 'Modifications non enregistrées';
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

    // Template search
    document.getElementById('template-search')?.addEventListener('input', (e) => {
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
        requiredMessage: 'Le titre est obligatoire',
        minLengthMessage: 'Le titre est trop court',
        maxLengthMessage: 'Le titre est trop long (max 100 caractères)'
      });
    });
    titleInput?.addEventListener('blur', () => {
      this.#validateField(titleInput, titleMessage, {
        required: true,
        minLength: 1,
        requiredMessage: 'Le titre est obligatoire'
      });
    });

    // Form submit
    document.getElementById('add-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="entry-type"]:checked')?.value;
      const title = document.getElementById('entry-title')?.value;
      const folderId = document.getElementById('entry-folder')?.value || null;

      if (!type || !title) {
        this.#showToast('Remplissez tous les champs obligatoires', 'warning');
        return;
      }

      const data = this.#collectEntryFormData(type);

      // Validation
      if (type === 'login') {
        const url = document.getElementById('entry-url')?.value;
        if (url && !this.#isValidUrl(url)) {
          this.#showToast('URL invalide', 'warning');
          return;
        }
      }

      if (type === 'identity') {
        const email = document.getElementById('entry-email')?.value;
        if (email && !this.#isValidEmail(email)) {
          this.#showToast('Email invalide', 'warning');
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
        this.#showToast('Entrée ajoutée', 'success');
        // Reset form
        document.getElementById('add-entry-form')?.reset();
      } catch (error) {
        this.#showToast(error.message || 'Erreur', 'error');
        btn.disabled = false;
        btn.textContent = 'Ajouter';
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
        this.#showToast('Le nom est requis', 'warning');
        return;
      }

      try {
        await window.vault.folders.add(name);
        this.#closeModal('add-folder-modal');
        this.#showToast('Dossier créé', 'success');
        document.getElementById('add-folder-form')?.reset();
      } catch (error) {
        this.#showToast(error.message || 'Erreur', 'error');
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
          this.#showToast('Le nom est requis', 'warning');
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
          'Supprimer le tag',
          `Êtes-vous sûr de vouloir supprimer le tag "${tag?.name}" ? Il sera retiré de toutes les entrées.`,
          { confirmText: 'Supprimer', confirmClass: 'vault-btn-danger' }
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
          this.#showToast('Le nom est requis', 'warning');
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
              <span class="vault-tag-chip" style="--tag-color: ${tag.color || '#6b7280'}">
                ${this.#escapeHtml(tag.name)}
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
          <label class="vault-label" for="entry-username">Identifiant / Email</label>
          <input type="text" class="vault-input" id="entry-username" placeholder="utilisateur@example.com" autocomplete="username">
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-password">Mot de passe</label>
          <div class="vault-input-group">
            <input type="password" class="vault-input" id="entry-password" placeholder="••••••••" autocomplete="new-password">
            <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="entry-password" aria-label="Afficher">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" class="vault-input-btn" id="generate-password" data-tooltip="Générer" aria-label="Générer un mot de passe">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
            </button>
          </div>
          <div class="vault-password-strength" id="entry-password-strength"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-url">URL</label>
          <input type="url" class="vault-input" id="entry-url" placeholder="https://example.com" aria-describedby="entry-url-message">
          <div class="vault-field-message" id="entry-url-message" role="alert" aria-live="polite"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-totp">Clé TOTP (2FA)</label>
          <input type="text" class="vault-input mono" id="entry-totp" placeholder="JBSWY3DPEHPK3PXP ou otpauth://..." autocomplete="off" spellcheck="false">
          <span class="vault-field-hint">Optionnel - Secret Base32 ou URI otpauth://</span>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-expires">Expiration du mot de passe</label>
          <div class="vault-expiry-picker">
            <select class="vault-input vault-select" id="entry-expires-preset">
              <option value="">Jamais</option>
              <option value="30">30 jours</option>
              <option value="60">60 jours</option>
              <option value="90">90 jours</option>
              <option value="180">6 mois</option>
              <option value="365">1 an</option>
              <option value="custom">Date personnalisée...</option>
            </select>
            <input type="date" class="vault-input" id="entry-expires" hidden>
          </div>
          <span class="vault-field-hint">Rappel visuel pour renouveler le mot de passe</span>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-notes">Notes</label>
          <textarea class="vault-input vault-textarea" id="entry-notes" rows="2" placeholder="Notes optionnelles..."></textarea>
        </div>
      `,
      note: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-content">Contenu <span class="required">*</span></label>
          <textarea class="vault-input vault-textarea" id="entry-content" rows="8" placeholder="Votre note sécurisée..." required></textarea>
        </div>
      `,
      card: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-holder">Titulaire</label>
          <input type="text" class="vault-input" id="entry-holder" placeholder="JEAN DUPONT" autocomplete="cc-name">
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-cardnumber">Numéro de carte</label>
          <input type="text" class="vault-input" id="entry-cardnumber" placeholder="1234 5678 9012 3456" autocomplete="cc-number">
        </div>
        <div class="vault-form-row">
          <div class="vault-form-group">
            <label class="vault-label" for="entry-expiry">Expiration</label>
            <input type="text" class="vault-input" id="entry-expiry" placeholder="MM/AA" autocomplete="cc-exp">
          </div>
          <div class="vault-form-group">
            <label class="vault-label" for="entry-cvv">CVV</label>
            <input type="password" class="vault-input" id="entry-cvv" placeholder="123" maxlength="4" autocomplete="cc-csc">
          </div>
        </div>
      `,
      identity: `
        <div class="vault-form-group">
          <label class="vault-label" for="entry-fullname">Nom complet</label>
          <input type="text" class="vault-input" id="entry-fullname" placeholder="Jean Dupont" autocomplete="name">
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-email">Email</label>
          <input type="email" class="vault-input" id="entry-email" placeholder="jean@example.com" autocomplete="email" aria-describedby="entry-email-message">
          <div class="vault-field-message" id="entry-email-message" role="alert" aria-live="polite"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label" for="entry-phone">Téléphone</label>
          <input type="tel" class="vault-input" id="entry-phone" placeholder="+33 6 12 34 56 78" autocomplete="tel">
        </div>
      `
    };

    container.innerHTML = fields[type] || '';

    // Attach events for login type
    if (type === 'login') {
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
        this.#showPasswordGenerator('entry-password', (pwd) => this.#updateAddPasswordStrength(pwd));
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
          urlMessage: 'Entrez une URL valide (https://...)',
          showSuccess: true,
          successMessage: 'URL valide'
        });
      });
      urlInput?.addEventListener('blur', () => {
        this.#validateField(urlInput, urlMessage, {
          url: true,
          urlMessage: 'URL invalide'
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
          date.setDate(date.getDate() + parseInt(value));
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
          emailMessage: 'Entrez une adresse email valide',
          showSuccess: true,
          successMessage: 'Email valide'
        });
      });
      emailInput?.addEventListener('blur', () => {
        this.#validateField(emailInput, emailMessage, {
          email: true,
          emailMessage: 'Email invalide'
        });
      });
    }
  }

  #updateAddPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    const el = document.getElementById('entry-password-strength');
    if (el) {
      el.innerHTML = `
        <div class="vault-strength-bar">
          <div class="vault-strength-fill ${strength.level}" style="width: ${strength.percent}%"></div>
        </div>
        <span class="vault-strength-text ${strength.level}">${strength.label}</span>
      `;
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
      confirmText = 'Confirmer',
      cancelText = 'Annuler',
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
              ${this.#escapeHtml(title)}
            </h3>
          </div>
          <div class="vault-modal-body">
            <p id="confirm-dialog-message" class="confirm-dialog-message">${this.#escapeHtml(message)}</p>
          </div>
          <div class="vault-modal-actions">
            <button type="button" class="vault-btn vault-btn-secondary" id="confirm-dialog-cancel">${this.#escapeHtml(cancelText)}</button>
            <button type="button" class="vault-btn ${confirmClass}" id="confirm-dialog-confirm">${this.#escapeHtml(confirmText)}</button>
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

  #getPasswordStrength(password) {
    if (!password) return null;
    const len = password.length;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

    // Minimum 12 chars + 3 char types = strong
    // Minimum 12 chars + 2 char types = medium
    // Below 12 chars = weak
    if (len >= 16 && variety >= 3) return 'strong';
    if (len >= 12 && variety >= 3) return 'strong';
    if (len >= 12 && variety >= 2) return 'medium';
    return 'weak';
  }

  #getPasswordAgeDays(entry) {
    if (!entry.modifiedAt) return 0;
    const modified = new Date(entry.modifiedAt);
    const now = new Date();
    return Math.floor((now - modified) / (1000 * 60 * 60 * 24));
  }

  #getFilteredEntries() {
    let entries = [...this.#entries];

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
        return this.#getPasswordStrength(e.data.password) === this.#searchFilters.strength;
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
      { level: 'weak', label: 'Faible', percent: 25 },
      { level: 'weak', label: 'Faible', percent: 25 },
      { level: 'fair', label: 'Moyen', percent: 50 },
      { level: 'fair', label: 'Moyen', percent: 50 },
      { level: 'good', label: 'Bon', percent: 75 },
      { level: 'good', label: 'Bon', percent: 75 },
      { level: 'strong', label: 'Fort', percent: 100 },
      { level: 'strong', label: 'Excellent', percent: 100 }
    ];

    return levels[score] || levels[0];
  }

  #generatePassword(options = {}) {
    const {
      length = 20,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true
    } = options;

    let chars = '';
    if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%&*_+-=.?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
  }

  #showPasswordGenerator(targetInputId, strengthUpdateFn) {
    // Remove existing popover
    document.querySelector('.vault-password-generator')?.remove();

    const input = document.getElementById(targetInputId);
    if (!input) return;

    const popover = document.createElement('div');
    popover.className = 'vault-password-generator';
    popover.innerHTML = `
      <div class="vault-gen-header">
        <span>Générateur de mot de passe</span>
        <button class="vault-gen-close" aria-label="Fermer">&times;</button>
      </div>
      <div class="vault-gen-preview">
        <input type="text" class="vault-gen-output" id="gen-output" readonly>
        <button class="vault-gen-copy" title="Copier">📋</button>
        <button class="vault-gen-refresh" title="Régénérer">🔄</button>
      </div>
      <div class="vault-gen-options">
        <div class="vault-gen-length">
          <label>Longueur: <span id="gen-length-value">20</span></label>
          <input type="range" id="gen-length" min="8" max="64" value="20">
        </div>
        <div class="vault-gen-checkboxes">
          <label><input type="checkbox" id="gen-uppercase" checked> A-Z</label>
          <label><input type="checkbox" id="gen-lowercase" checked> a-z</label>
          <label><input type="checkbox" id="gen-numbers" checked> 0-9</label>
          <label><input type="checkbox" id="gen-symbols" checked> !@#$</label>
        </div>
      </div>
      <button class="vault-btn vault-btn-primary vault-btn-sm vault-btn-full" id="gen-use">
        Utiliser ce mot de passe
      </button>
    `;

    input.parentElement.appendChild(popover);

    const generate = () => {
      const pwd = this.#generatePassword({
        length: parseInt(document.getElementById('gen-length').value),
        uppercase: document.getElementById('gen-uppercase').checked,
        lowercase: document.getElementById('gen-lowercase').checked,
        numbers: document.getElementById('gen-numbers').checked,
        symbols: document.getElementById('gen-symbols').checked
      });
      document.getElementById('gen-output').value = pwd;
      return pwd;
    };

    generate();

    // Event listeners
    document.getElementById('gen-length').addEventListener('input', (e) => {
      document.getElementById('gen-length-value').textContent = e.target.value;
      generate();
    });

    ['gen-uppercase', 'gen-lowercase', 'gen-numbers', 'gen-symbols'].forEach(id => {
      document.getElementById(id).addEventListener('change', generate);
    });

    document.getElementById('gen-refresh').addEventListener('click', generate);

    document.getElementById('gen-copy').addEventListener('click', () => {
      const pwd = document.getElementById('gen-output').value;
      navigator.clipboard.writeText(pwd);
      this.#showToast('Copié!', 'success');
    });

    document.getElementById('gen-use').addEventListener('click', () => {
      const pwd = document.getElementById('gen-output').value;
      input.value = pwd;
      input.type = 'text';
      if (strengthUpdateFn) strengthUpdateFn(pwd);
      popover.remove();
    });

    popover.querySelector('.vault-gen-close').addEventListener('click', () => popover.remove());

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closePopover(e) {
        if (!popover.contains(e.target) && e.target !== input) {
          popover.remove();
          document.removeEventListener('click', closePopover);
        }
      });
    }, 100);
  }

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
      message = rules.requiredMessage || 'Ce champ est obligatoire';
    }
    // Min length check
    else if (rules.minLength && value.length < rules.minLength) {
      isValid = false;
      message = rules.minLengthMessage || `Minimum ${rules.minLength} caractères`;
    }
    // Max length check
    else if (rules.maxLength && value.length > rules.maxLength) {
      isValid = false;
      message = rules.maxLengthMessage || `Maximum ${rules.maxLength} caractères`;
    }
    // Pattern check
    else if (rules.pattern && !rules.pattern.test(value)) {
      isValid = false;
      message = rules.patternMessage || 'Format invalide';
    }
    // URL check
    else if (rules.url && value && !this.#isValidUrl(value)) {
      isValid = false;
      message = rules.urlMessage || 'URL invalide';
    }
    // Email check
    else if (rules.email && value && !this.#isValidEmail(value)) {
      isValid = false;
      message = rules.emailMessage || 'Email invalide';
    }
    // Valid
    else if (value && rules.showSuccess) {
      message = rules.successMessage || '✓';
      messageType = 'success';
    }

    // Update input classes
    input.classList.remove('is-valid', 'is-invalid');
    if (value) {
      input.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }

    // Update message
    if (message) {
      const icon = messageType === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      messageEl.innerHTML = `${icon}<span>${message}</span>`;
      messageEl.className = `vault-field-message visible ${messageType}`;
    } else {
      messageEl.className = 'vault-field-message';
      messageEl.innerHTML = '';
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
      message = 'Les mots de passe ne correspondent pas';
    } else {
      message = 'Les mots de passe correspondent';
      messageType = 'success';
    }

    // Update input classes
    confirmInput.classList.remove('is-valid', 'is-invalid');
    if (confirm) {
      confirmInput.classList.add(isValid ? 'is-valid' : 'is-invalid');
    }

    // Update message
    if (message) {
      const icon = messageType === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      messageEl.innerHTML = `${icon}<span>${message}</span>`;
      messageEl.className = `vault-field-message visible ${messageType}`;
    } else {
      messageEl.className = 'vault-field-message';
      messageEl.innerHTML = '';
    }

    return isValid;
  }

  async #lock() {
    try {
      await window.vault.lock();
      this.#showToast('Coffre verrouillé', 'success');
    } catch (error) {
      this.#showToast('Erreur', 'error');
    }
  }

  #startAutoLockTimer() {
    // Load saved timeout preference
    const savedTimeout = localStorage.getItem('vault-autolock-timeout');
    if (savedTimeout) {
      this.#autoLockTimeout = parseInt(savedTimeout, 10);
    }
    this.#autoLockSeconds = this.#autoLockTimeout;
    this.#autoLockTimer = setInterval(() => {
      this.#autoLockSeconds--;
      this.#updateLockCountdown();
      if (this.#autoLockSeconds <= 0) {
        this.#lock();
      }
    }, 1000);
  }

  #stopAutoLockTimer() {
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
    window.vault.resetActivity?.();
  }

  #formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  #initTheme() {
    const savedTheme = localStorage.getItem('vault-theme') || 'dark';
    this.#theme = savedTheme;
    this.#applyTheme();
  }

  #toggleTheme() {
    this.#theme = this.#theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('vault-theme', this.#theme);
    this.#applyTheme();
    this.#showToast(`Thème ${this.#theme === 'dark' ? 'sombre' : 'clair'} activé`, 'success');
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

  #isPasswordDuplicated(password, currentEntryId) {
    if (!password) return false;
    const duplicates = this.#entries.filter(e =>
      e.type === 'login' &&
      e.data?.password === password &&
      e.id !== currentEntryId
    );
    return duplicates.length > 0;
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
        badge: `<span class="vault-expiry-badge expired" title="Expiré depuis ${daysAgo} jour${daysAgo > 1 ? 's' : ''}" role="img" aria-label="Expiré depuis ${daysAgo} jour${daysAgo > 1 ? 's' : ''}"><span aria-hidden="true">⚠️</span></span>`,
        daysLeft,
        label: `Expiré depuis ${daysAgo} jour${daysAgo > 1 ? 's' : ''}`
      };
    } else if (daysLeft === 0) {
      // Expires today
      return {
        status: 'today',
        badge: '<span class="vault-expiry-badge today" title="Expire aujourd\'hui" role="img" aria-label="Expire aujourd\'hui"><span aria-hidden="true">⏰</span></span>',
        daysLeft: 0,
        label: "Expire aujourd'hui"
      };
    } else if (daysLeft <= 7) {
      // Expires within a week
      return {
        status: 'soon',
        badge: `<span class="vault-expiry-badge soon" title="Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}" role="img" aria-label="Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}"><span aria-hidden="true">🕐</span></span>`,
        daysLeft,
        label: `Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
      };
    } else if (daysLeft <= 30) {
      // Expires within a month
      return {
        status: 'warning',
        badge: `<span class="vault-expiry-badge warning" title="Expire dans ${daysLeft} jours" role="img" aria-label="Expire dans ${daysLeft} jours"><span aria-hidden="true">📅</span></span>`,
        daysLeft,
        label: `Expire dans ${daysLeft} jours`
      };
    }

    // Valid, not expiring soon
    return {
      status: 'valid',
      badge: '',
      daysLeft,
      label: `Expire le ${expiresAt.toLocaleDateString('fr-FR')}`
    };
  }

  #getFolderColor(folderId) {
    const colors = JSON.parse(localStorage.getItem('vault-folder-colors') || '{}');
    return colors[folderId] || null;
  }

  #setFolderColor(folderId, color) {
    const colors = JSON.parse(localStorage.getItem('vault-folder-colors') || '{}');
    if (color) {
      colors[folderId] = color;
    } else {
      delete colors[folderId];
    }
    localStorage.setItem('vault-folder-colors', JSON.stringify(colors));
  }

  #showFolderColorPicker(folderId, x, y) {
    document.querySelector('.vault-color-picker')?.remove();

    const folderColors = [
      { color: null, label: 'Par défaut' },
      { color: '#ef4444', label: 'Rouge' },
      { color: '#f97316', label: 'Orange' },
      { color: '#eab308', label: 'Jaune' },
      { color: '#22c55e', label: 'Vert' },
      { color: '#06b6d4', label: 'Cyan' },
      { color: '#3b82f6', label: 'Bleu' },
      { color: '#8b5cf6', label: 'Violet' },
      { color: '#ec4899', label: 'Rose' }
    ];

    const currentColor = this.#getFolderColor(folderId);

    const picker = document.createElement('div');
    picker.className = 'vault-color-picker';
    picker.innerHTML = `
      <div class="vault-color-picker-header">Couleur du dossier</div>
      <div class="vault-color-picker-grid">
        ${folderColors.map(c => `
          <button class="vault-color-option ${c.color === currentColor || (!c.color && !currentColor) ? 'active' : ''}"
                  data-color="${c.color || ''}"
                  title="${c.label}"
                  style="${c.color ? `background: ${c.color}` : 'background: var(--vault-text-muted)'}">
            ${c.color === currentColor || (!c.color && !currentColor) ? '✓' : ''}
          </button>
        `).join('')}
      </div>
    `;

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
        this.#showToast('Couleur mise à jour', 'success');
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

  #showTimeoutSettings() {
    // Remove existing popover
    document.querySelector('.vault-timeout-settings')?.remove();

    const timerEl = document.getElementById('lock-timer');
    if (!timerEl) return;

    const timeoutOptions = [
      { value: 60, label: '1 minute' },
      { value: 120, label: '2 minutes' },
      { value: 300, label: '5 minutes' },
      { value: 600, label: '10 minutes' },
      { value: 900, label: '15 minutes' },
      { value: 1800, label: '30 minutes' }
    ];

    const popover = document.createElement('div');
    popover.className = 'vault-timeout-settings';
    popover.innerHTML = `
      <div class="vault-timeout-header">
        <span>Délai de verrouillage</span>
      </div>
      <div class="vault-timeout-options">
        ${timeoutOptions.map(opt => `
          <button class="vault-timeout-option ${opt.value === this.#autoLockTimeout ? 'active' : ''}"
                  data-timeout="${opt.value}">
            ${opt.label}
          </button>
        `).join('')}
      </div>
    `;

    timerEl.appendChild(popover);

    // Event handlers
    popover.querySelectorAll('.vault-timeout-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTimeout = parseInt(btn.dataset.timeout, 10);
        this.#autoLockTimeout = newTimeout;
        this.#autoLockSeconds = newTimeout;
        localStorage.setItem('vault-autolock-timeout', newTimeout.toString());

        // Update UI
        popover.querySelectorAll('.vault-timeout-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.#showToast(`Délai: ${btn.textContent.trim()}`, 'success');
        popover.remove();
      });
    });

    // Close on click outside
    setTimeout(() => {
      const handler = (e) => {
        if (!popover.contains(e.target) && e.target.id !== 'timer-settings') {
          popover.remove();
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
      console.error('[VaultUI] Hello init error:', error);
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
      helloBtn.title = isEnabled ? 'Windows Hello (activé)' : 'Windows Hello (désactivé)';
    } catch (error) {
      console.error('[VaultUI] Hello state check error:', error);
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
              ? 'Windows Hello est activé pour ce coffre. Vous pouvez déverrouiller avec votre empreinte ou votre visage.'
              : 'Activez Windows Hello pour déverrouiller ce coffre avec votre empreinte digitale ou votre visage.'
            }
          </p>
          ${isEnabled ? `
            <button class="vault-btn vault-btn-sm vault-btn-danger" id="hello-disable">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Désactiver
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

      helloBtn.parentElement.appendChild(popover);

      // Position popover
      const btnRect = helloBtn.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      popover.style.top = `${btnRect.bottom + 8}px`;
      popover.style.right = `${window.innerWidth - btnRect.right}px`;

      // Event handlers
      if (isEnabled) {
        popover.querySelector('#hello-disable')?.addEventListener('click', async () => {
          await this.#disableWindowsHello(state.vaultId);
          popover.remove();
        });
      } else {
        popover.querySelector('#hello-enable')?.addEventListener('click', async () => {
          popover.remove();
          await this.#enableWindowsHello(state.vaultId);
        });
      }

      // Close on click outside
      setTimeout(() => {
        const handler = (e) => {
          if (!popover.contains(e.target) && e.target.id !== 'hello-settings') {
            popover.remove();
            document.removeEventListener('click', handler);
          }
        };
        document.addEventListener('click', handler);
      }, 0);
    } catch (error) {
      console.error('[VaultUI] Hello settings error:', error);
      this.#showToast('Erreur Windows Hello', 'error');
    }
  }

  /**
   * Enable Windows Hello for current vault
   * @param {string} vaultId - Vault ID
   */
  async #enableWindowsHello(vaultId) {
    // Need master password to enable Windows Hello
    const password = await this.#promptPassword('Entrez votre mot de passe pour activer Windows Hello');
    if (!password) return;

    try {
      this.#showToast('Activation Windows Hello...', 'info');
      await window.vault.hello.enable(vaultId, password);
      this.#showToast('Windows Hello activé', 'success');
      await this.#updateHelloButtonState();
    } catch (error) {
      console.error('[VaultUI] Hello enable error:', error);
      this.#showToast(error.message || 'Échec activation Windows Hello', 'error');
    }
  }

  /**
   * Disable Windows Hello for current vault
   * @param {string} vaultId - Vault ID
   */
  async #disableWindowsHello(vaultId) {
    try {
      await window.vault.hello.disable(vaultId);
      this.#showToast('Windows Hello désactivé', 'success');
      await this.#updateHelloButtonState();
    } catch (error) {
      console.error('[VaultUI] Hello disable error:', error);
      this.#showToast(error.message || 'Échec désactivation', 'error');
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
            <h3>Vérification requise</h3>
            <button type="button" class="vault-modal-close" data-close aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-body" id="pwd-prompt-form">
            <p class="vault-modal-message">${this.#escapeHtml(message)}</p>
            <div class="vault-form-group">
              <div class="vault-input-group">
                <input type="password" class="vault-input" id="pwd-prompt-input"
                       placeholder="Mot de passe" autocomplete="current-password" required autofocus>
                <button type="button" class="vault-input-btn toggle-pwd-visibility" data-target="pwd-prompt-input">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" data-close>Annuler</button>
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
    document.addEventListener('keydown', (e) => {
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

      // Delete - Delete selected entry
      if (e.key === 'Delete' && !e.target.matches('input, textarea, select') && this.#selectedEntry) {
        e.preventDefault();
        this.#deleteEntryWithUndo(this.#selectedEntry);
      }

      // ? - Show shortcuts modal
      if (e.key === '?' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        this.#openModal('shortcuts-modal');
      }

      // Ctrl+U - Copy username
      if (e.ctrlKey && e.key === 'u' && this.#selectedEntry?.data?.username) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.username, 'Identifiant copié');
      }

      // Ctrl+P - Copy password (custom handler, prevent print)
      if (e.ctrlKey && e.key === 'p' && this.#selectedEntry?.data?.password) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.password, 'Mot de passe copié');
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
    });

    // Reset auto-lock on mouse activity
    this.#container.addEventListener('mousemove', () => this.#resetAutoLock(), { passive: true });
    this.#container.addEventListener('click', () => this.#resetAutoLock(), { passive: true });
  }

  /** Clipboard clear timeout in ms (60 seconds default) */
  #CLIPBOARD_CLEAR_TIMEOUT = 60000;

  async #copyToClipboard(text, message, autoClear = true) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.#showToast(message, 'success');

      // Auto-clear clipboard after timeout for sensitive data
      if (autoClear) {
        if (this.#clipboardTimeout) {
          clearTimeout(this.#clipboardTimeout);
        }

        // Load user preference
        const savedTimeout = localStorage.getItem('vault-clipboard-timeout');
        const timeout = savedTimeout ? parseInt(savedTimeout, 10) : this.#CLIPBOARD_CLEAR_TIMEOUT;

        this.#clipboardTimeout = setTimeout(async () => {
          try {
            // SECURITY: Overwrite with spaces first to prevent recovery
            // Some clipboard managers cache data - overwriting helps
            await navigator.clipboard.writeText(' '.repeat(text.length));
            await navigator.clipboard.writeText('');
          } catch {
            // Silently fail if clipboard can't be cleared
          }
        }, timeout);
      }
    } catch {
      this.#showToast('Erreur de copie', 'error');
    }
  }

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
      <span class="toast-message">${this.#escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Fermer">&times;</button>
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
        <span class="toast-title">${this.#escapeHtml(title)}</span>
        <span class="toast-suggestion">${this.#escapeHtml(suggestion)}</span>
      </div>
      <button class="toast-close" aria-label="Fermer">&times;</button>
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
      <span class="toast-message">${this.#escapeHtml(message)}</span>
      <button class="toast-undo-btn" aria-label="Annuler">Annuler</button>
      <button class="toast-close" aria-label="Fermer">&times;</button>
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
      if (!undone && toast.parentNode) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
        if (onConfirm) await onConfirm();
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
      <span class="toast-message">Verrouillage automatique dans 30 secondes</span>
      <button class="toast-action-btn" aria-label="Rester connecté">Rester connecté</button>
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

  #escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  #formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  #formatDateTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('fr-FR');
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
      return `<span class="vault-favicon-placeholder" style="width:${size}px;height:${size}px">${this.#getDefaultFaviconSvg()}</span>`;
    }
    const faviconUrl = this.#getFaviconUrl(domain);
    return `<img src="${faviconUrl}"
                 class="vault-favicon"
                 style="width:${size}px;height:${size}px"
                 alt=""
                 loading="lazy"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="vault-favicon-placeholder" style="width:${size}px;height:${size}px;display:none">${this.#getDefaultFaviconSvg()}</span>`;
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

  #renderNoVaultAPI() {
    this.#container.innerHTML = `
      <div class="vault-empty">
        <div class="vault-empty-icon">⚠️</div>
        <h3>Coffre non disponible</h3>
        <p>L'API du coffre n'est pas disponible dans ce contexte.</p>
        <p class="vault-help-text">Le coffre-fort nécessite l'application Electron pour fonctionner.</p>
      </div>
    `;
  }
}

export default VaultUI;
