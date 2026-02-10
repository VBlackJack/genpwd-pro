# GenPwd Pro - Cloud Sync Guide

Complete cloud synchronization architecture with end-to-end encryption for GenPwd Pro.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Security](#security)
- [Supported Providers](#supported-providers)
- [Google Drive Setup](#google-drive-setup)
- [WebDAV Setup](#webdav-setup)
- [OneDrive Setup](#onedrive-setup)
- [pCloud Setup](#pcloud-setup)
- [ProtonDrive Setup](#protondrive-setup)
- [API Usage](#api-usage)
- [UI Components](#ui-components)
- [Conflict Resolution](#conflict-resolution)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Overview

The GenPwd Pro cloud synchronization system provides:

- Vault synchronization across multiple devices (Web, Android, iOS planned)
- End-to-end encryption with AES-256-GCM before any data leaves the device
- Automatic conflict detection and resolution
- Support for multiple cloud providers (Google Drive, WebDAV, OneDrive, etc.)
- Scheduled background synchronization
- Zero-knowledge architecture: the cloud provider never sees plaintext data

### Zero-Knowledge Principle

```
+--------------+   AES-256-GCM    +--------------+   Encrypted     +--------------+
|   Local      |   Encryption     |    Cloud     |   Data Only     |   Remote     |
|   Device     |  ------------->  |   Provider   |  ------------>  |   Device     |
|              |                  |              |                  |              |
| Master Pwd   |                  |  Blind       |                  | Master Pwd   |
| (in memory)  |                  |  Storage     |                  | (in memory)  |
+--------------+                  +--------------+                  +--------------+
```

The cloud provider NEVER sees your data in plaintext.

---

## Architecture

### Core Components

```
+------------------------------------------------------------------+
|                          UI Layer                                  |
|  VaultSyncViewModel | SyncSettingsScreen | ConflictDialog          |
+----------------------------------+-------------------------------+
                                   |
+----------------------------------+-------------------------------+
|                     Business Logic Layer                           |
|  VaultSyncManager | ConflictResolver | AutoSyncScheduler          |
+----------------------------------+-------------------------------+
                                   |
+----------------------------------+-------------------------------+
|                      Data Layer                                    |
|  VaultRepository | CloudProvider Interface                         |
|  +-- GoogleDriveProvider                                           |
|  +-- WebDAVProvider                                                |
|  +-- OneDriveProvider (template)                                   |
|  +-- PCloudProvider (template)                                     |
|  +-- ProtonDriveProvider (template)                                |
+------------------------------------------------------------------+
```

### File Structure

```
data/sync/
+-- models/
|   +-- SyncStatus.kt              # Data models
+-- providers/
|   +-- GoogleDriveProvider.kt      # Google Drive implementation
|   +-- OneDriveProvider.kt         # OneDrive implementation
|   +-- CloudProviderFactory.kt     # Factory pattern for providers
+-- workers/
|   +-- SyncWorker.kt              # Background sync worker
+-- CloudProvider.kt               # Common interface
+-- VaultSyncManager.kt            # Main orchestrator
+-- ConflictResolver.kt            # Conflict resolution logic
+-- AutoSyncScheduler.kt           # Auto-sync scheduling
+-- SyncPreferencesManager.kt      # Secure preferences management

presentation/screens/sync/
+-- VaultSyncViewModel.kt          # UI ViewModel
+-- SyncSettingsScreen.kt          # Configuration screen
+-- ConflictResolutionDialog.kt    # Conflict resolution dialog
+-- WebDAVConfigDialog.kt          # WebDAV configuration dialog
+-- SyncProgressIndicator.kt       # Progress indicators
+-- SyncHistoryScreen.kt           # Sync history screen

test/
+-- data/sync/
    +-- ConflictResolverTest.kt
    +-- VaultSyncManagerTest.kt
```

### Data Flow

```
User's Master Password
    |
    v
[Argon2id KDF]
    |
    v
Vault Encryption Key (256-bit)
    |
    v
[AES-256-GCM Encryption]
    |
    v
Encrypted Vault Blob
    |
    v
[Upload to Cloud]
    |
    v
Cloud Provider (sees only encrypted data)
```

---

## Security

### End-to-End Encryption

**Export (Upload) Process:**

1. Retrieve vault + entries + folders + tags
2. Serialize to JSON
3. Encrypt with AES-256-GCM using the master password-derived key
4. Generate SHA-256 checksum
5. Upload to cloud (encrypted data only)

**Import (Download) Process:**

1. Download from cloud (encrypted data)
2. Verify SHA-256 checksum
3. Decrypt with AES-256-GCM using the master password-derived key
4. Deserialize JSON
5. Import into local storage

### Cryptographic Details

- **KDF:** Argon2id (memory-hard, resistant to GPU/ASIC attacks)
  - Memory: 64 MiB
  - Iterations: 3
  - Parallelism: 1
  - Output: 256 bits

- **Encryption:** AES-256-GCM (Authenticated Encryption with Associated Data)
  - Key size: 256 bits
  - Nonce: 96 bits (unique per encryption operation)
  - Tag: 128 bits (authentication)

- **Integrity:** SHA-256 HMAC

### Encrypted Vault Format

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

### Security Guarantees

| Aspect              | Guarantee                                         |
|----------------------|---------------------------------------------------|
| Encryption           | AES-256-GCM (authenticated)                      |
| Encryption key       | Derived from master password via Argon2id         |
| Cloud storage        | ONLY encrypted data                               |
| Master password      | NEVER transmitted or stored                       |
| Integrity            | SHA-256 checksums                                 |
| Authentication       | OAuth2 (no passwords stored)                      |
| Metadata             | Minimal (timestamps, deviceId)                    |

**The cloud provider CANNOT:**
- Decrypt your data (no access to the key)
- Read your passwords
- Modify your vaults without detection (HMAC verification)

**You MUST:**
- Choose a strong master password (12+ characters, mixed types)
- Never share your master password
- Use HTTPS for WebDAV connections
- Enable 2FA on your cloud account

### Threat Model

**Protected against:**
- Cloud provider compromise
- Man-in-the-middle attacks (OAuth2 + HTTPS)
- Data tampering (checksums + GCM auth tag)
- Brute-force attacks (Argon2id KDF)

**NOT protected against:**
- Local device compromise
- Keylogger/malware on the device
- Social engineering for the master password
- Physical coercion

---

## Supported Providers

| Provider      | Status     | Implementation | OAuth2 | Self-Hosted | Free Storage |
|---------------|------------|----------------|--------|-------------|-------------|
| Google Drive  | Production | Complete       | Yes    | No          | 15 GB       |
| WebDAV        | Production | Complete       | N/A    | Yes         | Unlimited   |
| OneDrive      | Template   | Placeholder    | Planned| No          | 5 GB        |
| pCloud        | Template   | Placeholder    | Planned| No          | 10 GB       |
| ProtonDrive   | Template   | Placeholder    | Planned| No          | 1 GB        |

### Cross-Platform Support

| Provider     | Android | Web |
|--------------|---------|-----|
| Google Drive | Yes     | Yes |
| WebDAV       | Yes     | Yes |
| OneDrive     | Yes     | Yes |
| pCloud       | Planned | Planned |
| ProtonDrive  | Planned | Planned |

---

## Google Drive Setup

**Status:** Production-ready (requires OAuth2 configuration)

Google Drive stores encrypted vaults in the `Application Data` folder, which is invisible to the end user in their Drive interface.

### Prerequisites

- A Google account (Gmail)
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Android Studio or a terminal with `keytool`

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** then **"New project"**
3. Enter:
   - **Project name:** `GenPwd Pro Sync` (or your choice)
   - **Organization:** (optional)
4. Click **"Create"**
5. Wait a few seconds for project creation
6. Select the newly created project in the top selector

### Step 2: Enable the Google Drive API

1. In the left menu: **APIs & Services** then **Library**
2. Search for `Google Drive API`
3. Click on **Google Drive API**
4. Click **"Enable"**
5. Wait for activation (~30 seconds)

### Step 3: Configure the OAuth Consent Screen

1. Menu: **APIs & Services** then **OAuth consent screen**
2. Select:
   - **User Type:** `External` (allows testing with any Gmail account)
   - Click **"Create"**

3. **Application information:**
   - **App name:** `GenPwd Pro`
   - **User support email:** your email
   - **Logo:** (optional)
   - **Application domain:** leave blank for now
   - **Developer contact email:** your email
   - Click **"Save and Continue"**

4. **Scopes (Permissions):**
   - Click **"Add or remove scopes"**
   - Search and select:
     - `auth/drive.appdata` -- View and manage its own configuration data
     - OR `auth/drive.file` -- View and manage Drive files created by this app
   - Click **"Update"**
   - Click **"Save and Continue"**

5. **Test users:**
   - Click **"Add users"**
   - Add your test Gmail address
   - Click **"Add"**
   - Click **"Save and Continue"**

6. **Summary:**
   - Review the information
   - Click **"Back to Dashboard"**

### Step 4: Create OAuth2 Credentials

You need to create credentials for each platform you support.

#### Android Credentials

1. Menu: **APIs & Services** then **Credentials**
2. Click **"Create Credentials"** then **"OAuth client ID"**
3. Select:
   - **Application type:** `Android`
4. **Name:** `GenPwd Pro Android Client`
5. **Package name:**
   ```
   com.julien.genpwdpro
   ```
6. **SHA-1 certificate fingerprint:**

   To get the SHA-1 fingerprint, open a terminal:

   **Debug keystore:**
   ```bash
   # Linux/Mac:
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # Windows:
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```

   **Release keystore:**
   ```bash
   keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-key-alias
   ```

   Copy the line starting with `SHA1:` (e.g., `AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD`)

7. Click **"Create"**
8. **Important:** Note the generated **Client ID** (format: `xxxx.apps.googleusercontent.com`)

#### Web Credentials

1. Click **"Create Credentials"** then **"OAuth client ID"**
2. Select:
   - **Application type:** `Web application`
3. **Name:** `GenPwd Pro Web Client`
4. **Authorized redirect URIs:** `http://localhost:8080/oauth2callback`
5. Click **"Create"**
6. Note the **Client ID** and **Client Secret**

### Step 5: Configure the Application

#### Android Configuration

1. Open `android/app/src/main/res/values/strings.xml`
2. Add your Client ID:
   ```xml
   <resources>
       <!-- Google Drive OAuth2 -->
       <string name="google_client_id">YOUR_CLIENT_ID.apps.googleusercontent.com</string>
   </resources>
   ```

3. Verify that the dependencies are present in `android/app/build.gradle.kts`:
   ```kotlin
   // Google Drive API
   implementation("com.google.android.gms:play-services-auth:20.7.0")
   implementation("com.google.apis:google-api-services-drive:v3-rev20230520-2.0.0")
   implementation("com.google.http-client:google-http-client-android:1.43.3")
   implementation("com.google.api-client:google-api-client-android:2.2.0")

   // WorkManager for Auto-Sync
   implementation("androidx.work:work-runtime-ktx:2.9.0")
   implementation("androidx.hilt:hilt-work:1.1.0")
   kapt("androidx.hilt:hilt-compiler:1.1.0")
   ```

#### Web Configuration

```javascript
// src/js/config/cloud-config.js
export const GOOGLE_DRIVE_CONFIG = {
  clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  redirectUri: 'http://localhost:8080/oauth2callback',
  scopes: ['https://www.googleapis.com/auth/drive.appdata']
};
```

### Step 6: Test the Configuration

1. **Build the app:**
   ```bash
   ./gradlew assembleDebug
   ```

2. **Install on a device/emulator:**
   ```bash
   ./gradlew installDebug
   ```

3. **In the app:**
   - Open **Settings** then **Cloud Sync**
   - Enable synchronization
   - Select **Google Drive**
   - Tap **"Connect"**
   - You should see the Google sign-in screen
   - Accept the permissions
   - The connection should succeed

### Files Stored on Google Drive

```
Google Drive/Application Data/
+-- genpwd-pro/
    +-- vaults/
        +-- default.vault.encrypted
        +-- personal.vault.encrypted
        +-- work.vault.encrypted
```

### Common Errors

#### "Error 403: Access Denied"
- Verify that the Google Drive API is enabled
- Verify that your email is listed under "Test users"

#### "Error 10: Developer Error"
- The SHA-1 fingerprint does not match
- Regenerate the SHA-1 and update it in Google Cloud Console

#### "Sign in cancelled by user"
- The user cancelled the sign-in flow -- this is normal
- Retry the connection

#### "Network error"
- Check your internet connection
- Verify that the device has network access

### Quota and Limits

- **Free storage:** 15 GB (shared with Gmail and Photos)
- **Max file size:** 5 TB
- **API requests:** 1 billion per day (more than sufficient)
- **Cost:** FREE for personal use

### Security Notes

- OAuth2 via official Google Sign-In
- Tokens stored securely (EncryptedSharedPreferences)
- Data encrypted end-to-end (AES-256-GCM)
- Google cannot read your passwords
- Storage in `appDataFolder` (private, not visible in Drive)

---

## WebDAV Setup

**Status:** Production-ready

WebDAV is an open protocol that lets you synchronize your data with your own server, offering complete control and maximum privacy.

### Compatible Servers

- **Nextcloud** (recommended) -- full-featured open-source personal cloud
- **ownCloud** -- similar to Nextcloud
- **Synology NAS** -- built-in WebDAV server package
- **Apache** with `mod_dav`
- **nginx** with WebDAV module
- **QNAP NAS**

### Commercial WebDAV Services

| Service      | Free Storage | WebDAV URL                      |
|--------------|-------------|----------------------------------|
| Box.com      | 10 GB       | `https://dav.box.com/dav`        |
| Yandex.Disk  | 10 GB       | `https://webdav.yandex.com`      |
| Koofr        | 10 GB       | `https://app.koofr.net/dav`      |

### Nextcloud Configuration

Nextcloud is the recommended self-hosted option. It can be installed via Docker, manual install, or through hosting providers such as Hetzner, OVH, or others. Refer to the [Nextcloud documentation](https://nextcloud.com/install/) for installation instructions.

#### Step 1: Create an App Password

1. In Nextcloud: **Settings** then **Security**
2. **Devices & sessions** then **Create new app password**
3. Name: `GenPwd Pro`
4. Copy the generated password

#### Step 2: Get the WebDAV URL

Format: `https://your-nextcloud.com/remote.php/dav/files/USERNAME/`

Example: `https://cloud.example.com/remote.php/dav/files/john/`

#### Step 3: Configure in GenPwd Pro

##### Android

1. **Settings** then **Cloud Sync**
2. Select **WebDAV**
3. Fill in:
   - **Server URL:** `https://cloud.example.com/remote.php/dav/files/john/`
   - **Username:** `john`
   - **Password:** (the app password from Step 1)
   - **Folder:** `genpwd-pro/` (optional)
4. Tap **Test Connection**
5. If successful, tap **Save**

##### Web

1. **Settings** then **Synchronization**
2. Select **WebDAV**
3. Fill in the same fields
4. Click **Test Connection**
5. If successful, click **Save**

### ownCloud Configuration

WebDAV URL format: `https://your-server.com/remote.php/webdav/`

Configuration is identical to Nextcloud.

### Synology NAS Configuration

1. **Install the WebDAV Server package:**
   - Open **Package Center**
   - Install **WebDAV Server**
   - Enable HTTPS

2. **Configuration in GenPwd Pro:**
   - **URL:** `https://YOUR_SYNOLOGY_IP:5006/`
   - **Username:** your Synology account
   - **Password:** your Synology password

### WebDAV URL Reference

```
Nextcloud:  https://cloud.example.com/remote.php/dav/files/USERNAME/
ownCloud:   https://cloud.example.com/remote.php/webdav/
Synology:   https://nas.example.com:5006/home/
```

### Dependencies

```kotlin
// OkHttp for WebDAV
implementation("com.squareup.okhttp3:okhttp:4.11.0")
implementation("com.squareup.okhttp3:logging-interceptor:4.11.0")

// Optional: Sardine WebDAV client
implementation("com.github.lookfirst:sardine-android:0.8")
```

### SSL Certificates

#### Self-Signed Certificates

If you use a self-signed certificate:

1. Uncheck **"Validate SSL certificates"** in the app
2. **Warning:** Less secure -- only use on a trusted local network

#### Let's Encrypt (Recommended for Production)

For a free and valid SSL certificate, use [Let's Encrypt](https://letsencrypt.org/) with your web server (Apache, nginx, or a reverse proxy).

### WebDAV Security

- Basic Authentication over HTTPS
- SSL/TLS support
- Support for custom/self-signed SSL certificates
- All data encrypted client-side before upload (AES-256-GCM)
- The server cannot read your decrypted passwords

### Advantages

- 100% self-hosted: you control your data
- No storage limits (depends on your server)
- Maximum privacy: your data stays on your own infrastructure
- No third-party dependency: works without Google/Microsoft
- Open-source servers available (Nextcloud, ownCloud)
- Free (if self-hosted)

---

## OneDrive Setup

**Status:** Template -- requires Azure AD configuration and full implementation

### Prerequisites

- A Microsoft account (Outlook, Hotmail, Live)
- Access to [Azure Portal](https://portal.azure.com)

### Step 1: Create an Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Menu: **Azure Active Directory** then **App registrations**
3. Click **"New registration"**
4. Enter:
   - **Name:** `GenPwd Pro`
   - **Supported account types:** `Accounts in any organizational directory and personal Microsoft accounts`
   - **Redirect URI:** Select `Public client/native (mobile & desktop)` and enter:
     ```
     msauth://com.julien.genpwdpro/SIGNATURE_HASH
     ```
     (The `SIGNATURE_HASH` will be generated by MSAL)
5. Click **"Register"**

### Step 2: Configure API Permissions

1. In your Azure app: **API permissions**
2. Click **"Add a permission"**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Check:
   - `Files.ReadWrite.AppFolder` -- Read and write in the app folder
   - `User.Read` -- Read user profile
6. Click **"Add permissions"**
7. Click **"Grant admin consent"** (if you are an admin)

### Step 3: Get the Application (Client) ID

1. In the **Overview** of your app
2. Copy the **Application (client) ID**
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 4: Configure the Application

#### Android Configuration

1. **Add dependencies** to `build.gradle.kts`:
   ```kotlin
   // Microsoft Graph SDK
   implementation("com.microsoft.graph:microsoft-graph:5.+")
   implementation("com.microsoft.identity.client:msal:4.+")
   ```

2. **Create** `android/app/src/main/res/raw/msal_config.json`:
   ```json
   {
     "client_id": "YOUR_CLIENT_ID",
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

3. **Generate the SIGNATURE_HASH:**
   ```bash
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
   ```

4. The code template is already present in `OneDriveProvider.kt`. Implement the `authenticate()`, `uploadVault()`, and other methods.

#### Web Configuration

```javascript
// src/js/config/cloud-config.js
export const MICROSOFT_CONFIG = {
  clientId: 'YOUR_CLIENT_ID',
  redirectUri: 'http://localhost:8080/oauth2callback',
  scopes: ['Files.ReadWrite.AppFolder']
};
```

### Implementation Notes

- **Estimated effort:** 12-16 hours
- **Complexity:** High (MSAL authentication, Graph SDK integration)
- **Quota:** Free 5 GB, or 1 TB with Microsoft 365
- **Max file size:** 250 GB

---

## pCloud Setup

**Status:** Template -- requires pCloud developer account

### Prerequisites

- A pCloud account
- Developer API access: [pCloud API Documentation](https://docs.pcloud.com/)

### Step 1: Create a pCloud Application

1. Contact pCloud for API access: [https://www.pcloud.com/company/contactus.html](https://www.pcloud.com/company/contactus.html)
2. Request an **App Key** and **App Secret**
3. Specify:
   - App name: `GenPwd Pro`
   - Redirect URI: `com.julien.genpwdpro://oauth`

### Step 2: Receive Credentials

pCloud will provide:
- **App Key**
- **App Secret**

### Step 3: Configure the Application

1. Add to `strings.xml`:
   ```xml
   <string name="pcloud_app_key">YOUR_APP_KEY</string>
   <string name="pcloud_app_secret">YOUR_APP_SECRET</string>
   ```

2. The code template is already present in `PCloudProvider.kt`.

3. Dependencies:
   ```kotlin
   // REST API
   implementation("com.squareup.retrofit2:retrofit:2.9.0")
   implementation("com.squareup.retrofit2:converter-gson:2.9.0")
   implementation("com.squareup.okhttp3:okhttp:4.11.0")
   ```

### API Endpoints

- EU region: `https://api.pcloud.com`
- US region: `https://eapi.pcloud.com`

### Implementation Notes

- **Estimated effort:** 4-6 hours
- **Complexity:** Medium (standard OAuth2, simple REST API)
- **Quota:** Free 10 GB, Premium 500 GB - 2 TB
- **Max file size:** Unlimited
- **API calls:** Unlimited
- European servers (Switzerland/Luxembourg)
- Optional pCloud Crypto for double encryption

---

## ProtonDrive Setup

**Status:** Template -- Beta API (developer access not yet public)

### Prerequisites

- A Proton account
- Beta API access: [Proton API Documentation](https://protonmail.com/support/knowledge-base/proton-api/)

### Requesting API Access

The ProtonDrive API is in limited beta. Developer access is not yet publicly available.

1. Email: `api@proton.me`
2. Subject: "ProtonDrive API Access Request - GenPwd Pro"
3. Body:
   ```
   Hello,

   I'm developing a password manager app called GenPwd Pro
   and would like to integrate ProtonDrive for cloud sync
   with end-to-end encryption.

   App details:
   - Name: GenPwd Pro
   - Platform: Android
   - Package: com.julien.genpwdpro
   - Use case: Encrypted password vault synchronization

   Could you please provide access to the ProtonDrive API?

   Thank you,
   [Your Name]
   ```

### Configuration (Once Access Is Granted)

1. Create an app on the Proton Developer Portal
2. Configure OAuth2 redirect URIs
3. Add scopes: `drive.read`, `drive.write`
4. Obtain Client ID and Client Secret

### Dependencies

```kotlin
// REST API (Proton SDK not yet public)
implementation("com.squareup.retrofit2:retrofit:2.9.0")
implementation("com.squareup.retrofit2:converter-gson:2.9.0")
implementation("com.squareup.okhttp3:okhttp:4.11.0")
```

### Implementation Notes

- **Estimated effort:** 8-12 hours
- **Complexity:** High (OAuth2 with PKCE, proprietary API, shares management)
- **Quota:** Free 1 GB, Plus 500 GB
- **Max file size:** 25 GB
- Double encryption (ProtonDrive AES-256 + GenPwd Pro AES-256)
- Zero-knowledge architecture on both sides
- Swiss-based company (strong privacy jurisdiction)
- Open-source client

---

## API Usage

### Provider Configuration

```kotlin
@Inject lateinit var vaultSyncManager: VaultSyncManager

// 1. Create the provider
val googleDriveProvider = GoogleDriveProvider()

// 2. Configure the manager
vaultSyncManager.setProvider(
    provider = googleDriveProvider,
    type = CloudProviderType.GOOGLE_DRIVE
)

// 3. Authenticate
val isAuthenticated = vaultSyncManager.authenticate(activity)
```

### Manual Sync

```kotlin
// Upload to cloud
val result = vaultSyncManager.syncVault(
    vaultId = "vault-123",
    masterPassword = "user-password"
)

when (result) {
    is SyncResult.Success -> {
        // Sync succeeded
    }
    is SyncResult.Conflict -> {
        // Conflict detected, resolution required
        val local = result.localVersion
        val remote = result.remoteVersion
    }
    is SyncResult.Error -> {
        // Error: result.message
    }
}

// Download from cloud
val success = vaultSyncManager.downloadVault(
    vaultId = "vault-123",
    masterPassword = "user-password"
)
```

### Automatic Sync

```kotlin
@Inject lateinit var autoSyncScheduler: AutoSyncScheduler

// Schedule periodic sync
autoSyncScheduler.schedulePeriodicSync(
    vaultId = "vault-123",
    masterPassword = "user-password",
    interval = SyncInterval.HOURLY,
    wifiOnly = true
)

// Immediate one-time sync
autoSyncScheduler.scheduleOneTimeSync(
    vaultId = "vault-123",
    masterPassword = "user-password"
)

// Cancel scheduled sync
autoSyncScheduler.cancelPeriodicSync()
```

### Sync Intervals

```kotlin
enum class SyncInterval {
    MANUAL,         // Manual sync only
    REALTIME,       // Real-time (after each modification)
    EVERY_15_MIN,   // Every 15 minutes
    EVERY_30_MIN,   // Every 30 minutes
    HOURLY,         // Every hour
    DAILY           // Once a day
}
```

### Sync Configuration

```kotlin
data class SyncConfig(
    val enabled: Boolean = false,
    val providerType: CloudProviderType = CloudProviderType.NONE,
    val syncInterval: SyncInterval = SyncInterval.MANUAL,
    val autoSync: Boolean = false,
    val syncOnWifiOnly: Boolean = true,
    val deviceId: String = "",
    val deviceName: String = ""
)
```

### Monitoring Sync Status

```kotlin
vaultSyncManager.syncStatus.collect { status ->
    when (status) {
        SyncStatus.NEVER_SYNCED -> // Never synchronized
        SyncStatus.SYNCED -> // Up to date
        SyncStatus.SYNCING -> // In progress
        SyncStatus.PENDING -> // Changes pending
        SyncStatus.ERROR -> // Error
        SyncStatus.CONFLICT -> // Conflict
    }
}
```

### Checking Storage Quota

```kotlin
val quota = vaultSyncManager.getStorageQuota()
println("Used: ${quota.usedBytes / 1_000_000} MB")
println("Total: ${quota.totalBytes / 1_000_000} MB")
println("Usage: ${quota.usagePercent}%")
```

### Listing Cloud Vaults

```kotlin
val cloudVaults = vaultSyncManager.listCloudVaults()
cloudVaults.forEach { vaultId ->
    println("Cloud vault: $vaultId")
}
```

---

## UI Components

### ConflictResolutionDialog

A Compose dialog for manually resolving synchronization conflicts.

**Features:**
- Visual comparison of versions (local vs cloud)
- Metadata display (name, device, date, size, checksum)
- Strategy selection (LOCAL_WINS, REMOTE_WINS, NEWEST_WINS)
- Detailed description of each strategy
- Irreversibility warning

**Usage:**
```kotlin
ConflictResolutionDialog(
    localVersion = localVaultData,
    remoteVersion = remoteVaultData,
    onResolve = { strategy ->
        viewModel.resolveConflict(strategy, masterPassword)
    },
    onDismiss = { /* Close dialog */ }
)
```

### WebDAVConfigDialog

A configuration dialog for custom WebDAV servers.

**Features:**
- Server URL configuration
- Username/password input
- SSL validation toggle
- Connection test
- Example URLs (Nextcloud, ownCloud, Synology)
- Security warnings

**Usage:**
```kotlin
WebDAVConfigDialog(
    onSave = { url, username, password, validateSSL ->
        viewModel.configureWebDAV(url, username, password, validateSSL)
    },
    onTestConnection = { url, username, password, validateSSL ->
        viewModel.testWebDAVConnection(url, username, password, validateSSL) { success, message ->
            // Handle result
        }
    },
    onDismiss = { /* Close dialog */ }
)
```

### SyncProgressIndicator

An animated component displaying the synchronization state.

**Supported states:**
- **Connecting:** Connecting to cloud (rotating icon)
- **Uploading:** Upload with progress bar
- **Downloading:** Download with progress bar
- **Verifying:** Integrity verification (pulsation)
- **Success:** Success (auto-dismiss after 3 seconds)
- **Error:** Error with message

**Usage:**
```kotlin
var syncState by remember { mutableStateOf<SyncProgressState>(SyncProgressState.Idle) }

SyncProgressIndicator(
    state = syncState,
    onDismiss = { syncState = SyncProgressState.Idle }
)

// Update state during sync
syncState = SyncProgressState.Uploading(progress = 0.5f, fileName = "vault.enc")
```

**Mini Indicator** (for toolbar):
```kotlin
MiniSyncIndicator(isSyncing = true)
```

### SyncHistoryScreen

A full-screen history view with detailed statistics.

**Features:**
- Global statistics (total, successful, failed syncs)
- Success rate chart
- List of recent synchronizations
- Expandable details for each sync
- Error and conflict display
- Color codes by status

**Data model:**
```kotlin
data class SyncHistoryEntry(
    val timestamp: Long,
    val operation: String,
    val status: SyncHistoryStatus, // SUCCESS, ERROR, CONFLICT
    val provider: String,
    val vaultName: String?,
    val durationMs: Long?,
    val sizeBytes: Long?,
    val changesCount: Int?,
    val errorMessage: String?,
    val conflictResolution: String?
)
```

### SyncPreferencesManager

Manages preferences with secure storage.

**Features:**
- EncryptedSharedPreferences for credentials
- Sync configuration (auto-sync, interval, Wi-Fi-only)
- History and statistics
- Multi-provider management (Google Drive, OneDrive, WebDAV, etc.)

**Usage:**
```kotlin
@Inject lateinit var prefsManager: SyncPreferencesManager

// Auto-sync
prefsManager.setAutoSyncEnabled(true)
prefsManager.setSyncInterval(SyncInterval.ONE_HOUR)

// Provider
prefsManager.setCurrentProvider(CloudProviderType.GOOGLE_DRIVE)

// Credentials (encrypted)
prefsManager.setGoogleDriveCredentials(accessToken, refreshToken)
prefsManager.setWebDAVCredentials(url, username, password, validateSSL = true)

// Statistics
val stats = prefsManager.getSyncStatistics()
println("Success rate: ${stats.successRate}%")
```

**Securely stored data:**
- OAuth2 tokens (Google Drive, OneDrive, pCloud, ProtonDrive)
- WebDAV credentials (URL, username, password)
- Timestamps and history
- Auto-sync configuration

---

## Conflict Resolution

### Strategies

```kotlin
enum class ConflictResolutionStrategy {
    LOCAL_WINS,     // Keep the local version
    REMOTE_WINS,    // Keep the cloud version
    NEWEST_WINS,    // Keep the most recent (by timestamp)
    SMART_MERGE,    // Intelligent merge (planned)
    MANUAL          // Ask the user
}
```

### Conflict Detection and Resolution

```kotlin
@Inject lateinit var conflictResolver: ConflictResolver

// Detect conflict
val hasConflict = conflictResolver.hasConflict(localData, remoteData)

// Suggest strategy
val strategy = conflictResolver.suggestStrategy(localData, remoteData)

// Resolve
val resolved = conflictResolver.resolve(
    local = localData,
    remote = remoteData,
    strategy = ConflictResolutionStrategy.NEWEST_WINS
)

// Upload resolved version
vaultSyncManager.resolveConflict(
    local = localData,
    remote = remoteData,
    strategy = strategy,
    masterPassword = "user-password"
)
```

### Last-Write-Wins (LWW) Example

When a conflict is detected (simultaneous modifications on two devices), GenPwd Pro uses the Last-Write-Wins strategy by default:

1. Compares timestamps
2. Keeps the most recent version
3. Saves the older version in history

```
Device A (Android) : Modifies vault at 10:00:00
Device B (Web)     : Modifies vault at 10:00:05

--> Device B's version is kept (more recent)
--> Device A's version is saved in conflict history
```

Conflict history is accessible in **Settings** then **Sync** then **Conflict History**.

---

## Troubleshooting

### "Provider not authenticated"

**Cause:** OAuth2 flow not completed.

**Solutions:**
- Verify the Google Cloud Console configuration
- Verify the SHA-1 certificate fingerprint
- Retry authentication

### "Upload failed"

**Cause:** No internet connection or storage quota exceeded.

**Solutions:**
- Check your internet connection
- Check your cloud storage quota
- Enable logs: `adb logcat | grep GoogleDriveProvider`

### "Conflict detected"

**Cause:** Simultaneous modifications on two devices.

**Solutions:**
- Use `ConflictResolutionStrategy.NEWEST_WINS`
- Or use manual resolution if the data is critical

### "Decryption failed"

**Cause:** Incorrect master password or corrupted data.

**Solutions:**
- Verify your master password
- Check the integrity of the cloud file
- Restore from a backup if necessary

### "OAuth failed"

**Cause:** Incorrect OAuth configuration.

**Solutions:**
- Verify the Redirect URIs in the provider console
- Verify that the API is enabled
- Try revoking access and reconnecting

### "Network error"

**Cause:** No internet access.

**Solutions:**
- Check your internet connection
- Check that the firewall is not blocking the app
- Try with a different network (e.g., mobile data)

### "Quota exceeded"

**Cause:** Cloud storage is full.

**Solutions:**
- Delete unnecessary files from your cloud storage
- Upgrade to a paid plan

### Slow Sync

**Cause:** Large vaults or slow connection.

**Solutions:**
- Clean up your vaults (remove unused entries)
- Disable automatic sync
- Use a provider with better throughput

### Performance Reference

Typical sync file sizes:
- 100 passwords: approximately 50 KB
- 1,000 passwords: approximately 500 KB
- 10,000 passwords: approximately 5 MB

Typical sync times:
- First sync: 1-5 seconds
- Subsequent syncs: less than 1 second
- Depends on internet connection speed

### Provider Selection Guide

- **Google Drive:** Easiest setup, 15 GB free storage
- **WebDAV:** For complete control and maximum privacy
- **OneDrive:** If you are in the Microsoft ecosystem
- **pCloud:** 10 GB free, good alternative with European servers
- **ProtonDrive:** For maximum privacy (beta API)

---

## Roadmap

### Version 1.0 (Complete)

- Core architecture complete
- GoogleDriveProvider (production-ready)
- VaultSyncManager with multi-provider support
- ConflictResolver with intelligent suggestions
- AutoSyncScheduler with WorkManager
- Unit tests (25+ tests, 85-90% coverage)
- CloudProviderFactory
- VaultSyncViewModel for UI

### Version 1.1 (Templates Created)

- OneDriveProvider (complete template)
- ProtonDriveProvider (complete template)
- PCloudProvider (complete template)
- WebDAVProvider (complete template)
- Full implementation of OneDrive, ProtonDrive, pCloud, and WebDAV pending

### Version 1.2 (UI & UX -- In Progress)

- ConflictResolutionDialog for manual resolution
- WebDAVConfigDialog for WebDAV configuration
- SyncPreferencesManager for secure persistence
- SyncProgressIndicator with animated states
- SyncHistoryScreen with detailed statistics
- CloudProviderFactory for centralized management
- Full UI integration into the app pending

### Version 1.3 (Future Features)

- Real-time sync with observers
- Improved smart merge algorithm
- Delta sync (incremental synchronization)
- Data compression
- Automated full backup/restore
- Multi-vault simultaneous sync
- Sync history export/import

### Test Coverage

| Component         | Tests       | Coverage |
|-------------------|-------------|----------|
| ConflictResolver  | 13 tests    | ~90%     |
| VaultSyncManager  | 12 tests    | ~85%     |
| GoogleDriveProvider | Manual testing | --     |

### Running Tests

```bash
# Unit tests
./gradlew test

# Specific tests
./gradlew test --tests ConflictResolverTest
./gradlew test --tests VaultSyncManagerTest
```

---

Apache License 2.0 - Copyright 2025 Julien Bombled
