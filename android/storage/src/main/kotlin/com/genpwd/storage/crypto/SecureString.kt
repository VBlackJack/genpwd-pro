package com.genpwd.storage.crypto

import java.io.Closeable
import java.util.Arrays

/**
 * A secure string implementation that stores sensitive data in memory
 * and ensures it is properly zeroed out when no longer needed.
 *
 * Unlike regular String objects which are immutable and cannot be cleared
 * from memory, SecureString uses a mutable CharArray that can be zeroed
 * out to prevent sensitive data from remaining in memory.
 *
 * SECURITY FEATURES:
 * - Uses CharArray instead of String (mutable, can be zeroed)
 * - Implements AutoCloseable for automatic cleanup with use {}
 * - Throws exception if accessed after being closed
 * - Provides secure comparison without exposing underlying data
 * - Prevents accidental exposure via toString()
 *
 * USAGE:
 * ```
 * SecureString(token).use { secureToken ->
 *     // Use secureToken.get() or secureToken.use { chars -> ... }
 * } // Automatically zeroed here
 * ```
 *
 * @param value The sensitive string to protect
 */
class SecureString(value: String) : Closeable {

    @Volatile
    private var data: CharArray? = value.toCharArray()

    @Volatile
    private var closed = false

    /**
     * Execute a block with access to the underlying character array.
     * This is the recommended way to access the data.
     *
     * @param block The operation to perform with the character array
     * @return The result of the block
     * @throws IllegalStateException if SecureString has been closed
     */
    inline fun <R> use(block: (CharArray) -> R): R {
        checkNotClosed()
        val chars = data ?: throw IllegalStateException("SecureString data is null")
        return block(chars)
    }

    /**
     * Get the underlying character array directly.
     * WARNING: Caller is responsible for not keeping references to this array.
     *
     * @return The character array containing sensitive data
     * @throws IllegalStateException if SecureString has been closed
     */
    fun get(): CharArray {
        checkNotClosed()
        return data ?: throw IllegalStateException("SecureString data is null")
    }

    /**
     * Convert to a regular String.
     * WARNING: This creates an immutable String that cannot be cleared from memory.
     * Only use this when absolutely necessary (e.g., passing to APIs that require String).
     *
     * @return String representation of the secure data
     * @throws IllegalStateException if SecureString has been closed
     */
    fun toUnsafeString(): String {
        checkNotClosed()
        val chars = data ?: throw IllegalStateException("SecureString data is null")
        return String(chars)
    }

    /**
     * Get the length of the secure string.
     *
     * @return The length of the data
     * @throws IllegalStateException if SecureString has been closed
     */
    fun length(): Int {
        checkNotClosed()
        return data?.size ?: 0
    }

    /**
     * Check if the secure string is empty.
     *
     * @return true if empty or closed
     */
    fun isEmpty(): Boolean {
        return if (closed) true else (data?.isEmpty() ?: true)
    }

    /**
     * Securely compare with another SecureString for equality.
     * Uses constant-time comparison to prevent timing attacks.
     *
     * @param other The SecureString to compare with
     * @return true if equal, false otherwise
     */
    fun secureEquals(other: SecureString): Boolean {
        if (closed || other.closed) return false

        val thisData = this.data
        val otherData = other.data

        if (thisData == null || otherData == null) return false
        if (thisData.size != otherData.size) return false

        // Constant-time comparison to prevent timing attacks
        var result = 0
        for (i in thisData.indices) {
            result = result or (thisData[i].code xor otherData[i].code)
        }
        return result == 0
    }

    /**
     * Check if this SecureString has been closed.
     *
     * @return true if closed
     */
    fun isClosed(): Boolean = closed

    /**
     * Zero out the underlying character array and mark as closed.
     * This method is idempotent - calling it multiple times is safe.
     */
    override fun close() {
        if (closed) return

        synchronized(this) {
            if (closed) return

            data?.let { chars ->
                // Zero out the array
                Arrays.fill(chars, '\u0000')
            }
            data = null
            closed = true
        }
    }

    /**
     * Check that this SecureString is not closed.
     *
     * @throws IllegalStateException if closed
     */
    private fun checkNotClosed() {
        if (closed) {
            throw IllegalStateException("SecureString has been closed and cannot be accessed")
        }
    }

    /**
     * Override toString to prevent accidental exposure of sensitive data.
     * Returns a placeholder instead of the actual data.
     *
     * @return Placeholder string
     */
    override fun toString(): String {
        return if (closed) {
            "SecureString[CLOSED]"
        } else {
            "SecureString[${data?.size ?: 0} chars]"
        }
    }

    /**
     * Ensure data is zeroed even if close() is not called.
     * This is a safety net, but should not be relied upon.
     */
    protected fun finalize() {
        close()
    }

    companion object {
        /**
         * Create a SecureString from a nullable string.
         * Returns null if input is null.
         *
         * @param value The string to protect (nullable)
         * @return SecureString or null
         */
        fun fromNullable(value: String?): SecureString? {
            return value?.let { SecureString(it) }
        }

        /**
         * Create an empty SecureString.
         *
         * @return Empty SecureString
         */
        fun empty(): SecureString {
            return SecureString("")
        }
    }
}
