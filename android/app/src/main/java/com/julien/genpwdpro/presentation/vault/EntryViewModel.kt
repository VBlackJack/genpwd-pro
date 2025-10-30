package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.db.entity.*
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
    private val totpGenerator: TotpGenerator
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
    }

    /**
     * Initialise pour éditer une entrée existante
     * Note: vaultId est conservé pour compatibilité mais FileVaultRepository utilise la session active
     */
    fun initForEdit(vaultId: String, entryId: String) {
        currentVaultId = vaultId
        currentEntryId = entryId
        isEditMode = true

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
            _passwordStrength.value = analysis.strength.ordinal
            _passwordEntropy.value = analysis.entropy
        } else {
            _passwordStrength.value = 0
            _passwordEntropy.value = 0.0
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
                        val entry = createVaultEntry(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value,
                            username = _username.value,
                            password = _password.value,
                            url = _url.value,
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.LOGIN,
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
                        val entry = createVaultEntry(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value, // SSID
                            username = _username.value, // Type de sécurité (WPA2, WPA3, etc.)
                            password = _password.value, // Mot de passe WiFi
                            url = "",
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.WIFI,
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
                        val entry = createVaultEntry(
                            id = currentEntryId ?: java.util.UUID.randomUUID().toString(),
                            vaultId = vaultId,
                            folderId = null,
                            title = _title.value,
                            username = "",
                            password = "",
                            url = "",
                            notes = _notes.value,
                            customFields = "",
                            entryType = EntryType.NOTE,
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
        _uiState.value = EntryUiState.Editing
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
