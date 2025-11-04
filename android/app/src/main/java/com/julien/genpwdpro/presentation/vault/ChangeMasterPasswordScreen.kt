package com.julien.genpwdpro.presentation.vault

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.domain.session.VaultSessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Data class for password strength evaluation
 */
private data class PasswordStrength(
    val score: Int,
    val label: String,
    val color: Color
)

/**
 * Écran de changement du mot de passe maître
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangeMasterPasswordScreen(
    vaultId: String,
    onNavigateBack: () -> Unit,
    onPasswordChanged: () -> Unit,
    viewModel: ChangeMasterPasswordViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val activity = context as? androidx.fragment.app.FragmentActivity
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Check biometric availability
    val biometricAvailable = remember(activity) {
        activity != null
    }

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    var showCurrentPassword by remember { mutableStateOf(false) }
    var showNewPassword by remember { mutableStateOf(false) }
    var showConfirmPassword by remember { mutableStateOf(false) }

    // Calcul amélioré de la force du mot de passe avec complexité
    val passwordStrength = remember(newPassword) {
        if (newPassword.isEmpty()) {
            null
        } else {
            calculatePasswordStrength(newPassword)
        }
    }

    // Afficher les erreurs dans le snackbar
    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(
                message = it,
                duration = SnackbarDuration.Long
            )
            viewModel.clearError()
        }
    }

    // Succès (seulement si pas de dialog biométrique)
    LaunchedEffect(uiState.success) {
        if (uiState.success && !uiState.showBiometricReenrollDialog) {
            onPasswordChanged()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Changer le mot de passe maître") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Avertissement
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error
                    )
                    Column {
                        Text(
                            text = "Attention",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = "Le changement du mot de passe maître ne peut pas être annulé. " +
                                    "Assurez-vous de vous souvenir du nouveau mot de passe, " +
                                    "sinon vous perdrez l'accès à vos données.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            // Info biométrie
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Default.Fingerprint,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary
                    )
                    Column {
                        Text(
                            text = "Déverrouillage biométrique",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Text(
                            text = "Si vous utilisez la biométrie, elle sera désactivée. " +
                                    "Vous pourrez la réactiver après le changement de mot de passe.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                }
            }

            // Mot de passe actuel
            OutlinedTextField(
                value = currentPassword,
                onValueChange = { currentPassword = it },
                label = { Text("Mot de passe actuel") },
                placeholder = { Text("Entrez votre mot de passe actuel") },
                visualTransformation = if (showCurrentPassword) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                trailingIcon = {
                    IconButton(onClick = { showCurrentPassword = !showCurrentPassword }) {
                        Icon(
                            if (showCurrentPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            "Afficher/Masquer"
                        )
                    }
                },
                leadingIcon = {
                    Icon(Icons.Default.Lock, null)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !uiState.isLoading
            )

            Divider()

            // Nouveau mot de passe
            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it },
                label = { Text("Nouveau mot de passe") },
                placeholder = { Text("Choisissez un nouveau mot de passe") },
                visualTransformation = if (showNewPassword) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                trailingIcon = {
                    IconButton(onClick = { showNewPassword = !showNewPassword }) {
                        Icon(
                            if (showNewPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            "Afficher/Masquer"
                        )
                    }
                },
                leadingIcon = {
                    Icon(Icons.Default.VpnKey, null)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !uiState.isLoading,
                supportingText = {
                    Text("Minimum 8 caractères recommandés")
                }
            )

            // Indicateur de force du mot de passe
            passwordStrength?.let { strength ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = when {
                            strength.score >= 80 -> MaterialTheme.colorScheme.primaryContainer
                            strength.score >= 60 -> MaterialTheme.colorScheme.tertiaryContainer
                            strength.score >= 40 -> MaterialTheme.colorScheme.secondaryContainer
                            else -> MaterialTheme.colorScheme.errorContainer
                        }
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Force : ${strength.label}",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = strength.color
                            )
                            Text(
                                text = "${strength.score}/100",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                        LinearProgressIndicator(
                            progress = strength.score / 100f,
                            modifier = Modifier.fillMaxWidth(),
                            color = strength.color
                        )
                    }
                }
            }

            // Confirmer le mot de passe
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = { Text("Confirmer le nouveau mot de passe") },
                placeholder = { Text("Retapez le nouveau mot de passe") },
                visualTransformation = if (showConfirmPassword) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                trailingIcon = {
                    IconButton(onClick = { showConfirmPassword = !showConfirmPassword }) {
                        Icon(
                            if (showConfirmPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            "Afficher/Masquer"
                        )
                    }
                },
                leadingIcon = {
                    Icon(Icons.Default.Check, null)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                enabled = !uiState.isLoading,
                isError = confirmPassword.isNotEmpty() && newPassword != confirmPassword,
                supportingText = {
                    if (confirmPassword.isNotEmpty() && newPassword != confirmPassword) {
                        Text("Les mots de passe ne correspondent pas")
                    }
                }
            )

            Spacer(Modifier.height(8.dp))

            // Bouton de confirmation
            Button(
                onClick = {
                    viewModel.changeMasterPassword(
                        vaultId = vaultId,
                        currentPassword = currentPassword,
                        newPassword = newPassword
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading &&
                        currentPassword.isNotEmpty() &&
                        newPassword.isNotEmpty() &&
                        newPassword == confirmPassword &&
                        newPassword.length >= 8 &&
                        (passwordStrength?.score ?: 0) >= 40
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text(if (uiState.isLoading) "Modification en cours..." else "Changer le mot de passe")
            }
        }
    }

    // Dialog pour réactiver la biométrie
    if (uiState.showBiometricReenrollDialog) {
        val password = uiState.newPassword
        if (password != null) {
            AlertDialog(
                onDismissRequest = { viewModel.dismissBiometricDialog() },
                icon = { Icon(Icons.Default.Fingerprint, null, tint = MaterialTheme.colorScheme.primary) },
                title = { Text("Réactiver la biométrie ?") },
                text = {
                    if (biometricAvailable) {
                        Text(
                            "Le déverrouillage biométrique a été désactivé suite au changement de mot de passe. " +
                                    "Voulez-vous le réactiver maintenant avec votre nouveau mot de passe ?"
                        )
                    } else {
                        Text(
                            text = "La biométrie n'est pas disponible sur cet appareil ou dans ce contexte.",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            activity?.let {
                                viewModel.enableBiometric(it, vaultId, password)
                            } ?: run {
                                // Show error if activity is null
                                viewModel.dismissBiometricDialog()
                            }
                        },
                        enabled = biometricAvailable
                    ) {
                        Icon(Icons.Default.Fingerprint, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Réactiver")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.dismissBiometricDialog() }) {
                        Text("Plus tard")
                    }
                }
            )
        }
    }
}

/**
 * Calculate password strength with proper complexity check
 * Evaluates length, lowercase, uppercase, digits, and special characters
 */
private fun calculatePasswordStrength(password: String): PasswordStrength {
    var score = 0

    // Length scoring (max 60 points)
    score += when {
        password.length < 8 -> 10
        password.length < 12 -> 25
        password.length < 16 -> 40
        password.length < 20 -> 50
        else -> 60
    }

    // Complexity scoring (10 points each, max 40 points)
    if (password.any { it.isLowerCase() }) score += 10
    if (password.any { it.isUpperCase() }) score += 10
    if (password.any { it.isDigit() }) score += 10
    if (password.any { !it.isLetterOrDigit() }) score += 10

    // Determine label and color based on score
    val (label, color) = when {
        score < 30 -> Pair("Très faible", Color(0xFFD32F2F)) // Red
        score < 50 -> Pair("Faible", Color(0xFFFF6B6B)) // Light Red
        score < 70 -> Pair("Moyen", Color(0xFFFFA500)) // Orange
        score < 90 -> Pair("Bon", Color(0xFF66BB6A)) // Light Green
        else -> Pair("Excellent", Color(0xFF4CAF50)) // Green
    }

    return PasswordStrength(score, label, color)
}

/**
 * UI State pour le changement de mot de passe
 */
data class ChangeMasterPasswordUiState(
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null,
    val showBiometricReenrollDialog: Boolean = false,
    val newPassword: String? = null
)

/**
 * ViewModel pour le changement de mot de passe maître
 */
@HiltViewModel
class ChangeMasterPasswordViewModel @Inject constructor(
    private val vaultSessionManager: VaultSessionManager,
    private val fileVaultRepository: com.julien.genpwdpro.data.repository.FileVaultRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChangeMasterPasswordUiState())
    val uiState: StateFlow<ChangeMasterPasswordUiState> = _uiState.asStateFlow()

    fun changeMasterPassword(vaultId: String, currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                // Vérifier que le vault est déverrouillé
                if (!vaultSessionManager.isVaultUnlocked()) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Le coffre doit être déverrouillé"
                    )
                    return@launch
                }

                // Changer le mot de passe via le session manager
                val result = vaultSessionManager.changeMasterPassword(
                    currentPassword = currentPassword,
                    newPassword = newPassword
                )

                result.fold(
                    onSuccess = {
                        // Proposer de réactiver la biométrie
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            showBiometricReenrollDialog = true,
                            newPassword = newPassword
                        )
                    },
                    onFailure = { exception ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = exception.message ?: "Erreur lors du changement de mot de passe"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Erreur inattendue"
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun dismissBiometricDialog() {
        _uiState.value = _uiState.value.copy(
            showBiometricReenrollDialog = false,
            success = true
        )
    }

    fun enableBiometric(activity: androidx.fragment.app.FragmentActivity, vaultId: String, password: String) {
        viewModelScope.launch {
            try {
                val result = fileVaultRepository.enableBiometric(activity, vaultId, password)
                result.fold(
                    onSuccess = {
                        _uiState.value = _uiState.value.copy(
                            showBiometricReenrollDialog = false,
                            success = true
                        )
                    },
                    onFailure = { exception ->
                        _uiState.value = _uiState.value.copy(
                            showBiometricReenrollDialog = false,
                            error = exception.message ?: "Erreur lors de l'activation de la biométrie",
                            success = true
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    showBiometricReenrollDialog = false,
                    error = e.message ?: "Erreur inattendue",
                    success = true
                )
            }
        }
    }
}
