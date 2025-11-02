package com.genpwd.provider.webdav

import com.genpwd.providers.api.ProviderAccount

interface WebDavAuthProvider {
    suspend fun authenticate(): ProviderAccount
    fun configuration(): WebDavConfiguration

    data class WebDavConfiguration(val baseUrl: String)
}
