# Guide Utilisateur - GenPwd Pro v3.0

> Guide complet pour maîtriser toutes les fonctionnalités du générateur et gestionnaire de mots de passe

## Table des matières

1. [Démarrage rapide](#démarrage-rapide)
2. [Modes de génération](#modes-de-génération)
3. [Placement avancé](#placement-avancé)
4. [Système de blocs de casse](#système-de-blocs-de-casse)
5. [Coffre-fort sécurisé](#coffre-fort-sécurisé)
6. [Audit de sécurité](#audit-de-sécurité)
7. [Authentification 2FA/TOTP](#authentification-2fatotp)
8. [Import/Export](#importexport)
9. [Application Desktop](#application-desktop)
10. [Raccourcis clavier](#raccourcis-clavier)
11. [Conseils de sécurité](#conseils-de-sécurité)

---

## 🚀 Démarrage rapide

### Premier lancement

1. **Ouvrez l'application** dans votre navigateur ou lancez l'application desktop
2. L'interface s'affiche avec les options de génération
3. **Choisissez un mode** : Syllables (défaut), Passphrase ou Leet
4. **Cliquez sur "Générer"** pour créer votre premier mot de passe
5. **Copiez** le résultat avec le bouton dédié

### Interface principale

L'interface se compose de :
- **Zone de configuration** : Mode, longueur, options
- **Bouton de génération** : Action principale avec animation
- **Zone de résultat** : Affichage du mot de passe avec indicateur d'entropie
- **Actions rapides** : Copier, Masquer/Afficher, Exporter
- **Coffre-fort** : Accès au gestionnaire de mots de passe (v3.0)

---

## 🎯 Modes de génération

### Mode Syllables (Prononcable)

**Cas d'usage** : Mots de passe mémorisables mais sécurisés

Le mode Syllables crée des mots de passe prononcables en alternant consonnes et voyelles :

```
Exemple court : nywOVyQep.Ocy (36.8 bits)
Exemple sécurisé : nywOVyQep.OcyBoWEFY8KiLu (89.4 bits)
Pour atteindre 100+ bits : 25+ caractères recommandés
```

**Options disponibles** :
- **Longueur** : 3 à 10 syllabes
- **Caractères spéciaux** : Insertion automatique ou manuelle
- **Chiffres** : Placement intelligent en fin de mot

### Mode Passphrase (Mots séparés)

**Cas d'usage** : Phrases de passe longues mais simples à retenir

```
Exemple : Forcer-Vague-Nature2
Entropie : 105 bits
Dictionnaire : 2429 mots français
```

**Options disponibles** :
- **Nombre de mots** : 3 à 8 mots
- **Séparateurs** : `-`, `_`, `.` ou espace
- **Dictionnaire** : Français, English, Latin

### Mode Leet Speak (L33t)

**Cas d'usage** : Transformation de mots familiers en version sécurisée

```
Exemple : P@55W0RD_
Transformations : a→@, e→3, o→0, s→5
```

---

## 📍 Placement avancé

### Système de placement visuel

Le placement visuel permet de positionner précisément les caractères spéciaux :

```
Début    : #6HOBumefyri
Milieu   : HoBu#6mefyri
Fin      : HOBumefyri#6
```

### Utilisation de l'interface

1. **Activez le mode placement** en cliquant sur l'icône 📍
2. **Glissez la barre** pour choisir la position (0-100%)
3. **Aperçu en temps réel** du placement
4. **Générez** pour appliquer le placement

---

## 🎨 Système de blocs de casse

### Comprendre les blocs U/T/L

- **U (UPPER)** : Tout en MAJUSCULES
- **T (Title)** : Première Lettre Majuscule
- **L (lower)** : tout en minuscules

### Exemples de patterns

**Pattern U-T-L** :
```
PREMIER-Deuxieme-troisieme
```

**Pattern T-T-T** (défaut) :
```
Premier-Deuxieme-Troisieme
```

---

## 🔐 Coffre-fort sécurisé

### Nouveau dans v3.0

GenPwd Pro v3.0 transforme l'application en un **gestionnaire de mots de passe complet**, rivalisant avec KeePass et Bitwarden.

### Création d'un coffre-fort

1. Cliquez sur **"Coffre-fort"** dans le menu principal
2. Définissez un **mot de passe maître** (minimum 12 caractères recommandé)
3. Le coffre est créé avec chiffrement **AES-256-GCM**

### Types d'entrées

| Type | Description | Champs |
|------|-------------|--------|
| **Login** | Identifiants de connexion | Username, Password, URL |
| **Note sécurisée** | Texte chiffré | Note avec rendu Markdown |
| **Carte bancaire** | Données de paiement | Numéro, Expiration, CVV |
| **Identité** | Informations personnelles | Nom, Email, Téléphone |

### Organisation des entrées

- **Dossiers** : Créez une hiérarchie avec des sous-dossiers
- **Tags** : Ajoutez des étiquettes colorées pour catégoriser
- **Favoris** : Marquez vos entrées les plus utilisées
- **Recherche avancée** : Utilisez des opérateurs comme `tag:`, `type:`, `folder:`

### Actions rapides

- **Double-clic** sur une entrée : Copie le mot de passe
- **Clic droit** : Menu contextuel avec toutes les actions
- **Survol** : Boutons d'actions rapides (copier, ouvrir URL)

---

## 🛡️ Audit de sécurité

### Dashboard de sécurité

Le tableau de bord analyse automatiquement vos mots de passe :

- **Score global** : 0-100 avec jauge visuelle
- **Mots de passe faibles** : Entropie < 60 bits
- **Mots de passe réutilisés** : Détection via hash SHA-256
- **Mots de passe anciens** : > 1 an sans changement

### Recommandations

Cliquez sur chaque catégorie pour :
- Voir les entrées concernées
- Recevoir des suggestions d'amélioration
- Générer un nouveau mot de passe directement

---

## 🔑 Authentification 2FA/TOTP

### Générateur TOTP intégré

GenPwd Pro inclut un générateur de codes TOTP conforme RFC 6238 :

1. **Ajoutez une entrée Login**
2. Cliquez sur **"Ajouter TOTP"**
3. Scannez le QR code ou entrez la clé manuellement
4. Les codes se rafraîchissent automatiquement toutes les 30 secondes

### Formats supportés

- URI `otpauth://totp/...`
- Clé secrète Base32
- QR Code (scan)

### Algorithmes supportés

- SHA1 (défaut, compatibilité maximale)
- SHA256
- SHA512

---

## 📥 Import/Export

### Import depuis d'autres gestionnaires

| Source | Format | Fonctionnalités |
|--------|--------|-----------------|
| **KeePass 2.x** | XML | Groupes, champs personnalisés, notes |
| **Bitwarden** | JSON | Collections, tous types d'entrées |
| **CSV générique** | CSV | Détection intelligente des colonnes |

### Processus d'import

1. Exportez depuis votre ancien gestionnaire
2. Dans GenPwd Pro, cliquez sur **"Importer"**
3. Sélectionnez ou glissez-déposez le fichier
4. Prévisualisez les entrées avant confirmation
5. Les entrées sont ajoutées à votre coffre

### Export

- **Format .gpdb** : Format natif chiffré
- **Backup** : Sauvegarde automatique avant écrasement

---

## 🖥️ Application Desktop

### Fonctionnalités Electron

L'application desktop offre des fonctionnalités exclusives :

#### System Tray
- **Icône** dans la zone de notification
- **Menu contextuel** : Afficher, Générer, Verrouiller, Quitter
- **Génération rapide** depuis le tray avec copie auto-clear (30s)
- **Minimize to Tray** : Fermer ne quitte pas l'application

#### Global Hotkey (Boss Key)
- **Windows/Linux** : `Ctrl+Shift+P`
- **macOS** : `Cmd+Shift+P`
- Toggle visibilité depuis n'importe quelle application

#### Mode Compact
- Fenêtre flottante 380x640 pixels
- Always on Top pour remplissage facile
- Interface simplifiée : Recherche + liste uniquement

#### Auto-Type (KeePass-style)
Séquence configurable pour saisie automatique :
```
{USERNAME}{TAB}{PASSWORD}{ENTER}
```

Placeholders supportés :
- `{USERNAME}`, `{PASSWORD}`, `{URL}`, `{NOTES}`
- `{TAB}`, `{ENTER}`, `{DELAY N}`

---

## ⌨️ Raccourcis clavier

### Navigation générale

| Raccourci | Action |
|-----------|--------|
| `Ctrl+N` / `Cmd+N` | Nouvelle entrée |
| `Ctrl+E` / `Cmd+E` | Éditer entrée sélectionnée |
| `Delete` | Supprimer entrée |
| `Ctrl+F` / `Cmd+F` | Recherche |
| `Escape` | Fermer modal / Annuler |

### Actions sur les entrées

| Raccourci | Action |
|-----------|--------|
| `Ctrl+C` / `Cmd+C` | Copier mot de passe |
| `Ctrl+Shift+C` | Copier username |
| `Ctrl+U` / `Cmd+U` | Ouvrir URL |
| `Ctrl+B` / `Cmd+B` | Toggle favori |

### Desktop uniquement

| Raccourci | Action |
|-----------|--------|
| `Ctrl+Shift+P` / `Cmd+Shift+P` | Toggle visibilité (global) |
| `Ctrl+L` / `Cmd+L` | Verrouiller coffre |
| `Ctrl+M` / `Cmd+M` | Mode compact |

---

## 🔐 Conseils de sécurité

### Mot de passe maître

- **Minimum** : 12 caractères
- **Recommandé** : 16+ caractères ou passphrase de 4+ mots
- **Jamais** : Réutiliser un mot de passe existant
- **Mémorisation** : Utilisez une phrase personnelle transformée

### Bonnes pratiques

```
✅ Mot de passe unique par service
✅ Activer 2FA partout où possible
✅ Vérifier régulièrement l'audit de sécurité
✅ Faire des sauvegardes régulières du coffre
✅ Utiliser le verrouillage automatique
```

### Paramètres de sécurité

- **Auto-Lock** : Verrouillage après inactivité (1-60 min)
- **Clipboard Clear** : Nettoyage automatique (30s par défaut)
- **Visual Protection** : Floutage quand fenêtre perd le focus

### En cas de compromission

1. **Changez immédiatement** le mot de passe maître
2. **Identifiez** les entrées potentiellement compromises
3. **Changez** les mots de passe des services concernés
4. **Activez 2FA** sur tous les comptes critiques

---

## 💡 Astuces avancées

### Recherche avancée

Utilisez des opérateurs pour filtrer :
```
tag:important           # Entrées avec le tag "important"
type:login              # Uniquement les logins
folder:Travail          # Dans le dossier "Travail"
has:totp                # Entrées avec TOTP configuré
-archived               # Exclure les entrées archivées
```

### Templates personnalisés

Créez des templates pour vos types d'entrées fréquents :
1. Créez une entrée modèle
2. Clic droit → "Enregistrer comme template"
3. Utilisez le template lors de la création

### Historique des mots de passe

Chaque entrée conserve l'historique des modifications :
- Consultez les anciennes versions
- Restaurez un mot de passe précédent si nécessaire
- Utile en cas de changement accidentel

---

<div align="center">
  <b>Besoin d'aide ?</b><br>
  Consultez la <a href="./TECHNICAL.md">documentation technique</a> ou créez une <a href="https://github.com/VBlackJack/genpwd-pro/issues">issue sur GitHub</a>
</div>
