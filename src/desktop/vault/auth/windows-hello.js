/**
 * @fileoverview Windows Hello Authentication Module
 * Provides biometric authentication via Windows Hello
 *
 * Uses PowerShell to interact with Windows Hello and Credential Manager
 * No native module dependencies required
 *
 * @version 2.6.8
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { WINDOWS_HELLO } from '../../../js/config/crypto-constants.js';

const execAsync = promisify(exec);

// Credential target prefix for GenPwd vaults
const CREDENTIAL_PREFIX = 'GenPwdPro_Vault_';

// UUID v4 regex for vaultId validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Base64 regex for encryptedKey validation (standard Base64 with optional padding)
const BASE64_REGEX = /^[A-Za-z0-9+/]+=*$/;

/**
 * Validate vaultId is a valid UUID to prevent command injection
 * @param {string} vaultId - Vault ID to validate
 * @throws {Error} If vaultId is not a valid UUID
 */
function validateVaultId(vaultId) {
  if (!vaultId || typeof vaultId !== 'string') {
    throw new Error('Invalid vaultId: must be a non-empty string');
  }
  if (!UUID_REGEX.test(vaultId)) {
    throw new Error('Invalid vaultId: must be a valid UUID');
  }
}

/**
 * Validate encryptedKey is valid Base64 to prevent command injection
 * @param {string} encryptedKey - Encrypted key to validate
 * @throws {Error} If encryptedKey is not valid Base64
 */
function validateEncryptedKey(encryptedKey) {
  if (!encryptedKey || typeof encryptedKey !== 'string') {
    throw new Error('Invalid encryptedKey: must be a non-empty string');
  }
  // Check reasonable length (32-byte key + 16-byte IV + 16-byte auth tag = 64 bytes minimum)
  // Max 1KB to prevent abuse
  if (encryptedKey.length < 20 || encryptedKey.length > 1400) {
    throw new Error('Invalid encryptedKey: invalid length');
  }
  if (!BASE64_REGEX.test(encryptedKey)) {
    throw new Error('Invalid encryptedKey: must be valid Base64');
  }
}

/**
 * Windows Hello Authentication Manager
 */
export class WindowsHelloAuth {
  /**
   * Check if running on Windows
   * @returns {boolean}
   */
  static isWindows() {
    return process.platform === 'win32';
  }

  /**
   * Check if Windows Hello is available on this system
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    if (!this.isWindows()) {
      return false;
    }

    try {
      // Check UserConsentVerifier availability using proper async helper
      const psScript = `
        try {
          [void][Windows.Foundation.IAsyncOperation\`1, Windows.Foundation, ContentType=WindowsRuntime]
          Add-Type -AssemblyName System.Runtime.WindowsRuntime

          $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
          })[0]

          Function Await($WinRtTask, $ResultType) {
            $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
            $netTask = $asTask.Invoke($null, @($WinRtTask))
            $netTask.Wait(-1) | Out-Null
            $netTask.Result
          }

          [void][Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
          [void][Windows.Security.Credentials.UI.UserConsentVerifierAvailability,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]

          $asyncOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
          $availability = Await $asyncOp ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])

          if ($availability -eq 'Available') { 'true' } else { 'false' }
        } catch {
          'false'
        }
      `;

      const { stdout } = await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: WINDOWS_HELLO.AVAILABILITY_TIMEOUT }
      );

      const result = stdout.trim().toLowerCase() === 'true';
      console.log(`[WindowsHello] Availability check: ${result}`);
      return result;
    } catch (error) {
      console.error('[WindowsHello] Availability check failed:', error.message);
      // Fallback: check if WinBio service exists (can start on demand)
      try {
        const { stdout: fallback } = await execAsync(
          'powershell -NoProfile -Command "if (Get-Service WbioSrvc -ErrorAction SilentlyContinue) { \'true\' } else { \'false\' }"',
          { timeout: WINDOWS_HELLO.FALLBACK_CHECK_TIMEOUT }
        );
        return fallback.trim() === 'true';
      } catch {
        return false;
      }
    }
  }

  /**
   * Request Windows Hello verification
   * Shows the Windows Hello prompt to the user
   * @param {string} reason - Message to display in the prompt
   * @returns {Promise<boolean>} - True if verification succeeded
   */
  static async requestVerification(reason = 'GenPwd Pro - Vérification requise') {
    if (!this.isWindows()) {
      throw new Error('Windows Hello is only available on Windows');
    }

    try {
      // Sanitize reason: remove any characters that could cause issues
      // Use a safe default message to prevent any injection attacks
      const safeReason = reason
        .replace(/[`$"'\\\r\n]/g, '') // Remove dangerous chars
        .substring(0, 100) || 'GenPwd Pro - Verification'; // Limit length

      // Pass reason as Base64-encoded parameter to avoid injection
      const reasonBase64 = Buffer.from(safeReason, 'utf8').toString('base64');

      const psScript = `
        try {
          $reasonBase64 = '${reasonBase64}'
          $reason = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($reasonBase64))

          [void][Windows.Foundation.IAsyncOperation\`1, Windows.Foundation, ContentType=WindowsRuntime]
          Add-Type -AssemblyName System.Runtime.WindowsRuntime

          $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
          })[0]

          Function Await($WinRtTask, $ResultType) {
            $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
            $netTask = $asTask.Invoke($null, @($WinRtTask))
            $netTask.Wait(-1) | Out-Null
            $netTask.Result
          }

          [void][Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
          [void][Windows.Security.Credentials.UI.UserConsentVerificationResult,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]

          $asyncOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($reason)
          $verification = Await $asyncOp ([Windows.Security.Credentials.UI.UserConsentVerificationResult])

          if ($verification -eq 'Verified') { 'verified' } else { 'failed' }
        } catch {
          'error'
        }
      `;

      const { stdout } = await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: WINDOWS_HELLO.VERIFICATION_TIMEOUT }
      );

      return stdout.trim() === 'verified';
    } catch (error) {
      if (error.killed) {
        console.error('[WindowsHello] Verification timed out');
        return false;
      }
      console.error('[WindowsHello] Verification error:', error.message);
      return false;
    }
  }

  /**
   * Store a credential in Windows Credential Manager
   * @param {string} vaultId - Vault identifier
   * @param {string} encryptedKey - Base64 encoded encrypted key
   * @returns {Promise<boolean>}
   */
  static async storeCredential(vaultId, encryptedKey) {
    if (!this.isWindows()) {
      throw new Error('Credential Manager is only available on Windows');
    }

    // SECURITY: Validate vaultId is a UUID to prevent command injection
    validateVaultId(vaultId);

    // SECURITY: Validate encryptedKey is Base64 to prevent command injection
    validateEncryptedKey(encryptedKey);

    const target = `${CREDENTIAL_PREFIX}${vaultId}`;

    try {
      // Use PowerShell with proper escaping to store credential safely
      // This avoids shell metacharacter injection via encryptedKey
      const psScript = `
        $target = '${target}'
        $keyBytes = [System.Convert]::FromBase64String('${encryptedKey}')
        $keyString = [System.Text.Encoding]::UTF8.GetString($keyBytes)

        # Re-encode to ensure clean Base64 for storage
        $cleanKey = [System.Convert]::ToBase64String($keyBytes)

        # Use .NET CredentialManager for safe storage
        cmdkey /generic:$target /user:GenPwdPro /pass:$cleanKey
      `;

      await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: WINDOWS_HELLO.CREDENTIAL_TIMEOUT }
      );

      console.log(`[WindowsHello] Credential stored for vault: ${vaultId}`);
      return true;
    } catch (error) {
      console.error('[WindowsHello] Failed to store credential:', error.message);
      return false;
    }
  }

  /**
   * Retrieve a credential from Windows Credential Manager
   * @param {string} vaultId - Vault identifier
   * @returns {Promise<string|null>} - The stored encrypted key or null
   */
  static async retrieveCredential(vaultId) {
    if (!this.isWindows()) {
      throw new Error('Credential Manager is only available on Windows');
    }

    // SECURITY: Validate vaultId is a UUID to prevent command injection
    validateVaultId(vaultId);

    const target = `${CREDENTIAL_PREFIX}${vaultId}`;

    try {
      // Use PowerShell to read credential via CredRead API
      const psScript = `
        $target = '${target}'

        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;

        public class CredentialReader {
          [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
          public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credential);

          [DllImport("advapi32.dll", SetLastError = true)]
          public static extern bool CredFree([In] IntPtr cred);

          [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
          public struct CREDENTIAL {
            public uint Flags;
            public uint Type;
            public string TargetName;
            public string Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public uint CredentialBlobSize;
            public IntPtr CredentialBlob;
            public uint Persist;
            public uint AttributeCount;
            public IntPtr Attributes;
            public string TargetAlias;
            public string UserName;
          }

          public static string Read(string target) {
            IntPtr credPointer;
            if (CredRead(target, 1, 0, out credPointer)) {
              CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPointer, typeof(CREDENTIAL));
              byte[] passwordBytes = new byte[cred.CredentialBlobSize];
              Marshal.Copy(cred.CredentialBlob, passwordBytes, 0, (int)cred.CredentialBlobSize);
              CredFree(credPointer);
              return Encoding.Unicode.GetString(passwordBytes);
            }
            return null;
          }
        }
"@

        $result = [CredentialReader]::Read($target)
        if ($result) { $result } else { '' }
      `;

      const { stdout } = await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: WINDOWS_HELLO.CREDENTIAL_TIMEOUT }
      );

      const credential = stdout.trim();
      if (credential) {
        console.log(`[WindowsHello] Credential retrieved for vault: ${vaultId}`);
        return credential;
      }
      return null;
    } catch (error) {
      console.error('[WindowsHello] Failed to retrieve credential:', error.message);
      return null;
    }
  }

  /**
   * Delete a credential from Windows Credential Manager
   * @param {string} vaultId - Vault identifier
   * @returns {Promise<boolean>}
   */
  static async deleteCredential(vaultId) {
    if (!this.isWindows()) {
      throw new Error('Credential Manager is only available on Windows');
    }

    // SECURITY: Validate vaultId is a UUID to prevent command injection
    validateVaultId(vaultId);

    const target = `${CREDENTIAL_PREFIX}${vaultId}`;

    try {
      // Use cmdkey to delete credential (simpler and more reliable)
      // SECURITY: Wrap in PowerShell with Base64 encoding for defense-in-depth
      const psScript = `cmdkey /delete:"${target}"`;
      await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: WINDOWS_HELLO.CREDENTIAL_TIMEOUT }
      );

      console.log(`[WindowsHello] Credential deleted for vault: ${vaultId}`);
      return true;
    } catch (error) {
      // cmdkey returns error if credential doesn't exist, but that's OK
      if (error.message && error.message.includes('not found')) {
        console.log(`[WindowsHello] Credential already deleted for vault: ${vaultId}`);
        return true;
      }
      console.error('[WindowsHello] Failed to delete credential:', error.message);
      return false;
    }
  }

  /**
   * Check if Windows Hello is enabled for a specific vault
   * @param {string} vaultId - Vault identifier
   * @returns {Promise<boolean>}
   */
  static async isEnabledForVault(vaultId) {
    const credential = await this.retrieveCredential(vaultId);
    return credential !== null;
  }

  /**
   * Generate a random encryption key wrapper
   * @returns {string} - Base64 encoded 256-bit key
   */
  static generateKeyWrapper() {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Encrypt a vault key with a wrapper key
   * @param {Buffer} vaultKey - The vault encryption key
   * @param {string} wrapperKey - Base64 encoded wrapper key
   * @returns {string} - Base64 encoded encrypted key
   */
  static encryptVaultKey(vaultKey, wrapperKey) {
    const wrapper = Buffer.from(wrapperKey, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', wrapper, iv);

    const encrypted = Buffer.concat([
      cipher.update(vaultKey),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Format: iv (16) + authTag (16) + encrypted data
    const result = Buffer.concat([iv, authTag, encrypted]);
    const resultB64 = result.toString('base64');

    // Wipe sensitive buffers from memory
    wrapper.fill(0);
    iv.fill(0);
    encrypted.fill(0);
    authTag.fill(0);
    result.fill(0);

    return resultB64;
  }

  /**
   * Decrypt a vault key with a wrapper key
   * @param {string} encryptedKey - Base64 encoded encrypted key
   * @param {string} wrapperKey - Base64 encoded wrapper key
   * @returns {Buffer} - The decrypted vault key
   */
  static decryptVaultKey(encryptedKey, wrapperKey) {
    const wrapper = Buffer.from(wrapperKey, 'base64');
    const data = Buffer.from(encryptedKey, 'base64');

    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', wrapper, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Wipe sensitive buffers from memory
    // Note: decrypted key is returned to caller who must wipe it after use
    wrapper.fill(0);
    data.fill(0);

    return decrypted;
  }
}

export default WindowsHelloAuth;
