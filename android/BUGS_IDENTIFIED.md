# 🐛 Bugs Identifiés - GenPwd Pro

## 📊 Rapport d'Analyse

**Branch:** `claude/entry-crud-refactor-011CUYLbVDNVdxF238ZuefAf`
**Commit:** `58de70a`
**APK:** `genpwd-pro-v1.1.0-debug.apk`
**Date:** 2025-10-27

---

## 🚨 **Bug #1: Impossible de Déverrouiller le Coffre**

### **Status:** ⚠️ À INVESTIGUER (problème probable dans ViewModel)

### **Description:**
L'utilisateur ne peut pas déverrouiller le coffre créé.

### **Analyse du Code:**

✅ **Navigation après déverrouillage - OK**
```kotlin
// NavGraph.kt:281-291
UnlockVaultScreen(
    vaultId = vaultId,
    onVaultUnlocked = {
        navController.navigate(Screen.VaultList.createRoute(vaultId)) {
            popUpTo(Screen.UnlockVault.route) {
                inclusive = true
            }
        }
    },
    onBackClick = { navController.popBackStack() }
)
```

✅ **Callback dans UnlockVaultScreen - OK**
```kotlin
// UnlockVaultScreen.kt:50-54
LaunchedEffect(uiState) {
    if (uiState is UnlockVaultUiState.Success) {
        onVaultUnlocked()  // ← Appelé quand déverrouillage réussit
    }
    if (uiState is UnlockVaultUiState.Error) {
        attempts++
    }
}
```

❌ **Problème Potentiel: ViewModel ou VaultSessionManager**

### **Hypothèses:**

**Hypothèse A:** `UnlockVaultViewModel.unlockVault()` échoue silencieusement
- Le mot de passe est-il correctement hashé avec Argon2id?
- La clé de déchiffrement est-elle correcte?
- Le fichier `.gpv` existe-t-il?

**Hypothèse B:** `VaultSessionManager` ne crée pas de session
- `currentSession` reste `null` après déverrouillage
- Le fichier .gpv est-il correctement chargé?

**Hypothèse C:** Le mot de passe maître n'est pas stocké/hashé correctement lors de la création

### **Fichiers à Vérifier:**
1. `UnlockVaultViewModel.kt` - fonction `unlockVault()`
2. `VaultSessionManager.kt` - fonction `unlockVault()`
3. `VaultCryptoManager.kt` - vérification du hash
4. `VaultFileManager.kt` - chargement du fichier .gpv

### **Logs à Capturer:**
```bash
adb logcat -s UnlockVaultViewModel:* VaultSessionManager:* VaultCryptoManager:* VaultFileManager:*
```

### **Fix Temporaire (pour tester):**
Ajouter des logs dans `UnlockVaultViewModel.kt`:
```kotlin
fun unlockVault(masterPassword: String) {
    viewModelScope.launch {
        Log.d("UnlockVaultViewModel", "Attempting unlock for vault: $vaultId")
        Log.d("UnlockVaultViewModel", "Password length: ${masterPassword.length}")

        val result = vaultSessionManager.unlockVault(vaultId, masterPassword)

        Log.d("UnlockVaultViewModel", "Unlock result: ${result.isSuccess}")
        if (result.isFailure) {
            Log.e("UnlockVaultViewModel", "Unlock failed: ${result.exceptionOrNull()?.message}")
        }

        // ... rest of code
    }
}
```

---

## 🐛 **Bug #2: Biométrie Invisible**

### **Status:** ✅ ROOT CAUSE IDENTIFIÉE

### **Description:**
Aucune option d'authentification biométrique visible dans l'application.

### **Root Cause:**

Le bouton biométrique n'apparaît **QUE SI** `biometricUnlockEnabled = true` sur le vault:

```kotlin
// UnlockVaultScreen.kt:233
if (currentVault.biometricUnlockEnabled) {  // ← Par défaut: false!
    OutlinedButton(
        onClick = { /* Lancer BiometricPrompt */ }
    ) {
        Icon(Icons.Default.Fingerprint, "Biometric")
        Text("Utiliser l'empreinte digitale")
    }
}
```

**Problème:** Lors de la création d'un vault, `biometricUnlockEnabled` est probablement défini à `false` par défaut.

### **Vérification dans VaultRegistryEntry:**

```kotlin
// VaultRegistryEntry.kt
data class VaultRegistryEntry(
    // ...
    val biometricUnlockEnabled: Boolean = false,  // ← Défaut: false
    val encryptedMasterPassword: ByteArray? = null,
    val masterPasswordIv: ByteArray? = null
)
```

### **Solutions:**

#### **Option A: Ajouter une option lors de la création de vault**

Dans `VaultManagerScreen.kt` ou `CreateVaultDialog`:
```kotlin
var enableBiometric by remember { mutableStateOf(false) }

// ... dans le dialog
Row(
    modifier = Modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically
) {
    Checkbox(
        checked = enableBiometric,
        onCheckedChange = { enableBiometric = it }
    )
    Text("Activer l'authentification biométrique")
}

// ... lors de la création
VaultRegistryEntry(
    // ...
    biometricUnlockEnabled = enableBiometric
)
```

#### **Option B: Ajouter un paramètre dans l'écran de déverrouillage**

Ajouter un bouton "Activer la biométrie" même quand `biometricUnlockEnabled = false`:

```kotlin
// UnlockVaultScreen.kt
// Après le bouton de déverrouillage principal

if (!currentVault.biometricUnlockEnabled) {
    Spacer(modifier = Modifier.height(16.dp))

    TextButton(
        onClick = {
            // Ouvrir dialog pour activer biométrie
            showEnableBiometricDialog = true
        }
    ) {
        Icon(Icons.Default.Fingerprint, null)
        Spacer(Modifier.width(8.dp))
        Text("Activer l'authentification biométrique")
    }
}
```

#### **Option C: Activer par défaut si disponible**

Détecter si l'appareil supporte la biométrie et activer automatiquement:

```kotlin
// VaultManagerViewModel.kt - createVault()
val biometricAvailable = biometricVaultManager.isBiometricAvailable()

val registryEntry = VaultRegistryEntry(
    // ...
    biometricUnlockEnabled = biometricAvailable  // ← Auto si disponible
)
```

### **Recommandation:**
**Option A + Option B** - Proposer à la création ET permettre d'activer après.

---

## 🐛 **Bug #3: Mots de Passe Non Sauvegardés**

### **Status:** ✅ ROOT CAUSE IDENTIFIÉE + FIX DISPONIBLE

### **Description:**
Les mots de passe générés ne sont pas enregistrés dans le coffre.

### **Root Cause:**

Le callback `onSaveToVault` n'est **JAMAIS fourni** à `GeneratorScreen` dans `NavGraph.kt`:

```kotlin
// NavGraph.kt:140-176
GeneratorScreen(
    vaultId = currentVaultId,
    onNavigateToHistory = { navController.navigate(Screen.History.route) },
    onNavigateToAnalyzer = { navController.navigate(Screen.Analyzer.route) },
    onNavigateToCustomPhrase = { navController.navigate(Screen.CustomPhrase.route) },
    onNavigateToSyncSettings = { navController.navigate(Screen.SyncSettings.route) },
    onNavigateToSecurity = { navController.navigate(Screen.Security.route) },
    // ❌ MANQUANT: onSaveToVault = { password -> ... }
    onNavigateToPresetManager = { navController.navigate(Screen.PresetManager.route) }
)
```

### **Conséquence:**

Quand l'utilisateur clique sur "Sauvegarder" dans `GeneratorScreen`:

```kotlin
// GeneratorScreen.kt:405-416
onSave = if (onSaveToVault != null) {
    { onSaveToVault(result.password) }  // ← Ne s'exécute jamais
} else {
    {
        scope.launch {
            snackbarHostState.showSnackbar(
                message = "Déverrouillez d'abord un coffre-fort pour sauvegarder",  // ← Toujours affiché
                duration = SnackbarDuration.Short
            )
        }
    }
}
```

### **Fix Requis:**

#### **Dans NavGraph.kt (ligne ~155):**

```kotlin
// AVANT ❌
GeneratorScreen(
    vaultId = currentVaultId,
    onNavigateToHistory = { ... },
    // ...
    onNavigateToPresetManager = { ... }
)

// APRÈS ✅
GeneratorScreen(
    vaultId = currentVaultId,
    onNavigateToHistory = { ... },
    // ... autres callbacks
    onSaveToVault = { password ->
        // Option A: Ouvrir dialog pour saisir titre/username
        navController.navigate(Screen.CreateEntry.createRoute(
            vaultId = currentVaultId,
            password = password  // Pré-remplir le mot de passe
        ))

        // Option B (plus simple): Créer entry directement avec titre auto
        // viewModel.createQuickEntry(password)
    },
    onNavigateToPresetManager = { ... }
)
```

#### **Option A - Recommandée: Créer Screen.CreateEntry:**

```kotlin
// Nouvelle route dans Screen.kt
object CreateEntry : Screen(
    route = "create_entry/{vaultId}?password={password}",
    title = "Nouvelle Entrée"
) {
    fun createRoute(vaultId: String, password: String? = null): String {
        return if (password != null) {
            "create_entry/$vaultId?password=${Uri.encode(password)}"
        } else {
            "create_entry/$vaultId"
        }
    }
}
```

```kotlin
// Dans NavGraph.kt, ajouter route:
composable(
    route = Screen.CreateEntry.route,
    arguments = listOf(
        navArgument("vaultId") { type = NavType.StringType },
        navArgument("password") {
            type = NavType.StringType
            nullable = true
            defaultValue = null
        }
    )
) { backStackEntry ->
    val vaultId = backStackEntry.arguments?.getString("vaultId")!!
    val prefilledPassword = backStackEntry.arguments?.getString("password")

    EntryScreen(
        vaultId = vaultId,
        entryId = null,  // Nouveau entry
        initialPassword = prefilledPassword,
        onNavigateBack = { navController.popBackStack() }
    )
}
```

#### **Option B - Plus Simple: Créer entry rapide:**

Ajouter méthode dans `GeneratorViewModel` ou créer `QuickSaveViewModel`:

```kotlin
// GeneratorViewModel.kt ou nouveau QuickSaveViewModel.kt
suspend fun saveQuickEntry(password: String, vaultId: String) {
    val entry = createVaultEntry(
        vaultId = vaultId,
        title = "Mot de passe généré - ${SimpleDateFormat("dd/MM HH:mm").format(Date())}",
        password = password,
        username = "",
        url = "",
        entryType = EntryType.LOGIN
    )

    fileVaultRepository.addEntry(entry)
}
```

Puis dans NavGraph.kt:
```kotlin
onSaveToVault = { password ->
    // Sauvegarder directement
    scope.launch {
        generatorViewModel.saveQuickEntry(password, currentVaultId)
        snackbarHostState.showSnackbar("Mot de passe sauvegardé !")
    }
}
```

### **Recommandation:**
**Option B** pour une première version (plus rapide à implémenter).
**Option A** pour version finale (meilleure UX).

---

## 📋 **Résumé des Bugs et Fixes**

| Bug | Severity | Root Cause | Status | Fix Complexity |
|-----|----------|------------|--------|----------------|
| **#1: Déverrouillage** | 🔴 CRITICAL | ViewModel ou SessionManager | 🔍 À investiguer | ⚠️ MOYEN |
| **#2: Biométrie** | 🟡 MEDIUM | `biometricUnlockEnabled = false` par défaut | ✅ Identifié | ✅ FACILE |
| **#3: Sauvegarde** | 🔴 CRITICAL | Callback `onSaveToVault` manquant | ✅ Identifié | ✅ FACILE |

---

## 🔧 **Actions Recommandées**

### **Priority 1 (CRITICAL):**

1. **Bug #3 - Fix Sauvegarde:**
   - Ajouter `onSaveToVault` callback dans NavGraph.kt
   - Implémenter Option B (quick save) pour test rapide
   - **Temps estimé:** 30 minutes

2. **Bug #1 - Investigation Déverrouillage:**
   - Ajouter logs dans UnlockVaultViewModel
   - Capturer logs pendant tentative de déverrouillage
   - Identifier où ça échoue
   - **Temps estimé:** 1-2 heures

### **Priority 2 (MEDIUM):**

3. **Bug #2 - Fix Biométrie:**
   - Implémenter Option B (bouton "Activer biométrie")
   - Ou Option A (checkbox à la création)
   - **Temps estimé:** 1 heure

---

## 🎯 **Workflow de Correction**

### **Pour Claude Web:**

1. **Lire ce rapport**
2. **Implémenter Bug #3 (sauvegarde)** - Option B recommandée
3. **Ajouter logs pour Bug #1** (déverrouillage)
4. **Commit et push**
5. **Attendre logs de l'utilisateur** pour Bug #1
6. **Implémenter Bug #2** (biométrie) après avoir fixé #1

### **Pour Claude CLI:**

1. **Pull les corrections** de Claude Web
2. **Compiler APK**
3. **Installer sur appareil de test**
4. **Capturer logs** pour Bug #1
5. **Transmettre logs** à Claude Web

### **Pour l'Utilisateur:**

1. **Installer nouvel APK** (après fix Bug #3)
2. **Tester sauvegarde** de mots de passe
3. **Tenter déverrouillage** et fournir retour
4. **Capturer logs** avec commandes dans RUNTIME_ISSUES_DIAGNOSTIC.md
5. **Transmettre logs** à Claude Web

---

## 📝 **Commandes de Debug**

### **Capturer logs complets:**
```bash
adb logcat -c
adb logcat *:V | grep -E "genpwd|UnlockVault|Generator|VaultSession" > full_debug.log

# Dans un autre terminal, reproduire les bugs
# Puis arrêter logcat avec Ctrl+C
```

### **Capturer logs spécifiques au déverrouillage:**
```bash
adb logcat -s UnlockVaultViewModel:* VaultSessionManager:* VaultCryptoManager:* VaultFileManager:*
```

### **Vérifier le fichier .gpv:**
```bash
adb shell ls -la /data/data/com.julien.genpwdpro/files/*.gpv
adb shell ls -la /storage/emulated/0/Android/data/com.julien.genpwdpro/files/*.gpv
```

---

**Généré par:** Claude CLI (Analyse de Code)
**Date:** 2025-10-27
**Status:** Bugs #2 et #3 identifiés, Bug #1 nécessite logs
