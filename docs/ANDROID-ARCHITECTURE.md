# GenPwd Pro - Architecture Android

## Vue d'ensemble

Port Android de GenPwd Pro conservant 100% des fonctionnalités avec une interface optimisée pour mobile.

## Stack technique

### Technologies choisies
- **Langage**: Kotlin
- **UI Framework**: Jetpack Compose (Material Design 3)
- **Architecture**: MVVM (Model-View-ViewModel)
- **Gestion d'état**: StateFlow / Flow
- **Persistance**: DataStore (préférences) + Room (historique)
- **Injection de dépendances**: Hilt
- **Tests**: JUnit 5 + Compose UI Tests

### Justification
- **Jetpack Compose**: UI déclarative moderne, parfaite pour les interfaces complexes
- **Material Design 3**: Composants natifs avec thème sombre
- **MVVM**: Séparation claire de la logique métier et de l'UI
- **Kotlin**: Interopérabilité avec le code JS existant, concision

## Architecture de l'interface utilisateur

### Défi principal
L'application web a **12+ contrôles de configuration** qui doivent être accessibles sans surcharger l'écran mobile.

### Solution: Organisation hiérarchique intelligente

#### 1. Écran principal (PasswordGeneratorScreen)
```
┌─────────────────────────────────┐
│  GenPwd Pro        [≡] [ⓘ]     │ ← Header compact
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐ │
│  │  Mode: Syllables      ▼  │ │ ← Sélecteur de mode
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ [Options principales] ▼   │ │ ← Section repliable
│  │  Longueur: 20             │ │
│  │  ━━━━━●━━━━━━━━           │ │
│  │  Politique: Standard   ▼  │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ [Caractères] ▼            │ │ ← Section repliable
│  │  Chiffres: 2  Spéciaux: 2│ │
│  │  Placement visuel ⚙      │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ [Casse avancée] ▼         │ │ ← Section repliable
│  │  Mode: Blocs              │ │
│  │  [U] [T] [L] [T]   +  🎲 │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌─────────────┐               │
│  │  🔒 GÉNÉRER │               │ ← Bouton principal (FAB)
│  └─────────────┘               │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │ mywOVyQep.Ocy    [📋] [👁]│ │ ← Carte de résultat
│  │ 95.2 bits  ████████░░     │ │
│  └───────────────────────────┘ │
│  ┌───────────────────────────┐ │
│  │ BoWEFY8Ki.Lu     [📋] [👁]│ │
│  │ 89.4 bits  ███████░░░     │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

#### 2. Organisation par sections repliables (Expandable Cards)

**Section "Options principales"** (toujours visible par défaut)
- Mode de génération (dropdown)
- Options spécifiques au mode:
  - Syllables: longueur + politique
  - Passphrase: nombre de mots + séparateur + dictionnaire
  - Leet: mot à transformer

**Section "Caractères"** (repliable)
- Nombre de chiffres (0-6) - Slider compact
- Nombre de spéciaux (0-6) - Slider compact
- Caractères spéciaux personnalisés (TextField)
- Bouton "Placement visuel" → ouvre bottom sheet

**Section "Casse avancée"** (repliable)
- Mode de casse (dropdown)
- Si "Blocs": éditeur de blocs horizontal scrollable
  - Chips cliquables [U] [T] [L]
  - Boutons +/- pour ajouter/supprimer
  - Bouton aléatoire 🎲

**Section "Résultats"** (sticky à droite du FAB)
- Nombre de mots de passe (1-20) - Slider compact
- Masquer l'affichage (Switch)

#### 3. Bottom Sheets pour les fonctionnalités complexes

##### Placement visuel (PlacementBottomSheet)
```
┌─────────────────────────────────┐
│  Placement des caractères       │
│                                 │
│  Chiffres:                      │
│  ● Aléatoire  ○ Début  ○ Fin   │
│  ○ Milieu     ○ Visuel          │
│                                 │
│  [Si "Visuel" sélectionné]      │
│  ┌───────────────────────────┐ │
│  │ ├─────●───────────────┤   │ │ ← Barre interactive
│  │ Position: 25%             │ │
│  └───────────────────────────┘ │
│                                 │
│  Aperçu: nywOVy36Qep.Ocy       │
│          ▲                      │
│                                 │
│  Spéciaux: [Même interface]    │
│                                 │
│  [ Appliquer ]                  │
└─────────────────────────────────┘
```

##### Dictionnaires (DictionaryBottomSheet)
```
┌─────────────────────────────────┐
│  Dictionnaires                  │
│                                 │
│  ○ 🇫🇷 Français (2429 mots)    │
│  ● 🇬🇧 English (3000+ mots)    │
│  ○ 🏛️ Latin (1500+ mots)       │
│                                 │
│  [Ajouter dictionnaire]         │
│                                 │
│  [ Fermer ]                     │
└─────────────────────────────────┘
```

##### Menu principal (Navigation Drawer)
```
┌─────────────────────────────────┐
│  GenPwd Pro v2.5.1              │
│                                 │
│  🔐 Générateur (actif)          │
│  📊 Historique                  │
│  🧪 Tests                       │
│  ⚙️ Paramètres                 │
│  ℹ️ À propos                   │
│  📤 Export/Import               │
│                                 │
└─────────────────────────────────┘
```

### 4. Écrans secondaires

#### Écran Historique
```
┌─────────────────────────────────┐
│  ← Historique         [🗑️] [🔍] │
├─────────────────────────────────┤
│  Aujourd'hui                    │
│  ┌───────────────────────────┐ │
│  │ mywOVyQep.Ocy             │ │
│  │ 95.2 bits • 14:32         │ │
│  │ Mode: Syllables           │ │
│  │ [📋 Copier] [🔄 Régénérer]│ │
│  └───────────────────────────┘ │
│                                 │
│  Hier                           │
│  ┌───────────────────────────┐ │
│  │ Forcer-Vague-Nature       │ │
│  │ 78.4 bits • 09:15         │ │
│  │ Mode: Passphrase          │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

#### Écran Tests
```
┌─────────────────────────────────┐
│  ← Tests intégrés     [▶️ Lancer]│
├─────────────────────────────────┤
│                                 │
│        ┌─────────┐              │
│        │   98%   │              │
│        └─────────┘              │
│     13 réussis • 0 échoués      │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  ✅ Syllables base              │
│     5 mots • 95.2 bits moy.     │
│                                 │
│  ✅ Passphrase                  │
│     5 mots • 78.4 bits moy.     │
│                                 │
│  ✅ Leet speak                  │
│     "P@55W0RD" généré           │
│                                 │
│  [📊 Détails] [📤 Export]       │
└─────────────────────────────────┘
```

## Architecture logicielle

### Structure des packages

```
com.julien.genpwdpro/
├── data/
│   ├── models/
│   │   ├── GenerationMode.kt
│   │   ├── PasswordResult.kt
│   │   ├── Settings.kt
│   │   └── CaseBlock.kt
│   ├── repository/
│   │   ├── PasswordRepository.kt
│   │   ├── DictionaryRepository.kt
│   │   └── HistoryRepository.kt
│   └── local/
│       ├── dao/
│       │   └── PasswordHistoryDao.kt
│       ├── database/
│       │   └── AppDatabase.kt
│       └── preferences/
│           └── SettingsDataStore.kt
│
├── domain/
│   ├── generators/
│   │   ├── PasswordGenerator.kt (interface)
│   │   ├── SyllablesGenerator.kt
│   │   ├── PassphraseGenerator.kt
│   │   └── LeetSpeakGenerator.kt
│   ├── usecases/
│   │   ├── GeneratePasswordUseCase.kt
│   │   ├── CalculateEntropyUseCase.kt
│   │   ├── ApplyCasingUseCase.kt
│   │   └── PlaceCharactersUseCase.kt
│   └── utils/
│       ├── CharacterSets.kt
│       ├── EntropyCalculator.kt
│       └── CasingUtils.kt
│
├── presentation/
│   ├── screens/
│   │   ├── generator/
│   │   │   ├── GeneratorScreen.kt
│   │   │   ├── GeneratorViewModel.kt
│   │   │   └── components/
│   │   │       ├── ModeSelector.kt
│   │   │       ├── OptionsSection.kt
│   │   │       ├── CharactersSection.kt
│   │   │       ├── CasingSection.kt
│   │   │       ├── BlocksEditor.kt
│   │   │       └── ResultCard.kt
│   │   ├── history/
│   │   │   ├── HistoryScreen.kt
│   │   │   └── HistoryViewModel.kt
│   │   ├── tests/
│   │   │   ├── TestsScreen.kt
│   │   │   └── TestsViewModel.kt
│   │   └── about/
│   │       └── AboutScreen.kt
│   ├── bottomsheets/
│   │   ├── PlacementBottomSheet.kt
│   │   └── DictionaryBottomSheet.kt
│   ├── navigation/
│   │   └── AppNavigation.kt
│   └── theme/
│       ├── Theme.kt
│       ├── Color.kt
│       └── Type.kt
│
└── di/
    ├── AppModule.kt
    ├── RepositoryModule.kt
    └── GeneratorModule.kt
```

### Modèles de données principaux

#### Settings.kt
```kotlin
data class Settings(
    val mode: GenerationMode,
    val quantity: Int = 5,
    val maskDisplay: Boolean = true,
    val digitsCount: Int = 2,
    val specialsCount: Int = 2,
    val customSpecials: String = "_+-=.@#%",
    val digitsPlacement: Placement = Placement.RANDOM,
    val specialsPlacement: Placement = Placement.RANDOM,
    val caseMode: CaseMode = CaseMode.MIXED,
    val caseBlocks: List<CaseBlock> = listOf(CaseBlock.TITLE, CaseBlock.LOWER),
    val syllablesLength: Int = 20,
    val policy: CharPolicy = CharPolicy.STANDARD,
    val passphraseWordCount: Int = 5,
    val passphraseSeparator: String = "-",
    val dictionary: DictionaryType = DictionaryType.FRENCH,
    val leetWord: String = "password"
)

enum class GenerationMode { SYLLABLES, PASSPHRASE, LEET }
enum class Placement { START, END, MIDDLE, RANDOM, VISUAL }
enum class CaseMode { MIXED, UPPER, LOWER, TITLE, BLOCKS }
enum class CaseBlock { U, T, L }
enum class CharPolicy { STANDARD, STANDARD_LAYOUT, ALPHANUMERIC, ALPHANUMERIC_LAYOUT }
enum class DictionaryType { FRENCH, ENGLISH, LATIN }
```

#### PasswordResult.kt
```kotlin
data class PasswordResult(
    val id: String = UUID.randomUUID().toString(),
    val password: String,
    val entropy: Double,
    val mode: GenerationMode,
    val timestamp: Long = System.currentTimeMillis(),
    val settings: Settings,
    val isMasked: Boolean = true
)
```

### ViewModels principaux

#### GeneratorViewModel.kt
```kotlin
@HiltViewModel
class GeneratorViewModel @Inject constructor(
    private val generatePasswordUseCase: GeneratePasswordUseCase,
    private val historyRepository: HistoryRepository,
    private val settingsDataStore: SettingsDataStore
) : ViewModel() {

    private val _settings = MutableStateFlow(Settings())
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    private val _results = MutableStateFlow<List<PasswordResult>>(emptyList())
    val results: StateFlow<List<PasswordResult>> = _results.asStateFlow()

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    fun generatePasswords() {
        viewModelScope.launch {
            _uiState.value = UiState.Generating
            try {
                val passwords = generatePasswordUseCase(settings.value)
                _results.value = passwords
                historyRepository.savePasswords(passwords)
                _uiState.value = UiState.Success
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun updateSettings(update: (Settings) -> Settings) {
        _settings.value = update(settings.value)
        saveSettings()
    }

    fun toggleMask(resultId: String) {
        _results.value = results.value.map {
            if (it.id == resultId) it.copy(isMasked = !it.isMasked) else it
        }
    }

    // ... autres méthodes
}
```

## Fonctionnalités clés

### 1. Génération de mots de passe

Port direct de la logique JavaScript vers Kotlin:
- `SyllablesGenerator`: Alternance consonnes/voyelles
- `PassphraseGenerator`: Mots du dictionnaire + séparateurs
- `LeetSpeakGenerator`: Substitutions leetspeak

### 2. Placement visuel

Composant interactif avec:
- Slider horizontal (0-100%)
- Aperçu en temps réel
- Curseur visuel montrant la position exacte
- Support multi-touch pour chiffres ET spéciaux simultanément

### 3. Système de blocs

Interface tactile optimisée:
- Chips cliquables pour basculer U/T/L
- Swipe horizontal pour naviguer si > 5 blocs
- Boutons +/- avec haptic feedback
- Animation lors des changements

### 4. Dictionnaires

- Chargement asynchrone depuis assets/
- Mise en cache pour performance
- Fallback automatique sur dictionnaire français
- Support pour dictionnaires personnalisés (future feature)

### 5. Calcul d'entropie

Port exact de la formule JavaScript:
```kotlin
fun calculateEntropy(
    password: String,
    charset: Set<Char>,
    mode: GenerationMode
): Double {
    val poolSize = charset.size
    return password.length * log2(poolSize.toDouble())
}
```

### 6. Persistance

**Settings (DataStore)**
- Sauvegarde automatique à chaque modification
- Restauration au démarrage
- Format: Preferences DataStore (key-value)

**Historique (Room)**
- Table `password_history`
- Limite de 100 entrées (configurable)
- Recherche et filtrage
- Export CSV/JSON

### 7. Tests intégrés

Port de la suite de tests JavaScript:
- Tests unitaires (JUnit 5)
- Tests d'intégration (Hilt)
- Tests UI (Compose Test)
- Écran dédié avec résultats visuels

## Gestion des états

### États globaux
```kotlin
sealed class UiState {
    object Idle : UiState()
    object Generating : UiState()
    object Success : UiState()
    data class Error(val message: String) : UiState()
}
```

### États des sections
```kotlin
data class SectionState(
    val isExpanded: Boolean = true,
    val hasError: Boolean = false,
    val errorMessage: String? = null
)
```

## Thème et design

### Couleurs (Material Design 3)
```kotlin
val md_theme_dark_primary = Color(0xFF15BEFF)      // Bleu cyan
val md_theme_dark_secondary = Color(0xFF8C94CA)    // Gris-bleu
val md_theme_dark_tertiary = Color(0xFF10B981)     // Vert succès
val md_theme_dark_error = Color(0xFFEF4444)        // Rouge erreur
val md_theme_dark_background = Color(0xFF0A0E1A)   // Fond sombre
val md_theme_dark_surface = Color(0xFF131A34)      // Surface cartes
```

### Typographie
```kotlin
val AppTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 16.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Monospace, // Pour les mots de passe
        fontSize = 14.sp
    )
)
```

### Composants personnalisés

**PasswordCard**: Carte de résultat avec animations
- Animation de révélation (flip)
- Copie avec feedback visuel (snackbar)
- Barre d'entropie animée
- Support swipe-to-dismiss

**ExpandableSection**: Section repliable
- Animation smooth (animateContentSize)
- Icône chevron rotatif
- Badge de notification si erreur

**SliderWithLabel**: Slider avec valeur en temps réel
- Valeur affichée au-dessus du pouce
- Haptic feedback aux valeurs importantes
- Ticks visuels optionnels

## Performance et optimisations

### 1. Lazy loading
- Bottom sheets chargés à la demande
- Sections repliées: contenu non composé
- Historique: LazyColumn avec pagination

### 2. Mémoire
- Cache des dictionnaires limité (max 3)
- Historique limité (100 entrées)
- Nettoyage automatique des résultats anciens

### 3. Réactivité
- Debounce sur les inputs (300ms)
- StateFlow au lieu de LiveData (plus performant)
- Recomposition minimale avec remember et derivedStateOf

### 4. Gestes
- Swipe-to-dismiss sur les résultats
- Pull-to-refresh sur l'historique
- Long-press pour options contextuelles

## Gestion des permissions

### Permissions requises
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.VIBRATE" /> <!-- Haptic feedback -->
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
                 android:maxSdkVersion="28" /> <!-- Export fichiers -->
```

### Permissions optionnelles
- Aucune permission sensible requise
- Pas d'accès réseau (hors chargement initial)
- Pas d'accès caméra/micro/localisation

## Tests

### Structure des tests

```
androidTest/
├── com.julien.genpwdpro/
│   ├── ui/
│   │   ├── GeneratorScreenTest.kt
│   │   ├── PlacementBottomSheetTest.kt
│   │   └── BlocksEditorTest.kt
│   └── integration/
│       ├── PasswordGenerationIntegrationTest.kt
│       └── HistoryIntegrationTest.kt

test/
├── com.julien.genpwdpro/
│   ├── domain/
│   │   ├── SyllablesGeneratorTest.kt
│   │   ├── PassphraseGeneratorTest.kt
│   │   ├── LeetSpeakGeneratorTest.kt
│   │   └── EntropyCalculatorTest.kt
│   └── data/
│       └── PasswordRepositoryTest.kt
```

### Tests UI (exemple)
```kotlin
@Test
fun testPasswordGeneration() {
    composeTestRule.setContent {
        GeneratorScreen()
    }

    // Vérifier état initial
    composeTestRule.onNodeWithText("Générer").assertExists()

    // Cliquer sur générer
    composeTestRule.onNodeWithText("Générer").performClick()

    // Vérifier résultats
    composeTestRule.onNodeWithTag("result-card-0").assertExists()
    composeTestRule.onNodeWithText("bits").assertExists()
}
```

## Build et déploiement

### Configuration Gradle

```kotlin
// build.gradle.kts (app)
android {
    compileSdk = 34

    defaultConfig {
        applicationId = "com.julien.genpwdpro"
        minSdk = 24  // Android 7.0+ (95% des appareils)
        targetSdk = 34
        versionCode = 1
        versionName = "2.5.1"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.3"
    }
}

dependencies {
    // Compose
    implementation("androidx.compose.ui:ui:1.5.4")
    implementation("androidx.compose.material3:material3:1.1.2")
    implementation("androidx.compose.ui:ui-tooling-preview:1.5.4")

    // ViewModel & Navigation
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    implementation("androidx.navigation:navigation-compose:2.7.5")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.48")
    kapt("com.google.dagger:hilt-compiler:2.48")

    // Room
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    kapt("androidx.room:room-compiler:2.6.0")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.0.0")

    // Tests
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4:1.5.4")
}
```

### Versions multiples
- **Version free**: 5 résultats max, sans historique
- **Version pro**: Illimité, historique, export
- Utilisation de Product Flavors pour différencier

## Migration des données web → Android

### Stratégie d'import

1. **Export depuis web** (JSON)
```json
{
  "version": "2.5.1",
  "settings": { ... },
  "history": [ ... ]
}
```

2. **Import dans Android**
- Scanner QR code avec export JSON
- Partage de fichier (.genpwd)
- Parsing et validation
- Import dans Room + DataStore

## Roadmap

### Phase 1: Core (v1.0) - 4 semaines
- ✅ Architecture de base
- ✅ Générateurs (syllables, passphrase, leet)
- ✅ UI principale avec sections
- ✅ Placement visuel
- ✅ Système de blocs
- ✅ Calcul d'entropie

### Phase 2: Features (v1.1) - 2 semaines
- Historique avec recherche
- Export/Import JSON
- Tests intégrés
- Paramètres avancés

### Phase 3: Polish (v1.2) - 1 semaine
- Animations avancées
- Widgets Android
- Shortcuts
- Support tablettes

### Phase 4: Advanced (v2.0) - Future
- Dictionnaires personnalisés
- Cloud sync (optionnel)
- Biométrie
- Intégration gestionnaires de mots de passe

## Conclusion

Cette architecture permet de:
1. ✅ **Conserver 100% des fonctionnalités** de la version web
2. ✅ **Optimiser pour mobile** avec sections repliables et bottom sheets
3. ✅ **Expérience utilisateur fluide** grâce à Jetpack Compose
4. ✅ **Performance optimale** avec architecture MVVM et coroutines
5. ✅ **Extensibilité** pour futures fonctionnalités

L'application respecte les guidelines Material Design 3 tout en conservant l'identité visuelle de GenPwd Pro (thème sombre, couleurs cyan/violet).
