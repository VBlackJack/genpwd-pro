package com.julien.genpwdpro.presentation.vault

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.local.entity.VaultEntity
import java.text.SimpleDateFormat
import java.util.*

/**
 * Écran de sélection de vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultSelectorScreen(
    onVaultSelected: (VaultEntity) -> Unit,
    onCreateVault: () -> Unit,
    onNavigateToGenerator: () -> Unit,
    viewModel: VaultViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("GenPwd Pro") },
                actions = {
                    // Menu
                    var showMenu by remember { mutableStateOf(false) }

                    IconButton(onClick = { showMenu = true }) {
                        Icon(Icons.Default.MoreVert, "Menu")
                    }

                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Générateur simple") },
                            onClick = {
                                showMenu = false
                                onNavigateToGenerator()
                            },
                            leadingIcon = { Icon(Icons.Default.Psychology, null) }
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateVault
            ) {
                Icon(Icons.Default.Add, "Créer un vault")
            }
        }
    ) { padding ->
        when (val state = uiState) {
            is VaultUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is VaultUiState.NoVault -> {
                NoVaultsEmptyState(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    onCreateVault = onCreateVault,
                    onUseSimpleGenerator = onNavigateToGenerator
                )
            }

            is VaultUiState.Success -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Titre
                    item {
                        Text(
                            text = "Vos coffres-forts",
                            style = MaterialTheme.typography.headlineSmall,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }

                    // Liste des vaults
                    items(
                        items = state.vaults,
                        key = { it.id }
                    ) { vault ->
                        VaultCard(
                            vault = vault,
                            onClick = { onVaultSelected(vault) }
                        )
                    }
                }
            }

            is VaultUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Text(
                            text = state.message,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            else -> {
                // VaultCreated, VaultUnlocked, VaultLocked - ne devrait pas arriver ici
            }
        }
    }
}

/**
 * Card pour afficher un vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VaultCard(
    vault: VaultEntity,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icône
            Surface(
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(56.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = vault.icon,
                        style = MaterialTheme.typography.headlineMedium
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Infos
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = vault.name,
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (vault.isDefault) {
                        Surface(
                            shape = MaterialTheme.shapes.small,
                            color = MaterialTheme.colorScheme.secondaryContainer
                        ) {
                            Text(
                                text = "Par défaut",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                if (vault.description.isNotEmpty()) {
                    Text(
                        text = vault.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    VaultInfoChip(
                        icon = Icons.Default.Key,
                        text = "${vault.entryCount} entrées"
                    )
                    VaultInfoChip(
                        icon = Icons.Default.Update,
                        text = formatDate(vault.lastAccessedAt)
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Icône déverrouiller
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = "Déverrouiller",
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Chip d'information du vault
 */
@Composable
private fun VaultInfoChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * État vide quand aucun vault
 */
@Composable
private fun NoVaultsEmptyState(
    modifier: Modifier = Modifier,
    onCreateVault: () -> Unit,
    onUseSimpleGenerator: () -> Unit
) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Icône
        Icon(
            imageVector = Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Titre
        Text(
            text = "Bienvenue dans GenPwd Pro",
            style = MaterialTheme.typography.headlineMedium
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Description
        Text(
            text = "Créez votre premier coffre-fort sécurisé pour stocker vos mots de passe, notes et informations sensibles.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Features
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            FeatureItem(
                icon = Icons.Default.Security,
                title = "Chiffrement militaire",
                description = "Argon2id + AES-256-GCM"
            )
            FeatureItem(
                icon = Icons.Default.QrCode,
                title = "2FA / TOTP",
                description = "Authentification à deux facteurs"
            )
            FeatureItem(
                icon = Icons.Default.Psychology,
                title = "Générateur puissant",
                description = "Mots de passe ultra-sécurisés"
            )
            FeatureItem(
                icon = Icons.Default.Cloud,
                title = "Synchronisation cloud",
                description = "Sauvegarde chiffrée (bientôt)"
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Boutons
        Button(
            onClick = onCreateVault,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Créer mon coffre-fort")
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = onUseSimpleGenerator,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Psychology, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Utiliser le générateur simple")
        }
    }
}

/**
 * Item de fonctionnalité
 */
@Composable
private fun FeatureItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    description: String
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
        )
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Formate une date en texte lisible
 */
private fun formatDate(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp

    return when {
        diff < 60_000 -> "À l'instant"
        diff < 3_600_000 -> "${diff / 60_000} min"
        diff < 86_400_000 -> "${diff / 3_600_000} h"
        diff < 604_800_000 -> "${diff / 86_400_000} j"
        else -> {
            val sdf = SimpleDateFormat("dd MMM", Locale.getDefault())
            sdf.format(Date(timestamp))
        }
    }
}
