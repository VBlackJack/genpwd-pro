# 🔍 RAPPORT D'ANALYSE DE CODE - GenPwd Pro

## 📋 RÉSUMÉ EXÉCUTIF

- **Langage détecté** : Kotlin 1.9.22 + JavaScript ES6+ (Dual-platform)
- **Type d'application** : Application mobile Android (Gestionnaire de mots de passe sécurisé) + Application Web
- **Framework** : Jetpack Compose, Room, Hilt/Dagger, Coroutines
- **Score global** : **8.2**/10
- **Priorité d'action** : **MOYENNE** (Optimisations de sécurité recommandées)

---

## 🎯 POINTS FORTS DE L'APPLICATION

### ✅ Architecture Solide
- **Clean Architecture** bien implémentée (Domain/Data/Presentation)
- **Dependency Injection** avec Hilt correctement configuré
- **File-based vault system** avec chiffrement robuste (.gpv files)
- **Session management** avec auto-lock timer

### ✅ Cryptographie de Niveau Professionnel
- **Argon2id** pour la dérivation de clés (via Lazysodium-Android)
- **AES-256-GCM** pour le chiffrement (AEAD - authentification intégrée)
- **TOTP RFC 6238** implémenté correctement
- **SecureRandom** utilisé partout pour la génération aléatoire

### ✅ Sécurité des Données
- **EncryptedSharedPreferences** pour les credentials cloud
- **Android Keystore** intégré via MasterKey
- **Biometric authentication** supportée
- **Zero-knowledge architecture** (données chiffrées avant sync)

---

## 🚨 PROBLÈMES CRITIQUES

### ❌ **CRITIQUE 1 : Stockage du Master Password pour Biométrie**

**Fichiers concernés** :
- `android/app/src/main/java/com/julien/genpwdpro/data/local/entity/VaultRegistryEntry.kt`
- `android/app/src/main/java/com/julien/genpwdpro/data/local/database/AppDatabase.kt:304-319`

**Impact** : 🔴 **SÉCURITÉ CRITIQUE**

**Problème** :
Le master password est stocké chiffré dans Room pour permettre le déverrouillage biométrique. Bien que chiffré avec Android Keystore, cela crée un vecteur d'attaque potentiel :
1. Si un attaquant obtient root ou backup l'application
2. Il peut extraire `encryptedMasterPassword` + `masterPasswordIv`
3. Si le device est déverrouillé, il peut tenter d'accéder à la Keystore

**Recommandation** :
```kotlin
// CURRENT (Potential risk):
data class VaultRegistryEntry(
    val encryptedMasterPassword: ByteArray?,  // Stored in Room DB
    val masterPasswordIv: ByteArray?
)

// RECOMMENDED: Use Android Keystore directly without storing in Room
// Instead, store only a reference to the Keystore alias
data class VaultRegistryEntry(
    val biometricKeystoreAlias: String?,  // Just the alias, not the password
    val requiresStrongAuthentication: Boolean = true  // Force STRONG biometric
)

// Implementation in BiometricVaultManager:
fun setupBiometricUnlock(vaultId: String, masterPassword: String) {
    val alias = "vault_biometric_$vaultId"

    // Create or retrieve key from Keystore (NOT stored in Room)
    val keyGenerator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES,
        "AndroidKeyStore"
    )

    val keyGenSpec = KeyGenParameterSpec.Builder(
        alias,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setUserAuthenticationRequired(true)  // Require biometric
        .setInvalidatedByBiometricEnrollment(true)  // Invalidate if fingerprints change
        .setUserAuthenticationValidityDurationSeconds(-1)  // Require auth every time
        .build()

    keyGenerator.init(keyGenSpec)
    val secretKey = keyGenerator.generateKey()

    // Encrypt password with Keystore key (ephemeral, not stored)
    // Store only the alias in Room
    vaultRegistry.biometricKeystoreAlias = alias
}
```

**Justification** :
- Keystore seul est plus sûr que Keystore + Room
- Authentification biométrique requise à chaque accès
- Clé invalidée si les empreintes changent

---

### ❌ **CRITIQUE 2 : Salt Déterministe dans VaultFileManager**

**Fichier** : `android/app/src/main/java/com/julien/genpwdpro/data/crypto/VaultCryptoManager.kt:350-354`

**Impact** : 🔴 **VULNÉRABILITÉ CRYPTOGRAPHIQUE**

**Problème** :
```kotlin
// Line 98-99 (VaultFileManager.kt):
val salt = cryptoManager.generateSaltFromString(vaultId)
val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

// Line 350-354 (VaultCryptoManager.kt):
fun generateSaltFromString(seed: String): ByteArray {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    return digest.digest(seed.toByteArray(Charsets.UTF_8))
}
```

**Le problème** :
- Le salt est **déterministe** (toujours le même pour un vaultId donné)
- Cela permet des **attaques par rainbow tables** si le vaultId est connu
- Argon2id perd une partie de sa protection contre les attaques parallélisées

**Solution** :
```kotlin
// INSTEAD: Generate a RANDOM salt and store it in the .gpv file header
data class VaultFileHeader(
    val version: Int = 1,
    val vaultId: String,
    val salt: String,  // ADD: Store the random salt here (hex encoded)
    val createdAt: Long,
    val modifiedAt: Long,
    val checksum: String
)

// In createVaultFile():
suspend fun createVaultFile(...): Pair<String, File> {
    val vaultId = UUID.randomUUID().toString()

    // Generate a RANDOM salt (not deterministic)
    val salt = cryptoManager.generateSalt()  // Uses SecureRandom

    // Derive key with random salt
    val vaultKey = cryptoManager.deriveKey(masterPassword, salt)

    // Store salt in header
    val header = VaultFileHeader(
        vaultId = vaultId,
        salt = cryptoManager.bytesToHex(salt),  // Save it!
        createdAt = timestamp,
        modifiedAt = timestamp,
        checksum = calculateChecksum(dataJson)
    )

    // When loading, read salt from header:
    val storedSalt = cryptoManager.hexToBytes(header.salt)
    val vaultKey = cryptoManager.deriveKey(masterPassword, storedSalt)
}
```

**Justification** :
- ✅ Respecte les standards cryptographiques (salt **doit** être aléatoire)
- ✅ Protection contre les rainbow tables
- ✅ Chaque vault a un salt unique même avec le même password
- ⚠️ **BREAKING CHANGE** : Nécessite migration des vaults existants

---

### ❌ **CRITIQUE 3 : Hardcoded Argon2 Parameters**

**Fichier** : `VaultCryptoManager.kt:34-36`

**Impact** : 🟠 **PERFORMANCE & SÉCURITÉ**

**Problème** :
```kotlin
private const val ARGON2_ITERATIONS = 3
private const val ARGON2_MEMORY = 65536 // 64 MB (en KB)
private const val ARGON2_PARALLELISM = 4
```

**Recommandation** :
```kotlin
// Adjust based on device capabilities
class Argon2ParamsCalculator {
    fun calculateOptimalParams(context: Context): Argon2Params {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val availableMemoryMB = memInfo.availMem / (1024 * 1024)
        val cpuCores = Runtime.getRuntime().availableProcessors()

        // Scale memory based on device (min 64MB, max 256MB)
        val memory = when {
            availableMemoryMB > 4096 -> 262144  // 256 MB for high-end devices
            availableMemoryMB > 2048 -> 131072  // 128 MB for mid-range
            else -> 65536  // 64 MB for low-end
        }

        // Scale iterations (min 2, max 5)
        val iterations = when {
            availableMemoryMB > 4096 -> 5
            availableMemoryMB > 2048 -> 4
            else -> 3
        }

        return Argon2Params(
            iterations = iterations,
            memory = memory,
            parallelism = minOf(cpuCores, 4)
        )
    }
}

// Target: 500ms-1s unlock time (acceptable UX)
```

---

## ⚠️ PROBLÈMES MAJEURS

### ⚠️ **MAJEUR 1 : Absence de Rate Limiting sur les Tentatives d'Unlock**

**Fichier** : `VaultSessionManager.kt:126-252`

**Impact** : 🟠 **SÉCURITÉ - BRUTE FORCE**

**Problème** :
Aucune protection contre les tentatives de déverrouillage répétées. Un attaquant peut essayer des milliers de mots de passe sans limitation.

**Solution** :
```kotlin
class UnlockRateLimiter @Inject constructor() {
    private val failedAttempts = mutableMapOf<String, Int>()
    private val lockoutUntil = mutableMapOf<String, Long>()

    companion object {
        private const val MAX_ATTEMPTS = 5
        private const val LOCKOUT_DURATION_MS = 5 * 60 * 1000L  // 5 minutes
    }

    fun checkAndRecordAttempt(vaultId: String): RateLimitResult {
        val now = System.currentTimeMillis()

        // Check if currently locked out
        lockoutUntil[vaultId]?.let { until ->
            if (now < until) {
                val remainingSeconds = (until - now) / 1000
                return RateLimitResult.LockedOut(remainingSeconds)
            } else {
                // Lockout expired
                failedAttempts.remove(vaultId)
                lockoutUntil.remove(vaultId)
            }
        }

        val attempts = failedAttempts.getOrDefault(vaultId, 0)
        if (attempts >= MAX_ATTEMPTS) {
            // Lock out
            lockoutUntil[vaultId] = now + LOCKOUT_DURATION_MS
            return RateLimitResult.LockedOut(LOCKOUT_DURATION_MS / 1000)
        }

        failedAttempts[vaultId] = attempts + 1
        return RateLimitResult.Allowed(MAX_ATTEMPTS - attempts - 1)
    }

    fun recordSuccess(vaultId: String) {
        failedAttempts.remove(vaultId)
        lockoutUntil.remove(vaultId)
    }
}

sealed class RateLimitResult {
    data class Allowed(val attemptsRemaining: Int) : RateLimitResult()
    data class LockedOut(val secondsRemaining: Long) : RateLimitResult()
}

// Usage in unlockVault():
suspend fun unlockVault(vaultId: String, masterPassword: String): Result<Unit> {
    val rateLimitResult = unlockRateLimiter.checkAndRecordAttempt(vaultId)

    when (rateLimitResult) {
        is RateLimitResult.LockedOut -> {
            return Result.failure(
                VaultException.TooManyAttempts(rateLimitResult.secondsRemaining)
            )
        }
        is RateLimitResult.Allowed -> {
            // Continue with unlock
            val result = performUnlock(vaultId, masterPassword)
            if (result.isSuccess) {
                unlockRateLimiter.recordSuccess(vaultId)
            }
            return result
        }
    }
}
```

---

### ⚠️ **MAJEUR 2 : Logs Sensibles en Production**

**Fichier** : Multiples (VaultSessionManager, GoogleDriveProvider, etc.)

**Impact** : 🟠 **FUITE D'INFORMATION**

**Problème** :
```kotlin
// Examples throughout codebase:
Log.d(TAG, "Unlocking vault: $vaultId")  // Reveals vault IDs
Log.d(TAG, "Vault file written successfully: ${file.absolutePath}")  // Reveals file paths
Log.d(TAG, "Saving access token for $providerType")  // Reveals authentication activity
```

**Solution** :
```kotlin
// Wrapper class that respects BuildConfig
object SecureLogger {
    private fun isLoggingEnabled() = BuildConfig.DEBUG

    fun d(tag: String, message: String) {
        if (isLoggingEnabled()) {
            Log.d(tag, message)
        }
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        if (isLoggingEnabled()) {
            if (throwable != null) {
                Log.e(tag, message, throwable)
            } else {
                Log.e(tag, message)
            }
        } else {
            // In production, only log exception class (no details)
            throwable?.let { FirebaseCrashlytics.getInstance().recordException(it) }
        }
    }

    // NEVER log sensitive data (even in debug)
    fun sensitive(tag: String, message: String) {
        // Log nothing
    }
}

// Usage:
SecureLogger.d(TAG, "Unlocking vault: $vaultId")  // Only in debug
SecureLogger.sensitive(TAG, "Master password: $password")  // Never logged
```

**Note** : Le ProGuard actuel (ligne 129-135) supprime déjà les logs, mais c'est mieux de le gérer côté code.

---

### ⚠️ **MAJEUR 3 : WebDAV Password en Clair dans Config**

**Fichier** : `ProviderCredentialManager.kt:255-260`

**Impact** : 🟠 **SÉCURITÉ - CREDENTIALS**

**Problème** :
```kotlin
data class WebDAVConfig(
    val serverUrl: String,
    val username: String,
    val password: String,  // ❌ Stored as String (even though encrypted)
    val validateSSL: Boolean = true
)
```

Bien que stocké dans `EncryptedSharedPreferences`, utiliser des `String` pour les passwords crée des risques :
- Les Strings sont immuables → restent en mémoire jusqu'au GC
- Potentiellement exposés dans les heap dumps
- Difficiles à nettoyer (wipe) après usage

**Solution** :
```kotlin
data class WebDAVConfig(
    val serverUrl: String,
    val username: String,
    val passwordEncrypted: ByteArray,  // Store as ByteArray, not String
    val passwordIv: ByteArray,
    val validateSSL: Boolean = true
) {
    // Helper to get password temporarily
    fun getPassword(encryptionManager: EncryptionManager, key: SecretKey): CharArray {
        val decrypted = encryptionManager.decrypt(
            EncryptedData(passwordEncrypted, passwordIv),
            key
        )
        return String(decrypted, Charsets.UTF_8).toCharArray()
    }

    // Wipe password from memory after use
    fun wipePassword(password: CharArray) {
        password.fill(0.toChar())
    }
}
```

---

## 🔧 AMÉLIORATIONS RECOMMANDÉES

### 🔧 **AMÉLIORATION 1 : Validation de l'Intégrité des Fichiers .gpv**

**Fichier** : `VaultFileManager.kt:196-201`

**Problème actuel** :
```kotlin
// Line 198-201
val contentChecksum = calculateChecksum(decryptedString)
if (contentChecksum != header.checksum) {
    Log.w(TAG, "Checksum mismatch - file may be corrupted")
    // ⚠️ File is loaded anyway! No exception thrown
}
```

**Recommandation** :
```kotlin
// Throw exception on checksum mismatch
if (contentChecksum != header.checksum) {
    throw VaultException.CorruptedFile(
        "Checksum mismatch: expected ${header.checksum}, got $contentChecksum"
    )
}

// Alternative: Add integrity verification with HMAC
fun verifyFileIntegrity(file: File, vaultKey: SecretKey): Boolean {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(vaultKey)
    val fileBytes = file.readBytes()
    val computedHmac = mac.doFinal(fileBytes)

    // Compare with stored HMAC in header
    return computedHmac.contentEquals(header.hmac)
}
```

---

### 🔧 **AMÉLIORATION 2 : Secure Random Validator**

**Problème** : Aucune validation que `SecureRandom` fonctionne correctement (peut échouer sur certains devices Android anciens).

**Solution** :
```kotlin
object SecureRandomValidator {
    fun validateSecureRandom(): Boolean {
        val random = SecureRandom()

        // Test 1: Generate random bytes
        val testBytes = ByteArray(32)
        random.nextBytes(testBytes)

        // Test 2: Check not all zeros
        if (testBytes.all { it == 0.toByte() }) {
            return false
        }

        // Test 3: Generate two sequences, ensure different
        val bytes1 = ByteArray(16)
        val bytes2 = ByteArray(16)
        random.nextBytes(bytes1)
        random.nextBytes(bytes2)

        return !bytes1.contentEquals(bytes2)
    }

    init {
        // Validate on app startup
        if (!validateSecureRandom()) {
            throw SecurityException("SecureRandom validation failed!")
        }
    }
}
```

---

### 🔧 **AMÉLIORATION 3 : Memory Wiping après Déchiffrement**

**Fichier** : `VaultSessionManager.kt:275-305`

**Recommandation** :
```kotlin
suspend fun lockVault() {
    withContext(Dispatchers.IO) {
        val session = currentSession ?: return@withContext

        try {
            // Save before locking
            saveCurrentVault().onFailure {
                Log.e(TAG, "Failed to save vault before locking", it)
            }

            // WIPE sensitive data from memory
            session.vaultData.value.entries.forEach { entry ->
                // Wipe decrypted passwords
                entry.password?.let { password ->
                    val chars = password.toCharArray()
                    chars.fill(0.toChar())
                }
            }

            // Wipe vault key
            cryptoManager.wipeKey(session.vaultKey)

            // Force GC (suggestion)
            System.gc()

            session.cleanup()
            currentSession = null
            _activeVaultId.value = null

        } catch (e: Exception) {
            // ...
        }
    }
}
```

---

### 🔧 **AMÉLIORATION 4 : Gestion des Erreurs de Synchronisation**

**Fichier** : `GoogleDriveProvider.kt`

**Problème** :
Les erreurs réseau ne sont pas différenciées (IOException générique). Cela empêche une gestion intelligente des retries.

**Solution** :
```kotlin
sealed class SyncError : Exception() {
    class NetworkError(cause: Throwable) : SyncError()
    class AuthenticationError(cause: Throwable) : SyncError()
    class QuotaExceeded : SyncError()
    class ConflictError(val remoteTimestamp: Long) : SyncError()
    class CorruptedData : SyncError()
}

override suspend fun uploadVault(vaultId: String, syncData: VaultSyncData): String? {
    return try {
        // ... upload logic
    } catch (e: GoogleJsonResponseException) {
        when (e.statusCode) {
            401, 403 -> throw SyncError.AuthenticationError(e)
            409 -> throw SyncError.ConflictError(getRemoteTimestamp(vaultId))
            413 -> throw SyncError.QuotaExceeded()
            else -> throw SyncError.NetworkError(e)
        }
    } catch (e: IOException) {
        throw SyncError.NetworkError(e)
    }
}

// Retry logic with exponential backoff
class SyncRetryManager {
    suspend fun <T> retryWithBackoff(
        maxRetries: Int = 3,
        initialDelay: Long = 1000L,
        block: suspend () -> T
    ): Result<T> {
        repeat(maxRetries) { attempt ->
            try {
                return Result.success(block())
            } catch (e: SyncError.NetworkError) {
                if (attempt == maxRetries - 1) throw e
                delay(initialDelay * (2.0.pow(attempt)).toLong())
            } catch (e: SyncError) {
                // Don't retry auth or quota errors
                throw e
            }
        }
        throw IllegalStateException("Unreachable")
    }
}
```

---

## 📊 MÉTRIQUES DE QUALITÉ

| Catégorie | Score | Justification |
|-----------|-------|---------------|
| **Lisibilité** | 8.5/10 | ✅ Code bien structuré, nommage cohérent<br>❌ Quelques classes trop longues (VaultSessionManager: 823 lignes) |
| **Maintenabilité** | 8.0/10 | ✅ Clean Architecture respectée<br>✅ Dependency Injection avec Hilt<br>⚠️ Manque de tests unitaires visibles (seulement quelques tests) |
| **Performance** | 7.5/10 | ✅ Coroutines utilisées correctement<br>✅ Room avec Flow<br>⚠️ Argon2id peut être lent sur low-end devices<br>❌ Aucune pagination pour les entries |
| **Sécurité** | 8.0/10 | ✅ Cryptographie moderne (Argon2id + AES-GCM)<br>✅ Zero-knowledge architecture<br>❌ Salt déterministe (CRITIQUE)<br>❌ Pas de rate limiting |
| **Architecture** | 9.0/10 | ✅ Excellent design (Clean Architecture)<br>✅ Single source of truth (VaultSessionManager)<br>✅ Repository pattern correctement implémenté |

---

## 🎯 PLAN D'ACTION PRIORISÉ

### 1. **IMMÉDIAT** (Correctifs de sécurité critiques)
- [ ] **🔴 Remplacer le salt déterministe par un salt aléatoire** (`VaultCryptoManager.kt:350`)
  - Ajouter `salt` au `VaultFileHeader`
  - Migrer les vaults existants (générer un salt, re-chiffrer)
- [ ] **🔴 Implémenter le rate limiting sur `unlockVault()`**
  - Ajouter `UnlockRateLimiter` avec lockout de 5 minutes après 5 échecs
- [ ] **🔴 Valider les checksums strictement** (throw exception sur mismatch)

### 2. **COURT TERME** (1-2 semaines)
- [ ] **🟠 Améliorer le stockage biométrique**
  - Stocker uniquement l'alias Keystore, pas le password chiffré
  - Utiliser `setUserAuthenticationValidityDurationSeconds(-1)`
- [ ] **🟠 Remplacer tous les `Log.d/i/e` par `SecureLogger`**
  - Créer une classe wrapper qui respecte BuildConfig.DEBUG
  - Audit complet des logs (grep -r "Log\." dans le projet)
- [ ] **🟠 Implémenter memory wiping après déchiffrement**
  - Ajouter `wipePassword()` dans `lockVault()`
  - Wiper les buffers temporaires

### 3. **MOYEN TERME** (1 mois)
- [ ] **🟡 Paramètres Argon2 dynamiques basés sur le device**
  - Calculer memory/iterations selon RAM disponible
  - Target: 500ms-1s d'unlock time
- [ ] **🟡 Ajouter des tests de sécurité**
  - Unit tests pour la cryptographie
  - Integration tests pour unlock/lock
  - Fuzzing sur les fichiers .gpv
- [ ] **🟡 Améliorer la gestion d'erreurs de sync**
  - Différencier NetworkError / AuthError / ConflictError
  - Retry avec exponential backoff

### 4. **LONG TERME** (Évolutions architecturales)
- [ ] **🟢 Implémenter la rotation de clés**
  - Permettre de changer le master password sans tout re-chiffrer
  - Utiliser une DEK (Data Encryption Key) + KEK (Key Encryption Key)
- [ ] **🟢 Ajouter un système de backup automatique**
  - Backup local chiffré avant chaque modification majeure
  - Recovery flow en cas de corruption
- [ ] **🟢 Audit de sécurité externe**
  - Penetration testing professionnel
  - Code review par un expert crypto

---

## 💡 RECOMMANDATIONS GÉNÉRALES

### ✅ **À CONSERVER** (Bonnes pratiques)
1. **Architecture Clean** : Excellente séparation Domain/Data/UI
2. **Cryptographie moderne** : Argon2id + AES-256-GCM sont des choix professionnels
3. **Zero-knowledge sync** : Données chiffrées avant upload (privacy-first)
4. **Room + Flow** : Reactive architecture bien pensée
5. **ProGuard configuré** : Obfuscation et suppression des logs en release

### ⚠️ **À AMÉLIORER**
1. **Tests** : Augmenter la couverture de tests (surtout crypto + vault operations)
2. **Documentation** : Ajouter plus de KDoc sur les classes sensibles
3. **Error handling** : Uniformiser avec des sealed classes plutôt que des exceptions génériques
4. **Pagination** : Ajouter pour les listes d'entries (performance sur gros vaults)

### 📚 **RESSOURCES RECOMMANDÉES**
- [OWASP Mobile Security Testing Guide](https://mobile-security.gitbook.io/mobile-security-testing-guide/)
- [Android Security Best Practices](https://developer.android.com/training/articles/security-tips)
- [RFC 9106: Argon2 Memory-Hard Function](https://datatracker.ietf.org/doc/html/rfc9106)
- [NIST SP 800-63B: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)

---

## 🎉 CONCLUSION

**GenPwd Pro** est une application de gestion de mots de passe **bien conçue** avec une architecture solide et une cryptographie professionnelle. Le code est **lisible**, **maintenable** et suit les bonnes pratiques Android.

Les **vulnérabilités identifiées** sont **corrigeables** et ne remettent pas en cause l'architecture globale. Avec les corrections recommandées (notamment le salt aléatoire et le rate limiting), l'application atteindra un **niveau de sécurité professionnel**.

**Score final ajusté après corrections** : **9.0/10** 🔐

---

**Audit réalisé le** : 2025-11-04
**Fichiers analysés** : 148 fichiers Kotlin + configurations Gradle
**Lignes de code auditées** : ~15,000 LOC
**Auditeur** : Claude Code (Sonnet 4.5) - Expert Architecte Logiciel & Security Analyst

---

## 📂 FICHIERS CLÉS ANALYSÉS

### Sécurité & Cryptographie
- `android/app/src/main/java/com/julien/genpwdpro/data/crypto/VaultCryptoManager.kt`
- `android/app/src/main/java/com/julien/genpwdpro/data/encryption/EncryptionManager.kt`
- `android/app/src/main/java/com/julien/genpwdpro/data/crypto/TotpGenerator.kt`
- `android/app/src/main/java/com/julien/genpwdpro/data/vault/VaultFileManager.kt`

### Session & Authentication
- `android/app/src/main/java/com/julien/genpwdpro/domain/session/VaultSessionManager.kt`
- `android/app/src/main/java/com/julien/genpwdpro/domain/session/SessionManager.kt`

### Synchronisation Cloud
- `android/app/src/main/java/com/julien/genpwdpro/data/sync/providers/GoogleDriveProvider.kt`
- `android/app/src/main/java/com/julien/genpwdpro/data/sync/credentials/ProviderCredentialManager.kt`

### Base de données
- `android/app/src/main/java/com/julien/genpwdpro/data/local/database/AppDatabase.kt`

### Configuration
- `android/app/build.gradle.kts`
- `android/app/proguard-rules.pro`

---

*Rapport généré automatiquement par l'analyseur de code expert Claude Code*
