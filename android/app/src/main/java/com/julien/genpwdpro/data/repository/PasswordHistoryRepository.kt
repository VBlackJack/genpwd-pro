package com.julien.genpwdpro.data.repository

import com.google.gson.Gson
import com.julien.genpwdpro.data.local.dao.PasswordHistoryDao
import com.julien.genpwdpro.data.local.entity.PasswordHistoryEntity
import com.julien.genpwdpro.data.models.PasswordResult
import com.julien.genpwdpro.data.models.Settings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository pour l'historique des mots de passe
 */
@Singleton
class PasswordHistoryRepository @Inject constructor(
    private val dao: PasswordHistoryDao,
    private val gson: Gson
) {

    companion object {
        private const val MAX_HISTORY_SIZE = 100
    }

    /**
     * Récupère tout l'historique
     */
    fun getHistory(): Flow<List<PasswordResult>> {
        return dao.getHistoryWithLimit(MAX_HISTORY_SIZE).map { entities ->
            entities.map { it.toPasswordResult(gson) }
        }
    }

    /**
     * Recherche dans l'historique
     */
    fun searchHistory(query: String): Flow<List<PasswordResult>> {
        return dao.searchHistory(query).map { entities ->
            entities.map { it.toPasswordResult(gson) }
        }
    }

    /**
     * Sauvegarde un mot de passe dans l'historique
     */
    suspend fun savePassword(result: PasswordResult) {
        val entity = result.toEntity(gson)
        dao.insert(entity)

        // Limiter la taille de l'historique
        val count = dao.getCount()
        if (count > MAX_HISTORY_SIZE) {
            dao.deleteOldest(count - MAX_HISTORY_SIZE)
        }
    }

    /**
     * Sauvegarde plusieurs mots de passe
     */
    suspend fun savePasswords(results: List<PasswordResult>) {
        val entities = results.map { it.toEntity(gson) }
        dao.insertAll(entities)

        // Limiter la taille de l'historique
        val count = dao.getCount()
        if (count > MAX_HISTORY_SIZE) {
            dao.deleteOldest(count - MAX_HISTORY_SIZE)
        }
    }

    /**
     * Supprime un mot de passe de l'historique
     */
    suspend fun deletePassword(id: String) {
        dao.deleteById(id)
    }

    /**
     * Efface tout l'historique
     */
    suspend fun clearHistory() {
        dao.deleteAll()
    }

    /**
     * Compte le nombre d'entrées
     */
    suspend fun getCount(): Int {
        return dao.getCount()
    }
}

/**
 * Extension pour convertir Entity → PasswordResult
 */
private fun PasswordHistoryEntity.toPasswordResult(gson: Gson): PasswordResult {
    val settings = gson.fromJson(settingsJson, Settings::class.java)
    return PasswordResult(
        id = id,
        password = password,
        entropy = entropy,
        mode = com.julien.genpwdpro.data.local.entity.toGenerationMode(mode),
        timestamp = timestamp,
        settings = settings,
        isMasked = true
    )
}

/**
 * Extension pour convertir PasswordResult → Entity
 */
private fun PasswordResult.toEntity(gson: Gson): PasswordHistoryEntity {
    return PasswordHistoryEntity(
        id = id,
        password = password,
        entropy = entropy,
        mode = mode.name,
        timestamp = timestamp,
        settingsJson = gson.toJson(settings)
    )
}
