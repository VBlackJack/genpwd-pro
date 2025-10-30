package com.julien.genpwdpro.presentation.vault

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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.julien.genpwdpro.data.db.entity.EntryType
import com.julien.genpwdpro.data.models.CaseMode
import com.julien.genpwdpro.data.models.GenerationMode
import com.julien.genpwdpro.data.models.Settings
import com.julien.genpwdpro.presentation.utils.SecureWindow

/**
 * Écran de création/édition d'une entrée
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EntryEditScreen(
    vaultId: String,
    entryId: String? = null,
    entryType: EntryType = EntryType.LOGIN,
    initialPassword: String? = null,
    onSaved: () -> Unit,
    onBackClick: () -> Unit,
    viewModel: EntryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val title by viewModel.title.collectAsState()
    val username by viewModel.username.collectAsState()
    val password by viewModel.password.collectAsState()
    val url by viewModel.url.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val isFavorite by viewModel.isFavorite.collectAsState()
    val hasTOTP by viewModel.hasTOTP.collectAsState()
    val totpSecret by viewModel.totpSecret.collectAsState()
    val totpIssuer by viewModel.totpIssuer.collectAsState()
    val passwordStrength by viewModel.passwordStrength.collectAsState()
    val currentEntryType by viewModel.entryType.collectAsState()

    var showPassword by remember { mutableStateOf(false) }
    var showGeneratorDialog by remember { mutableStateOf(false) }
    var showTotpDialog by remember { mutableStateOf(false) }

    val focusManager = LocalFocusManager.current

    SecureWindow()

    // Initialiser le ViewModel
    LaunchedEffect(vaultId, entryId, initialPassword) {
        if (entryId != null) {
            viewModel.initForEdit(vaultId, entryId)
        } else {
            viewModel.initForCreate(vaultId, entryType)
            // Si un mot de passe initial est fourni, le placer dans le bon champ
            initialPassword?.let { password ->
                when (entryType) {
                    EntryType.NOTE -> {
                        // Pour une note sécurisée, mettre le contenu dans les notes
                        viewModel.updateNotes(password)
                    }
                    else -> {
                        // Pour LOGIN et WIFI, mettre dans le champ password
                        viewModel.updatePassword(password)
                    }
                }
            }
        }
    }

    // Observer la sauvegarde
    LaunchedEffect(uiState) {
        if (uiState is EntryUiState.Saved) {
            onSaved()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(if (entryId != null) "Modifier l'entrée" else "Nouvelle entrée")
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, "Retour")
                    }
                },
                actions = {
                    // Favori
                    IconButton(onClick = { viewModel.toggleFavorite() }) {
                        Icon(
                            if (isFavorite) Icons.Default.Star else Icons.Default.StarBorder,
                            "Favori",
                            tint = if (isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                        )
                    }

                    // Sauvegarder
                    IconButton(
                        onClick = { viewModel.saveEntry() },
                        enabled = uiState !is EntryUiState.Saving
                    ) {
                        if (uiState is EntryUiState.Saving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Save, "Sauvegarder")
                        }
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
            // Type d'entrée
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        when (currentEntryType) {
                            EntryType.LOGIN -> Icons.Default.Key
                            EntryType.WIFI -> Icons.Default.Wifi
                            EntryType.NOTE -> Icons.Default.Description
                            EntryType.CARD -> Icons.Default.CreditCard
                            EntryType.IDENTITY -> Icons.Default.Badge
                        },
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = when (currentEntryType) {
                            EntryType.LOGIN -> "Identifiant"
                            EntryType.WIFI -> "Réseau WiFi"
                            EntryType.NOTE -> "Note sécurisée"
                            EntryType.CARD -> "Carte bancaire"
                            EntryType.IDENTITY -> "Document d'identité"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            // Champs communs
            OutlinedTextField(
                value = title,
                onValueChange = { viewModel.updateTitle(it) },
                label = {
                    Text(
                        when (currentEntryType) {
                            EntryType.WIFI -> "SSID (nom du réseau) *"
                            EntryType.NOTE -> "Titre de la note *"
                            else -> "Titre *"
                        }
                    )
                },
                leadingIcon = {
                    Icon(
                        when (currentEntryType) {
                            EntryType.WIFI -> Icons.Default.Wifi
                            else -> Icons.Default.Title
                        },
                        null
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                )
            )

            // Champs spécifiques LOGIN
            if (currentEntryType == EntryType.LOGIN) {
                OutlinedTextField(
                    value = username,
                    onValueChange = { viewModel.updateUsername(it) },
                    label = { Text("Nom d'utilisateur / Email") },
                    leadingIcon = { Icon(Icons.Default.Person, null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    )
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { viewModel.updatePassword(it) },
                    label = { Text("Mot de passe *") },
                    leadingIcon = { Icon(Icons.Default.Password, null) },
                    trailingIcon = {
                        Row {
                            // Générer mot de passe
                            IconButton(onClick = { showGeneratorDialog = true }) {
                                Icon(Icons.Default.AutoAwesome, "Générer")
                            }
                            // Afficher/masquer
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    "Afficher/masquer"
                                )
                            }
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    )
                )

                // Force du mot de passe
                if (password.isNotEmpty()) {
                    PasswordStrengthIndicator(
                        strength = passwordStrength,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                OutlinedTextField(
                    value = url,
                    onValueChange = { viewModel.updateUrl(it) },
                    label = { Text("URL du site") },
                    leadingIcon = { Icon(Icons.Default.Link, null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    )
                )

                // TOTP Section
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = if (hasTOTP) {
                        CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer
                        )
                    } else {
                        CardDefaults.cardColors()
                    }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Security,
                                    contentDescription = null,
                                    tint = if (hasTOTP) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    "Authentification 2FA (TOTP)",
                                    style = MaterialTheme.typography.titleMedium
                                )
                            }

                            if (hasTOTP) {
                                IconButton(onClick = { showTotpDialog = true }) {
                                    Icon(Icons.Default.Edit, "Modifier")
                                }
                            } else {
                                Button(onClick = { showTotpDialog = true }) {
                                    Icon(Icons.Default.Add, null)
                                    Spacer(Modifier.width(4.dp))
                                    Text("Ajouter")
                                }
                            }
                        }

                        if (hasTOTP && totpIssuer.isNotEmpty()) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = "Émetteur: $totpIssuer",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                }
            }

            // Champs spécifiques WIFI
            if (currentEntryType == EntryType.WIFI) {
                // Mot de passe WiFi
                OutlinedTextField(
                    value = password,
                    onValueChange = { viewModel.updatePassword(it) },
                    label = { Text("Mot de passe WiFi *") },
                    leadingIcon = { Icon(Icons.Default.Password, null) },
                    trailingIcon = {
                        Row {
                            // Générer mot de passe
                            IconButton(onClick = { showGeneratorDialog = true }) {
                                Icon(Icons.Default.AutoAwesome, "Générer")
                            }
                            // Afficher/masquer
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    "Afficher/masquer"
                                )
                            }
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    )
                )

                // Force du mot de passe
                if (password.isNotEmpty()) {
                    PasswordStrengthIndicator(
                        strength = passwordStrength,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Type de sécurité WiFi
                OutlinedTextField(
                    value = username,
                    onValueChange = { viewModel.updateUsername(it) },
                    label = { Text("Type de sécurité") },
                    leadingIcon = { Icon(Icons.Default.Security, null) },
                    placeholder = { Text("WPA2, WPA3, WEP...") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    )
                )
            }

            // Notes / Contenu
            OutlinedTextField(
                value = notes,
                onValueChange = { viewModel.updateNotes(it) },
                label = {
                    Text(
                        when (currentEntryType) {
                            EntryType.NOTE -> "Contenu *"
                            EntryType.WIFI -> "Notes (optionnel)"
                            else -> "Notes"
                        }
                    )
                },
                leadingIcon = { Icon(Icons.Default.Notes, null) },
                modifier = Modifier.fillMaxWidth(),
                minLines = if (currentEntryType == EntryType.NOTE) 8 else 4,
                maxLines = if (currentEntryType == EntryType.NOTE) 20 else 10,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Default
                )
            )

            // Erreur
            if (uiState is EntryUiState.Error) {
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
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onErrorContainer
                        )
                        Text(
                            (uiState as EntryUiState.Error).message,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }
    }

    // Dialog générateur de mot de passe
    if (showGeneratorDialog) {
        PasswordGeneratorDialog(
            onDismiss = { showGeneratorDialog = false },
            onPasswordGenerated = { generated ->
                viewModel.updatePassword(generated)
                showGeneratorDialog = false
            },
            viewModel = viewModel
        )
    }

    // Dialog TOTP
    if (showTotpDialog) {
        TotpSetupDialog(
            currentSecret = totpSecret,
            currentIssuer = totpIssuer,
            onDismiss = { showTotpDialog = false },
            onSave = { secret, issuer ->
                viewModel.updateTotpSecret(secret)
                viewModel.updateTotpIssuer(issuer)
                showTotpDialog = false
            },
            onScanQr = {
                // TODO: Ouvrir le scanner QR
                showTotpDialog = false
            }
        )
    }
}

/**
 * Indicateur de force de mot de passe
 */
@Composable
private fun PasswordStrengthIndicator(
    strength: Int,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        LinearProgressIndicator(
            progress = strength / 100f,
            modifier = Modifier.fillMaxWidth(),
            color = when {
                strength < 30 -> MaterialTheme.colorScheme.error
                strength < 70 -> MaterialTheme.colorScheme.tertiary
                else -> MaterialTheme.colorScheme.primary
            }
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = when {
                strength < 30 -> "Faible"
                strength < 70 -> "Moyen"
                else -> "Fort"
            },
            style = MaterialTheme.typography.labelSmall,
            color = when {
                strength < 30 -> MaterialTheme.colorScheme.error
                strength < 70 -> MaterialTheme.colorScheme.onSurfaceVariant
                else -> MaterialTheme.colorScheme.primary
            }
        )
    }
}

/**
 * Dialog du générateur de mot de passe
 */
@Composable
private fun PasswordGeneratorDialog(
    onDismiss: () -> Unit,
    onPasswordGenerated: (String) -> Unit,
    viewModel: EntryViewModel
) {
    var length by remember { mutableStateOf(16) }
    var includeUppercase by remember { mutableStateOf(true) }
    var includeLowercase by remember { mutableStateOf(true) }
    var includeNumbers by remember { mutableStateOf(true) }
    var includeSymbols by remember { mutableStateOf(true) }
    var generatedPassword by remember { mutableStateOf("") }

    // Générer le premier mot de passe
    LaunchedEffect(Unit) {
        val settings = Settings(
            mode = GenerationMode.SYLLABLES,
            syllablesLength = length,
            digitsCount = if (includeNumbers) 2 else 0,
            specialsCount = if (includeSymbols) 2 else 0,
            caseMode = when {
                includeUppercase && includeLowercase -> CaseMode.MIXED
                includeUppercase -> CaseMode.UPPER
                includeLowercase -> CaseMode.LOWER
                else -> CaseMode.MIXED
            }
        )
        viewModel.generatePassword(settings)
        generatedPassword = viewModel.password.value
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.AutoAwesome, null) },
        title = { Text("Générateur de mot de passe") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // Mot de passe généré
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = generatedPassword,
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                // Longueur
                Column {
                    Text("Longueur: $length caractères")
                    Slider(
                        value = length.toFloat(),
                        onValueChange = { length = it.toInt() },
                        valueRange = 8f..32f,
                        steps = 24
                    )
                }

                // Options
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(includeUppercase, { includeUppercase = it })
                    Text("Majuscules (A-Z)")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(includeLowercase, { includeLowercase = it })
                    Text("Minuscules (a-z)")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(includeNumbers, { includeNumbers = it })
                    Text("Chiffres (0-9)")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(includeSymbols, { includeSymbols = it })
                    Text("Symboles (!@#$...)")
                }

                // Régénérer
                Button(
                    onClick = {
                        val settings = Settings(
                            mode = GenerationMode.SYLLABLES,
                            syllablesLength = length,
                            digitsCount = if (includeNumbers) 2 else 0,
                            specialsCount = if (includeSymbols) 2 else 0,
                            caseMode = when {
                                includeUppercase && includeLowercase -> CaseMode.MIXED
                                includeUppercase -> CaseMode.UPPER
                                includeLowercase -> CaseMode.LOWER
                                else -> CaseMode.MIXED
                            }
                        )
                        viewModel.generatePassword(settings)
                        generatedPassword = viewModel.password.value
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Refresh, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Régénérer")
                }
            }
        },
        confirmButton = {
            Button(onClick = { onPasswordGenerated(generatedPassword) }) {
                Text("Utiliser")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

/**
 * Dialog de configuration TOTP
 */
@Composable
private fun TotpSetupDialog(
    currentSecret: String,
    currentIssuer: String,
    onDismiss: () -> Unit,
    onSave: (secret: String, issuer: String) -> Unit,
    onScanQr: () -> Unit
) {
    var secret by remember { mutableStateOf(currentSecret) }
    var issuer by remember { mutableStateOf(currentIssuer) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Security, null) },
        title = { Text("Configuration TOTP") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Configurez l'authentification à deux facteurs (2FA) pour cette entrée.",
                    style = MaterialTheme.typography.bodyMedium
                )

                OutlinedTextField(
                    value = issuer,
                    onValueChange = { issuer = it },
                    label = { Text("Émetteur") },
                    placeholder = { Text("Ex: Google, GitHub...") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = secret,
                    onValueChange = { secret = it },
                    label = { Text("Secret TOTP (Base32)") },
                    placeholder = { Text("JBSWY3DPEHPK3PXP") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                Button(
                    onClick = onScanQr,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.QrCode, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Scanner un QR code")
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(secret, issuer) },
                enabled = secret.isNotEmpty()
            ) {
                Text("Enregistrer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}
