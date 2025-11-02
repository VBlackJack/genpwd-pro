package com.genpwd.provider.dropbox

import com.genpwd.providers.api.ProviderAccount
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ThrowingDropboxAuthProvider @Inject constructor() : DropboxAuthProvider {
    override suspend fun authenticate(): ProviderAccount {
        throw IllegalStateException("DropboxAuthProvider has not been configured")
    }
}
