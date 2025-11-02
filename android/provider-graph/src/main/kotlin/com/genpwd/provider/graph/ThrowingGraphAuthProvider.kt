package com.genpwd.provider.graph

import com.genpwd.providers.api.ProviderAccount
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ThrowingGraphAuthProvider @Inject constructor() : GraphAuthProvider {
    override suspend fun authenticate(): ProviderAccount {
        throw IllegalStateException("GraphAuthProvider has not been configured")
    }
}
