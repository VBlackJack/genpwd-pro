# 🏗️ Prompt de Compilation pour Claude Web CLI

## Contexte du Projet

Tu es sur le projet **genpwd-pro**, une application Android de gestion de mots de passe.

**Branche actuelle** : `claude/entry-crud-refactor-011CUYLbVDNVdxF238ZuefAf`

**État du code** : Le système file-based vault est maintenant complet avec les Phases 1-8 implémentées :
- Phase 6 : Entry CRUD refactor (EntryViewModel utilise FileVaultRepository)
- Phase 8 : CreateVaultDialog UI fix (dialog scrollable)

## 🎯 Objectif

Compiler l'APK debug du projet Android pour permettre le test sur un appareil ou émulateur.

## 📋 Instructions Étape par Étape

### Étape 1 : Vérifier l'environnement

```bash
# Vérifier que tu es sur la bonne branche
git branch --show-current

# Vérifier l'état du dépôt
git status

# Se positionner dans le répertoire Android
cd /home/user/genpwd-pro/android
```

### Étape 2 : Nettoyer le projet (optionnel)

```bash
# Nettoyer les builds précédents
./gradlew clean
```

### Étape 3 : Compiler l'APK Debug

```bash
# Compiler l'APK debug (peut prendre 5-15 minutes)
./gradlew assembleDebug --stacktrace --info
```

**Options importantes** :
- `assembleDebug` : Compile la variante debug (pas de signature release nécessaire)
- `--stacktrace` : Affiche la stacktrace complète en cas d'erreur
- `--info` : Affiche plus de logs pour le diagnostic

### Étape 4 : Localiser l'APK généré

```bash
# L'APK devrait être ici :
ls -lh app/build/outputs/apk/debug/

# Afficher le chemin complet
find app/build/outputs/apk/debug/ -name "*.apk"
```

**Chemin attendu** : `app/build/outputs/apk/debug/app-debug.apk`

### Étape 5 : Vérifier la taille de l'APK

```bash
# Afficher la taille de l'APK
du -h app/build/outputs/apk/debug/app-debug.apk
```

**Taille attendue** : Entre 5 MB et 15 MB

## 🔧 Gestion des Erreurs Potentielles

### Erreur 1 : "Gradle daemon not found"

```bash
# Solution : Utiliser le wrapper Gradle
./gradlew --version
```

### Erreur 2 : Erreurs de compilation Kotlin

Si tu vois des erreurs comme :
- "Unresolved reference: FileVaultRepository"
- "Type mismatch: inferred type is String but EntryType was expected"

**Solution** :
```bash
# Vérifier que tous les fichiers sont bien présents
ls -la app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt
ls -la app/src/main/java/com/julien/genpwdpro/data/local/entity/VaultEntryEntityExt.kt
ls -la app/src/main/java/com/julien/genpwdpro/presentation/vault/EntryViewModel.kt

# Invalider les caches Gradle
./gradlew clean --refresh-dependencies
./gradlew assembleDebug --stacktrace
```

### Erreur 3 : Problèmes de dépendances

```bash
# Forcer le téléchargement des dépendances
./gradlew assembleDebug --refresh-dependencies
```

### Erreur 4 : Out of Memory

```bash
# Si Gradle manque de mémoire, augmenter la heap
export GRADLE_OPTS="-Xmx4g -XX:MaxMetaspaceSize=512m"
./gradlew assembleDebug --stacktrace
```

### Erreur 5 : Erreurs de lint

```bash
# Désactiver temporairement lint pour compiler plus vite
./gradlew assembleDebug -x lint --stacktrace
```

## 📊 Résultat Attendu

À la fin de la compilation, tu devrais voir :

```
BUILD SUCCESSFUL in Xs Ys
67 actionable tasks: 67 executed

BUILD SUCCESSFUL
```

Et l'APK devrait être disponible à :
```
/home/user/genpwd-pro/android/app/build/outputs/apk/debug/app-debug.apk
```

## 📱 Informations sur l'APK

Une fois compilé, fournis ces informations :

```bash
# Taille de l'APK
ls -lh app/build/outputs/apk/debug/app-debug.apk

# Checksum SHA256 (pour vérifier l'intégrité)
sha256sum app/build/outputs/apk/debug/app-debug.apk

# Informations de version (si disponible)
./gradlew -q printVersionName
```

## 🐛 Debug : Afficher les Erreurs de Compilation

Si la compilation échoue, affiche les erreurs Kotlin :

```bash
# Chercher les erreurs dans les logs
./gradlew assembleDebug 2>&1 | grep -A 5 "error:"

# Afficher les 50 dernières lignes des logs
./gradlew assembleDebug --stacktrace 2>&1 | tail -50
```

## 📝 Checklist Finale

Avant de terminer, confirme :

- [ ] La compilation s'est terminée avec `BUILD SUCCESSFUL`
- [ ] L'APK existe à `app/build/outputs/apk/debug/app-debug.apk`
- [ ] La taille de l'APK est raisonnable (5-15 MB)
- [ ] Aucune erreur Kotlin dans les logs
- [ ] Le checksum SHA256 est affiché

## 🎯 Commande Rapide (Tout-en-un)

Si tu veux tout faire d'un coup :

```bash
cd /home/user/genpwd-pro/android && \
./gradlew clean && \
./gradlew assembleDebug --stacktrace && \
echo "✅ APK généré :" && \
ls -lh app/build/outputs/apk/debug/app-debug.apk && \
sha256sum app/build/outputs/apk/debug/app-debug.apk
```

## 📦 Fichiers Clés Modifiés (Phase 6 + 8)

Ces fichiers ont été modifiés et doivent compiler correctement :

1. **VaultEntryEntityExt.kt** (nouveau fichier, 180 lignes)
   - Extensions pour VaultEntryEntity
   - Helper `createVaultEntry()`

2. **EntryViewModel.kt** (modifié)
   - Utilise `FileVaultRepository` au lieu de `VaultRepository`
   - Méthodes refactorisées : `initForEdit()`, `saveEntry()`, `deleteEntry()`

3. **VaultManagerScreen.kt** (modifié)
   - Dialog scrollable avec `verticalScroll(rememberScrollState())`

## 🚨 Problèmes Connus

### Problème : Gradle ne trouve pas les fichiers

Si tu vois "Cannot access class FileVaultRepository" :

```bash
# Vérifier que le fichier existe
cat app/src/main/java/com/julien/genpwdpro/data/repository/FileVaultRepository.kt | head -20

# Forcer un rebuild complet
./gradlew clean build --refresh-dependencies --rerun-tasks
```

### Problème : Extensions Kotlin non reconnues

Si `entry.title` ou `entry.hasTOTP()` ne sont pas reconnus :

```bash
# Vérifier que VaultEntryEntityExt.kt est bien présent
cat app/src/main/java/com/julien/genpwdpro/data/local/entity/VaultEntryEntityExt.kt | head -30

# Vérifier le package
grep "package" app/src/main/java/com/julien/genpwdpro/data/local/entity/VaultEntryEntityExt.kt
```

## ✅ Succès !

Si tout s'est bien passé, réponds avec :

```
✅ Compilation réussie !

📦 APK généré :
- Chemin : /home/user/genpwd-pro/android/app/build/outputs/apk/debug/app-debug.apk
- Taille : [X] MB
- SHA256 : [checksum]

🎉 L'APK est prêt pour le test !
```

---

**Note** : La compilation peut prendre 5-15 minutes la première fois (téléchargement des dépendances Gradle et Android).
