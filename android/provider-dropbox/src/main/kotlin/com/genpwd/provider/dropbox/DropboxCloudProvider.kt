package com.genpwd.provider.dropbox

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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import javax.inject.Named

private const val API_BASE = "https://api.dropboxapi.com/2"
private const val CONTENT_BASE = "https://content.dropboxapi.com/2"
private val MEDIA_TYPE_JSON = "application/json".toMediaType()
private val MEDIA_TYPE_BINARY = "application/octet-stream".toMediaType()

@Singleton
class DropboxCloudProvider @Inject constructor(
    private val json: Json,
    @Named("dropbox") private val client: OkHttpClient,
    private val authProvider: DropboxAuthProvider,
) : CloudProvider {
    private val health = MutableStateFlow(ProviderHealth(ProviderHealth.Status.OK))

    override val kind: ProviderKind = ProviderKind.DROPBOX

    override suspend fun authenticate(): ProviderAccount = authProvider.authenticate()

    override suspend fun listVaults(account: ProviderAccount): List<VaultMeta> {
        val body = json.encodeToString(ListFolderRequest.serializer(), ListFolderRequest(path = FOLDER_PATH))
            .toRequestBody(MEDIA_TYPE_JSON)
        val request = Request.Builder()
            .url("$API_BASE/files/list_folder")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(ListFolderResponse.serializer(), payload)
            return parsed.entries.filter { it.tag == "file" }.map { it.toMeta(account.id) }
        }
    }

    override suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag {
        val request = Request.Builder()
            .url("$CONTENT_BASE/files/download")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Dropbox-API-Arg", json.encodeToString(mapOf("path" to id.remotePath)))
            .post(ByteArray(0).toRequestBody(null))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val body = response.body?.bytes() ?: ByteArray(0)
            val metadataHeader = response.header("Dropbox-API-Result")
            val metadata = metadataHeader?.let { json.decodeFromString(FileMetadata.serializer(), it) }
            return ByteArrayWithEtag(body, metadata?.rev)
        }
    }

    override suspend fun upload(
        account: ProviderAccount,
        id: VaultId,
        data: ByteArray,
        ifMatchEtag: String?,
    ): ProviderWriteResult {
        val mode = if (ifMatchEtag != null) Mode(tag = "update", update = ifMatchEtag) else Mode(tag = "add")
        val apiArg = UploadArg(path = id.remotePath, mode = mode)
        val request = Request.Builder()
            .url("$CONTENT_BASE/files/upload")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Dropbox-API-Arg", json.encodeToString(UploadArg.serializer(), apiArg))
            .addHeader("Content-Type", MEDIA_TYPE_BINARY.toString())
            .post(data.toRequestBody(MEDIA_TYPE_BINARY))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val meta = json.decodeFromString(FileMetadata.serializer(), payload)
            return ProviderWriteResult(newEtag = meta.rev, modifiedUtc = Instant.parse(meta.serverModified).epochSecond)
        }
    }

    override suspend fun createVault(account: ProviderAccount, name: String): VaultMeta {
        val path = "$FOLDER_PATH/$name"
        val request = Request.Builder()
            .url("$CONTENT_BASE/files/upload")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader(
                "Dropbox-API-Arg",
                json.encodeToString(UploadArg.serializer(), UploadArg(path = path, mode = Mode(tag = "add"))),
            )
            .addHeader("Content-Type", MEDIA_TYPE_BINARY.toString())
            .post(ByteArray(0).toRequestBody(MEDIA_TYPE_BINARY))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val meta = json.decodeFromString(FileMetadata.serializer(), payload)
            return meta.toMeta(account.id)
        }
    }

    override suspend fun deleteVault(account: ProviderAccount, id: VaultId) {
        val body = json.encodeToString(DeleteArg.serializer(), DeleteArg(path = id.remotePath)).toRequestBody(MEDIA_TYPE_JSON)
        val request = Request.Builder()
            .url("$API_BASE/files/delete_v2")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
        }
    }

    override suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges? {
        val url = if (cursor == null) "$API_BASE/files/list_folder" else "$API_BASE/files/list_folder/continue"
        val body = if (cursor == null) {
            json.encodeToString(ListFolderRequest.serializer(), ListFolderRequest(path = FOLDER_PATH)).toRequestBody(MEDIA_TYPE_JSON)
        } else {
            json.encodeToString(CursorArg.serializer(), CursorArg(cursor = cursor)).toRequestBody(MEDIA_TYPE_JSON)
        }
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(ListFolderResponse.serializer(), payload)
            val metas = parsed.entries.filter { it.tag == "file" }.map { it.toMeta(account.id) }
            val deletions = parsed.entries.filter { it.tag == "deleted" }.map { entry ->
                VaultId(remotePath = entry.pathLower ?: "", provider = kind, accountId = account.id)
            }
            return ProviderChanges(cursor = parsed.cursor, updatedVaults = metas, deletedVaultIds = deletions)
        }
    }

    override fun observeHealth(account: ProviderAccount): Flow<ProviderHealth> = health.asStateFlow()

    private fun okhttp3.Response.toProviderError(): ProviderError = when (code) {
        401, 403 -> ProviderError.Authentication("Authentication failed: $code")
        409 -> ProviderError.Conflict("Conflict detected")
        429 -> ProviderError.RateLimited(header("Retry-After")?.toLongOrNull(), null)
        else -> ProviderError.Network("HTTP $code")
    }

    @Serializable
    private data class ListFolderRequest(
        val path: String,
        @SerialName("recursive") val recursive: Boolean = false,
    )

    @Serializable
    private data class CursorArg(val cursor: String)

    @Serializable
    private data class DeleteArg(val path: String)

    @Serializable
    private data class ListFolderResponse(
        val entries: List<FileMetadata> = emptyList(),
        val cursor: String? = null,
    )

    @Serializable
    private data class FileMetadata(
        @SerialName(".tag") val tag: String,
        val name: String,
        @SerialName("path_lower") val pathLower: String? = null,
        val rev: String,
        @SerialName("server_modified") val serverModified: String,
        val size: Long = 0,
    ) {
        fun toMeta(accountId: String): VaultMeta = VaultMeta(
            id = VaultId(remotePath = pathLower ?: name, provider = ProviderKind.DROPBOX, accountId = accountId),
            name = name,
            version = Instant.parse(serverModified).epochSecond,
            lastModifiedUtc = Instant.parse(serverModified).epochSecond,
            size = size,
            remoteEtag = rev,
        )
    }

    @Serializable
    private data class UploadArg(
        val path: String,
        val mode: Mode,
        @SerialName("mute") val mute: Boolean = false,
    )

    @Serializable
    private data class Mode(
        @SerialName(".tag") val tag: String,
        val update: String? = null,
    )

    companion object {
        private const val FOLDER_PATH = "/GenPwdPro"
    }
}
