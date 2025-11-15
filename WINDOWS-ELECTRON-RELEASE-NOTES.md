# GenPwd Pro v2.6.0 - Version Electron avec Installeur Windows

## 🎉 Version Electron Disponible !

GenPwd Pro dispose maintenant d'une **version Electron complète** avec application desktop native et installeur Windows professionnel.

---

## 📦 Qu'est-ce que la Version Electron ?

Une application **desktop native** qui offre :

✨ **Expérience Native**
- Fenêtre d'application dédiée (pas d'onglet navigateur)
- Icône dans la barre des tâches Windows
- Menu système natif (Fichier, Édition, Affichage, Aide)
- Raccourcis clavier système (Ctrl+G pour générer)

🔒 **Sécurité Maximale**
- Sandbox Electron activé
- Context isolation enabled
- Node integration disabled
- Pas d'exécution de code externe
- Navigation bloquée vers sites externes

🚀 **Performance**
- Chargement instantané
- Pas de latence réseau
- Optimisé pour desktop
- Mémoire efficace

🎯 **Installation Professionnelle**
- Installeur NSIS avec assistant
- Choix du répertoire d'installation
- Raccourcis Bureau + Menu Démarrer
- Désinstalleur propre inclus

---

## 🔨 Comment Construire l'Installeur Windows ?

### ⚠️ Important

**Le build DOIT être effectué sur une machine Windows** car la création d'un installeur Windows nécessite des outils spécifiques (NSIS) qui ne fonctionnent pas sur Linux.

### Méthode Rapide (Recommandée)

```cmd
1. Clonez le repository sur Windows:
   git clone https://github.com/VBlackJack/genpwd-pro.git
   cd genpwd-pro

2. Double-cliquez sur:
   build-windows.bat

3. Attendez 10-15 minutes (première fois)

4. Les fichiers seront dans le dossier release/:
   ✅ GenPwd Pro-2.5.2-win-x64.exe        (Installeur NSIS)
   ✅ GenPwd Pro-2.5.2-portable.exe       (Version portable)
   ✅ GenPwd Pro-2.5.2-win-x64.zip        (Archive ZIP)
```

### Méthode Manuelle

```cmd
# Installer les dépendances
set PUPPETEER_SKIP_DOWNLOAD=true
npm install

# Build de l'application web
npm run build

# Build Electron Windows
npm run electron:build:win
```

### Prérequis

- **Windows 10/11** (ou Windows Server 2016+)
- **Node.js 16+** ([télécharger](https://nodejs.org/))
- **8 GB RAM** minimum (16 GB recommandé)
- **5 GB disque** libre
- **Connexion Internet** (pour télécharger Electron et dépendances)

---

## 📋 Fichiers Créés Après Build

| Fichier | Taille | Description |
|---------|--------|-------------|
| **GenPwd Pro-2.5.2-win-x64.exe** | ~180 MB | Installeur NSIS (recommandé) |
| **GenPwd Pro-2.5.2-portable.exe** | ~150 MB | Exécutable portable (sans installation) |
| **GenPwd Pro-2.5.2-win-x64.zip** | ~140 MB | Archive ZIP décompressable |
| **win-unpacked/** | ~200 MB | Version non-empaquetée (test) |

---

## 🎯 Types d'Installation

### 1. Installeur NSIS (Recommandé)

**Fichier:** `GenPwd Pro-2.5.2-win-x64.exe`

**Fonctionnalités:**
- ✅ Assistant d'installation guidé
- ✅ Choix du répertoire d'installation
- ✅ Création automatique des raccourcis (Bureau + Menu Démarrer)
- ✅ Désinstalleur inclus dans le Panneau de configuration
- ✅ Support x64 et x86 (32-bit)

**Installation:**
1. Double-cliquez sur le fichier `.exe`
2. Suivez l'assistant d'installation
3. Choisissez le répertoire (défaut: `C:\Program Files\GenPwd Pro`)
4. Cochez "Créer un raccourci Bureau" (recommandé)
5. Cliquez sur "Installer"
6. Lancez depuis le Menu Démarrer ou le raccourci Bureau

### 2. Version Portable

**Fichier:** `GenPwd Pro-2.5.2-portable.exe`

**Fonctionnalités:**
- ✅ Exécution sans installation
- ✅ Idéal pour clés USB
- ✅ Aucune trace dans le registre Windows
- ✅ Déplacez-le où vous voulez

**Utilisation:**
1. Copiez le fichier où vous voulez (Bureau, clé USB, etc.)
2. Double-cliquez pour lancer
3. Aucune installation requise !

### 3. Archive ZIP

**Fichier:** `GenPwd Pro-2.5.2-win-x64.zip`

**Fonctionnalités:**
- ✅ Archive décompressable
- ✅ Voir tous les fichiers de l'application
- ✅ Installation manuelle possible

**Utilisation:**
1. Décompressez où vous voulez
2. Lancez `GenPwd Pro.exe` dans le dossier décompressé

---

## 🆚 Comparaison des Versions

| Fonctionnalité | Version Web | Version Electron |
|----------------|-------------|------------------|
| **Génération de mots de passe** | ✅ | ✅ |
| **Tous les modes** (Syllables, Passphrase, etc.) | ✅ | ✅ |
| **Export TXT/JSON/CSV** | ✅ | ✅ |
| **5 thèmes personnalisables** | ✅ | ✅ |
| **Fonctionne offline** | ✅ | ✅ |
| **Taille de téléchargement** | <1 MB | ~150 MB |
| **Fenêtre dédiée** | ❌ (onglet navigateur) | ✅ |
| **Icône barre des tâches** | ❌ | ✅ |
| **Menu système natif** | ❌ | ✅ |
| **Raccourcis clavier système** | ❌ | ✅ (Ctrl+G, etc.) |
| **Installation** | Aucune | Optionnelle |
| **Auto-updates** | Automatiques | Manuelles |

**Recommandation:**
- **Version Web:** Usage occasionnel, léger, mobile
- **Version Electron:** Usage fréquent, professionnel, desktop

---

## 🔧 Nouveaux Fichiers Ajoutés au Repository

```
genpwd-pro/
├── electron-main.cjs               # Process principal Electron
├── electron-preload.cjs            # Script de préchargement sécurisé
├── build-windows.bat               # Script de build automatique Windows
├── BUILD-WINDOWS-INSTRUCTIONS.md   # Guide complet de build
├── ELECTRON-README.md              # Documentation Electron
└── package.json                    # Configuration Electron Builder
```

---

## ⌨️ Raccourcis Clavier (Version Electron)

| Raccourci | Action |
|-----------|--------|
| `Ctrl+G` | Générer un nouveau mot de passe |
| `Ctrl+Q` | Quitter l'application |
| `Ctrl+C` | Copier |
| `Ctrl+V` | Coller |
| `Ctrl+A` | Tout sélectionner |
| `Ctrl+R` | Recharger l'application |
| `Ctrl+Shift+R` | Recharger (force) |
| `F11` | Basculer plein écran |
| `Ctrl++` | Zoomer |
| `Ctrl+-` | Dézoomer |
| `Ctrl+0` | Zoom normal (100%) |

---

## 📖 Documentation

### Guides Disponibles

1. **[BUILD-WINDOWS-INSTRUCTIONS.md](BUILD-WINDOWS-INSTRUCTIONS.md)**
   - Guide complet de build Windows
   - Prérequis détaillés
   - Dépannage
   - Configuration avancée

2. **[ELECTRON-README.md](ELECTRON-README.md)**
   - Documentation utilisateur Electron
   - Architecture technique
   - Sécurité
   - Comparaison des versions

3. **[build-windows.bat](build-windows.bat)**
   - Script de build automatique
   - Vérifie les prérequis
   - Build en 4 étapes

---

## 🛡️ Sécurité

La version Electron utilise les **meilleures pratiques de sécurité** Electron:

### Configuration de Sécurité

```javascript
{
  nodeIntegration: false,              // ✅ Pas d'accès Node.js
  contextIsolation: true,              // ✅ Isolation du contexte
  sandbox: true,                       // ✅ Sandbox activé
  webSecurity: true,                   // ✅ Sécurité web
  allowRunningInsecureContent: false,  // ✅ Pas de contenu non-sécurisé
  experimentalFeatures: false          // ✅ Pas de features expérimentales
}
```

### Protections Actives

- ✅ Pas d'`eval()` ou `new Function()`
- ✅ Content Security Policy (CSP) strict
- ✅ Navigation externe bloquée
- ✅ Liens externes ouverts dans le navigateur système
- ✅ Aucune communication réseau
- ✅ Aucun stockage de mots de passe
- ✅ Génération 100% locale
- ✅ Code source ouvert

---

## 🐛 Dépannage

### Le build échoue sur Linux

**Cause:** Wine requis pour build Windows depuis Linux

**Solution:** Utilisez une machine Windows (physique ou VM)

### "npm: command not found"

**Cause:** Node.js non installé ou pas dans PATH

**Solution:**
1. Installez Node.js: https://nodejs.org/
2. Redémarrez votre terminal/PowerShell
3. Vérifiez: `node --version`

### "Cannot find module 'electron'"

**Cause:** Dépendances mal installées

**Solution:**
```cmd
rmdir /s /q node_modules
del package-lock.json
npm install
```

### Build échoue: "Out of Memory"

**Cause:** Pas assez de mémoire RAM

**Solution:**
```cmd
set NODE_OPTIONS=--max-old-space-size=4096
npm run electron:build:win
```

---

## 📊 Statistiques

### Temps de Build Estimés

| Étape | Première fois | Builds suivants |
|-------|---------------|-----------------|
| Installation dépendances | 5-7 min | 0-1 min (cache) |
| Build application web | 5-10 sec | 5-10 sec |
| Build Electron | 5-10 min | 2-5 min |
| **TOTAL** | **10-17 min** | **2-6 min** |

### Tailles de Fichiers

| Composant | Taille |
|-----------|--------|
| Source (sans node_modules) | ~5 MB |
| node_modules (avec Electron) | ~500 MB |
| Installeur NSIS | ~180 MB |
| Version portable | ~150 MB |
| Archive ZIP | ~140 MB |

---

## 🚀 Prochaines Étapes

### Pour Construire

1. ✅ Clonez le repository sur Windows
2. ✅ Exécutez `build-windows.bat`
3. ✅ Attendez la fin du build
4. ✅ Testez l'exécutable dans `release/win-unpacked/`
5. ✅ Distribuez l'installeur NSIS

### Pour Distribuer

1. **GitHub Releases:**
   - Créez une nouvelle release: `v2.5.2`
   - Uploadez les 3 fichiers (NSIS, portable, ZIP)
   - Ajoutez ces notes de version

2. **Checksums:**
   ```cmd
   certutil -hashfile "release\GenPwd Pro-2.5.2-win-x64.exe" SHA256
   ```

3. **Signature de Code (optionnel mais recommandé):**
   - Obtenez un certificat de signature
   - Configurez dans `package.json`
   - Éliminez les avertissements Windows

---

## 📄 Licence

Apache License 2.0 © 2025 Julien Bombled

---

## 🎉 Remerciements

- **Electron:** Framework de développement desktop
- **Electron Builder:** Système de build et packaging
- **Communauté Open Source**

---

## 🔗 Liens Utiles

- 🌐 **Repository:** https://github.com/VBlackJack/genpwd-pro
- 📖 **Documentation:** [BUILD-WINDOWS-INSTRUCTIONS.md](BUILD-WINDOWS-INSTRUCTIONS.md)
- 📖 **Guide Electron:** [ELECTRON-README.md](ELECTRON-README.md)
- 🐛 **Issues:** https://github.com/VBlackJack/genpwd-pro/issues
- 💬 **Discussions:** https://github.com/VBlackJack/genpwd-pro/discussions

---

<div align="center">

**GenPwd Pro v2.5.2 Electron**

Application Desktop Sécurisée avec Installeur Windows

Made with ❤️ by Julien Bombled

**Prêt à construire votre version Windows !**

</div>
