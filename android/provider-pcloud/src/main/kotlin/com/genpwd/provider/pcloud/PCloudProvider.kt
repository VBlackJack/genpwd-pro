package com.genpwd.provider.pcloud

import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.VaultId
import com.genpwd.corevault.VaultMeta
import com.genpwd.providers.api.ByteArrayWithEtag
import com.genpwd.providers.api.CloudProvider
import com.genpwd.providers.api.ProviderAccount
import com.genpwd.providers.api.ProviderChanges
import com.genpwd.providers.api.ProviderError
import com.genpwd.providers.api.ProviderHealth
import com.genpwd.providers.api.ProviderWriteResult
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import javax.inject.Named

/**
 * Provider pCloud pour GenPwd Pro
 *
 * Documentation API: https://docs.pcloud.com/
 *
 * Fonctionnalités:
 * - Authentification OAuth2
 * - Stockage dans le dossier d'application pCloud
 * - Synchronisation des fichiers .gpv
 * - Détection des changements
 */

private const val PCLOUD_API_BASE = "https://api.pcloud.com"
private const val PCLOUD_EU_API_BASE = "https://eapi.pcloud.com"
private const val APP_FOLDER_NAME = "GenPwdPro"

@Singleton
class PCloudProvider @Inject constructor(
    private val json: Json,
    @Named("pcloud") private val client: OkHttpClient,
    private val authProvider: PCloudAuthProvider,
) : CloudProvider {
    private val health = MutableStateFlow(ProviderHealth(ProviderHealth.Status.OK))

    override val kind: ProviderKind = ProviderKind.PCLOUD

    override suspend fun authenticate(): ProviderAccount = authProvider.authenticate()

    override suspend fun listVaults(account: ProviderAccount): List<VaultMeta> {
        // Créer le dossier de l'app s'il n'existe pas
        val folderId = ensureAppFolder(account)

        // Lister les fichiers dans le dossier
        val url = "${getApiBase(account)}/listfolder"
        val formBody = FormBody.Builder()
            .add("access_token", account.accessToken)
            .add("folderid", folderId.toString())
            .build()

        val request = Request.Builder()
            .url(url)
            .post(formBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(ListFolderResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud error: ${parsed.error}")
            }

            return parsed.metadata.contents?.filter {
                it.isfolder == false && it.name.endsWith(".gpv")
            }?.map {
                it.toMeta(account.id, folderId.toString())
            } ?: emptyList()
        }
    }

    override suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag {
        val url = "${getApiBase(account)}/downloadfile"
        val formBody = FormBody.Builder()
            .add("access_token", account.accessToken)
            .add("fileid", id.remotePath)
            .build()

        val request = Request.Builder()
            .url(url)
            .post(formBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val bytes = response.body?.bytes() ?: ByteArray(0)

            // pCloud n'utilise pas ETag, on utilise le hash comme équivalent
            val etag = response.header("X-File-Hash") ?: id.remotePath

            return ByteArrayWithEtag(bytes, etag)
        }
    }

    override suspend fun upload(
        account: ProviderAccount,
        id: VaultId,
        data: ByteArray,
        ifMatchEtag: String?,
    ): ProviderWriteResult {
        val folderId = ensureAppFolder(account)

        // Extraire le nom du fichier de l'ID ou utiliser un nom par défaut
        val fileName = id.remotePath.substringAfterLast("/")

        val url = "${getApiBase(account)}/uploadfile"

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("access_token", account.accessToken)
            .addFormDataPart("folderid", folderId.toString())
            .addFormDataPart("filename", fileName)
            .addFormDataPart(
                "file",
                fileName,
                data.toRequestBody("application/octet-stream".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(UploadResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud upload error: ${parsed.error}")
            }

            val metadata = parsed.metadata.firstOrNull()
                ?: throw ProviderError.Network("No metadata in upload response")

            return ProviderWriteResult(
                newEtag = metadata.hash.toString(),
                modifiedUtc = Instant.ofEpochMilli(metadata.modified * 1000).epochSecond
            )
        }
    }

    override suspend fun createVault(account: ProviderAccount, name: String): VaultMeta {
        val folderId = ensureAppFolder(account)

        // Créer un fichier vide
        val fileName = if (name.endsWith(".gpv")) name else "$name.gpv"
        val emptyData = ByteArray(0)

        val url = "${getApiBase(account)}/uploadfile"

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("access_token", account.accessToken)
            .addFormDataPart("folderid", folderId.toString())
            .addFormDataPart("filename", fileName)
            .addFormDataPart(
                "file",
                fileName,
                emptyData.toRequestBody("application/octet-stream".toMediaType())
            )
            .build()

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(UploadResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud create error: ${parsed.error}")
            }

            val metadata = parsed.metadata.firstOrNull()
                ?: throw ProviderError.Network("No metadata in create response")

            return metadata.toMeta(account.id, folderId.toString())
        }
    }

    override suspend fun deleteVault(account: ProviderAccount, id: VaultId) {
        val url = "${getApiBase(account)}/deletefile"
        val formBody = FormBody.Builder()
            .add("access_token", account.accessToken)
            .add("fileid", id.remotePath)
            .build()

        val request = Request.Builder()
            .url(url)
            .post(formBody)
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(GenericResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud delete error: ${parsed.error}")
            }
        }
    }

    override suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges? {
        // pCloud ne supporte pas nativement le delta, on fait une liste complète
        // et on compare avec le cursor précédent
        val vaults = listVaults(account)

        // Pour un vrai support de delta, il faudrait stocker localement
        // l'état précédent et comparer
        return ProviderChanges(
            cursor = System.currentTimeMillis().toString(),
            updatedVaults = vaults,
            deletedVaultIds = emptyList()
        )
    }

    override fun observeHealth(account: ProviderAccount): Flow<ProviderHealth> = health.asStateFlow()

    /**
     * Assure que le dossier de l'application existe et retourne son ID
     */
    private suspend fun ensureAppFolder(account: ProviderAccount): Long {
        // Rechercher le dossier
        val listUrl = "${getApiBase(account)}/listfolder"
        val listFormBody = FormBody.Builder()
            .add("access_token", account.accessToken)
            .add("folderid", "0") // Root
            .build()

        val listRequest = Request.Builder()
            .url(listUrl)
            .post(listFormBody)
            .build()

        client.newCall(listRequest).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(ListFolderResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud error: ${parsed.error}")
            }

            // Chercher le dossier de l'app
            val appFolder = parsed.metadata.contents?.find {
                it.isfolder == true && it.name == APP_FOLDER_NAME
            }

            if (appFolder != null) {
                return appFolder.folderid ?: 0
            }
        }

        // Créer le dossier s'il n'existe pas
        val createUrl = "${getApiBase(account)}/createfolder"
        val createFormBody = FormBody.Builder()
            .add("access_token", account.accessToken)
            .add("folderid", "0")
            .add("name", APP_FOLDER_NAME)
            .build()

        val createRequest = Request.Builder()
            .url(createUrl)
            .post(createFormBody)
            .build()

        client.newCall(createRequest).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(CreateFolderResponse.serializer(), payload)

            if (parsed.result != 0) {
                throw ProviderError.Network("pCloud create folder error: ${parsed.error}")
            }

            return parsed.metadata.folderid ?: 0
        }
    }

    /**
     * Obtient l'URL de l'API selon la région du compte
     */
    private fun getApiBase(account: ProviderAccount): String {
        // Utiliser les métadonnées du compte pour déterminer la région
        // Par défaut, utiliser l'API US
        return if (account.metadata?.get("region") == "eu") {
            PCLOUD_EU_API_BASE
        } else {
            PCLOUD_API_BASE
        }
    }

    private fun okhttp3.Response.toProviderError(): ProviderError = when (code) {
        401, 403 -> ProviderError.Authentication("Authentication failed: $code")
        429 -> ProviderError.RateLimited(header("Retry-After")?.toLongOrNull(), null)
        else -> ProviderError.Network("HTTP $code")
    }
}

/**
 * Réponses de l'API pCloud
 */
@Serializable
private data class GenericResponse(
    val result: Int,
    val error: String? = null
)

@Serializable
private data class ListFolderResponse(
    val result: Int,
    val metadata: FolderMetadata,
    val error: String? = null
)

@Serializable
private data class FolderMetadata(
    val folderid: Long? = null,
    val name: String,
    val contents: List<FileMetadata>? = null
)

@Serializable
private data class FileMetadata(
    val fileid: Long? = null,
    val folderid: Long? = null,
    val name: String,
    val isfolder: Boolean = false,
    val modified: Long = 0,
    val size: Long = 0,
    val hash: Long? = null
) {
    fun toMeta(accountId: String, parentFolderId: String): VaultMeta {
        val id = fileid?.toString() ?: name
        return VaultMeta(
            id = VaultId(remotePath = id, provider = ProviderKind.PCLOUD, accountId = accountId),
            name = name,
            version = modified,
            lastModifiedUtc = Instant.ofEpochMilli(modified * 1000).epochSecond,
            size = size,
            remoteEtag = hash?.toString()
        )
    }
}

@Serializable
private data class UploadResponse(
    val result: Int,
    val metadata: List<FileMetadata> = emptyList(),
    val error: String? = null
)

@Serializable
private data class CreateFolderResponse(
    val result: Int,
    val metadata: FolderMetadata,
    val error: String? = null
)

/**
 * Interface pour l'authentification pCloud
 */
interface PCloudAuthProvider {
    suspend fun authenticate(): ProviderAccount
}
