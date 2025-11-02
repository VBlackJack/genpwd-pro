package com.genpwd.storage.cache

import android.content.Context
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.MasterKey
import com.genpwd.corevault.EncryptedVault
import com.genpwd.corevault.VaultEncoding
import com.genpwd.corevault.VaultId
import com.genpwd.storage.toCacheFileName
import kotlinx.serialization.json.Json
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EncryptedVaultCache @Inject constructor(
    private val context: Context,
    private val json: Json,
) {
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    fun write(vaultId: VaultId, encrypted: EncryptedVault) {
        val file = resolveFile(vaultId)
        if (!file.parentFile.exists()) {
            file.parentFile.mkdirs()
        }
        val bytes = VaultEncoding.encode(encrypted, json)
        encryptedFile(file).openFileOutput().use { output ->
            output.write(bytes)
        }
    }

    fun read(vaultId: VaultId): EncryptedVault? {
        val file = resolveFile(vaultId)
        if (!file.exists()) return null
        val bytes = encryptedFile(file).openFileInput().use { it.readBytes() }
        return runCatching { VaultEncoding.decode(bytes, json) }.getOrNull()
    }

    fun clear(vaultId: VaultId) {
        val file = resolveFile(vaultId)
        if (file.exists()) {
            file.delete()
        }
    }

    private fun encryptedFile(file: File): EncryptedFile =
        EncryptedFile.Builder(
            context,
            file,
            masterKey,
            EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
        ).build()

    private fun resolveFile(vaultId: VaultId): File {
        val directory = File(context.filesDir, "vault_cache")
        return File(directory, vaultId.toCacheFileName())
    }
}
