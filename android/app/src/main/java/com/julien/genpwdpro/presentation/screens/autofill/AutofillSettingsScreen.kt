package com.julien.genpwd-pro.presentation.screens.autofill

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import androidx.annotation.RequiresApi
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.autofill.AutofillRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Écran de configuration de l'auto-remplissage
 *
 * Permet à l'utilisateur de:
 * - Vérifier le statut de l'auto-remplissage
 * - Activer le service GenPwd Pro
 * - Configurer les options d'auto-remplissage
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AutofillSettingsScreen(
    onNavigateBack: () -> Unit,
    viewModel: AutofillSettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    // Vérifier le statut au démarrage
    LaunchedEffect(Unit) {
        viewModel.checkAutofillStatus(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Auto-remplissage") },
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
            // Statut de l'auto-remplissage
            AutofillStatusCard(
                isEnabled = uiState.isAutofillEnabled,
                isSupported = uiState.isAutofillSupported,
                onOpenSettings = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        openAutofillSettings(context)
                    }
                }
            )

            // Comment activer
            if (!uiState.isAutofillEnabled && uiState.isAutofillSupported) {
                HowToEnableCard()
            }

            // Fonctionnalités
            FeaturesCard()

            // Sécurité et confidentialité
            SecurityCard()

            // Statistiques (si activé)
            if (uiState.isAutofillEnabled) {
                StatsCard(uiState.autofillUsageCount)
            }
        }
    }
}

/**
 * Carte affichant le statut actuel
 */
@Composable
private fun AutofillStatusCard(
    isEnabled: Boolean,
    isSupported: Boolean,
    onOpenSettings: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isEnabled) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = if (isEnabled) Icons.Default.CheckCircle else Icons.Default.Info,
                    contentDescription = null,
                    tint = if (isEnabled) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Text(
                    text = if (isEnabled) "Activé" else "Désactivé",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = when {
                    !isSupported -> "Auto-remplissage non supporté (Android 8+ requis)"
                    isEnabled -> "GenPwd Pro est votre service d'auto-remplissage actif"
                    else -> "L'auto-remplissage n'est pas encore activé"
                },
                style = MaterialTheme.typography.bodyMedium
            )

            if (isSupported && !isEnabled) {
                Button(
                    onClick = onOpenSettings,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Settings, null, Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Ouvrir les paramètres système")
                }
            }
        }
    }
}

/**
 * Carte expliquant comment activer
 */
@Composable
private fun HowToEnableCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Comment activer",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            val steps = listOf(
                "1. Appuyez sur 'Ouvrir les paramètres système' ci-dessus",
                "2. Sélectionnez 'GenPwd Pro' dans la liste",
                "3. Activez le service dans la boîte de dialogue",
                "4. Revenez à l'application"
            )

            steps.forEach { step ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.ArrowRight,
                        null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = step,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

/**
 * Carte des fonctionnalités
 */
@Composable
private fun FeaturesCard() {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Fonctionnalités",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            val features = listOf(
                "🎯 Détection automatique des champs de mot de passe",
                "🔐 Génération instantanée de mots de passe sécurisés",
                "📝 3 options de mots de passe par formulaire",
                "📊 Affichage de l'entropie pour chaque option",
                "💾 Sauvegarde automatique dans l'historique",
                "⚙️ Respect de vos paramètres de génération"
            )

            features.forEach { feature ->
                Text(
                    text = feature,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
        }
    }
}

/**
 * Carte sécurité et confidentialité
 */
@Composable
private fun SecurityCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Default.Security,
                    null,
                    tint = MaterialTheme.colorScheme.secondary
                )
                Text(
                    text = "Sécurité et confidentialité",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            val securityPoints = listOf(
                "✅ Génération locale uniquement (pas de connexion réseau)",
                "✅ Aucune donnée envoyée à des serveurs tiers",
                "✅ Mots de passe jamais stockés en clair",
                "✅ Service isolé du système Android",
                "✅ Respect total de votre vie privée"
            )

            securityPoints.forEach { point ->
                Text(
                    text = point,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 2.dp)
                )
            }
        }
    }
}

/**
 * Carte des statistiques d'utilisation
 */
@Composable
private fun StatsCard(usageCount: Int) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "Statistiques",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Utilisations",
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = "$usageCount",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Ouvre les paramètres d'auto-remplissage du système
 */
@RequiresApi(Build.VERSION_CODES.O)
private fun openAutofillSettings(context: Context) {
    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
        data = android.net.Uri.parse("package:${context.packageName}")
    }
    context.startActivity(intent)
}

/**
 * ViewModel pour l'écran d'auto-remplissage
 */
@HiltViewModel
class AutofillSettingsViewModel @Inject constructor(
    private val autofillRepository: AutofillRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AutofillSettingsUiState())
    val uiState: StateFlow<AutofillSettingsUiState> = _uiState.asStateFlow()

    /**
     * Vérifie si l'auto-remplissage est activé
     */
    fun checkAutofillStatus(context: Context) {
        viewModelScope.launch {
            val isSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O

            val isEnabled = if (isSupported && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val autofillManager = context.getSystemService(AutofillManager::class.java)
                autofillManager?.hasEnabledAutofillServices() == true &&
                autofillManager.isAutofillSupported
            } else {
                false
            }

            _uiState.update {
                it.copy(
                    isAutofillEnabled = isEnabled,
                    isAutofillSupported = isSupported
                )
            }
        }
    }

    /**
     * Incrémente le compteur d'utilisation
     */
    fun incrementUsageCount() {
        _uiState.update {
            it.copy(autofillUsageCount = it.autofillUsageCount + 1)
        }
    }
}

/**
 * État de l'UI
 */
data class AutofillSettingsUiState(
    val isAutofillEnabled: Boolean = false,
    val isAutofillSupported: Boolean = false,
    val autofillUsageCount: Int = 0
)
