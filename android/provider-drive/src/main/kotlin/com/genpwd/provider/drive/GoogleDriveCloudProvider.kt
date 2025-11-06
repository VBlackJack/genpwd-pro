package com.genpwd.provider.drive

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
import okhttp3.Response
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

private const val BASE_URL = "https://www.googleapis.com/drive/v3"
private const val UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3"
private val MEDIA_TYPE_OCTET = "application/octet-stream".toMediaType()

@Singleton
class GoogleDriveCloudProvider @Inject constructor(
    private val json: Json,
    private val httpClient: OkHttpClient,
    private val authProvider: GoogleDriveAuthProvider,
) : CloudProvider {
    private val health = MutableStateFlow(ProviderHealth(ProviderHealth.Status.OK))

    override val kind: ProviderKind = ProviderKind.GOOGLE_DRIVE

    override suspend fun authenticate(): ProviderAccount = authProvider.authenticate()

    override suspend fun listVaults(account: ProviderAccount): List<VaultMeta> {
        val request = requestBuilder("$BASE_URL/files")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Accept", "application/json")
            .url(
                "$BASE_URL/files?q='appDataFolder'%20in%20parents%20and%20mimeType='application/octet-stream'&" +
                    "spaces=appDataFolder&fields=files(id,name,modifiedTime,size,md5Checksum)"
            )
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(FilesListResponse.serializer(), payload)
            return parsed.files.map { it.toMeta(account.id) }
        }
    }

    override suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag {
        val request = requestBuilder("$BASE_URL/files/${id.remotePath}?alt=media")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val body = response.body?.bytes() ?: ByteArray(0)
            val etag = response.header("ETag")
            return ByteArrayWithEtag(body, etag)
        }
    }

    override suspend fun upload(
        account: ProviderAccount,
        id: VaultId,
        data: ByteArray,
        ifMatchEtag: String?,
    ): ProviderWriteResult {
        val request = requestBuilder("$UPLOAD_URL/files/${id.remotePath}?uploadType=media")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Content-Type", MEDIA_TYPE_OCTET.toString())
            .apply {
                ifMatchEtag?.let { addHeader("If-Match", it) }
            }
            .put(data.toRequestBody(MEDIA_TYPE_OCTET))
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val file = json.decodeFromString(FileMetadata.serializer(), payload)
            return ProviderWriteResult(
                newEtag = file.md5Checksum ?: file.id,
                modifiedUtc = parseIso8601ToEpochSeconds(file.modifiedTime),
            )
        }
    }

    override suspend fun createVault(account: ProviderAccount, name: String): VaultMeta {
        val body = json.encodeToString(CreateFileRequest.serializer(), CreateFileRequest(name = name)).toRequestBody(
            "application/json".toMediaType(),
        )
        val request = requestBuilder("$BASE_URL/files")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Content-Type", "application/json")
            .post(body)
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val file = json.decodeFromString(FileMetadata.serializer(), payload)
            return file.toMeta(account.id)
        }
    }

    override suspend fun deleteVault(account: ProviderAccount, id: VaultId) {
        val request = requestBuilder("$BASE_URL/files/${id.remotePath}")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .delete()
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
        }
    }

    override suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges? {
        val startUrl = buildString {
            append("$BASE_URL/changes?pageSize=50&fields=nextPageToken,newStartPageToken,changes(fileId,file(id,name,modifiedTime,size,md5Checksum)))")
            if (cursor != null) {
                append("&pageToken=").append(cursor)
            }
        }
        val request = requestBuilder(startUrl)
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(ChangesResponse.serializer(), payload)
            val metas = parsed.changes.filter { it.file != null }.map { change ->
                change.file!!.toMeta(account.id)
            }
            val deletions = parsed.changes.filter { it.file == null }.map { change ->
                VaultId(remotePath = change.fileId ?: "", provider = kind, accountId = account.id)
            }
            return ProviderChanges(
                cursor = parsed.nextPageToken ?: parsed.newStartPageToken,
                updatedVaults = metas,
                deletedVaultIds = deletions,
            )
        }
    }

    override fun observeHealth(account: ProviderAccount): Flow<ProviderHealth> = health.asStateFlow()

    private fun requestBuilder(url: String): Request.Builder = Request.Builder().url(url)

    private fun Response.toProviderError(): ProviderError {
        return when (code) {
            401, 403 -> ProviderError.Authentication("Authentication failed: $code")
            409 -> ProviderError.Conflict("Conflict detected")
            429 -> {
                val retry = header("Retry-After")?.toLongOrNull()
                ProviderError.RateLimited(retry, null)
            }
            else -> ProviderError.Network("HTTP $code")
        }
    }

    @Serializable
    private data class FilesListResponse(
        val files: List<FileMetadata> = emptyList(),
    )

    @Serializable
    private data class FileMetadata(
        val id: String,
        val name: String,
        @SerialName("modifiedTime") val modifiedTime: String,
        val size: Long? = 0,
        val md5Checksum: String? = null,
    ) {
        fun toMeta(accountId: String): VaultMeta {
            val epochSeconds = parseIso8601ToEpochSeconds(modifiedTime)
            return VaultMeta(
                id = VaultId(remotePath = id, provider = ProviderKind.GOOGLE_DRIVE, accountId = accountId),
                name = name,
                version = epochSeconds,
                lastModifiedUtc = epochSeconds,
                size = size ?: 0L,
                remoteEtag = md5Checksum ?: id,
            )
        }
    }

    @Serializable
    private data class CreateFileRequest(
        val name: String,
        val parents: List<String> = listOf("appDataFolder"),
        @SerialName("mimeType") val mimeType: String = MEDIA_TYPE_OCTET.toString(),
    )

    @Serializable
    private data class ChangesResponse(
        @SerialName("nextPageToken") val nextPageToken: String? = null,
        @SerialName("newStartPageToken") val newStartPageToken: String? = null,
        val changes: List<Change> = emptyList(),
    )

    @Serializable
    private data class Change(
        @SerialName("fileId") val fileId: String? = null,
        val file: FileMetadata? = null,
    )
}

/**
 * Parse ISO 8601 date string (Google Drive format) to epoch seconds.
 * Example format: "2024-01-01T00:00:00.000Z"
 */
private fun parseIso8601ToEpochSeconds(value: String): Long {
    return try {
        // Google Drive uses ISO 8601 with milliseconds
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        format.parse(value)?.time?.div(1000) ?: (System.currentTimeMillis() / 1000)
    } catch (e: Exception) {
        try {
            // Fallback: ISO 8601 without milliseconds
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            format.parse(value)?.time?.div(1000) ?: (System.currentTimeMillis() / 1000)
        } catch (e2: Exception) {
            // Ultimate fallback to current time
            System.currentTimeMillis() / 1000
        }
    }
}
