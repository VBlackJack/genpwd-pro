package com.julien.genpwdpro.data.crypto

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Tests unitaires pour VaultCryptoManager
 */
class VaultCryptoManagerTest {

    private lateinit var cryptoManager: VaultCryptoManager

    @Before
    fun setup() {
        cryptoManager = VaultCryptoManager()
    }

    // ========================================
    // Tests des méthodes de base
    // ========================================

    @Test
    fun `generateSalt creates 32-byte salt`() {
        val salt = cryptoManager.generateSalt()

        assertEquals(32, salt.size)
    }

    @Test
    fun `generateSalt creates unique salts`() {
        val salt1 = cryptoManager.generateSalt()
        val salt2 = cryptoManager.generateSalt()

        assertFalse(salt1.contentEquals(salt2))
    }

    @Test
    fun `generateIV creates 12-byte IV`() {
        val iv = cryptoManager.generateIV()

        assertEquals(12, iv.size)
    }

    @Test
    fun `generateAESKey creates valid 256-bit key`() {
        val key = cryptoManager.generateAESKey()

        assertEquals("AES", key.algorithm)
        assertEquals(32, key.encoded.size) // 256 bits = 32 bytes
    }

    // ========================================
    // Tests de dérivation de clé
    // ========================================

    @Test
    fun `deriveKey creates consistent key for same password and salt`() {
        val password = "MySecurePassword123!"
        val salt = cryptoManager.generateSalt()

        val key1 = cryptoManager.deriveKey(password, salt)
        val key2 = cryptoManager.deriveKey(password, salt)

        assertArrayEquals(key1.encoded, key2.encoded)
    }

    @Test
    fun `deriveKey creates different keys for different passwords`() {
        val salt = cryptoManager.generateSalt()

        val key1 = cryptoManager.deriveKey("password1", salt)
        val key2 = cryptoManager.deriveKey("password2", salt)

        assertFalse(key1.encoded.contentEquals(key2.encoded))
    }

    @Test
    fun `deriveKey creates different keys for different salts`() {
        val password = "MySecurePassword123!"

        val key1 = cryptoManager.deriveKey(password, cryptoManager.generateSalt())
        val key2 = cryptoManager.deriveKey(password, cryptoManager.generateSalt())

        assertFalse(key1.encoded.contentEquals(key2.encoded))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `deriveKey throws exception for invalid salt size`() {
        val password = "MySecurePassword123!"
        val invalidSalt = ByteArray(16) // Should be 32 bytes

        cryptoManager.deriveKey(password, invalidSalt)
    }

    // ========================================
    // Tests de hachage de mot de passe
    // ========================================

    @Test
    fun `hashPassword creates valid Argon2id hash`() {
        val password = "MySecurePassword123!"
        val salt = cryptoManager.generateSalt()

        val hash = cryptoManager.hashPassword(password, salt)

        assertTrue(hash.startsWith("\$argon2id\$"))
        assertTrue(hash.length > 50)
    }

    @Test
    fun `verifyPassword accepts correct password`() {
        val password = "MySecurePassword123!"
        val salt = cryptoManager.generateSalt()
        val hash = cryptoManager.hashPassword(password, salt)

        val result = cryptoManager.verifyPassword(hash, password)

        assertTrue(result)
    }

    @Test
    fun `verifyPassword rejects incorrect password`() {
        val correctPassword = "MySecurePassword123!"
        val wrongPassword = "WrongPassword456!"
        val salt = cryptoManager.generateSalt()
        val hash = cryptoManager.hashPassword(correctPassword, salt)

        val result = cryptoManager.verifyPassword(hash, wrongPassword)

        assertFalse(result)
    }

    // ========================================
    // Tests de chiffrement/déchiffrement AES-GCM
    // ========================================

    @Test
    fun `encryptAESGCM and decryptAESGCM roundtrip works`() {
        val plaintext = "Hello, Secure World!".toByteArray()
        val key = cryptoManager.generateAESKey()
        val iv = cryptoManager.generateIV()

        val encrypted = cryptoManager.encryptAESGCM(plaintext, key, iv)
        val decrypted = cryptoManager.decryptAESGCM(encrypted, key, iv)

        assertArrayEquals(plaintext, decrypted)
    }

    @Test
    fun `encryptString and decryptString roundtrip works`() {
        val plaintext = "Hello, Secure World!"
        val key = cryptoManager.generateAESKey()
        val iv = cryptoManager.generateIV()

        val encrypted = cryptoManager.encryptString(plaintext, key, iv)
        val decrypted = cryptoManager.decryptString(encrypted, key, iv)

        assertEquals(plaintext, decrypted)
    }

    @Test(expected = Exception::class)
    fun `decryptAESGCM with wrong key throws exception`() {
        val plaintext = "Hello, Secure World!".toByteArray()
        val key1 = cryptoManager.generateAESKey()
        val key2 = cryptoManager.generateAESKey()
        val iv = cryptoManager.generateIV()

        val encrypted = cryptoManager.encryptAESGCM(plaintext, key1, iv)
        cryptoManager.decryptAESGCM(encrypted, key2, iv) // Should throw
    }

    @Test(expected = Exception::class)
    fun `decryptAESGCM with wrong IV throws exception`() {
        val plaintext = "Hello, Secure World!".toByteArray()
        val key = cryptoManager.generateAESKey()
        val iv1 = cryptoManager.generateIV()
        val iv2 = cryptoManager.generateIV()

        val encrypted = cryptoManager.encryptAESGCM(plaintext, key, iv1)
        cryptoManager.decryptAESGCM(encrypted, key, iv2) // Should throw
    }

    @Test(expected = Exception::class)
    fun `decryptAESGCM with tampered ciphertext throws exception`() {
        val plaintext = "Hello, Secure World!".toByteArray()
        val key = cryptoManager.generateAESKey()
        val iv = cryptoManager.generateIV()

        val encrypted = cryptoManager.encryptAESGCM(plaintext, key, iv)

        // Tamper with the ciphertext
        encrypted[0] = (encrypted[0] + 1).toByte()

        cryptoManager.decryptAESGCM(encrypted, key, iv) // Should throw AEADBadTagException
    }

    // ========================================
    // Tests des nouvelles méthodes helpers (Phase 2)
    // ========================================

    @Test
    fun `generateSaltFromString creates deterministic salt`() {
        val seed = "my-vault-id-12345"

        val salt1 = cryptoManager.generateSaltFromString(seed)
        val salt2 = cryptoManager.generateSaltFromString(seed)

        assertEquals(32, salt1.size)
        assertArrayEquals(salt1, salt2)
    }

    @Test
    fun `generateSaltFromString creates different salts for different seeds`() {
        val salt1 = cryptoManager.generateSaltFromString("vault-id-1")
        val salt2 = cryptoManager.generateSaltFromString("vault-id-2")

        assertFalse(salt1.contentEquals(salt2))
    }

    @Test
    fun `encryptBytes includes IV in output`() {
        val plaintext = "Hello, World!".toByteArray()
        val key = cryptoManager.generateAESKey()

        val encrypted = cryptoManager.encryptBytes(plaintext, key)

        // Should be: IV (12 bytes) + Ciphertext + Tag
        assertTrue(encrypted.size > 12 + plaintext.size)
    }

    @Test
    fun `encryptBytes and decryptBytes roundtrip works`() {
        val plaintext = "Hello, Secure World!".toByteArray()
        val key = cryptoManager.generateAESKey()

        val encrypted = cryptoManager.encryptBytes(plaintext, key)
        val decrypted = cryptoManager.decryptBytes(encrypted, key)

        assertArrayEquals(plaintext, decrypted)
    }

    @Test
    fun `encryptBytes creates different ciphertexts each time (random IV)`() {
        val plaintext = "Hello, World!".toByteArray()
        val key = cryptoManager.generateAESKey()

        val encrypted1 = cryptoManager.encryptBytes(plaintext, key)
        val encrypted2 = cryptoManager.encryptBytes(plaintext, key)

        // IV is random, so ciphertexts should differ
        assertFalse(encrypted1.contentEquals(encrypted2))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `decryptBytes throws exception if ciphertext too short`() {
        val key = cryptoManager.generateAESKey()
        val tooShort = ByteArray(10) // Less than IV_LENGTH (12)

        cryptoManager.decryptBytes(tooShort, key)
    }

    @Test
    fun `hashFile creates consistent SHA-256 hash`() {
        val fileContent = "This is my key file content".toByteArray()

        val hash1 = cryptoManager.hashFile(fileContent)
        val hash2 = cryptoManager.hashFile(fileContent)

        assertEquals(32, hash1.size) // SHA-256 = 32 bytes
        assertArrayEquals(hash1, hash2)
    }

    @Test
    fun `hashFile creates different hashes for different content`() {
        val content1 = "Key file 1".toByteArray()
        val content2 = "Key file 2".toByteArray()

        val hash1 = cryptoManager.hashFile(content1)
        val hash2 = cryptoManager.hashFile(content2)

        assertFalse(hash1.contentEquals(hash2))
    }

    @Test
    fun `deriveKeyWithKeyFile without key file matches deriveKey`() {
        val password = "MyPassword123!"
        val salt = cryptoManager.generateSalt()

        val key1 = cryptoManager.deriveKey(password, salt)
        val key2 = cryptoManager.deriveKeyWithKeyFile(password, salt, null)

        assertArrayEquals(key1.encoded, key2.encoded)
    }

    @Test
    fun `deriveKeyWithKeyFile with key file creates different key`() {
        val password = "MyPassword123!"
        val salt = cryptoManager.generateSalt()
        val keyFileContent = "My secret key file".toByteArray()

        val keyWithoutFile = cryptoManager.deriveKey(password, salt)
        val keyWithFile = cryptoManager.deriveKeyWithKeyFile(password, salt, keyFileContent)

        assertFalse(keyWithoutFile.encoded.contentEquals(keyWithFile.encoded))
    }

    @Test
    fun `deriveKeyWithKeyFile creates consistent key for same inputs`() {
        val password = "MyPassword123!"
        val salt = cryptoManager.generateSalt()
        val keyFileContent = "My secret key file".toByteArray()

        val key1 = cryptoManager.deriveKeyWithKeyFile(password, salt, keyFileContent)
        val key2 = cryptoManager.deriveKeyWithKeyFile(password, salt, keyFileContent)

        assertArrayEquals(key1.encoded, key2.encoded)
    }

    @Test
    fun `deriveKeyWithKeyFile with different key file creates different key`() {
        val password = "MyPassword123!"
        val salt = cryptoManager.generateSalt()
        val keyFile1 = "Key file 1".toByteArray()
        val keyFile2 = "Key file 2".toByteArray()

        val key1 = cryptoManager.deriveKeyWithKeyFile(password, salt, keyFile1)
        val key2 = cryptoManager.deriveKeyWithKeyFile(password, salt, keyFile2)

        assertFalse(key1.encoded.contentEquals(key2.encoded))
    }

    // ========================================
    // Tests de conversion (hex, base64)
    // ========================================

    @Test
    fun `bytesToHex and hexToBytes roundtrip works`() {
        val original = byteArrayOf(
            0x01,
            0x23,
            0x45,
            0x67,
            0x89.toByte(),
            0xAB.toByte(),
            0xCD.toByte(),
            0xEF.toByte()
        )

        val hex = cryptoManager.bytesToHex(original)
        val restored = cryptoManager.hexToBytes(hex)

        assertArrayEquals(original, restored)
    }

    @Test
    fun `bytesToHex creates correct hex string`() {
        val bytes = byteArrayOf(0x0F, 0xFF.toByte())

        val hex = cryptoManager.bytesToHex(bytes)

        assertEquals("0fff", hex)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `hexToBytes throws exception for odd-length string`() {
        cryptoManager.hexToBytes("abc") // Odd length
    }

    @Test
    fun `bytesToBase64 and base64ToBytes roundtrip works`() {
        val original = "Hello, World!".toByteArray()

        val base64 = cryptoManager.bytesToBase64(original)
        val restored = cryptoManager.base64ToBytes(base64)

        assertArrayEquals(original, restored)
    }

    // ========================================
    // Tests de createVault et unlockVault
    // ========================================

    @Test
    fun `createVault generates all necessary components`() {
        val masterPassword = "MySecurePassword123!"

        val result = cryptoManager.createVault(masterPassword)

        assertNotNull(result.salt)
        assertNotNull(result.masterPasswordHash)
        assertNotNull(result.encryptedKey)
        assertNotNull(result.keyIv)
        assertNotNull(result.derivedKey)

        assertTrue(result.salt.length > 0)
        assertTrue(result.masterPasswordHash.startsWith("\$argon2id\$"))
    }

    @Test
    fun `unlockVault with correct password succeeds`() {
        val masterPassword = "MySecurePassword123!"
        val result = cryptoManager.createVault(masterPassword)

        val unlockedKey = cryptoManager.unlockVault(
            masterPassword = masterPassword,
            salt = result.salt,
            encryptedKey = result.encryptedKey,
            keyIv = result.keyIv
        )

        assertNotNull(unlockedKey)
        assertArrayEquals(result.derivedKey.encoded, unlockedKey?.encoded)
    }

    @Test
    fun `unlockVault with wrong password returns null`() {
        val correctPassword = "MySecurePassword123!"
        val wrongPassword = "WrongPassword456!"
        val result = cryptoManager.createVault(correctPassword)

        val unlockedKey = cryptoManager.unlockVault(
            masterPassword = wrongPassword,
            salt = result.salt,
            encryptedKey = result.encryptedKey,
            keyIv = result.keyIv
        )

        assertNull(unlockedKey)
    }

    // ========================================
    // Tests de sécurité
    // ========================================

    @Test
    fun `wipeKey zeros out key bytes`() {
        val key = cryptoManager.generateAESKey()
        val originalBytes = key.encoded.clone()

        cryptoManager.wipeKey(key)

        // After wiping, bytes should be zeroed
        val wipedBytes = key.encoded
        assertFalse(originalBytes.contentEquals(wipedBytes))
        assertTrue(wipedBytes.all { it == 0.toByte() })
    }

    @Test
    fun `wipePassword zeros out char array`() {
        val password = "MyPassword123!".toCharArray()
        val originalPassword = password.clone()

        cryptoManager.wipePassword(password)

        assertFalse(originalPassword.contentEquals(password))
        assertTrue(password.all { it == '\u0000' })
    }
}
