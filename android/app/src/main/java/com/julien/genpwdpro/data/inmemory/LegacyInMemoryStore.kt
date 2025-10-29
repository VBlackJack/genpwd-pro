package com.julien.genpwdpro.data.inmemory

import android.content.Context
import com.google.gson.Gson
import com.julien.genpwdpro.core.log.SafeLog
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.charset.Charset
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

/**
 * Provides read/write helpers to interact with the legacy in-memory cache files
 * that were used before the SQLCipher-backed Room database existed. The cache lives
 * inside the app's private storage (`files/legacy_inmemory/`) and may also have
 * temporary copies in the cache directory.
 */
@Singleton
class LegacyInMemoryStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {

    /**
     * Loads every legacy snapshot discovered on disk. Files that cannot be parsed are skipped
     * but left untouched so that manual recovery remains possible.
     */
    fun loadSnapshots(): List<LegacyVaultSnapshot> {
        val snapshots = mutableListOf<LegacyVaultSnapshot>()
        candidateDirectories().forEach { directory ->
            directory.listFiles(JSON_FILTER)?.forEach { file ->
                parseSnapshot(file)?.let { snapshot ->
                    snapshots += snapshot
                }
            }
        }
        return snapshots
    }

    /**
     * Returns true when at least one legacy cache file is present.
     */
    fun hasLegacyState(): Boolean {
        return candidateDirectories().any { directory ->
            directory.exists() && directory.isDirectory && directory.listFiles(JSON_FILTER)?.isNotEmpty() == true
        }
    }

    /**
     * Securely wipes the supplied snapshot files. The method overwrites the file contents with
     * zeroes before deleting the file to avoid leaving recoverable traces of sensitive data.
     * Cache directories are removed if they become empty.
     */
    fun secureWipe(snapshots: Collection<LegacyVaultSnapshot>) {
        snapshots.forEach { snapshot ->
            secureDelete(snapshot.sourceFile)
        }
        candidateDirectories().forEach { directory ->
            directory.listFiles()?.forEach { file ->
                if (file.isFile && file.length() == 0L) {
                    file.delete()
                }
            }
            if (directory.isDirectory && directory.listFiles().isNullOrEmpty()) {
                directory.delete()
            }
        }
    }

    private fun parseSnapshot(file: File): LegacyVaultSnapshot? {
        return try {
            BufferedReader(FileReader(file, Charset.forName("UTF-8"))).use { reader ->
                val payload = gson.fromJson(reader, LegacyInMemoryVaultContainer::class.java)
                val resolvedId = payload.vault?.id
                    ?: payload.metadata?.vaultId
                    ?: payload.legacyVaultId
                if (resolvedId == null) {
                    SafeLog.w(TAG, "Ignoring legacy cache ${file.name} (missing vault identifier)")
                    null
                } else {
                    LegacyVaultSnapshot(
                        vaultId = resolvedId,
                        vault = payload.vault,
                        metadata = payload.metadata,
                        entries = payload.entries,
                        folders = payload.folders,
                        tags = payload.tags,
                        presets = payload.presets,
                        entryTags = payload.entryTags,
                        sourceFile = file
                    )
                }
            }
        } catch (ioe: IOException) {
            SafeLog.e(TAG, "Unable to read legacy cache ${file.absolutePath}", ioe)
            null
        } catch (throwable: Throwable) {
            SafeLog.e(TAG, "Unable to parse legacy cache ${file.absolutePath}", throwable)
            null
        }
    }

    private fun secureDelete(file: File) {
        if (!file.exists() || !file.isFile) {
            return
        }
        runCatching {
            RandomAccessFile(file, "rw").use { raf ->
                val length = raf.length()
                val buffer = ByteArray(SECURE_WIPE_BUFFER_SIZE)
                var remaining = length
                while (remaining > 0) {
                    val toWrite = min(buffer.size.toLong(), remaining).toInt()
                    raf.write(buffer, 0, toWrite)
                    remaining -= toWrite
                }
                raf.fd.sync()
            }
        }.onFailure { throwable ->
            SafeLog.w(TAG, "Failed to overwrite legacy cache ${file.absolutePath}", throwable)
        }
        if (!file.delete()) {
            SafeLog.w(TAG, "Unable to delete legacy cache ${file.absolutePath}")
        }
    }

    private fun candidateDirectories(): List<File> {
        return listOf(
            File(context.filesDir, LEGACY_DIRECTORY_NAME),
            File(context.cacheDir, LEGACY_DIRECTORY_NAME)
        )
    }

    companion object {
        private const val TAG = "LegacyInMemoryStore"
        private const val LEGACY_DIRECTORY_NAME = "legacy_inmemory"
        private const val SECURE_WIPE_BUFFER_SIZE = 32 * 1024
        private val JSON_FILTER = FileFilter { file ->
            file.isFile && file.extension.equals("json", ignoreCase = true)
        }
    }
}

private fun interface FileFilter {
    fun accept(file: File): Boolean
}

private fun File.listFiles(filter: FileFilter): Array<File>? {
    return listFiles { candidate -> filter.accept(candidate) }
}
