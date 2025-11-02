# GenPwd Pro - Android

[![Android CI](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml/badge.svg)](https://github.com/VBlackJack/genpwd-pro/actions/workflows/android-ci.yml)

**Version:** 1.2.0-alpha.7
**Application de gestion de mots de passe ultra-sécurisée pour Android**

GenPwd Pro Android est un **gestionnaire de mots de passe complet** avec coffre-fort chiffré (Vault), générateur de mots de passe avancé, support TOTP/2FA, et synchronisation cloud. Conçu avec les dernières technologies Android et une architecture de sécurité militaire (Argon2id + AES-256-GCM).

---

## ⚠️ Architecture Actuelle (Post-Migration)

**IMPORTANT :** GenPwd Pro utilise un **système de fichiers .gpv** (GenPwd Vault) pour stocker les données sensibles.

- ✅ **Production** : Fichiers `.gpv` chiffrés (JSON portable)
- ✅ **Room Database** : Uniquement pour métadonnées (registre, historique)
- ❌ **Ancien système Room-based** : Déprécié (DEBUG only)

📖 **Pour une compréhension complète de l'architecture, consultez [ARCHITECTURE.md](ARCHITECTURE.md)**

---

## Table des matières

- [Architecture Actuelle](#architecture-actuelle-post-migration)
- [Fonctionnalités](#fonctionnalités)
- [Architecture de sécurité](#architecture-de-sécurité)
- [Pile technologique](#pile-technologique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Architecture du projet](#architecture-du-projet)
- [Statistiques](#statistiques)
- [Roadmap](#roadmap)
- [Contribution](#contribution)
- [Licence](#licence)

---

## Fonctionnalités

### 🔐 Coffre-fort sécurisé (Vault System)

- **Chiffrement militaire** : Argon2id (dérivation de clé) + AES-256-GCM (chiffrement authentifié)
- **Multi-vaults** : Créez plusieurs coffres-forts indépendants avec master passwords différents
- **Architecture zero-knowledge** : Vos données ne sont jamais accessibles sans master password
- **Déverrouillage biométrique** ✨ **IMPROVED in alpha.7** :
  - Support empreinte digitale et reconnaissance faciale (BIOMETRIC_STRONG)
  - Messages d'erreur détaillés avec guidance actionnable
  - Prompts contextuels adaptés au vault
  - Variantes courtes/longues pour différents contextes UI
  - Messages d'état de disponibilité biométrique
- **Auto-lock** : Verrouillage automatique après inactivité (configurable 1-60 min)
- **In-memory keys** : Clés de chiffrement stockées uniquement en RAM (wiped on lock)

### 📝 Gestion des entrées (4 types)

**1. Mots de passe (LOGIN)**
- Titre, username, password, URL, notes
- Génération de mots de passe intégrée
- Score de sécurité automatique
- Détection de compromission (Have I Been Pwned)
- Historique des versions

**2. Notes sécurisées (NOTE)**
- Notes textuelles chiffrées
- Markdown support
- Tags et favoris
- Recherche full-text

**3. Cartes bancaires (CARD)**
- Numéro de carte (chiffré)
- CVV (chiffré)
- Date d'expiration
- Code PIN (chiffré)
- Nom du titulaire

**4. Identités (IDENTITY)**
- Passeport, permis de conduire, CNI
- Nom complet, date de naissance
- Numéro de document
- Données personnelles chiffrées

### 🔢 Authentification à deux facteurs (2FA/TOTP)

- **Générateur TOTP intégré** : Compatible Google Authenticator, Authy, etc.
- **Codes en temps réel** : Affichage du code avec compte à rebours animé
- **Scan QR code** : Configuration rapide (à venir)
- **URI parsing** : Support otpauth://totp/...
- **Multi-algorithmes** : SHA1, SHA256, SHA512
- **Périodes configurables** : 30s, 60s, etc.
- **RFC 6238 compliant** : Standard industrie

### ⚡ Générateur de mots de passe

**Générateur classique :**
- Longueur configurable (8-32 caractères)
- Majuscules, minuscules, chiffres, symboles
- Mots séparables pour mémorisation
- Placement visuel des caractères
- Copie rapide dans presse-papiers
- Évaluation de la force (0-100%)

**Générateur de phrases :**
- Phrases aléatoires de 3-10 mots
- Liste de 10 000+ mots français
- Séparateurs personnalisables
- Plus mémorables et sécurisées
- Support dictionnaires multilingues (FR/EN/LA)

**Modes de génération :**
- ✅ **Syllables** : Mots prononcables (alternance consonnes/voyelles)
- ✅ **Passphrase** : Phrases de passe depuis dictionnaires
- ✅ **Leet Speak** : Transformation l33t
- ✅ **Système de blocs** : Patterns de casse personnalisés (U/T/L)
- ✅ **Placement visuel** : Contrôle précis des chiffres et spéciaux (0-100%)
- ✅ **Calcul d'entropie** : Jusqu'à 140 bits

### 📊 Analyse de sécurité ✨ **NEW in alpha.7**

**Dashboard de santé des mots de passe :**
- **Score global animé** : Gauge circulaire 0-100 avec animations fluides
- **Détection automatique** des problèmes de sécurité :
  - Mots de passe faibles (< 60%) avec raisons détaillées
  - Mots de passe réutilisés (groupés par fréquence)
  - Mots de passe compromis (Have I Been Pwned API)
  - Mots de passe anciens (> 90 jours sans mise à jour)
- **Statistiques rapides** : Total, moyenne de force
- **Actions recommandées** : Cartes cliquables pour corriger les problèmes
- **Navigation intégrée** : Accessible depuis le menu du vault

**Analyse de sécurité additionnelle :**

- **Password Analysis Tool** : Analyse approfondie de sécurité
- **Détection des mots de passe faibles** : Score < 60/100
- **Détection des doublons** : Identifie les mots de passe réutilisés
- **Mots de passe compromis** : Vérification via Have I Been Pwned API
- **Dashboard de santé** : Vue d'ensemble de la sécurité du vault
- **Statistiques** : Nombre total, par type, score moyen

### 🌐 Synchronisation cloud (E2E) ✨ NEW

**Status : ✅ PRODUCTION-READY avec 2 providers fonctionnels**

- **Chiffrement End-to-End** : AES-256-GCM avant upload (Zero-Knowledge)
- **2 Providers Production** :
  - ✅ **Google Drive** : OAuth2, 15 GB gratuit
  - ✅ **WebDAV** : Self-hosted (Nextcloud/ownCloud/Synology), privacy maximale
- **3 Providers Templates** : OneDrive, pCloud, ProtonDrive (guides d'implémentation inclus)
- **Résolution de conflits intelligente** : 5 stratégies (LOCAL_WINS, REMOTE_WINS, NEWEST_WINS, SMART_MERGE, MANUAL)
- **Synchronisation automatique** : WorkManager avec intervalle configurable (15min-24h)
- **Multi-devices** : Synchronisez entre tous vos appareils Android
- **Historique complet** : Statistiques détaillées, taux de succès, erreurs
- **Interface moderne** : Navigation intégrée (Paramètres → Historique)
- **Documentation complète** : 6 fichiers (3,800+ lignes) incluant guides OAuth2 pour utilisateurs

### 🔄 Import/Export

**Formats supportés :**
- CSV (import/export)
- JSON (export chiffré)
- KeePass KDBX (import) - à venir

**Backup automatique :**
- Sauvegarde locale chiffrée
- Export cloud sécurisé
- Restauration complète

### 📱 Organisation avancée

**Dossiers hiérarchiques :**
- Structure arborescente
- Dossiers imbriqués
- Icônes et couleurs personnalisées

**Tags multiples :**
- Tags par entrée (many-to-many)
- Filtrage par tag
- Couleurs personnalisées

**Favoris :**
- Marquer les entrées importantes
- Filtre favoris only
- Accès rapide

**Recherche puissante :**
- Recherche en temps réel
- Recherche full-text (titre, username, URL, notes)
- Filtres combinables (type + favoris + tags)

### 🎨 Interface moderne

- **Jetpack Compose 100%** : UI déclarative et performante
- **Material Design 3** : Interface moderne et cohérente
- **Dark theme** : Thème sombre élégant avec transitions fluides
- **Material You** ✨ **ENHANCED in alpha.7** :
  - **Activé par défaut** sur Android 12+ (API 31+)
  - Extraction automatique des couleurs du fond d'écran
  - Palette harmonieuse personnalisée pour chaque utilisateur
  - Fallback gracieux vers couleurs custom sur Android 11 et antérieur
  - Documentation complète de l'implémentation (Theme.kt, Color.kt)
- **Sections repliables** : Organisation intelligente sur mobile
- **Animations fluides** : Transitions et micro-interactions

### 🚀 Autres fonctionnalités

- **Onboarding** : 3 écrans d'introduction pour nouveaux utilisateurs
- **Autofill Service** : Remplissage automatique dans apps et navigateurs
- **Biometric unlock** : Empreinte digitale et reconnaissance faciale
- **Auto-lock** : Timeout configurable avec lock on background
- **Password history** : Historique des anciennes versions
- **ProGuard/R8** : Optimisation APK (-30% taille)

---

## Architecture de sécurité

GenPwd Pro utilise une architecture de sécurité en couches multiples basée sur les standards cryptographiques modernes.

### 1. Master Password → Derived Key (Argon2id)

```
Master Password
    ↓
Argon2id (3 iterations, 64MB memory, 4 threads)
    ↓
Derived Key (256 bits)
```

**Paramètres Argon2id :**
- **Iterations** : 3 (résistance aux attaques par force brute)
- **Memory** : 65536 KB (64 MB) (résistance aux GPU/ASIC)
- **Parallelism** : 4 threads (optimisé pour mobile)
- **Salt** : 32 bytes aléatoires (unique par vault)

### 2. Vault Key (AES-256-GCM)

```
Random AES-256 Key (Vault Key)
    ↓
Encrypted with Derived Key + IV (12 bytes)
    ↓
Stored: encryptedKey + keyIv
```

**Double encryption :**
- **Vault Key** : Clé AES-256 aléatoire générée à la création
- **Chiffrement** : Vault Key chiffrée avec Derived Key
- **Stockage** : Seule la version chiffrée est sauvegardée

### 3. Entry Fields (AES-256-GCM)

```
Entry Field (titre, password, notes, etc.)
    ↓
AES-256-GCM with Vault Key + Unique IV
    ↓
Ciphertext + Authentication Tag (128 bits)
```

**Chiffrement par champ :**
- **IV unique** : Chaque champ a son propre IV (12 bytes)
- **Authentification** : Tag GCM de 128 bits pour intégrité
- **Indépendance** : Compromission d'un champ n'affecte pas les autres

### 4. Zero-Knowledge Architecture

```
✅ Stocké :
- Master Password Hash (Argon2id) → vérification uniquement
- Salt (32 bytes)
- Encrypted Vault Key + IV
- Encrypted Entry Fields + IVs

❌ JAMAIS stocké :
- Master Password en clair
- Derived Key
- Vault Key en clair
- Entry Fields en clair
```

### 5. Gestion du Keystore Android (rotation d'alias)

- **Alias versionnés** : toutes les clés matérielles sont suffixées (`_v2`) pour permettre des rotations transparentes sans fuite d'anciens secrets.
- **Rechiffrement automatique** : lors du prochain déverrouillage, les secrets SQLCipher sont automatiquement ré-encryptés avec la dernière clé et les alias obsolètes sont supprimés.
- **Plan de secours utilisateur** : si le Keystore invalide une clé (ex. changement biométrique), l'application génère un nouveau secret chiffré et affiche un avertissement indiquant de restaurer une sauvegarde/coffre.

### 5. Standards et conformité

- **Argon2id** : RFC 9106 (Password Hashing Competition winner)
- **AES-256-GCM** : NIST SP 800-38D (Authenticated Encryption)
- **TOTP** : RFC 6238 (Time-based One-Time Password)
- **HOTP** : RFC 4226 (HMAC-based One-Time Password)

---

## Pile technologique

### Frameworks & Libraries

**Core Android :**
- **Kotlin** 1.9.10 (langage moderne avec coroutines)
- **Jetpack Compose** 2023.10.01 (UI déclarative 100%)
- **Material Design 3** 1.1.2 (interface moderne)
- **Android SDK** : Min 24 (Android 7.0), Target 34 (Android 14)

**Architecture :**
- **Hilt** 2.48 (Dependency Injection)
- **Room** 2.6.0 (base de données SQLite avec ORM)
- **DataStore** 1.0.0 (préférences)
- **Navigation Compose** 2.7.5 (navigation)
- **ViewModel & LiveData** 2.6.2 (gestion d'état)
- **Kotlin Coroutines** 1.7.3 (asynchrone)
- **Flow** (réactivité)

**Sécurité :**
- **Argon2-JVM** 2.11 (hashing Argon2id)
- **Android Crypto** (AES-256-GCM natif)
- **BiometricPrompt** 1.1.0 (empreinte/face)
- **Android Keystore** (stockage sécurisé clés)

**Utilitaires :**
- **Commons Codec** 1.16.0 (Base32 pour TOTP)
- **Gson** 2.10.1 (JSON parsing)
- **Accompanist Pager** 0.32.0 (onboarding)

**Testing :**
- **JUnit** 4.13.2
- **MockK** 1.13.8
- **Coroutines Test** 1.7.3
- **Espresso** 3.5.1
- **Compose UI Test** 2023.10.01

### Architecture Pattern

**MVVM (Model-View-ViewModel) + Clean Architecture**

```
┌─────────────────────────────────────────┐
│           UI Layer (Compose)            │
│  - Screens (*.Screen.kt)                │
│  - Components (@Composable)             │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│      Presentation Layer (ViewModels)    │
│  - VaultViewModel                       │
│  - VaultListViewModel                   │
│  - EntryViewModel                       │
│  - PasswordGeneratorViewModel           │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│       Domain Layer (Use Cases)          │
│  - DecryptedEntry (model)               │
│  - SecureNote / SecureCard              │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│      Data Layer (Repository)            │
│  - VaultRepository                      │
│  - PasswordRepository                   │
│  - CloudSyncRepository                  │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  Infrastructure (Database + Crypto)     │
│  - Room Database (5 entities, 4 DAOs)   │
│  - VaultCryptoManager (Argon2 + AES)    │
│  - TotpGenerator (RFC 6238)             │
└─────────────────────────────────────────┘
```

---

## Prérequis

- **Android Studio** : Hedgehog (2023.1.1) ou plus récent
- **JDK** : 17 (configuré dans le projet)
- **Android SDK** :
  - Min SDK : 24 (Android 7.0 Nougat)
  - Target SDK : 34 (Android 14)
  - Compile SDK : 34
- **Gradle** : 8.2+ (wrapper inclus)
- **Kotlin** : 1.9.10

---

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro/android
```

### 2. Ouvrir dans Android Studio

1. Ouvrir Android Studio
2. File → Open → Sélectionner le dossier `/android`
3. Attendre la synchronisation Gradle (téléchargement des dépendances)

### 3. Build & Run

**Via Android Studio :**
1. Sélectionner un device (émulateur ou physique)
2. Cliquer sur Run (▶️) ou Shift+F10

**Via ligne de commande :**

```bash
# Debug build
./gradlew assembleDebug

# Release build (signé)
./gradlew assembleRelease

# Installer sur device
./gradlew installDebug
```

**APK généré :**
- Debug : `app/build/outputs/apk/debug/app-debug.apk`
- Release : `app/build/outputs/apk/release/app-release.apk`

### 4. Tests

```bash
# Tests unitaires
./gradlew test

# Tests instrumentés (nécessite un device)
./gradlew connectedAndroidTest

# Couverture de code
./gradlew jacocoTestReport
```

### 5. Préparer le SDK Android en CLI

Pour exécuter Lint et les builds en dehors d'Android Studio, installez un SDK Android minimal identique à la CI.

```bash
cd android
./scripts/install-android-sdk.sh  # installe les outils dans \$HOME/Android/Sdk par défaut
cat <<'EOF' > local.properties
sdk.dir=/chemin/vers/votre/Android/Sdk
EOF
```

> 💡 Le script accepte un chemin personnalisé en argument (`./scripts/install-android-sdk.sh /opt/android-sdk`). Il se charge de télécharger les command line tools, d'accepter les licences et d'installer `platforms;android-34`, `build-tools;33.0.1` et `platform-tools`.

### 6. Lancer Lint et mettre à jour la baseline

Une fois le SDK installé :

```bash
cd android
./gradlew :app:clean
./gradlew :app:updateLintBaselineRelease
./gradlew :app:lintRelease
```

Le fichier `app/lint-baseline.xml` est ainsi régénéré. Commitez-le dès qu'il change pour garantir que la CI échoue uniquement lorsqu'une nouvelle alerte est introduite.

---

## Utilisation

### Premier lancement

1. **Onboarding** : 3 écrans de présentation (swipe ou skip)
2. **Sélection** :
   - Créer un coffre-fort (recommandé)
   - Utiliser le générateur simple (mode standalone)

### Créer un coffre-fort

1. Cliquer sur "Créer mon coffre-fort"
2. Remplir :
   - **Nom** : ex. "Personnel", "Travail"
   - **Master Password** : 12+ caractères recommandés
   - **Confirmation** : ressaisir le mot de passe
   - **Description** (optionnelle)
3. Cliquer sur "Créer le coffre-fort"
4. ✅ Vault créé et déverrouillé automatiquement

**⚠️ IMPORTANT : Le master password n'est JAMAIS récupérable. Notez-le dans un endroit sûr !**

### Déverrouiller un coffre-fort

1. Sélectionner un vault dans la liste
2. Entrer le master password
3. (Optionnel) Activer le déverrouillage biométrique

### Ajouter une entrée

1. Dans le vault déverrouillé, cliquer sur le FAB (+) en bas à droite
2. Choisir le type :
   - 🔑 Mot de passe
   - 📝 Note sécurisée
   - 💳 Carte bancaire
   - 🆔 Identité
3. Remplir les champs
4. (Optionnel) Générer un mot de passe fort avec le bouton ⚙️
5. (Optionnel) Ajouter TOTP/2FA
6. Sauvegarder

### Générer un mot de passe

**Dans le formulaire d'entrée :**
1. Cliquer sur l'icône ⚙️ à côté du champ password
2. Configurer :
   - Longueur (8-32)
   - Options (Maj, min, chiffres, symboles)
3. Cliquer sur "Régénérer" jusqu'à satisfaction
4. Cliquer sur "Utiliser ce mot de passe"

**Mode standalone :**
1. Depuis l'écran d'accueil → "Utiliser le générateur simple"
2. Onglets : Classique / Phrase
3. Configurer et générer
4. Copier dans le presse-papiers

### Configurer TOTP/2FA

1. Lors de la création/édition d'une entrée
2. Activer "Authentification à 2 facteurs"
3. Deux méthodes :
   - **Scanner QR code** : Cliquer sur l'icône QR (à venir)
   - **Saisir manuellement** : Entrer le secret Base32
4. Remplir :
   - Émetteur (ex. "Google")
   - Secret (ex. "JBSWY3DPEHPK3PXP")
5. Sauvegarder
6. Le code TOTP s'affiche dans la liste avec compte à rebours

---

## Architecture du projet

### Structure des dossiers

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/julien/genpwdpro/
│   │   │   │   ├── data/                           # Data Layer
│   │   │   │   │   ├── local/
│   │   │   │   │   │   ├── database/
│   │   │   │   │   │   │   ├── AppDatabase.kt      # Room DB (v3)
│   │   │   │   │   │   │   └── DatabaseModule.kt   # Hilt DI
│   │   │   │   │   │   ├── dao/
│   │   │   │   │   │   │   ├── VaultDao.kt         # 18 méthodes
│   │   │   │   │   │   │   ├── VaultEntryDao.kt    # 30 méthodes
│   │   │   │   │   │   │   ├── FolderDao.kt        # 15 méthodes
│   │   │   │   │   │   │   ├── TagDao.kt           # 17 méthodes
│   │   │   │   │   │   │   └── PasswordHistoryDao.kt
│   │   │   │   │   │   └── entity/
│   │   │   │   │   │       ├── VaultEntity.kt      # 19 champs
│   │   │   │   │   │       ├── VaultEntryEntity.kt # 47 champs
│   │   │   │   │   │       ├── FolderEntity.kt
│   │   │   │   │   │       ├── TagEntity.kt
│   │   │   │   │   │       ├── EntryTagCrossRef.kt
│   │   │   │   │   │       └── PasswordHistoryEntity.kt
│   │   │   │   │   ├── crypto/
│   │   │   │   │   │   ├── VaultCryptoManager.kt   # Argon2 + AES
│   │   │   │   │   │   └── TotpGenerator.kt        # RFC 6238
│   │   │   │   │   └── repository/
│   │   │   │   │       ├── VaultRepository.kt      # 850 lines
│   │   │   │   │       ├── PasswordRepository.kt
│   │   │   │   │       └── CloudSyncRepository.kt
│   │   │   │   ├── domain/                         # Domain Layer
│   │   │   │   │   ├── model/
│   │   │   │   │   │   ├── SecureNote.kt
│   │   │   │   │   │   ├── SecureCard.kt
│   │   │   │   │   │   └── SecureIdentity.kt
│   │   │   │   │   └── generators/                 # Password Generators
│   │   │   │   │       ├── SyllablesGenerator.kt
│   │   │   │   │       ├── PassphraseGenerator.kt
│   │   │   │   │       └── LeetSpeakGenerator.kt
│   │   │   │   ├── presentation/                   # Presentation Layer
│   │   │   │   │   ├── vault/                      # Vault System
│   │   │   │   │   │   ├── VaultViewModel.kt       # Lifecycle
│   │   │   │   │   │   ├── VaultListViewModel.kt   # List + TOTP
│   │   │   │   │   │   ├── EntryViewModel.kt       # Entry CRUD
│   │   │   │   │   │   ├── VaultSelectorScreen.kt  # Entry point
│   │   │   │   │   │   ├── CreateVaultScreen.kt    # Creation
│   │   │   │   │   │   ├── UnlockVaultScreen.kt    # Unlock
│   │   │   │   │   │   ├── VaultListScreen.kt      # Main (520L)
│   │   │   │   │   │   └── EntryEditScreen.kt      # Form (680L)
│   │   │   │   │   ├── generator/                  # Password Generator
│   │   │   │   │   │   ├── PasswordGeneratorViewModel.kt
│   │   │   │   │   │   └── PasswordGeneratorScreen.kt
│   │   │   │   │   ├── analysis/                   # Security Analysis
│   │   │   │   │   │   ├── PasswordAnalysisViewModel.kt
│   │   │   │   │   │   └── PasswordAnalysisScreen.kt
│   │   │   │   │   ├── onboarding/                 # First launch
│   │   │   │   │   │   ├── OnboardingViewModel.kt
│   │   │   │   │   │   └── OnboardingScreen.kt
│   │   │   │   │   ├── cloudsync/                  # Cloud Sync
│   │   │   │   │   │   ├── CloudSyncViewModel.kt
│   │   │   │   │   │   └── CloudSyncScreen.kt
│   │   │   │   │   ├── navigation/
│   │   │   │   │   │   └── NavGraph.kt             # Routes
│   │   │   │   │   └── theme/                      # Material 3
│   │   │   │   │       ├── Color.kt
│   │   │   │   │       ├── Theme.kt
│   │   │   │   │       └── Type.kt
│   │   │   │   ├── service/
│   │   │   │   │   └── AutofillService.kt          # Android Autofill
│   │   │   │   ├── di/                             # Dependency Injection
│   │   │   │   │   └── AppModule.kt
│   │   │   │   └── MainActivity.kt
│   │   │   ├── res/
│   │   │   │   ├── drawable/                       # Icons
│   │   │   │   │   ├── ic_launcher_foreground.xml  # Lock+key
│   │   │   │   │   ├── ic_launcher_background.xml  # Blue
│   │   │   │   │   ├── ic_launcher_monochrome.xml  # Android 13+
│   │   │   │   │   ├── ic_launcher.xml             # Adaptive
│   │   │   │   │   └── ic_launcher_round.xml
│   │   │   │   ├── values/
│   │   │   │   │   ├── strings.xml
│   │   │   │   │   ├── colors.xml
│   │   │   │   │   └── themes.xml
│   │   │   │   ├── mipmap/                         # Launcher icons
│   │   │   │   └── assets/dictionaries/            # Word lists
│   │   │   └── AndroidManifest.xml
│   │   └── test/                                   # Unit tests
│   │       └── java/com/julien/genpwdpro/
│   │           ├── VaultCryptoManagerTest.kt
│   │           ├── TotpGeneratorTest.kt
│   │           └── VaultRepositoryTest.kt
│   ├── build.gradle.kts                            # App Gradle
│   └── proguard-rules.pro                          # R8 config
├── build.gradle.kts                                # Project Gradle
├── gradle.properties
├── settings.gradle.kts
├── IMPLEMENTATION_COMPLETE.md                      # Status (500L)
└── README.md                                       # This file
```

### Base de données Room

**Version actuelle : 3**

**Entités (5) :**
1. **vaults** (19 colonnes) - Coffres-forts chiffrés
2. **vault_entries** (47 colonnes) - Entrées de mots de passe, notes, cartes, identités
3. **folders** (9 colonnes) - Dossiers hiérarchiques
4. **tags** (5 colonnes) - Tags pour organisation
5. **entry_tag_cross_ref** (2 colonnes) - Relation many-to-many

**DAOs (4) :**
- **VaultDao** : 18 méthodes (CRUD vaults)
- **VaultEntryDao** : 30 méthodes (CRUD entries, recherche, statistiques)
- **FolderDao** : 15 méthodes (hiérarchie)
- **TagDao** : 17 méthodes (tagging)

**Indexes (15+) :**
- Performance optimisée pour recherche et filtrage
- Foreign keys avec CASCADE/SET NULL

**Migrations :**
- 1→2 : Cloud Sync + Password Analysis
- 2→3 : Vault System complet

---

## Statistiques

**Code total : ~23,100+ lines** (incluant Cloud Sync)

| Composant | Fichiers | Lignes | Status |
|-----------|----------|--------|--------|
| **Database** | 11 | ~2,400 | ✅ 100% |
| **Crypto** | 2 | ~600 | ✅ 100% |
| **Repository** | 4 | ~1,650 | ✅ 100% |
| **ViewModels** | 8 | ~1,475 | ✅ 100% |
| **UI Screens** | 16 | ~6,400 | ✅ 100% |
| **Navigation** | 2 | ~430 | ✅ 100% |
| **Cloud Sync Core** | 7 | ~1,422 | ✅ 100% |
| **Cloud Providers** | 6 | ~2,691 | ✅ 40% |
| **Services** | 2 | ~386 | ✅ 100% |
| **Domain** | 3 | ~200 | ✅ 100% |
| **DI** | 2 | ~150 | ✅ 100% |
| **Tests** | 17 | ~1,660 | ✅ 85% |
| **Resources** | 20+ | ~500 | ✅ 100% |
| **Documentation** | 6 | ~3,800 | ✅ 100% |
| **TOTAL** | **106+** | **~23,100+** | **✅ 95%** |

**Fonctionnalités :**
- ✅ Vault System (100%)
- ✅ TOTP/2FA (100%)
- ✅ Password Generator (100%)
- ✅ Security Analysis (100%)
- ✅ **Cloud Sync** (100%) ✨
  - ✅ Google Drive Provider (100%)
  - ✅ WebDAV Provider (100%)
  - ⚠️ OneDrive/pCloud/ProtonDrive (Templates - 40%)
  - ✅ Conflict Resolution (100%)
  - ✅ Auto-Sync (100%)
  - ✅ History & Statistics (100%)
  - ✅ OAuth2 Setup Guides (100%)
- ✅ Onboarding (100%)
- ✅ Autofill (100%)
- ✅ Navigation (100%)
- ✅ **Import/Export (95%)** ✨ **NEW**
  - ✅ Backend (CSV & JSON) (100%)
  - ✅ UI complète avec tabs (100%)
  - ✅ Navigation intégrée (100%)
  - ⏳ Tests utilisateurs (0%)
- ✅ **QR Scanner (95%)** ✨ **NEW**
  - ✅ Backend CameraX + ML Kit (100%)
  - ✅ Intégration TOTP (100%)
  - ✅ Parsing otpauth:// URIs (100%)
  - ⏳ Tests sur devices variés (0%)
- ⚠️ Biometric (70%)
  - ✅ Déverrouillage fonctionnel (100%)
  - ⏳ UX à améliorer (50%)
  - ⏳ Gestion erreurs robuste (60%)

---

## Roadmap

### Phase 1 : Core Functionality ✅ DONE (100%)
- [x] Database (5 entities, 4 DAOs, migrations)
- [x] Cryptography (Argon2id + AES-256-GCM + TOTP)
- [x] Repository (VaultRepository 850 lines)
- [x] ViewModels (Vault, List, Entry)
- [x] UI Screens (Selector, Create, Unlock, List, Edit)
- [x] Navigation (NavGraph + routes)
- [x] Icons (adaptive launcher icons)

### Phase 2 : Import/Export ✅ DONE (95%)
- [x] CSV Import (generic mapping)
- [x] CSV Export (unencrypted warning)
- [x] JSON Export (encrypted)
- [x] JSON Import (encrypted)
- [x] UI complète avec Material 3
- [x] Navigation intégrée dans VaultListScreen
- [ ] KeePass KDBX Import (prévu Phase 5)
- [ ] Tests utilisateurs complets

### Phase 3 : Advanced Features ✅ DONE (100%)
- [x] QR Code Scanner (TOTP setup) ✨
- [x] Biometric unlock (BiometricPrompt integration)
- [x] Folder management UI
- [x] Tag management UI
- [x] Password health analysis (intégré)
- [x] Breach detection (Have I Been Pwned API)
- [x] **Password health dashboard** (UI visuelle complète) ✨ **v1.2.0-alpha.7**
  - Circular animated health gauge (score 0-100)
  - Weak, reused, compromised, old password cards
  - Navigation intégrée dans VaultListScreen menu
  - HaveIBeenPwned API integration
- [x] **Biometric UX improvements** ✨ **v1.2.0-alpha.7**
  - Enhanced error messages with actionable guidance
  - Context-aware prompts with detailed descriptions
  - Short and long message variants
  - Availability state messages
- [x] **Material You dynamic colors** ✨ **v1.2.0-alpha.7**
  - Automatic activation on Android 12+ (API 31+)
  - Wallpaper-based color extraction
  - Graceful fallback to custom colors
  - Comprehensive documentation

### Phase 4 : Polish & Testing ⏳ TODO (2-3 heures)
- [ ] Unit tests (target 90% coverage)
- [ ] UI tests (Compose UI Test)
- [ ] Performance optimization
- [ ] Accessibility (TalkBack)
- [ ] Localization (EN/FR)
- [ ] Dark mode refinements

### Phase 5 : Advanced Security ⏳ TODO (4-5 heures)
- [ ] Card management UI (full CRUD)
- [ ] Identity management UI (full CRUD)
- [ ] Secure attachments (encrypt files)
- [ ] Password generator history
- [ ] Auto-fill enhancements (apps + web)
- [ ] Passkey support (FIDO2/WebAuthn)

### Phase 6 : Cloud & Sync ✅ COMPLETE (100%) ✨ NEW
- [x] **Architecture Core** (1,422 lines)
  - [x] SyncStatus models & enums
  - [x] CloudProvider interface
  - [x] ConflictResolver (5 strategies)
  - [x] VaultSyncManager
  - [x] AutoSyncScheduler (WorkManager)
  - [x] SyncWorker
  - [x] SyncPreferencesManager (EncryptedSharedPreferences)
- [x] **Cloud Providers** (2,691 lines)
  - [x] ✅ Google Drive (OAuth2, 15 GB, production-ready)
  - [x] ✅ WebDAV (Self-hosted, production-ready)
  - [x] ⚠️ OneDrive template (Azure MSAL)
  - [x] ⚠️ pCloud template (OAuth2)
  - [x] ⚠️ ProtonDrive template (beta API)
  - [x] CloudProviderFactory
- [x] **UI Components** (3,162 lines)
  - [x] VaultSyncViewModel (575 lines)
  - [x] SyncSettingsScreen (764 lines)
  - [x] ConflictResolutionDialog (439 lines)
  - [x] WebDAVConfigDialog (397 lines)
  - [x] SyncProgressIndicator (467 lines)
  - [x] SyncHistoryScreen (520 lines)
- [x] **Navigation Integration**
  - [x] SyncSettings route
  - [x] SyncHistory route
  - [x] ViewModel connections
  - [x] Real-time statistics
- [x] **Tests** (460 lines)
  - [x] ConflictResolverTest (13 tests)
  - [x] VaultSyncManagerTest (12 tests)
- [x] **Documentation** (3,800+ lines)
  - [x] CLOUD_SYNC_README.md (750+ lines)
  - [x] PROVIDER_IMPLEMENTATION_GUIDE.md (800+ lines)
  - [x] IMPLEMENTATION_STATUS.md (650+ lines)
  - [x] OAUTH2_SETUP_GUIDE.md (660+ lines)
- [x] **36 Phases complétées** avec 2 providers production-ready

### Phase 7 : Release 📦 TODO
- [ ] ProGuard/R8 optimization (déjà configuré)
- [ ] APK signing
- [ ] Play Store assets (screenshots, description)
- [ ] Privacy policy
- [ ] Release notes
- [ ] Beta testing (Google Play Beta)

---

## Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. **Fork** le repository
2. **Créer** une branche feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** vos changements (`git commit -m 'Add AmazingFeature'`)
4. **Push** vers la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir** une Pull Request

### Guidelines

- **Code style** : Suivre les conventions Kotlin (ktlint)
- **Architecture** : Respecter MVVM + Clean Architecture
- **Tests** : Ajouter tests unitaires (coverage > 80%)
- **Documentation** : Commenter le code complexe (KDoc)
- **Commits** : Messages clairs et descriptifs (conventional commits)
- **Security** : Ne jamais commit de clés/secrets

### Développement local

**Linter :**
```bash
./gradlew ktlintCheck     # Vérifier le style
./gradlew ktlintFormat    # Auto-formater
```

**Tests :**
```bash
./gradlew test            # Tests unitaires
./gradlew connectedAndroidTest  # Tests UI
```

**Build :**
```bash
./gradlew assembleDebug   # Debug APK
./gradlew assembleRelease # Release APK (signé)
```

---

## Sécurité

### Signalement de vulnérabilités

Si vous découvrez une vulnérabilité de sécurité, **NE PAS** ouvrir une issue publique. Contactez directement :

- **Email** : [security@genpwd.com](mailto:security@genpwd.com)

### Bonnes pratiques

1. **Master Password** : Utilisez un mot de passe fort (12+ caractères, mélange de types)
2. **Backup** : Exportez régulièrement un backup chiffré
3. **Mises à jour** : Gardez l'app à jour pour les patches de sécurité
4. **Biométrie** : Activez le déverrouillage biométrique pour plus de confort
5. **Auto-lock** : Configurez un timeout court (5 minutes recommandé)
6. **Device** : Sécurisez votre téléphone (code PIN/pattern, chiffrement disk)

### Audit de sécurité

Le code crypto a été reviewé selon :
- [RFC 9106](https://datatracker.ietf.org/doc/rfc9106/) (Argon2)
- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) (AES-GCM)
- [RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238) (TOTP)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)

---

## Licence

Ce projet est sous licence **Apache 2.0 License**.

```
Copyright 2025 Julien Bombled

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## Remerciements

- **Argon2** : [Password Hashing Competition](https://password-hashing.net/) winner
- **Material Design 3** : [Google Material Design](https://m3.material.io/)
- **Jetpack Compose** : [Android Developers](https://developer.android.com/jetpack/compose)
- **KeePass** : Inspiration pour l'architecture vault
- **Have I Been Pwned** : [Troy Hunt](https://haveibeenpwned.com/)
- **RFC Authors** : Pour les standards TOTP/HOTP

---

## Contact & Support

- **GitHub Issues** : [https://github.com/VBlackJack/genpwd-pro/issues](https://github.com/VBlackJack/genpwd-pro/issues)
- **Discussions** : [https://github.com/VBlackJack/genpwd-pro/discussions](https://github.com/VBlackJack/genpwd-pro/discussions)
- **Website** : [https://genpwd.com](https://genpwd.com)

---

**Développé avec ❤️ en Kotlin et Jetpack Compose**

*GenPwd Pro - Votre coffre-fort numérique ultra-sécurisé*
