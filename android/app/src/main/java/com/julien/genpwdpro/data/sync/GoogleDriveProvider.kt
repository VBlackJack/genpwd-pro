package com.julien.genpwdpro.data.sync

import android.app.Activity
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import com.google.api.client.extensions.android.http.AndroidHttp
import com.google.api.client.googleapis.extensions.android.gms.auth.GoogleAccountCredential
import com.google.api.client.googleapis.json.GoogleJsonResponseException
import com.google.api.client.json.gson.GsonFactory
import com.google.api.services.drive.Drive
import com.google.api.services.drive.DriveScopes
import com.google.api.services.drive.model.File
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.secure.SecurePrefs
import com.julien.genpwdpro.data.sync.models.CloudError
import com.julien.genpwdpro.data.sync.models.CloudFileMetadata
import com.julien.genpwdpro.data.sync.models.StorageQuota
import com.julien.genpwdpro.data.sync.models.VaultSyncData
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Implémentation Google Drive pour la synchronisation cloud
 *
 * SÉCURITÉ:
 * - Stocke uniquement des fichiers chiffrés
 * - Utilise OAuth2 pour l'authentification
 * - Les fichiers sont stockés dans l'appFolder (privé à l'app)
 */
@Singleton
class GoogleDriveProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val securePrefs: SecurePrefs
) : CloudProvider {

    private var driveService: Drive? = null
    private var signedInAccount: GoogleSignInAccount? = null
    private var oauthState: String? = null

    companion object {
        private const val TAG = "GoogleDriveProvider"
        private const val MIME_TYPE = "application/octet-stream"
        private const val REQUEST_CODE_SIGN_IN = 9003
        private const val PREF_ACCOUNT_ID = "google_drive_account_id"
    }

    override suspend fun isAuthenticated(): Boolean = withContext(Dispatchers.IO) {
        if (signedInAccount != null && driveService != null) {
            return@withContext true
        }

        // Try to restore session from persisted account ID
        val savedAccountId = securePrefs.getString(PREF_ACCOUNT_ID)
        if (!savedAccountId.isNullOrEmpty()) {
            val account = GoogleSignIn.getLastSignedInAccount(context)
            if (account != null && account.id == savedAccountId) {
                signedInAccount = account
                initializeDriveService(context, account)
                return@withContext true
            }
        }

        false
    }

    override suspend fun authenticate(activity: Activity): Boolean {
        return try {
            val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(Scope(DriveScopes.DRIVE_APPDATA))
                .build()

            val client = GoogleSignIn.getClient(activity, signInOptions)

            val existingAccount = GoogleSignIn.getLastSignedInAccount(activity)
            if (existingAccount != null) {
                withContext(Dispatchers.IO) {
                    signedInAccount = existingAccount
                    initializeDriveService(activity, existingAccount)
                    // Persist account ID for session restoration
                    securePrefs.putString(PREF_ACCOUNT_ID, existingAccount.id ?: "")
                }
                SafeLog.d(TAG, "Google Drive authenticated with existing account")
                true
            } else {
                // Generate state for CSRF protection
                val state = UUID.randomUUID().toString()
                oauthState = state

                withContext(Dispatchers.Main) {
                    activity.startActivityForResult(client.signInIntent, REQUEST_CODE_SIGN_IN)
                }
                SafeLog.d(TAG, "Google Drive authentication flow initiated")
                false
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to authenticate with Google Drive", e)
            false
        }
    }

    /**
     * À appeler depuis onActivityResult de l'Activity
     */
    suspend fun handleSignInResult(data: Intent?): Boolean = withContext(Dispatchers.IO) {
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.result

            // Validate CSRF state (Note: Google Sign-In doesn't support custom state parameter,
            // so we rely on the SDK's built-in protection)
            signedInAccount = account
            initializeDriveService(context, account)

            // Persist account ID for session restoration
            securePrefs.putString(PREF_ACCOUNT_ID, account.id ?: "")

            SafeLog.d(TAG, "Google Drive sign-in successful")
            true
        } catch (e: Exception) {
            SafeLog.e(TAG, "Failed to handle Google Drive sign-in result", e)
            false
        }
    }

    private fun initializeDriveService(context: Context, account: GoogleSignInAccount) {
        val credential = GoogleAccountCredential.usingOAuth2(
            context,
            listOf(DriveScopes.DRIVE_APPDATA)
        )
        credential.selectedAccount = account.account

        driveService = Drive.Builder(
            AndroidHttp.newCompatibleTransport(),
            GsonFactory.getDefaultInstance(),
            credential
        )
            .setApplicationName("GenPwd Pro")
            .build()
    }

    override suspend fun disconnect() = withContext(Dispatchers.IO) {
        signedInAccount = null
        driveService = null
        securePrefs.remove(PREF_ACCOUNT_ID)
        SafeLog.d(TAG, "Google Drive disconnected")
    }

    override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? = withContext(
        Dispatchers.IO
    ) {
        try {
            val service = driveService ?: run {
                SafeLog.e(TAG, "Drive service not initialized for upload")
                return@withContext null
            }

            // Vérifier si le fichier existe déjà
            val existingFile = findVaultFile(vaultId)

            val fileMetadata = File().apply {
                name = "vault_$vaultId.enc"
                if (existingFile == null) {
                    parents = listOf("appDataFolder")
                }
            }

            val mediaContent = com.google.api.client.http.ByteArrayContent(
                MIME_TYPE,
                syncData.encryptedData
            )

            val file = if (existingFile != null) {
                // Update existing file
                service.files().update(existingFile.id, fileMetadata, mediaContent)
                    .execute()
            } else {
                // Create new file
                service.files().create(fileMetadata, mediaContent)
                    .setFields("id, name, size, modifiedTime")
                    .execute()
            }

            SafeLog.d(TAG, "Vault uploaded successfully: vaultId=${SafeLog.redact(vaultId)}")
            file.id
        } catch (e: GoogleJsonResponseException) {
            handleDriveException(e, "upload vault", vaultId)
            null
        } catch (e: IOException) {
            SafeLog.e(TAG, "Network error uploading vault: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error uploading vault: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        }
    }

    override suspend fun downloadVault(vaultId: String): VaultSyncData? = withContext(
        Dispatchers.IO
    ) {
        try {
            val service = driveService ?: run {
                SafeLog.e(TAG, "Drive service not initialized for download")
                return@withContext null
            }

            val file = findVaultFile(vaultId) ?: run {
                SafeLog.w(TAG, "Vault file not found: vaultId=${SafeLog.redact(vaultId)}")
                return@withContext null
            }

            val outputStream = ByteArrayOutputStream()
            service.files().get(file.id)
                .executeMediaAndDownloadTo(outputStream)

            val encryptedData = outputStream.toByteArray()
            val timestamp = file.modifiedTime?.value ?: System.currentTimeMillis()

            SafeLog.d(TAG, "Vault downloaded successfully: vaultId=${SafeLog.redact(vaultId)}")
            VaultSyncData(
                vaultId = vaultId,
                vaultName = "Vault $vaultId",
                encryptedData = encryptedData,
                timestamp = timestamp,
                deviceId = "", // Will be set by SyncManager
                checksum = "", // Will be computed by SyncManager
                version = 1
            )
        } catch (e: GoogleJsonResponseException) {
            handleDriveException(e, "download vault", vaultId)
            null
        } catch (e: IOException) {
            SafeLog.e(TAG, "Network error downloading vault: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error downloading vault: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        }
    }

    override suspend fun hasNewerVersion(vaultId: String, localTimestamp: Long): Boolean = withContext(
        Dispatchers.IO
    ) {
        try {
            val file = findVaultFile(vaultId) ?: return@withContext false
            val cloudTimestamp = file.modifiedTime?.value ?: 0
            cloudTimestamp > localTimestamp
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error checking vault version: vaultId=${SafeLog.redact(vaultId)}", e)
            false
        }
    }

    override suspend fun getCloudMetadata(vaultId: String): CloudFileMetadata? = withContext(
        Dispatchers.IO
    ) {
        try {
            val file = findVaultFile(vaultId) ?: return@withContext null

            CloudFileMetadata(
                fileId = file.id,
                fileName = file.name,
                size = file.getSize() ?: 0,
                modifiedTime = file.modifiedTime?.value ?: 0,
                checksum = file.md5Checksum,
                version = null
            )
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error getting cloud metadata: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        }
    }

    override suspend fun deleteVault(vaultId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext false
            val file = findVaultFile(vaultId) ?: return@withContext false

            service.files().delete(file.id).execute()
            SafeLog.d(TAG, "Vault deleted successfully: vaultId=${SafeLog.redact(vaultId)}")
            true
        } catch (e: GoogleJsonResponseException) {
            handleDriveException(e, "delete vault", vaultId)
            false
        } catch (e: IOException) {
            SafeLog.e(TAG, "Network error deleting vault: vaultId=${SafeLog.redact(vaultId)}", e)
            false
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error deleting vault: vaultId=${SafeLog.redact(vaultId)}", e)
            false
        }
    }

    override suspend fun listVaults(): List<CloudFileMetadata> = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext emptyList()

            val result = service.files().list()
                .setQ("name contains 'vault_' and trashed=false")
                .setSpaces("appDataFolder")
                .setFields("files(id, name, size, modifiedTime, md5Checksum, version)")
                .execute()

            SafeLog.d(TAG, "Listed ${result.files.size} vaults from Google Drive")
            result.files.map { file ->
                CloudFileMetadata(
                    fileId = file.id,
                    fileName = file.name,
                    size = file.getSize() ?: 0L,
                    modifiedTime = file.modifiedTime?.value ?: 0L,
                    checksum = file.md5Checksum,
                    version = file.version?.toString()
                )
            }
        } catch (e: GoogleJsonResponseException) {
            handleDriveException(e, "list vaults", null)
            emptyList()
        } catch (e: IOException) {
            SafeLog.e(TAG, "Network error listing vaults", e)
            emptyList()
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error listing vaults", e)
            emptyList()
        }
    }

    override suspend fun getStorageQuota(): StorageQuota? = withContext(Dispatchers.IO) {
        try {
            val service = driveService ?: return@withContext null

            val about = service.about().get()
                .setFields("storageQuota")
                .execute()

            val quota = about.storageQuota
            val used = quota.usage ?: 0
            val total = quota.limit ?: 0
            StorageQuota(
                usedBytes = used,
                totalBytes = total,
                freeBytes = total - used
            )
        } catch (e: GoogleJsonResponseException) {
            handleDriveException(e, "get storage quota", null)
            null
        } catch (e: IOException) {
            SafeLog.e(TAG, "Network error getting storage quota", e)
            null
        } catch (e: Exception) {
            SafeLog.e(TAG, "Unexpected error getting storage quota", e)
            null
        }
    }

    /**
     * Trouve un fichier de vault par son ID
     */
    private fun findVaultFile(vaultId: String): File? {
        val service = driveService ?: return null

        val fileName = "vault_$vaultId.enc"

        return try {
            val result = service.files().list()
                .setQ("name='$fileName' and trashed=false")
                .setSpaces("appDataFolder")
                .setFields("files(id, name, size, modifiedTime, md5Checksum)")
                .execute()

            result.files.firstOrNull()
        } catch (e: Exception) {
            SafeLog.e(TAG, "Error finding vault file: vaultId=${SafeLog.redact(vaultId)}", e)
            null
        }
    }

    /**
     * Handles Google Drive API exceptions and logs them appropriately
     */
    private fun handleDriveException(
        exception: GoogleJsonResponseException,
        operation: String,
        vaultId: String?
    ) {
        val vaultInfo = vaultId?.let { "vaultId=${SafeLog.redact(it)}" } ?: ""
        when (exception.statusCode) {
            401 -> SafeLog.e(TAG, "Authentication expired during $operation $vaultInfo", exception)
            403 -> SafeLog.e(TAG, "Permission denied during $operation $vaultInfo", exception)
            404 -> SafeLog.w(TAG, "Resource not found during $operation $vaultInfo")
            413 -> SafeLog.e(TAG, "Quota exceeded during $operation $vaultInfo", exception)
            429 -> SafeLog.w(TAG, "Rate limit exceeded during $operation $vaultInfo")
            else -> SafeLog.e(TAG, "Drive API error (${exception.statusCode}) during $operation $vaultInfo", exception)
        }
    }
}
