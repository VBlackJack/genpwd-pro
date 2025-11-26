# 🔐 OAuth2 Setup Guide - GenPwd Pro Cloud Sync

Guide complet pour configurer l'authentification OAuth2 avec les différents providers cloud.

**Dernière mise à jour**: Phase 35

---

## 📋 Table des Matières

1. [Google Drive (PRODUCTION-READY)](#google-drive-production-ready)
2. [WebDAV (PRODUCTION-READY)](#webdav-production-ready)
3. [OneDrive (Template - À implémenter)](#onedrive-template)
4. [pCloud (Template - À implémenter)](#pcloud-template)
5. [ProtonDrive (Template - À implémenter)](#protondrive-template)
6. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Google Drive (PRODUCTION-READY)

### ✅ Status: **Fonctionnel et testé**

### 📝 Prérequis

- Compte Google (Gmail)
- Accès à [Google Cloud Console](https://console.cloud.google.com)
- Android Studio ou terminal avec `keytool`

### 🚀 Configuration Étape par Étape

#### 1. Créer un Projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Cliquez sur **"Sélectionner un projet"** → **"Nouveau projet"**
3. Entrez:
   - **Nom du projet**: `GenPwd Pro Sync` (ou votre choix)
   - **Organisation**: (optionnel)
4. Cliquez sur **"Créer"**
5. Attendez quelques secondes pour la création
6. Sélectionnez le projet créé dans le sélecteur en haut

#### 2. Activer l'API Google Drive

1. Dans le menu de gauche: **APIs & Services** → **Library**
2. Recherchez `Google Drive API`
3. Cliquez sur **Google Drive API**
4. Cliquez sur **"Activer"** (Enable)
5. Attendez l'activation (~30 secondes)

#### 3. Configurer l'Écran de Consentement OAuth

1. Menu: **APIs & Services** → **OAuth consent screen**
2. Sélectionnez:
   - **Type d'utilisateur**: `External` (pour tester avec n'importe quel compte Gmail)
   - Cliquez sur **"Créer"**

3. **Informations sur l'application**:
   - **Nom de l'app**: `GenPwd Pro`
   - **Email d'assistance utilisateur**: votre email
   - **Logo** (optionnel): Téléchargez un logo si vous en avez un
   - **Domaine de l'application** (optionnel): laissez vide pour l'instant
   - **Liens** (optionnel): laissez vide
   - **Email de contact du développeur**: votre email
   - Cliquez sur **"Enregistrer et continuer"**

4. **Scopes (Autorisations)**:
   - Cliquez sur **"Ajouter ou supprimer des scopes"**
   - Recherchez et sélectionnez:
     - ✅ `auth/drive.appdata` - Voir et gérer ses propres données de configuration
     - OU
     - ✅ `auth/drive.file` - Voir et gérer les fichiers Drive créés par cette app
   - Cliquez sur **"Mettre à jour"**
   - Cliquez sur **"Enregistrer et continuer"**

5. **Utilisateurs de test**:
   - Cliquez sur **"Ajouter des utilisateurs"**
   - Ajoutez votre adresse Gmail de test
   - Cliquez sur **"Ajouter"**
   - Cliquez sur **"Enregistrer et continuer"**

6. **Résumé**:
   - Vérifiez les informations
   - Cliquez sur **"Revenir au tableau de bord"**

#### 4. Créer les Identifiants OAuth2

1. Menu: **APIs & Services** → **Credentials**
2. Cliquez sur **"Créer des identifiants"** → **"ID client OAuth"**
3. Sélectionnez:
   - **Type d'application**: `Android`

4. **Nom**: `GenPwd Pro Android Client`

5. **Nom du package**:
   ```
   com.julien.genpwdpro
   ```

6. **Empreinte du certificat SHA-1**:

   Pour obtenir le SHA-1, ouvrez un terminal:

   **Pour la version de débogage (debug)**:
   ```bash
   # Sur Linux/Mac:
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # Sur Windows:
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```

   **Pour la version de production (release)**:
   ```bash
   keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-key-alias
   ```

   Copiez la ligne qui commence par `SHA1:` (sans les `:`), par exemple:
   ```
   AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
   ```

7. Cliquez sur **"Créer"**

8. **Important**: Notez le **Client ID** généré (format: `xxxx.apps.googleusercontent.com`)

#### 5. Configurer l'Application Android

1. Ouvrez `android/app/src/main/res/values/strings.xml`

2. Ajoutez votre Client ID:
   ```xml
   <resources>
       <!-- ... autres strings ... -->

       <!-- Google Drive OAuth2 -->
       <string name="google_client_id">VOTRE_CLIENT_ID.apps.googleusercontent.com</string>
   </resources>
   ```

3. Ouvrez `android/app/build.gradle.kts` et vérifiez que les dépendances sont présentes:
   ```kotlin
   // Google Drive API
   implementation("com.google.android.gms:play-services-auth:20.7.0")
   implementation("com.google.apis:google-api-services-drive:v3-rev20230520-2.0.0")
   implementation("com.google.http-client:google-http-client-android:1.43.3")
   implementation("com.google.api-client:google-api-client-android:2.2.0")
   ```

#### 6. Tester la Configuration

1. **Build l'app**:
   ```bash
   ./gradlew assembleDebug
   ```

2. **Installer sur un appareil/émulateur**:
   ```bash
   ./gradlew installDebug
   ```

3. **Dans l'app**:
   - Ouvrir **Générateur** → **Paramètres** → **Synchronisation Cloud**
   - Activer la synchronisation
   - Sélectionner **Google Drive**
   - Cliquer sur **"Se connecter"**
   - Vous devriez voir l'écran de connexion Google
   - Acceptez les autorisations
   - La connexion devrait réussir ✅

### ⚠️ Erreurs Courantes

#### "Error 403: Access Denied"
- **Solution**: Vérifiez que l'API Google Drive est activée
- **Solution**: Vérifiez que votre email est dans les "Utilisateurs de test"

#### "Error 10: Developer Error"
- **Solution**: Le SHA-1 ne correspond pas
- **Solution**: Regénérez le SHA-1 et mettez à jour dans Google Cloud Console

#### "Sign in cancelled by user"
- **Solution**: L'utilisateur a annulé - c'est normal
- **Solution**: Réessayez de vous connecter

#### "Network error"
- **Solution**: Vérifiez votre connexion Internet
- **Solution**: Vérifiez que l'appareil a accès à internet

### 📊 Quota et Limites

- **Espace gratuit**: 15 GB (partagé avec Gmail et Photos)
- **Taille max d'un fichier**: 5 TB
- **Requêtes API**: 1 milliard par jour (largement suffisant)
- **Coût**: **GRATUIT** pour usage personnel

### 🔒 Sécurité

- ✅ OAuth2 avec Google Sign-In officiel
- ✅ Tokens stockés de manière sécurisée (EncryptedSharedPreferences)
- ✅ Données chiffrées end-to-end (AES-256-GCM)
- ✅ Google ne peut pas lire vos mots de passe
- ✅ Stockage dans `appDataFolder` (privé, non visible dans Drive)

---

## WebDAV (PRODUCTION-READY)

### ✅ Status: **Fonctionnel et testé**

### 📝 Qu'est-ce que WebDAV?

WebDAV est un protocole qui permet de synchroniser vos données avec votre propre serveur, offrant un **contrôle total** et une **confidentialité maximale**.

### 🏠 Options de Serveurs WebDAV

#### Option 1: Nextcloud (Recommandé)

**Nextcloud** est une solution open-source complète de cloud personnel.

##### Installation Docker (Facile)

```bash
# Créer un réseau Docker
docker network create nextcloud-network

# Base de données MariaDB
docker run -d \
  --name nextcloud-db \
  --network nextcloud-network \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=nextcloud \
  -e MYSQL_USER=nextcloud \
  -e MYSQL_PASSWORD=nextcloud \
  -v nextcloud-db:/var/lib/mysql \
  mariadb:latest

# Nextcloud
docker run -d \
  --name nextcloud \
  --network nextcloud-network \
  -p 8080:80 \
  -v nextcloud-data:/var/www/html \
  -e MYSQL_HOST=nextcloud-db \
  -e MYSQL_DATABASE=nextcloud \
  -e MYSQL_USER=nextcloud \
  -e MYSQL_PASSWORD=nextcloud \
  nextcloud:latest
```

Accédez à `http://localhost:8080` et créez un compte admin.

##### Configuration App

1. Dans l'app GenPwd Pro:
   - **URL du serveur**: `http://VOTRE_IP:8080/remote.php/dav/files/USERNAME/`
   - **Nom d'utilisateur**: votre username Nextcloud
   - **Mot de passe**: votre mot de passe Nextcloud
   - **Valider SSL**: Décochez si self-signed certificate

2. Cliquez sur **"Tester la connexion"**
3. Si succès ✅, cliquez sur **"Enregistrer"**

#### Option 2: ownCloud

Similaire à Nextcloud:

```bash
docker run -d \
  --name owncloud \
  -p 8080:8080 \
  -v owncloud-data:/mnt/data \
  owncloud/server:latest
```

URL WebDAV: `http://VOTRE_IP:8080/remote.php/dav/files/USERNAME/`

#### Option 3: Synology NAS

Si vous avez un NAS Synology:

1. **Installer WebDAV Server**:
   - Ouvrir **Package Center**
   - Installer **WebDAV Server**
   - Activer HTTPS

2. **Configuration**:
   - **URL**: `https://VOTRE_SYNOLOGY_IP:5006/`
   - **Username**: votre compte Synology
   - **Password**: votre mot de passe Synology

#### Option 4: Hébergeurs WebDAV

Services avec support WebDAV natif:

| Service | Espace Gratuit | WebDAV URL |
|---------|----------------|------------|
| **Box.com** | 10 GB | `https://dav.box.com/dav` |
| **Yandex.Disk** | 10 GB | `https://webdav.yandex.com` |
| **Koofr** | 10 GB | `https://app.koofr.net/dav` |

### 🔐 Certificats SSL

#### Self-Signed Certificates

Si vous utilisez un certificat auto-signé (self-signed):

1. Décochez **"Valider les certificats SSL"** dans l'app
2. ⚠️ **Attention**: Moins sécurisé, utilisez uniquement sur réseau local de confiance

#### Let's Encrypt (Recommandé pour production)

Pour un certificat SSL gratuit et valide:

```bash
# Avec Docker + Nginx + Let's Encrypt
docker run -d \
  --name nginx-proxy \
  -p 80:80 -p 443:443 \
  -v certs:/etc/nginx/certs \
  -v /var/run/docker.sock:/tmp/docker.sock:ro \
  nginxproxy/nginx-proxy

docker run -d \
  --name letsencrypt \
  -v certs:/etc/nginx/certs \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  nginxproxy/acme-companion
```

### 📊 Avantages WebDAV

- ✅ **100% self-hosted**: Vous contrôlez vos données
- ✅ **Aucune limite de stockage**: Dépend de votre serveur
- ✅ **Confidentialité maximale**: Vos données restent chez vous
- ✅ **Pas de dépendance tiers**: Fonctionne sans Google/Microsoft
- ✅ **Open-source**: Nextcloud/ownCloud sont open-source
- ✅ **Gratuit**: Aucun coût de service cloud

### 🔒 Sécurité WebDAV

- ✅ Basic Authentication over HTTPS
- ✅ Support SSL/TLS
- ✅ Support certificats self-signed (pour réseau local)
- ✅ Données chiffrées end-to-end (AES-256-GCM)
- ✅ Le serveur ne peut pas lire vos mots de passe déchiffrés

---

## OneDrive (Template)

### ⚠️ Status: **Template - Nécessite configuration Azure**

### 📝 Prérequis

- Compte Microsoft (Outlook, Hotmail, Live)
- Accès à [Azure Portal](https://portal.azure.com)

### 🚀 Configuration Étape par Étape

#### 1. Créer une Application Azure AD

1. Allez sur [Azure Portal](https://portal.azure.com)
2. Menu: **Azure Active Directory** → **App registrations**
3. Cliquez sur **"New registration"**
4. Entrez:
   - **Name**: `GenPwd Pro`
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI**: Sélectionnez `Public client/native (mobile & desktop)` et entrez:
     ```
     msauth://com.julien.genpwdpro/SIGNATURE_HASH
     ```
     (Le SIGNATURE_HASH sera généré par MSAL)
5. Cliquez sur **"Register"**

#### 2. Configurer les Permissions API

1. Dans votre app Azure: **API permissions**
2. Cliquez sur **"Add a permission"**
3. Sélectionnez **Microsoft Graph**
4. Sélectionnez **Delegated permissions**
5. Cochez:
   - ✅ `Files.ReadWrite.AppFolder` - Lire et écrire dans le dossier de l'app
   - ✅ `User.Read` - Lire le profil utilisateur
6. Cliquez sur **"Add permissions"**
7. Cliquez sur **"Grant admin consent"** (si vous êtes admin)

#### 3. Obtenir l'Application (client) ID

1. Dans **Overview** de votre app
2. Copiez l'**Application (client) ID**
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

#### 4. Configurer l'Application Android

1. **Décommenter les dépendances** dans `build.gradle.kts`:
   ```kotlin
   // Microsoft Graph SDK
   implementation("com.microsoft.graph:microsoft-graph:5.+")
   implementation("com.microsoft.identity.client:msal:4.+")
   ```

2. **Créer** `android/app/src/main/res/raw/msal_config.json`:
   ```json
   {
     "client_id": "VOTRE_CLIENT_ID",
     "authorization_user_agent": "DEFAULT",
     "redirect_uri": "msauth://com.julien.genpwdpro/SIGNATURE_HASH",
     "account_mode": "SINGLE",
     "broker_redirect_uri_registered": true,
     "authorities": [
       {
         "type": "AAD",
         "audience": {
           "type": "AzureADandPersonalMicrosoftAccount",
           "tenant_id": "common"
         }
       }
     ]
   }
   ```

3. **Générer le SIGNATURE_HASH**:
   ```bash
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
   ```

4. **Mettre à jour** `OneDriveProvider.kt`:
   - Le code template est déjà présent
   - Implémenter les méthodes `authenticate()`, `uploadVault()`, etc.

#### 5. Implémenter l'Authentification

Le code template est dans `OneDriveProvider.kt`:

```kotlin
// TODO: Implémenter MSAL authentication
// Example:
val msalConfig = PublicClientApplicationConfiguration(context, R.raw.msal_config)
val msalApp = PublicClientApplication.create(context, msalConfig)

val scopes = arrayOf("Files.ReadWrite.AppFolder", "User.Read")
msalApp.acquireToken(activity, scopes, callback)
```

### 📊 Quota et Limites

- **Espace gratuit**: 5 GB
- **Taille max d'un fichier**: 250 GB
- **Coût**: Gratuit (5 GB) ou Microsoft 365 (1 TB)

### ⏱️ Estimation d'Implémentation

- **Temps**: 12-16 heures
- **Complexité**: ⭐⭐⭐⭐⭐ (Très difficile)
- **Raison**: MSAL authentication complexe, Graph SDK

---

## pCloud (Template)

### ⚠️ Status: **Template - Nécessite compte développeur pCloud**

### 📝 Prérequis

- Compte pCloud
- Demande d'accès développeur: [pCloud API](https://docs.pcloud.com/)

### 🚀 Configuration Étape par Étape

#### 1. Créer une Application pCloud

1. Contactez pCloud pour accès API: [https://www.pcloud.com/company/contactus.html](https://www.pcloud.com/company/contactus.html)
2. Demandez un **App Key** et **App Secret**
3. Indiquez:
   - Nom de l'app: `GenPwd Pro`
   - Redirect URI: `com.julien.genpwdpro://oauth`

#### 2. Recevoir les Credentials

pCloud vous enverra:
- **App Key**: `xxxxxxxxx`
- **App Secret**: `xxxxxxxxxxxxxxxxxxxxxxxx`

#### 3. Configurer l'Application

1. Ajouter dans `strings.xml`:
   ```xml
   <string name="pcloud_app_key">VOTRE_APP_KEY</string>
   <string name="pcloud_app_secret">VOTRE_APP_SECRET</string>
   ```

2. Le code template est déjà présent dans `PCloudProvider.kt`

3. Implémenter l'OAuth2:
   ```kotlin
   // TODO: Implémenter OAuth2 flow
   val authUrl = "https://my.pcloud.com/oauth2/authorize?" +
       "client_id=$appKey&" +
       "response_type=code&" +
       "redirect_uri=com.julien.genpwdpro://oauth"

   // Ouvrir le navigateur
   // Récupérer le code
   // Échanger contre un token
   ```

### 📊 Quota et Limites

- **Espace gratuit**: 10 GB
- **Taille max d'un fichier**: Illimitée
- **API calls**: Illimitées
- **Coût**: Gratuit (10 GB) ou Premium (500 GB - 2 TB)

### ⏱️ Estimation d'Implémentation

- **Temps**: 4-6 heures
- **Complexité**: ⭐⭐⭐☆☆ (Moyen)
- **Raison**: OAuth2 standard, API REST simple

---

## ProtonDrive (Template)

### ⚠️ Status: **Template - Beta API**

### 📝 Prérequis

- Compte Proton
- Accès beta API: [Proton API Documentation](https://protonmail.com/support/knowledge-base/proton-api/)

### 🚀 Configuration

⚠️ **Note**: L'API ProtonDrive est en beta limitée. L'accès développeur n'est pas encore public.

### 📧 Demander l'Accès

1. Email à: `api@proton.me`
2. Objet: "ProtonDrive API Access Request - GenPwd Pro"
3. Corps:
   ```
   Hello,

   I'm developing a password manager app called GenPwd Pro
   and would like to integrate ProtonDrive for cloud sync
   with end-to-end encryption.

   App details:
   - Name: GenPwd Pro
   - Platform: Android
   - Package: com.julien.genpwd.pro
   - Use case: Encrypted password vault synchronization

   Could you please provide access to the ProtonDrive API?

   Thank you,
   [Your Name]
   ```

### 📊 Avantages ProtonDrive

- ✅ **Double encryption**: ProtonDrive + GenPwd Pro
- ✅ **Zero-knowledge**: Proton ne peut pas lire vos données
- ✅ **Privacy-focused**: Entreprise suisse, GDPR compliant
- ✅ **Open-source**: Client ProtonDrive open-source

### 📊 Quota et Limites

- **Espace gratuit**: 1 GB
- **Taille max d'un fichier**: 25 GB
- **Coût**: Gratuit (1 GB) ou Plus (500 GB)

### ⏱️ Estimation d'Implémentation

- **Temps**: 8-12 heures
- **Complexité**: ⭐⭐⭐⭐☆ (Difficile)
- **Raison**: OAuth2 avec PKCE, API propriétaire, shares management

---

## FAQ & Troubleshooting

### Général

**Q: Quel provider choisir?**
A:
- **Google Drive**: Le plus facile, 15 GB gratuit
- **WebDAV**: Pour contrôle total et confidentialité maximale
- **OneDrive**: Si vous êtes dans l'écosystème Microsoft
- **pCloud**: 10 GB gratuit, bonne alternative
- **ProtonDrive**: Pour privacy maximale (mais beta)

**Q: Mes données sont-elles sécurisées?**
A: OUI! Toutes les données sont chiffrées end-to-end avec AES-256-GCM avant upload. Les providers ne voient que des données chiffrées.

**Q: Puis-je changer de provider?**
A: Oui, dans Paramètres → Synchronisation → Sélectionner un autre provider

**Q: Puis-je utiliser plusieurs appareils?**
A: Oui! Configurez le même provider sur tous vos appareils Android.

### Erreurs Courantes

**"Network error"**
- Vérifiez votre connexion internet
- Vérifiez que le service cloud est accessible

**"Authentication failed"**
- Revérifiez vos credentials
- Pour OAuth2, refaites le flow d'authentification

**"Quota exceeded"**
- Votre espace cloud est plein
- Supprimez des fichiers ou passez à un plan payant

**"Sync conflict detected"**
- Normal si modifications sur plusieurs appareils
- Choisissez la stratégie de résolution dans les paramètres

### Performance

**Q: Quelle est la taille du fichier synchronisé?**
A: Dépend du nombre d'entrées. Généralement:
- 100 mots de passe ≈ 50 KB
- 1000 mots de passe ≈ 500 KB
- 10000 mots de passe ≈ 5 MB

**Q: Combien de temps prend une sync?**
A:
- Première sync: 1-5 secondes
- Syncs suivantes: < 1 seconde
- Dépend de la connexion internet

### Support

**Q: Où trouver de l'aide?**
A:
- Documentation: `android/CLOUD_SYNC_README.md`
- Guide d'implémentation: `android/PROVIDER_IMPLEMENTATION_GUIDE.md`
- Status: `android/IMPLEMENTATION_STATUS.md`

---

## 🎯 Résumé des Status

| Provider | Status | Setup Time | Difficulté | Gratuit |
|----------|--------|------------|------------|---------|
| **Google Drive** | ✅ PRODUCTION | 15 min | ⭐☆☆☆☆ | 15 GB |
| **WebDAV** | ✅ PRODUCTION | 10 min | ⭐⭐☆☆☆ | Illimité |
| **OneDrive** | ⚠️ TEMPLATE | 30 min | ⭐⭐⭐⭐⭐ | 5 GB |
| **pCloud** | ⚠️ TEMPLATE | 7 jours* | ⭐⭐⭐☆☆ | 10 GB |
| **ProtonDrive** | ⚠️ TEMPLATE | 14 jours* | ⭐⭐⭐⭐☆ | 1 GB |

*Temps d'attente pour obtenir l'accès développeur

---

**Dernière mise à jour**: Phase 35 - Navigation Integration Complete
