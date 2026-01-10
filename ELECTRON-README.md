# GenPwd Pro - Desktop Application (Electron)

Application desktop multiplateforme pour GenPwd Pro **v3.0.2** - Gestionnaire de mots de passe sécurisé.

## 🎯 Nouveautés v3.0.2

### Coffre-fort Chiffré
- **Chiffrement AES-256-GCM** avec dérivation PBKDF2 (100,000 itérations)
- **Format `.gpdb`** (GenPwd Database) pour stockage local sécurisé
- **Auto-lock** après inactivité configurable
- **Clipboard sécurisé** avec nettoyage automatique (30s)

### Organisation
- **Dossiers hiérarchiques** avec Tree View
- **Tags personnalisés** avec couleurs
- **Types d'entrées** : Login, Note sécurisée, Carte bancaire, Identité
- **Champs personnalisés** dynamiques

### Sécurité Avancée
- **TOTP / 2FA** intégré (RFC 6238)
- **Audit de sécurité** avec score et recommandations
- **Détection** des mots de passe faibles, réutilisés, anciens
- **Import** KeePass XML, Bitwarden JSON, CSV générique

### Intégration Desktop
- **System Tray** avec génération rapide de mot de passe
- **Global Hotkey** : `Ctrl+Shift+P` pour toggle visibilité (Boss Key)
- **Mode Compact** : Widget flottant 380x640, Always on Top
- **Auto-Type** : Saisie automatique dans les formulaires

## 🚀 Installation

### Windows

#### Option 1: Installeur (Recommandé)
1. Téléchargez `GenPwd Pro-3.0.2-win-x64.exe`
2. Double-cliquez pour installer
3. Suivez l'assistant d'installation
4. Lancez depuis le Menu Démarrer ou le raccourci Bureau

#### Option 2: Version Portable
1. Téléchargez `GenPwd Pro-3.0.2-portable.exe`
2. Déplacez où vous voulez (ex: clé USB)
3. Double-cliquez pour lancer
4. Aucune installation requise

#### Option 3: Archive ZIP
1. Téléchargez `GenPwd Pro-3.0.2-win-x64.zip`
2. Décompressez où vous voulez
3. Lancez `GenPwd Pro.exe`

## 📋 Raccourcis Clavier

### Globaux (depuis n'importe où)
| Raccourci | Action |
|-----------|--------|
| `Ctrl+Shift+P` | Toggle visibilité (Boss Key) |

### Dans l'application
| Raccourci | Action |
|-----------|--------|
| `Ctrl+N` | Nouvelle entrée |
| `Ctrl+E` | Éditer l'entrée sélectionnée |
| `Ctrl+F` | Focus sur la recherche |
| `Delete` | Supprimer l'entrée sélectionnée |
| `Ctrl+G` | Générer un mot de passe |
| `Ctrl+L` | Verrouiller le coffre |
| `F11` | Plein écran |

### Navigation
| Raccourci | Action |
|-----------|--------|
| `↑/↓` | Naviguer dans la liste |
| `Enter` | Sélectionner l'entrée |
| `Escape` | Fermer le modal / Annuler |

## 🔒 Fonctionnalités de Sécurité

### Chiffrement
- **AES-256-GCM** pour les données
- **PBKDF2** avec 100,000 itérations pour la dérivation de clé
- **Salt unique** par coffre
- **Pas de stockage** du mot de passe maître

### Protection Runtime
- **Context Isolation** activé
- **Node Integration** désactivé
- **Sandbox** Electron activé
- **CSP** (Content Security Policy) stricte

### Auto-protection
- **Auto-lock** après inactivité (1-60 min)
- **Clipboard auto-clear** après 30 secondes
- **Blur protection** : masquage quand la fenêtre perd le focus
- **Single instance** : une seule instance autorisée

## 🖥️ System Tray

L'icône dans la zone de notification offre :
- **Afficher GenPwd Pro** - Ramène la fenêtre au premier plan
- **Générer un mot de passe** - Génère et copie un mot de passe (auto-clear 30s)
- **Verrouiller le coffre** - Verrouille immédiatement
- **Quitter** - Ferme complètement l'application

> **Note** : Fermer la fenêtre (X) minimise dans le tray. Utilisez "Quitter" pour fermer réellement.

## 📱 Mode Compact (Overlay)

Le mode compact transforme la fenêtre en widget flottant :
- **Dimensions** : 380x640 pixels
- **Always on Top** : Reste au-dessus des autres fenêtres
- **Position** : Bas-droite de l'écran
- **UI simplifiée** : Recherche + liste uniquement

Idéal pour :
- Remplir des formulaires de connexion
- Accès rapide aux identifiants
- Utilisation avec d'autres applications

## 🔄 Import / Export

### Formats d'import supportés
- **KeePass 2.x** (.xml) - Groupes, entrées, champs personnalisés
- **Bitwarden** (.json) - Export JSON complet
- **CSV générique** - Détection automatique des colonnes

### Export
- **JSON natif** - Format GenPwd Pro complet
- **CSV** - Compatible Excel/tableurs
- **KeePass XML** - Pour migration vers KeePass

## 🛠️ Développement

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run electron:dev

# Build pour production
npm run electron:build:win    # Windows uniquement
npm run electron:build        # Plateforme actuelle
npm run electron:build:all    # Toutes les plateformes

# Préparer une release
node tools/prepare-release.js
```

### Structure des builds
```
release/
├── GenPwd Pro-3.0.2-win.exe       # Installeur (x64 + ia32)
├── GenPwd Pro-3.0.2-win-x64.exe   # Installeur x64 uniquement
├── GenPwd Pro-3.0.2-win-ia32.exe  # Installeur 32-bit
├── GenPwd Pro-3.0.2-portable.exe  # Portable (pas d'installation)
├── GenPwd Pro-3.0.2-win-x64.zip   # Archive ZIP
├── win-unpacked/                   # Version décompressée x64
└── win-ia32-unpacked/              # Version décompressée 32-bit
```

## 📄 Licence

Apache License 2.0 - Voir [LICENSE](LICENSE)

## 🔗 Liens

- [CHANGELOG](CHANGELOG.md) - Historique des versions
- [README principal](README.md) - Documentation générale
- [GitHub](https://github.com/VBlackJack/genpwd-pro) - Code source
