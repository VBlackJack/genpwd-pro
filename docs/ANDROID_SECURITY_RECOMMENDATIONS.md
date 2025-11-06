# Android Security Recommendations

This document outlines security improvements needed for the Android application based on TODO analysis.

## Critical TODOs to Address

### 1. OAuth Token Encryption ⚠️ CRITICAL

**File:** `android/app/src/main/java/com/julien/genpwdpro/presentation/sync/OAuthCallbackActivity.kt:125`

**Issue:**
```kotlin
// TODO: Encrypt tokens before storage
```

**Risk:** High - OAuth tokens stored in plain text could be compromised.

**Solution:**
```kotlin
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// Create encrypted preferences
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "oauth_tokens",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Store token securely
encryptedPrefs.edit()
    .putString("access_token", accessToken)
    .putString("refresh_token", refreshToken)
    .apply()
```

**Priority:** HIGH - Implement immediately

---

### 2. Passkey Signature Verification ⚠️ CRITICAL

**File:** `android/app/src/main/java/com/julien/genpwdpro/data/webauthn/PasskeyManager.kt:340`

**Issue:**
```kotlin
// TODO: Implémenter la vérification de signature
```

**Risk:** Critical - Authentication bypass possible without proper signature verification.

**Solution:**
```kotlin
import java.security.Signature
import java.security.PublicKey

fun verifySignature(
    publicKey: PublicKey,
    signedData: ByteArray,
    signature: ByteArray
): Boolean {
    return try {
        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(publicKey)
        verifier.update(signedData)
        verifier.verify(signature)
    } catch (e: Exception) {
        Log.e(TAG, "Signature verification failed", e)
        false
    }
}

// In authentication flow:
val publicKey = getPublicKeyFromCredential(credential)
val isValid = verifySignature(
    publicKey,
    challengeBytes,
    response.signature
)

if (!isValid) {
    throw SecurityException("Invalid passkey signature")
}
```

**Priority:** CRITICAL - Implement immediately

---

### 3. Conflict Resolution - Smart Merge

**File:** `android/app/src/main/java/com/julien/genpwdpro/data/sync/ConflictResolver.kt:70`

**Issue:**
```kotlin
// TODO: Implémenter la fusion intelligente
```

**Risk:** Medium - Data loss possible on sync conflicts.

**Solution:**
```kotlin
enum class MergeStrategy {
    LAST_WRITE_WINS,
    FIELD_LEVEL_MERGE,
    USER_PROMPT,
    VECTOR_CLOCK
}

data class ConflictResolution(
    val strategy: MergeStrategy,
    val localEntry: VaultEntry,
    val remoteEntry: VaultEntry,
    val result: VaultEntry
)

class SmartConflictResolver {

    fun resolve(
        local: VaultEntry,
        remote: VaultEntry,
        strategy: MergeStrategy = MergeStrategy.FIELD_LEVEL_MERGE
    ): ConflictResolution {
        return when (strategy) {
            MergeStrategy.LAST_WRITE_WINS -> {
                val winner = if (local.updatedAt > remote.updatedAt) local else remote
                ConflictResolution(strategy, local, remote, winner)
            }

            MergeStrategy.FIELD_LEVEL_MERGE -> {
                val merged = local.copy(
                    title = if (local.updatedAt > remote.updatedAt)
                        local.title else remote.title,
                    username = mergeField(local.username, remote.username,
                        local.updatedAt, remote.updatedAt),
                    password = mergeField(local.password, remote.password,
                        local.updatedAt, remote.updatedAt),
                    notes = mergeText(local.notes, remote.notes),
                    tags = mergeTags(local.tags, remote.tags),
                    customFields = mergeCustomFields(local.customFields, remote.customFields)
                )
                ConflictResolution(strategy, local, remote, merged)
            }

            MergeStrategy.VECTOR_CLOCK -> {
                // Implement vector clock comparison
                resolveWithVectorClock(local, remote)
            }

            MergeStrategy.USER_PROMPT -> {
                // Defer to UI for manual resolution
                ConflictResolution(strategy, local, remote, local)
            }
        }
    }

    private fun mergeField(
        local: String?,
        remote: String?,
        localTime: Instant,
        remoteTime: Instant
    ): String? {
        return when {
            local == remote -> local
            local.isNullOrEmpty() -> remote
            remote.isNullOrEmpty() -> local
            localTime > remoteTime -> local
            else -> remote
        }
    }
}
```

**Priority:** MEDIUM - Implement after critical items

---

### 4. Secure Logging Enhancements

**File:** `android/app/src/main/java/com/julien/genpwdpro/utils/SecureLogger.kt:160`

**Issue:**
```kotlin
// TODO: Integrate with Firebase Crashlytics or similar
```

**Solution:**
```kotlin
import com.google.firebase.crashlytics.FirebaseCrashlytics

class SecureLogger {
    private val crashlytics = FirebaseCrashlytics.getInstance()

    fun logError(
        message: String,
        throwable: Throwable? = null,
        context: Map<String, String> = emptyMap()
    ) {
        // Sanitize context
        val sanitized = sanitizeContext(context)

        // Set custom keys
        sanitized.forEach { (key, value) ->
            crashlytics.setCustomKey(key, value)
        }

        // Log to Crashlytics
        if (throwable != null) {
            crashlytics.recordException(throwable)
        } else {
            crashlytics.log(message)
        }

        // Also log locally (encrypted)
        persistLog(message, throwable, sanitized)
    }

    private fun sanitizeContext(context: Map<String, String>): Map<String, String> {
        return context.filterKeys { key ->
            !key.contains("password", ignoreCase = true) &&
            !key.contains("secret", ignoreCase = true) &&
            !key.contains("token", ignoreCase = true)
        }.mapValues { (_, value) ->
            sanitizeValue(value)
        }
    }
}
```

**Priority:** MEDIUM

---

### 5. Entry Sharing - Access Tracking

**File:** `android/app/src/main/java/com/julien/genpwdpro/data/sharing/SecureEntrySharing.kt:167`

**Issue:**
```kotlin
// TODO: Implémenter le tracking du nombre d'accès
```

**Solution:**
```kotlin
data class AccessLog(
    val entryId: String,
    val accessedAt: Instant,
    val accessedBy: String, // user ID or device ID
    val accessType: AccessType,
    val ipAddress: String? = null,
    val deviceInfo: String? = null
)

enum class AccessType {
    VIEW,
    COPY,
    EDIT,
    SHARE,
    REVOKE
}

class EntryAccessTracker {
    private val accessLogs = mutableListOf<AccessLog>()

    fun trackAccess(
        entryId: String,
        accessType: AccessType,
        userId: String
    ) {
        val log = AccessLog(
            entryId = entryId,
            accessedAt = Instant.now(),
            accessedBy = userId,
            accessType = accessType,
            deviceInfo = getDeviceInfo()
        )

        accessLogs.add(log)
        persistAccessLog(log)

        // Check for suspicious activity
        detectAnomalies(entryId, userId)
    }

    fun getAccessHistory(
        entryId: String,
        limit: Int = 50
    ): List<AccessLog> {
        return accessLogs
            .filter { it.entryId == entryId }
            .sortedByDescending { it.accessedAt }
            .take(limit)
    }

    private fun detectAnomalies(entryId: String, userId: String) {
        val recentAccesses = accessLogs
            .filter { it.entryId == entryId && it.accessedBy == userId }
            .filter { it.accessedAt > Instant.now().minusSeconds(3600) }

        // Alert if more than 10 accesses in last hour
        if (recentAccesses.size > 10) {
            Log.w(TAG, "Suspicious activity detected: $entryId accessed ${recentAccesses.size} times")
            notifySecurityTeam(entryId, userId, recentAccesses)
        }
    }
}
```

**Priority:** LOW - Enhancement

---

### 6. Attachment Thumbnail Generation

**File:** `android/app/src/main/java/com/julien/genpwdpro/data/attachments/SecureAttachmentManager.kt:266`

**Issue:**
```kotlin
// TODO: Implémenter la génération de miniature avec Android Bitmap
```

**Solution:**
```kotlin
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream

class ThumbnailGenerator {

    companion object {
        const val THUMBNAIL_SIZE = 256
        const val THUMBNAIL_QUALITY = 85
    }

    fun generateThumbnail(
        originalBytes: ByteArray,
        mimeType: String
    ): ByteArray? {
        return when {
            mimeType.startsWith("image/") -> generateImageThumbnail(originalBytes)
            mimeType.startsWith("video/") -> generateVideoThumbnail(originalBytes)
            else -> null
        }
    }

    private fun generateImageThumbnail(imageBytes: ByteArray): ByteArray {
        // Decode with inJustDecodeBounds to get dimensions
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)

        // Calculate inSampleSize
        options.inSampleSize = calculateInSampleSize(
            options.outWidth,
            options.outHeight,
            THUMBNAIL_SIZE,
            THUMBNAIL_SIZE
        )

        // Decode with inSampleSize
        options.inJustDecodeBounds = false
        val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, options)

        // Handle EXIF rotation
        val rotated = handleExifRotation(bitmap, imageBytes)

        // Scale to exact thumbnail size
        val scaled = Bitmap.createScaledBitmap(
            rotated,
            THUMBNAIL_SIZE,
            THUMBNAIL_SIZE,
            true
        )

        // Compress to JPEG
        val outputStream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, THUMBNAIL_QUALITY, outputStream)

        // Clean up
        bitmap.recycle()
        if (rotated != bitmap) rotated.recycle()
        scaled.recycle()

        return outputStream.toByteArray()
    }

    private fun calculateInSampleSize(
        width: Int,
        height: Int,
        reqWidth: Int,
        reqHeight: Int
    ): Int {
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            val halfHeight = height / 2
            val halfWidth = width / 2

            while ((halfHeight / inSampleSize) >= reqHeight &&
                   (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2
            }
        }

        return inSampleSize
    }

    private fun handleExifRotation(bitmap: Bitmap, imageBytes: ByteArray): Bitmap {
        val exif = ExifInterface(imageBytes.inputStream())
        val rotation = when (exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }

        val matrix = Matrix().apply { postRotate(rotation) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }
}
```

**Priority:** LOW - Enhancement

---

## Additional Security Recommendations

### 7. Implement Certificate Pinning

**Purpose:** Prevent MITM attacks on API calls.

```kotlin
import okhttp3.CertificatePinner

val certificatePinner = CertificatePinner.Builder()
    .add("api.genpwd.app", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .add("api.genpwd.app", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

---

### 8. Implement Root Detection

**Purpose:** Warn users about security risks on rooted devices.

```kotlin
import com.scottyab.rootbeer.RootBeer

class SecurityChecker(private val context: Context) {

    fun checkDeviceSecurity(): SecurityReport {
        val rootBeer = RootBeer(context)

        return SecurityReport(
            isRooted = rootBeer.isRooted,
            hasXposed = rootBeer.detectPotentiallyDangerousApps(),
            developerMode = isDeveloperModeEnabled(),
            usbDebugging = isUsbDebuggingEnabled()
        )
    }

    private fun isDeveloperModeEnabled(): Boolean {
        return Settings.Global.getInt(
            context.contentResolver,
            Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        ) != 0
    }
}
```

---

### 9. Implement Tamper Detection

**Purpose:** Detect if app has been modified or repackaged.

```kotlin
import android.content.pm.PackageManager
import java.security.MessageDigest

class TamperDetection(private val context: Context) {

    companion object {
        private const val EXPECTED_SIGNATURE = "YOUR_RELEASE_SIGNATURE_HASH"
    }

    fun verifySignature(): Boolean {
        try {
            val packageInfo = context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNATURES
            )

            val signature = packageInfo.signatures[0]
            val md = MessageDigest.getInstance("SHA-256")
            val digest = md.digest(signature.toByteArray())
            val hexString = digest.joinToString("") { "%02x".format(it) }

            return hexString == EXPECTED_SIGNATURE
        } catch (e: Exception) {
            return false
        }
    }
}
```

---

### 10. Secure Memory Management

**Purpose:** Clear sensitive data from memory after use.

```kotlin
class SecureMemory {

    fun secureWipe(charArray: CharArray) {
        charArray.fill('\u0000')
    }

    fun secureWipe(byteArray: ByteArray) {
        byteArray.fill(0)
    }

    fun <T> withSecureString(
        secureString: CharArray,
        block: (String) -> T
    ): T {
        return try {
            block(String(secureString))
        } finally {
            secureWipe(secureString)
        }
    }
}

// Usage:
val password = getPasswordInput()
try {
    // Use password
    authenticate(password)
} finally {
    secureWipe(password)
}
```

---

## Implementation Priority

### Immediate (Week 1)
1. ✅ OAuth token encryption
2. ✅ Passkey signature verification
3. ✅ Certificate pinning
4. ✅ Root detection

### Short-term (Month 1)
5. ✅ Smart conflict resolution
6. ✅ Secure logging with Crashlytics
7. ✅ Tamper detection
8. ✅ Secure memory management

### Long-term (Quarter 1)
9. ✅ Access tracking
10. ✅ Thumbnail generation
11. ✅ Security audit automation
12. ✅ Penetration testing

---

## Testing Checklist

### Security Tests
- [ ] OAuth token encryption verified
- [ ] Passkey signature validation tested
- [ ] Certificate pinning prevents MITM
- [ ] Root detection works on rooted devices
- [ ] Tamper detection catches modifications
- [ ] Sensitive data wiped from memory
- [ ] Conflict resolution preserves data integrity
- [ ] Access logs track all entry interactions

### Penetration Testing
- [ ] Static analysis (FindBugs, SpotBugs)
- [ ] Dynamic analysis (Drozer, MobSF)
- [ ] Network traffic analysis (Burp Suite)
- [ ] Reverse engineering resistance
- [ ] Storage security (encrypted databases)
- [ ] IPC security (intents, providers)

---

## Compliance

### Standards to Follow
- ✅ OWASP Mobile Top 10
- ✅ MASVS (Mobile Application Security Verification Standard)
- ✅ PCI-DSS (if handling payment data)
- ✅ GDPR (data protection)
- ✅ SOC 2 Type II (for enterprise)

### Required Documentation
- Security architecture diagram
- Threat model
- Data flow diagrams
- Encryption key management procedures
- Incident response plan

---

## Resources

- [OWASP Mobile Security Testing Guide](https://mobile-security.gitbook.io/mobile-security-testing-guide/)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)
- [ProGuard/R8 Configuration](https://developer.android.com/studio/build/shrink-code)
- [Android Keystore System](https://developer.android.com/training/articles/keystore)

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Author:** Security Team
