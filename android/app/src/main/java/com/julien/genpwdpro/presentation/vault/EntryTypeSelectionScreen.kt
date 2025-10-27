package com.julien.genpwdpro.presentation.vault

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.local.entity.EntryType

/**
 * Écran de sélection du type d'entrée à créer
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntryTypeSelectionScreen(
    vaultId: String,
    initialPassword: String? = null,
    onTypeSelected: (EntryType) -> Unit,
    onBackClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Enregistrer le mot de passe") },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Choisissez le type de fiche",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(vertical = 8.dp)
            )

            Text(
                text = "Sélectionnez le format le plus adapté pour enregistrer cette information.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(8.dp))

            // Carte de connexion classique
            EntryTypeCard(
                icon = Icons.Default.Key,
                title = "Connexion",
                description = "Identifiant et mot de passe pour sites web et applications",
                onClick = { onTypeSelected(EntryType.LOGIN) }
            )

            // Carte WiFi
            EntryTypeCard(
                icon = Icons.Default.Wifi,
                title = "WiFi",
                description = "Réseau WiFi avec SSID, mot de passe et type de sécurité",
                onClick = { onTypeSelected(EntryType.WIFI) }
            )

            // Carte Note sécurisée
            EntryTypeCard(
                icon = Icons.Default.Description,
                title = "Note sécurisée",
                description = "Texte libre chiffré pour toute information confidentielle",
                onClick = { onTypeSelected(EntryType.NOTE) }
            )
        }
    }
}

/**
 * Carte cliquable pour un type d'entrée
 */
@Composable
private fun EntryTypeCard(
    icon: ImageVector,
    title: String,
    description: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icône
            Surface(
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(56.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            // Texte
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Flèche
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
