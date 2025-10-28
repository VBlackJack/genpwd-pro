package com.julien.genpwdpro.data.repository

import androidx.fragment.app.FragmentActivity
import com.julien.genpwdpro.data.local.dao.VaultRegistryDao
import com.julien.genpwdpro.data.local.entity.*
import com.julien.genpwdpro.domain.model.VaultStatistics
import com.julien.genpwdpro.domain.session.VaultSessionManager
import com.julien.genpwdpro.security.BiometricVaultManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository pour les opérations sur les vaults file-based
 *
 * Architecture :
 * ```
 * UI/ViewModel
 *      ↓
 * FileVaultRepository ← VOUS ÊTES ICI (Layer pattern)
 *      ↓
 * VaultSessionManager (Business logic)
 *      ↓
 * VaultFileManager (File I/O)
 * ```
 *
 * Responsabilités :
 * - Fournit une API haut niveau pour l'UI
 * - Délègue au VaultSessionManager
 * - Transforme les données pour l'UI si nécessaire
 * - Gère les erreurs et les logs
 *
 * Note : Cette classe remplace l'ancien VaultRepository (Room-based)
 */
@Singleton
class FileVaultRepository @Inject constructor(
    private val vaultSessionManager: VaultSessionManager,
    private val vaultRegistryDao: VaultRegistryDao,
    private val biometricVaultManager: BiometricVaultManager,
    private val legacyVaultRepository: VaultRepository
) {

    // ========== Entry Operations ==========

    /**
     * Récupère toutes les entries du vault actuellement déverrouillé
     *
     * @return Flow de liste d'entries (reactive)
     */
    fun getEntries(): Flow<List<VaultEntryEntity>> {
        return vaultSessionManager.getEntries()
    }

    /**
     * Récupère les entries d'un dossier spécifique
     *
     * @param folderId ID du dossier (null = racine)
     * @return Flow de liste d'entries
     */
    fun getEntriesByFolder(folderId: String?): Flow<List<VaultEntryEntity>> {
        return getEntries().map { entries ->
            entries.filter { it.folderId == folderId }
        }
    }

    /**
     * Récupère les entries favorites
     *
     * @return Flow de liste d'entries favorites
     */
    fun getFavoriteEntries(): Flow<List<VaultEntryEntity>> {
        return getEntries().map { entries ->
            entries.filter { it.isFavorite }
        }
    }

    /**
     * Recherche des entries par titre/username/url/notes
     *
     * @param query Terme de recherche
     * @return Flow de liste d'entries correspondantes
     */
    fun searchEntries(query: String): Flow<List<VaultEntryEntity>> {
        return getEntries().map { entries ->
            entries.filter { entry ->
                entry.title.contains(query, ignoreCase = true) ||
                entry.username?.contains(query, ignoreCase = true) == true ||
                entry.url?.contains(query, ignoreCase = true) == true ||
                entry.notes?.contains(query, ignoreCase = true) == true
            }
        }
    }

    /**
     * Récupère une entry par son ID
     *
     * @param entryId ID de l'entry
     * @return Entry ou null si non trouvée
     */
    suspend fun getEntryById(entryId: String): VaultEntryEntity? {
        return vaultSessionManager.getEntryById(entryId)
    }

    /**
     * Ajoute une nouvelle entry
     *
     * @param entry Entry à ajouter
     * @return Result.success si ajoutée, Result.failure si erreur
     */
    suspend fun addEntry(entry: VaultEntryEntity): Result<Unit> {
        return vaultSessionManager.addEntry(entry)
    }

    /**
     * Met à jour une entry existante
     *
     * @param entry Entry à mettre à jour
     * @return Result.success si mise à jour, Result.failure si erreur
     */
    suspend fun updateEntry(entry: VaultEntryEntity): Result<Unit> {
        return vaultSessionManager.updateEntry(entry)
    }

    /**
     * Supprime une entry
     *
     * @param entryId ID de l'entry à supprimer
     * @return Result.success si supprimée, Result.failure si erreur
     */
    suspend fun deleteEntry(entryId: String): Result<Unit> {
        return vaultSessionManager.deleteEntry(entryId)
    }

    /**
     * Toggle le statut favori d'une entry
     *
     * @param entryId ID de l'entry
     * @param isFavorite Nouveau statut favori
     * @return Result.success si mis à jour, Result.failure si erreur
     */
    suspend fun toggleFavorite(entryId: String, isFavorite: Boolean): Result<Unit> {
        val entry = getEntryById(entryId) ?: return Result.failure(
            IllegalStateException("Entry not found: $entryId")
        )
        return updateEntry(entry.copy(isFavorite = isFavorite))
    }

    // ========== Folder Operations ==========

    /**
     * Récupère tous les folders
     *
     * @return Flow de liste de folders
     */
    fun getFolders(): Flow<List<FolderEntity>> {
        return vaultSessionManager.getFolders()
    }

    /**
     * Récupère un folder par son ID
     *
     * @param folderId ID du folder
     * @return Folder ou null si non trouvé
     */
    suspend fun getFolderById(folderId: String): FolderEntity? {
        return vaultSessionManager.getFolders().value.find { it.id == folderId }
    }

    /**
     * Ajoute un nouveau folder
     *
     * @param folder Folder à ajouter
     * @return Result.success si ajouté, Result.failure si erreur
     */
    suspend fun addFolder(folder: FolderEntity): Result<Unit> {
        return vaultSessionManager.addFolder(folder)
    }

    /**
     * Met à jour un folder existant
     *
     * @param folder Folder à mettre à jour
     * @return Result.success si mis à jour, Result.failure si erreur
     */
    suspend fun updateFolder(folder: FolderEntity): Result<Unit> {
        return vaultSessionManager.updateFolder(folder)
    }

    /**
     * Supprime un folder (et déplace les entries à la racine)
     *
     * @param folderId ID du folder à supprimer
     * @return Result.success si supprimé, Result.failure si erreur
     */
    suspend fun deleteFolder(folderId: String): Result<Unit> {
        return vaultSessionManager.deleteFolder(folderId)
    }

    // ========== Tag Operations ==========

    /**
     * Récupère tous les tags
     *
     * @return Flow de liste de tags
     */
    fun getTags(): Flow<List<TagEntity>> {
        return vaultSessionManager.getTags()
    }

    /**
     * Récupère un tag par son ID
     *
     * @param tagId ID du tag
     * @return Tag ou null si non trouvé
     */
    suspend fun getTagById(tagId: String): TagEntity? {
        return vaultSessionManager.getTags().value.find { it.id == tagId }
    }

    /**
     * Ajoute un nouveau tag
     *
     * @param tag Tag à ajouter
     * @return Result.success si ajouté, Result.failure si erreur
     */
    suspend fun addTag(tag: TagEntity): Result<Unit> {
        return vaultSessionManager.addTag(tag)
    }

    /**
     * Met à jour un tag existant
     *
     * @param tag Tag à mettre à jour
     * @return Result.success si mis à jour, Result.failure si erreur
     */
    suspend fun updateTag(tag: TagEntity): Result<Unit> {
        return vaultSessionManager.updateTag(tag)
    }

    /**
     * Supprime un tag
     *
     * @param tagId ID du tag à supprimer
     * @return Result.success si supprimé, Result.failure si erreur
     */
    suspend fun deleteTag(tagId: String): Result<Unit> {
        return vaultSessionManager.deleteTag(tagId)
    }

    /**
     * Récupère les tags d'une entry
     *
     * @param entryId ID de l'entry
     * @return Flow de liste de tags
     */
    fun getTagsForEntry(entryId: String): Flow<List<TagEntity>> {
        return vaultSessionManager.getTags().map { allTags ->
            val entryTagRefs = vaultSessionManager.getCurrentSession()
                ?.vaultData?.value?.entryTags
                ?.filter { it.entryId == entryId }
                ?: emptyList()

            val tagIds = entryTagRefs.map { it.tagId }.toSet()
            allTags.filter { it.id in tagIds }
        }
    }

    // ========== Preset Operations ==========

    /**
     * Récupère tous les presets
     *
     * @return Flow de liste de presets
     */
    fun getPresets(): Flow<List<PresetEntity>> {
        return vaultSessionManager.getPresets()
    }

    /**
     * Récupère un preset par son ID
     *
     * @param presetId ID du preset
     * @return Preset ou null si non trouvé
     */
    suspend fun getPresetById(presetId: String): PresetEntity? {
        return vaultSessionManager.getPresets().value.find { it.id == presetId }
    }

    /**
     * Ajoute un nouveau preset
     *
     * @param preset Preset à ajouter
     * @return Result.success si ajouté, Result.failure si erreur
     */
    suspend fun addPreset(preset: PresetEntity): Result<Unit> {
        return vaultSessionManager.addPreset(preset)
    }

    /**
     * Met à jour un preset existant
     *
     * @param preset Preset à mettre à jour
     * @return Result.success si mis à jour, Result.failure si erreur
     */
    suspend fun updatePreset(preset: PresetEntity): Result<Unit> {
        return vaultSessionManager.updatePreset(preset)
    }

    /**
     * Supprime un preset
     *
     * @param presetId ID du preset à supprimer
     * @return Result.success si supprimé, Result.failure si erreur
     */
    suspend fun deletePreset(presetId: String): Result<Unit> {
        return vaultSessionManager.deletePreset(presetId)
    }

    // ========== Statistics ==========

    /**
     * Récupère les statistiques du vault actuel (Flow réactif)
     *
     * @return Flow de statistiques, se met à jour automatiquement quand le vault change
     */
    fun getStatistics(): Flow<VaultStatistics> {
        return combine(
            vaultSessionManager.getEntries(),
            vaultSessionManager.getFolders(),
            vaultSessionManager.getTags(),
            vaultSessionManager.getPresets()
        ) { entries, folders, tags, presets ->
            // Compter par type
            val loginCount = entries.count { it.entryType == EntryType.LOGIN.name }
            val noteCount = entries.count { it.entryType == EntryType.NOTE.name }
            val wifiCount = entries.count { it.entryType == EntryType.WIFI.name }
            val cardCount = entries.count { it.entryType == EntryType.CARD.name }
            val identityCount = entries.count { it.entryType == EntryType.IDENTITY.name }

            // Compter favoris et TOTP
            val favoritesCount = entries.count { it.isFavorite }
            val totpCount = entries.count { it.hasTOTP() }

            // Compter mots de passe faibles (< 8 caractères)
            val weakPasswordCount = entries.count { entry ->
                val pwd = entry.password
                pwd != null && pwd.length < 8
            }

            VaultStatistics(
                entryCount = entries.size,
                folderCount = folders.size,
                presetCount = presets.size,
                tagCount = tags.size,
                loginCount = loginCount,
                noteCount = noteCount,
                wifiCount = wifiCount,
                cardCount = cardCount,
                identityCount = identityCount,
                favoritesCount = favoritesCount,
                totpCount = totpCount,
                weakPasswordCount = weakPasswordCount,
                sizeInBytes = 0L // TODO: Calculate real size
            )
        }
    }

    // ========== Session Management ==========

    /**
     * Vérifie si un vault est actuellement déverrouillé
     *
     * @return true si déverrouillé, false sinon
     */
    fun isVaultUnlocked(): Boolean {
        return vaultSessionManager.isVaultUnlocked()
    }

    /**
     * Récupère l'ID du vault actuellement déverrouillé
     *
     * @return ID du vault ou null si aucun déverrouillé
     */
    fun getCurrentVaultId(): String? {
        return vaultSessionManager.getCurrentVaultId()
    }

    /**
     * Déverrouille un vault
     *
     * @param vaultId ID du vault
     * @param masterPassword Master password
     * @return Result.success si déverrouillé, Result.failure si erreur
     */
    suspend fun unlockVault(vaultId: String, masterPassword: String): Result<Unit> {
        val result = vaultSessionManager.unlockVault(vaultId, masterPassword)

        if (result.isSuccess) {
            syncLegacyRepositoryUnlock(vaultId, masterPassword)
        }

        return result
    }

    /**
     * Verrouille le vault actuel
     */
    suspend fun lockVault() {
        val currentVaultId = vaultSessionManager.getCurrentVaultId()
        vaultSessionManager.lockVault()

        currentVaultId?.let { vaultId ->
            try {
                legacyVaultRepository.lockVault(vaultId)
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to sync legacy lock for vault $vaultId", e)
            }
        }
    }

    /**
     * Sauvegarde manuellement le vault actuel
     * (Note: la sauvegarde est automatique après chaque modification)
     *
     * @return Result.success si sauvegardé, Result.failure si erreur
     */
    suspend fun saveVault(): Result<Unit> {
        return vaultSessionManager.saveCurrentVault()
    }

    // ========== Biometric Support ==========

    /**
     * Déverrouille un vault via authentification biométrique.
     */
    suspend fun unlockVaultWithBiometric(
        activity: FragmentActivity,
        vaultId: String
    ): Result<Unit> {
        val passwordResult = biometricVaultManager.unlockWithBiometric(activity, vaultId)

        return passwordResult.fold(
            onSuccess = { masterPassword ->
                val unlockResult = vaultSessionManager.unlockVault(vaultId, masterPassword)
                if (unlockResult.isSuccess) {
                    syncLegacyRepositoryUnlock(vaultId, masterPassword)
                }
                unlockResult
            },
            onFailure = { error -> Result.failure(error) }
        )
    }

    /**
     * Active l'authentification biométrique pour un vault.
     */
    suspend fun enableBiometric(vaultId: String, masterPassword: String): Result<Unit> {
        return biometricVaultManager.enableBiometric(vaultId, masterPassword)
    }

    /**
     * Désactive l'authentification biométrique pour un vault.
     */
    suspend fun disableBiometric(vaultId: String): Result<Unit> {
        return biometricVaultManager.disableBiometric(vaultId)
    }

    /**
     * Vérifie si la biométrie est disponible sur l'appareil.
     */
    fun isBiometricAvailable(): Boolean {
        return biometricVaultManager.isBiometricAvailable()
    }

    private fun syncLegacyRepositoryUnlock(vaultId: String, masterPassword: String) {
        try {
            val success = legacyVaultRepository.unlockVault(vaultId, masterPassword)
            if (!success) {
                android.util.Log.w(TAG, "Legacy repository did not unlock vault $vaultId")
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to sync legacy unlock for vault $vaultId", e)
        }
    }

    companion object {
        private const val TAG = "FileVaultRepository"
    }
}
