/**
 * @fileoverview Vault UI Component - Professional Password Manager UX
 * Inspired by KeePassXC, RoboForm, and modern password managers
 *
 * Layout: 3-panel design
 * - Left sidebar: Folders, categories, filters
 * - Center: Entry list with quick actions
 * - Right: Entry detail panel
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

/**
 * Vault UI Controller
 */
export class VaultUI {
  #container;
  #currentView = 'lock';
  #selectedEntry = null;
  #selectedCategory = 'all';
  #selectedFolder = null;
  #entries = [];
  #folders = [];
  #tags = [];
  #searchQuery = '';
  #autoLockTimer = null;
  #autoLockSeconds = 300;
  #unsubscribeLocked = null;
  #unsubscribeUnlocked = null;
  #unsubscribeChanged = null;

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
      this.#stopAutoLockTimer();
      this.#render();
    });

    this.#unsubscribeUnlocked = window.vault.on('unlocked', async () => {
      this.#currentView = 'main';
      await this.#loadData();
      this.#startAutoLockTimer();
      this.#render();
    });

    this.#unsubscribeChanged = window.vault.on('changed', async () => {
      await this.#loadData();
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
      const [entries, folders, tags] = await Promise.all([
        window.vault.entries.getAll(),
        window.vault.folders.getAll(),
        window.vault.tags.getAll()
      ]);
      this.#entries = entries || [];
      this.#folders = folders || [];
      this.#tags = tags || [];
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

          <div class="vault-selector" id="vault-selector">
            <div class="vault-loading"><div class="vault-spinner"></div></div>
          </div>

          <form class="vault-unlock-form" id="unlock-form">
            <div class="vault-input-group">
              <input type="password" class="vault-input" id="vault-password"
                     placeholder="Mot de passe principal" autocomplete="current-password">
              <button type="button" class="vault-input-btn" id="toggle-password" title="Afficher">
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
              Déverrouiller
            </button>
          </form>

          <div class="vault-lock-actions">
            <button type="button" class="vault-link-btn" id="btn-create-vault">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Nouveau coffre
            </button>
          </div>
        </div>
      </div>
      ${this.#renderCreateVaultModal()}
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
            <p>Aucun coffre trouvé</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="vault-list">
          ${vaults.map((v, i) => `
            <div class="vault-list-item ${i === 0 ? 'selected' : ''}" data-vault-id="${v.id}">
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
              <div class="vault-list-check">✓</div>
            </div>
          `).join('')}
        </div>
      `;

      // Click events
      container.querySelectorAll('.vault-list-item').forEach(item => {
        item.addEventListener('click', () => {
          container.querySelectorAll('.vault-list-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
        });
      });
    } catch (error) {
      container.innerHTML = `<div class="vault-error">Erreur de chargement</div>`;
    }
  }

  #attachLockScreenEvents() {
    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
      const input = document.getElementById('vault-password');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
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
        return;
      }

      const btn = document.getElementById('btn-unlock');
      btn.disabled = true;
      btn.innerHTML = '<div class="vault-spinner-small"></div> Déverrouillage...';

      try {
        await window.vault.unlock(selected.dataset.vaultId, password);
      } catch (error) {
        this.#showToast(error.message || 'Mot de passe incorrect', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Déverrouiller';
      }
    });

    // Create vault
    document.getElementById('btn-create-vault')?.addEventListener('click', () => {
      document.getElementById('create-vault-modal')?.classList.add('active');
      document.getElementById('new-vault-name')?.focus();
    });

    this.#attachCreateVaultEvents();
  }

  #renderCreateVaultModal() {
    return `
      <div class="vault-modal-overlay" id="create-vault-modal">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3>Nouveau coffre</h3>
            <button type="button" class="vault-modal-close" id="close-create-modal">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-form" id="create-vault-form">
            <div class="vault-form-group">
              <label class="vault-label">Nom du coffre</label>
              <input type="text" class="vault-input" id="new-vault-name" placeholder="Mon coffre" required>
            </div>
            <div class="vault-form-group">
              <label class="vault-label">Mot de passe principal</label>
              <input type="password" class="vault-input" id="new-vault-password" placeholder="••••••••" required>
              <div class="vault-password-strength" id="password-strength"></div>
            </div>
            <div class="vault-form-group">
              <label class="vault-label">Confirmer le mot de passe</label>
              <input type="password" class="vault-input" id="new-vault-confirm" placeholder="••••••••" required>
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" id="cancel-create">Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Créer le coffre</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #attachCreateVaultEvents() {
    const closeModal = () => document.getElementById('create-vault-modal')?.classList.remove('active');

    document.getElementById('close-create-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-create')?.addEventListener('click', closeModal);

    // Password strength
    document.getElementById('new-vault-password')?.addEventListener('input', (e) => {
      const strength = this.#calculatePasswordStrength(e.target.value);
      const el = document.getElementById('password-strength');
      if (el) {
        el.innerHTML = `<div class="strength-bar strength-${strength.level}"></div><span>${strength.label}</span>`;
      }
    });

    document.getElementById('create-vault-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-vault-name')?.value;
      const password = document.getElementById('new-vault-password')?.value;
      const confirm = document.getElementById('new-vault-confirm')?.value;

      if (password !== confirm) {
        this.#showToast('Les mots de passe ne correspondent pas', 'error');
        return;
      }
      if (password.length < 8) {
        this.#showToast('Minimum 8 caractères requis', 'error');
        return;
      }

      try {
        await window.vault.create(name, password);
        closeModal();
        this.#showToast('Coffre créé avec succès', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Erreur de création', 'error');
      }
    });
  }

  // ==================== MAIN VIEW (3-panel layout) ====================

  #renderMainView() {
    const filteredEntries = this.#getFilteredEntries();

    this.#container.innerHTML = `
      <div class="vault-app">
        <!-- Sidebar -->
        <aside class="vault-sidebar">
          <div class="vault-sidebar-header">
            <div class="vault-lock-timer" id="lock-timer" title="Verrouillage automatique">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span id="lock-countdown">5:00</span>
            </div>
            <button class="vault-icon-btn" id="btn-lock" title="Verrouiller (Ctrl+L)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          </div>

          <div class="vault-sidebar-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" class="vault-search-input" id="vault-search"
                   placeholder="Rechercher... (Ctrl+F)" value="${this.#escapeHtml(this.#searchQuery)}">
          </div>

          <nav class="vault-nav">
            <div class="vault-nav-section">
              <div class="vault-nav-title">Catégories</div>
              ${CATEGORIES.map(cat => `
                <button class="vault-nav-item ${this.#selectedCategory === cat.id ? 'active' : ''}"
                        data-category="${cat.id}">
                  <span class="vault-nav-icon">${cat.icon}</span>
                  <span class="vault-nav-label">${cat.label}</span>
                  <span class="vault-nav-count">${this.#getCategoryCount(cat.id)}</span>
                </button>
              `).join('')}
            </div>

            ${this.#folders.length > 0 ? `
              <div class="vault-nav-section">
                <div class="vault-nav-title">Dossiers</div>
                ${this.#folders.map(folder => `
                  <button class="vault-nav-item ${this.#selectedFolder === folder.id ? 'active' : ''}"
                          data-folder="${folder.id}">
                    <span class="vault-nav-icon">📂</span>
                    <span class="vault-nav-label">${this.#escapeHtml(folder.name)}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </nav>

          <div class="vault-sidebar-footer">
            <button class="vault-btn vault-btn-primary vault-btn-full" id="btn-add-entry">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nouvelle entrée
            </button>
          </div>
        </aside>

        <!-- Entry List -->
        <main class="vault-list-panel">
          <div class="vault-list-header">
            <h2 class="vault-list-title">${this.#getCurrentCategoryLabel()}</h2>
            <span class="vault-list-count">${filteredEntries.length} entrée(s)</span>
          </div>

          <div class="vault-entries" id="vault-entries">
            ${filteredEntries.length === 0
              ? this.#renderEmptyState()
              : filteredEntries.map(entry => this.#renderEntryRow(entry)).join('')
            }
          </div>
        </main>

        <!-- Detail Panel -->
        <aside class="vault-detail-panel ${this.#selectedEntry ? 'active' : ''}" id="detail-panel">
          ${this.#selectedEntry ? this.#renderEntryDetail() : this.#renderNoSelection()}
        </aside>
      </div>
      ${this.#renderAddEntryModal()}
    `;

    this.#attachMainViewEvents();
    this.#updateLockCountdown();
  }

  #renderEntryRow(entry) {
    const type = ENTRY_TYPES[entry.type] || ENTRY_TYPES.login;
    const subtitle = entry.data?.username || entry.data?.url || type.label;
    const isSelected = this.#selectedEntry?.id === entry.id;
    const isFavorite = entry.favorite;

    return `
      <div class="vault-entry-row ${isSelected ? 'selected' : ''}" data-entry-id="${entry.id}">
        <div class="vault-entry-icon" style="background: ${type.color}20; color: ${type.color}">
          ${type.icon}
        </div>
        <div class="vault-entry-content">
          <div class="vault-entry-title">
            ${isFavorite ? '<span class="vault-favorite">⭐</span>' : ''}
            ${this.#escapeHtml(entry.title)}
          </div>
          <div class="vault-entry-subtitle">${this.#escapeHtml(subtitle)}</div>
        </div>
        <div class="vault-entry-actions">
          ${entry.type === 'login' && entry.data?.username ? `
            <button class="vault-quick-btn" data-action="copy-username" title="Copier l'identifiant (Ctrl+B)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          ` : ''}
          ${entry.type === 'login' && entry.data?.password ? `
            <button class="vault-quick-btn" data-action="copy-password" title="Copier le mot de passe (Ctrl+C)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
          ` : ''}
          ${entry.data?.url ? `
            <button class="vault-quick-btn" data-action="open-url" title="Ouvrir le site">
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
        <div class="vault-detail-icon" style="background: ${type.color}20; color: ${type.color}">
          ${type.icon}
        </div>
        <div class="vault-detail-info">
          <h3 class="vault-detail-title">${this.#escapeHtml(entry.title)}</h3>
          <span class="vault-detail-type">${type.label}</span>
        </div>
        <div class="vault-detail-actions">
          <button class="vault-icon-btn" id="btn-toggle-favorite" title="${entry.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
            ${entry.favorite ? '⭐' : '☆'}
          </button>
          <button class="vault-icon-btn" id="btn-edit-entry" title="Modifier">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="vault-icon-btn danger" id="btn-delete-entry" title="Supprimer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="vault-detail-body">
        ${this.#renderEntryFields(entry)}

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
          ${this.#renderField('URL', entry.data?.url, 'url', false, true, true)}
          ${entry.notes ? this.#renderField('Notes', entry.notes, 'notes') : ''}
        `;
      case 'note':
        return `
          <div class="vault-field">
            <label class="vault-field-label">Contenu</label>
            <div class="vault-field-note">${this.#escapeHtml(entry.data?.content || '').replace(/\n/g, '<br>')}</div>
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

    const displayValue = masked ? '••••••••••••' : this.#escapeHtml(value);
    const strengthHtml = key === 'password' ? this.#renderPasswordStrength(value) : '';

    return `
      <div class="vault-field" data-key="${key}">
        <label class="vault-field-label">${label}</label>
        <div class="vault-field-value">
          <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${this.#escapeHtml(value)}">
            ${isUrl ? `<a href="${this.#escapeHtml(value)}" target="_blank" rel="noopener">${displayValue}</a>` : displayValue}
          </span>
          <div class="vault-field-actions">
            ${masked ? `
              <button class="vault-field-btn toggle-visibility" title="Afficher/Masquer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            ` : ''}
            ${copyable ? `
              <button class="vault-field-btn copy-field" data-value="${this.#escapeHtml(value)}" title="Copier">
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

  #renderPasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    return `<div class="vault-password-meter"><div class="meter-fill strength-${strength.level}" style="width: ${strength.percent}%"></div></div>`;
  }

  #renderEmptyState() {
    if (this.#searchQuery) {
      return `
        <div class="vault-empty">
          <div class="vault-empty-icon">🔍</div>
          <h3>Aucun résultat</h3>
          <p>Aucune entrée ne correspond à "${this.#escapeHtml(this.#searchQuery)}"</p>
        </div>
      `;
    }

    return `
      <div class="vault-empty">
        <div class="vault-empty-icon">🔐</div>
        <h3>Coffre vide</h3>
        <p>Cliquez sur "Nouvelle entrée" pour commencer</p>
      </div>
    `;
  }

  #renderNoSelection() {
    return `
      <div class="vault-no-selection">
        <div class="vault-no-selection-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <p>Sélectionnez une entrée pour voir les détails</p>
      </div>
    `;
  }

  #renderAddEntryModal() {
    return `
      <div class="vault-modal-overlay" id="add-entry-modal">
        <div class="vault-modal vault-modal-lg">
          <div class="vault-modal-header">
            <h3>Nouvelle entrée</h3>
            <button type="button" class="vault-modal-close" id="close-add-modal">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <form class="vault-modal-form" id="add-entry-form">
            <div class="vault-type-selector">
              ${Object.entries(ENTRY_TYPES).filter(([k]) => k !== 'preset' && k !== 'ssh').map(([key, type]) => `
                <label class="vault-type-option">
                  <input type="radio" name="entry-type" value="${key}" ${key === 'login' ? 'checked' : ''}>
                  <span class="vault-type-card">
                    <span class="vault-type-icon" style="color: ${type.color}">${type.icon}</span>
                    <span class="vault-type-label">${type.label}</span>
                  </span>
                </label>
              `).join('')}
            </div>

            <div class="vault-form-group">
              <label class="vault-label">Titre *</label>
              <input type="text" class="vault-input" id="entry-title" placeholder="Ex: Gmail, Amazon..." required>
            </div>

            <div id="entry-type-fields"></div>

            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" id="cancel-add-entry">Annuler</button>
              <button type="submit" class="vault-btn vault-btn-primary">Ajouter</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  #attachMainViewEvents() {
    // Lock button
    document.getElementById('btn-lock')?.addEventListener('click', () => this.#lock());

    // Search
    document.getElementById('vault-search')?.addEventListener('input', (e) => {
      this.#searchQuery = e.target.value;
      this.#render();
    });

    // Category navigation
    document.querySelectorAll('.vault-nav-item[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#selectedCategory = btn.dataset.category;
        this.#selectedFolder = null;
        this.#render();
      });
    });

    // Folder navigation
    document.querySelectorAll('.vault-nav-item[data-folder]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#selectedFolder = btn.dataset.folder;
        this.#selectedCategory = 'all';
        this.#render();
      });
    });

    // Entry rows
    document.querySelectorAll('.vault-entry-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.vault-quick-btn')) return;
        const entry = this.#entries.find(en => en.id === row.dataset.entryId);
        if (entry) {
          this.#selectedEntry = entry;
          this.#render();
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
          window.open(entry.data.url, '_blank');
        }
      });
    });

    // Add entry button
    document.getElementById('btn-add-entry')?.addEventListener('click', () => {
      document.getElementById('add-entry-modal')?.classList.add('active');
      this.#updateEntryTypeFields();
    });

    // Detail panel events
    this.#attachDetailPanelEvents();

    // Add entry modal events
    this.#attachAddEntryEvents();
  }

  #attachDetailPanelEvents() {
    // Toggle visibility
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.closest('.vault-field-value');
        const textEl = field?.querySelector('.vault-field-text');
        if (!textEl) return;

        const isMasked = textEl.classList.contains('masked');
        textEl.textContent = isMasked ? textEl.dataset.value : '••••••••••••';
        textEl.classList.toggle('masked');
      });
    });

    // Copy field
    document.querySelectorAll('.copy-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.#copyToClipboard(btn.dataset.value, 'Copié');
      });
    });

    // Favorite toggle
    document.getElementById('btn-toggle-favorite')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      try {
        await window.vault.entries.update(this.#selectedEntry.id, {
          favorite: !this.#selectedEntry.favorite
        });
      } catch (error) {
        this.#showToast('Erreur', 'error');
      }
    });

    // Delete entry
    document.getElementById('btn-delete-entry')?.addEventListener('click', async () => {
      if (!this.#selectedEntry) return;
      if (!confirm(`Supprimer "${this.#selectedEntry.title}" ?`)) return;

      try {
        await window.vault.entries.delete(this.#selectedEntry.id);
        this.#selectedEntry = null;
        this.#showToast('Entrée supprimée', 'success');
      } catch (error) {
        this.#showToast('Erreur de suppression', 'error');
      }
    });
  }

  #attachAddEntryEvents() {
    const closeModal = () => document.getElementById('add-entry-modal')?.classList.remove('active');

    document.getElementById('close-add-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-add-entry')?.addEventListener('click', closeModal);

    // Type change
    document.querySelectorAll('input[name="entry-type"]').forEach(radio => {
      radio.addEventListener('change', () => this.#updateEntryTypeFields());
    });

    // Form submit
    document.getElementById('add-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.querySelector('input[name="entry-type"]:checked')?.value;
      const title = document.getElementById('entry-title')?.value;

      if (!type || !title) {
        this.#showToast('Remplissez tous les champs obligatoires', 'warning');
        return;
      }

      const data = this.#collectEntryFormData(type);

      try {
        const newEntry = await window.vault.entries.add(type, title, data);
        closeModal();
        this.#selectedEntry = newEntry;
        this.#showToast('Entrée ajoutée', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Erreur', 'error');
      }
    });
  }

  #updateEntryTypeFields() {
    const type = document.querySelector('input[name="entry-type"]:checked')?.value || 'login';
    const container = document.getElementById('entry-type-fields');
    if (!container) return;

    const fields = {
      login: `
        <div class="vault-form-row">
          <div class="vault-form-group">
            <label class="vault-label">Identifiant / Email</label>
            <input type="text" class="vault-input" id="entry-username" placeholder="utilisateur@example.com">
          </div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label">Mot de passe</label>
          <div class="vault-input-group">
            <input type="password" class="vault-input" id="entry-password" placeholder="••••••••">
            <button type="button" class="vault-input-btn" id="generate-password" title="Générer">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
            </button>
          </div>
          <div class="vault-password-strength" id="entry-password-strength"></div>
        </div>
        <div class="vault-form-group">
          <label class="vault-label">URL</label>
          <input type="url" class="vault-input" id="entry-url" placeholder="https://example.com">
        </div>
        <div class="vault-form-group">
          <label class="vault-label">Notes</label>
          <textarea class="vault-input vault-textarea" id="entry-notes" rows="2" placeholder="Notes optionnelles..."></textarea>
        </div>
      `,
      note: `
        <div class="vault-form-group">
          <label class="vault-label">Contenu *</label>
          <textarea class="vault-input vault-textarea" id="entry-content" rows="6" placeholder="Votre note sécurisée..." required></textarea>
        </div>
      `,
      card: `
        <div class="vault-form-group">
          <label class="vault-label">Titulaire</label>
          <input type="text" class="vault-input" id="entry-holder" placeholder="JEAN DUPONT">
        </div>
        <div class="vault-form-row">
          <div class="vault-form-group">
            <label class="vault-label">Numéro de carte</label>
            <input type="text" class="vault-input" id="entry-cardnumber" placeholder="1234 5678 9012 3456">
          </div>
        </div>
        <div class="vault-form-row">
          <div class="vault-form-group">
            <label class="vault-label">Expiration</label>
            <input type="text" class="vault-input" id="entry-expiry" placeholder="MM/AA">
          </div>
          <div class="vault-form-group">
            <label class="vault-label">CVV</label>
            <input type="password" class="vault-input" id="entry-cvv" placeholder="123" maxlength="4">
          </div>
        </div>
      `,
      identity: `
        <div class="vault-form-group">
          <label class="vault-label">Nom complet</label>
          <input type="text" class="vault-input" id="entry-fullname" placeholder="Jean Dupont">
        </div>
        <div class="vault-form-group">
          <label class="vault-label">Email</label>
          <input type="email" class="vault-input" id="entry-email" placeholder="jean@example.com">
        </div>
        <div class="vault-form-group">
          <label class="vault-label">Téléphone</label>
          <input type="tel" class="vault-input" id="entry-phone" placeholder="+33 6 12 34 56 78">
        </div>
      `
    };

    container.innerHTML = fields[type] || '';

    // Password generation & strength
    if (type === 'login') {
      document.getElementById('generate-password')?.addEventListener('click', () => {
        const pwd = this.#generatePassword();
        const input = document.getElementById('entry-password');
        if (input) {
          input.value = pwd;
          input.type = 'text';
          this.#updatePasswordStrength(pwd);
        }
      });

      document.getElementById('entry-password')?.addEventListener('input', (e) => {
        this.#updatePasswordStrength(e.target.value);
      });
    }
  }

  #updatePasswordStrength(password) {
    const strength = this.#calculatePasswordStrength(password);
    const el = document.getElementById('entry-password-strength');
    if (el) {
      el.innerHTML = `<div class="strength-bar strength-${strength.level}"></div><span>${strength.label}</span>`;
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

  // ==================== HELPERS ====================

  #getFilteredEntries() {
    let entries = [...this.#entries];

    // Search filter
    if (this.#searchQuery) {
      const q = this.#searchQuery.toLowerCase();
      entries = entries.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.data?.username?.toLowerCase().includes(q) ||
        e.data?.url?.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (this.#selectedCategory === 'favorites') {
      entries = entries.filter(e => e.favorite);
    } else if (this.#selectedCategory === 'recent') {
      entries = entries.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 10);
    } else if (this.#selectedCategory !== 'all') {
      entries = entries.filter(e => e.type === this.#selectedCategory);
    }

    // Folder filter
    if (this.#selectedFolder) {
      entries = entries.filter(e => e.folderId === this.#selectedFolder);
    }

    return entries;
  }

  #getCategoryCount(categoryId) {
    if (categoryId === 'all') return this.#entries.length;
    if (categoryId === 'favorites') return this.#entries.filter(e => e.favorite).length;
    if (categoryId === 'recent') return Math.min(10, this.#entries.length);
    return this.#entries.filter(e => e.type === categoryId).length;
  }

  #getCurrentCategoryLabel() {
    const cat = CATEGORIES.find(c => c.id === this.#selectedCategory);
    if (cat) return cat.label;
    const folder = this.#folders.find(f => f.id === this.#selectedFolder);
    return folder?.name || 'Entrées';
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

  #generatePassword(length = 20) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
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
    this.#autoLockSeconds = 300; // 5 minutes
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
    if (el) {
      const mins = Math.floor(this.#autoLockSeconds / 60);
      const secs = this.#autoLockSeconds % 60;
      el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  }

  #resetAutoLock() {
    this.#autoLockSeconds = 300;
    window.vault.resetActivity?.();
  }

  #bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
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
        document.getElementById('add-entry-modal')?.classList.add('active');
      }

      // Ctrl+B - Copy username
      if (e.ctrlKey && e.key === 'b' && this.#selectedEntry?.data?.username) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.username, 'Identifiant copié');
      }

      // Ctrl+C - Copy password (when not in input)
      if (e.ctrlKey && e.key === 'c' && !e.target.matches('input, textarea') && this.#selectedEntry?.data?.password) {
        e.preventDefault();
        this.#copyToClipboard(this.#selectedEntry.data.password, 'Mot de passe copié');
      }

      // Reset auto-lock on any key
      this.#resetAutoLock();
    });

    // Reset auto-lock on mouse activity
    this.#container.addEventListener('mousemove', () => this.#resetAutoLock(), { passive: true });
  }

  async #copyToClipboard(text, message) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.#showToast(message, 'success');
    } catch {
      this.#showToast('Erreur de copie', 'error');
    }
  }

  #showToast(message, type = 'info') {
    const container = document.getElementById('toasts') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
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

  #renderNoVaultAPI() {
    this.#container.innerHTML = `
      <div class="vault-empty">
        <div class="vault-empty-icon">⚠️</div>
        <h3>Coffre non disponible</h3>
        <p>L'API du coffre n'est pas disponible dans ce contexte.</p>
      </div>
    `;
  }
}

export default VaultUI;
