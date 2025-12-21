package com.julien.genpwdpro.presentation.vault

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.attachments.AttachmentException
import com.julien.genpwdpro.data.attachments.SecureAttachment
import com.julien.genpwdpro.data.attachments.SecureAttachmentManager
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.models.vault.*
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.FileVaultRepository
import com.julien.genpwdpro.domain.analyzer.PasswordAnalyzer
import com.julien.genpwdpro.domain.generators.PasswordGenerator
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

/**
 * ViewModel pour créer/éditer une entrée de vault (nouveau système file-based)
 */
@HiltViewModel
class EntryViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository,
    private val passwordGenerator: PasswordGenerator,
    private val passwordAnalyzer: PasswordAnalyzer,
    private val totpGenerator: TotpGenerator,
    private val attachmentManager: SecureAttachmentManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<EntryUiState>(EntryUiState.Editing)
    val uiState: StateFlow<EntryUiState> = _uiState.asStateFlow()

    private val _entryType = MutableStateFlow(EntryType.LOGIN)
    val entryType: StateFlow<EntryType> = _entryType.asStateFlow()

    private val _title = MutableStateFlow("")
    val title: StateFlow<String> = _title.asStateFlow()

    private val _username = MutableStateFlow("")
    val username: StateFlow<String> = _username.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _url = MutableStateFlow("")
    val url: StateFlow<String> = _url.asStateFlow()

    private val _notes = MutableStateFlow("")
    val notes: StateFlow<String> = _notes.asStateFlow()

    private val _isFavorite = MutableStateFlow(false)
    val isFavorite: StateFlow<Boolean> = _isFavorite.asStateFlow()

    // Tags
    private val _selectedTags = MutableStateFlow<List<TagEntity>>(emptyList())
    val selectedTags: StateFlow<List<TagEntity>> = _selectedTags.asStateFlow()

    private val _availableTags = MutableStateFlow<List<TagEntity>>(emptyList())
    val availableTags: StateFlow<List<TagEntity>> = _availableTags.asStateFlow()

    // TOTP
    private val _hasTOTP = MutableStateFlow(false)
    val hasTOTP: StateFlow<Boolean> = _hasTOTP.asStateFlow()

    private val _totpSecret = MutableStateFlow("")
    val totpSecret: StateFlow<String> = _totpSecret.asStateFlow()

    private val _totpIssuer = MutableStateFlow("")
    val totpIssuer: StateFlow<String> = _totpIssuer.asStateFlow()

    // Password strength
    private val _passwordStrength = MutableStateFlow(0)
    val passwordStrength: StateFlow<Int> = _passwordStrength.asStateFlow()

    private val _passwordEntropy = MutableStateFlow(0.0)
    val passwordEntropy: StateFlow<Double> = _passwordEntropy.asStateFlow()

    // Attachments
    private val _attachments = MutableStateFlow<List<SecureAttachment>>(emptyList())
    val attachments: StateFlow<List<SecureAttachment>> = _attachments.asStateFlow()

    private val _attachmentError = MutableStateFlow<String?>(null)
    val attachmentError: StateFlow<String?> = _attachmentError.asStateFlow()

    private var currentVaultId: String? = null
    private var currentEntryId: String? = null
    private var isEditMode = false

    /**
     * Initialise pour créer une nouvelle entrée
     */
    fun initForCreate(vaultId: String, type: EntryType = EntryType.LOGIN) {
        currentVaultId = vaultId
        currentEntryId = null
        isEditMode = false
        _entryType.value = type
        clearFields()
        loadAvailableTags()
    }

    /**
     * Initialise pour éditer une entrée existante
     * Note: vaultId est conservé pour compatibilité mais FileVaultRepository utilise la session active
     */
    fun initForEdit(vaultId: String, entryId: String) {
        currentVaultId = vaultId
        currentEntryId = entryId
        isEditMode = true
        loadAvailableTags()
        loadAttachments()

        viewModelScope.launch {
            try {
                val entry = fileVaultRepository.getEntryById(entryId)
                if (entry != null) {
                    _entryType.value = entry.entryType.toEntryType() // String → EntryType enum
                    _title.value = entry.title
                    _username.value = entry.username ?: ""
                    _password.value = entry.password ?: ""
                    _url.value = entry.url ?: ""
                    _notes.value = entry.notes ?: ""
                    _isFavorite.value = entry.isFavorite
                    _hasTOTP.value = entry.hasTOTP()
                    _totpSecret.value = entry.totpSecret ?: ""
                    _totpIssuer.value = entry.totpIssuer
                    _passwordStrength.value = entry.passwordStrength
                    _passwordEntropy.value = entry.passwordEntropy

                    // Charger les tags de l'entrée
                    fileVaultRepository.getTagsForEntry(entryId).collect { tags ->
                        _selectedTags.value = tags
                    }
                } else {
                    _uiState.value = EntryUiState.Error("Entrée introuvable")
                }
            } catch (e: Exception) {
                _uiState.value = EntryUiState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    /**
     * Met à jour le titre
     */
    fun updateTitle(value: String) {
        _title.value = value
    }

    /**
     * Met à jour le nom d'utilisateur
     */
    fun updateUsername(value: String) {
        _username.value = value
    }

    /**
     * Met à jour le mot de passe et calcule sa force
     */
    fun updatePassword(value: String) {
        _password.value = value

        // Analyser la force du mot de passe
        if (value.isNotEmpty()) {
            val analysis = passwordAnalyzer.analyze(value)
            _passwordStrength.value = entropyToPercentage(analysis.entropy)
            _passwordEntropy.value = analysis.entropy
        } else {
            _passwordStrength.value = 0
            _passwordEntropy.value = 0.0
        }
    }

    /**
     * Convertit l'entropie (bits) en pourcentage de force (0-100)
     *
     * Échelle d'entropie:
     * - < 30 bits: Très faible (0-20%)
     * - 30-50 bits: Faible (20-40%)
     * - 50-70 bits: Moyen (40-60%)
     * - 70-90 bits: Fort (60-80%)
     * - >= 90 bits: Très fort (80-100%)
     */
    private fun entropyToPercentage(entropy: Double): Int {
        return when {
            entropy < 30 -> (entropy / 30 * 20).toInt().coerceIn(0, 20)
            entropy < 50 -> (20 + (entropy - 30) / 20 * 20).toInt().coerceIn(20, 40)
            entropy < 70 -> (40 + (entropy - 50) / 20 * 20).toInt().coerceIn(40, 60)
            entropy < 90 -> (60 + (entropy - 70) / 20 * 20).toInt().coerceIn(60, 80)
            else -> (80 + (entropy - 90) / 30 * 20).toInt().coerceIn(80, 100)
        }
    }

    /**
     * Met à jour l'URL
     */
    fun updateUrl(value: String) {
        _url.value = value
    }

    /**
     * Met à jour les notes
     */
    fun updateNotes(value: String) {
        _notes.value = value
    }

    /**
     * Toggle favori
     */
    fun toggleFavorite() {
        _isFavorite.value = !_isFavorite.value
    }

    /**
     * Met à jour le secret TOTP
     */
    fun updateTotpSecret(value: String) {
        _totpSecret.value = value
        _hasTOTP.value = value.isNotEmpty()
    }

    /**
     * Parse une URI TOTP (QR code)
     */
    fun parseTotpUri(uri: String) {
        val config = totpGenerator.parseTotpUri(uri)
        if (config != null) {
            _totpSecret.value = config.secret
            _hasTOTP.value = true

            // Extraire l'issuer de l'URI si possible
            val issuerMatch = Regex("issuer=([^&]+)").find(uri)
            if (issuerMatch != null) {
                _totpIssuer.value = java.net.URLDecoder.decode(issuerMatch.groupValues[1], "UTF-8")
            }
        }
    }

    /**
     * Met à jour l'émetteur TOTP
     */
    fun updateTotpIssuer(value: String) {
        _totpIssuer.value = value
    }

    /**
     * Génère un mot de passe aléatoire
     */
    fun generatePassword(settings: Settings) {
        viewModelScope.launch {
            val generated = passwordGenerator.generate(settings)
            updatePassword(generated)
        }
    }

    /**
     * Sauvegarde l'entrée (nouveau système file-based)
     */
    fun saveEntry() {
        val vaultId = currentVaultId
        if (vaultId == null) {
            _uiState.value = EntryUiState.Error("Vault non sélectionné")
            return
        }

        // Validation
        if (_title.value.isEmpty()) {
            _uiState.value = EntryUiState.Error(
                when (_entryType.value) {
                    EntryType.WIFI -> "Le SSID est requis"
                    EntryType.NOTE -> "Le titre est requis"
                    else -> "Le titre est requis"
                }
            )
            return
        }

        if (_entryType.value == EntryType.LOGIN && _password.value.isEmpty()) {
            _uiState.value = EntryUiState.Error("Le mot de passe est requis")
            return
        }

        if (_entryType.value == EntryType.WIFI && _password.value.isEmpty()) {
            _uiState.value = EntryUiState.Error("Le mot de passe WiFi est requis")
            return
        }

        if (_entryType.value == EntryType.NOTE && _notes.value.isEmpty()) {
            _uiState.value = EntryUiState.Error("Le contenu de la note est requis")
            return
        }

        viewModelScope.launch {
            _uiState.value = EntryUiState.Saving
            try {
                when (_entryType.value) {
                    EntryType.LOGIN -> {
                        val entry = VaultEntryEntity(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value,
                            username = _username.value,
                            password = _password.value,
                            url = _url.value,
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.LOGIN.name,
                            isFavorite = _isFavorite.value,
                            passwordStrength = _passwordStrength.value,
                            passwordEntropy = _passwordEntropy.value,
                            generationMode = null,
                            createdAt = if (isEditMode) {
                                // Conserver la date de création originale en mode édition
                                fileVaultRepository.getEntryById(currentEntryId!!)?.createdAt ?: System.currentTimeMillis()
                            } else {
                                System.currentTimeMillis()
                            },
                            modifiedAt = System.currentTimeMillis(),
                            lastAccessedAt = System.currentTimeMillis(),
                            passwordExpiresAt = 0,
                            requiresPasswordChange = false,
                            usageCount = 0,
                            icon = null,
                            color = null,
                            hasTOTP = _hasTOTP.value,
                            totpSecret = _totpSecret.value,
                            totpPeriod = 30,
                            totpDigits = 6,
                            totpAlgorithm = "SHA1",
                            totpIssuer = _totpIssuer.value,
                            hasPasskey = false,
                            passkeyData = "",
                            passkeyRpId = "",
                            passkeyRpName = "",
                            passkeyUserHandle = "",
                            passkeyCreatedAt = 0,
                            passkeyLastUsedAt = 0
                        )

                        val result = if (isEditMode && currentEntryId != null) {
                            fileVaultRepository.updateEntry(entry)
                        } else {
                            fileVaultRepository.addEntry(entry)
                        }

                        result.onFailure { error ->
                            _uiState.value = EntryUiState.Error(
                                error.message ?: "Erreur lors de la sauvegarde"
                            )
                            return@launch
                        }
                    }

                    EntryType.WIFI -> {
                        val entry = VaultEntryEntity(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value, // SSID
                            username = _username.value, // Type de sécurité (WPA2, WPA3, etc.)
                            password = _password.value, // Mot de passe WiFi
                            url = "",
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.WIFI.name,
                            isFavorite = _isFavorite.value,
                            passwordStrength = _passwordStrength.value,
                            passwordEntropy = _passwordEntropy.value,
                            generationMode = null,
                            createdAt = if (isEditMode) {
                                fileVaultRepository.getEntryById(currentEntryId!!)?.createdAt ?: System.currentTimeMillis()
                            } else {
                                System.currentTimeMillis()
                            },
                            modifiedAt = System.currentTimeMillis(),
                            lastAccessedAt = System.currentTimeMillis(),
                            passwordExpiresAt = 0,
                            requiresPasswordChange = false,
                            usageCount = 0,
                            icon = "\uD83D\uDCF6", // 📶 icône WiFi
                            color = null,
                            hasTOTP = false,
                            totpSecret = "",
                            totpPeriod = 30,
                            totpDigits = 6,
                            totpAlgorithm = "SHA1",
                            totpIssuer = "",
                            hasPasskey = false,
                            passkeyData = "",
                            passkeyRpId = "",
                            passkeyRpName = "",
                            passkeyUserHandle = "",
                            passkeyCreatedAt = 0,
                            passkeyLastUsedAt = 0
                        )

                        val result = if (isEditMode && currentEntryId != null) {
                            fileVaultRepository.updateEntry(entry)
                        } else {
                            fileVaultRepository.addEntry(entry)
                        }

                        result.onFailure { error ->
                            _uiState.value = EntryUiState.Error(
                                error.message ?: "Erreur lors de la sauvegarde"
                            )
                            return@launch
                        }
                    }

                    EntryType.NOTE -> {
                        // Créer une note sécurisée
                        val entry = VaultEntryEntity(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value,
                            username = "",
                            password = "",
                            url = "",
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.NOTE.name,
                            isFavorite = _isFavorite.value,
                            passwordStrength = 0,
                            passwordEntropy = 0.0,
                            generationMode = null,
                            createdAt = if (isEditMode) {
                                fileVaultRepository.getEntryById(currentEntryId!!)?.createdAt ?: System.currentTimeMillis()
                            } else {
                                System.currentTimeMillis()
                            },
                            modifiedAt = System.currentTimeMillis(),
                            lastAccessedAt = System.currentTimeMillis(),
                            icon = "\uD83D\uDCDD" // 📝 icône note
                        )

                        val result = if (isEditMode && currentEntryId != null) {
                            fileVaultRepository.updateEntry(entry)
                        } else {
                            fileVaultRepository.addEntry(entry)
                        }

                        result.onFailure { error ->
                            _uiState.value = EntryUiState.Error(
                                error.message ?: "Erreur lors de la sauvegarde"
                            )
                            return@launch
                        }
                    }

                    EntryType.CARD -> {
                        // Pour les cartes, parser customFields si c'est une édition
                        // Sinon créer une nouvelle carte
                        _uiState.value = EntryUiState.Error(
                            "La gestion des cartes n'est pas encore implémentée dans l'UI"
                        )
                        return@launch
                    }

                    EntryType.IDENTITY -> {
                        _uiState.value = EntryUiState.Error(
                            "La gestion des identités n'est pas encore implémentée dans l'UI"
                        )
                        return@launch
                    }
                }

                _uiState.value = EntryUiState.Saved
            } catch (e: Exception) {
                _uiState.value = EntryUiState.Error(e.message ?: "Erreur lors de la sauvegarde")
            }
        }
    }

    /**
     * Supprime l'entrée courante
     */
    fun deleteEntry() {
        val entryId = currentEntryId
        if (entryId == null) {
            _uiState.value = EntryUiState.Error("Aucune entrée à supprimer")
            return
        }

        viewModelScope.launch {
            _uiState.value = EntryUiState.Saving
            try {
                val result = fileVaultRepository.deleteEntry(entryId)
                result.onSuccess {
                    _uiState.value = EntryUiState.Saved
                }.onFailure { error ->
                    _uiState.value = EntryUiState.Error(
                        error.message ?: "Erreur lors de la suppression"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = EntryUiState.Error(e.message ?: "Erreur lors de la suppression")
            }
        }
    }

    /**
     * Réinitialise les champs
     */
    private fun clearFields() {
        _title.value = ""
        _username.value = ""
        _password.value = ""
        _url.value = ""
        _notes.value = ""
        _isFavorite.value = false
        _hasTOTP.value = false
        _totpSecret.value = ""
        _totpIssuer.value = ""
        _passwordStrength.value = 0
        _passwordEntropy.value = 0.0
        _attachments.value = emptyList()
        _attachmentError.value = null
        _uiState.value = EntryUiState.Editing
    }

    /**
     * Charge tous les tags disponibles du vault
     */
    fun loadAvailableTags() {
        viewModelScope.launch {
            fileVaultRepository.getTags().collect { tags ->
                _availableTags.value = tags
            }
        }
    }

    /**
     * Ajoute un tag à l'entrée
     */
    fun addTag(tag: TagEntity) {
        val current = _selectedTags.value.toMutableList()
        if (!current.any { it.id == tag.id }) {
            current.add(tag)
            _selectedTags.value = current
        }
    }

    /**
     * Retire un tag de l'entrée
     */
    fun removeTag(tag: TagEntity) {
        _selectedTags.value = _selectedTags.value.filter { it.id != tag.id }
    }

    /**
     * Crée un nouveau tag
     */
    fun createTag(name: String, color: String) {
        viewModelScope.launch {
            val tag = TagEntity(
                id = java.util.UUID.randomUUID().toString(),
                vaultId = currentVaultId ?: return@launch,
                name = name,
                color = color
            )
            fileVaultRepository.addTag(tag).onSuccess {
                // Le tag sera automatiquement ajouté via le flow de loadAvailableTags
            }
        }
    }

    // ==================== Attachments ====================

    /**
     * Charge les pièces jointes de l'entrée courante
     */
    private fun loadAttachments() {
        val entryId = currentEntryId ?: return
        viewModelScope.launch {
            try {
                val attachmentList = attachmentManager.getAttachmentsForEntry(entryId)
                _attachments.value = attachmentList
            } catch (e: Exception) {
                _attachmentError.value = "Erreur de chargement des pièces jointes"
            }
        }
    }

    /**
     * Ajoute une pièce jointe à l'entrée
     *
     * @param uri URI du fichier à ajouter
     */
    fun addAttachment(uri: Uri) {
        val entryId = currentEntryId
        if (entryId == null) {
            _attachmentError.value = "Veuillez d'abord sauvegarder l'entrée"
            return
        }

        viewModelScope.launch {
            try {
                _attachmentError.value = null
                val attachment = attachmentManager.addAttachment(entryId, uri)
                _attachments.value = _attachments.value + attachment
            } catch (e: AttachmentException) {
                _attachmentError.value = e.message
            } catch (e: Exception) {
                _attachmentError.value = "Erreur lors de l'ajout de la pièce jointe"
            }
        }
    }

    /**
     * Supprime une pièce jointe
     *
     * @param attachmentId ID de la pièce jointe à supprimer
     */
    fun deleteAttachment(attachmentId: String) {
        viewModelScope.launch {
            try {
                val attachment = _attachments.value.find { it.id == attachmentId }
                if (attachment != null) {
                    attachmentManager.deleteAttachment(attachment)
                    _attachments.value = _attachments.value.filter { it.id != attachmentId }
                }
            } catch (e: Exception) {
                _attachmentError.value = "Erreur lors de la suppression"
            }
        }
    }

    /**
     * Récupère les données déchiffrées d'une pièce jointe
     *
     * @param attachmentId ID de la pièce jointe
     * @return Données déchiffrées ou null en cas d'erreur
     */
    suspend fun getAttachmentData(attachmentId: String): ByteArray? {
        return try {
            val attachment = _attachments.value.find { it.id == attachmentId }
            if (attachment != null) {
                attachmentManager.getAttachment(attachment)
            } else {
                null
            }
        } catch (e: Exception) {
            _attachmentError.value = "Erreur lors de la lecture de la pièce jointe"
            null
        }
    }

    /**
     * Efface l'erreur d'attachment
     */
    fun clearAttachmentError() {
        _attachmentError.value = null
    }
}

/**
 * États de l'UI de l'entrée
 */
sealed class EntryUiState {
    object Editing : EntryUiState()
    object Saving : EntryUiState()
    object Saved : EntryUiState()
    data class Error(val message: String) : EntryUiState()
}
