# GenPwd Pro - Extensions Navigateur

Guide complet pour les extensions Chrome et Firefox de GenPwd Pro.

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Architecture Technique](#architecture-technique)
- [Publication](#publication)
- [Sécurité](#sécurité)
- [Développement](#développement)

## 🎯 Vue d'ensemble

Les extensions GenPwd Pro pour Chrome et Firefox permettent de générer des mots de passe sécurisés directement depuis votre navigateur, sans quitter la page web que vous consultez.

### Plateformes Supportées

- **Chrome** : Version 88+ (Manifest V3)
- **Firefox** : Version 91+ (Manifest V2/WebExtension)
- **Edge** : Compatible avec l'extension Chrome
- **Brave** : Compatible avec l'extension Chrome

## ✨ Fonctionnalités

### 1. Génération de Mots de Passe

- **3 modes de génération** :
  - **Syllabes** : Alternance consonnes/voyelles (recommandé)
  - **Passphrase** : Mots aléatoires avec séparateurs
  - **Leet Speak** : Transformation avec substitutions

- **Configuration complète** :
  - Longueur : 6-64 caractères
  - Chiffres : 0-6
  - Caractères spéciaux : 0-6
  - Politique : standard, alphanumérique, layout-safe
  - Casse : mixte, minuscule, majuscule, title case
  - Quantité : 1-20 mots de passe

### 2. Auto-fill dans les Formulaires

- Détection automatique des champs de mot de passe
- Ajout d'icône 🔐 pour génération rapide
- Remplissage automatique du champ actif
- Support des Single Page Applications (SPA)

### 3. Menu Contextuel

- Clic droit sur un champ de saisie
- Option "Générer un mot de passe"
- Insertion automatique

### 4. Copie en Un Clic

- Bouton "📋 Copier" pour chaque mot de passe généré
- Feedback visuel (✓ Copié!)
- Accès au presse-papiers sécurisé

### 5. Synchronisation des Paramètres

- Sauvegarde automatique via `chrome.storage.sync`
- Synchronisation cross-device
- Restauration des paramètres favoris

### 6. Indicateur de Force

- Calcul de l'entropie en bits
- Badge coloré : Faible, Moyen, Fort, Très Fort
- Aide à la sélection du meilleur mot de passe

## 📥 Installation

### Chrome

#### Via Chrome Web Store (Recommandé)

1. Visitez [Chrome Web Store](#) (lien à venir)
2. Recherchez "GenPwd Pro"
3. Cliquez sur **"Ajouter à Chrome"**
4. Confirmez les permissions

#### Installation Manuelle (Développement)

1. Téléchargez le code source depuis [GitHub](https://github.com/VBlackJack/genpwd-pro)
2. Ouvrez Chrome et naviguez vers `chrome://extensions/`
3. Activez le **Mode développeur** (toggle en haut à droite)
4. Cliquez sur **"Charger l'extension non empaquetée"**
5. Sélectionnez le dossier `/extensions/chrome/`

### Firefox

#### Via Firefox Add-ons (Recommandé)

1. Visitez [Firefox Add-ons](#) (lien à venir)
2. Recherchez "GenPwd Pro"
3. Cliquez sur **"Ajouter à Firefox"**
4. Confirmez les permissions

#### Installation Manuelle (Développement)

1. Téléchargez le code source depuis [GitHub](https://github.com/VBlackJack/genpwd-pro)
2. Ouvrez Firefox et naviguez vers `about:debugging`
3. Cliquez sur **"Ce Firefox"** dans le menu latéral
4. Cliquez sur **"Charger un module complémentaire temporaire"**
5. Sélectionnez le fichier `/extensions/firefox/manifest.json`

## 🚀 Utilisation

### Méthode 1 : Popup

1. Cliquez sur l'icône **GenPwd Pro** dans la barre d'outils
2. Choisissez le **mode de génération** (syllabes, passphrase, leet)
3. Configurez les **paramètres** (longueur, chiffres, spéciaux, etc.)
4. Cliquez sur **"🎲 Générer"**
5. Copiez le mot de passe avec **"📋 Copier"**

### Méthode 2 : Menu Contextuel

1. Cliquez droit sur un champ de saisie (input, textarea)
2. Sélectionnez **"Générer un mot de passe"**
3. Le mot de passe est automatiquement inséré

### Méthode 3 : Icône dans les Champs

1. Les champs `<input type="password">` affichent une icône 🔐
2. Cliquez sur l'icône pour générer et remplir

## ⚙️ Configuration

### Modes de Génération

#### Mode Syllabes (Recommandé)

- **Longueur** : 6-64 caractères
- **Politique** :
  - `Standard` : Tous les caractères
  - `Standard Layout` : Compatible clavier AZERTY/QWERTY
  - `Alphanumérique` : Lettres + chiffres uniquement
  - `Alphanumérique Layout` : Alphanumérique + layout-safe

**Exemple** : `duNokUpYg!aKuKYMaci5@` (103 bits)

#### Mode Passphrase

- **Nombre de mots** : 2-8
- **Séparateur** : `-`, `.`, `_`, ` `, etc.
- **Dictionnaire** : Français, English, Latin

**Exemple** : `Forcer-Vague-Nature-Coeur-Liberte` (77 bits)

#### Mode Leet Speak

- **Mot à transformer** : Votre mot source
- **Substitutions** : a→@, e→3, i→1, o→0, s→5, t→7, l→!, g→9, b→8

**Exemple** : `P@55W0RD` → `P@55W0RD!7@`

### Paramètres Communs

- **Chiffres** : 0-6 (position aléatoire)
- **Spéciaux** : 0-6 (position aléatoire)
- **Casse** :
  - `Mixte` : Aléatoire (cryptographique)
  - `Minuscule` : Tout en minuscules
  - `Majuscule` : Tout en majuscules
  - `Title Case` : Première lettre de chaque mot en majuscule

- **Quantité** : 1-20 mots de passe générés simultanément

## 🏗️ Architecture Technique

### Structure des Fichiers

```
chrome/
├── manifest.json          # Manifest V3 (Chrome)
├── popup.html             # UI du popup
├── popup.css              # Styles
├── popup.js               # Logique UI
├── background.js          # Service worker (Chrome MV3)
├── content.js             # Script injecté dans les pages
├── core/
│   ├── generators.js      # Générateurs de mots de passe
│   ├── casing.js          # Gestion de la casse
│   └── dictionaries.js    # Dictionnaires multilingues
├── utils/
│   ├── helpers.js         # Fonctions utilitaires
│   └── logger.js          # Logging
├── config/
│   └── constants.js       # Constantes et jeux de caractères
└── icons/
    ├── icon16.png         # 16x16
    ├── icon32.png         # 32x32
    ├── icon48.png         # 48x48
    └── icon128.png        # 128x128

firefox/
└── (structure identique avec manifest.json pour Manifest V2)
```

### Flux de Données

```
User Click (Popup)
    ↓
[popup.js] handleGenerate()
    ↓
[generators.js] generateSyllables/Passphrase/Leet()
    ├→ [casing.js] applyCase()
    ├→ [helpers.js] insertWithPlacement()
    └→ [helpers.js] calculateEntropy()
    ↓
[popup.js] displayResults()
    ↓
[popup.js] copyPassword() → navigator.clipboard
```

### Permissions Requises

#### Chrome (Manifest V3)

```json
{
  "permissions": [
    "storage",        // Sauvegarde des paramètres
    "activeTab",      // Accès à l'onglet actif
    "clipboardWrite"  // Copie dans le presse-papiers
  ],
  "host_permissions": [
    "<all_urls>"      // Auto-fill sur tous les sites
  ]
}
```

#### Firefox (Manifest V2)

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "clipboardWrite",
    "contextMenus",
    "<all_urls>"
  ]
}
```

### Sécurité

- **Randomness cryptographique** : `crypto.getRandomValues()`
- **Content Security Policy** : `script-src 'self'`
- **Pas de télémétrie** : Aucune donnée envoyée
- **Stockage local uniquement** : Pas de serveur externe
- **Permissions minimales** : Principe du moindre privilège

## 📦 Publication

### Chrome Web Store

#### Prérequis

1. Compte développeur Chrome Web Store (5 USD unique)
2. Icônes : 16x16, 32x32, 48x48, 128x128 px (PNG)
3. Screenshots : 1280x800 ou 640x400 px (PNG/JPEG)
4. Texte promotionnel :
   - **Titre** : GenPwd Pro (max 45 caractères)
   - **Description courte** : max 132 caractères
   - **Description détaillée** : max 16384 caractères

#### Étapes

1. **Créer un ZIP** :
   ```bash
   cd extensions/chrome
   zip -r genpwd-pro-chrome.zip * -x "*.git*" -x "*.DS_Store"
   ```

2. **Upload sur le Dashboard** :
   - [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - "New Item" → Upload ZIP
   - Remplir les métadonnées
   - Ajouter les screenshots
   - Choisir les catégories (Productivity, Security)

3. **Soumettre pour révision** :
   - Délai : 1-3 jours ouvrés
   - Vérification automatique + manuelle

4. **Publication** :
   - Publier immédiatement ou à une date planifiée

### Firefox Add-ons

#### Prérequis

1. Compte développeur Firefox (gratuit)
2. Icônes : 48x48, 96x96 px (PNG)
3. Screenshots (optionnel)

#### Étapes

1. **Créer un ZIP** :
   ```bash
   cd extensions/firefox
   zip -r genpwd-pro-firefox.zip * -x "*.git*" -x "*.DS_Store"
   ```

2. **Upload sur AMO** :
   - [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
   - "Submit a New Add-on" → Upload ZIP
   - Remplir les métadonnées
   - Choisir "On this site" (self-hosted) ou "On AMO" (Mozilla hosting)

3. **Validation Automatique** :
   - Délai : quelques heures à 1-2 jours
   - Vérification de sécurité automatique

4. **Publication** :
   - Approbation automatique si aucun problème détecté

## 🛠️ Développement

### Recharger l'Extension

#### Chrome

1. `chrome://extensions/`
2. Cliquer sur le bouton **"🔄 Recharger"** sous l'extension

#### Firefox

1. `about:debugging`
2. "Ce Firefox" → Cliquer sur **"Recharger"**

### Debugging

#### Chrome

1. Clic droit sur l'icône de l'extension → "Inspecter le popup"
2. Onglet "Console" pour voir les logs

#### Firefox

1. `about:debugging`
2. "Ce Firefox" → "Inspecter" sous l'extension
3. Onglet "Console"

### Tests

- ✅ Tester la génération dans le popup
- ✅ Tester l'auto-fill sur différents sites (login forms)
- ✅ Tester le menu contextuel
- ✅ Vérifier la synchronisation des paramètres
- ✅ Tester sur différents navigateurs (Chrome, Firefox, Edge)
- ✅ Vérifier les performances (génération < 100ms)

## 🔒 Politique de Confidentialité

GenPwd Pro ne collecte **aucune donnée personnelle** :

- ✅ Aucun tracking / analytics
- ✅ Aucune télémétrie
- ✅ Aucun serveur externe
- ✅ Stockage local uniquement
- ✅ Code open source auditable

## 📄 Licence

Apache License 2.0 - Copyright 2025 Julien Bombled

## 🔗 Liens Utiles

- [Code source](https://github.com/VBlackJack/genpwd-pro)
- [Signaler un bug](https://github.com/VBlackJack/genpwd-pro/issues)
- [Guide utilisateur](USER-GUIDE.md)
- [Documentation API](API.md)
