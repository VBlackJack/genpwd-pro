package com.julien.genpwdpro.presentation.screens.analyzer

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.domain.analyzer.PasswordAnalysis
import com.julien.genpwdpro.domain.analyzer.PasswordAnalyzer
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Écran d'analyse de mots de passe
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyzerScreen(
    onNavigateBack: () -> Unit,
    viewModel: AnalyzerViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Analyseur de mot de passe") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
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
            // Champ de saisie
            PasswordInputCard(
                password = uiState.inputPassword,
                isVisible = uiState.isPasswordVisible,
                onPasswordChange = { viewModel.updatePassword(it) },
                onToggleVisibility = { viewModel.togglePasswordVisibility() },
                onAnalyze = { viewModel.analyze() }
            )

            // Résultats d'analyse
            uiState.analysis?.let { analysis ->
                AnalysisResults(analysis)
            }
        }
    }
}

/**
 * Carte de saisie du mot de passe
 */
@Composable
private fun PasswordInputCard(
    password: String,
    isVisible: Boolean,
    onPasswordChange: (String) -> Unit,
    onToggleVisibility: () -> Unit,
    onAnalyze: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Entrez un mot de passe à analyser",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            OutlinedTextField(
                value = password,
                onValueChange = onPasswordChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Mot de passe") },
                visualTransformation = if (isVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    IconButton(onClick = onToggleVisibility) {
                        Icon(
                            if (isVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            "Toggle visibility"
                        )
                    }
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onAnalyze() }),
                singleLine = true
            )

            Button(
                onClick = onAnalyze,
                modifier = Modifier.fillMaxWidth(),
                enabled = password.isNotEmpty()
            ) {
                Icon(Icons.Default.Search, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Analyser")
            }
        }
    }
}

/**
 * Résultats de l'analyse
 */
@Composable
private fun AnalysisResults(analysis: PasswordAnalysis) {
    // Force globale
    StrengthCard(analysis)

    // Métriques de base
    BasicMetricsCard(analysis)

    // Composition
    CompositionCard(analysis)

    // Problèmes détectés
    if (analysis.repeatedChars.isNotEmpty() || analysis.sequentialPatterns.isNotEmpty() || analysis.commonWords.isNotEmpty()) {
        ProblemsCard(analysis)
    }

    // Recommandations
    RecommendationsCard(analysis)
}

/**
 * Carte de force du mot de passe
 */
@Composable
private fun StrengthCard(analysis: PasswordAnalysis) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(analysis.strength.color).copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Force du mot de passe",
                style = MaterialTheme.typography.titleMedium
            )

            Text(
                text = analysis.strength.label,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Color(analysis.strength.color)
            )

            Text(
                text = "${analysis.entropy.toInt()} bits d'entropie",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Divider(modifier = Modifier.padding(vertical = 8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Timer, null, tint = MaterialTheme.colorScheme.primary)
                    Text("Temps de crack", style = MaterialTheme.typography.labelSmall)
                    Text(
                        analysis.estimatedCrackTime,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Storage, null, tint = MaterialTheme.colorScheme.primary)
                    Text("Jeu de caractères", style = MaterialTheme.typography.labelSmall)
                    Text(
                        "${analysis.charsetSize} caractères",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

/**
 * Métriques de base
 */
@Composable
private fun BasicMetricsCard(analysis: PasswordAnalysis) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Métriques",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricItem("Longueur", "${analysis.length}")
                MetricItem("Uniques", "${analysis.uniqueChars}")
                MetricItem(
                    "Variété",
                    "${(analysis.uniqueChars.toFloat() / analysis.length * 100).toInt()}%"
                )
            }
        }
    }
}

@Composable
private fun MetricItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Composition du mot de passe
 */
@Composable
private fun CompositionCard(analysis: PasswordAnalysis) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Composition",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            CompositionItem("Minuscules", analysis.hasLowercase, analysis.lowercaseCount)
            CompositionItem("Majuscules", analysis.hasUppercase, analysis.uppercaseCount)
            CompositionItem("Chiffres", analysis.hasDigits, analysis.digitsCount)
            CompositionItem("Spéciaux", analysis.hasSpecials, analysis.specialsCount)
        }
    }
}

@Composable
private fun CompositionItem(label: String, present: Boolean, count: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (present) {
                Text(
                    "$count",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Icon(
                if (present) Icons.Default.CheckCircle else Icons.Default.Cancel,
                null,
                tint = if (present) Color(0xFF10B981) else Color(0xFFEF4444),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

/**
 * Problèmes détectés
 */
@Composable
private fun ProblemsCard(analysis: PasswordAnalysis) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFF6B6B).copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Warning, null, tint = Color(0xFFFF6B6B))
                Text(
                    text = "Problèmes détectés",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            if (analysis.repeatedChars.isNotEmpty()) {
                ProblemItem("Répétitions", analysis.repeatedChars.joinToString(", "))
            }

            if (analysis.sequentialPatterns.isNotEmpty()) {
                ProblemItem("Séquences", analysis.sequentialPatterns.take(5).joinToString(", "))
            }

            if (analysis.commonWords.isNotEmpty()) {
                ProblemItem("Mots communs", analysis.commonWords.joinToString(", "))
            }
        }
    }
}

@Composable
private fun ProblemItem(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

/**
 * Recommandations
 */
@Composable
private fun RecommendationsCard(analysis: PasswordAnalysis) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Lightbulb, null, tint = MaterialTheme.colorScheme.primary)
                Text(
                    text = "Recommandations",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            analysis.recommendations.forEach { recommendation ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("•", color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(
                        recommendation,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}

/**
 * ViewModel pour l'analyseur
 */
@HiltViewModel
class AnalyzerViewModel @Inject constructor(
    private val passwordAnalyzer: PasswordAnalyzer
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnalyzerUiState())
    val uiState: StateFlow<AnalyzerUiState> = _uiState.asStateFlow()

    fun updatePassword(password: String) {
        _uiState.update { it.copy(inputPassword = password) }
    }

    fun togglePasswordVisibility() {
        _uiState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }
    }

    fun analyze() {
        viewModelScope.launch {
            val analysis = passwordAnalyzer.analyze(_uiState.value.inputPassword)
            _uiState.update { it.copy(analysis = analysis) }
        }
    }
}

/**
 * État de l'UI de l'analyseur
 */
data class AnalyzerUiState(
    val inputPassword: String = "",
    val isPasswordVisible: Boolean = false,
    val analysis: PasswordAnalysis? = null
)
