# GenPwd Pro Android - Release Process

Guide complet pour préparer et publier une Release Candidate sur le Google Play Store.

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Pré-Release Checklist](#pré-release-checklist)
- [Tests et Validation](#tests-et-validation)
- [Performance Optimization](#performance-optimization)
- [Play Store Compliance](#play-store-compliance)
- [Build et Signature](#build-et-signature)
- [Publication](#publication)
- [Post-Release](#post-release)

## 🎯 Vue d'ensemble

Ce document décrit le processus complet pour publier GenPwd Pro sur le Google Play Store en tant que Release Candidate (RC).

### Versions

- **Version actuelle** : 1.2.0-alpha.34 (versionCode 36)
- **Target RC** : 1.3.0-rc.1 (versionCode 37)
- **Target SDK** : 34 (Android 14)
- **Min SDK** : 24 (Android 7.0)

## ✅ Pré-Release Checklist

### 1. Bugs et Issues

- [ ] Trier tous les bugs dans GitHub Issues
- [ ] Corriger tous les bugs CRITICAL
- [ ] Corriger tous les bugs HIGH
- [ ] Documenter les bugs MEDIUM/LOW (si report nécessaire)

**Commandes** :

```bash
# Lister les issues critiques
gh issue list --label "critical,bug" --state open

# Lister les issues high priority
gh issue list --label "high,bug" --state open
```

### 2. Features Complètes

- [x] Génération de mots de passe (5 modes)
- [x] Gestion des vaults (CRUD)
- [x] Chiffrement AES-256-GCM
- [x] Synchronisation cloud (5 providers)
- [x] Import/Export (JSON, CSV, TXT, KeePass)
- [x] Authentification biométrique
- [x] Widget Android
- [x] Autofill Service
- [x] OTP/2FA
- [x] Analyse de santé des mots de passe
- [x] Thèmes et langues (FR, EN, ES)

### 3. Documentation

- [ ] README.md à jour
- [ ] CHANGELOG.md avec toutes les nouveautés
- [ ] Docs techniques (ARCHITECTURE.md, etc.)
- [ ] Guide utilisateur (USER_GUIDE.md)
- [ ] Documentation API OAuth (OAUTH_SETUP.md)

### 4. Dépendances

- [ ] Mettre à jour toutes les dépendances
- [ ] Vérifier les vulnérabilités (Dependabot)
- [ ] Tester la compatibilité

**Commandes** :

```bash
cd android

# Vérifier les dépendances obsolètes
./gradlew dependencyUpdates

# Mettre à jour (manuellement dans build.gradle.kts)
# Tester après chaque mise à jour
```

## 🧪 Tests et Validation

### 1. Tests Unitaires

```bash
cd android

# Exécuter tous les tests unitaires
./gradlew test

# Vérifier le résultat
# Target: 100% de succès (0 échecs)
```

**Objectif** : ✅ **0 tests failed**

Localisation : `app/build/reports/tests/testDebugUnitTest/index.html`

### 2. Tests d'Intégration

```bash
# Démarrer un émulateur ou connecter un appareil physique
adb devices

# Exécuter les tests instrumentés
./gradlew connectedAndroidTest

# Vérifier le résultat
# Target: 100% de succès
```

**Objectif** : ✅ **0 tests failed**

Localisation : `app/build/reports/androidTests/connected/index.html`

### 3. Tests Manuels Critiques

- [ ] **Génération de mots de passe** :
  - [ ] Syllabes (20 caractères, 2 digits, 2 spéciaux)
  - [ ] Passphrase (5 mots, FR/EN/ES)
  - [ ] Leet Speak
  - [ ] Custom Phrase
  - [ ] PIN

- [ ] **Vaults** :
  - [ ] Créer un vault
  - [ ] Ouvrir un vault existant
  - [ ] Changer le master password
  - [ ] Supprimer un vault
  - [ ] Lock/Unlock

- [ ] **Synchronisation** :
  - [ ] Google Drive (OAuth, upload, download)
  - [ ] Dropbox (OAuth, upload, download)
  - [ ] OneDrive (OAuth, upload, download)
  - [ ] WebDAV (Basic auth, upload, download)
  - [ ] Résolution de conflits

- [ ] **Import/Export** :
  - [ ] Export JSON
  - [ ] Export CSV
  - [ ] Export TXT
  - [ ] Import JSON
  - [ ] Import CSV
  - [ ] Import KeePass XML

- [ ] **Sécurité** :
  - [ ] Biométrie (fingerprint, face)
  - [ ] Auto-lock (30s, 1min, 5min)
  - [ ] Clipboard clear (30s)
  - [ ] Vault encryption (AES-256-GCM)

- [ ] **UI/UX** :
  - [ ] Navigation fluide
  - [ ] Animations smooth (pas de lag)
  - [ ] Thèmes (Dark, Light, Auto)
  - [ ] Langues (FR, EN, ES)

### 4. Tests de Performance

#### Startup Time

**Objectif** : **< 2 secondes** (cold start)

**Mesure** :

```bash
# Méthode 1 : adb logcat
adb logcat -c && adb logcat | grep "Displayed com.julien.genpwdpro"

# Méthode 2 : Android Studio Profiler
# Run → Profile 'app' → CPU Profiler → Observer le startup
```

**Optimisations** :
- Lazy loading des modules non critiques
- Préchargement des dictionnaires en background
- R8/ProGuard pour réduire la taille du code

#### Génération de Mot de Passe

**Objectif** : **< 100ms** (pour 20 caractères)

**Mesure** :

```kotlin
val start = System.currentTimeMillis()
val password = generateSyllables(config)
val duration = System.currentTimeMillis() - start
Log.d("PERF", "Generation took ${duration}ms")
```

**Optimisations** :
- Utiliser `SecureRandom` efficace
- Pré-calculer les jeux de caractères
- Éviter les allocations inutiles

#### UI Rendering

**Objectif** : **60 FPS** (pas de frame drops)

**Mesure** :

```bash
# GPU Rendering Profile
adb shell setprop debug.hwui.profile visual_bars

# Ou dans Android Studio
# View → Tool Windows → Layout Inspector
```

**Optimisations** :
- Éviter les nested layouts
- Utiliser Jetpack Compose (déjà fait)
- LazyColumn pour les listes
- Remember/MemoizedState pour éviter recompositions

## ⚡ Performance Optimization

### 1. Code Shrinking et Obfuscation

Déjà configuré dans `app/build.gradle.kts` :

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

### 2. R8 Optimization

R8 est automatiquement utilisé (remplace ProGuard).

**Vérification** :

```bash
# Build en release
./gradlew assembleRelease

# Vérifier la taille de l'APK
ls -lh app/build/outputs/apk/release/

# Target: < 15 MB
```

### 3. Baseline Profiles

Déjà configuré : `app/src/main/baseline-prof.txt`

Permet un démarrage 30% plus rapide.

### 4. Network Optimization

- [ ] Utiliser OkHttp avec cache
- [ ] Compression GZIP pour les uploads
- [ ] Retry avec exponential backoff
- [ ] Timeout configurés (30s read, 10s connect)

## 🏪 Play Store Compliance

### 1. Permissions

Vérifier que toutes les permissions sont **nécessaires et justifiées** :

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.CAMERA" />
```

**Justifications** :
- `INTERNET` : Synchronisation cloud
- `ACCESS_NETWORK_STATE` : Détecter la connectivité avant sync
- `VIBRATE` : Feedback haptique
- `USE_BIOMETRIC` : Authentification par empreinte/visage
- `CAMERA` : Scanner QR codes OTP

### 2. Data Safety Form

À remplir sur Play Console :

**Données collectées** : ❌ Aucune
**Données partagées** : ❌ Aucune
**Chiffrement en transit** : ✅ Oui (HTTPS)
**Option de suppression** : ✅ Oui (supprimer le compte local)

### 3. Target API Level

- **Target SDK** : 34 (Android 14) ✅
- **Requirement** : Google exige API 33+ pour les nouvelles apps

### 4. 64-bit Support

Déjà configuré (Kotlin/JVM compile en 64-bit).

### 5. App Bundle (AAB)

**Recommandé par Google** (vs APK).

Avantages :
- Taille réduite (Google génère des APKs optimisés par device)
- Livraison dynamique

### 6. Content Rating

Utiliser le questionnaire IARC sur Play Console.

**Catégorie attendue** : E (Everyone) - Pas de contenu sensible

### 7. Privacy Policy

**Obligatoire** si l'app collecte des données.

**Pour GenPwd Pro** : Pas de collecte → Privacy Policy simple :

```
GenPwd Pro ne collecte aucune donnée personnelle.
Toutes les données sont stockées localement sur votre appareil.
La synchronisation cloud utilise un chiffrement end-to-end.
```

Héberger sur : GitHub Pages, site web, ou Play Console.

## 🔨 Build et Signature

### 1. Créer une Keystore

**Important** : Ne jamais perdre cette keystore ! Sauvegardez-la dans un endroit sûr (1Password, Bitwarden, etc.).

```bash
keytool -genkey -v -keystore genpwd-pro-release.keystore \
  -alias genpwd-pro \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Remplir les informations
# Password: (choisir un mot de passe fort)
# First and Last Name: Julien Bombled
# Organizational Unit: GenPwd Pro
# Organization: GenPwd
# City: (votre ville)
# State: (votre région)
# Country Code: FR
```

**Sauvegarder** :
- Le fichier `.keystore`
- Le password de la keystore
- Le password de la clé (si différent)
- L'alias (`genpwd-pro`)

### 2. Configurer la Signature

Créer `android/keystore.properties` (NE PAS commit dans git !) :

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=genpwd-pro
storeFile=../genpwd-pro-release.keystore
```

Ajouter à `.gitignore` :

```
keystore.properties
*.keystore
*.jks
```

Modifier `app/build.gradle.kts` :

```kotlin
android {
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            if (keystorePropertiesFile.exists()) {
                val keystoreProperties = Properties()
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))

                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // ...
        }
    }
}
```

### 3. Build AAB Release

```bash
cd android

# Clean
./gradlew clean

# Build AAB signé
./gradlew bundleRelease

# Vérifier
ls -lh app/build/outputs/bundle/release/
# → app-release.aab
```

**Taille attendue** : 10-20 MB (AAB)

### 4. Tester l'AAB Localement

```bash
# Installer bundletool
wget https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar

# Générer un APK depuis l'AAB
java -jar bundletool-all-1.15.6.jar build-apks \
  --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks \
  --mode=universal

# Extraire l'APK
unzip app-release.apks -d apks/

# Installer
adb install apks/universal.apk

# Tester manuellement
```

## 📤 Publication

### 1. Créer un Compte Google Play Developer

1. Visitez [Google Play Console](https://play.google.com/console)
2. Payez les frais d'inscription (25 USD, unique)
3. Remplissez le profil développeur

### 2. Créer une App

1. **All apps** → **Create app**
2. Remplir :
   - **App name** : GenPwd Pro
   - **Default language** : Français (France)
   - **App or game** : App
   - **Free or paid** : Free

### 3. Préparer le Store Listing

#### Screenshots (Obligatoire)

- **Phone** : 2-8 screenshots (1080x1920 ou 1440x2560 px)
- **7-inch tablet** : 2-8 screenshots (optionnel)
- **10-inch tablet** : 2-8 screenshots (optionnel)

**Outils** :
- Android Studio : Tools → Device Manager → Screenshot
- Figma : Créer des screenshots annotés
- Fastlane Frameit : Ajouter des device frames

#### Icône et Feature Graphic

- **App icon** : 512x512 px (PNG, 32-bit)
- **Feature graphic** : 1024x500 px (JPG ou PNG, 24-bit)

#### Texte

**Titre court** (max 30 caractères) :
```
GenPwd Pro
```

**Description courte** (max 80 caractères) :
```
Générateur de mots de passe sécurisés avec synchronisation cloud E2E
```

**Description complète** (max 4000 caractères) :
```
🔐 GenPwd Pro - Générateur de Mots de Passe Sécurisés

GenPwd Pro est un générateur de mots de passe open source, sécurisé et puissant avec synchronisation cloud end-to-end chiffrée.

✨ FONCTIONNALITÉS PRINCIPALES

🎲 Génération de Mots de Passe
• 5 modes de génération (Syllabes, Passphrase, Leet Speak, Custom Phrase, PIN)
• Jusqu'à 140 bits d'entropie
• Configuration complète (longueur, chiffres, spéciaux, casse)
• Analyse de force en temps réel

🔒 Sécurité de Niveau Entreprise
• Chiffrement AES-256-GCM
• Dérivation de clé Argon2id (résistant aux GPUs)
• Authentification biométrique (empreinte, visage)
• Auto-lock configurableimport { webcrypto } from 'node:crypto';
• Clipboard auto-clear

☁️ Synchronisation Cloud E2E
• Google Drive, Dropbox, OneDrive, WebDAV
• Zero-knowledge (le provider ne peut pas déchiffrer)
• Résolution automatique de conflits
• Cross-platform (Android, Web, iOS à venir)

📦 Vaults Illimités
• Créez plusieurs vaults (Personnel, Travail, Famille)
• Export JSON, CSV, TXT
• Import depuis KeePass, CSV
• Sauvegarde chiffrée

⚡ Fonctionnalités Avancées
• OTP/2FA (Time-based One-Time Passwords)
• Analyse de santé des mots de passe
• Widget Android
• Autofill Service
• Historique des mots de passe
• Presets personnalisés

🎨 Interface Moderne
• Material 3 Design
• Thèmes Dark/Light/Auto
• Multilingue (FR, EN, ES)
• Animations fluides

🔓 Open Source & Sans Télémétrie
• Code source auditable sur GitHub
• Aucune collecte de données
• Aucun tracking
• Apache License 2.0

POURQUOI GENPWD PRO ?

✅ Gratuit et Open Source
✅ Sans publicité
✅ Synchronisation sécurisée
✅ Respect de la vie privée
✅ Aucune limite d'utilisation

LIENS

• GitHub : https://github.com/VBlackJack/genpwd-pro
• Documentation : https://github.com/VBlackJack/genpwd-pro/tree/main/docs
• Support : https://github.com/VBlackJack/genpwd-pro/issues
```

### 4. Choisir la Piste

**Options** :
- **Internal testing** : Max 100 testeurs (emails)
- **Closed testing** : Max 100 testeurs (liste ou lien)
- **Open testing** : Public (any user can join)
- **Production** : Public (all users)

**Recommandation pour RC** : **Closed testing**

### 5. Upload AAB

1. **Production** → **Releases** → **Closed testing**
2. **Create new release**
3. **Upload** → Sélectionner `app-release.aab`
4. **Release name** : `1.3.0-rc.1 (37)`
5. **Release notes** :

```
Version 1.3.0 Release Candidate 1

🆕 Nouveautés
• Synchronisation cloud multi-plateformes (Google Drive, Dropbox, OneDrive, WebDAV)
• Import KeePass XML
• Analyse de santé des mots de passe améliorée
• Support des thèmes personnalisés

🔧 Améliorations
• Performance de génération +30%
• Startup time réduit à < 2s
• UI/UX peaufinée

🐛 Corrections
• Correction du bug de clipboard clear
• Correction du crash sur Android 7.0
• Amélioration de la stabilité de la sync

Merci de tester et signaler les bugs sur GitHub !
```

6. **Review release** → **Start rollout to Closed testing**

### 6. Inviter les Testeurs

1. **Testers** → **Closed testing** → **Create email list**
2. Ajouter les emails des testeurs
3. Partager le lien d'opt-in

### 7. Soumettre pour Révision

1. Vérifier tous les champs (Store Listing, Content Rating, etc.)
2. **Publishing overview** → **Send for review**
3. **Délai** : 1-3 jours ouvrés

## 📊 Post-Release

### 1. Monitoring

**Play Console** :
- Crashes & ANRs (Application Not Responding)
- User reviews and ratings
- Installation statistics
- Device compatibility

**Firebase Crashlytics** (optionnel) :
- Real-time crash reporting
- Stack traces

### 2. Feedback

- Lire tous les avis utilisateurs
- Répondre rapidement aux bugs signalés
- Créer des issues GitHub pour les bugs

### 3. Hotfix

Si un bug critique est découvert :

1. Corriger le bug
2. Incrémenter `versionCode` (37 → 38)
3. Rebuild AAB
4. Upload sur Play Console
5. Release immédiat (emergency)

### 4. Promotion

- Partager sur Reddit (r/Android, r/opensource)
- Partager sur Hacker News
- Annoncer sur Twitter/X
- Créer un post Medium/dev.to

## 📄 Checklist Finale

Avant de soumettre :

- [ ] ✅ Tous les tests passent (unit + integration)
- [ ] ✅ Performance validée (startup < 2s, génération < 100ms)
- [ ] ✅ Aucun bug CRITICAL/HIGH
- [ ] ✅ Documentation complète
- [ ] ✅ Screenshots de qualité
- [ ] ✅ Description Play Store rédigée
- [ ] ✅ AAB signé généré
- [ ] ✅ Testé sur plusieurs devices (7.0+, 14)
- [ ] ✅ Keystore sauvegardée en lieu sûr
- [ ] ✅ Data Safety form remplie
- [ ] ✅ Content Rating obtenu
- [ ] ✅ Privacy Policy publiée

## 🎉 Félicitations !

Vous avez publié GenPwd Pro sur le Google Play Store ! 🚀

---

**Auteur** : Julien Bombled
**Licence** : Apache 2.0
**Contact** : GitHub Issues
