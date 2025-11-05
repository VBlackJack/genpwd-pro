# Building GenPwd Pro for Windows

Ce guide explique comment compiler et créer les packages Windows de GenPwd Pro.

## 📋 Prérequis

- Node.js 16+ installé
- NPM (inclus avec Node.js)
- Git (optionnel)

## 🔨 Compilation

### Étape 1: Préparation

```bash
# Cloner le repository (si pas déjà fait)
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro

# Installer les dépendances
npm install
```

### Étape 2: Build de production

```bash
# Compiler la version production
npm run build
```

Cette commande va :
- ✅ Consolider tous les fichiers JavaScript en un seul bundle
- ✅ Consolider tous les fichiers CSS
- ✅ Créer un fichier HTML standalone dans `dist/index.html`
- ✅ Copier les assets nécessaires

### Étape 3: Vérification

```bash
# Vérifier le contenu du dossier dist/
ls -la dist/

# Devrait contenir:
# - index.html (170 KB) - Application standalone
# - genpwd-bundle.js - Bundle JavaScript (si nécessaire)
# - assets/ - Icônes et ressources
```

## 📦 Création des Packages Windows

### Package Portable Complet (Recommandé)

Les scripts et fichiers nécessaires sont déjà créés dans `dist/`:

```bash
# Les fichiers suivants sont inclus:
dist/
├── index.html              # Application principale
├── LANCER-GENPWD.bat      # Script de lancement Windows
├── LISEZ-MOI.txt          # Documentation utilisateur
├── genpwd-bundle.js       # Bundle JavaScript
└── assets/
    └── icon.ico           # Icône de l'application
```

### Créer l'Archive ZIP

```bash
# Version portable complète (94 KB)
zip -r genpwd-pro-v2.5.2-windows-portable.zip \
  dist/index.html \
  dist/LANCER-GENPWD.bat \
  dist/LISEZ-MOI.txt \
  dist/genpwd-bundle.js \
  dist/assets/

# Version légère (65 KB) - sans bundle JS séparé
zip -r genpwd-pro-v2.5.2-windows.zip \
  dist/index.html \
  dist/LANCER-GENPWD.bat \
  dist/LISEZ-MOI.txt \
  dist/assets/
```

## 🧪 Test Local

### Test sur Linux/Mac

```bash
# Ouvrir dans le navigateur par défaut
open dist/index.html

# Ou avec un navigateur spécifique
google-chrome dist/index.html
firefox dist/index.html
```

### Test sur Windows

1. Copiez le dossier `dist/` sur une machine Windows
2. Double-cliquez sur `LANCER-GENPWD.bat`
3. L'application s'ouvre dans le navigateur par défaut

## 📝 Structure du Build

### Script build.js

Le script `tools/build.js` effectue les opérations suivantes:

1. **Consolidation JavaScript**
   - Lit tous les modules dans l'ordre défini
   - Supprime les imports/exports ES6
   - Convertit en IIFE (Immediately Invoked Function Expression)
   - Rend les fonctions disponibles globalement

2. **Consolidation CSS**
   - Fusionne tous les fichiers CSS
   - Conserve les commentaires de source

3. **Création HTML Final**
   - Injecte le CSS consolidé dans `<head>`
   - Injecte le JavaScript consolidé avant `</body>`
   - Crée un fichier standalone sans dépendances externes

4. **Copie des Assets**
   - Copie les dictionnaires (si présents)
   - Copie les icônes et ressources

### Ordre de Chargement des Modules

```javascript
const moduleOrder = [
  'js/config/constants.js',      // Configuration globale
  'js/utils/helpers.js',          // Utilitaires
  'js/utils/logger.js',           // Logging
  'js/utils/toast.js',            // Notifications
  'js/utils/clipboard.js',        // Copie presse-papier
  'js/core/dictionaries.js',      // Dictionnaires
  'js/core/casing.js',            // Gestion de la casse
  'js/core/generators.js',        // Générateurs
  'js/config/settings.js',        // Paramètres
  'js/ui/dom.js',                 // Manipulation DOM
  'js/ui/events.js',              // Gestion événements
  'js/ui/render.js',              // Rendu UI
  'js/ui/modal.js',               // Modales
  'js/app.js'                     // Application principale
];
```

## 🔧 Personnalisation

### Modifier le Script de Lancement

Éditez `dist/LANCER-GENPWD.bat` pour personnaliser:
- Le titre de la fenêtre
- Les messages affichés
- Le comportement d'ouverture

### Modifier la Documentation

Éditez `dist/LISEZ-MOI.txt` pour adapter:
- Les instructions d'utilisation
- Les informations de contact
- Les liens de support

### Changer l'Icône

Remplacez `dist/assets/icon.ico` par votre propre icône (format .ico, 256x256 recommandé).

## 🚀 Distribution

### GitHub Releases

1. Créez une nouvelle release sur GitHub
2. Uploadez les fichiers ZIP:
   - `genpwd-pro-v2.5.2-windows-portable.zip`
   - `genpwd-pro-v2.5.2-windows.zip`
3. Ajoutez les notes de version depuis `WINDOWS-RELEASE-NOTES.md`

### Checksums

Générez les checksums pour vérification:

```bash
# SHA256
sha256sum genpwd-pro-v2.5.2-windows-portable.zip
sha256sum genpwd-pro-v2.5.2-windows.zip

# MD5
md5sum genpwd-pro-v2.5.2-windows-portable.zip
md5sum genpwd-pro-v2.5.2-windows.zip
```

## 🐛 Dépannage

### Erreur "require is not defined"

**Problème:** Le script build.js utilise CommonJS dans un projet ES modules.

**Solution:** Le fichier `tools/build.js` a été converti en ES modules:
```javascript
// Avant
const fs = require('fs');

// Après
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

### Le build échoue

```bash
# Nettoyer et recommencer
rm -rf dist/
npm run clean
npm run build
```

### Les fichiers ne s'ouvrent pas

- Vérifiez que tous les fichiers sont dans le même dossier
- Testez directement avec `index.html`
- Vérifiez les permissions des fichiers

## 📚 Ressources

- [Documentation Build System](./TECHNICAL.md#build-system)
- [Architecture Modulaire](./TECHNICAL.md#architecture)
- [Guide de Contribution](../CONTRIBUTING.md)

## 📄 Licence

Apache License 2.0 © 2025 Julien Bombled
