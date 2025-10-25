package com.julien.genpwd-pro.presentation.screens.security

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.security.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Écran de configuration de la sécurité
 *
 * Fonctionnalités:
 * - Authentification biométrique
 * - Verrouillage automatique de l'application
 * - Informations sur le Keystore matériel
 * - Gestion des clés de chiffrement
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecuritySettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: SecuritySettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    var showTimeoutDialog by remember { mutableStateOf(false) }

    // Vérifier le statut biométrique au démarrage
    LaunchedEffect(Unit) {
        viewModel.checkBiometricAvailability(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sécurité") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // État de la biométrie
            BiometricStatusCard(
                availability = uiState.biometricAvailability,
                isEnabled = uiState.isBiometricEnabled
            )

            // Verrouillage de l'application
            if (uiState.biometricAvailability == BiometricAvailability.AVAILABLE) {
                AppLockCard(
                    isEnabled = uiState.isAppLockEnabled,
                    timeout = uiState.lockTimeout,
                    onToggle = {
                        if (it && context is FragmentActivity) {
                            viewModel.toggleAppLock(context, it)
                        } else {
                            viewModel.toggleAppLock(context, false)
                        }
                    },
                    onTimeoutClick = { showTimeoutDialog = true },
                    getTimeoutName = { viewModel.getTimeoutDisplayName(it) }
                )
            }

            // Informations Keystore
            KeystoreInfoCard(
                isHardwareBacked = uiState.isHardwareBackedKeystore,
                keyCount = uiState.keystoreKeyCount
            )

            // Actions de sécurité
            SecurityActionsCard(
                onDeleteKeys = {
                    viewModel.deleteAllKeys()
                    kotlinx.coroutines.GlobalScope.launch {
                        snackbarHostState.showSnackbar("Toutes les clés ont été supprimées")
                    }
                }
            )

            // Bonnes pratiques de sécurité
            SecurityTipsCard()
        }

        // Dialogue de sélection du délai
        if (showTimeoutDialog) {
            TimeoutSelectionDialog(
                currentTimeout = uiState.lockTimeout,
                timeouts = viewModel.getAllTimeouts(),
                onDismiss = { showTimeoutDialog = false },
                onSelect = { timeout ->
                    viewModel.setLockTimeout(timeout)
                    showTimeoutDialog = false
                }
            )
        }
    }
}

/**
 * Carte de statut biométrique
 */
@Composable
private fun BiometricStatusCard(
    availability: BiometricAvailability,
    isEnabled: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (availability) {
                BiometricAvailability.AVAILABLE -> MaterialTheme.colorScheme.primaryContainer
                BiometricAvailability.NONE_ENROLLED -> MaterialTheme.colorScheme.tertiaryContainer
                else -> MaterialTheme.colorScheme.errorContainer
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = when (availability) {
                        BiometricAvailability.AVAILABLE -> Icons.Default.Fingerprint
                        else -> Icons.Default.Warning
                    },
                    contentDescription = null
                )
                Text(
                    text = "Authentification biométrique",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = when (availability) {
                    BiometricAvailability.AVAILABLE -> "✅ Disponible et prête"
                    BiometricAvailability.NO_HARDWARE -> "❌ Pas de capteur biométrique"
                    BiometricAvailability.HARDWARE_UNAVAILABLE -> "⚠️ Capteur temporairement indisponible"
                    BiometricAvailability.NONE_ENROLLED -> "⚠️ Aucune biométrie enregistrée"
                    BiometricAvailability.SECURITY_UPDATE_REQUIRED -> "⚠️ Mise à jour de sécurité requise"
                    BiometricAvailability.UNSUPPORTED -> "❌ Non supporté"
                    BiometricAvailability.UNKNOWN -> "❓ État inconnu"
                },
                style = MaterialTheme.typography.bodyMedium
            )

            if (availability == BiometricAvailability.NONE_ENROLLED) {
                Text(
                    text = "Configurez une empreinte digitale ou reconnaissance faciale dans les paramètres de votre appareil",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
        }
    }
}

/**
 * Carte de verrouillage de l'application
 */
@Composable
private fun AppLockCard(
    isEnabled: Boolean,
    timeout: Long,
    onToggle: (Boolean) -> Unit,
    onTimeoutClick: () -> Unit,
    getTimeoutName: (Long) -> String
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Verrouillage automatique",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (isEnabled) "L'app se verrouille après inactivité" else "Désactivé",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                </Column>
                Switch(
                    checked = isEnabled,
                    onCheckedChange = onToggle
                )
            }

            if (isEnabled) {
                Divider()

                // Sélection du délai
                OutlinedButton(
                    onClick = onTimeoutClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Timer, null, Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Délai: ${getTimeoutName(timeout)}")
                }

                Text(
                    text = "L'app demandera l'authentification biométrique après ce délai d'inactivité",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Carte d'informations Keystore
 */
@Composable
private fun KeystoreInfoCard(
    isHardwareBacked: Boolean,
    keyCount: Int
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Key, null)
                Text(
                    text = "Android Keystore",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Stockage matériel sécurisé:", style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = if (isHardwareBacked) "✅ Oui (TEE/SE)" else "⚠️ Software",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Clés stockées:", style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = "$keyCount",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = if (isHardwareBacked) {
                    "Vos clés sont stockées dans un environnement d'exécution de confiance (TEE) ou un élément sécurisé (SE). Elles ne peuvent pas être extraites."
                } else {
                    "Vos clés sont stockées de manière sécurisée mais sans protection matérielle."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Carte des actions de sécurité
 */
@Composable
private fun SecurityActionsCard(
    onDeleteKeys: () -> Unit
) {
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Actions de sécurité",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            OutlinedButton(
                onClick = { showDeleteConfirmation = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.DeleteForever, null, Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Supprimer toutes les clés")
            }

            Text(
                text = "⚠️ Cette action supprimera toutes les clés de chiffrement. Les données chiffrées ne pourront plus être déchiffrées.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }

    // Dialogue de confirmation
    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Confirmer la suppression") },
            text = { Text("Êtes-vous sûr de vouloir supprimer toutes les clés de chiffrement ? Cette action est irréversible.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDeleteKeys()
                        showDeleteConfirmation = false
                    }
                ) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text("Annuler")
                }
            }
        )
    }
}

/**
 * Carte des conseils de sécurité
 */
@Composable
private fun SecurityTipsCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Lightbulb, null)
                Text(
                    text = "Bonnes pratiques",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            val tips = listOf(
                "🔐 Activez le verrouillage automatique pour protéger vos mots de passe",
                "👆 Configurez une empreinte digitale pour plus de sécurité",
                "⏱️ Choisissez un délai de verrouillage court (1-5 minutes)",
                "🔑 Le Keystore matériel protège vos clés contre l'extraction",
                "📱 Verrouillez votre téléphone avec un code PIN fort",
                "🔄 Mettez à jour régulièrement votre système Android"
            )

            tips.forEach { tip ->
                Text(
                    text = tip,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}

/**
 * Dialogue de sélection du délai
 */
@Composable
private fun TimeoutSelectionDialog(
    currentTimeout: Long,
    timeouts: List<LockTimeout>,
    onDismiss: () -> Unit,
    onSelect: (Long) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Délai de verrouillage") },
        text = {
            Column {
                timeouts.forEach { timeout ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = timeout.milliseconds == currentTimeout,
                            onClick = { onSelect(timeout.milliseconds) }
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(timeout.displayName)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fermer")
            }
        }
    )
}

/**
 * ViewModel pour la sécurité
 */
@HiltViewModel
class SecuritySettingsViewModel @Inject constructor(
    private val biometricManager: BiometricManager,
    private val keystoreManager: KeystoreManager,
    private val appLockManager: AppLockManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(SecuritySettingsUiState())
    val uiState: StateFlow<SecuritySettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // Observer l'état du verrouillage
            appLockManager.isAppLockEnabled.collect { enabled ->
                _uiState.update { it.copy(isAppLockEnabled = enabled) }
            }
        }

        viewModelScope.launch {
            // Observer le délai de verrouillage
            appLockManager.lockTimeout.collect { timeout ->
                _uiState.update { it.copy(lockTimeout = timeout) }
            }
        }

        viewModelScope.launch {
            // Vérifier le Keystore matériel
            val isHardware = keystoreManager.isHardwareBackedKeystore()
            val keyCount = keystoreManager.listKeys().size

            _uiState.update {
                it.copy(
                    isHardwareBackedKeystore = isHardware,
                    keystoreKeyCount = keyCount
                )
            }
        }
    }

    fun checkBiometricAvailability(context: Context) {
        val availability = biometricManager.isBiometricAvailable(context)
        _uiState.update {
            it.copy(
                biometricAvailability = availability,
                isBiometricEnabled = availability == BiometricAvailability.AVAILABLE
            )
        }
    }

    fun toggleAppLock(context: Context, enabled: Boolean) {
        if (enabled && context is FragmentActivity) {
            // Demander l'authentification biométrique pour activer
            biometricManager.authenticate(
                activity = context,
                title = "Activer le verrouillage",
                subtitle = "Authentifiez-vous pour activer le verrouillage de l'application",
                onSuccess = {
                    viewModelScope.launch {
                        appLockManager.setAppLockEnabled(true)
                    }
                },
                onError = { _, _ ->
                    // Échec de l'authentification
                }
            )
        } else {
            viewModelScope.launch {
                appLockManager.setAppLockEnabled(false)
            }
        }
    }

    fun setLockTimeout(timeoutMs: Long) {
        viewModelScope.launch {
            appLockManager.setLockTimeout(timeoutMs)
        }
    }

    fun deleteAllKeys() {
        keystoreManager.deleteAllKeys()
        _uiState.update { it.copy(keystoreKeyCount = 0) }
    }

    fun getTimeoutDisplayName(timeoutMs: Long): String {
        return appLockManager.getTimeoutDisplayName(timeoutMs)
    }

    fun getAllTimeouts(): List<LockTimeout> {
        return appLockManager.getAllTimeouts()
    }
}

/**
 * État de l'UI
 */
data class SecuritySettingsUiState(
    val biometricAvailability: BiometricAvailability = BiometricAvailability.UNKNOWN,
    val isBiometricEnabled: Boolean = false,
    val isAppLockEnabled: Boolean = false,
    val lockTimeout: Long = AppLockManager.TIMEOUT_1_MINUTE,
    val isHardwareBackedKeystore: Boolean = false,
    val keystoreKeyCount: Int = 0
)
