package com.genpwd.storage

import com.genpwd.corevault.ProviderKind
import com.genpwd.corevault.VaultId

private const val SEPARATOR = ":"

internal fun VaultId.toDatabaseKey(): String =
    listOf(provider.name, accountId, remotePath).joinToString(SEPARATOR)

internal fun parseProvider(kind: String): ProviderKind = ProviderKind.valueOf(kind)

internal fun VaultId.toCacheFileName(): String =
    toDatabaseKey().replace('/', '_')
