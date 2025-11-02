package com.genpwd.provider.graph

import com.genpwd.providers.api.ProviderAccount

interface GraphAuthProvider {
    suspend fun authenticate(): ProviderAccount
}
