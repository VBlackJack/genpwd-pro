package com.genpwd.sync

import com.genpwd.corevault.ProviderKind
import com.genpwd.providers.api.CloudProvider
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ProviderRegistry @Inject constructor(
    providers: Set<@JvmSuppressWildcards CloudProvider>,
) {
    private val providerMap: Map<ProviderKind, CloudProvider> = providers.associateBy { it.kind }

    fun get(kind: ProviderKind): CloudProvider =
        providerMap[kind] ?: error("No provider registered for $kind")
}
