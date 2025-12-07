/**
 * @fileoverview Windows Hello Authentication Module
 * Provides biometric authentication via Windows Hello
 *
 * Uses PowerShell to interact with Windows Hello and Credential Manager
 * No native module dependencies required
 *
 * @version 2.6.7
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Credential target prefix for GenPwd vaults
const CREDENTIAL_PREFIX = 'GenPwdPro_Vault_';

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
        { timeout: 15000 }
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
          { timeout: 5000 }
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
      // Escape reason for PowerShell string
      const escapedReason = reason.replace(/'/g, "''");

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
          [void][Windows.Security.Credentials.UI.UserConsentVerificationResult,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]

          $asyncOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('${escapedReason}')
          $verification = Await $asyncOp ([Windows.Security.Credentials.UI.UserConsentVerificationResult])

          if ($verification -eq 'Verified') { 'verified' } else { 'failed' }
        } catch {
          'error'
        }
      `;

      const { stdout } = await execAsync(
        `powershell -NoProfile -EncodedCommand ${Buffer.from(psScript, 'utf16le').toString('base64')}`,
        { timeout: 60000 }
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

    const target = `${CREDENTIAL_PREFIX}${vaultId}`;

    try {
      // Use cmdkey to store credential (simpler and more reliable)
      // cmdkey stores in Windows Credential Manager
      await execAsync(
        `cmdkey /generic:"${target}" /user:GenPwdPro /pass:"${encryptedKey}"`,
        { timeout: 10000 }
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
        { timeout: 10000 }
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

    const target = `${CREDENTIAL_PREFIX}${vaultId}`;

    try {
      // Use cmdkey to delete credential (simpler and more reliable)
      await execAsync(
        `cmdkey /delete:"${target}"`,
        { timeout: 10000 }
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
    return result.toString('base64');
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

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
}

export default WindowsHelloAuth;
