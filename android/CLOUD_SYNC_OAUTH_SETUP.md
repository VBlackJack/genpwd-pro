# Cloud Sync OAuth Setup Guide

This document explains the OAuth2 implementation for cloud sync and provides setup instructions for Google Cloud Console and other providers.

## Architecture Overview

The cloud sync system uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure authentication with cloud providers. The implementation follows a modular architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
├─────────────────────────────────────────────────────────────────┤
│  CloudAccountsScreen  →  AddCloudAccountScreen                  │
│         ↓                        ↓                               │
│  CloudAccountsViewModel  ←  OAuthCallbackActivity               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Sync Engine Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ProviderRegistry  →  CloudProvider  →  AuthProvider            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Implementations                      │
├─────────────────────────────────────────────────────────────────┤
│  GoogleDriveProvider  |  DropboxProvider  |  OneDriveProvider   │
│  OAuth2GoogleDriveAuthProvider                                   │
└─────────────────────────────────────────────────────────────────┘
```

## OAuth Flow

### 1. Initiate OAuth Flow

When user selects a cloud provider:

```kotlin
// CloudAccountsViewModel.kt
fun addAccount(kind: ProviderKind) {
    val provider = providerRegistry.get(kind)
    _events.emit(CloudAccountsEvent.StartOAuthFlow(kind))
}
```

### 2. Generate Authorization URL

The auth provider generates an OAuth URL with PKCE:

```kotlin
// OAuth2GoogleDriveAuthProvider.kt
val codeVerifier = generateCodeVerifier()
val codeChallenge = generateCodeChallenge(codeVerifier)
val state = "${providerKind.name}:${UUID.randomUUID()}"

val authUrl = buildAuthorizationUrl(
    clientId = CLIENT_ID,
    redirectUri = REDIRECT_URI,
    scope = SCOPES,
    state = state,
    codeChallenge = codeChallenge
)

// Store code_verifier securely for later use
secureStorage.save("oauth_verifier_$state", codeVerifier)
```

### 3. Browser Redirect

User authenticates in browser, which redirects back to app:

```
com.julien.genpwdpro://oauth2callback?code=AUTH_CODE&state=GOOGLE_DRIVE:uuid
```

### 4. Handle Callback

`OAuthCallbackActivity` intercepts the redirect:

```kotlin
// OAuthCallbackActivity.kt
override fun onCreate(savedInstanceState: Bundle?) {
    val uri = intent.data
    val authCode = uri.getQueryParameter("code")
    val state = uri.getQueryParameter("state")

    processAuthorizationCode(authCode, state)
}
```

### 5. Parse State & Get Provider

```kotlin
// Extract provider kind from state
val parts = state.split(":", limit = 2)
val providerKind = ProviderKind.valueOf(parts[0])
val stateId = parts[1]

// Get provider from registry
val provider = providerRegistry.get(providerKind)
```

### 6. Exchange Code for Tokens

```kotlin
// Retrieve code_verifier from secure storage
val codeVerifier = secureStorage.get("oauth_verifier_$state")

// Exchange authorization code for tokens
val tokens = authProvider.exchangeCodeForTokens(
    authCode = authCode,
    codeVerifier = codeVerifier
)
```

### 7. Save Account

```kotlin
val account = CloudAccount(
    id = UUID.randomUUID().toString(),
    kind = providerKind,
    displayName = tokens.email ?: "User Account",
    accessToken = tokens.accessToken,
    refreshToken = tokens.refreshToken,
    expiresAt = System.currentTimeMillis() + tokens.expiresIn * 1000
)

storage.saveAccount(account)
```

## Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project: **GenPwdPro**
3. Enable **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select **External** user type
3. Fill in application information:
   - **App name**: GenPwd Pro
   - **User support email**: your-email@example.com
   - **App logo**: (optional)
   - **Developer contact**: your-email@example.com
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/drive.file`
5. Add test users (for testing phase)

### Step 3: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Select **Android** as application type
4. Configure:
   - **Name**: GenPwd Pro Android
   - **Package name**: `com.julien.genpwdpro`
   - **SHA-1 certificate fingerprint**: (from your signing keystore)

To get SHA-1 fingerprint:
```bash
# Debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore
keytool -list -v -keystore /path/to/release.keystore -alias your-key-alias
```

5. Also create a **Web application** client for the redirect URI:
   - **Authorized redirect URIs**:
     - `com.julien.genpwdpro:/oauth2callback`
     - `http://127.0.0.1:*/oauth2callback` (for testing)

### Step 4: Get Client ID

After creation, copy the **Client ID** (format: `xxx.apps.googleusercontent.com`)

### Step 5: Update Code

Update `OAuth2GoogleDriveAuthProvider.kt`:

```kotlin
companion object {
    private const val CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com"
    private const val REDIRECT_URI = "com.julien.genpwdpro://oauth2callback"
    // ... rest of constants
}
```

## AndroidManifest Configuration

Already configured in `AndroidManifest.xml`:

```xml
<activity
    android:name=".presentation.sync.OAuthCallbackActivity"
    android:exported="true"
    android:launchMode="singleTask"
    android:theme="@style/Theme.GenPwdPro">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data
            android:scheme="com.julien.genpwdpro"
            android:host="oauth2callback" />
    </intent-filter>
</activity>
```

## Implementation Status

### ✅ Completed

1. **UI Components**:
   - CloudAccountsScreen with account management
   - AddCloudAccountScreen with provider selection
   - OAuthCallbackActivity for OAuth redirect handling
   - ConflictResolutionScreen for merge conflicts
   - Navigation integration with SyncSettings

2. **OAuth Flow Architecture**:
   - State parameter encoding/decoding
   - Provider registry integration
   - Authorization code parsing
   - Error handling and logging
   - Result intent handling

3. **Core Infrastructure**:
   - ProviderKind enum with all supported providers
   - CloudAccountsViewModel with state management
   - Event-based communication (StateFlow/SharedFlow)
   - Hilt dependency injection setup

### ⚠️ Remaining Implementation

1. **Secure Storage for PKCE**:
   ```kotlin
   // Need to implement:
   interface OAuthStateStorage {
       suspend fun saveCodeVerifier(state: String, verifier: String)
       suspend fun getCodeVerifier(state: String): String?
       suspend fun clearCodeVerifier(state: String)
   }

   // Use Android EncryptedSharedPreferences
   class EncryptedOAuthStateStorage @Inject constructor(
       @ApplicationContext context: Context
   ) : OAuthStateStorage {
       private val prefs = EncryptedSharedPreferences.create(
           "oauth_state",
           MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
           context,
           EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
           EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
       )
   }
   ```

2. **Token Exchange Implementation**:
   - Complete `exchangeCodeForTokens` in auth providers
   - Parse token response (access_token, refresh_token, expires_in)
   - Handle token refresh logic

3. **Account Storage Model**:
   ```kotlin
   @Entity(tableName = "cloud_accounts")
   data class CloudAccount(
       @PrimaryKey val id: String,
       val kind: ProviderKind,
       val displayName: String,
       val email: String?,
       @ColumnInfo(name = "access_token") val accessToken: String,
       @ColumnInfo(name = "refresh_token") val refreshToken: String?,
       @ColumnInfo(name = "expires_at") val expiresAt: Long,
       @ColumnInfo(name = "created_at") val createdAt: Long = System.currentTimeMillis(),
       @ColumnInfo(name = "last_sync") val lastSync: Long? = null
   )

   @Dao
   interface CloudAccountDao {
       @Query("SELECT * FROM cloud_accounts")
       fun getAll(): Flow<List<CloudAccount>>

       @Insert(onConflict = OnConflictStrategy.REPLACE)
       suspend fun insert(account: CloudAccount)

       @Delete
       suspend fun delete(account: CloudAccount)

       @Query("SELECT * FROM cloud_accounts WHERE kind = :kind LIMIT 1")
       suspend fun getByKind(kind: ProviderKind): CloudAccount?
   }
   ```

4. **Provider Auth Implementations**:
   - Dropbox OAuth2 (CLIENT_ID needed)
   - OneDrive OAuth2 (CLIENT_ID needed)
   - WebDAV (username/password - different flow)
   - Nextcloud (similar to WebDAV)

5. **Testing**:
   - Unit tests for OAuthCallbackActivity
   - Integration tests for OAuth flow
   - UI tests for account management
   - End-to-end sync tests

## Security Considerations

### PKCE Implementation

PKCE (RFC 7636) prevents authorization code interception attacks:

1. **Code Verifier**: Random 43-128 character string
2. **Code Challenge**: SHA-256 hash of code verifier, base64url encoded
3. **Store verifier securely** before starting OAuth flow
4. **Send challenge** in authorization request
5. **Send verifier** in token exchange request

### Token Storage

- Use `EncryptedSharedPreferences` for tokens
- Never log tokens or sensitive data
- Implement token rotation
- Clear tokens on logout

### Network Security

- Enforce HTTPS for all API calls
- Validate SSL certificates
- Use certificate pinning for production (optional)
- Handle network errors gracefully

## Testing OAuth Flow

### Manual Testing Steps

1. Build and install app
2. Navigate to Settings → Sync Settings → "Manage Cloud Accounts"
3. Tap "Add Account" FAB
4. Select "Google Drive"
5. Browser should open with Google OAuth consent screen
6. Sign in and grant permissions
7. Browser redirects back to app
8. Account should appear in list (once token exchange is implemented)

### Debugging

Enable logging to see OAuth flow:

```kotlin
// Set in SafeLog or use adb logcat
adb logcat | grep -E "(OAuth|CloudAccounts|ProviderRegistry)"
```

Look for:
- "OAuth2 flow initiated"
- "Processing OAuth callback with state: ..."
- "Provider kind: GOOGLE_DRIVE"
- "Exchanging authorization code for tokens..."

## Next Steps

1. **Implement Secure PKCE Storage** (Priority: High)
   - Create `EncryptedOAuthStateStorage`
   - Store code_verifier before OAuth flow
   - Retrieve in OAuthCallbackActivity

2. **Complete Token Exchange** (Priority: High)
   - Finish `exchangeCodeForTokens` in `OAuth2GoogleDriveAuthProvider`
   - Parse and validate token response
   - Handle errors (invalid grant, expired code, etc.)

3. **Implement Account Storage** (Priority: High)
   - Create Room database entities
   - Add DAO methods
   - Integrate with CloudAccountsViewModel

4. **Test End-to-End Flow** (Priority: Medium)
   - Manual testing with Google Drive
   - Verify token refresh works
   - Test sync functionality

5. **Add Other Providers** (Priority: Low)
   - Dropbox, OneDrive, WebDAV, Nextcloud
   - Each needs separate OAuth credentials

## Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Android OAuth Best Practices](https://developer.android.com/training/id-auth/authenticate)
- [EncryptedSharedPreferences Guide](https://developer.android.com/topic/security/data)

## Support

For issues or questions:
- Check logs: `adb logcat | grep OAuth`
- Review implementation status above
- Consult provider-specific documentation
- Test with Google OAuth Playground: https://developers.google.com/oauthplayground/

---

**Last Updated**: 2025-11-02
**Implementation Status**: 65% Complete (UI + OAuth Framework Done, Token Exchange Pending)
