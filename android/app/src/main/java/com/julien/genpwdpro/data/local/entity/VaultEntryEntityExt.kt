package com.julien.genpwdpro.data.local.entity

/**
 * Extensions pour VaultEntryEntity permettant l'accès aux données en clair
 *
 * Note: Dans le système file-based, les champs "encrypted*" contiennent en fait
 * des données en clair quand le vault est en mémoire, car tout le fichier .gpv
 * est chiffré globalement. Ces extensions fournissent un accès plus naturel.
 */

// ========== Propriétés en lecture ==========

/**
 * Titre de l'entrée (en clair en mémoire)
 */
val VaultEntryEntity.title: String
    get() = encryptedTitle

/**
 * Nom d'utilisateur (en clair en mémoire)
 */
val VaultEntryEntity.username: String?
    get() = encryptedUsername.ifEmpty { null }

/**
 * Mot de passe (en clair en mémoire)
 */
val VaultEntryEntity.password: String?
    get() = encryptedPassword.ifEmpty { null }

/**
 * URL (en clair en mémoire)
 */
val VaultEntryEntity.url: String?
    get() = encryptedUrl.ifEmpty { null }

/**
 * Notes (en clair en mémoire)
 */
val VaultEntryEntity.notes: String?
    get() = encryptedNotes.ifEmpty { null }

/**
 * Champs personnalisés JSON (en clair en mémoire)
 */
val VaultEntryEntity.customFields: String?
    get() = encryptedCustomFields.ifEmpty { null }

/**
 * Secret TOTP (en clair en mémoire)
 */
val VaultEntryEntity.totpSecret: String?
    get() = encryptedTotpSecret.ifEmpty { null }

/**
 * Données passkey (en clair en mémoire)
 */
val VaultEntryEntity.passkeyData: String?
    get() = encryptedPasskeyData.ifEmpty { null }

// Note: entryType est déjà défini dans VaultEntryEntity comme String
// L'extension toEntryType() permet de convertir String → EntryType enum

/**
 * Vérifie si l'entrée a un TOTP configuré
 */
fun VaultEntryEntity.hasTOTP(): Boolean {
    return hasTOTP && encryptedTotpSecret.isNotEmpty()
}

// ========== Fonctions helper pour créer des entrées ==========

/**
 * Crée une VaultEntryEntity à partir de données en clair
 * (Pour le file-based system, les champs "encrypted*" contiennent les données en clair)
 */
fun createVaultEntry(
    id: String = java.util.UUID.randomUUID().toString(),
    vaultId: String,
    folderId: String? = null,
    title: String,
    username: String = "",
    password: String = "",
    url: String = "",
    notes: String = "",
    customFields: String = "",
    entryType: EntryType = EntryType.LOGIN,
    isFavorite: Boolean = false,
    passwordStrength: Int = 0,
    passwordEntropy: Double = 0.0,
    generationMode: String? = null,
    createdAt: Long = System.currentTimeMillis(),
    modifiedAt: Long = System.currentTimeMillis(),
    lastAccessedAt: Long = System.currentTimeMillis(),
    passwordExpiresAt: Long = 0,
    requiresPasswordChange: Boolean = false,
    usageCount: Int = 0,
    icon: String? = null,
    color: String? = null,
    hasTOTP: Boolean = false,
    totpSecret: String = "",
    totpPeriod: Int = 30,
    totpDigits: Int = 6,
    totpAlgorithm: String = "SHA1",
    totpIssuer: String = "",
    hasPasskey: Boolean = false,
    passkeyData: String = "",
    passkeyRpId: String = "",
    passkeyRpName: String = "",
    passkeyUserHandle: String = "",
    passkeyCreatedAt: Long = 0,
    passkeyLastUsedAt: Long = 0
): VaultEntryEntity {
    // Dans le file-based system, on stocke directement en clair dans les champs "encrypted*"
    // car tout le fichier .gpv sera chiffré globalement
    return VaultEntryEntity(
        id = id,
        vaultId = vaultId,
        folderId = folderId,
        encryptedTitle = title,
        titleIv = "", // Non utilisé dans file-based system
        encryptedUsername = username,
        usernameIv = "",
        encryptedPassword = password,
        passwordIv = "",
        encryptedUrl = url,
        urlIv = "",
        encryptedNotes = notes,
        notesIv = "",
        encryptedCustomFields = customFields,
        customFieldsIv = "",
        entryType = entryType.name,
        isFavorite = isFavorite,
        passwordStrength = passwordStrength,
        passwordEntropy = passwordEntropy,
        generationMode = generationMode,
        createdAt = createdAt,
        modifiedAt = modifiedAt,
        lastAccessedAt = lastAccessedAt,
        passwordExpiresAt = passwordExpiresAt,
        requiresPasswordChange = requiresPasswordChange,
        usageCount = usageCount,
        icon = icon,
        color = color,
        hasTOTP = hasTOTP,
        encryptedTotpSecret = totpSecret,
        totpSecretIv = "",
        totpPeriod = totpPeriod,
        totpDigits = totpDigits,
        totpAlgorithm = totpAlgorithm,
        totpIssuer = totpIssuer,
        hasPasskey = hasPasskey,
        encryptedPasskeyData = passkeyData,
        passkeyDataIv = "",
        passkeyRpId = passkeyRpId,
        passkeyRpName = passkeyRpName,
        passkeyUserHandle = passkeyUserHandle,
        passkeyCreatedAt = passkeyCreatedAt,
        passkeyLastUsedAt = passkeyLastUsedAt
    )
}
