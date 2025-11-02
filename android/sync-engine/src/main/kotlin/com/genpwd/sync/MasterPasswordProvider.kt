package com.genpwd.sync

import com.genpwd.corevault.VaultId

interface MasterPasswordProvider {
    suspend fun obtainMasterPassword(vaultId: VaultId, alias: String?): CharArray?
}
