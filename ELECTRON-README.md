# GenPwd Pro - Version Electron

Application desktop multiplateforme basée sur Electron pour GenPwd Pro v2.6.0.

## 🎯 Caractéristiques de la Version Electron

### Avantages par rapport à la Version Web

✅ **Application Native**
- Icône dans la barre des tâches
- Raccourcis clavier système (Ctrl+G pour générer)
- Fenêtre dédiée (pas d'onglet navigateur)
- Intégration système complète

✅ **Sécurité Renforcée**
- Sandbox Electron activé
- Context Isolation enabled
- Node Integration disabled
- Pas d'exécution de code externe

✅ **Meilleure Performance**
- Chargement instantané
- Pas de latence réseau
- Mémoire optimisée
- Démarrage rapide

✅ **Expérience Utilisateur**
- Menu natif Windows
- Raccourcis système
- Notifications natives
- Zoom et plein écran

## 🚀 Utilisation

### Windows

#### Option 1: Installeur (Recommandé)
1. Téléchargez `GenPwd Pro-2.5.2-win-x64.exe`
2. Double-cliquez pour installer
3. Suivez l'assistant d'installation
4. Lancez depuis le Menu Démarrer ou le raccourci Bureau

#### Option 2: Version Portable
1. Téléchargez `GenPwd Pro-2.5.2-portable.exe`
2. Déplacez où vous voulez (ex: clé USB)
3. Double-cliquez pour lancer
4. Aucune installation requise

#### Option 3: Archive ZIP
1. Téléchargez `GenPwd Pro-2.5.2-win-x64.zip`
2. Décompressez où vous voulez
3. Lancez `GenPwd Pro.exe`

### Développement

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run electron:dev

# Build pour production
npm run electron:build:win  # Windows
npm run electron:build      # Plateforme actuelle
npm run electron:build:all  # Toutes les plateformes
```

## 📋 Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+G` | Générer un nouveau mot de passe |
| `Ctrl+Q` | Quitter l'application |
| `Ctrl+R` | Recharger l'application |
| `F11` | Basculer plein écran |
| `Ctrl++` | Zoomer |
| `Ctrl+-` | Dézoomer |
| `Ctrl+0` | Zoom normal (100%) |

## 🔧 Architecture Technique

### Structure de l'Application

```
GenPwd Pro/
├── electron-main.cjs         # Process principal Electron
├── electron-preload.cjs      # Script de préchargement sécurisé
├── src/                      # Application web (renderer)
│   ├── index.html
│   ├── js/
│   ├── styles/
│   └── ...
├── assets/
│   └── icon.ico             # Icône de l'application
└── package.json             # Configuration et dépendances
```

### Sécurité

L'application Electron utilise les meilleures pratiques de sécurité:

#### Configuration de Sécurité
```javascript
{
  nodeIntegration: false,      // Pas d'accès Node.js depuis le renderer
  contextIsolation: true,      // Isolation du contexte
  sandbox: true,               // Sandbox activé
  webSecurity: true,           // Sécurité web active
  allowRunningInsecureContent: false,
  experimentalFeatures: false
}
```

#### Protection Contre les Vulnérabilités
- ✅ Pas d'`eval()` ou de `new Function()`
- ✅ Content Security Policy strict
- ✅ Navigation externe bloquée
- ✅ Liens externes ouverts dans le navigateur système
- ✅ Aucune communication avec des serveurs externes

### Process Principal (Main)

**Fichier:** `electron-main.cjs`

Responsabilités:
- Création de la fenêtre principale
- Gestion du menu applicatif
- Gestion du cycle de vie (démarrage/fermeture)
- Sécurité et isolation
- Interception des événements système

### Process de Rendu (Renderer)

**Fichier:** `src/index.html` + modules JS

Responsabilités:
- Interface utilisateur
- Logique de génération de mots de passe
- Gestion des événements UI
- Stockage local (localStorage)

### Preload Script

**Fichier:** `electron-preload.cjs`

Responsabilités:
- API sécurisée entre main et renderer
- Exposition contrôlée de fonctionnalités
- Validation et sanitization

## 🏗️ Build et Distribution

### Configuration Electron Builder

```json
{
  "build": {
    "appId": "com.julienbombled.genpwdpro",
    "productName": "GenPwd Pro",
    "files": [
      "src/**/*",
      "assets/**/*",
      "electron-main.cjs",
      "electron-preload.cjs",
      "package.json"
    ],
    "win": {
      "target": ["nsis", "portable", "zip"],
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### Outputs de Build

| Type | Fichier | Taille | Usage |
|------|---------|--------|-------|
| **Installeur NSIS** | `GenPwd Pro-2.5.2-win-x64.exe` | ~180 MB | Installation Windows standard |
| **Portable** | `GenPwd Pro-2.5.2-portable.exe` | ~150 MB | Exécution sans installation |
| **ZIP** | `GenPwd Pro-2.5.2-win-x64.zip` | ~140 MB | Archive décompressable |
| **Non-empaqueté** | `win-unpacked/` | ~200 MB | Test et développement |

### Build sur Windows

**Voir le guide complet:** [BUILD-WINDOWS-INSTRUCTIONS.md](BUILD-WINDOWS-INSTRUCTIONS.md)

**Build rapide:**
```cmd
build-windows.bat
```

**Build manuel:**
```cmd
npm install
npm run build
npm run electron:build:win
```

## 🔍 Menu de l'Application

### Fichier
- **Générer nouveau mot de passe** (Ctrl+G)
- **Quitter** (Ctrl+Q)

### Édition
- **Copier** (Ctrl+C)
- **Coller** (Ctrl+V)
- **Tout sélectionner** (Ctrl+A)

### Affichage
- **Recharger** (Ctrl+R)
- **Recharger (force)** (Ctrl+Shift+R)
- **Zoom normal** (Ctrl+0)
- **Zoomer** (Ctrl++)
- **Dézoomer** (Ctrl+-)
- **Plein écran** (F11)

### Aide
- **Documentation** - Ouvre le GitHub
- **Signaler un bug** - Ouvre GitHub Issues
- **À propos** - Informations sur l'application

### Développement (mode dev uniquement)
- **Outils de développement** (Ctrl+Shift+I)
- **Recharger et effacer le cache**

## 🐛 Dépannage

### L'application ne démarre pas

**Symptômes:** Rien ne se passe au double-clic

**Solutions:**
1. Vérifiez l'antivirus (ajoutez une exclusion)
2. Exécutez en tant qu'administrateur
3. Vérifiez les logs dans `%APPDATA%\GenPwd Pro\logs`

### Écran blanc au démarrage

**Symptômes:** Fenêtre blanche, rien ne charge

**Solutions:**
1. Effacez le cache: `%APPDATA%\GenPwd Pro\Cache`
2. Réinstallez l'application
3. Vérifiez la compatibilité Windows (10/11 requis)

### Erreur "A JavaScript error occurred"

**Symptômes:** Popup d'erreur au lancement

**Solutions:**
1. Réinstallez l'application
2. Vérifiez que tous les fichiers sont présents
3. Signalez le bug avec les logs

### Performance lente

**Solutions:**
1. Fermez les autres applications
2. Augmentez la RAM disponible
3. Utilisez la version web si le hardware est limité

## 📊 Comparaison des Versions

| Fonctionnalité | Web | Electron |
|----------------|-----|----------|
| **Génération de mots de passe** | ✅ | ✅ |
| **Tous les modes** | ✅ | ✅ |
| **Export TXT/JSON/CSV** | ✅ | ✅ |
| **5 thèmes** | ✅ | ✅ |
| **Fonctionne offline** | ✅ | ✅ |
| **Icône barre des tâches** | ❌ | ✅ |
| **Menu natif** | ❌ | ✅ |
| **Raccourcis système** | ❌ | ✅ |
| **Installation optionnelle** | ✅ | ✅ |
| **Taille téléchargement** | <1 MB | ~150 MB |
| **Mises à jour** | Automatiques | Manuelles |

## 🔐 Sécurité

### Données Utilisateur

- ✅ **Aucun stockage de mots de passe**
- ✅ **Génération 100% locale**
- ✅ **Pas de télémétrie**
- ✅ **Pas de connexion réseau**
- ✅ **Code source ouvert**

### Préférences Stockées (localStorage)

Seules les préférences UI sont stockées:
- Thème sélectionné
- Dernière configuration de génération
- Position de la fenêtre (Electron)

**Localisation:** `%APPDATA%\GenPwd Pro\Local Storage`

## 📄 Licence

Apache License 2.0 © 2025 Julien Bombled

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel conformément aux termes de la licence Apache 2.0.

## 🆘 Support

- 📖 **Documentation:** [docs/](docs/)
- 🐛 **Bugs:** [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues)
- 💬 **Questions:** [GitHub Discussions](https://github.com/VBlackJack/genpwd-pro/discussions)
- 📧 **Email:** Voir le repository GitHub

## 🎉 Remerciements

- **Electron:** https://www.electronjs.org/
- **Electron Builder:** https://www.electron.build/
- **Tous les contributeurs:** Merci pour vos contributions !

---

<div align="center">

**GenPwd Pro Electron v2.5.2**

Application Desktop Sécurisée pour Génération de Mots de Passe

Made with ❤️ by Julien Bombled

</div>
