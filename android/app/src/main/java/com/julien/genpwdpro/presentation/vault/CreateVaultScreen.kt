package com.julien.genpwdpro.presentation.vault

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.presentation.utils.SecureWindow

/**
 * Écran de création d'un nouveau vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateVaultScreen(
    onVaultCreated: (String) -> Unit,
    onBackClick: () -> Unit,
    viewModel: VaultViewModel = hiltViewModel()
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var masterPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var setAsDefault by remember { mutableStateOf(true) }
    var enableBiometric by remember { mutableStateOf(false) }

    var showPassword by remember { mutableStateOf(false) }
    var showConfirmPassword by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val uiState by viewModel.uiState.collectAsState()

    // Vérifier si la biométrie est disponible
    val biometricHelper = remember {
        context.getBiometricHelper()
    }
    val isBiometricAvailable = remember {
        biometricHelper?.isBiometricOrCredentialsAvailable() == true
    }

    SecureWindow()

    // Observer les changements d'état
    // IMPORTANT: N'observer QUE uiState (pas masterPassword/enableBiometric)
    LaunchedEffect(uiState) {
        if (uiState is VaultUiState.VaultCreated) {
            val vaultId = (uiState as VaultUiState.VaultCreated).vaultId

            // ATTENDRE que la biométrie soit sauvegardée avant de naviguer
            if (enableBiometric && masterPassword.isNotEmpty()) {
                val success = viewModel.saveBiometricPassword(vaultId, masterPassword)
                if (!success) {
                    android.util.Log.w(
                        "CreateVaultScreen",
                        "Failed to save biometric password for vault $vaultId"
                    )
                }
            }

            onVaultCreated(vaultId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Créer un coffre-fort") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
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
            // Icône et description
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier
                    .size(64.dp)
                    .align(Alignment.CenterHorizontally),
                tint = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Créez votre coffre-fort sécurisé pour stocker vos mots de passe, notes et informations sensibles.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Nom du vault
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nom du coffre-fort") },
                leadingIcon = {
                    Icon(Icons.Default.Folder, contentDescription = null)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                )
            )

            // Description
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Description (optionnel)") },
                leadingIcon = {
                    Icon(Icons.Default.Description, contentDescription = null)
                },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 2,
                keyboardOptions = KeyboardOptions(
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                )
            )

            // Mot de passe maître
            OutlinedTextField(
                value = masterPassword,
                onValueChange = { masterPassword = it },
                label = { Text("Mot de passe maître") },
                leadingIcon = {
                    Icon(Icons.Default.VpnKey, contentDescription = null)
                },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            "Afficher/masquer"
                        )
                    }
                },
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                )
            )

            // Force du mot de passe
            if (masterPassword.isNotEmpty()) {
                val strength = calculatePasswordStrength(masterPassword)
                LinearProgressIndicator(
                    progress = strength / 100f,
                    modifier = Modifier.fillMaxWidth(),
                    color = when {
                        strength < 30 -> MaterialTheme.colorScheme.error
                        strength < 70 -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.primary
                    }
                )
                Text(
                    text = when {
                        strength < 30 -> "Faible - Utilisez au moins 12 caractères avec majuscules, chiffres et symboles"
                        strength < 70 -> "Moyen - Ajoutez plus de variété de caractères"
                        else -> "Fort - Excellent mot de passe !"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = when {
                        strength < 30 -> MaterialTheme.colorScheme.error
                        strength < 70 -> MaterialTheme.colorScheme.onSurfaceVariant
                        else -> MaterialTheme.colorScheme.primary
                    }
                )
            }

            // Confirmer mot de passe
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = { Text("Confirmer le mot de passe") },
                leadingIcon = {
                    Icon(Icons.Default.Check, contentDescription = null)
                },
                trailingIcon = {
                    IconButton(onClick = { showConfirmPassword = !showConfirmPassword }) {
                        Icon(
                            if (showConfirmPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            "Afficher/masquer"
                        )
                    }
                },
                visualTransformation = if (showConfirmPassword) VisualTransformation.None else PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                isError = confirmPassword.isNotEmpty() && confirmPassword != masterPassword,
                supportingText = if (confirmPassword.isNotEmpty() && confirmPassword != masterPassword) {
                    { Text("Les mots de passe ne correspondent pas") }
                } else {
                    null
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = { focusManager.clearFocus() }
                )
            )

            // Définir par défaut
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = setAsDefault,
                    onCheckedChange = { setAsDefault = it }
                )
                Text("Définir comme coffre-fort par défaut")
            }

            // Activer la biométrie
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = enableBiometric,
                    onCheckedChange = { enableBiometric = it },
                    enabled = isBiometricAvailable
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Activer le déverrouillage biométrique",
                        color = if (isBiometricAvailable) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                    if (!isBiometricAvailable) {
                        Text(
                            text = "Non disponible sur cet appareil",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (isBiometricAvailable) {
                    Icon(
                        Icons.Default.Fingerprint,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Avertissement sécurité
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Text(
                        text = "Attention : Si vous oubliez votre mot de passe maître, vos données seront définitivement perdues. Il n'existe aucun moyen de récupération.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            // Bouton créer
            Button(
                onClick = {
                    viewModel.createVault(
                        name = name,
                        masterPassword = masterPassword,
                        description = description,
                        setAsDefault = setAsDefault,
                        biometricUnlockEnabled = enableBiometric
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = name.isNotEmpty() &&
                    masterPassword.isNotEmpty() &&
                    masterPassword == confirmPassword &&
                    masterPassword.length >= 8 &&
                    uiState !is VaultUiState.Loading
            ) {
                if (uiState is VaultUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Créer le coffre-fort")
                }
            }

            // Erreur
            if (uiState is VaultUiState.Error) {
                Text(
                    text = (uiState as VaultUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

/**
 * Calcule la force d'un mot de passe (0-100)
 */
private fun calculatePasswordStrength(password: String): Int {
    if (password.isEmpty()) return 0

    var strength = 0

    // Longueur
    strength += when {
        password.length >= 16 -> 30
        password.length >= 12 -> 20
        password.length >= 8 -> 10
        else -> 0
    }

    // Minuscules
    if (password.any { it.isLowerCase() }) strength += 10

    // Majuscules
    if (password.any { it.isUpperCase() }) strength += 15

    // Chiffres
    if (password.any { it.isDigit() }) strength += 15

    // Symboles
    if (password.any { !it.isLetterOrDigit() }) strength += 20

    // Variété de caractères
    val uniqueChars = password.toSet().size
    strength += (uniqueChars * 0.5).toInt()

    return strength.coerceIn(0, 100)
}
