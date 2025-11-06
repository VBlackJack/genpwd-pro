package com.genpwd.provider.graph

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
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton
import javax.inject.Named

private const val GRAPH_BASE = "https://graph.microsoft.com/v1.0/me/drive"
private val JSON_MEDIA = "application/json".toMediaType()

@Singleton
class GraphCloudProvider @Inject constructor(
    private val json: Json,
    @Named("graph") private val client: OkHttpClient,
    private val authProvider: GraphAuthProvider,
) : CloudProvider {
    private val health = MutableStateFlow(ProviderHealth(ProviderHealth.Status.OK))

    override val kind: ProviderKind = ProviderKind.ONEDRIVE

    override suspend fun authenticate(): ProviderAccount = authProvider.authenticate()

    override suspend fun listVaults(account: ProviderAccount): List<VaultMeta> {
        val url = "$GRAPH_BASE/special/approot/children?\$select=id,name,lastModifiedDateTime,size,@microsoft.graph.fileSystemInfo"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(DriveItemsResponse.serializer(), payload)
            return parsed.value.map { it.toMeta(account.id) }
        }
    }

    override suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag {
        val request = Request.Builder()
            .url("$GRAPH_BASE/items/${id.remotePath}/content")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val bytes = response.body?.bytes() ?: ByteArray(0)
            val etag = response.header("ETag")
            return ByteArrayWithEtag(bytes, etag)
        }
    }

    override suspend fun upload(
        account: ProviderAccount,
        id: VaultId,
        data: ByteArray,
        ifMatchEtag: String?,
    ): ProviderWriteResult {
        val request = Request.Builder()
            .url("$GRAPH_BASE/items/${id.remotePath}/content")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .apply { ifMatchEtag?.let { addHeader("If-Match", it) } }
            .put(data.toRequestBody("application/octet-stream".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val meta = json.decodeFromString(GraphDriveItem.serializer(), payload)
            return ProviderWriteResult(
                newEtag = meta.eTag ?: meta.id,
                modifiedUtc = parseIso8601ToEpochSeconds(meta.lastModifiedDateTime),
            )
        }
    }

    override suspend fun createVault(account: ProviderAccount, name: String): VaultMeta {
        val body = json.encodeToString(CreateRequest.serializer(), CreateRequest(name = name)).toRequestBody(JSON_MEDIA)
        val request = Request.Builder()
            .url("$GRAPH_BASE/special/approot/children")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .addHeader("Content-Type", JSON_MEDIA.toString())
            .post(body)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val meta = json.decodeFromString(GraphDriveItem.serializer(), payload)
            return meta.toMeta(account.id)
        }
    }

    override suspend fun deleteVault(account: ProviderAccount, id: VaultId) {
        val request = Request.Builder()
            .url("$GRAPH_BASE/items/${id.remotePath}")
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .delete()
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
        }
    }

    override suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges? {
        val url = if (cursor == null) {
            "$GRAPH_BASE/root/delta"
        } else {
            "$GRAPH_BASE/root/delta?token=$cursor"
        }
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer ${account.accessToken}")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val payload = response.body?.string().orEmpty()
            val parsed = json.decodeFromString(DeltaResponse.serializer(), payload)
            val metas = parsed.value.filter { it.file != null }.map { it.toMeta(account.id) }
            val deletions = parsed.value.filter { it.deleted != null }.map { item ->
                VaultId(remotePath = item.id, provider = kind, accountId = account.id)
            }
            return ProviderChanges(cursor = parsed.deltaToken ?: parsed.nextLink, updatedVaults = metas, deletedVaultIds = deletions)
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
    private data class DriveItemsResponse(val value: List<GraphDriveItem> = emptyList())

    @Serializable
    private data class GraphDriveItem(
        val id: String,
        val name: String,
        @SerialName("lastModifiedDateTime") val lastModifiedDateTime: String,
        val size: Long = 0,
        @SerialName("eTag") val eTag: String? = null,
        val file: FileFacet? = null,
        val deleted: DeletedFacet? = null,
    ) {
        fun toMeta(accountId: String): VaultMeta {
            val epochSeconds = parseIso8601ToEpochSeconds(lastModifiedDateTime)
            return VaultMeta(
                id = VaultId(remotePath = id, provider = ProviderKind.ONEDRIVE, accountId = accountId),
                name = name,
                version = epochSeconds,
                lastModifiedUtc = epochSeconds,
                size = size,
                remoteEtag = eTag,
            )
        }
    }

    @Serializable
    private data class FileFacet(val mimeType: String? = null)

    @Serializable
    private data class DeletedFacet(val state: String? = null)

    @Serializable
    private data class DeltaResponse(
        val value: List<GraphDriveItem> = emptyList(),
        @SerialName("@odata.deltaLink") val deltaToken: String? = null,
        @SerialName("@odata.nextLink") val nextLink: String? = null,
    )

    @Serializable
    private data class CreateRequest(
        val name: String,
        val folder: Map<String, String> = emptyMap(),
        @SerialName("@microsoft.graph.conflictBehavior") val conflictBehavior: String = "rename",
    )
}

/**
 * Parse ISO 8601 date string (Microsoft Graph format) to epoch seconds.
 * Example format: "2024-01-01T00:00:00.000Z" or "2024-01-01T00:00:00Z"
 */
private fun parseIso8601ToEpochSeconds(value: String): Long {
    return try {
        // Microsoft Graph uses ISO 8601 with milliseconds
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
