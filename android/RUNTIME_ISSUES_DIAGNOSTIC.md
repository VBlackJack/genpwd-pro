# 🚨 Runtime Issues - Diagnostic Report

## 📊 Problèmes Rapportés

### ❌ **Issue 1: Impossible d'entrer dans le coffre**
**Description:** L'utilisateur a créé un coffre mais ne peut pas le déverrouiller.

**Symptômes possibles:**
- Le bouton de déverrouillage ne répond pas
- Message d'erreur "Mot de passe incorrect" même avec le bon mot de passe
- L'application crash au déverrouillage
- Écran reste bloqué sur l'interface de déverrouillage

### ❌ **Issue 2: Biométrie invisible**
**Description:** Aucune option d'authentification biométrique visible dans l'application.

**Symptômes possibles:**
- Pas de bouton "Empreinte digitale" ou "Face ID"
- Option biométrique absente dans les paramètres
- L'application ne détecte pas le capteur biométrique

### ❌ **Issue 3: Mots de passe non sauvegardés**
**Description:** Les mots de passe générés ne sont pas enregistrés dans le coffre.

**Symptômes possibles:**
- Le générateur fonctionne mais bouton "Sauvegarder" absent
- Clic sur "Sauvegarder" ne fait rien
- Mot de passe disparaît après génération
- Navigation entre écrans perd le mot de passe généré

---

## 🔍 **Diagnostic - Étapes de Capture des Logs**

### **Prérequis:**
```bash
# Vérifier que l'appareil est connecté
adb devices

# Installer l'APK si pas déjà fait
adb install -r app/build/outputs/apk/debug/genpwd-pro-v1.1.0-debug.apk
```

### **Étape 1: Capturer les logs généraux**
```bash
# Démarrer la capture des logs
adb logcat -c  # Clear existing logs
adb logcat | grep -i "genpwd\|error\|exception\|crash" > runtime_logs.txt
```

### **Étape 2: Reproduire l'Issue 1 (Déverrouillage)**
1. Ouvrir l'application
2. Créer un nouveau coffre (ou utiliser existant)
3. Noter le mot de passe maître utilisé
4. Essayer de déverrouiller le coffre
5. Observer le comportement

**Logs à capturer:**
```bash
adb logcat -s VaultSessionManager:* UnlockVaultScreen:* BiometricVaultManager:* VaultCryptoManager:*
```

### **Étape 3: Reproduire l'Issue 2 (Biométrie)**
1. Aller dans les paramètres de l'application
2. Chercher option "Authentification biométrique"
3. Vérifier si l'option est présente

**Logs à capturer:**
```bash
adb logcat -s BiometricVaultManager:* BiometricPrompt:*
```

### **Étape 4: Reproduire l'Issue 3 (Sauvegarde)**
1. Aller sur l'écran générateur
2. Générer un mot de passe
3. Chercher un bouton "Sauvegarder" ou "Ajouter au coffre"
4. Observer si le mot de passe apparaît dans la liste

**Logs à capturer:**
```bash
adb logcat -s GeneratorViewModel:* EntryViewModel:* FileVaultRepository:* VaultSessionManager:*
```

---

## 🔎 **Analyse des Issues Potentielles**

### **Issue 1: Déverrouillage**

#### **Cause Potentielle A: Vault non chargé en session**
```kotlin
// VaultSessionManager.kt devrait avoir:
fun unlockVault(vaultId: String, masterPassword: String): Result<Unit>
```

**Vérification:**
- Le vault est-il dans `vault_registry` ?
- Le fichier `.gpv` existe-t-il ?
- La clé de déchiffrement est-elle correcte ?

**Code suspect:**
```kotlin
// UnlockVaultScreen.kt - Est-ce que ça appelle bien unlockVault() ?
// VaultSessionManager.kt - Est-ce que currentSession est bien set ?
```

#### **Cause Potentielle B: Navigation cassée**
```kotlin
// Après déverrouillage, est-ce que ça navigue vers VaultListScreen ?
navController.navigate(Screen.VaultList.route)
```

#### **Cause Potentielle C: Mot de passe incorrect**
- Le mot de passe est-il bien hashé avec Argon2id ?
- Le salt est-il correctement stocké et récupéré ?

---

### **Issue 2: Biométrie Invisible**

#### **Cause Potentielle A: Fonctionnalité pas implémentée dans l'UI**
```kotlin
// UnlockVaultScreen.kt devrait avoir:
// - Un bouton "Utiliser empreinte digitale"
// - Un BiometricPrompt
```

**Vérification:**
- `UnlockVaultScreen.kt` contient-il un bouton biométrique ?
- `BiometricVaultManager` est-il appelé dans le ViewModel ?

#### **Cause Potentielle B: Appareil ne supporte pas la biométrie**
```kotlin
// BiometricVaultManager.kt
fun isBiometricAvailable(): Boolean {
    // Vérifie si l'appareil a un capteur biométrique
}
```

#### **Cause Potentielle C: Permission manquante**
**AndroidManifest.xml** doit contenir:
```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

---

### **Issue 3: Mots de passe non sauvegardés**

#### **Cause Potentielle A: Pas de bouton "Sauvegarder" dans l'UI**
```kotlin
// GeneratorScreen.kt devrait avoir:
// - Un FloatingActionButton "Sauvegarder"
// - Ou un item de menu "Ajouter au coffre"
```

**Vérification:**
- Est-ce que `GeneratorScreen.kt` a un bouton de sauvegarde ?
- Est-ce qu'il appelle `EntryViewModel.createEntry()` ?

#### **Cause Potentielle B: Navigation incorrecte**
```kotlin
// Workflow attendu:
// 1. Générer mot de passe
// 2. Cliquer "Sauvegarder"
// 3. Ouvrir dialog pour titre/username
// 4. Sauvegarder dans FileVaultRepository
```

#### **Cause Potentielle C: Vault non déverrouillé**
```kotlin
// FileVaultRepository.kt
suspend fun addEntry(entry: VaultEntryEntity): Result<Unit> {
    // Si vault pas déverrouillé, ça échouera
    if (!vaultSessionManager.isVaultUnlocked()) {
        return Result.failure(...)
    }
}
```

---

## 🛠️ **Actions de Debug Recommandées**

### **Action 1: Vérifier les fichiers UI**

```bash
# Vérifier si UnlockVaultScreen a un bouton biométrique
grep -n "biometric\|fingerprint" app/src/main/java/com/julien/genpwdpro/presentation/vault/UnlockVaultScreen.kt

# Vérifier si GeneratorScreen a un bouton sauvegarder
grep -n "save\|sauvegarder\|addEntry" app/src/main/java/com/julien/genpwdpro/presentation/generator/GeneratorScreen.kt

# Vérifier la navigation après déverrouillage
grep -n "unlockVault\|navigate" app/src/main/java/com/julien/genpwdpro/presentation/vault/UnlockVaultScreen.kt
```

### **Action 2: Vérifier AndroidManifest.xml**

```bash
# Vérifier les permissions
cat app/src/main/AndroidManifest.xml | grep -i "biometric\|fingerprint"
```

### **Action 3: Lire les logs en temps réel**

```bash
# Terminal 1: Capture tous les logs de l'app
adb logcat | grep "com.julien.genpwdpro"

# Terminal 2: Filtrer seulement les erreurs
adb logcat *:E | grep "genpwd"
```

---

## 📋 **Checklist de Diagnostic**

### **Pour Issue 1 (Déverrouillage):**
- [ ] Le vault est créé et visible dans la liste
- [ ] Le fichier `.gpv` existe sur l'appareil
- [ ] Le mot de passe maître est correct
- [ ] `VaultSessionManager.unlockVault()` est appelé
- [ ] `currentSession` est set après déverrouillage
- [ ] Navigation vers `VaultListScreen` fonctionne
- [ ] Logs montrent un déverrouillage réussi

### **Pour Issue 2 (Biométrie):**
- [ ] Permission `USE_BIOMETRIC` dans AndroidManifest
- [ ] Appareil supporte la biométrie (vérifié dans paramètres Android)
- [ ] `BiometricVaultManager` est injecté dans ViewModel
- [ ] Bouton "Empreinte digitale" présent dans UnlockVaultScreen
- [ ] `BiometricPrompt` est lancé au clic
- [ ] Logs montrent tentative d'authentification biométrique

### **Pour Issue 3 (Sauvegarde):**
- [ ] Bouton "Sauvegarder" présent dans GeneratorScreen
- [ ] Clic sur bouton ouvre dialog ou navigue vers création d'entry
- [ ] `FileVaultRepository.addEntry()` est appelé
- [ ] Vault est déverrouillé avant sauvegarde
- [ ] Entry apparaît dans `VaultListScreen` après sauvegarde
- [ ] Logs montrent sauvegarde réussie

---

## 🔧 **Commandes de Debug Avancées**

### **Inspecter la base de données**
```bash
# Se connecter au shell de l'appareil
adb shell

# Naviguer vers le dossier de l'app
cd /data/data/com.julien.genpwdpro/databases/

# Lister les bases de données
ls -l

# Ouvrir SQLite (si disponible)
sqlite3 genpwd_database.db
.tables
SELECT * FROM vault_registry;
.quit
```

### **Inspecter les fichiers .gpv**
```bash
# Lister les fichiers de l'app
adb shell ls -l /data/data/com.julien.genpwdpro/files/

# Lister les fichiers externes
adb shell ls -l /storage/emulated/0/Android/data/com.julien.genpwdpro/files/
```

### **Capturer un bug report complet**
```bash
adb bugreport bugreport.zip
```

---

## 📝 **Informations à Fournir à Claude Web**

Pour que Claude Web puisse corriger ces issues, fournissez:

1. **Logs de l'application:**
   - Logs du déverrouillage
   - Logs de la génération de mot de passe
   - Stack traces d'erreurs

2. **Captures d'écran:**
   - Écran de déverrouillage
   - Écran du générateur
   - Écran des paramètres

3. **Étapes de reproduction:**
   - Étape par étape pour chaque issue

4. **Informations appareil:**
   - Modèle d'appareil
   - Version Android
   - Supporte biométrie? (vérifié dans Paramètres Android)

---

## 🎯 **Template de Rapport pour Claude Web**

```markdown
# Runtime Issues - GenPwd Pro

## Environment
- Branch: claude/entry-crud-refactor-011CUYLbVDNVdxF238ZuefAf
- Commit: 58de70a
- APK: genpwd-pro-v1.1.0-debug.apk
- Device: [MODÈLE]
- Android: [VERSION]

## Issue 1: Cannot unlock vault
**Steps:**
1. Create vault with password "test123"
2. Try to unlock with same password
3. [DÉCRIRE CE QUI SE PASSE]

**Logs:**
```
[COLLER LES LOGS ICI]
```

## Issue 2: Biometric authentication not visible
**Observation:**
- No biometric button in unlock screen
- No biometric option in settings

**Device biometric capability:** [YES/NO]

## Issue 3: Generated passwords not saved
**Steps:**
1. Open Generator
2. Generate password
3. Look for "Save" button
4. [DÉCRIRE CE QUI SE PASSE]

**Logs:**
```
[COLLER LES LOGS ICI]
```

## Screenshots
[ATTACHER ICI]
```

---

## 🚀 **Prochaines Étapes**

1. **Utilisateur:** Capturer les logs avec les commandes ci-dessus
2. **Utilisateur:** Remplir le template de rapport
3. **Utilisateur:** Transmettre à Claude Web
4. **Claude Web:** Analyser et corriger les issues
5. **Claude CLI:** Recompiler et retester

---

**Généré par:** Claude CLI
**Date:** 2025-10-27
**Status:** Diagnostic en attente des logs utilisateur
