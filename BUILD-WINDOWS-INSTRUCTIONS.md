# Instructions de Build Windows - GenPwd Pro v3.0.1

Ce document explique comment construire l'exécutable Windows et l'installeur pour GenPwd Pro.

## 🚨 Important

**Le build Windows DOIT être effectué sur une machine Windows.** Le build depuis Linux nécessite Wine qui n'est pas disponible dans cet environnement.

## 📋 Prérequis

### Système
- **Windows 10/11** (ou Windows Server 2016+)
- **8 GB RAM** minimum (16 GB recommandé)
- **5 GB d'espace disque** libre
- Connexion Internet (pour télécharger les dépendances)

### Logiciels Requis
1. **Node.js 16.x ou supérieur**
   - Télécharger: https://nodejs.org/
   - Version LTS recommandée
   - NPM est inclus avec Node.js

2. **Git** (optionnel, pour cloner le repository)
   - Télécharger: https://git-scm.com/

## 🔨 Build Rapide (Méthode Automatique)

### Étape 1: Préparation

```cmd
REM Cloner le repository (ou télécharger le ZIP)
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro
```

### Étape 2: Build Automatique

```cmd
REM Double-cliquer sur le fichier ou exécuter:
build-windows.bat
```

Le script va automatiquement:
1. ✅ Nettoyer les builds précédents
2. ✅ Installer les dépendances NPM
3. ✅ Construire l'application web
4. ✅ Créer l'exécutable et l'installeur Windows

**Durée estimée:** 10-15 minutes (première fois)

### Étape 3: Résultats

Les fichiers seront créés dans le dossier `release/`:

```
release/
├── GenPwd Pro-3.0.1-win-x64.exe        # Installeur NSIS (recommandé)
├── GenPwd Pro-3.0.1-win-x64.zip        # Version portable
├── GenPwd Pro-3.0.1-portable.exe       # Exécutable portable
└── win-unpacked/                       # Version non-empaquetée (test)
    └── GenPwd Pro.exe
```

## 🔧 Build Manuel (Méthode Avancée)

Si vous préférez contrôler chaque étape:

### 1. Installation des Dépendances

```cmd
REM Installer toutes les dépendances NPM
set PUPPETEER_SKIP_DOWNLOAD=true
npm install
```

**Note:** `PUPPETEER_SKIP_DOWNLOAD` évite de télécharger Chromium (non nécessaire).

### 2. Build de l'Application Web

```cmd
REM Construire la version web standalone
npm run build
```

Cela créera `dist/index.html` avec toute l'application consolidée.

### 3. Build Electron Windows

```cmd
REM Construire pour Windows uniquement
npm run electron:build:win
```

**OU** pour construire toutes les plateformes:

```cmd
npm run electron:build:all
```

## 📦 Types de Builds Disponibles

### 1. Installeur NSIS (Recommandé)
- **Fichier:** `GenPwd Pro-3.0.1-win-x64.exe`
- **Taille:** ~150-200 MB
- **Fonctionnalités:**
  - Installation guidée
  - Choix du répertoire d'installation
  - Création de raccourcis (Bureau + Menu Démarrer)
  - Désinstalleur inclus
  - Support x64 et x86

### 2. Version Portable
- **Fichier:** `GenPwd Pro-3.0.1-portable.exe`
- **Taille:** ~150 MB
- **Fonctionnalités:**
  - Exécution sans installation
  - Idéal pour clés USB
  - Aucune trace dans le registre

### 3. Archive ZIP
- **Fichier:** `GenPwd Pro-3.0.1-win-x64.zip`
- **Taille:** ~140 MB
- **Contenu:** Application complète décompressable

## ⚙️ Configuration Avancée

### Personnaliser le Build

Éditez `package.json` section `"build"` pour personnaliser:

```json
{
  "build": {
    "appId": "com.julienbombled.genpwdpro",
    "productName": "GenPwd Pro",
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
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

### Changer l'Icône

Remplacez `assets/icon.ico` par votre icône personnalisée:
- Format: ICO
- Résolution recommandée: 256x256
- Inclure plusieurs tailles: 16, 32, 48, 64, 128, 256

### Signature de Code

Pour signer l'exécutable (recommandé pour distribution):

1. Obtenir un certificat de signature de code
2. Configurer dans `package.json`:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "your-password",
      "signAndEditExecutable": true
    }
  }
}
```

## 🐛 Dépannage

### Erreur: "npm: command not found"

**Solution:** Node.js n'est pas installé ou pas dans le PATH
- Réinstallez Node.js: https://nodejs.org/
- Redémarrez votre terminal/PowerShell

### Erreur: "EPERM: operation not permitted"

**Solution:** Permissions insuffisantes ou antivirus bloquant
- Exécutez cmd.exe en tant qu'administrateur
- Désactivez temporairement l'antivirus
- Ajoutez le dossier du projet aux exclusions

### Erreur: "Cannot find module 'electron'"

**Solution:** Dépendances mal installées
```cmd
rmdir /s /q node_modules
del package-lock.json
npm install
```

### Build échoue avec "Out of Memory"

**Solution:** Node.js manque de mémoire
```cmd
set NODE_OPTIONS=--max-old-space-size=4096
npm run electron:build:win
```

### Erreur: "wine is required"

**Cause:** Vous tentez de build sur Linux/Mac
**Solution:** Utilisez une machine Windows ou une VM Windows

## 📊 Optimisation de Build

### Réduire la Taille

1. **Activer la compression maximale** (déjà configuré):
```json
{
  "build": {
    "compression": "maximum"
  }
}
```

2. **Utiliser ASAR** (déjà configuré):
```json
{
  "build": {
    "asar": true
  }
}
```

### Accélérer le Build

1. **Cache NPM:**
```cmd
npm config set cache C:\npm-cache --global
```

2. **Build incrémental:** Ne nettoyez pas `release/` si vous rebuildez

## 🚀 Distribution

### Checklist Avant Release

- [ ] Version mise à jour dans `package.json`
- [ ] Tests passés: `npm test`
- [ ] Application testée sur Windows 10 et 11
- [ ] Icône personnalisée ajoutée
- [ ] Licence vérifiée (LICENSE file)
- [ ] CHANGELOG mis à jour

### Upload sur GitHub Releases

```bash
# Créer un tag de version
git tag v3.0.0
git push origin v3.0.0

# Créer la release sur GitHub et uploader:
# - GenPwd Pro-3.0.1-win-x64.exe
# - GenPwd Pro-3.0.1-portable.exe
# - GenPwd Pro-3.0.1-win-x64.zip
```

### Générer les Checksums

```cmd
REM SHA256
certutil -hashfile "release\GenPwd Pro-3.0.1-win-x64.exe" SHA256

REM MD5
certutil -hashfile "release\GenPwd Pro-3.0.1-win-x64.exe" MD5
```

## 📚 Ressources

- **Electron Builder:** https://www.electron.build/
- **NSIS Documentation:** https://nsis.sourceforge.io/
- **Node.js Downloads:** https://nodejs.org/
- **Repository GitHub:** https://github.com/VBlackJack/genpwd-pro

## 💡 Conseils Pro

1. **Première build lente:** La première fois, Electron Builder télécharge ~200 MB de dépendances. Les builds suivants seront plus rapides.

2. **SSD recommandé:** Le build est beaucoup plus rapide sur SSD que HDD.

3. **Fermer les antivirus:** Ils peuvent ralentir le build de 50-70%.

4. **Utiliser PowerShell Admin:** Pour éviter les problèmes de permissions.

5. **Builds nocturnes:** Lancez le build avant de dormir pour builds propres.

## 📄 Licence

Apache License 2.0 © 2025 Julien Bombled

---

**Questions ou problèmes?**
- 🐛 Issues: https://github.com/VBlackJack/genpwd-pro/issues
- 💬 Discussions: https://github.com/VBlackJack/genpwd-pro/discussions
