package com.julien.genpwdpro.presentation.vault

import androidx.compose.animation.*
import androidx.compose.foundation.clickable
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
import com.julien.genpwdpro.data.local.entity.*
import com.julien.genpwdpro.domain.model.VaultStatistics
import com.julien.genpwdpro.presentation.utils.SecureWindow
import kotlinx.coroutines.delay

/**
 * Écran principal affichant la liste des entrées du vault
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VaultListScreen(
    vaultId: String,
    onEntryClick: (String) -> Unit,
    onAddEntry: (EntryType) -> Unit,
    onSettingsClick: () -> Unit,
    onLockClick: () -> Unit,
    viewModel: VaultListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val filterType by viewModel.filterType.collectAsState()
    val showFavoritesOnly by viewModel.showFavoritesOnly.collectAsState()
    val statistics by viewModel.statistics.collectAsState()

    var showSearch by remember { mutableStateOf(false) }
    var showAddMenu by remember { mutableStateOf(false) }
    var showFilterMenu by remember { mutableStateOf(false) }

    SecureWindow()

    // Charger les entrées
    LaunchedEffect(vaultId) {
        viewModel.loadEntries(vaultId)
        viewModel.loadStatistics(vaultId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    if (showSearch) {
                        TextField(
                            value = searchQuery,
                            onValueChange = { viewModel.searchEntries(it) },
                            placeholder = { Text("Rechercher...") },
                            singleLine = true,
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = MaterialTheme.colorScheme.surface,
                                unfocusedContainerColor = MaterialTheme.colorScheme.surface
                            )
                        )
                    } else {
                        Text("Coffre-fort")
                    }
                },
                navigationIcon = {
                    if (showSearch) {
                        IconButton(onClick = {
                            showSearch = false
                            viewModel.searchEntries("")
                        }) {
                            Icon(Icons.Default.ArrowBack, "Retour")
                        }
                    }
                },
                actions = {
                    if (!showSearch) {
                        // Recherche
                        IconButton(onClick = { showSearch = true }) {
                            Icon(Icons.Default.Search, "Rechercher")
                        }

                        // Filtres
                        IconButton(onClick = { showFilterMenu = true }) {
                            if (filterType != null || showFavoritesOnly) {
                                BadgedBox(
                                    badge = { Badge { Text("•") } }
                                ) {
                                    Icon(Icons.Default.FilterList, "Filtrer")
                                }
                            } else {
                                Icon(Icons.Default.FilterList, "Filtrer")
                            }
                        }

                        // Menu filtres
                        DropdownMenu(
                            expanded = showFilterMenu,
                            onDismissRequest = { showFilterMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Tous") },
                                onClick = {
                                    viewModel.filterByType(null)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.AllInclusive, null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Identifiants") },
                                onClick = {
                                    viewModel.filterByType(EntryType.LOGIN)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.Key, null) }
                            )
                            DropdownMenuItem(
                                text = { Text("WiFi") },
                                onClick = {
                                    viewModel.filterByType(EntryType.WIFI)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.Wifi, null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Notes") },
                                onClick = {
                                    viewModel.filterByType(EntryType.NOTE)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.Description, null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Cartes") },
                                onClick = {
                                    viewModel.filterByType(EntryType.CARD)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.CreditCard, null) }
                            )
                            DropdownMenuItem(
                                text = { Text("Identités") },
                                onClick = {
                                    viewModel.filterByType(EntryType.IDENTITY)
                                    showFilterMenu = false
                                },
                                leadingIcon = { Icon(Icons.Default.Badge, null) }
                            )
                            Divider()
                            DropdownMenuItem(
                                text = { Text("Favoris uniquement") },
                                onClick = {
                                    viewModel.toggleFavoritesOnly()
                                    showFilterMenu = false
                                },
                                leadingIcon = {
                                    Icon(
                                        if (showFavoritesOnly) Icons.Default.Star else Icons.Default.StarBorder,
                                        null
                                    )
                                }
                            )
                        }

                        // Verrouiller
                        IconButton(onClick = onLockClick) {
                            Icon(Icons.Default.Lock, "Verrouiller")
                        }

                        // Paramètres
                        IconButton(onClick = onSettingsClick) {
                            Icon(Icons.Default.Settings, "Paramètres")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            Box {
                FloatingActionButton(
                    onClick = { showAddMenu = true }
                ) {
                    Icon(Icons.Default.Add, "Ajouter")
                }

                // Menu d'ajout
                DropdownMenu(
                    expanded = showAddMenu,
                    onDismissRequest = { showAddMenu = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Identifiant") },
                        onClick = {
                            onAddEntry(EntryType.LOGIN)
                            showAddMenu = false
                        },
                        leadingIcon = { Icon(Icons.Default.Key, null) }
                    )
                    DropdownMenuItem(
                        text = { Text("WiFi") },
                        onClick = {
                            onAddEntry(EntryType.WIFI)
                            showAddMenu = false
                        },
                        leadingIcon = { Icon(Icons.Default.Wifi, null) }
                    )
                    DropdownMenuItem(
                        text = { Text("Note sécurisée") },
                        onClick = {
                            onAddEntry(EntryType.NOTE)
                            showAddMenu = false
                        },
                        leadingIcon = { Icon(Icons.Default.Description, null) }
                    )
                    DropdownMenuItem(
                        text = { Text("Carte bancaire") },
                        onClick = {
                            onAddEntry(EntryType.CARD)
                            showAddMenu = false
                        },
                        leadingIcon = { Icon(Icons.Default.CreditCard, null) }
                    )
                    DropdownMenuItem(
                        text = { Text("Document d'identité") },
                        onClick = {
                            onAddEntry(EntryType.IDENTITY)
                            showAddMenu = false
                        },
                        leadingIcon = { Icon(Icons.Default.Badge, null) }
                    )
                }
            }
        }
    ) { padding ->
        when (val state = uiState) {
            is VaultListUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is VaultListUiState.Success -> {
                if (state.entries.isEmpty()) {
                    // État vide
                    EmptyVaultState(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        hasFilters = filterType != null || showFavoritesOnly || searchQuery.isNotEmpty(),
                        onAddEntry = { showAddMenu = true },
                        onClearFilters = { viewModel.clearFilters() }
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Statistiques
                        if (statistics != null && !showSearch && filterType == null) {
                            item {
                                VaultStatisticsCard(
                                    statistics = statistics!!,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }

                        // Entrées
                        items(
                            items = state.entries,
                            key = { it.id }
                        ) { entry ->
                            EntryCard(
                                entry = entry,
                                onClick = { onEntryClick(entry.id) },
                                onFavoriteClick = {
                                    viewModel.toggleFavorite(entry.id)
                                },
                                viewModel = viewModel
                            )
                        }
                    }
                }
            }

            is VaultListUiState.Error -> {
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
        }
    }
}

/**
 * Card pour afficher une entrée (nouveau système)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EntryCard(
    entry: VaultEntryEntity,
    onClick: () -> Unit,
    onFavoriteClick: () -> Unit,
    viewModel: VaultListViewModel
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icône
            Icon(
                imageVector = when (entry.entryType.toEntryType()) {
                    EntryType.LOGIN -> Icons.Default.Key
                    EntryType.WIFI -> Icons.Default.Wifi
                    EntryType.NOTE -> Icons.Default.Description
                    EntryType.CARD -> Icons.Default.CreditCard
                    EntryType.IDENTITY -> Icons.Default.Badge
                },
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.width(16.dp))

            // Contenu
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (!entry.username.isNullOrEmpty()) {
                    Text(
                        text = entry.username!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // TOTP si présent
                if (entry.hasTOTP()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    TotpCodeDisplay(
                        entry = entry,
                        viewModel = viewModel
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Favori
            IconButton(onClick = onFavoriteClick) {
                Icon(
                    imageVector = if (entry.isFavorite) Icons.Default.Star else Icons.Default.StarBorder,
                    contentDescription = "Favori",
                    tint = if (entry.isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Affichage du code TOTP avec compte à rebours (nouveau système)
 */
@Composable
private fun TotpCodeDisplay(
    entry: VaultEntryEntity,
    viewModel: VaultListViewModel
) {
    var totpResult by remember { mutableStateOf<com.julien.genpwdpro.data.crypto.TotpGenerator.TotpResult?>(null) }

    LaunchedEffect(Unit) {
        while (true) {
            totpResult = viewModel.generateTotpCode(entry)
            delay(1000) // Rafraîchir chaque seconde
        }
    }

    totpResult?.let { result ->
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                Text(
                    text = result.code,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            // Barre de progression
            LinearProgressIndicator(
                progress = result.remainingSeconds.toFloat() / result.period,
                modifier = Modifier
                    .width(40.dp)
                    .height(4.dp),
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "${result.remainingSeconds}s",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * État vide du vault
 */
@Composable
private fun EmptyVaultState(
    modifier: Modifier = Modifier,
    hasFilters: Boolean,
    onAddEntry: () -> Unit,
    onClearFilters: () -> Unit
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = if (hasFilters) Icons.Default.SearchOff else Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = if (hasFilters) "Aucun résultat" else "Aucune entrée",
            style = MaterialTheme.typography.titleLarge
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = if (hasFilters) {
                "Essayez de modifier vos filtres"
            } else {
                "Ajoutez votre première entrée sécurisée"
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (hasFilters) {
            OutlinedButton(onClick = onClearFilters) {
                Icon(Icons.Default.Clear, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Effacer les filtres")
            }
        } else {
            Button(onClick = onAddEntry) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Ajouter une entrée")
            }
        }
    }
}

/**
 * Card des statistiques du vault (nouveau système)
 */
@Composable
private fun VaultStatisticsCard(
    statistics: VaultStatistics,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Statistiques",
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    icon = Icons.Default.Key,
                    value = statistics.loginCount.toString(),
                    label = "Logins"
                )
                StatItem(
                    icon = Icons.Default.Description,
                    value = statistics.noteCount.toString(),
                    label = "Notes"
                )
                StatItem(
                    icon = Icons.Default.Star,
                    value = statistics.favoritesCount.toString(),
                    label = "Favoris"
                )
                StatItem(
                    icon = Icons.Default.Security,
                    value = statistics.totpCount.toString(),
                    label = "2FA"
                )
            }

            // Force des mots de passe
            if (statistics.weakPasswordCount > 0) {
                Spacer(modifier = Modifier.height(12.dp))
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
                            text = "${statistics.weakPasswordCount} mot(s) de passe faible(s)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
