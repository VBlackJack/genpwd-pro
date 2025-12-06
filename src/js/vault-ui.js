/**
 * @fileoverview Vault UI Component
 * GenPwd Pro - Encrypted Password Vault Interface
 *
 * Usage:
 *   import { VaultUI } from './vault-ui.js';
 *   const vaultUI = new VaultUI(containerElement);
 *   vaultUI.init();
 */

/**
 * Entry type icons
 */
const ENTRY_ICONS = {
  login: '🔑',
  note: '📝',
  card: '💳',
  identity: '👤',
  ssh: '🔐',
  preset: '⚙️'
};

/**
 * Entry type labels
 */
const ENTRY_LABELS = {
  login: 'Identifiant',
  note: 'Note sécurisée',
  card: 'Carte bancaire',
  identity: 'Identité',
  ssh: 'Clé SSH',
  preset: 'Preset'
};

/**
 * Vault UI Controller
 */
export class VaultUI {
  /** @type {HTMLElement} */
  #container;

  /** @type {string} */
  #currentView = 'lock'; // lock | list | detail | create

  /** @type {Object|null} */
  #selectedEntry = null;

  /** @type {Array} */
  #entries = [];

  /** @type {Array} */
  #folders = [];

  /** @type {string} */
  #searchQuery = '';

  /** @type {Function|null} */
  #unsubscribeLocked = null;

  /** @type {Function|null} */
  #unsubscribeUnlocked = null;

  /**
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.#container = container;
  }

  /**
   * Initialize vault UI
   */
  async init() {
    // Check if vault API is available
    if (!window.vault) {
      this.#container.innerHTML = `
        <div class="vault-empty">
          <div class="vault-empty-icon">⚠️</div>
          <h3>Coffre non disponible</h3>
          <p>L'API du coffre n'est pas disponible. Vérifiez que vous utilisez l'application desktop.</p>
        </div>
      `;
      return;
    }

    // Subscribe to vault events
    this.#unsubscribeLocked = window.vault.on('locked', () => {
      this.#currentView = 'lock';
      this.#entries = [];
      this.#render();
    });

    this.#unsubscribeUnlocked = window.vault.on('unlocked', async () => {
      this.#currentView = 'list';
      await this.#loadEntries();
      this.#render();
    });

    // Check initial state
    try {
      const state = await window.vault.getState();
      if (state.status === 'unlocked') {
        this.#currentView = 'list';
        await this.#loadEntries();
      }
    } catch (error) {
      console.error('[VaultUI] Error checking state:', error);
    }

    this.#render();
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.#unsubscribeLocked) this.#unsubscribeLocked();
    if (this.#unsubscribeUnlocked) this.#unsubscribeUnlocked();
  }

  /**
   * Load entries from vault
   */
  async #loadEntries() {
    try {
      this.#entries = await window.vault.entries.getAll();
      this.#folders = await window.vault.folders.getAll();
    } catch (error) {
      console.error('[VaultUI] Error loading entries:', error);
      this.#entries = [];
      this.#folders = [];
    }
  }

  /**
   * Main render function
   */
  #render() {
    switch (this.#currentView) {
      case 'lock':
        this.#renderLockScreen();
        break;
      case 'list':
        this.#renderEntryList();
        break;
      case 'detail':
        this.#renderEntryDetail();
        break;
      case 'create':
        this.#renderCreateEntry();
        break;
    }
  }

  /**
   * Render lock screen
   */
  #renderLockScreen() {
    this.#container.innerHTML = `
      <div class="vault-lock-screen">
        <svg class="vault-lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h2>Coffre verrouillé</h2>
        <p>Déverrouillez votre coffre ou créez-en un nouveau</p>

        <div class="vault-selector" id="vault-selector">
          <div class="vault-loading">
            <div class="vault-spinner"></div>
          </div>
        </div>

        <form class="vault-password-form" id="unlock-form">
          <input type="password" class="vault-password-input" id="vault-password"
                 placeholder="Mot de passe principal" autocomplete="current-password">
          <button type="submit" class="vault-btn vault-btn-primary" id="btn-unlock">
            Déverrouiller
          </button>
        </form>

        <div class="vault-actions">
          <button type="button" class="vault-list-btn" id="btn-create-vault">
            + Nouveau coffre
          </button>
        </div>
      </div>

      <!-- Create Vault Modal -->
      <div class="vault-modal-overlay" id="create-vault-modal">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 class="vault-modal-title">Nouveau coffre</h3>
            <button type="button" class="vault-modal-close" id="close-create-modal">✕</button>
          </div>
          <form class="vault-modal-form" id="create-vault-form">
            <div class="vault-form-group">
              <label class="vault-form-label">Nom du coffre</label>
              <input type="text" class="vault-form-input" id="new-vault-name"
                     placeholder="Mon coffre" required>
            </div>
            <div class="vault-form-group">
              <label class="vault-form-label">Mot de passe principal</label>
              <input type="password" class="vault-form-input" id="new-vault-password"
                     placeholder="••••••••" required autocomplete="new-password">
            </div>
            <div class="vault-form-group">
              <label class="vault-form-label">Confirmer le mot de passe</label>
              <input type="password" class="vault-form-input" id="new-vault-confirm"
                     placeholder="••••••••" required autocomplete="new-password">
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" id="cancel-create">
                Annuler
              </button>
              <button type="submit" class="vault-btn vault-btn-primary">
                Créer
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.#loadVaultList();
    this.#attachLockScreenEvents();
  }

  /**
   * Load and display vault list
   */
  async #loadVaultList() {
    const selectorEl = document.getElementById('vault-selector');
    if (!selectorEl) return;

    try {
      const vaults = await window.vault.list();

      if (vaults.length === 0) {
        selectorEl.innerHTML = `
          <div class="vault-empty" style="padding: 20px;">
            <p style="color: var(--text-secondary);">Aucun coffre trouvé. Créez votre premier coffre.</p>
          </div>
        `;
        return;
      }

      selectorEl.innerHTML = `
        <div class="vault-selector-list">
          ${vaults.map((v, i) => `
            <div class="vault-selector-item ${i === 0 ? 'selected' : ''}"
                 data-vault-id="${v.id}">
              <div class="vault-selector-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div class="vault-selector-info">
                <div class="vault-selector-name">${this.#escapeHtml(v.name)}</div>
                <div class="vault-selector-meta">Modifié: ${new Date(v.modifiedAt).toLocaleDateString()}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Attach click events
      selectorEl.querySelectorAll('.vault-selector-item').forEach(item => {
        item.addEventListener('click', () => {
          selectorEl.querySelectorAll('.vault-selector-item').forEach(el =>
            el.classList.remove('selected'));
          item.classList.add('selected');
        });
      });
    } catch (error) {
      console.error('[VaultUI] Error loading vault list:', error);
      selectorEl.innerHTML = `
        <div class="vault-empty" style="padding: 20px;">
          <p style="color: #ef4444;">Erreur lors du chargement des coffres</p>
        </div>
      `;
    }
  }

  /**
   * Attach lock screen event handlers
   */
  #attachLockScreenEvents() {
    // Unlock form
    const unlockForm = document.getElementById('unlock-form');
    unlockForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedVault = document.querySelector('.vault-selector-item.selected');
      const password = document.getElementById('vault-password')?.value;

      if (!selectedVault || !password) {
        this.#showToast('Sélectionnez un coffre et entrez le mot de passe', 'error');
        return;
      }

      const vaultId = selectedVault.dataset.vaultId;
      const btn = document.getElementById('btn-unlock');
      btn.textContent = 'Déverrouillage...';
      btn.disabled = true;

      try {
        await window.vault.unlock(vaultId, password);
        this.#showToast('Coffre déverrouillé', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Mot de passe incorrect', 'error');
        btn.textContent = 'Déverrouiller';
        btn.disabled = false;
      }
    });

    // Create vault button
    document.getElementById('btn-create-vault')?.addEventListener('click', () => {
      document.getElementById('create-vault-modal')?.classList.add('active');
    });

    // Close create modal
    const closeModal = () => {
      document.getElementById('create-vault-modal')?.classList.remove('active');
    };
    document.getElementById('close-create-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-create')?.addEventListener('click', closeModal);

    // Create vault form
    document.getElementById('create-vault-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-vault-name')?.value;
      const password = document.getElementById('new-vault-password')?.value;
      const confirm = document.getElementById('new-vault-confirm')?.value;

      if (!name || !password) {
        this.#showToast('Veuillez remplir tous les champs', 'error');
        return;
      }

      if (password !== confirm) {
        this.#showToast('Les mots de passe ne correspondent pas', 'error');
        return;
      }

      if (password.length < 8) {
        this.#showToast('Le mot de passe doit contenir au moins 8 caractères', 'error');
        return;
      }

      try {
        await window.vault.create(name, password);
        closeModal();
        this.#showToast('Coffre créé et déverrouillé', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Erreur lors de la création', 'error');
      }
    });
  }

  /**
   * Render entry list
   */
  #renderEntryList() {
    const filteredEntries = this.#searchQuery
      ? this.#entries.filter(e =>
          e.title.toLowerCase().includes(this.#searchQuery.toLowerCase()) ||
          e.data?.username?.toLowerCase().includes(this.#searchQuery.toLowerCase())
        )
      : this.#entries;

    this.#container.innerHTML = `
      <div class="vault-header">
        <div class="vault-header-icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            <circle cx="12" cy="16" r="1"></circle>
          </svg>
        </div>
        <div class="vault-header-info">
          <h2 class="vault-header-name" id="vault-name">Mon coffre</h2>
          <p class="vault-header-meta">${this.#entries.length} entrée(s)</p>
        </div>
        <div class="vault-header-actions">
          <button type="button" class="vault-action-btn" id="btn-vault-settings" title="Paramètres">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </button>
          <button type="button" class="vault-action-btn danger" id="btn-vault-lock" title="Verrouiller">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="vault-search">
        <input type="text" class="vault-search-input" id="vault-search"
               placeholder="Rechercher..." value="${this.#escapeHtml(this.#searchQuery)}">
        <button type="button" class="vault-add-btn" id="btn-add-entry">
          + Ajouter
        </button>
      </div>

      <div class="vault-entries" id="vault-entries">
        ${filteredEntries.length === 0
          ? `<div class="vault-empty">
               <div class="vault-empty-icon">🔐</div>
               <h3>${this.#searchQuery ? 'Aucun résultat' : 'Coffre vide'}</h3>
               <p>${this.#searchQuery
                 ? 'Aucune entrée ne correspond à votre recherche'
                 : 'Cliquez sur "Ajouter" pour créer votre première entrée'}</p>
             </div>`
          : filteredEntries.map(entry => this.#renderEntryItem(entry)).join('')
        }
      </div>

      <!-- Add Entry Modal -->
      <div class="vault-modal-overlay" id="add-entry-modal">
        <div class="vault-modal">
          <div class="vault-modal-header">
            <h3 class="vault-modal-title">Nouvelle entrée</h3>
            <button type="button" class="vault-modal-close" id="close-add-modal">✕</button>
          </div>
          <form class="vault-modal-form" id="add-entry-form">
            <div class="vault-form-group">
              <label class="vault-form-label">Type</label>
              <select class="vault-form-input" id="entry-type">
                <option value="login">🔑 Identifiant</option>
                <option value="note">📝 Note sécurisée</option>
                <option value="card">💳 Carte bancaire</option>
                <option value="identity">👤 Identité</option>
              </select>
            </div>
            <div class="vault-form-group">
              <label class="vault-form-label">Titre</label>
              <input type="text" class="vault-form-input" id="entry-title"
                     placeholder="Ex: Gmail, Amazon..." required>
            </div>
            <div id="entry-type-fields">
              <!-- Dynamic fields based on type -->
            </div>
            <div class="vault-modal-actions">
              <button type="button" class="vault-btn vault-btn-secondary" id="cancel-add-entry">
                Annuler
              </button>
              <button type="submit" class="vault-btn vault-btn-primary">
                Ajouter
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.#loadVaultMetadata();
    this.#attachListEvents();
  }

  /**
   * Load vault metadata
   */
  async #loadVaultMetadata() {
    try {
      const metadata = await window.vault.getMetadata();
      if (metadata?.name) {
        const nameEl = document.getElementById('vault-name');
        if (nameEl) nameEl.textContent = metadata.name;
      }
    } catch (error) {
      console.error('[VaultUI] Error loading metadata:', error);
    }
  }

  /**
   * Render a single entry item
   */
  #renderEntryItem(entry) {
    const icon = ENTRY_ICONS[entry.type] || '📄';
    const subtitle = entry.data?.username || entry.data?.url || ENTRY_LABELS[entry.type] || '';

    return `
      <div class="vault-entry" data-entry-id="${entry.id}">
        <div class="vault-entry-icon">${icon}</div>
        <div class="vault-entry-info">
          <div class="vault-entry-title">${this.#escapeHtml(entry.title)}</div>
          <div class="vault-entry-subtitle">${this.#escapeHtml(subtitle)}</div>
        </div>
        <div class="vault-entry-actions">
          ${entry.type === 'login' && entry.data?.password
            ? `<button type="button" class="vault-entry-action copy" data-copy="password" title="Copier le mot de passe">
                 <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                   <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                   <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                 </svg>
               </button>`
            : ''
          }
          <button type="button" class="vault-entry-action" title="Modifier">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach entry list events
   */
  #attachListEvents() {
    // Lock button
    document.getElementById('btn-vault-lock')?.addEventListener('click', async () => {
      try {
        await window.vault.lock();
        this.#showToast('Coffre verrouillé', 'success');
      } catch (error) {
        this.#showToast('Erreur lors du verrouillage', 'error');
      }
    });

    // Search
    document.getElementById('vault-search')?.addEventListener('input', (e) => {
      this.#searchQuery = e.target.value;
      this.#render();
    });

    // Entry click
    document.querySelectorAll('.vault-entry').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons
        if (e.target.closest('.vault-entry-actions')) return;

        const entryId = el.dataset.entryId;
        const entry = this.#entries.find(e => e.id === entryId);
        if (entry) {
          this.#selectedEntry = entry;
          this.#currentView = 'detail';
          this.#render();
        }
      });
    });

    // Copy password button
    document.querySelectorAll('.vault-entry-action.copy').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const entryEl = btn.closest('.vault-entry');
        const entryId = entryEl?.dataset.entryId;
        const entry = this.#entries.find(e => e.id === entryId);

        if (entry?.data?.password) {
          try {
            await navigator.clipboard.writeText(entry.data.password);
            this.#showToast('Mot de passe copié', 'success');
          } catch {
            this.#showToast('Erreur lors de la copie', 'error');
          }
        }
      });
    });

    // Add entry button & modal
    const openAddModal = () => {
      document.getElementById('add-entry-modal')?.classList.add('active');
      this.#updateEntryTypeFields();
    };
    const closeAddModal = () => {
      document.getElementById('add-entry-modal')?.classList.remove('active');
    };

    document.getElementById('btn-add-entry')?.addEventListener('click', openAddModal);
    document.getElementById('close-add-modal')?.addEventListener('click', closeAddModal);
    document.getElementById('cancel-add-entry')?.addEventListener('click', closeAddModal);

    // Entry type change
    document.getElementById('entry-type')?.addEventListener('change', () => {
      this.#updateEntryTypeFields();
    });

    // Add entry form
    document.getElementById('add-entry-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = document.getElementById('entry-type')?.value;
      const title = document.getElementById('entry-title')?.value;

      if (!type || !title) {
        this.#showToast('Veuillez remplir tous les champs', 'error');
        return;
      }

      const data = this.#collectEntryFormData(type);

      try {
        await window.vault.entries.add(type, title, data);
        await this.#loadEntries();
        closeAddModal();
        this.#render();
        this.#showToast('Entrée ajoutée', 'success');
      } catch (error) {
        this.#showToast(error.message || 'Erreur lors de l\'ajout', 'error');
      }
    });
  }

  /**
   * Update entry type fields in modal
   */
  #updateEntryTypeFields() {
    const type = document.getElementById('entry-type')?.value;
    const container = document.getElementById('entry-type-fields');
    if (!container) return;

    switch (type) {
      case 'login':
        container.innerHTML = `
          <div class="vault-form-group">
            <label class="vault-form-label">Identifiant / Email</label>
            <input type="text" class="vault-form-input" id="entry-username" placeholder="utilisateur@example.com">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">Mot de passe</label>
            <input type="password" class="vault-form-input" id="entry-password" placeholder="••••••••">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">URL</label>
            <input type="url" class="vault-form-input" id="entry-url" placeholder="https://example.com">
          </div>
        `;
        break;
      case 'note':
        container.innerHTML = `
          <div class="vault-form-group">
            <label class="vault-form-label">Contenu</label>
            <textarea class="vault-form-input" id="entry-content" rows="6" placeholder="Votre note sécurisée..."></textarea>
          </div>
        `;
        break;
      case 'card':
        container.innerHTML = `
          <div class="vault-form-group">
            <label class="vault-form-label">Titulaire</label>
            <input type="text" class="vault-form-input" id="entry-holder" placeholder="JEAN DUPONT">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">Numéro de carte</label>
            <input type="text" class="vault-form-input" id="entry-cardnumber" placeholder="1234 5678 9012 3456">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">Date d'expiration</label>
            <input type="text" class="vault-form-input" id="entry-expiry" placeholder="MM/AA">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">CVV</label>
            <input type="password" class="vault-form-input" id="entry-cvv" placeholder="123">
          </div>
        `;
        break;
      case 'identity':
        container.innerHTML = `
          <div class="vault-form-group">
            <label class="vault-form-label">Nom complet</label>
            <input type="text" class="vault-form-input" id="entry-fullname" placeholder="Jean Dupont">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">Email</label>
            <input type="email" class="vault-form-input" id="entry-email" placeholder="jean@example.com">
          </div>
          <div class="vault-form-group">
            <label class="vault-form-label">Téléphone</label>
            <input type="tel" class="vault-form-input" id="entry-phone" placeholder="+33 6 12 34 56 78">
          </div>
        `;
        break;
      default:
        container.innerHTML = '';
    }
  }

  /**
   * Collect form data based on entry type
   */
  #collectEntryFormData(type) {
    const data = {};

    switch (type) {
      case 'login':
        data.username = document.getElementById('entry-username')?.value || '';
        data.password = document.getElementById('entry-password')?.value || '';
        data.url = document.getElementById('entry-url')?.value || '';
        break;
      case 'note':
        data.content = document.getElementById('entry-content')?.value || '';
        break;
      case 'card':
        data.holder = document.getElementById('entry-holder')?.value || '';
        data.number = document.getElementById('entry-cardnumber')?.value || '';
        data.expiry = document.getElementById('entry-expiry')?.value || '';
        data.cvv = document.getElementById('entry-cvv')?.value || '';
        break;
      case 'identity':
        data.fullName = document.getElementById('entry-fullname')?.value || '';
        data.email = document.getElementById('entry-email')?.value || '';
        data.phone = document.getElementById('entry-phone')?.value || '';
        break;
    }

    return data;
  }

  /**
   * Render entry detail view
   */
  #renderEntryDetail() {
    const entry = this.#selectedEntry;
    if (!entry) {
      this.#currentView = 'list';
      this.#render();
      return;
    }

    const icon = ENTRY_ICONS[entry.type] || '📄';
    const typeLabel = ENTRY_LABELS[entry.type] || 'Entrée';

    this.#container.innerHTML = `
      <div class="vault-detail">
        <div class="vault-detail-header">
          <div class="vault-detail-icon">${icon}</div>
          <div class="vault-detail-title-wrap">
            <h2 class="vault-detail-title">${this.#escapeHtml(entry.title)}</h2>
            <p class="vault-detail-type">${typeLabel}</p>
          </div>
          <button type="button" class="vault-detail-close" id="btn-close-detail">✕</button>
        </div>

        ${this.#renderEntryFields(entry)}

        <div class="vault-field">
          <span class="vault-field-label">Dernière modification</span>
          <div class="vault-field-value">
            <span class="vault-field-text">${new Date(entry.modifiedAt).toLocaleString()}</span>
          </div>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button type="button" class="vault-btn vault-btn-secondary" id="btn-edit-entry" style="flex: 1;">
            Modifier
          </button>
          <button type="button" class="vault-btn vault-btn-secondary" id="btn-delete-entry"
                  style="border-color: #ef4444; color: #ef4444;">
            Supprimer
          </button>
        </div>
      </div>
    `;

    this.#attachDetailEvents();
  }

  /**
   * Render entry-specific fields
   */
  #renderEntryFields(entry) {
    switch (entry.type) {
      case 'login':
        return `
          ${this.#renderField('Identifiant', entry.data?.username, 'username')}
          ${this.#renderField('Mot de passe', entry.data?.password, 'password', true)}
          ${this.#renderField('URL', entry.data?.url, 'url')}
        `;
      case 'note':
        return `
          <div class="vault-field">
            <span class="vault-field-label">Contenu</span>
            <div class="vault-field-value" style="white-space: pre-wrap; font-family: inherit;">
              ${this.#escapeHtml(entry.data?.content || '')}
            </div>
          </div>
        `;
      case 'card':
        return `
          ${this.#renderField('Titulaire', entry.data?.holder)}
          ${this.#renderField('Numéro', entry.data?.number, 'card', true)}
          ${this.#renderField('Expiration', entry.data?.expiry)}
          ${this.#renderField('CVV', entry.data?.cvv, 'cvv', true)}
        `;
      case 'identity':
        return `
          ${this.#renderField('Nom', entry.data?.fullName)}
          ${this.#renderField('Email', entry.data?.email)}
          ${this.#renderField('Téléphone', entry.data?.phone)}
        `;
      default:
        return '';
    }
  }

  /**
   * Render a single field
   */
  #renderField(label, value, key = '', masked = false) {
    if (!value) return '';

    const displayValue = masked ? '••••••••' : this.#escapeHtml(value);
    const fieldId = key ? `field-${key}` : '';

    return `
      <div class="vault-field" ${fieldId ? `id="${fieldId}"` : ''}>
        <span class="vault-field-label">${label}</span>
        <div class="vault-field-value">
          <span class="vault-field-text ${masked ? 'masked' : ''}" data-value="${this.#escapeHtml(value)}" data-masked="${masked}">
            ${displayValue}
          </span>
          ${masked ? `
            <button type="button" class="vault-field-btn toggle-visibility" title="Afficher/Masquer">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          ` : ''}
          <button type="button" class="vault-field-btn copy-field" data-value="${this.#escapeHtml(value)}" title="Copier">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach detail view events
   */
  #attachDetailEvents() {
    // Close button
    document.getElementById('btn-close-detail')?.addEventListener('click', () => {
      this.#selectedEntry = null;
      this.#currentView = 'list';
      this.#render();
    });

    // Toggle visibility
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const field = btn.closest('.vault-field-value');
        const textEl = field?.querySelector('.vault-field-text');
        if (!textEl) return;

        const isMasked = textEl.classList.contains('masked');
        if (isMasked) {
          textEl.textContent = textEl.dataset.value;
          textEl.classList.remove('masked');
        } else {
          textEl.textContent = '••••••••';
          textEl.classList.add('masked');
        }
      });
    });

    // Copy field
    document.querySelectorAll('.copy-field').forEach(btn => {
      btn.addEventListener('click', async () => {
        const value = btn.dataset.value;
        if (value) {
          try {
            await navigator.clipboard.writeText(value);
            this.#showToast('Copié', 'success');
          } catch {
            this.#showToast('Erreur lors de la copie', 'error');
          }
        }
      });
    });

    // Delete entry
    document.getElementById('btn-delete-entry')?.addEventListener('click', async () => {
      if (!confirm('Voulez-vous vraiment supprimer cette entrée ?')) return;

      try {
        await window.vault.entries.delete(this.#selectedEntry.id);
        await this.#loadEntries();
        this.#selectedEntry = null;
        this.#currentView = 'list';
        this.#render();
        this.#showToast('Entrée supprimée', 'success');
      } catch (error) {
        this.#showToast('Erreur lors de la suppression', 'error');
      }
    });
  }

  /**
   * Render create entry view
   */
  #renderCreateEntry() {
    // For now, redirect to list with modal
    this.#currentView = 'list';
    this.#render();
    setTimeout(() => {
      document.getElementById('add-entry-modal')?.classList.add('active');
    }, 100);
  }

  /**
   * Show toast notification
   */
  #showToast(message, type = 'info') {
    // Use existing toast system if available
    const toastsContainer = document.getElementById('toasts');
    if (toastsContainer) {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      toastsContainer.appendChild(toast);

      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } else {
      console.log(`[Toast] ${type}: ${message}`);
    }
  }

  /**
   * Escape HTML entities
   */
  #escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export default
export default VaultUI;
