# GenPwd Pro - Advanced Import/Export Guide

**Version:** 2.6.0
**Last Updated:** January 14, 2025
**Author:** GenPwd Pro Team

## Table of Contents

1. [Introduction](#introduction)
2. [Supported Formats](#supported-formats)
3. [Import Guide](#import-guide)
4. [Export Guide](#export-guide)
5. [Format Specifications](#format-specifications)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#api-reference)

---

## Introduction

GenPwd Pro supports advanced import and export functionality, allowing seamless migration between popular password managers. This guide covers all supported formats and provides detailed instructions for importing and exporting your passwords.

### Key Features

- ✅ Support for 4 major password managers (KeePass, Bitwarden, LastPass, 1Password)
- ✅ Multiple format options (XML, JSON, CSV)
- ✅ Automatic field mapping
- ✅ Data validation and sanitization
- ✅ Preview before import
- ✅ Batch operations

---

## Supported Formats

### Import Formats

| Format | File Type | Fields Supported | Notes |
|--------|-----------|-----------------|-------|
| **KeePass XML** | `.xml` | Title, Username, Password, URL, Notes, Tags, Timestamps | Full metadata support |
| **KeePass CSV** | `.csv` | Account, Login Name, Password, Web Site, Comments | Basic fields |
| **Bitwarden JSON** | `.json` | Name, Username, Password, URI, Notes, Folder, Timestamps | Full-featured |
| **LastPass CSV** | `.csv` | url, username, password, extra, name, grouping | Standard export |
| **1Password CSV** | `.csv` | Title, URL, Username, Password, Notes, Category | Standard export |
| **Generic JSON** | `.json` | All fields | Universal format |
| **Generic CSV** | `.csv` | Basic fields | Simple format |

### Export Formats

| Format | File Type | Compatible With | Recommended For |
|--------|-----------|----------------|----------------|
| **KeePass CSV** | `.csv` | KeePass 1.x, 2.x | Desktop users |
| **Bitwarden JSON** | `.json` | Bitwarden, Vaultwarden | Cloud sync users |
| **LastPass CSV** | `.csv` | LastPass | LastPass users |
| **1Password CSV** | `.csv` | 1Password | Mac/iOS users |
| **Generic JSON** | `.json` | GenPwd Pro, custom apps | Backup & archival |
| **Generic CSV** | `.csv` | Excel, Google Sheets | Analysis |

---

## Import Guide

### Step-by-Step Import Process

#### 1. Export from Your Current Password Manager

**KeePass:**
- File → Export → KeePass XML or CSV
- Choose "Include all entries"

**Bitwarden:**
- Tools → Export Vault
- Format: `.json` (recommended) or `.csv`

**LastPass:**
- More Options → Advanced → Export
- Save as CSV file

**1Password:**
- File → Export → All Items
- Format: CSV

#### 2. Import into GenPwd Pro

1. Click **📥 Import** button in the results panel
2. Select the appropriate format from the dropdown
3. Read the format description
4. Click **📁 Select File** and choose your export file
5. Preview the imported entries (first 5 shown)
6. Click **✅ Import Passwords** to complete

#### 3. Verify Imported Data

- Check that all entries were imported
- Verify usernames and passwords
- Confirm URLs are correct
- Review any notes or additional data

### Format-Specific Import Instructions

#### KeePass XML Import

```xml
<?xml version="1.0" encoding="UTF-8"?>
<KeePassFile>
  <Root>
    <Group>
      <Name>Root</Name>
      <Entry>
        <String>
          <Key>Title</Key>
          <Value>My Account</Value>
        </String>
        <String>
          <Key>UserName</Key>
          <Value>user@example.com</Value>
        </String>
        <String>
          <Key>Password</Key>
          <Value>SecurePassword123!</Value>
        </String>
        <String>
          <Key>URL</Key>
          <Value>https://example.com</Value>
        </String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>
```

**Supported Fields:**
- Title → Entry title
- UserName → Username
- Password → Password (not sanitized)
- URL → Website URL (validated)
- Notes → Additional notes
- Tags → Tags/categories
- Times → Creation/modification timestamps

#### KeePass CSV Import

```csv
Account,Login Name,Password,Web Site,Comments
"My Account","user@example.com","SecurePass123","https://example.com","Important account"
```

**Field Mapping:**
- Account/Title/Name → title
- Login Name/Username/User Name → username
- Password → password
- Web Site/URL/Login URL → url
- Comments/Notes → notes
- Group/Folder → folder

#### Bitwarden JSON Import

```json
{
  "encrypted": false,
  "folders": [],
  "items": [
    {
      "type": 1,
      "name": "My Account",
      "notes": "Important account",
      "favorite": false,
      "login": {
        "username": "user@example.com",
        "password": "SecurePass123",
        "totp": null,
        "uris": [
          {
            "match": null,
            "uri": "https://example.com"
          }
        ]
      }
    }
  ]
}
```

**Supported Fields:**
- type: 1 (Login items only)
- name → title
- login.username → username
- login.password → password
- login.uris[0].uri → url
- notes → notes
- favorite → metadata.favorite
- folderId → metadata.folderId

#### LastPass CSV Import

```csv
url,username,password,extra,name,grouping,fav
https://example.com,user@example.com,SecurePass123,Important account,My Account,Work,0
```

**Field Mapping:**
- name/Name → title
- username/Username → username
- password/Password → password
- url/URL → url
- extra/Notes/note → notes
- grouping/Folder → folder

#### 1Password CSV Import

```csv
Title,URL,Username,Password,Notes,Category
"My Account","https://example.com","user@example.com","SecurePass123","Important account","Login"
```

**Field Mapping:**
- Title/title → title
- Username/username → username
- Password/password → password
- URL/url/Website → url
- Notes/notes → notes
- Folder/folder/Category → folder
- Tags/tags → tags (comma-separated)

---

## Export Guide

### Step-by-Step Export Process

#### 1. Generate Passwords

Generate passwords using any mode (syllables, passphrase, leet)

#### 2. Export

1. Click **📤 Export** button (now shows advanced export modal)
2. Select desired export format
3. Read format description
4. Choose options (e.g., include metadata)
5. Click **📥 Download Export**
6. Save the file

#### 3. Import to Destination

Follow the destination password manager's import instructions.

### Format-Specific Export Instructions

#### KeePass CSV Export

**Output Format:**
```csv
"Account","Login Name","Password","Web Site","Comments"
"Password 1","","GeneratedPass1","","Generated by GenPwd Pro"
"Password 2","","GeneratedPass2","","Generated by GenPwd Pro"
```

**Import to KeePass:**
1. Open KeePass
2. File → Import → Generic CSV Importer
3. Map columns: Account=Title, Login Name=Username, etc.
4. Import

#### Bitwarden JSON Export

**Output Format:**
```json
{
  "encrypted": false,
  "folders": [],
  "items": [
    {
      "id": "1",
      "organizationId": null,
      "folderId": null,
      "type": 1,
      "name": "Password 1",
      "notes": "Generated by GenPwd Pro on 2025-01-14",
      "favorite": false,
      "login": {
        "username": null,
        "password": "GeneratedPass1",
        "totp": null,
        "uris": []
      }
    }
  ]
}
```

**Import to Bitwarden:**
1. Open Bitwarden (web vault or app)
2. Tools → Import Data
3. Select "Bitwarden (json)"
4. Choose file
5. Import

#### LastPass CSV Export

**Output Format:**
```csv
"url","username","password","extra","name","grouping","fav"
"","","GeneratedPass1","Generated by GenPwd Pro","Password 1","GenPwd Pro","0"
```

**Import to LastPass:**
1. Open LastPass
2. More Options → Advanced → Import
3. Select "LastPass" format
4. Choose file
5. Import

#### 1Password CSV Export

**Output Format:**
```csv
"Title","URL","Username","Password","Notes","Category"
"Password 1","","","GeneratedPass1","Generated by GenPwd Pro","Login"
```

**Import to 1Password:**
1. Open 1Password
2. File → Import
3. Select "CSV" format
4. Map fields if needed
5. Import

---

## Format Specifications

### Password Entry Data Model

```javascript
{
  title: String,        // Entry title/name
  username: String,     // Username/email
  password: String,     // Password (never sanitized)
  url: String,          // Website URL (validated for http/https)
  notes: String,        // Additional notes (sanitized)
  tags: Array<String>,  // Tags/categories
  metadata: Object,     // Additional metadata
  folder: String,       // Folder/group name
  createdAt: Date,      // Creation timestamp
  modifiedAt: Date      // Last modification timestamp
}
```

### Field Validation Rules

| Field | Max Length | Validation | Sanitization |
|-------|-----------|------------|--------------|
| title | 10,000 | Required | Yes (XSS prevention) |
| username | 10,000 | Optional | Yes (XSS prevention) |
| password | Unlimited | Required | **No** (preserve special chars) |
| url | N/A | URL format | Yes (protocol check) |
| notes | 10,000 | Optional | Yes (XSS prevention) |
| tags | 50 per tag | Optional | Yes (per tag) |
| folder | 10,000 | Optional | Yes (XSS prevention) |

### CSV Format Details

**Delimiter:** Comma (`,`)
**Quote Character:** Double quote (`"`)
**Escape Sequence:** Double double-quotes (`""`)
**Line Ending:** CRLF (`\r\n`) or LF (`\n`)

**Example with Special Characters:**
```csv
"Title","Description"
"Test, Inc.","Description with ""quotes"" and commas"
```

### JSON Format Details

**Encoding:** UTF-8
**Pretty Print:** 2-space indentation
**Date Format:** ISO 8601 (e.g., `2025-01-14T10:30:00.000Z`)

---

## Security Considerations

### Import Security

#### 1. Input Validation

All imported data undergoes strict validation:

```javascript
// XSS Prevention
sanitize(str):
  - Remove <script> tags
  - Remove javascript: protocol
  - Remove event handlers (onclick, onerror, etc.)
  - Limit string length (10,000 chars)

// URL Validation
validateUrl(url):
  - Only allow http:// and https:// protocols
  - Reject javascript:, data:, file: protocols
  - Return empty string if invalid
```

#### 2. Password Handling

**Passwords are NEVER sanitized** to preserve:
- Special characters
- Unicode characters
- Whitespace
- Case sensitivity

#### 3. File Size Limits

- Maximum file size: **10 MB**
- Maximum entries per file: **100,000**
- Maximum field length: **10,000 characters**

### Export Security

#### 1. Data Privacy

- Exported files contain **plain-text passwords**
- Store export files securely
- Delete exports after importing to destination
- Use encrypted storage for export files

#### 2. Metadata

Exported files may include:
- Generation timestamp
- Source application (GenPwd Pro)
- Entry count

#### 3. Recommendations

✅ **DO:**
- Use HTTPS for file transfers
- Encrypt export files (ZIP with password, GPG, etc.)
- Delete exports after use
- Verify data before importing

❌ **DON'T:**
- Share exports via unencrypted email
- Store exports in cloud storage without encryption
- Leave exports in Downloads folder
- Commit exports to version control

---

## Troubleshooting

### Import Issues

#### "Import failed: Invalid format"

**Cause:** File format doesn't match selected import format

**Solution:**
1. Verify file extension matches format (.xml for XML, .json for JSON, .csv for CSV)
2. Open file in text editor to check format
3. Try different format option
4. Check for BOM (Byte Order Mark) - remove if present

#### "Found 0 entries"

**Cause:** File is empty or headers don't match

**Solution:**
1. Check CSV headers match expected format
2. Verify JSON structure has "items" or "entries" array
3. Ensure file isn't corrupted
4. Check for hidden characters or encoding issues

#### "Import failed: Parse error"

**Cause:** Malformed JSON or XML

**Solution:**
1. Validate JSON: Use JSONLint.com
2. Validate XML: Use xmlvalidation.com
3. Check for unescaped quotes in CSV
4. Verify file encoding is UTF-8

#### Passwords not importing correctly

**Cause:** CSV quoting issues or encoding problems

**Solution:**
1. Ensure passwords with commas are quoted
2. Double-check CSV escape sequences
3. Verify file is UTF-8 encoded
4. Try generic JSON format instead

### Export Issues

#### "No passwords to export"

**Cause:** No passwords generated yet

**Solution:**
1. Generate passwords first
2. Ensure results panel has entries
3. Refresh page if needed

#### Export file is empty

**Cause:** Format mismatch or browser blocking download

**Solution:**
1. Check browser's download settings
2. Try different export format
3. Check browser console for errors
4. Ensure popup blocker isn't blocking download

#### Exported passwords don't work in destination

**Cause:** Field mapping mismatch

**Solution:**
1. Verify format compatibility with destination
2. Use generic JSON format as intermediate
3. Manually adjust CSV headers to match destination
4. Check destination's import documentation

---

## API Reference

### ImportExportService

#### Constructor

```javascript
import importExportService from './services/import-export-service.js';
```

#### Methods

##### `import(content, format)`

Import passwords from file content.

**Parameters:**
- `content` (string): File content
- `format` (string): Import format

**Returns:** `Array<PasswordEntry>`

**Example:**
```javascript
const content = await file.text();
const entries = importExportService.import(content, 'bitwarden-json');
```

##### `export(entries, format)`

Export passwords to specified format.

**Parameters:**
- `entries` (Array<PasswordEntry>): Password entries
- `format` (string): Export format

**Returns:** `string` - Exported content

**Example:**
```javascript
const entries = [{
  title: 'My Account',
  username: 'user@example.com',
  password: 'SecurePass123',
  url: 'https://example.com'
}];

const csv = importExportService.export(entries, 'keepass-csv');
```

##### `getFormatInfo(format)`

Get format metadata.

**Parameters:**
- `format` (string): Format identifier

**Returns:** `Object` - Format information

**Example:**
```javascript
const info = importExportService.getFormatInfo('keepass-csv');
// { name: 'KeePass CSV', extension: '.csv', type: 'both' }
```

### Format Identifiers

| Identifier | Name | Type |
|------------|------|------|
| `keepass-xml` | KeePass XML | Import only |
| `keepass-csv` | KeePass CSV | Both |
| `bitwarden-json` | Bitwarden JSON | Both |
| `lastpass-csv` | LastPass CSV | Both |
| `1password-csv` | 1Password CSV | Both |
| `generic-json` | Generic JSON | Both |
| `generic-csv` | Generic CSV | Both |

---

## Best Practices

### For Users

1. **Always backup** before importing
2. **Verify imported data** by spot-checking entries
3. **Delete export files** after successful import
4. **Use encrypted storage** for sensitive exports
5. **Test with small datasets** first

### For Developers

1. **Validate all input** before processing
2. **Handle errors gracefully** with user-friendly messages
3. **Sanitize everything except passwords**
4. **Test with real export files** from each password manager
5. **Document field mappings** clearly

---

## Migration Examples

### Example 1: LastPass → GenPwd Pro

1. LastPass: Export to CSV
2. GenPwd Pro: Import → LastPass CSV
3. Verify entries
4. Generate additional passwords if needed
5. Export to desired format

### Example 2: KeePass → Bitwarden

1. KeePass: Export to XML or CSV
2. GenPwd Pro: Import → KeePass XML/CSV
3. GenPwd Pro: Export → Bitwarden JSON
4. Bitwarden: Import JSON file

### Example 3: 1Password → KeePass

1. 1Password: Export to CSV
2. GenPwd Pro: Import → 1Password CSV
3. GenPwd Pro: Export → KeePass CSV
4. KeePass: Import CSV

---

## Supported Character Sets

### Passwords

- **Fully preserved:** All UTF-8 characters
- **No sanitization:** Ensures password integrity
- **Length:** Unlimited

### Other Fields

- **Allowed:** UTF-8 printable characters
- **Filtered:** `<`, `>`, `javascript:`, event handlers
- **Length:** Up to 10,000 characters per field

---

## Appendix

### File Format Detection

GenPwd Pro automatically detects format based on:
1. User selection (primary)
2. File extension (secondary)
3. Content analysis (fallback)

### Compatibility Matrix

| Source | → | Destination | Status | Notes |
|--------|---|-------------|--------|-------|
| LastPass | → | Bitwarden | ✅ Full | All fields preserved |
| KeePass | → | 1Password | ✅ Full | XML recommended |
| Bitwarden | → | LastPass | ✅ Full | JSON → CSV |
| 1Password | → | KeePass | ✅ Full | CSV → CSV/XML |
| Any | → | Generic JSON | ✅ Full | Universal backup |

### Known Limitations

1. **1Password 1PIF:** Not supported (use CSV export)
2. **KeePass KDBX:** Not supported (export to XML/CSV first)
3. **Bitwarden Encrypted:** Only unencrypted exports supported
4. **Custom Fields:** May not transfer between all formats

---

## Support

### Documentation
- **This Guide:** Complete import/export reference
- **Plugin Development:** `docs/PLUGIN_DEVELOPMENT.md`
- **API Docs:** See source code JSDoc comments

### Community
- **GitHub Issues:** https://github.com/VBlackJack/genpwd-pro/issues
- **Tag:** `import-export` for related issues

---

**Last Updated:** January 14, 2025
**Version:** 2.6.0
**Maintained by:** GenPwd Pro Team
