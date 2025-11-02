package com.genpwd.provider.drive

import com.genpwd.providers.api.ProviderAccount
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ThrowingGoogleDriveAuthProvider @Inject constructor() : GoogleDriveAuthProvider {
    override suspend fun authenticate(): ProviderAccount {
        throw IllegalStateException("GoogleDriveAuthProvider has not been configured")
    }
}
