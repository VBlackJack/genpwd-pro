package com.genpwd.provider.webdav

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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.w3c.dom.Element
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton
import javax.inject.Named
import javax.xml.parsers.DocumentBuilderFactory

private val XML_MEDIA = "application/xml".toMediaType()

@Singleton
class WebDavCloudProvider @Inject constructor(
    @Named("webdav") private val client: OkHttpClient,
    private val authProvider: WebDavAuthProvider,
) : CloudProvider {
    private val health = MutableStateFlow(ProviderHealth(ProviderHealth.Status.OK))

    override val kind: ProviderKind = ProviderKind.WEBDAV

    override suspend fun authenticate(): ProviderAccount = authProvider.authenticate()

    override suspend fun listVaults(account: ProviderAccount): List<VaultMeta> {
        val config = authProvider.configuration()
        val request = Request.Builder()
            .url(config.baseUrl)
            .method("PROPFIND", "<?xml version=\"1.0\" encoding=\"utf-8\"?><propfind xmlns=\"DAV:\"><allprop/></propfind>".toRequestBody(XML_MEDIA))
            .addHeader("Depth", "1")
            .addHeader("Authorization", "Basic ${account.accessToken}")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val body = response.body?.byteStream() ?: return emptyList()
            val factory = DocumentBuilderFactory.newInstance()
            factory.isNamespaceAware = true
            val document = factory.newDocumentBuilder().parse(body)
            val nodes = document.getElementsByTagName("d:response")
            val results = mutableListOf<VaultMeta>()
            for (i in 0 until nodes.length) {
                val node = nodes.item(i) as? Element ?: continue
                val href = node.getElementsByTagName("d:href").item(0)?.textContent?.trim() ?: continue
                if (href == "/") continue
                val etag = node.getElementsByTagName("d:getetag").item(0)?.textContent
                val size = node.getElementsByTagName("d:getcontentlength").item(0)?.textContent?.toLongOrNull() ?: 0L
                val modified = node.getElementsByTagName("d:getlastmodified").item(0)?.textContent
                val lastModified = modified?.let { parseHttpDate(it) } ?: Instant.now()
                val remotePath = if (href.startsWith("/")) href else "/$href"
                val name = remotePath.substringAfterLast('/')
                results.add(
                    VaultMeta(
                        id = VaultId(remotePath = remotePath, provider = kind, accountId = account.id),
                        name = name,
                        version = lastModified.epochSecond,
                        lastModifiedUtc = lastModified.epochSecond,
                        size = size,
                        remoteEtag = etag,
                    ),
                )
            }
            return results
        }
    }

    override suspend fun download(account: ProviderAccount, id: VaultId): ByteArrayWithEtag {
        val config = authProvider.configuration()
        val request = Request.Builder()
            .url(config.resolve(id.remotePath))
            .addHeader("Authorization", "Basic ${account.accessToken}")
            .get()
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
        val config = authProvider.configuration()
        val request = Request.Builder()
            .url(config.resolve(id.remotePath))
            .addHeader("Authorization", "Basic ${account.accessToken}")
            .apply { ifMatchEtag?.let { addHeader("If-Match", it) } }
            .put(data.toRequestBody("application/octet-stream".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.toProviderError()
            val etag = response.header("ETag") ?: ifMatchEtag.orEmpty()
            val instant = response.header("Last-Modified")?.let { parseHttpDate(it) } ?: Instant.now()
            return ProviderWriteResult(newEtag = etag, modifiedUtc = instant.epochSecond)
        }
    }

    override suspend fun createVault(account: ProviderAccount, name: String): VaultMeta {
        val path = "/${name}"
        val result = upload(account, VaultId(path, kind, account.id), ByteArray(0), null)
        return VaultMeta(
            id = VaultId(path, kind, account.id),
            name = name,
            version = result.modifiedUtc,
            lastModifiedUtc = result.modifiedUtc,
            size = 0L,
            remoteEtag = result.newEtag,
        )
    }

    override suspend fun deleteVault(account: ProviderAccount, id: VaultId) {
        val config = authProvider.configuration()
        val request = Request.Builder()
            .url(config.resolve(id.remotePath))
            .addHeader("Authorization", "Basic ${account.accessToken}")
            .delete()
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful && response.code != 404) throw response.toProviderError()
        }
    }

    override suspend fun listChanges(account: ProviderAccount, cursor: String?): ProviderChanges? = null

    override fun observeHealth(account: ProviderAccount): Flow<ProviderHealth> = health.asStateFlow()

    private fun okhttp3.Response.toProviderError(): ProviderError = when (code) {
        401, 403 -> ProviderError.Authentication("Authentication failed: $code")
        409 -> ProviderError.Conflict("Conflict detected")
        423 -> ProviderError.RateLimited(null, null)
        else -> ProviderError.Network("HTTP $code")
    }
}

private fun parseHttpDate(value: String): Instant =
    runCatching { Instant.parse(value) }.getOrElse {
        ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
    }

private fun WebDavAuthProvider.WebDavConfiguration.resolve(path: String): String {
    val cleanPath = if (path.startsWith("/")) path.drop(1) else path
    return if (baseUrl.endsWith("/")) baseUrl + cleanPath else "$baseUrl/$cleanPath"
}
