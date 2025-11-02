package com.genpwd.provider.dropbox

import com.genpwd.providers.api.ProviderAccount

interface DropboxAuthProvider {
    suspend fun authenticate(): ProviderAccount
}
