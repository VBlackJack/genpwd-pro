# GenPwd Pro Native Messaging Host

This component enables communication between the GenPwd Pro Chrome extension and the Windows desktop application.

## Architecture

```
Chrome Extension <---> Native Messaging Host <---> Electron App
     (stdio)           (genpwd-native-host.js)    (Named Pipe)
```

## Installation

### Prerequisites
- Node.js installed and available in PATH
- GenPwd Pro Windows application installed

### Steps

1. **Get your Chrome Extension ID**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Find GenPwd Pro and copy the ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

2. **Run the installer**
   - Right-click `install.bat` and select "Run as Administrator" for system-wide install
   - Or double-click for user-only install

3. **Update the manifest with your extension ID**
   - Open `com.genpwdpro.nmh.json` in a text editor
   - Replace `EXTENSION_ID_PLACEHOLDER` with your actual extension ID
   - Example: `"chrome-extension://abcdefghijklmnopqrstuvwxyz123456/"`

4. **Restart Chrome** to load the native host configuration

## Files

| File | Description |
|------|-------------|
| `genpwd-native-host.js` | Node.js script that bridges Chrome and Electron |
| `genpwd-native-host.bat` | Batch launcher for the Node.js script |
| `com.genpwdpro.nmh.json` | Native messaging manifest for Chrome |
| `install.bat` | Registry installer script |
| `uninstall.bat` | Registry cleanup script |

## How it Works

1. When the Chrome extension needs vault data, it sends a message via native messaging
2. Chrome launches `genpwd-native-host.bat` which starts the Node.js script
3. The script connects to the Electron app via a named pipe (`\\.\pipe\genpwd-pro`)
4. The Electron app processes the request and returns data
5. The response flows back through the pipe and native messaging to the extension

## Supported Operations

| Action | Description |
|--------|-------------|
| `getStatus` | Check vault status and get vault name |
| `isUnlocked` | Check if the vault is unlocked |
| `getEntries` | Get all entries (without passwords) |
| `getEntriesForDomain` | Get entries matching a domain |
| `searchEntries` | Search entries by query |
| `getEntry` | Get full entry details including password |
| `getTOTP` | Generate TOTP code for an entry |
| `fillEntry` | Notify app that an entry was filled |

## Troubleshooting

### Extension shows "App not running"
- Make sure the GenPwd Pro Windows application is running
- Check that the vault is open (you should see the vault name in the title bar)

### Extension shows "Vault is locked"
- Unlock the vault in the GenPwd Pro Windows application
- The extension will automatically detect when the vault is unlocked

### Native messaging not working
1. Verify Node.js is in your PATH: run `node --version` in Command Prompt
2. Check the registry entry exists:
   - User install: `HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.genpwdpro.nmh`
   - System install: `HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\com.genpwdpro.nmh`
3. Verify the manifest path in the registry points to the correct location
4. Check the extension ID in the manifest matches your installed extension

## Uninstallation

Run `uninstall.bat` to remove the registry entry. This does not delete the files.
