# GenPwd Pro - Outils de Build

## Vue d'ensemble

Ce dossier contient des scripts automatisés pour gérer les builds Android avec gestion de version automatique.

## Fichiers

- `auto-build.bat` - Script principal de build (Windows)
- `version-helper.ps1` - Script PowerShell pour la gestion des versions
- `BUILD-TOOLS-README.md` - Ce fichier (documentation)

## Utilisation

### Build standard

```batch
.\auto-build.bat
```

Le script vous guidera à travers les étapes:
1. Choix du type de build (Debug/Release)
2. Options additionnelles (Lint, Tests, Copie vers dist/)
3. Lecture et confirmation de la version actuelle
4. Incrémentation automatique de la version
5. Compilation de l'APK
6. Vérification et rapport

### Options disponibles

#### Options de build
- **Debug**: Génère un APK de débogage (non signé)
- **Release**: Génère un APK de production (signé)

#### Options additionnelles
- **Lint**: Exécute l'analyse statique du code avant le build
- **Tests**: Exécute les tests unitaires avant le build
- **Copie vers dist/**: Copie l'APK généré dans un dossier `dist/` avec un nom standardisé

## Gestion des versions

### Format de version

Le projet utilise le format [Semantic Versioning](https://semver.org/) avec des suffixes:
- **Format**: `MAJOR.MINOR.PATCH-STAGE.NUMBER`
- **Exemple**: `1.2.0-alpha.15`

Où:
- `MAJOR`: Version majeure (changements incompatibles)
- `MINOR`: Version mineure (nouvelles fonctionnalités compatibles)
- `PATCH`: Correctifs (corrections de bugs)
- `STAGE`: Stade de développement (`alpha`, `beta`, `rc`)
- `NUMBER`: Numéro de build pour le stade

### Incrémentation de version

Le script `version-helper.ps1` supporte plusieurs types d'incrémentation:

```powershell
# Incrémenter alpha (1.2.0-alpha.15 → 1.2.0-alpha.16)
.\version-helper.ps1 -Action IncrementAlpha

# Incrémenter beta (1.2.0-beta.5 → 1.2.0-beta.6)
.\version-helper.ps1 -Action IncrementBeta

# Incrémenter version mineure (1.2.0 → 1.3.0-alpha.1)
.\version-helper.ps1 -Action IncrementMinor

# Incrémenter version majeure (1.2.0 → 2.0.0-alpha.1)
.\version-helper.ps1 -Action IncrementMajor

# Obtenir la version actuelle
.\version-helper.ps1 -Action GetVersionName
.\version-helper.ps1 -Action GetVersionCode
.\version-helper.ps1 -Action GetFullVersion
```

### Gestion des échecs de build

**IMPORTANT**: Si un build échoue, le script restaure automatiquement l'ancienne version dans `build.gradle.kts`.

Cependant, cela peut causer des problèmes:
- Si vous faites plusieurs tentatives de build qui échouent
- Au build suivant réussi, vous utiliserez la même version incrémentée
- Résultat: vous "sautez" des numéros de version

**Solutions**:

1. **Option 1 - Conserver la version après échec** (Recommandé pour le développement):
   - Ne pas restaurer la version après un échec
   - Chaque tentative utilise une nouvelle version
   - Avantage: Traçabilité complète de toutes les tentatives
   - Inconvénient: Numéros de version "trous" dans l'historique

2. **Option 2 - Restaurer et réutiliser** (Par défaut actuel):
   - Restaure la version après échec
   - Le prochain build réussit utilisera la même version incrémentée
   - Avantage: Pas de trous dans les numéros
   - Inconvénient: Perte de traçabilité des tentatives échouées

3. **Option 3 - Manuel**:
   - Ne pas incrémenter automatiquement
   - Gérer manuellement les versions dans `build.gradle.kts`

**Recommandation**: Pour le développement actif, il est préférable de ne PAS restaurer après échec. Chaque build (même échoué) devrait avoir son propre numéro. Les trous dans la numérotation ne sont pas un problème.

## Sorties du script

### Fichiers générés

- **APK**: `app/build/outputs/apk/[debug|release]/*.apk`
- **Copie dist**: `dist/genpwd-pro-vX.Y.Z-[debug|release].apk` (si option activée)
- **Rapport**: `build-report-X.Y.Z-[debug|release].txt`
- **Backup**: `app/build.gradle.kts.backup` (backup automatique avant modification)

### Rapport de build

Le script génère un rapport détaillé contenant:
- Date et heure du build
- Version (versionName et versionCode)
- Type de build (Debug/Release)
- Nom et taille de l'APK
- Options utilisées (Lint, Tests, etc.)
- Versions Gradle et Kotlin
- Changements de version

## Vérifications de sécurité

### Pour les builds Release

Le script effectue automatiquement:
1. **Vérification de signature**: Vérifie que l'APK est correctement signé
2. **Vérification de taille**: Alerte si l'APK est anormalement petit (< 1 MB)

### Pour tous les builds

- Backup automatique du fichier `build.gradle.kts` avant modification
- Restauration en cas d'erreur (optionnel)
- Validation du format de version

## Exemples d'utilisation

### Scénario 1: Build de développement quotidien

```batch
# Lancer le build
.\auto-build.bat

# Choisir:
# - Type: 1 (Debug)
# - Lint: N
# - Tests: N
# - Copie dist: O

# Résultat:
# - Version incrémentée automatiquement
# - APK dans dist/ prêt à tester
# - Rapport de build généré
```

### Scénario 2: Build de release pour production

```batch
# Lancer le build
.\auto-build.bat

# Choisir:
# - Type: 2 (Release)
# - Lint: O (recommandé)
# - Tests: O (recommandé)
# - Copie dist: O

# Résultat:
# - Lint et tests exécutés
# - APK signé et vérifié
# - Prêt pour distribution
```

### Scénario 3: Passage de alpha à beta

```powershell
# Manuellement incrémenter vers beta
.\version-helper.ps1 -Action IncrementBeta

# Puis build normalement
.\auto-build.bat
```

### Scénario 4: Nouvelle version mineure

```powershell
# Passer à la version suivante (ex: 1.2.x → 1.3.0-alpha.1)
.\version-helper.ps1 -Action IncrementMinor
.\version-helper.ps1 -Action UpdateVersions -NewVersionCode 25 -NewVersionName "1.3.0-alpha.1"

# Puis build normalement
.\auto-build.bat
```

## Troubleshooting

### Le script ne trouve pas l'APK généré

**Symptôme**: Message "ERREUR: Aucun APK trouvé"

**Solution**: Le script utilise maintenant une détection automatique avec pattern matching. Vérifiez que:
1. Le build Gradle a réellement réussi
2. Le dossier `app/build/outputs/apk/[debug|release]/` existe
3. Il contient au moins un fichier `.apk`

### La version n'est pas incrémentée

**Symptôme**: La version reste la même après le build

**Solution**:
1. Vérifiez que vous avez confirmé l'incrémentation (répondu "O")
2. Vérifiez les permissions d'écriture sur `app/build.gradle.kts`
3. Consultez le backup dans `app/build.gradle.kts.backup`

### Erreur de signature sur Release

**Symptôme**: "L'APK release n'est pas signé"

**Solution**:
1. Vérifiez votre configuration de signature dans `build.gradle.kts`
2. Assurez-vous que le keystore est présent et accessible
3. Vérifiez les credentials de signature

### Plusieurs builds échoués - versions sautées

**Symptôme**: Après plusieurs builds échoués, des numéros de version sont sautés

**Solution actuelle**: C'est un comportement connu (voir section "Gestion des échecs de build" ci-dessus)

**Workaround**:
- Option A: Accepter les trous dans la numérotation (recommandé)
- Option B: Après un échec, noter la version et la réutiliser manuellement au prochain build
- Option C: Modifier le script pour ne pas restaurer après échec

## Changelog des outils

### Version 2.0 (Actuelle)
- ✅ Détection automatique de l'APK (plus robuste)
- ✅ Options pour Lint et Tests
- ✅ Vérification de signature pour Release
- ✅ Vérification de taille d'APK
- ✅ Génération de rapport de build
- ✅ Copie automatique vers dist/
- ✅ Support pour beta et incrémentation majeure/mineure
- ✅ Backup automatique avant modification
- ✅ Meilleure gestion d'erreurs

### Version 1.0 (Initiale)
- Incrémentation alpha basique
- Build Debug/Release
- Restauration sur échec

## À venir

Fonctionnalités prévues pour les prochaines versions:
- [ ] Option pour ne pas restaurer après échec
- [ ] Support pour les versions RC (Release Candidate)
- [ ] Intégration Git (tag automatique)
- [ ] Génération de changelog automatique
- [ ] Notification de fin de build (son/email)
- [ ] Support multi-flavor/variant
- [ ] Statistiques de build (durée, succès/échec)

## Contribution

Pour contribuer aux outils de build:
1. Testez les modifications localement
2. Documentez les changements dans ce README
3. Mettez à jour le numéro de version des scripts
4. Créez un commit séparé pour les outils de build
