package com.julien.genpwdpro.presentation.analysis

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.core.log.SafeLog
import com.julien.genpwdpro.data.models.vault.EntryType
import com.julien.genpwdpro.data.models.vault.VaultEntryEntity
import com.julien.genpwdpro.data.models.vault.toEntryType
import com.julien.genpwdpro.data.repository.FileVaultRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * ViewModel pour le dashboard de santé des mots de passe
 *
 * Analyse la sécurité du vault et identifie les problèmes :
 * - Mots de passe faibles (score < 60)
 * - Mots de passe réutilisés
 * - Mots de passe compromis (Have I Been Pwned)
 * - Mots de passe anciens (> 90 jours)
 */
@HiltViewModel
class PasswordHealthViewModel @Inject constructor(
    private val fileVaultRepository: FileVaultRepository
) : ViewModel() {

    private val haveIBeenPwnedClient = com.julien.genpwdpro.data.api.HaveIBeenPwnedClient()

    private val _uiState = MutableStateFlow<HealthUiState>(HealthUiState.Loading)
    val uiState: StateFlow<HealthUiState> = _uiState.asStateFlow()

    /**
     * Analyse la santé du vault
     */
    fun analyzeVaultHealth(vaultId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = HealthUiState.Loading

                // Récupérer toutes les entrées (note: vaultId ignoré, utilise session active)
                val entries = fileVaultRepository.getEntries().first()

                // Analyser les mots de passe
                val weakPasswords = mutableListOf<WeakPasswordEntry>()
                val reusedPasswords = mutableListOf<ReusedPasswordGroup>()
                val compromisedPasswords = mutableListOf<CompromisedPasswordEntry>()
                val oldPasswords = mutableListOf<OldPasswordEntry>()

                val passwordMap = mutableMapOf<String, MutableList<VaultEntryEntity>>()

                // Analyser chaque entrée
                for (entry in entries) {
                    if (entry.entryType.toEntryType() != EntryType.LOGIN) continue
                    val password = entry.password ?: continue
                    if (password.isEmpty()) continue

                    // Mots de passe faibles
                    if (entry.passwordStrength < 60) {
                        weakPasswords.add(
                            WeakPasswordEntry(
                                id = entry.id,
                                title = entry.title,
                                username = entry.username ?: "",
                                strength = entry.passwordStrength,
                                reason = getWeaknessReason(password)
                            )
                        )
                    }

                    // Mots de passe réutilisés (grouper par mot de passe)
                    passwordMap.getOrPut(password) { mutableListOf() }.add(entry)

                    // Mots de passe compromis (vérification via HaveIBeenPwned)
                    // Note: Cette vérification est asynchrone et peut prendre du temps
                    // On la fait en arrière-plan pour ne pas bloquer l'UI
                    if (password.isNotEmpty()) {
                        viewModelScope.launch {
                            try {
                                val result = haveIBeenPwnedClient.checkPassword(password)
                                result.getOrNull()?.let { (isCompromised, breachCount) ->
                                    if (isCompromised) {
                                        compromisedPasswords.add(
                                            CompromisedPasswordEntry(
                                                id = entry.id,
                                                title = entry.title,
                                                username = entry.username ?: "",
                                                breachCount = breachCount
                                            )
                                        )
                                        // Note: La mise à jour complète de l'UI se fait à la fin de analyze()
                                        // On ne fait rien ici pour éviter les mises à jour partielles
                                    }
                                }
                            } catch (e: Exception) {
                                // Ignorer les erreurs de vérification individuelles
                                com.julien.genpwdpro.core.log.SafeLog.e(
                                    "PasswordHealth",
                                    "Error checking password: ${e.message}"
                                )
                            }
                        }
                    }

                    // Mots de passe anciens (> 90 jours)
                    val daysSinceUpdate = (System.currentTimeMillis() - entry.modifiedAt) / (1000 * 60 * 60 * 24)
                    if (daysSinceUpdate > 90) {
                        oldPasswords.add(
                            OldPasswordEntry(
                                id = entry.id,
                                title = entry.title ?: "",
                                username = entry.username ?: "",
                                daysSinceUpdate = daysSinceUpdate.toInt()
                            )
                        )
                    }
                }

                // Identifier les groupes de mots de passe réutilisés
                for ((password, entriesWithPassword) in passwordMap) {
                    if (entriesWithPassword.size > 1) {
                        reusedPasswords.add(
                            ReusedPasswordGroup(
                                password = "•••••••", // Masquer le mot de passe
                                count = entriesWithPassword.size,
                                entries = entriesWithPassword.map {
                                    PasswordReference(it.id, it.title ?: "", it.username ?: "")
                                }
                            )
                        )
                    }
                }

                // Calculer le score de santé global (0-100)
                val totalPasswords = entries.count { it.entryType.toEntryType() == EntryType.LOGIN && !it.password.isNullOrEmpty() }
                val score = calculateHealthScore(
                    totalPasswords = totalPasswords,
                    weakCount = weakPasswords.size,
                    reusedCount = reusedPasswords.sumOf { it.count },
                    compromisedCount = compromisedPasswords.size,
                    oldCount = oldPasswords.size
                )

                // Statistiques par type
                val statistics = HealthStatistics(
                    totalEntries = entries.size,
                    totalPasswords = totalPasswords,
                    weakPasswords = weakPasswords.size,
                    reusedPasswords = reusedPasswords.sumOf { it.count },
                    compromisedPasswords = compromisedPasswords.size,
                    oldPasswords = oldPasswords.size,
                    averageStrength = entries
                        .filter { it.entryType.toEntryType() == EntryType.LOGIN && !it.password.isNullOrEmpty() }
                        .map { it.passwordStrength }
                        .average()
                        .toInt()
                        .coerceIn(0, 100)
                )

                _uiState.value = HealthUiState.Success(
                    healthScore = score,
                    statistics = statistics,
                    weakPasswords = weakPasswords,
                    reusedPasswords = reusedPasswords,
                    compromisedPasswords = compromisedPasswords,
                    oldPasswords = oldPasswords
                )
            } catch (e: Exception) {
                _uiState.value = HealthUiState.Error(e.message ?: "Erreur lors de l'analyse")
            }
        }
    }

    /**
     * Calcule le score de santé global (0-100)
     */
    private fun calculateHealthScore(
        totalPasswords: Int,
        weakCount: Int,
        reusedCount: Int,
        compromisedCount: Int,
        oldCount: Int
    ): Int {
        if (totalPasswords == 0) return 100

        var score = 100

        // Pénalités
        score -= (weakCount.toFloat() / totalPasswords * 30).toInt()
        score -= (reusedCount.toFloat() / totalPasswords * 30).toInt()
        score -= (compromisedCount.toFloat() / totalPasswords * 25).toInt()
        score -= (oldCount.toFloat() / totalPasswords * 15).toInt()

        return score.coerceIn(0, 100)
    }

    /**
     * Identifie la raison de la faiblesse d'un mot de passe
     */
    private fun getWeaknessReason(password: String): String {
        val reasons = mutableListOf<String>()

        if (password.length < 8) reasons.add("Trop court (< 8 caractères)")
        if (!password.any { it.isUpperCase() }) reasons.add("Pas de majuscules")
        if (!password.any { it.isLowerCase() }) reasons.add("Pas de minuscules")
        if (!password.any { it.isDigit() }) reasons.add("Pas de chiffres")
        if (!password.any { !it.isLetterOrDigit() }) reasons.add("Pas de symboles")
        if (password.matches(Regex("^[a-zA-Z]+$"))) reasons.add("Que des lettres")
        if (password.matches(Regex("^[0-9]+$"))) reasons.add("Que des chiffres")

        return reasons.joinToString(", ")
    }
}

/**
 * États UI du dashboard de santé
 */
sealed class HealthUiState {
    object Loading : HealthUiState()
    data class Success(
        val healthScore: Int,
        val statistics: HealthStatistics,
        val weakPasswords: List<WeakPasswordEntry>,
        val reusedPasswords: List<ReusedPasswordGroup>,
        val compromisedPasswords: List<CompromisedPasswordEntry>,
        val oldPasswords: List<OldPasswordEntry>
    ) : HealthUiState()
    data class Error(val message: String) : HealthUiState()
}

/**
 * Statistiques de santé du vault
 */
data class HealthStatistics(
    val totalEntries: Int,
    val totalPasswords: Int,
    val weakPasswords: Int,
    val reusedPasswords: Int,
    val compromisedPasswords: Int,
    val oldPasswords: Int,
    val averageStrength: Int
)

/**
 * Mot de passe faible
 */
data class WeakPasswordEntry(
    val id: String,
    val title: String,
    val username: String,
    val strength: Int,
    val reason: String
)

/**
 * Groupe de mots de passe réutilisés
 */
data class ReusedPasswordGroup(
    val password: String, // Masqué
    val count: Int,
    val entries: List<PasswordReference>
)

/**
 * Référence à un mot de passe
 */
data class PasswordReference(
    val id: String,
    val title: String,
    val username: String
)

/**
 * Mot de passe compromis
 */
data class CompromisedPasswordEntry(
    val id: String,
    val title: String,
    val username: String,
    val breachCount: Int
)

/**
 * Mot de passe ancien
 */
data class OldPasswordEntry(
    val id: String,
    val title: String,
    val username: String,
    val daysSinceUpdate: Int
)
