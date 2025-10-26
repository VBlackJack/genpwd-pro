package com.julien.genpwdpro.presentation.vault

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.data.crypto.TotpGenerator
import com.julien.genpwdpro.data.local.entity.EntryType
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.data.repository.VaultRepository
import com.julien.genpwdpro.domain.analyzer.PasswordAnalyzer
import com.julien.genpwdpro.domain.generators.PasswordGenerator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel pour créer/éditer une entrée de vault
 */
@HiltViewModel
class EntryViewModel @Inject constructor(
    private val vaultRepository: VaultRepository,
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
     */
    fun initForEdit(vaultId: String, entryId: String) {
        currentVaultId = vaultId
        currentEntryId = entryId
        isEditMode = true

        viewModelScope.launch {
            try {
                val entry = vaultRepository.getEntryById(vaultId, entryId)
                if (entry != null) {
                    _entryType.value = entry.entryType
                    _title.value = entry.title
                    _username.value = entry.username
                    _password.value = entry.password
                    _url.value = entry.url
                    _notes.value = entry.notes
                    _isFavorite.value = entry.isFavorite
                    _hasTOTP.value = entry.hasTOTP
                    _totpSecret.value = entry.totpSecret
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
     * Sauvegarde l'entrée
     */
    fun saveEntry() {
        val vaultId = currentVaultId
        if (vaultId == null) {
            _uiState.value = EntryUiState.Error("Vault non sélectionné")
            return
        }

        // Validation
        if (_title.value.isEmpty()) {
            _uiState.value = EntryUiState.Error("Le titre est requis")
            return
        }

        if (_entryType.value == EntryType.LOGIN && _password.value.isEmpty()) {
            _uiState.value = EntryUiState.Error("Le mot de passe est requis")
            return
        }

        viewModelScope.launch {
            _uiState.value = EntryUiState.Saving
            try {
                when (_entryType.value) {
                    EntryType.LOGIN -> {
                        val entry = VaultRepository.DecryptedEntry(
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
                            createdAt = System.currentTimeMillis(),
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

                        if (isEditMode && currentEntryId != null) {
                            vaultRepository.updateEntry(vaultId, entry)
                        } else {
                            vaultRepository.createEntry(vaultId, entry)
                        }
                    }

                    EntryType.NOTE -> {
                        vaultRepository.createSecureNote(
                            vaultId = vaultId,
                            title = _title.value,
                            content = _notes.value,
                            isFavorite = _isFavorite.value
                        )
                    }

                    EntryType.CARD -> {
                        // Pour les cartes, parser customFields si c'est une édition
                        // Sinon créer une nouvelle carte
                        _uiState.value = EntryUiState.Error("La gestion des cartes n'est pas encore implémentée dans l'UI")
                        return@launch
                    }

                    EntryType.IDENTITY -> {
                        _uiState.value = EntryUiState.Error("La gestion des identités n'est pas encore implémentée dans l'UI")
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
