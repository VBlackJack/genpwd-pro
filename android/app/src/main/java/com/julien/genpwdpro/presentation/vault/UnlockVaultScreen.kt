package com.julien.genpwdpro.presentation.vault

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.local.entity.VaultEntity

/**
 * Écran de déverrouillage d'un vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UnlockVaultScreen(
    vaultId: String,
    onVaultUnlocked: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: VaultViewModel = hiltViewModel()
) {
    var masterPassword by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var attempts by remember { mutableStateOf(0) }
    var vault by remember { mutableStateOf<VaultEntity?>(null) }
    var biometricErrorMessage by remember { mutableStateOf<String?>(null) }

    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val uiState by viewModel.uiState.collectAsState()

    // BiometricHelper (nécessite FragmentActivity)
    val biometricHelper = remember {
        (context as? FragmentActivity)?.let { BiometricHelper(it) }
    }

    // Charger le vault
    LaunchedEffect(vaultId) {
        vault = viewModel.getVaultById(vaultId)
    }

    // Observer les changements d'état
    LaunchedEffect(uiState) {
        when (uiState) {
            is VaultUiState.VaultUnlocked -> {
                onVaultUnlocked()
            }
            is VaultUiState.Error -> {
                attempts++
                masterPassword = "" // Effacer le mot de passe après erreur
            }
            else -> {}
        }
    }

    // Afficher un loader pendant le chargement du vault
    val currentVault = vault
    if (currentVault == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Déverrouiller") },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Icône du vault
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Nom du vault
            Text(
                text = currentVault.name,
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center
            )

            if (currentVault.description.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = currentVault.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Statistiques du vault
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                VaultStatChip(
                    icon = Icons.Default.Key,
                    label = "${currentVault.entryCount} entrées"
                )
                VaultStatChip(
                    icon = Icons.Default.Update,
                    label = formatLastAccess(currentVault.lastAccessedAt)
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Champ mot de passe
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
                isError = uiState is VaultUiState.Error,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        if (masterPassword.isNotEmpty()) {
                            viewModel.unlockVault(currentVault.id, masterPassword)
                        }
                    }
                )
            )

            // Message d'erreur
            if (uiState is VaultUiState.Error) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = (uiState as VaultUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )

                if (attempts >= 3) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
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
                                text = "Plusieurs tentatives échouées. Assurez-vous d'utiliser le bon mot de passe.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Bouton déverrouiller
            Button(
                onClick = {
                    viewModel.unlockVault(currentVault.id, masterPassword)
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = masterPassword.isNotEmpty() && uiState !is VaultUiState.Loading
            ) {
                if (uiState is VaultUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Icon(Icons.Default.LockOpen, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Déverrouiller")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Bouton biométrie
            OutlinedButton(
                onClick = {
                    biometricErrorMessage = null
                    biometricHelper?.showBiometricPrompt(
                        title = "Déverrouiller le coffre-fort",
                        subtitle = currentVault.name,
                        description = "Authentifiez-vous pour accéder à vos mots de passe",
                        allowDeviceCredentials = true,
                        onSuccess = {
                            // Succès : déverrouiller le vault sans master password
                            // Note: En production, il faudrait stocker le master password
                            // chiffré avec le keystore Android pour le récupérer ici
                            onVaultUnlocked()
                        },
                        onError = { errorCode, errorMessage ->
                            // Gérer l'erreur
                            if (errorCode != BiometricHelper.ERROR_CANCELED &&
                                errorCode != BiometricHelper.ERROR_USER_CANCELED &&
                                errorCode != BiometricHelper.ERROR_NEGATIVE_BUTTON
                            ) {
                                biometricErrorMessage = BiometricHelper.getErrorMessage(errorCode)
                            }
                        }
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = currentVault.biometricUnlockEnabled && biometricHelper != null && uiState !is VaultUiState.Loading
            ) {
                Icon(Icons.Default.Fingerprint, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    when {
                        biometricHelper == null -> "Biométrie non disponible"
                        !currentVault.biometricUnlockEnabled -> "Biométrie non configurée"
                        else -> "Utiliser la biométrie"
                    }
                )
            }

            // Message d'erreur biométrique
            if (biometricErrorMessage != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Text(
                            text = biometricErrorMessage!!,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Info sécurité
            Text(
                text = "🔒 Chiffrement AES-256-GCM • Argon2id",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Chip pour afficher une statistique du vault
 */
@Composable
private fun VaultStatChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Surface(
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Formate le dernier accès en texte lisible
 */
private fun formatLastAccess(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> "À l'instant"
        diff < 3_600_000 -> "${diff / 60_000}min"
        diff < 86_400_000 -> "${diff / 3_600_000}h"
        diff < 604_800_000 -> "${diff / 86_400_000}j"
        else -> "${diff / 604_800_000}sem"
    }
}
