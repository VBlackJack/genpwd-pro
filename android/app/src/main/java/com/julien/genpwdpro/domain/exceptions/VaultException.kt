package com.julien.genpwdpro.domain.exceptions

/**
 * Exceptions spécifiques au système de vault
 *
 * Hiérarchie d'exceptions typées pour faciliter la gestion d'erreur
 * et le feedback utilisateur approprié.
 */
sealed class VaultException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause) {

    /**
     * Erreur de décryptage (mauvais password)
     */
    class DecryptionFailed(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Failed to decrypt vault. Check your password.",
        cause = cause
    )

    /**
     * Erreur d'accès fichier (permissions, fichier introuvable, etc.)
     */
    class FileAccessError(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Failed to access vault file.",
        cause = cause
    )

    /**
     * Vault non trouvé dans le registre
     */
    class VaultNotFound(
        vaultId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Vault not found: $vaultId",
        cause = cause
    )

    /**
     * Vault déjà déverrouillé
     */
    class VaultAlreadyUnlocked(
        vaultId: String
    ) : VaultException(
        message = "Vault already unlocked: $vaultId"
    )

    /**
     * Vault déjà verrouillé
     */
    class VaultAlreadyLocked(
        vaultId: String
    ) : VaultException(
        message = "Vault already locked: $vaultId"
    )

    /**
     * Erreur de chiffrement
     */
    class EncryptionFailed(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Failed to encrypt vault data.",
        cause = cause
    )

    /**
     * Erreur lors de la sauvegarde
     */
    class SaveFailed(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Failed to save vault.",
        cause = cause
    )

    /**
     * Entrée non trouvée
     */
    class EntryNotFound(
        entryId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Entry not found: $entryId",
        cause = cause
    )

    /**
     * Entrée déjà existante
     */
    class EntryAlreadyExists(
        entryId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Entry already exists: $entryId",
        cause = cause
    )

    /**
     * Dossier non trouvé
     */
    class FolderNotFound(
        folderId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Folder not found: $folderId",
        cause = cause
    )

    /**
     * Dossier déjà existant
     */
    class FolderAlreadyExists(
        folderId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Folder already exists: $folderId",
        cause = cause
    )

    /**
     * Tag non trouvé
     */
    class TagNotFound(
        tagId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Tag not found: $tagId",
        cause = cause
    )

    /**
     * Tag déjà existant
     */
    class TagAlreadyExists(
        tagId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Tag already exists: $tagId",
        cause = cause
    )

    /**
     * Preset non trouvé
     */
    class PresetNotFound(
        presetId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Preset not found: $presetId",
        cause = cause
    )

    /**
     * Preset déjà existant
     */
    class PresetAlreadyExists(
        presetId: String,
        cause: Throwable? = null
    ) : VaultException(
        message = "Preset already exists: $presetId",
        cause = cause
    )

    /**
     * Format de fichier invalide
     */
    class InvalidFileFormat(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Invalid vault file format.",
        cause = cause
    )

    /**
     * Corruption de données
     */
    class DataCorruption(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Vault data is corrupted.",
        cause = cause
    )

    /**
     * Erreur d'authentification biométrique
     */
    class BiometricAuthFailed(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Biometric authentication failed.",
        cause = cause
    )

    /**
     * Biométrie non disponible
     */
    class BiometricNotAvailable(
        message: String? = null
    ) : VaultException(
        message = message ?: "Biometric authentication is not available on this device."
    )

    /**
     * Opération sur vault verrouillé
     */
    class VaultLocked(
        operation: String
    ) : VaultException(
        message = "Cannot perform operation '$operation' on locked vault. Please unlock first."
    )

    /**
     * Conflit de données (pour sync)
     */
    class DataConflict(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "Data conflict detected.",
        cause = cause
    )

    /**
     * Erreur inconnue
     */
    class Unknown(
        message: String? = null,
        cause: Throwable? = null
    ) : VaultException(
        message = message ?: "An unknown error occurred.",
        cause = cause
    )

    /**
     * Convertit une exception générique en VaultException appropriée
     */
    companion object {
        fun from(throwable: Throwable): VaultException {
            return when (throwable) {
                is VaultException -> throwable
                is SecurityException -> DecryptionFailed(cause = throwable)
                is java.io.IOException -> FileAccessError(cause = throwable)
                is IllegalStateException -> Unknown(throwable.message, throwable)
                else -> Unknown(throwable.message, throwable)
            }
        }
    }
}
