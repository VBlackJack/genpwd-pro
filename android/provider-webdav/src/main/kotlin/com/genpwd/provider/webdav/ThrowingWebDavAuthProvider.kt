package com.genpwd.provider.webdav

import com.genpwd.providers.api.ProviderAccount
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ThrowingWebDavAuthProvider @Inject constructor() : WebDavAuthProvider {
    override suspend fun authenticate(): ProviderAccount {
        throw IllegalStateException("WebDavAuthProvider has not been configured")
    }

    override fun configuration(): WebDavAuthProvider.WebDavConfiguration {
        throw IllegalStateException("WebDav configuration missing")
    }
}
