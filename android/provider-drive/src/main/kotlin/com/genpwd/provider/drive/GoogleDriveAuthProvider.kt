package com.genpwd.provider.drive

import com.genpwd.providers.api.ProviderAccount

interface GoogleDriveAuthProvider {
    suspend fun authenticate(): ProviderAccount
}
