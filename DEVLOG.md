# GenPwd Pro - Development Log

## Branche: `feature/vault-windows`

### Dernière session: 22 décembre 2025 (Session 3 - Release Prep)

---

## Travail accompli

### Phase 5: Release 3.0.0 Preparation (Session 3)
- **Versioning**: `package.json` → 3.0.0, `electron-preload.cjs` → 3.0.0
- **CHANGELOG.md**: Entrée majeure v3.0.0 avec documentation complète (~180 lignes)
- **Build Config**: Exclusion des tests, ajout de DOMPurify aux dépendances packagées
- **Script de Release** (`tools/prepare-release.js`):
  - Nettoyage dist/, release/, coverage/
  - Vérification des fichiers critiques
  - Vérification des dépendances de production
  - Contrôle de syntaxe Node.js
- **Roadmap**: Mise à jour pour v3.1.0+ (Windows Hello, Sync Cloud, Extension)

### Phase 4: Desktop Integration (Session 2)
- **System Tray amélioré** (`electron-main.cjs`):
  - Menu contextuel avec "Générer un mot de passe" (copie directe + auto-clear 30s)
  - Notification de confirmation
  - Raccourci affiché dans le menu

- **Global Hotkey / Boss Key** (`electron-main.cjs`):
  - `Ctrl+Shift+P` (ou `Cmd+Shift+P` sur macOS)
  - Toggle visibilité de la fenêtre depuis n'importe où
  - Enregistrement/désenregistrement propre au cycle de vie

- **Mode Compact/Overlay** (`electron-main.cjs` + `vault-ui.js` + `vault.css`):
  - Fenêtre flottante 380x640, Always on Top
  - Position automatique en bas à droite de l'écran
  - IPC handlers: `window:toggle-compact`, `window:is-compact`
  - UI: bouton dans la toolbar, masque sidebar et panneau détail
  - CSS: ~250 lignes de styles dédiés au mode compact
  - Indicateur "Mode compact" en bas de fenêtre

- **Double-clic sur entrées** (`vault-ui.js`):
  - Double-clic → copie le mot de passe (ou username si pas de password)
  - Feedback via toast

- **Preload mis à jour** (`electron-preload.cjs`):
  - `toggleCompactMode()`, `isCompactMode()`, `onCompactModeChanged()`
  - Documentation des 8 catégories de fonctionnalités

### Phase 1: Sécurité Active (commit f27fe47)
- **Auto-Lock**: Verrouillage automatique après inactivité (configurable)
- **Secure Clipboard**: Copie avec nettoyage automatique (30s par défaut)
- **Visual Protection**: Floutage des données sensibles quand la fenêtre perd le focus
- **Password History**: Historique des anciens mots de passe par entrée

### Phase 2: Import/Export + Tree View (commit 5283510)
- **Import Service** (`src/js/vault/import-service.js`):
  - KeePass 2.x XML avec hiérarchie de groupes
  - Bitwarden JSON
  - CSV générique avec détection intelligente des colonnes

- **Enhanced Search** (`src/js/vault/in-memory-repository.js`):
  - Opérateurs: `tag:`, `type:`, `folder:`, `has:`, `-exclude`
  - Recherche dans les champs personnalisés
  - Méthodes: `moveGroup()`, `getGroupPath()`, `getGroupTree()`, `bulkImport()`

- **Tree View Sidebar** (`src/js/vault-ui.js`):
  - Dossiers hiérarchiques avec expand/collapse
  - Menu contextuel (renommer, sous-dossier, couleur, supprimer)
  - Compteur d'entrées récursif

- **Import Modal UI**:
  - Drag-and-drop avec preview
  - Statistiques d'import
  - Affichage des warnings/erreurs

### Phase 3: Intelligence - Dashboard Sécurité (commit 05c5d10)
- **TOTP Service** (`src/js/vault/totp-service.js`):
  - RFC 6238 avec Web Crypto API
  - Support SHA1/SHA256/SHA512
  - `TOTPManager` avec auto-refresh
  - Parsing/génération d'URI otpauth://

- **Audit Service** (`src/js/vault/audit-service.js`):
  - Calcul d'entropie avec pénalités (patterns, mots communs)
  - Détection des mots de passe réutilisés (hash SHA-256)
  - Détection des mots de passe faibles (< 60 bits)
  - Détection des anciens mots de passe (> 1 an)
  - Score global 0-100 avec recommandations

- **Security Dashboard** (`src/js/vault-ui.js`):
  - Jauge SVG circulaire avec score coloré
  - Cartes cliquables filtrant les entrées par problème
  - Recommandations avec priorités (critique/warning/info)
  - Intégration avec `#auditFilterIds` pour le filtrage

- **CSS** (`src/styles/vault.css`):
  - Styles pour la jauge de score
  - Cards cliquables avec hover effects
  - Liste de recommandations avec couleurs de priorité

---

## Structure des fichiers clés

```
src/js/vault/
├── audit-service.js      # Analyse de sécurité (~300 lignes)
├── totp-service.js       # Générateur 2FA RFC 6238 (~280 lignes)
├── import-service.js     # Import KeePass/Bitwarden/CSV (~700 lignes)
├── in-memory-repository.js # Repository avec search avancée
├── interfaces.js         # Interfaces abstraites
└── models.js             # VaultEntry, VaultGroup

src/js/
├── vault-ui.js           # UI principale du coffre (~9500 lignes)
└── ...

src/styles/
├── vault.css             # Styles du coffre (~4500 lignes)
└── main.css              # Styles généraux
```

---

## Prochaines étapes possibles

1. **Tests unitaires** pour totp-service.js et audit-service.js
2. **Export sécurisé** (chiffré) vers fichier externe
3. **Synchronisation cloud** (optionnel)
4. **Browser extension** pour auto-fill
5. **Amélioration UX mobile** (responsive)

---

## Commits récents

```
05c5d10 feat(vault): Security Dashboard + TOTP service + Audit engine
5283510 feat(vault): Import service + Tree View folders + enhanced search
f27fe47 feat(security): Active security measures - inactivity, clipboard, blur protection
31fab9f feat(vault): Secure file persistence layer (Save/Load)
```

---

## Notes techniques

- Le TOTP utilise Web Crypto API (pas node:crypto) pour compatibilité browser
- L'audit fonctionne entièrement en local, pas d'envoi réseau
- Les filtres d'audit (`#auditFilterIds`) persistent jusqu'à clear manuel
- Le dashboard réutilise le modal existant mais avec nouvelle UI (gauge SVG)
