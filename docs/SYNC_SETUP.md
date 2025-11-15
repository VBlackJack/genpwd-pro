# GenPwd Pro - Configuration de la Synchronisation Cloud

Guide complet pour configurer la synchronisation cloud multi-plateformes (Google Drive, Dropbox, OneDrive, WebDAV).

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Providers Supportés](#providers-supportés)
- [Configuration Google Drive](#configuration-google-drive)
- [Configuration Dropbox](#configuration-dropbox)
- [Configuration OneDrive](#configuration-onedrive)
- [Configuration WebDAV](#configuration-webdav)
- [Sécurité et Chiffrement](#sécurité-et-chiffrement)
- [Résolution de Conflits](#résolution-de-conflits)
- [Troubleshooting](#troubleshooting)

## 🎯 Vue d'ensemble

GenPwd Pro offre une synchronisation cloud **end-to-end chiffrée** de vos vaults entre vos appareils (Web, Android, iOS à venir).

### Caractéristiques

- ✅ **Chiffrement E2E** : AES-256-GCM avec dérivation Argon2id
- ✅ **Zero-Knowledge** : Le provider ne voit que des données chiffrées
- ✅ **Multi-providers** : Google Drive, Dropbox, OneDrive, WebDAV
- ✅ **Synchronisation automatique** : Ou manuelle sur demande
- ✅ **Résolution de conflits** : Last-Write-Wins (LWW) avec historique
- ✅ **Cross-platform** : Web ↔ Android ↔ iOS (à venir)

## 🌐 Providers Supportés

| Provider | Android | Web | OAuth | Self-hosted |
|----------|---------|-----|-------|-------------|
| Google Drive | ✅ | ✅ | ✅ | ❌ |
| Dropbox | ✅ | ✅ | ✅ | ❌ |
| OneDrive | ✅ | ✅ | ✅ | ❌ |
| WebDAV | ✅ | ✅ | ❌ | ✅ |
| pCloud | ⏳ | ⏳ | ✅ | ❌ |
| ProtonDrive | ⏳ | ⏳ | ✅ | ❌ |

**Légende** :
- ✅ Implémenté et testé
- ⏳ En cours de développement
- ❌ Non applicable

## 📱 Configuration Google Drive

Google Drive stocke vos vaults chiffrés dans le dossier `Application Data`, invisible pour l'utilisateur.

### Prérequis

1. Compte Google
2. Application enregistrée sur [Google Cloud Console](https://console.cloud.google.com/)

### Étape 1 : Créer un Projet Google Cloud

1. Visitez [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet :
   - Nom : `GenPwd Pro`
   - Organisation : (optionnel)
3. Activez l'API Google Drive :
   - **APIs & Services** → **Library**
   - Recherchez "Google Drive API"
   - Cliquez sur **Enable**

### Étape 2 : Configurer OAuth 2.0

1. **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Configure le consentement screen (si demandé) :
   - Type : External
   - Nom : GenPwd Pro
   - Email : votre email
   - Scopes : `https://www.googleapis.com/auth/drive.appdata`
4. Créez les credentials :
   - Type : **Web application** (pour Web) ou **Android** (pour Android)
   - **Web** :
     - Authorized redirect URIs : `http://localhost:8080/oauth2callback`
   - **Android** :
     - Package name : `com.julien.genpwdpro`
     - SHA-1 fingerprint : (obtenez avec `keytool`)

### Étape 3 : Obtenir le SHA-1 Fingerprint (Android)

```bash
# Debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore
keytool -list -v -keystore /path/to/my-release-key.keystore -alias my-alias
```

Copiez le SHA-1 et ajoutez-le dans Google Cloud Console.

### Étape 4 : Configurer dans GenPwd Pro

#### Android

1. Ouvrez GenPwd Pro sur Android
2. **Settings** → **Cloud Sync**
3. Sélectionnez **Google Drive**
4. Appuyez sur **Connect**
5. Authentifiez-vous avec Google
6. Autorisez l'accès au dossier Application Data

#### Web

1. Ouvrez GenPwd Pro sur Web
2. **Paramètres** → **Synchronisation**
3. Sélectionnez **Google Drive**
4. Cliquez sur **Connecter**
5. Authentifiez-vous avec Google
6. Autorisez l'accès

### Fichiers Stockés

```
Google Drive/Application Data/
└── genpwd-pro/
    └── vaults/
        ├── default.vault.encrypted
        ├── personal.vault.encrypted
        └── work.vault.encrypted
```

## 📦 Configuration Dropbox

### Prérequis

1. Compte Dropbox
2. App enregistrée sur [Dropbox App Console](https://www.dropbox.com/developers/apps)

### Étape 1 : Créer une App Dropbox

1. Visitez [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. **Create app**
3. Configuration :
   - **API** : Scoped access
   - **Type of access** : App folder (recommandé) ou Full Dropbox
   - **Name** : GenPwd Pro
4. Cliquez sur **Create app**

### Étape 2 : Configurer l'App

1. Dans l'onglet **Settings** :
   - **OAuth 2 Redirect URIs** :
     - `http://localhost:8080/oauth2callback` (Web)
     - `com.julien.genpwdpro://oauth2callback` (Android)
2. Dans l'onglet **Permissions** :
   - Cochez **files.content.write**
   - Cochez **files.content.read**

### Étape 3 : Obtenir les Credentials

1. **App key** : Copiez depuis l'onglet Settings
2. **App secret** : Copiez depuis l'onglet Settings

### Étape 4 : Configurer dans GenPwd Pro

#### Android

```kotlin
// android/app/src/main/res/values/secrets.xml
<resources>
    <string name="dropbox_app_key">YOUR_APP_KEY</string>
</resources>
```

#### Web

```javascript
// src/js/config/cloud-config.js
export const DROPBOX_CONFIG = {
  clientId: 'YOUR_APP_KEY',
  redirectUri: 'http://localhost:8080/oauth2callback'
};
```

### Fichiers Stockés

```
Dropbox/Apps/GenPwd Pro/
└── vaults/
    ├── default.vault.encrypted
    ├── personal.vault.encrypted
    └── work.vault.encrypted
```

## ☁️ Configuration OneDrive (Microsoft Graph)

### Prérequis

1. Compte Microsoft
2. App enregistrée sur [Azure Portal](https://portal.azure.com/)

### Étape 1 : Créer une App Azure AD

1. Visitez [Azure Portal](https://portal.azure.com/)
2. **Azure Active Directory** → **App registrations**
3. **New registration** :
   - Name : GenPwd Pro
   - Supported account types : Personal Microsoft accounts only
   - Redirect URI :
     - Platform : Single-page application (Web)
     - URI : `http://localhost:8080/oauth2callback`

### Étape 2 : Configurer l'API

1. **API permissions** → **Add a permission**
2. **Microsoft Graph** → **Delegated permissions**
3. Ajoutez :
   - `Files.ReadWrite.AppFolder`
   - `User.Read`
4. Cliquez sur **Add permissions**

### Étape 3 : Obtenir les Credentials

1. **Overview** → Copiez **Application (client) ID**
2. **Certificates & secrets** → **New client secret**
   - Description : GenPwd Pro Web
   - Expires : 24 months
   - Copiez la **Value**

### Étape 4 : Configurer dans GenPwd Pro

#### Android

```kotlin
// android/app/src/main/res/values/secrets.xml
<resources>
    <string name="microsoft_client_id">YOUR_CLIENT_ID</string>
</resources>
```

#### Web

```javascript
// src/js/config/cloud-config.js
export const MICROSOFT_CONFIG = {
  clientId: 'YOUR_CLIENT_ID',
  redirectUri: 'http://localhost:8080/oauth2callback',
  scopes: ['Files.ReadWrite.AppFolder']
};
```

### Fichiers Stockés

```
OneDrive/Apps/GenPwd Pro/
└── vaults/
    ├── default.vault.encrypted
    └── ...
```

## 🌍 Configuration WebDAV (Nextcloud, ownCloud, etc.)

WebDAV permet de synchroniser avec votre propre serveur (self-hosted).

### Prérequis

1. Serveur WebDAV accessible (Nextcloud, ownCloud, Apache, etc.)
2. Credentials (username + password ou App Password)

### Serveurs Supportés

- ✅ **Nextcloud** (recommandé)
- ✅ **ownCloud**
- ✅ **Apache + mod_dav**
- ✅ **nginx + webdav module**
- ✅ **Synology NAS**
- ✅ **QNAP NAS**

### Configuration Nextcloud

#### Étape 1 : Créer un App Password

1. **Settings** → **Security**
2. **Devices & sessions** → **Create new app password**
3. Nom : `GenPwd Pro`
4. Copiez le mot de passe généré

#### Étape 2 : Obtenir l'URL WebDAV

Format : `https://your-nextcloud.com/remote.php/dav/files/USERNAME/`

Exemple : `https://cloud.example.com/remote.php/dav/files/john/`

#### Étape 3 : Configurer dans GenPwd Pro

##### Android

1. **Settings** → **Cloud Sync**
2. Sélectionnez **WebDAV**
3. Remplissez :
   - **Server URL** : `https://cloud.example.com/remote.php/dav/files/john/`
   - **Username** : `john`
   - **Password** : (app password)
   - **Folder** : `genpwd-pro/` (optionnel)
4. Appuyez sur **Test Connection**
5. Si OK, appuyez sur **Save**

##### Web

1. **Paramètres** → **Synchronisation**
2. Sélectionnez **WebDAV**
3. Remplissez les mêmes champs
4. Cliquez sur **Tester la connexion**
5. Si OK, cliquez sur **Enregistrer**

### Configuration Apache

```apache
# /etc/apache2/sites-available/webdav.conf
<VirtualHost *:443>
    ServerName webdav.example.com

    DocumentRoot /var/www/webdav

    <Directory /var/www/webdav>
        Dav On
        AuthType Basic
        AuthName "WebDAV"
        AuthUserFile /etc/apache2/webdav.passwd
        Require valid-user
    </Directory>

    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/webdav.crt
    SSLCertificateKeyFile /etc/ssl/private/webdav.key
</VirtualHost>
```

Créer un utilisateur :

```bash
sudo htpasswd -c /etc/apache2/webdav.passwd john
```

### Fichiers Stockés

```
/var/www/webdav/genpwd-pro/
└── vaults/
    ├── default.vault.encrypted
    └── ...
```

## 🔐 Sécurité et Chiffrement

### Architecture E2E

```
User's Master Password
    ↓
[Argon2id KDF]
    ↓
Vault Encryption Key (256-bit)
    ↓
[AES-256-GCM Encryption]
    ↓
Encrypted Vault Blob
    ↓
[Upload to Cloud]
    ↓
Cloud Provider (voit uniquement des données chiffrées)
```

### Détails Cryptographiques

- **KDF** : Argon2id (memory-hard, résistant aux GPUs/ASICs)
  - Memory : 64 MiB
  - Iterations : 3
  - Parallelism : 1
  - Output : 256 bits

- **Chiffrement** : AES-256-GCM (Authenticated Encryption)
  - Key size : 256 bits
  - Nonce : 96 bits (unique par chiffrement)
  - Tag : 128 bits (authentification)

- **Intégrité** : SHA-256 HMAC

### Format du Vault Chiffré

```json
{
  "version": 1,
  "encrypted": "BASE64_ENCRYPTED_DATA",
  "nonce": "BASE64_NONCE",
  "tag": "BASE64_AUTH_TAG",
  "timestamp": 1704067200000,
  "deviceId": "android-samsung-s21",
  "hash": "SHA256_HASH"
}
```

### Garanties de Sécurité

✅ **Le provider cloud ne peut PAS** :
- Déchiffrer vos données (pas de clé)
- Lire vos mots de passe
- Modifier vos vaults sans détection (HMAC)

⚠️ **Vous devez** :
- Choisir un master password fort (> 12 caractères, mixte)
- Ne jamais partager votre master password
- Utiliser HTTPS pour WebDAV
- Activer 2FA sur votre compte cloud

## ⚔️ Résolution de Conflits

### Stratégie Last-Write-Wins (LWW)

Lorsqu'un conflit est détecté (modifications simultanées sur 2 appareils), GenPwd Pro utilise la stratégie **Last-Write-Wins** :

1. Compare les timestamps
2. Garde la version la plus récente
3. Sauvegarde l'ancienne version dans l'historique

### Exemple

```
Device A (Android) : Modifie vault à 10:00:00
Device B (Web)     : Modifie vault à 10:00:05

→ La version de Device B est gardée (plus récente)
→ La version de Device A est sauvegardée dans l'historique
```

### Historique des Conflits

Accessible dans **Settings** → **Sync** → **Conflict History**

## 🛠️ Troubleshooting

### Erreur : "OAuth failed"

**Cause** : Configuration OAuth incorrecte

**Solutions** :
1. Vérifiez les Redirect URIs dans la console du provider
2. Vérifiez que l'API est activée
3. Essayez de révoquer et reconnecter

### Erreur : "Network error"

**Cause** : Pas d'accès Internet

**Solutions** :
1. Vérifiez votre connexion Internet
2. Vérifiez que le firewall n'bloque pas l'app
3. Essayez avec un autre réseau (mobile data)

### Erreur : "Decryption failed"

**Cause** : Master password incorrect ou vault corrompu

**Solutions** :
1. Vérifiez votre master password
2. Restaurez depuis une sauvegarde
3. Contactez le support si le problème persiste

### Sync très lente

**Cause** : Gros vaults ou connexion lente

**Solutions** :
1. Compressez vos vaults (supprimez les entrées inutiles)
2. Désactivez la sync automatique
3. Utilisez un provider avec un meilleur débit

## 📄 Licence

Apache License 2.0 - Copyright 2025 Julien Bombled

## 🔗 Liens

- [Documentation Complète](https://github.com/VBlackJack/genpwd-pro/tree/main/docs)
- [OAuth Setup Guide](../android/CLOUD_SYNC_OAUTH_SETUP.md)
- [Architecture Sync](../android/ARCHITECTURE.md#cloud-sync)
