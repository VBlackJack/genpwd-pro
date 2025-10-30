package com.julien.genpwdpro.presentation.analysis

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Écran du dashboard de santé des mots de passe
 *
 * Affiche :
 * - Score de santé global (0-100)
 * - Statistiques de sécurité
 * - Liste des problèmes identifiés
 * - Actions recommandées
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PasswordHealthScreen(
    vaultId: String,
    onBackClick: () -> Unit,
    onEntryClick: (String) -> Unit,
    viewModel: PasswordHealthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    // Charger les données
    LaunchedEffect(vaultId) {
        viewModel.analyzeVaultHealth(vaultId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Santé des mots de passe") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.analyzeVaultHealth(vaultId) }) {
                        Icon(Icons.Default.Refresh, "Rafraîchir")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is HealthUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Analyse en cours...")
                    }
                }
            }

            is HealthUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                    }
                }
            }

            is HealthUiState.Success -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Score global
                    item {
                        HealthScoreCard(
                            score = state.healthScore,
                            statistics = state.statistics
                        )
                    }

                    // Statistiques rapides
                    item {
                        QuickStatsRow(state.statistics)
                    }

                    // Problèmes identifiés
                    if (state.weakPasswords.isNotEmpty()) {
                        item {
                            Text(
                                "Mots de passe faibles",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        items(state.weakPasswords) { weak ->
                            WeakPasswordCard(weak, onClick = { onEntryClick(weak.id) })
                        }
                    }

                    if (state.reusedPasswords.isNotEmpty()) {
                        item {
                            Text(
                                "Mots de passe réutilisés",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        items(state.reusedPasswords) { reused ->
                            ReusedPasswordCard(reused, onClick = { onEntryClick(it) })
                        }
                    }

                    if (state.compromisedPasswords.isNotEmpty()) {
                        item {
                            Text(
                                "Mots de passe compromis",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        items(state.compromisedPasswords) { compromised ->
                            CompromisedPasswordCard(
                                compromised,
                                onClick = { onEntryClick(compromised.id) }
                            )
                        }
                    }

                    if (state.oldPasswords.isNotEmpty()) {
                        item {
                            Text(
                                "Mots de passe anciens",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        items(state.oldPasswords) { old ->
                            OldPasswordCard(old, onClick = { onEntryClick(old.id) })
                        }
                    }

                    // Message si tout est OK
                    if (state.weakPasswords.isEmpty() &&
                        state.reusedPasswords.isEmpty() &&
                        state.compromisedPasswords.isEmpty() &&
                        state.oldPasswords.isEmpty()
                    ) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.primaryContainer
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                    Column {
                                        Text(
                                            "Excellent !",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            "Aucun problème de sécurité détecté. Vos mots de passe sont sécurisés.",
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Carte du score de santé global avec gauge circulaire
 */
@Composable
private fun HealthScoreCard(
    score: Int,
    statistics: HealthStatistics
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Score de santé",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Gauge circulaire animée
            CircularHealthGauge(score = score)

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "$score/100",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = getScoreColor(score)
            )

            Text(
                getScoreLabel(score),
                style = MaterialTheme.typography.bodyLarge,
                color = getScoreColor(score)
            )
        }
    }
}

/**
 * Gauge circulaire pour le score
 */
@Composable
private fun CircularHealthGauge(score: Int) {
    val animatedScore by animateFloatAsState(
        targetValue = score / 100f,
        animationSpec = tween(durationMillis = 1000, easing = EaseOutCubic),
        label = "score_animation"
    )

    val color = getScoreColor(score)

    Canvas(modifier = Modifier.size(120.dp)) {
        // Background circle
        drawArc(
            color = Color.Gray.copy(alpha = 0.2f),
            startAngle = 135f,
            sweepAngle = 270f,
            useCenter = false,
            style = Stroke(width = 16.dp.toPx(), cap = StrokeCap.Round)
        )

        // Progress arc
        drawArc(
            color = color,
            startAngle = 135f,
            sweepAngle = 270f * animatedScore,
            useCenter = false,
            style = Stroke(width = 16.dp.toPx(), cap = StrokeCap.Round)
        )
    }
}

/**
 * Statistiques rapides en ligne
 */
@Composable
private fun QuickStatsRow(statistics: HealthStatistics) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        QuickStatCard(
            icon = Icons.Default.Key,
            value = statistics.totalPasswords.toString(),
            label = "Total",
            modifier = Modifier.weight(1f)
        )
        QuickStatCard(
            icon = Icons.Default.TrendingUp,
            value = "${statistics.averageStrength}%",
            label = "Moyenne",
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun QuickStatCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(8.dp))
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/**
 * Carte pour un mot de passe faible
 */
@Composable
private fun WeakPasswordCard(weak: WeakPasswordEntry, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(weak.title, fontWeight = FontWeight.Bold)
                Text(weak.username, style = MaterialTheme.typography.bodySmall)
                Text(
                    weak.reason,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
            Text(
                "${weak.strength}%",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

/**
 * Carte pour mots de passe réutilisés
 */
@Composable
private fun ReusedPasswordCard(reused: ReusedPasswordGroup, onClick: (String) -> Unit) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.ContentCopy,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.tertiary
                )
                Text(
                    "Utilisé ${reused.count} fois",
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            reused.entries.forEach { entry ->
                TextButton(onClick = { onClick(entry.id) }) {
                    Text("${entry.title} (${entry.username})")
                }
            }
        }
    }
}

/**
 * Carte pour mot de passe compromis
 */
@Composable
private fun CompromisedPasswordCard(compromised: CompromisedPasswordEntry, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Security,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(compromised.title, fontWeight = FontWeight.Bold)
                Text(compromised.username, style = MaterialTheme.typography.bodySmall)
                Text(
                    "Trouvé dans ${compromised.breachCount} fuites de données",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null)
        }
    }
}

/**
 * Carte pour mot de passe ancien
 */
@Composable
private fun OldPasswordCard(old: OldPasswordEntry, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Schedule,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.secondary
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(old.title, fontWeight = FontWeight.Bold)
                Text(old.username, style = MaterialTheme.typography.bodySmall)
                Text(
                    "Pas mis à jour depuis ${old.daysSinceUpdate} jours",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null)
        }
    }
}

/**
 * Obtient la couleur selon le score
 */
@Composable
private fun getScoreColor(score: Int): Color {
    return when {
        score >= 80 -> MaterialTheme.colorScheme.primary // Excellent
        score >= 60 -> MaterialTheme.colorScheme.tertiary // Bon
        score >= 40 -> Color(0xFFFFA726) // Moyen (orange)
        else -> MaterialTheme.colorScheme.error // Mauvais
    }
}

/**
 * Obtient le label selon le score
 */
private fun getScoreLabel(score: Int): String {
    return when {
        score >= 80 -> "Excellent"
        score >= 60 -> "Bon"
        score >= 40 -> "Moyen"
        else -> "À améliorer"
    }
}
