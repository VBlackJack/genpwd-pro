package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.db.entity.VaultRegistryEntry

/**
 * Dialog rapide pour déverrouiller un coffre sans perdre le contexte actuel
 * Utilisé lors de la sauvegarde de preset ou mot de passe
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickUnlockDialog(
    vaults: List<VaultRegistryEntry>,
    onDismiss: () -> Unit,
    onUnlock: (vaultId: String, password: String) -> Unit,
    isUnlocking: Boolean = false,
    error: String? = null
) {
    var selectedVault by remember { mutableStateOf<VaultRegistryEntry?>(vaults.firstOrNull()) }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var showVaultList by remember { mutableStateOf(vaults.size > 1) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        },
        title = {
            Text(
                if (showVaultList && vaults.size > 1)
                    "Sélectionner un coffre"
                else
                    "Déverrouiller le coffre"
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (showVaultList && vaults.size > 1) {
                    // Liste des coffres disponibles
                    Text(
                        text = "Choisissez le coffre à déverrouiller :",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 300.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(vaults) { vault ->
                            VaultItemCard(
                                vault = vault,
                                isSelected = selectedVault?.id == vault.id,
                                onClick = {
                                    selectedVault = vault
                                    showVaultList = false
                                }
                            )
                        }
                    }
                } else {
                    // Formulaire de déverrouillage
                    selectedVault?.let { vault ->
                        // Nom du coffre sélectionné
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = vault.name,
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                    Text(
                                        text = vault.description ?: "Aucune description",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (vaults.size > 1) {
                                    TextButton(onClick = { showVaultList = true }) {
                                        Text("Changer")
                                    }
                                }
                            }
                        }

                        // Champ mot de passe
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Mot de passe maître") },
                            placeholder = { Text("Entrez le mot de passe") },
                            visualTransformation = if (passwordVisible)
                                VisualTransformation.None
                            else
                                PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    if (password.isNotBlank() && !isUnlocking) {
                                        onUnlock(vault.id, password)
                                    }
                                }
                            ),
                            trailingIcon = {
                                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                    Icon(
                                        imageVector = if (passwordVisible)
                                            Icons.Default.VisibilityOff
                                        else
                                            Icons.Default.Visibility,
                                        contentDescription = if (passwordVisible)
                                            "Masquer le mot de passe"
                                        else
                                            "Afficher le mot de passe"
                                    )
                                }
                            },
                            isError = error != null,
                            supportingText = error?.let { { Text(it) } },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isUnlocking
                        )

                        if (isUnlocking) {
                            LinearProgressIndicator(
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (!showVaultList) {
                Button(
                    onClick = {
                        selectedVault?.let { vault ->
                            onUnlock(vault.id, password)
                        }
                    },
                    enabled = password.isNotBlank() && !isUnlocking && selectedVault != null
                ) {
                    if (isUnlocking) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text("Déverrouiller")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isUnlocking
            ) {
                Text("Annuler")
            }
        }
    )
}

/**
 * Card pour afficher un coffre dans la liste
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VaultItemCard(
    vault: VaultRegistryEntry,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.surface
        ),
        border = if (isSelected)
            CardDefaults.outlinedCardBorder()
        else
            null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = vault.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!vault.description.isNullOrBlank()) {
                    Text(
                        text = vault.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Sélectionné",
                    tint = MaterialTheme.colorScheme.primary
                )
            } else {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
