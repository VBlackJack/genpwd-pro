# Troubleshooting Guide - GenPwd Pro

> Solutions for common issues with the password generator and vault manager

## Table of Contents

1. [Application Won't Start](#application-wont-start)
2. [Vault Issues](#vault-issues)
3. [Password Decryption Errors](#password-decryption-errors)
4. [Import/Export Problems](#importexport-problems)
5. [Clipboard Issues](#clipboard-issues)
6. [Windows Hello Problems](#windows-hello-problems)
7. [Performance Issues](#performance-issues)
8. [Update Problems](#update-problems)

---

## Application Won't Start

### Windows Defender or Antivirus Blocking

**Symptoms**: Application doesn't open, or closes immediately after launch.

**Solutions**:
1. Check Windows Security → Virus & threat protection → Protection history
2. Add GenPwd Pro to your antivirus exceptions list
3. Right-click the app and select "Run as administrator" (one-time test)
4. Verify the app is from a trusted source (official GitHub release)

### Missing Visual C++ Redistributable

**Symptoms**: Error about missing DLLs (vcruntime140.dll, msvcp140.dll)

**Solution**: Install the [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)

### Corrupted Installation

**Symptoms**: Random crashes on startup

**Solutions**:
1. Uninstall the application
2. Delete the folder: `%APPDATA%\genpwd-pro`
3. Reinstall from the latest release

---

## Vault Issues

### "Error Loading Vaults"

**Symptoms**: Vault list shows error message instead of your vaults

**Solutions**:
1. Click the **Retry** button to attempt loading again
2. Check if the vault file exists at: `%APPDATA%\genpwd-pro\vaults\`
3. Verify file permissions (you should have read/write access)
4. If vault file is on a network drive, check network connectivity

### Vault File Locked

**Symptoms**: "File is in use" error

**Solutions**:
1. Close any other instances of GenPwd Pro
2. Check Task Manager for running `genpwd-pro.exe` processes
3. Restart your computer if the file remains locked
4. For cloud-synced vaults, wait for sync to complete

### Database Busy

**Symptoms**: "Database busy" error

**Solutions**:
1. Wait a few seconds and retry
2. Close other applications that might access the vault file
3. Disable real-time sync temporarily

---

## Password Decryption Errors

### Incorrect Master Password

**Symptoms**: "Incorrect password" or "Authentication failed"

**Solutions**:
1. Verify CAPS LOCK is not enabled
2. Check keyboard language/layout (especially for special characters)
3. Try typing your password in a text editor first to verify
4. If using Windows Hello, try the master password instead

### Rate Limiting / Lockout

**Symptoms**: "Too many failed attempts" message with countdown

**What's Happening**: After 5 failed password attempts, the vault is temporarily locked to prevent brute-force attacks.

**Lockout Duration**:
- After 5 attempts: 1 minute lockout
- After 6 attempts: 5 minutes lockout
- After 7 attempts: 15 minutes lockout
- After 8 attempts: 1 hour lockout
- After 9+ attempts: 4 hours lockout

**Solutions**:
1. Wait for the lockout timer to expire
2. Verify your password is correct before retrying
3. The lockout state persists across app restarts (security feature)

### Vault Corruption

**Symptoms**: "Database corrupted" error

**Solutions**:
1. Check for automatic backups at: `%APPDATA%\genpwd-pro\vaults\*.bak`
2. Restore from your most recent backup:
   - Copy `your-vault.gpdb.bak` to `your-vault.gpdb`
3. If no backup exists, the vault data may be unrecoverable
4. Contact support with your vault file (we cannot recover passwords)

---

## Import/Export Problems

### Import Failed

**Symptoms**: "Import failed" with no specific error

**Solutions**:
1. Verify the file format matches the selected import type
2. For CSV imports, ensure:
   - UTF-8 encoding (not ANSI)
   - Proper column headers
   - No special characters in file path
3. For KeePass imports (.kdbx):
   - Verify the master password for the KeePass file
   - Check that the file isn't corrupted

### Export Issues

**Symptoms**: Export creates empty file or fails

**Solutions**:
1. Verify you have write permissions to the destination folder
2. Don't export to cloud-synced folders during sync
3. Try exporting to a local folder first
4. Check available disk space

---

## Clipboard Issues

### Password Not Copied

**Symptoms**: "Copied" toast appears but clipboard is empty

**Solutions**:
1. Another application may be blocking clipboard access
2. Try copying again after closing clipboard manager apps
3. Check if Windows Clipboard History is causing issues:
   - Press `Win + V` → Settings → Turn off Clipboard History

### Auto-Clear Not Working

**Symptoms**: Password stays in clipboard after timeout

**Solutions**:
1. If you copied something else, GenPwd Pro won't clear it (security: only clears its own content)
2. Verify clipboard timeout in Settings → Security
3. Windows Clipboard History may retain copies (disable if concerned)

### Security Warning About Clipboard History

Windows Clipboard History (Win + V) can store up to 25 items. This means:
- Copied passwords may be visible in history
- History syncs to other devices if enabled

**Recommendation**: Disable Clipboard History for maximum security:
1. Settings → System → Clipboard
2. Turn off "Clipboard history"
3. Turn off "Sync across devices"

---

## Windows Hello Problems

### Windows Hello Not Available

**Symptoms**: Biometric option doesn't appear

**Requirements**:
- Windows 10 version 1903 or later
- Windows Hello configured in Windows Settings
- Compatible biometric hardware (fingerprint reader or IR camera)

**Solutions**:
1. Open Windows Settings → Accounts → Sign-in options
2. Set up Windows Hello PIN, Fingerprint, or Face recognition
3. Restart GenPwd Pro after setting up Windows Hello

### Biometric Authentication Fails

**Symptoms**: Windows Hello prompt appears but authentication fails

**Solutions**:
1. Verify your biometric works in other apps
2. Re-register your fingerprint/face in Windows Settings
3. Use master password as fallback
4. Clear Windows Hello data for GenPwd Pro and re-enable

---

## Performance Issues

### Slow Password Generation

**Symptoms**: Generation takes several seconds

**Solutions**:
1. Reduce the number of passwords generated at once
2. For passphrase mode, use a smaller dictionary
3. Close other resource-intensive applications

### Vault Search is Slow

**Symptoms**: Lag when searching entries

**Solutions**:
1. Large vaults (1000+ entries) may have slight delays
2. Use folder organization to reduce search scope
3. Clear old/unused entries

### High Memory Usage

**Symptoms**: Application using >500MB RAM

**Solutions**:
1. Close and reopen the application
2. Clear the application cache
3. Restart your computer if issue persists

---

## Update Problems

### Update Download Fails

**Symptoms**: "Update check failed" or download stuck

**Solutions**:
1. Check your internet connection
2. Temporarily disable firewall/VPN
3. Download update manually from GitHub releases
4. Check proxy settings if behind corporate firewall

### Update Won't Install

**Symptoms**: "Installation failed" after download

**Solutions**:
1. Close all instances of GenPwd Pro
2. Run the installer as administrator
3. Disable antivirus temporarily during installation
4. If using portable version, manually extract new version

### Downgrade Not Allowed

**Symptoms**: "Cannot downgrade" error

**What's Happening**: Downgrading is blocked for security reasons (prevents rollback attacks).

**Solution**: If you need an older version, uninstall current version first, then install the older version.

---

## Getting Additional Help

### Log Files

Application logs are stored at:
- Windows: `%APPDATA%\genpwd-pro\logs\`
- Audit logs: `%APPDATA%\genpwd-pro\audit-logs\`

### Reporting Issues

1. Check [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues) for known problems
2. Create a new issue with:
   - GenPwd Pro version
   - Windows version
   - Steps to reproduce
   - Screenshots if applicable
   - Relevant log excerpts (remove sensitive data)

### Security Issues

For security vulnerabilities, please email privately instead of creating a public issue. See SECURITY.md for responsible disclosure guidelines.

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Won't start | Check antivirus, run as admin |
| Vault error | Click Retry, check file permissions |
| Wrong password | Check CAPS LOCK, keyboard layout |
| Locked out | Wait for timer, verify password |
| Corrupted vault | Restore from .bak file |
| Import failed | Check file encoding (UTF-8) |
| Clipboard empty | Check clipboard manager apps |
| No Windows Hello | Set up in Windows Settings first |
| Slow performance | Reduce generation count, restart app |
| Update failed | Download manually from GitHub |
