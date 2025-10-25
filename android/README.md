# GenPwd Pro - Version Android 🔐📱

Port Android de GenPwd Pro, le générateur de mots de passe sécurisés nouvelle génération.

## Vue d'ensemble

Cette version Android conserve **100% des fonctionnalités** de la version web tout en offrant une interface utilisateur optimisée pour mobile.

### Fonctionnalités principales

- ✅ **3 modes de génération** : Syllables, Passphrase, Leet Speak
- ✅ **Placement visuel** : Contrôle précis des chiffres et spéciaux
- ✅ **Système de blocs** : Patterns de casse personnalisés (U/T/L)
- ✅ **Dictionnaires multilingues** : Français, English, Latin
- ✅ **Calcul d'entropie** : Jusqu'à 140 bits
- ✅ **Interface dark theme** : Material Design 3
- ✅ **Sections repliables** : Organisation intelligente sur mobile

## Stack technique

- **Langage** : Kotlin
- **UI** : Jetpack Compose + Material Design 3
- **Architecture** : MVVM (Model-View-ViewModel)
- **Injection de dépendances** : Hilt
- **Asynchrone** : Coroutines + Flow
- **Minimum SDK** : 24 (Android 7.0+)
- **Target SDK** : 34 (Android 14)

## Structure du projet

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/julien/genpwdpro/
│   │   │   ├── data/                    # Couche de données
│   │   │   │   ├── models/             # Modèles de données
│   │   │   │   │   ├── GenerationMode.kt
│   │   │   │   │   ├── Settings.kt
│   │   │   │   │   └── PasswordResult.kt
│   │   │   │   ├── repository/         # Repositories
│   │   │   │   └── local/              # Persistance locale
│   │   │   │
│   │   │   ├── domain/                 # Logique métier
│   │   │   │   ├── generators/         # Générateurs
│   │   │   │   │   ├── SyllablesGenerator.kt
│   │   │   │   │   ├── PassphraseGenerator.kt
│   │   │   │   │   └── LeetSpeakGenerator.kt
│   │   │   │   ├── usecases/          # Use cases
│   │   │   │   │   ├── GeneratePasswordUseCase.kt
│   │   │   │   │   ├── ApplyCasingUseCase.kt
│   │   │   │   │   └── PlaceCharactersUseCase.kt
│   │   │   │   └── utils/             # Utilitaires
│   │   │   │       ├── CharacterSets.kt
│   │   │   │       ├── EntropyCalculator.kt
│   │   │   │       └── DictionaryManager.kt
│   │   │   │
│   │   │   ├── presentation/           # Interface utilisateur
│   │   │   │   ├── screens/           # Écrans
│   │   │   │   │   └── GeneratorViewModel.kt
│   │   │   │   ├── components/        # Composants UI
│   │   │   │   ├── theme/             # Thème
│   │   │   │   │   ├── Color.kt
│   │   │   │   │   ├── Theme.kt
│   │   │   │   │   └── Type.kt
│   │   │   │   └── navigation/        # Navigation
│   │   │   │
│   │   │   └── di/                     # Injection de dépendances
│   │   │
│   │   ├── assets/dictionaries/        # Dictionnaires JSON
│   │   └── res/                        # Ressources Android
│   │
│   └── build.gradle.kts                # Configuration Gradle
│
├── build.gradle.kts                    # Configuration projet
├── settings.gradle.kts
└── README.md                           # Ce fichier
```

## Installation et build

### Prérequis

- Android Studio Hedgehog (2023.1.1) ou plus récent
- JDK 17
- SDK Android 24-34
- Gradle 8.1+

### Étapes

1. **Ouvrir le projet**
   ```bash
   cd android
   # Ouvrir avec Android Studio
   ```

2. **Synchroniser Gradle**
   ```
   File → Sync Project with Gradle Files
   ```

3. **Copier les dictionnaires**
   ```bash
   # Copier les dictionnaires depuis le projet web
   cp -r ../dictionaries/* app/src/main/assets/dictionaries/
   ```

4. **Build**
   ```bash
   ./gradlew assembleDebug
   ```

5. **Installer sur appareil**
   ```bash
   ./gradlew installDebug
   ```

## Architecture détaillée

### Modèles de données

#### Settings
Configuration complète de génération :
```kotlin
data class Settings(
    val mode: GenerationMode,
    val quantity: Int,
    val maskDisplay: Boolean,
    val digitsCount: Int,
    val specialsCount: Int,
    val customSpecials: String,
    val digitsPlacement: Placement,
    val specialsPlacement: Placement,
    val caseMode: CaseMode,
    val caseBlocks: List<CaseBlock>,
    // ... paramètres spécifiques aux modes
)
```

#### PasswordResult
Résultat de génération :
```kotlin
data class PasswordResult(
    val password: String,
    val entropy: Double,
    val mode: GenerationMode,
    val settings: Settings,
    val isMasked: Boolean
)
```

### Générateurs

#### SyllablesGenerator
Génère des mots de passe prononcables par alternance consonnes/voyelles :
```kotlin
// Exemple de sortie
"nywOVyQep.OcyBoWEFY8KiLu"
// Entropie: 95.2 bits
```

#### PassphraseGenerator
Génère des phrases de passe à partir de dictionnaires :
```kotlin
// Exemple de sortie
"Forcer-Vague-Nature-Soleil-Temps"
// Entropie: 78.4 bits
```

#### LeetSpeakGenerator
Transforme du texte en leet speak :
```kotlin
// Entrée: "password"
// Sortie: "p@55w0rd"
```

### Use Cases

#### GeneratePasswordUseCase
Coordonne toute la génération :
1. Génération de base (syllables/passphrase/leet)
2. Application de la casse
3. Placement des chiffres et spéciaux
4. Calcul de l'entropie

#### ApplyCasingUseCase
Applique les patterns de casse :
- Mixed: aléatoire
- Upper: MAJUSCULES
- Lower: minuscules
- Title: Title Case
- Blocks: U/T/L personnalisé

#### PlaceCharactersUseCase
Place les caractères selon les stratégies :
- Start: début
- End: fin
- Middle: milieu
- Random: aléatoire
- Visual: position visuelle (0-100%)

## Interface utilisateur

### Organisation par sections

L'interface est organisée en **sections repliables** pour gérer la complexité sur mobile :

#### 1. Section "Options principales"
- Sélecteur de mode (Syllables/Passphrase/Leet)
- Options spécifiques au mode :
  - Syllables : longueur + politique
  - Passphrase : mots + séparateur + dictionnaire
  - Leet : mot à transformer

#### 2. Section "Caractères"
- Nombre de chiffres (slider 0-6)
- Nombre de spéciaux (slider 0-6)
- Caractères spéciaux personnalisés
- Placement (dropdown + bottom sheet visuel)

#### 3. Section "Casse avancée"
- Mode de casse (dropdown)
- Éditeur de blocs (si mode Blocks)
  - Chips cliquables [U] [T] [L]
  - Boutons +/- et aléatoire

#### 4. Zone de résultats
- Cartes de résultats avec :
  - Mot de passe (masquable)
  - Entropie (bits)
  - Barre de force
  - Boutons copier/masquer

### Composants clés

#### ExpandableSection
Section repliable avec animation :
```kotlin
@Composable
fun ExpandableSection(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit
)
```

#### PasswordCard
Carte de résultat :
```kotlin
@Composable
fun PasswordCard(
    result: PasswordResult,
    onCopy: () -> Unit,
    onToggleMask: () -> Unit
)
```

#### PlacementSlider
Slider de placement visuel :
```kotlin
@Composable
fun PlacementSlider(
    position: Int,
    onPositionChange: (Int) -> Unit
)
```

## Thème et design

### Couleurs (Dark Theme)
```kotlin
val PrimaryCyan = Color(0xFF15BEFF)
val BackgroundDark = Color(0xFF0A0E1A)
val SurfaceDark = Color(0xFF131A34)
val TextPrimary = Color(0xFFD6DCFF)
```

### Typographie
```kotlin
val Typography = Typography(
    displayLarge = TextStyle(fontSize = 32.sp),
    bodyLarge = TextStyle(fontSize = 16.sp),
    // ...
)
```

## Fonctionnalités à implémenter

### Phase 1 (MVP) - À compléter
- [x] Architecture de base
- [x] Modèles de données
- [x] Générateurs
- [x] Use cases
- [x] ViewModel
- [ ] UI complète avec Compose
- [ ] Navigation
- [ ] Tests unitaires

### Phase 2 (v1.1)
- [ ] Historique avec Room
- [ ] Export/Import JSON
- [ ] DataStore pour persistence
- [ ] Tests UI
- [ ] Suite de tests intégrée

### Phase 3 (v1.2)
- [ ] Bottom sheets pour placement
- [ ] Animations avancées
- [ ] Widgets Android
- [ ] Support tablettes
- [ ] Thème clair (optionnel)

### Phase 4 (v2.0)
- [ ] Dictionnaires personnalisés
- [ ] Cloud sync (optionnel)
- [ ] Biométrie
- [ ] Intégration gestionnaires de mots de passe
- [ ] Shortcuts
- [ ] App widgets

## Tests

### Tests unitaires
```bash
./gradlew test
```

### Tests d'instrumentation
```bash
./gradlew connectedAndroidTest
```

### Tests à implémenter
- [ ] SyllablesGeneratorTest
- [ ] PassphraseGeneratorTest
- [ ] LeetSpeakGeneratorTest
- [ ] EntropyCalculatorTest
- [ ] ApplyCasingUseCaseTest
- [ ] PlaceCharactersUseCaseTest
- [ ] GeneratorViewModelTest

## Documentation complémentaire

- [Architecture détaillée](../docs/ANDROID-ARCHITECTURE.md) - Plan complet de l'architecture
- [Guide utilisateur](../docs/USER-GUIDE.md) - Documentation des fonctionnalités
- [Documentation technique](../docs/TECHNICAL.md) - Détails techniques

## Comparaison Web vs Android

| Fonctionnalité | Web | Android | Commentaire |
|----------------|-----|---------|-------------|
| Modes de génération | ✅ | ✅ | 3 modes identiques |
| Placement visuel | ✅ | ✅ | Adapté au touch |
| Système de blocs | ✅ | ✅ | UI repensée pour mobile |
| Dictionnaires | ✅ | ✅ | Chargés depuis assets/ |
| Calcul entropie | ✅ | ✅ | Même formule |
| Tests intégrés | ✅ | 🚧 | À implémenter |
| Export/Import | ✅ | 🚧 | À implémenter |
| Historique | ❌ | 🚧 | Nouveau sur Android |

## Contributions

Pour contribuer au port Android :

1. Suivre l'architecture MVVM établie
2. Utiliser Jetpack Compose pour l'UI
3. Respecter le thème et les couleurs
4. Écrire des tests unitaires
5. Documenter le code

## Licence

Apache 2.0 © 2025 Julien Bombled

Identique à la version web.

## Contact et support

- **GitHub** : https://github.com/VBlackJack/genpwd-pro
- **Issues** : https://github.com/VBlackJack/genpwd-pro/issues
- **Version** : 2.5.1 (port Android en développement)

---

**Note** : Ce port Android est en développement actif. Toutes les fonctionnalités de base sont implémentées au niveau de la logique métier, mais l'interface utilisateur complète est encore en cours de finalisation.
