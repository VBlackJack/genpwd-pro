package com.julien.genpwdpro.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.julien.genpwdpro.data.models.*

/**
 * Section des options principales (mode + options spécifiques)
 */
@Composable
fun MainOptionsSection(
    settings: Settings,
    onSettingsChange: (Settings) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Sélecteur de mode
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Mode de génération",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            ModeDropdown(
                selectedMode = settings.mode,
                onModeSelected = { mode ->
                    onSettingsChange(settings.copy(mode = mode))
                }
            )
        }

        // Options spécifiques au mode
        when (settings.mode) {
            GenerationMode.SYLLABLES -> {
                SyllablesOptions(
                    length = settings.syllablesLength,
                    policy = settings.policy,
                    onLengthChange = { onSettingsChange(settings.copy(syllablesLength = it)) },
                    onPolicyChange = { onSettingsChange(settings.copy(policy = it)) }
                )
            }
            GenerationMode.PASSPHRASE -> {
                PassphraseOptions(
                    wordCount = settings.passphraseWordCount,
                    separator = settings.passphraseSeparator,
                    dictionary = settings.dictionary,
                    onWordCountChange = { onSettingsChange(settings.copy(passphraseWordCount = it)) },
                    onSeparatorChange = { onSettingsChange(settings.copy(passphraseSeparator = it)) },
                    onDictionaryChange = { onSettingsChange(settings.copy(dictionary = it)) }
                )
            }
            GenerationMode.LEET -> {
                LeetOptions(
                    word = settings.leetWord,
                    onWordChange = { onSettingsChange(settings.copy(leetWord = it)) }
                )
            }
            GenerationMode.CUSTOM_PHRASE -> {
                // TODO: Implement CustomPhraseOptions composable
                // For now, empty options section
            }
        }
    }
}

@Composable
private fun ModeDropdown(
    selectedMode: GenerationMode,
    onModeSelected: (GenerationMode) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = getModeLabel(selectedMode),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            GenerationMode.values().forEach { mode ->
                DropdownMenuItem(
                    text = { Text(getModeLabel(mode)) },
                    onClick = {
                        onModeSelected(mode)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun SyllablesOptions(
    length: Int,
    policy: CharPolicy,
    onLengthChange: (Int) -> Unit,
    onPolicyChange: (CharPolicy) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SettingsSlider(
            label = "Longueur",
            value = length,
            valueRange = Settings.MIN_SYLLABLES_LENGTH..Settings.MAX_SYLLABLES_LENGTH,
            onValueChange = onLengthChange
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Politique",
                style = MaterialTheme.typography.bodyMedium
            )
            PolicyDropdown(
                selectedPolicy = policy,
                onPolicySelected = onPolicyChange
            )
        }
    }
}

@Composable
private fun PassphraseOptions(
    wordCount: Int,
    separator: String,
    dictionary: DictionaryType,
    onWordCountChange: (Int) -> Unit,
    onSeparatorChange: (String) -> Unit,
    onDictionaryChange: (DictionaryType) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SettingsSlider(
            label = "Nombre de mots",
            value = wordCount,
            valueRange = Settings.MIN_PASSPHRASE_WORDS..Settings.MAX_PASSPHRASE_WORDS,
            onValueChange = onWordCountChange
        )

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Séparateur", style = MaterialTheme.typography.bodyMedium)
            SeparatorDropdown(
                selectedSeparator = separator,
                onSeparatorSelected = onSeparatorChange
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Dictionnaire", style = MaterialTheme.typography.bodyMedium)
            DictionaryDropdown(
                selectedDictionary = dictionary,
                onDictionarySelected = onDictionaryChange
            )
        }
    }
}

@Composable
private fun LeetOptions(
    word: String,
    onWordChange: (String) -> Unit
) {
    OutlinedTextField(
        value = word,
        onValueChange = onWordChange,
        label = { Text("Mot à transformer") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true
    )
}

@Composable
private fun PolicyDropdown(
    selectedPolicy: CharPolicy,
    onPolicySelected: (CharPolicy) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = getPolicyLabel(selectedPolicy),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            CharPolicy.values().forEach { policy ->
                DropdownMenuItem(
                    text = { Text(getPolicyLabel(policy)) },
                    onClick = {
                        onPolicySelected(policy)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun SeparatorDropdown(
    selectedSeparator: String,
    onSeparatorSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val separators = mapOf(
        "-" to "- (tiret)",
        "_" to "_ (souligné)",
        "." to ". (point)",
        " " to "Espace"
    )

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = separators[selectedSeparator] ?: selectedSeparator,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            separators.forEach { (sep, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    onClick = {
                        onSeparatorSelected(sep)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun DictionaryDropdown(
    selectedDictionary: DictionaryType,
    onDictionarySelected: (DictionaryType) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = "${selectedDictionary.flag} ${selectedDictionary.displayName}",
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DictionaryType.values().forEach { dict ->
                DropdownMenuItem(
                    text = { Text("${dict.flag} ${dict.displayName}") },
                    onClick = {
                        onDictionarySelected(dict)
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun getModeLabel(mode: GenerationMode): String = when (mode) {
    GenerationMode.SYLLABLES -> "Syllabes (alternance C/V)"
    GenerationMode.PASSPHRASE -> "Passphrase (mots séparés)"
    GenerationMode.LEET -> "Mot → Leet"
    GenerationMode.CUSTOM_PHRASE -> "Custom Phrase (mots personnalisés)"
}

private fun getPolicyLabel(policy: CharPolicy): String = when (policy) {
    CharPolicy.STANDARD -> "Standard (tous caractères)"
    CharPolicy.STANDARD_LAYOUT -> "Standard Layout-Safe"
    CharPolicy.ALPHANUMERIC -> "Alphanumérique"
    CharPolicy.ALPHANUMERIC_LAYOUT -> "Alpha Layout-Safe"
}
