package com.julien.genpwdpro.presentation.screens.customphrase

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.julien.genpwdpro.domain.generators.CustomPhraseFormat
import com.julien.genpwdpro.domain.generators.CustomPhraseGenerator
import com.julien.genpwdpro.domain.generators.WordListValidation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Écran de configuration du générateur de phrases personnalisées
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomPhraseScreen(
    onNavigateBack: () -> Unit,
    onSaveAndGenerate: (List<String>, CustomPhraseFormat, Int, String) -> Unit,
    viewModel: CustomPhraseViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Générateur de Phrases") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.generatePreview() },
                        enabled = uiState.validation.isValid
                    ) {
                        Icon(Icons.Default.Refresh, "Régénérer aperçu")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    onSaveAndGenerate(
                        uiState.wordList,
                        uiState.selectedFormat,
                        uiState.wordCount,
                        uiState.separator
                    )
                },
                icon = { Icon(Icons.Default.Check, null) },
                text = { Text("Utiliser") },
                containerColor = MaterialTheme.colorScheme.primary,
                expanded = uiState.validation.isValid
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
            // Suggestions de catégories
            SuggestionsSection(
                onSelectCategory = { category, words ->
                    viewModel.addWordsFromCategory(words)
                }
            )

            // Éditeur de liste de mots
            WordListEditor(
                wordListText = uiState.wordListText,
                onWordListChange = { viewModel.updateWordListText(it) },
                validation = uiState.validation
            )

            // Validation status
            ValidationCard(validation = uiState.validation)

            // Format selector
            FormatSelector(
                selectedFormat = uiState.selectedFormat,
                onFormatChange = { viewModel.updateFormat(it) }
            )

            // Word count selector
            WordCountSelector(
                wordCount = uiState.wordCount,
                onWordCountChange = { viewModel.updateWordCount(it) }
            )

            // Separator (only for SEPARATED format)
            if (uiState.selectedFormat == CustomPhraseFormat.SEPARATED) {
                SeparatorSelector(
                    separator = uiState.separator,
                    onSeparatorChange = { viewModel.updateSeparator(it) }
                )
            }

            // Preview
            if (uiState.validation.isValid && uiState.preview.isNotEmpty()) {
                PreviewCard(preview = uiState.preview)
            }

            // Stats
            if (uiState.validation.isValid) {
                StatsCard(validation = uiState.validation)
            }

            // Spacer for FAB
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

/**
 * Section de suggestions de catégories
 */
@Composable
private fun SuggestionsSection(
    onSelectCategory: (String, List<String>) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "Suggestions",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(CustomPhraseGenerator.SUGGESTIONS.entries.toList()) { (category, words) ->
                SuggestionChip(
                    onClick = { onSelectCategory(category, words) },
                    label = { Text(category) },
                    icon = {
                        Icon(
                            Icons.Default.Add,
                            null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
            }
        }
    }
}

/**
 * Éditeur de liste de mots
 */
@Composable
private fun WordListEditor(
    wordListText: String,
    onWordListChange: (String) -> Unit,
    validation: WordListValidation
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (validation.isValid)
                MaterialTheme.colorScheme.surfaceVariant
            else
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Liste de mots",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${validation.wordCount} mots",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            OutlinedTextField(
                value = wordListText,
                onValueChange = onWordListChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 150.dp, max = 250.dp),
                placeholder = {
                    Text("Entrez vos mots (séparés par espaces, virgules ou retours à la ligne)")
                },
                supportingText = {
                    Text("Minimum 10 mots, 2+ caractères par mot")
                },
                isError = !validation.isValid && wordListText.isNotEmpty(),
                maxLines = 10
            )
        }
    }
}

/**
 * Carte de validation
 */
@Composable
private fun ValidationCard(validation: WordListValidation) {
    AnimatedVisibility(
        visible = !validation.isValid && validation.error != null,
        enter = fadeIn() + expandVertically(),
        exit = fadeOut() + shrinkVertically()
    ) {
        Card(
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
                    null,
                    tint = MaterialTheme.colorScheme.error
                )
                Text(
                    text = validation.error ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
    }
}

/**
 * Sélecteur de format
 */
@Composable
private fun FormatSelector(
    selectedFormat: CustomPhraseFormat,
    onFormatChange: (CustomPhraseFormat) -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Format",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            CustomPhraseFormat.values().forEach { format ->
                FormatOption(
                    format = format,
                    isSelected = format == selectedFormat,
                    onClick = { onFormatChange(format) }
                )
            }
        }
    }
}

@Composable
private fun FormatOption(
    format: CustomPhraseFormat,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val (label, example) = when (format) {
        CustomPhraseFormat.SEPARATED -> "Séparé" to "mot1-mot2-mot3"
        CustomPhraseFormat.CAPITALIZED -> "Capitalisé" to "Mot1Mot2Mot3"
        CustomPhraseFormat.CAMEL_CASE -> "camelCase" to "mot1Mot2Mot3"
        CustomPhraseFormat.SNAKE_CASE -> "snake_case" to "mot1_mot2_mot3"
        CustomPhraseFormat.KEBAB_CASE -> "kebab-case" to "mot1-mot2-mot3"
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = if (isSelected)
            MaterialTheme.colorScheme.primaryContainer
        else
            MaterialTheme.colorScheme.surface,
        border = BorderStroke(
            width = 1.dp,
            color = if (isSelected)
                MaterialTheme.colorScheme.primary
            else
                MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
                Text(
                    text = example,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isSelected) {
                Icon(
                    Icons.Default.CheckCircle,
                    null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Sélecteur de nombre de mots
 */
@Composable
private fun WordCountSelector(
    wordCount: Int,
    onWordCountChange: (Int) -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Nombre de mots",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = wordCount.toString(),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }

            Slider(
                value = wordCount.toFloat(),
                onValueChange = { onWordCountChange(it.toInt()) },
                valueRange = 2f..10f,
                steps = 7
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("2", style = MaterialTheme.typography.labelSmall)
                Text("10", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

/**
 * Sélecteur de séparateur
 */
@Composable
private fun SeparatorSelector(
    separator: String,
    onSeparatorChange: (String) -> Unit
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Séparateur",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(listOf("-", "_", ".", " ", "|", "+", "=")) { sep ->
                    FilterChip(
                        selected = separator == sep,
                        onClick = { onSeparatorChange(sep) },
                        label = { Text(sep, fontFamily = FontFamily.Monospace) }
                    )
                }
            }

            OutlinedTextField(
                value = separator,
                onValueChange = { if (it.length <= 3) onSeparatorChange(it) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Personnalisé") },
                singleLine = true
            )
        }
    }
}

/**
 * Aperçu du résultat
 */
@Composable
private fun PreviewCard(preview: String) {
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
            Text(
                text = "Aperçu",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Text(
                text = preview,
                style = MaterialTheme.typography.bodyLarge,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        MaterialTheme.colorScheme.surface,
                        RoundedCornerShape(8.dp)
                    )
                    .padding(12.dp)
            )
        }
    }
}

/**
 * Statistiques
 */
@Composable
private fun StatsCard(validation: WordListValidation) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Statistiques",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    label = "Mots uniques",
                    value = validation.wordCount.toString()
                )
                StatItem(
                    label = "Long. moyenne",
                    value = "%.1f".format(validation.averageLength)
                )
            }

            Divider()

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Entropie estimée",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "${validation.minEntropy.toInt()} - ${validation.maxEntropy.toInt()} bits",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "(selon nombre de mots: 2-10)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String) {
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
 * ViewModel
 */
@HiltViewModel
class CustomPhraseViewModel @Inject constructor(
    private val customPhraseGenerator: CustomPhraseGenerator
) : ViewModel() {

    private val _uiState = MutableStateFlow(CustomPhraseUiState())
    val uiState: StateFlow<CustomPhraseUiState> = _uiState.asStateFlow()

    init {
        // Validation initiale
        validateWordList()
    }

    fun updateWordListText(text: String) {
        _uiState.update { it.copy(wordListText = text) }
        validateWordList()
        if (_uiState.value.validation.isValid) {
            generatePreview()
        }
    }

    fun addWordsFromCategory(words: List<String>) {
        val currentText = _uiState.value.wordListText
        val newText = if (currentText.isEmpty()) {
            words.joinToString(" ")
        } else {
            "$currentText ${words.joinToString(" ")}"
        }
        updateWordListText(newText)
    }

    fun updateFormat(format: CustomPhraseFormat) {
        _uiState.update { it.copy(selectedFormat = format) }
        if (_uiState.value.validation.isValid) {
            generatePreview()
        }
    }

    fun updateWordCount(count: Int) {
        _uiState.update { it.copy(wordCount = count) }
        if (_uiState.value.validation.isValid) {
            generatePreview()
        }
    }

    fun updateSeparator(separator: String) {
        _uiState.update { it.copy(separator = separator) }
        if (_uiState.value.validation.isValid) {
            generatePreview()
        }
    }

    fun generatePreview() {
        viewModelScope.launch {
            val wordList = _uiState.value.wordList
            if (wordList.isEmpty()) return@launch

            try {
                val settings = com.julien.genpwdpro.data.models.Settings(
                    mode = com.julien.genpwdpro.data.models.GenerationMode.CUSTOM_PHRASE,
                    customPhraseWords = wordList,
                    customPhraseWordCount = _uiState.value.wordCount,
                    customPhraseSeparator = _uiState.value.separator,
                    customPhraseFormat = _uiState.value.selectedFormat
                )

                val preview = customPhraseGenerator.generate(settings)
                _uiState.update { it.copy(preview = preview) }
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private fun validateWordList() {
        val wordList = customPhraseGenerator.parseWordList(_uiState.value.wordListText)
        val validation = customPhraseGenerator.validateWordList(wordList)

        _uiState.update {
            it.copy(
                wordList = wordList,
                validation = validation
            )
        }
    }
}

/**
 * État de l'UI
 */
data class CustomPhraseUiState(
    val wordListText: String = "",
    val wordList: List<String> = emptyList(),
    val selectedFormat: CustomPhraseFormat = CustomPhraseFormat.SEPARATED,
    val wordCount: Int = 4,
    val separator: String = "-",
    val validation: WordListValidation = WordListValidation(
        isValid = false,
        error = "La liste de mots est vide",
        wordCount = 0,
        averageLength = 0.0,
        minEntropy = 0.0,
        maxEntropy = 0.0
    ),
    val preview: String = ""
)
