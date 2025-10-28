# 📖 Guide d'Implémentation des Cloud Providers

Ce guide détaille les étapes pour implémenter complètement chaque cloud provider.

## 🎯 État Actuel

| Provider | Template | Production Ready | OAuth2 | Prérequis |
|----------|----------|------------------|--------|-----------|
| **Google Drive** | ✅ | ✅ | ✅ | Google Cloud Console |
| **OneDrive** | ✅ | ⚠️ Template | 🔜 | Azure Portal + MSAL |
| **WebDAV** | ✅ | ⚠️ Template | N/A | OkHttp (ajouté) |
| **pCloud** | ✅ | ⚠️ Template | 🔜 | pCloud App Key |
| **ProtonDrive** | ✅ | ⚠️ Template | 🔜 | Proton Developer |

---

## 🌐 WebDAV Provider

**Fichier**: `WebDAVProvider.kt`
**Complexité**: ⭐⭐☆☆☆ (Facile)
**Temps estimé**: 2-3 heures

### Prérequis
- ✅ Dépendances OkHttp déjà ajoutées dans `build.gradle.kts`
- ✅ Template complet avec structure HTTP
- ✅ Support Basic Auth

### Étapes d'Implémentation

#### 1. Implémenter `createHttpClient()`

```kotlin
private fun createHttpClient(): OkHttpClient {
    val builder = OkHttpClient.Builder()
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)

    // Basic Authentication
    builder.addInterceptor { chain ->
        val credentials = "$username:$password"
        val auth = "Basic " + Base64.getEncoder().encodeToString(credentials.toByteArray())

        val request = chain.request().newBuilder()
            .header("Authorization", auth)
            .build()

        chain.proceed(request)
    }

    // Logging (debug only)
    if (BuildConfig.DEBUG) {
        val logging = HttpLoggingInterceptor()
        logging.level = HttpLoggingInterceptor.Level.HEADERS
        builder.addInterceptor(logging)
    }

    // SSL Configuration
    if (!validateSSL) {
        // Trust all certificates (self-signed)
        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })

        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustAllCerts, SecureRandom())

        builder.sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
        builder.hostnameVerifier { _, _ -> true }
    }

    return builder.build()
}
```

#### 2. Implémenter `isAuthenticated()`

```kotlin
override suspend fun isAuthenticated(): Boolean = withContext(Dispatchers.IO) {
    try {
        val testUrl = serverUrl.trimEnd('/') + "/"
        val request = Request.Builder()
            .url(testUrl)
            .method("PROPFIND", null)
            .header("Depth", "0")
            .build()

        httpClient.newCall(request).execute().use { response ->
            response.isSuccessful && (response.code == 207 || response.code == 200)
        }
    } catch (e: Exception) {
        Log.e(TAG, "Error checking authentication", e)
        false
    }
}
```

#### 3. Implémenter `uploadVault()`

```kotlin
override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? = withContext(Dispatchers.IO) {
    try {
        val fileName = "vault_${vaultId}.enc"
        val folderPath = ensureFolderExists()
        val fileUrl = "$folderPath/$fileName"

        // PUT request
        val requestBody = syncData.encryptedData.toRequestBody("application/octet-stream".toMediaType())

        val request = Request.Builder()
            .url(fileUrl)
            .put(requestBody)
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (response.isSuccessful) fileName else null
        }
    } catch (e: Exception) {
        Log.e(TAG, "Error uploading vault", e)
        null
    }
}
```

#### 4. Implémenter `downloadVault()`

```kotlin
override suspend fun downloadVault(vaultId: String): VaultSyncData? = withContext(Dispatchers.IO) {
    try {
        val fileName = "vault_${vaultId}.enc"
        val fileUrl = "$serverUrl/$FOLDER_NAME/$fileName"

        val request = Request.Builder()
            .url(fileUrl)
            .get()
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (response.isSuccessful) {
                val data = response.body?.bytes() ?: return@withContext null
                // Parse VaultSyncData from bytes
                parseVaultSyncData(data)
            } else {
                null
            }
        }
    } catch (e: Exception) {
        Log.e(TAG, "Error downloading vault", e)
        null
    }
}
```

#### 5. Implémenter `ensureFolderExists()`

```kotlin
private suspend fun ensureFolderExists(): String = withContext(Dispatchers.IO) {
    val folderUrl = "$serverUrl/$FOLDER_NAME"

    // Check if folder exists with PROPFIND
    val checkRequest = Request.Builder()
        .url(folderUrl)
        .method("PROPFIND", null)
        .header("Depth", "0")
        .build()

    httpClient.newCall(checkRequest).execute().use { response ->
        if (!response.isSuccessful) {
            // Create folder with MKCOL
            val createRequest = Request.Builder()
                .url(folderUrl)
                .method("MKCOL", null)
                .build()

            httpClient.newCall(createRequest).execute()
        }
    }

    folderUrl
}
```

### Test

```kotlin
// Test avec Nextcloud local
val provider = WebDAVProvider(
    serverUrl = "https://cloud.local/remote.php/dav/files/username/",
    username = "testuser",
    password = "apppassword",
    validateSSL = false // Pour dev/test uniquement
)

val isAuth = provider.isAuthenticated()
println("WebDAV authenticated: $isAuth")
```

---

## 📦 pCloud Provider

**Fichier**: `PCloudProvider.kt`
**Complexité**: ⭐⭐⭐☆☆ (Moyen)
**Temps estimé**: 4-6 heures

### Prérequis
- ✅ Dépendances Retrofit déjà ajoutées
- ✅ Template complet avec API structure
- 🔑 Compte pCloud Developer: https://docs.pcloud.com/

### Configuration pCloud

1. **Créer une app**:
   - Aller sur https://docs.pcloud.com/
   - S'inscrire comme développeur
   - Créer une nouvelle app

2. **Récupérer les credentials**:
   ```kotlin
   companion object {
       private const val APP_KEY = "YOUR_PCLOUD_APP_KEY"
       private const val OAUTH_REDIRECT = "genpwdpro://oauth/pcloud"
       private const val API_BASE_EU = "https://api.pcloud.com"
       private const val API_BASE_US = "https://eapi.pcloud.com"
   }
   ```

3. **Configurer OAuth2 redirect URI** dans le dashboard pCloud

### API Reference

pCloud utilise un système simple de requêtes REST:

```
GET /oauth2/authorize?client_id={APP_KEY}&response_type=token
GET /listfolder?folderid={id}&access_token={token}
POST /uploadfile?folderid={id}&filename={name}&access_token={token}
GET /downloadfile?fileid={id}&access_token={token}
```

### Étapes d'Implémentation

#### 1. Créer l'interface Retrofit

```kotlin
interface PCloudApi {
    @GET("listfolder")
    suspend fun listFolder(
        @Query("folderid") folderId: Long,
        @Query("access_token") token: String
    ): Response<PCloudFolderResponse>

    @Multipart
    @POST("uploadfile")
    suspend fun uploadFile(
        @Query("folderid") folderId: Long,
        @Query("filename") filename: String,
        @Query("access_token") token: String,
        @Part file: MultipartBody.Part
    ): Response<PCloudUploadResponse>

    @GET("downloadfile")
    suspend fun downloadFile(
        @Query("fileid") fileId: Long,
        @Query("access_token") token: String
    ): Response<ResponseBody>
}
```

#### 2. Implémenter OAuth2

```kotlin
override suspend fun authenticate(activity: Activity): Boolean = withContext(Dispatchers.Main) {
    try {
        val authUrl = "https://my.pcloud.com/oauth2/authorize?" +
            "client_id=$APP_KEY&" +
            "response_type=token&" +
            "redirect_uri=$OAUTH_REDIRECT"

        // Lancer browser pour OAuth
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(authUrl))
        activity.startActivity(intent)

        // TODO: Capturer le redirect avec token
        // Utiliser un DeepLink receiver

        true
    } catch (e: Exception) {
        Log.e(TAG, "OAuth failed", e)
        false
    }
}
```

#### 3. Implémenter upload/download

Les méthodes similaires à WebDAV mais avec Retrofit:

```kotlin
override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? = withContext(Dispatchers.IO) {
    try {
        val fileName = "vault_${vaultId}.enc"
        val requestFile = syncData.encryptedData.toRequestBody("application/octet-stream".toMediaType())
        val body = MultipartBody.Part.createFormData("file", fileName, requestFile)

        val response = pCloudApi.uploadFile(
            folderId = getAppFolderId(),
            filename = fileName,
            token = accessToken,
            file = body
        )

        if (response.isSuccessful) fileName else null
    } catch (e: Exception) {
        Log.e(TAG, "Upload failed", e)
        null
    }
}
```

---

## 🔐 ProtonDrive Provider

**Fichier**: `ProtonDriveProvider.kt`
**Complexité**: ⭐⭐⭐⭐☆ (Difficile)
**Temps estimé**: 8-12 heures

### Prérequis
- ✅ Dépendances Retrofit déjà ajoutées
- ✅ Template complet
- 🔑 Compte Proton Developer (bêta)
- 📖 Documentation: https://proton.me/support/proton-drive-developers

### Configuration Proton

1. **Créer une app** (beta access requis):
   - Contacter Proton pour accès développeur
   - Créer app sur developer portal
   - Récupérer Client ID et Secret

2. **Scopes requis**:
   ```kotlin
   private val SCOPES = listOf(
       "drive.read",
       "drive.write",
       "drive.appfolder"
   )
   ```

### Spécificités Proton

**Double Encryption**:
- Proton chiffre déjà côté serveur (AES-256)
- Nos données sont pré-chiffrées (AES-256-GCM)
- = Double couche de sécurité

**Zero-Knowledge Architecture**:
- Proton ne peut PAS déchiffrer les données
- Toutes les clés sont dérivées du mot de passe utilisateur
- Compatible avec notre architecture end-to-end

### API Reference

```
POST /oauth/token - Obtenir access token
GET /drive/v1/shares - Lister shares
POST /drive/v1/shares/{shareId}/folders - Créer folder
POST /drive/v1/shares/{shareId}/files - Upload file
GET /drive/v1/shares/{shareId}/files/{fileId} - Download file
```

### Étapes d'Implémentation

Similaire à pCloud mais avec:
- OAuth2 plus complexe (PKCE required)
- Gestion des "shares" (espaces de stockage)
- Chunked uploads pour gros fichiers
- Métadonnées chiffrées côté Proton

---

## 🔷 OneDrive Provider

**Fichier**: `OneDriveProvider.kt`
**Complexité**: ⭐⭐⭐⭐⭐ (Très Difficile)
**Temps estimé**: 12-16 heures

### Prérequis
- 🔜 Dépendances MSAL (commentées dans build.gradle)
- ✅ Template complet
- 🔑 Azure Portal Account
- 📖 Microsoft Graph SDK

### Configuration Azure

1. **Créer une app**:
   - Azure Portal: https://portal.azure.com
   - Azure Active Directory → App registrations → New
   - Platform: Mobile and desktop applications
   - Redirect URI: `msauth://com.julien.genpwdpro/auth`

2. **Permissions**:
   - Files.ReadWrite.AppFolder
   - User.Read

3. **Récupérer**:
   - Application (client) ID
   - Directory (tenant) ID

### Décommenter les dépendances

```kotlin
// Dans build.gradle.kts, décommenter:
implementation("com.microsoft.graph:microsoft-graph:5.+")
implementation("com.microsoft.identity.client:msal:4.+")
```

### Créer msal_config.json

```json
{
  "client_id": "YOUR_CLIENT_ID",
  "authorization_user_agent": "DEFAULT",
  "redirect_uri": "msauth://com.julien.genpwdpro/auth",
  "account_mode": "SINGLE",
  "broker_redirect_uri_registered": false,
  "authorities": [
    {
      "type": "AAD",
      "audience": {
        "type": "AzureADandPersonalMicrosoftAccount"
      }
    }
  ]
}
```

### Étapes d'Implémentation

#### 1. Initialiser MSAL

```kotlin
private lateinit var msalClient: ISingleAccountPublicClientApplication

private suspend fun initializeMSAL(context: Context) {
    msalClient = PublicClientApplication.createSingleAccountPublicClientApplication(
        context,
        R.raw.msal_config
    )
}
```

#### 2. Impl émenter OAuth2

```kotlin
override suspend fun authenticate(activity: Activity): Boolean = withContext(Dispatchers.Main) {
    val params = AcquireTokenParameters.Builder()
        .startAuthorizationFromActivity(activity)
        .withScopes(SCOPES.toList())
        .withCallback(object : AuthenticationCallback {
            override fun onSuccess(result: IAuthenticationResult) {
                // Setup Graph client
                accessToken = result.accessToken
                setupGraphClient(accessToken)
            }
            // ...
        })
        .build()

    msalClient.acquireToken(params)
    true
}
```

#### 3. Setup Graph Client

```kotlin
private fun setupGraphClient(token: String) {
    val authProvider = IAuthenticationProvider { request ->
        request.addHeader("Authorization", "Bearer $token")
    }

    graphClient = GraphServiceClient.builder()
        .authenticationProvider(authProvider)
        .buildClient()
}
```

#### 4. Utiliser Microsoft Graph API

```kotlin
override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? {
    val fileName = "vault_${vaultId}.enc"

    val uploadSession = graphClient
        .drive()
        .special("approot")
        .itemWithPath(fileName)
        .createUploadSession(DriveItemUploadableProperties())
        .buildRequest()
        .post()

    // Chunked upload...
    return fileName
}
```

---

## 🧪 Tests

### Test WebDAV avec Nextcloud Docker

```bash
# Lancer Nextcloud en local
docker run -d -p 8080:80 nextcloud

# Tester avec curl
curl -u admin:password -X PROPFIND http://localhost:8080/remote.php/dav/files/admin/
```

### Test pCloud

Utiliser l'API sandbox de pCloud avec un compte développeur gratuit.

### Test ProtonDrive

Nécessite compte Proton payant + accès beta développeur.

### Test OneDrive

Utiliser compte Microsoft gratuit + Azure subscription (free tier).

---

## 📝 Checklist Finale

Avant de marquer un provider comme "Production Ready":

- [ ] Toutes les méthodes implémentées (pas de TODO)
- [ ] OAuth2 flow complet et testé
- [ ] Upload/Download fonctionnels
- [ ] Gestion d'erreurs robuste
- [ ] Tests unitaires avec MockK
- [ ] Tests manuels avec vrai compte
- [ ] Documentation à jour
- [ ] Gestion quota storage
- [ ] Logs et debugging
- [ ] ProGuard rules si nécessaire

---

## 🎯 Priorité d'Implémentation Recommandée

1. **WebDAV** (⭐⭐☆☆☆) - Le plus simple, self-hosted, utile immédiatement
2. **pCloud** (⭐⭐⭐☆☆) - REST API simple, 10GB gratuit
3. **ProtonDrive** (⭐⭐⭐⭐☆) - Excellent pour privacy, mais API beta
4. **OneDrive** (⭐⭐⭐⭐⭐) - Complexe avec MSAL, mais très utilisé

---

## 📚 Ressources

### Documentation Officielle
- **WebDAV**: https://tools.ietf.org/html/rfc4918
- **pCloud**: https://docs.pcloud.com/
- **ProtonDrive**: https://proton.me/support/proton-drive-developers
- **OneDrive**: https://docs.microsoft.com/en-us/onedrive/developer/rest-api/
- **Microsoft Graph**: https://docs.microsoft.com/en-us/graph/overview

### Librairies
- **OkHttp**: https://square.github.io/okhttp/
- **Retrofit**: https://square.github.io/retrofit/
- **MSAL Android**: https://github.com/AzureAD/microsoft-authentication-library-for-android

---

**Bonne implémentation! 🚀**

🤖 Guide généré avec [Claude Code](https://claude.com/claude-code)
