# GenPwd Pro - Extensions Navigateur

Extensions pour Chrome et Firefox permettant de générer des mots de passe sécurisés directement depuis votre navigateur.

## 📦 Contenu

- `/chrome/` - Extension pour Google Chrome (Manifest V3)
- `/firefox/` - Extension pour Mozilla Firefox (Manifest V2)

## ✨ Fonctionnalités

- 🎲 **Génération de mots de passe sécurisés** avec plusieurs modes :
  - **Syllabes** : Alternance consonnes/voyelles (recommandé)
  - **Passphrase** : Mots aléatoires avec séparateurs
  - **Leet Speak** : Transformation avec substitutions
- 🔐 **Auto-fill** dans les champs de formulaires
- 📋 **Copie en un clic** vers le presse-papiers
- 💾 **Synchronisation des paramètres** via le stockage du navigateur
- 🎨 **Interface moderne** et intuitive
- 🔒 **Randomness cryptographique** (crypto.getRandomValues)
- 📊 **Calcul de l'entropie** et indicateur de force

## 🚀 Installation

### Chrome

#### Depuis le Chrome Web Store (après publication)

1. Visitez [Chrome Web Store](https://chrome.google.com/webstore)
2. Recherchez "GenPwd Pro"
3. Cliquez sur "Ajouter à Chrome"

#### Installation manuelle (développement)

1. Ouvrez Chrome et allez à `chrome://extensions/`
2. Activez le "Mode développeur" (coin supérieur droit)
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez le dossier `/extensions/chrome/`

### Firefox

#### Depuis Firefox Add-ons (après publication)

1. Visitez [Firefox Add-ons](https://addons.mozilla.org)
2. Recherchez "GenPwd Pro"
3. Cliquez sur "Ajouter à Firefox"

#### Installation manuelle (développement)

1. Ouvrez Firefox et allez à `about:debugging`
2. Cliquez sur "Ce Firefox" dans le menu latéral
3. Cliquez sur "Charger un module complémentaire temporaire"
4. Sélectionnez le fichier `/extensions/firefox/manifest.json`

## 📖 Utilisation

### Via le Popup

1. Cliquez sur l'icône de l'extension dans la barre d'outils
2. Choisissez le mode de génération
3. Configurez les paramètres (longueur, chiffres, spéciaux, etc.)
4. Cliquez sur "🎲 Générer"
5. Copiez le mot de passe généré

### Via le Menu Contextuel

1. Clic droit sur un champ de saisie
2. Sélectionnez "Générer un mot de passe"
3. Le mot de passe est automatiquement inséré

### Auto-fill dans les Formulaires

L'extension détecte automatiquement les champs de mot de passe et ajoute une icône 🔐 pour générer rapidement.

## ⚙️ Configuration

Les paramètres suivants sont sauvegardés automatiquement :

- **Mode** : syllables, passphrase, leet
- **Longueur** : 6-64 caractères
- **Politique** : standard, alphanumerique, layout-safe
- **Chiffres** : 0-6
- **Spéciaux** : 0-6
- **Casse** : mixte, minuscule, majuscule, title
- **Quantité** : 1-20 mots de passe

## 🏗️ Structure des Fichiers

```
chrome/
├── manifest.json          # Manifest V3 pour Chrome
├── popup.html             # Interface du popup
├── popup.css              # Styles
├── popup.js               # Logique du popup
├── background.js          # Service worker
├── content.js             # Script injecté dans les pages
├── core/                  # Générateurs de mots de passe
│   ├── generators.js      # Générateurs principaux
│   ├── casing.js          # Gestion de la casse
│   └── dictionaries.js    # Dictionnaires multilingues
├── utils/                 # Utilitaires
│   ├── helpers.js         # Fonctions d'aide
│   └── logger.js          # Logging
├── config/                # Configuration
│   └── constants.js       # Constantes et jeux de caractères
└── icons/                 # Icônes (16, 32, 48, 128px)

firefox/
└── (même structure avec manifest.json pour Manifest V2)
```

## 🔐 Sécurité

- **Randomness cryptographique** : Utilisation de `crypto.getRandomValues()`
- **Aucune télémétrie** : Aucune donnée n'est envoyée à des serveurs tiers
- **Stockage local** : Les paramètres sont stockés uniquement dans le navigateur
- **Permissions minimales** : Seules les permissions nécessaires sont demandées
- **Open source** : Code source disponible pour audit

## 🎨 Personnalisation des Icônes

Les icônes doivent être placées dans `/chrome/icons/` et `/firefox/icons/` :

- Chrome : 16x16, 32x32, 48x48, 128x128 px (PNG)
- Firefox : 48x48, 96x96 px (PNG)

Utilisez le logo de GenPwd Pro ou créez vos propres icônes.

## 📝 Publication

### Chrome Web Store

1. Créez un compte développeur sur [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Payez les frais d'inscription unique (5 USD)
3. Créez un fichier ZIP de l'extension :
   ```bash
   cd extensions/chrome
   zip -r genpwd-pro-chrome.zip * -x "*.git*" -x "*.DS_Store"
   ```
4. Téléchargez le ZIP sur le dashboard
5. Remplissez les métadonnées (description, captures d'écran, etc.)
6. Soumettez pour révision

### Firefox Add-ons

1. Créez un compte sur [addons.mozilla.org](https://addons.mozilla.org/developers/)
2. Créez un fichier ZIP de l'extension :
   ```bash
   cd extensions/firefox
   zip -r genpwd-pro-firefox.zip * -x "*.git*" -x "*.DS_Store"
   ```
3. Soumettez le ZIP sur addons.mozilla.org
4. Attendez la validation automatique (peut prendre quelques heures)

## 🛠️ Développement

### Prérequis

- Node.js 16+ (pour les outils de build)
- Chrome ou Firefox

### Commandes

```bash
# Recharger l'extension après modifications
# Chrome : chrome://extensions/ → bouton "Recharger"
# Firefox : about:debugging → bouton "Recharger"
```

### Tests

- Testez la génération de mots de passe dans le popup
- Testez l'auto-fill dans des formulaires réels
- Testez la synchronisation des paramètres
- Vérifiez la compatibilité avec différents sites web

## 📄 Licence

Apache License 2.0 - Copyright 2025 Julien Bombled

## 🔗 Liens

- [Projet GitHub](https://github.com/VBlackJack/genpwd-pro)
- [Documentation complète](../docs/BROWSER_EXTENSIONS.md)
- [Signaler un bug](https://github.com/VBlackJack/genpwd-pro/issues)
