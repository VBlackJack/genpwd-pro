# GenPwd Pro Plugin Development Guide

**Version:** 2.6.0
**Last Updated:** January 14, 2025
**Author:** GenPwd Pro Team

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Getting Started](#getting-started)
4. [Plugin API Reference](#plugin-api-reference)
5. [Available Hooks](#available-hooks)
6. [Security Guidelines](#security-guidelines)
7. [Best Practices](#best-practices)
8. [Testing Your Plugin](#testing-your-plugin)
9. [Publishing and Distribution](#publishing-and-distribution)
10. [Troubleshooting](#troubleshooting)
11. [Examples](#examples)

---

## Introduction

GenPwd Pro's plugin system allows developers to extend the password generator with custom functionality. Plugins can:

- Add custom password generation algorithms
- Support additional import/export formats
- Implement custom validation rules
- Calculate custom strength metrics
- Provide custom UI components

### Why Plugins?

Plugins enable:
- **Extensibility:** Add features without modifying core code
- **Customization:** Tailor GenPwd Pro to specific use cases
- **Community:** Share solutions with other users
- **Modularity:** Keep features isolated and maintainable

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────┐
│         GenPwd Pro Core                  │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │      Plugin Manager                 │ │
│  │  - Registration                     │ │
│  │  - Validation                       │ │
│  │  - Lifecycle Management             │ │
│  │  - Hook Execution                   │ │
│  └────────────────────────────────────┘ │
│           ↓           ↓           ↓      │
│      Plugin 1    Plugin 2    Plugin 3   │
└─────────────────────────────────────────┘
```

### Plugin Lifecycle

1. **Registration:** Plugin is loaded and validated
2. **Initialization:** `lifecycle.onLoad()` is called
3. **Hook Registration:** Hooks are registered with PluginManager
4. **Execution:** Hooks are called during relevant operations
5. **Cleanup:** `lifecycle.onUnload()` is called on removal

### Security Model

GenPwd Pro implements multiple security layers:

1. **Input Validation:** All plugin metadata is validated
2. **Code Scanning:** Dangerous patterns are detected
3. **Size Limits:** Plugins are limited to 100KB
4. **Error Isolation:** Plugin errors don't crash the app
5. **Sandboxing:** Plugins run with limited permissions

---

## Getting Started

### Prerequisites

- Basic JavaScript knowledge
- Understanding of ES6 modules
- Familiarity with GenPwd Pro functionality

### Creating Your First Plugin

#### Step 1: Use the Template

```bash
cp -r templates/plugin-template my-first-plugin
cd my-first-plugin
```

#### Step 2: Define Plugin Metadata

```javascript
const MyPlugin = {
  name: 'my-first-plugin',
  version: '1.0.0',
  author: 'Your Name',
  description: 'My first GenPwd Pro plugin',

  lifecycle: {
    onLoad() {
      console.log('Plugin loaded!');
    },
    onUnload() {
      console.log('Plugin unloaded!');
    }
  },

  hooks: {
    // Your hooks here
  }
};

export default MyPlugin;
```

#### Step 3: Implement Hooks

```javascript
hooks: {
  onGenerate(config) {
    if (config.mode === 'syllables') {
      return 'CustomPassword123!';
    }
    return null;
  }
}
```

#### Step 4: Test Your Plugin

1. Open GenPwd Pro
2. Go to Settings → Plugins
3. Click "Install from File"
4. Select your `my-first-plugin.js` file
5. Enable the plugin
6. Test functionality

---

## Plugin API Reference

### Required Fields

#### `name` (string)
- **Required:** Yes
- **Format:** Alphanumeric, dashes, underscores only
- **Length:** 1-50 characters
- **Example:** `'emoji-generator'`

#### `version` (string)
- **Required:** Yes
- **Format:** Semantic versioning (MAJOR.MINOR.PATCH)
- **Example:** `'1.2.3'`

#### `author` (string)
- **Required:** Yes
- **Format:** Any string
- **Length:** 1-100 characters
- **Example:** `'John Doe'`

#### `description` (string)
- **Required:** Yes
- **Format:** Plain text
- **Length:** 1-200 characters
- **Example:** `'Generates passwords with emojis'`

#### `lifecycle` (object)
- **Required:** Yes
- **Properties:**
  - `onLoad` (function): Called when plugin loads
  - `onUnload` (function): Called when plugin unloads

### Optional Fields

#### `config` (object)
- **Required:** No
- **Purpose:** Store plugin configuration
- **Example:**
  ```javascript
  config: {
    enabled: true,
    emojiFrequency: 3,
    customSettings: { }
  }
  ```

#### `hooks` (object)
- **Required:** No (but recommended)
- **Properties:** See [Available Hooks](#available-hooks)

#### `enabled` (boolean)
- **Required:** No
- **Default:** `true`
- **Purpose:** Initial enabled state

---

## Available Hooks

### 1. onGenerate

**Purpose:** Custom password generation

**Signature:**
```javascript
onGenerate(config: Object): string | null
```

**Parameters:**
- `config.length` (number): Desired password length
- `config.mode` (string): Generation mode ('syllables', 'passphrase', 'leet')
- `config.options` (object): Additional options

**Returns:**
- `string`: Generated password
- `null`: Skip this plugin

**Example:**
```javascript
onGenerate(config) {
  if (config.mode !== 'syllables') {
    return null; // Only handle syllables mode
  }

  let password = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';

  for (let i = 0; i < config.length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  return password;
}
```

### 2. onExport

**Purpose:** Custom export format

**Signature:**
```javascript
onExport(passwords: Array, options: Object): string | null
```

**Parameters:**
- `passwords` (Array): Array of password objects
  - `password.password` (string): The password
  - `password.metadata` (object): Metadata (length, entropy, mode, etc.)
- `options.format` (string): Requested format

**Returns:**
- `string`: Exported data
- `null`: Skip this plugin

**Example:**
```javascript
onExport(passwords, options) {
  if (options.format !== 'csv') {
    return null;
  }

  let csv = 'Password,Length,Entropy\n';
  passwords.forEach(pwd => {
    csv += `"${pwd.password}",${pwd.metadata.length},${pwd.metadata.entropy}\n`;
  });

  return csv;
}
```

### 3. onImport

**Purpose:** Custom import parser

**Signature:**
```javascript
onImport(data: string, options: Object): Array | null
```

**Parameters:**
- `data` (string): File content
- `options.format` (string): Requested format

**Returns:**
- `Array`: Array of password objects
- `null`: Skip this plugin

**Example:**
```javascript
onImport(data, options) {
  if (options.format !== 'csv') {
    return null;
  }

  const lines = data.split('\n').slice(1); // Skip header
  const passwords = [];

  lines.forEach(line => {
    const [password, length, entropy] = line.split(',');
    if (password) {
      passwords.push({
        password: password.replace(/"/g, ''),
        metadata: {
          length: parseInt(length),
          entropy: parseFloat(entropy),
          imported: true
        }
      });
    }
  });

  return passwords;
}
```

### 4. onPasswordValidate

**Purpose:** Custom password validation

**Signature:**
```javascript
onPasswordValidate(password: string): Object | null
```

**Parameters:**
- `password` (string): Password to validate

**Returns:**
- `Object`:
  - `valid` (boolean): Is password valid?
  - `message` (string): Validation message
  - `errors` (Array): Array of error strings
- `null`: Skip this plugin

**Example:**
```javascript
onPasswordValidate(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }

  return {
    valid: errors.length === 0,
    message: errors.length === 0 ? 'Password is valid' : 'Validation failed',
    errors: errors
  };
}
```

### 5. onPasswordStrength

**Purpose:** Custom strength calculation

**Signature:**
```javascript
onPasswordStrength(password: string): Object | null
```

**Parameters:**
- `password` (string): Password to analyze

**Returns:**
- `Object`:
  - `entropy` (number): Entropy in bits
  - `strength` (string): Strength level ('weak', 'medium', 'strong')
  - `message` (string): Human-readable message
- `null`: Skip this plugin

**Example:**
```javascript
onPasswordStrength(password) {
  let charsetSize = 0;

  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[!@#$%^&*]/.test(password)) charsetSize += 8;

  const entropy = password.length * Math.log2(charsetSize);

  return {
    entropy: entropy,
    strength: entropy > 80 ? 'strong' : entropy > 50 ? 'medium' : 'weak',
    message: `${entropy.toFixed(1)} bits of entropy`
  };
}
```

### 6. onUIRender

**Purpose:** Custom settings UI

**Signature:**
```javascript
onUIRender(container: HTMLElement): void
```

**Parameters:**
- `container` (HTMLElement): Container to render into

**Returns:** void

**Example:**
```javascript
onUIRender(container) {
  container.innerHTML = `
    <div class="plugin-settings">
      <h4>My Plugin Settings</h4>
      <div class="setting-row">
        <label>
          <input type="checkbox" id="my-setting" ${this.config.enabled ? 'checked' : ''}>
          Enable Feature
        </label>
      </div>
      <div class="setting-row">
        <label for="my-value">Value:</label>
        <input type="number" id="my-value" value="${this.config.value || 0}">
      </div>
      <div class="setting-row">
        <button id="my-test-btn" class="btn-mini">Test</button>
      </div>
    </div>
  `;

  // Bind events
  const checkbox = container.querySelector('#my-setting');
  checkbox?.addEventListener('change', (e) => {
    this.config.enabled = e.target.checked;
    localStorage.setItem('my-plugin-config', JSON.stringify(this.config));
  });

  const valueInput = container.querySelector('#my-value');
  valueInput?.addEventListener('change', (e) => {
    this.config.value = parseInt(e.target.value);
    localStorage.setItem('my-plugin-config', JSON.stringify(this.config));
  });

  const testBtn = container.querySelector('#my-test-btn');
  testBtn?.addEventListener('click', () => {
    alert(`Testing with value: ${this.config.value}`);
  });
}
```

---

## Security Guidelines

### Allowed Practices

✅ **DO:**
- Validate all inputs
- Use strict typing
- Handle errors gracefully
- Use whitelisting for allowed values
- Sanitize user input (escape HTML, SQL, etc.)
- Test thoroughly
- Document security considerations
- Follow principle of least privilege

### Forbidden Practices

❌ **DON'T:**
- Use `eval()` or `Function()` constructor
- Use `setTimeout()` or `setInterval()` with string arguments
- Include `<script>` tags in generated HTML
- Use `document.write()`
- Modify `window.location` without user consent
- Access localStorage/sessionStorage without disclosure
- Make network requests without user knowledge
- Include obfuscated code
- Use dangerous patterns that could execute arbitrary code

### Security Checklist

Before publishing your plugin:

- [ ] No use of `eval()` or similar dynamic code execution
- [ ] All user inputs are validated and sanitized
- [ ] No network requests (or clearly disclosed)
- [ ] No access to sensitive data without permission
- [ ] Error handling prevents information leakage
- [ ] Code is readable and non-obfuscated
- [ ] Dependencies are minimal and trusted
- [ ] Security implications are documented

---

## Best Practices

### Code Organization

```javascript
const MyPlugin = {
  // 1. Metadata first
  name: 'my-plugin',
  version: '1.0.0',
  author: 'Author',
  description: 'Description',

  // 2. Configuration
  config: { },

  // 3. Lifecycle
  lifecycle: {
    onLoad() { },
    onUnload() { }
  },

  // 4. Hooks
  hooks: { },

  // 5. Private utilities
  _internal: {
    helper1() { },
    helper2() { }
  }
};
```

### Error Handling

```javascript
onGenerate(config) {
  try {
    // Your logic here
    return generatePassword(config);
  } catch (error) {
    console.error('[My Plugin] Generation error:', error);
    return null; // Graceful fallback
  }
}
```

### Performance

- Keep hooks fast (< 100ms)
- Avoid blocking operations
- Cache expensive calculations
- Clean up resources in `onUnload()`

### Documentation

```javascript
/**
 * Generate a custom password with special rules
 *
 * Rules:
 * 1. Must start with uppercase
 * 2. Must contain at least 2 numbers
 * 3. Must end with special character
 *
 * @param {Object} config - Configuration object
 * @param {number} config.length - Password length
 * @returns {string|null} Generated password or null
 */
onGenerate(config) {
  // Implementation
}
```

### Versioning

Follow Semantic Versioning (SemVer):
- **MAJOR:** Incompatible API changes
- **MINOR:** Backwards-compatible functionality
- **PATCH:** Backwards-compatible bug fixes

Example: `1.2.3`
- 1 = Major version
- 2 = Minor version
- 3 = Patch version

---

## Testing Your Plugin

### Manual Testing

1. **Load Plugin:**
   - Install via "Install from File"
   - Verify it appears in Plugin Manager
   - Check enabled status

2. **Test Hooks:**
   - Generate passwords (test `onGenerate`)
   - Export data (test `onExport`)
   - Import data (test `onImport`)
   - Validate passwords (test `onPasswordValidate`)
   - Check strength (test `onPasswordStrength`)
   - Open settings (test `onUIRender`)

3. **Test Error Cases:**
   - Invalid inputs
   - Missing configuration
   - Edge cases (empty, very long, special characters)

4. **Test Performance:**
   - Generate many passwords (100+)
   - Measure execution time
   - Check for memory leaks

### Automated Testing

Create a test file (`my-plugin.test.js`):

```javascript
import MyPlugin from './my-plugin.js';

// Test plugin metadata
console.assert(MyPlugin.name === 'my-plugin', 'Name is correct');
console.assert(MyPlugin.version.match(/^\d+\.\d+\.\d+$/), 'Version follows SemVer');

// Test hooks
const password = MyPlugin.hooks.onGenerate({ length: 16, mode: 'syllables' });
console.assert(password && password.length >= 16, 'Password generated with correct length');

const strength = MyPlugin.hooks.onPasswordStrength(password);
console.assert(strength && strength.entropy > 0, 'Strength calculation works');

console.log('All tests passed!');
```

### Browser Console Testing

```javascript
// In browser console
const pm = window.genpwdPluginManager;

// Test registration
pm.registerPlugin(MyPlugin);

// Test hook execution
pm.callHook('onGenerate', { length: 16, mode: 'syllables' });

// Check stats
console.log(pm.getStats());
```

---

## Publishing and Distribution

### Preparation

1. **Clean Code:**
   - Remove debug statements
   - Format code consistently
   - Add proper comments

2. **Documentation:**
   - Create README.md
   - Add usage examples
   - Document configuration options

3. **License:**
   - Add LICENSE file (recommend Apache 2.0)
   - Include copyright notice

4. **Version:**
   - Tag release with version number
   - Update CHANGELOG

### Distribution Channels

#### 1. GitHub

```bash
# Create repository
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/genpwd-my-plugin.git
git push -u origin main

# Tag version
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

#### 2. npm (Optional)

```bash
npm init
npm publish
```

#### 3. Direct Distribution

Share the `.js` file directly with users.

### Plugin Directory

(Coming soon: Official GenPwd Pro plugin directory)

---

## Troubleshooting

### Plugin Not Loading

**Problem:** Plugin doesn't appear after installation

**Solutions:**
1. Check browser console for errors
2. Verify plugin format matches template
3. Ensure all required fields are present
4. Check for syntax errors in code

### Hook Not Called

**Problem:** Hook implementation doesn't execute

**Solutions:**
1. Verify hook name is spelled correctly
2. Check if plugin is enabled
3. Ensure hook returns proper value (not `undefined`)
4. Test with `console.log()` statements

### Validation Errors

**Problem:** Plugin fails validation

**Solutions:**
- **"Plugin must have a valid name":** Check `name` field exists and is a string
- **"Unknown hook":** Verify hook name matches allowed hooks
- **"Version must follow semantic versioning":** Use format `1.0.0`
- **"Plugin name must contain only alphanumeric...":** Use only letters, numbers, dashes, underscores

### Performance Issues

**Problem:** Plugin slows down GenPwd Pro

**Solutions:**
1. Profile hook execution time
2. Cache expensive calculations
3. Avoid synchronous blocking operations
4. Optimize algorithms

---

## Examples

### Example 1: ROT13 Password Transformer

```javascript
const ROT13Plugin = {
  name: 'rot13-transformer',
  version: '1.0.0',
  author: 'Example Author',
  description: 'Transforms passwords using ROT13 cipher',

  lifecycle: {
    onLoad() {
      console.log('[ROT13] Loaded');
    },
    onUnload() {
      console.log('[ROT13] Unloaded');
    }
  },

  hooks: {
    onGenerate(config) {
      // Generate normal password first
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';

      for (let i = 0; i < config.length; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
      }

      // Apply ROT13
      return password.replace(/[a-zA-Z]/g, (char) => {
        const start = char <= 'Z' ? 65 : 97;
        return String.fromCharCode((char.charCodeAt(0) - start + 13) % 26 + start);
      });
    }
  }
};

export default ROT13Plugin;
```

### Example 2: Minimum Entropy Validator

```javascript
const EntropyValidatorPlugin = {
  name: 'entropy-validator',
  version: '1.0.0',
  author: 'Example Author',
  description: 'Validates passwords meet minimum entropy requirement',

  config: {
    minimumEntropy: 60
  },

  lifecycle: {
    onLoad() {
      const saved = localStorage.getItem('entropy-validator-config');
      if (saved) {
        this.config = JSON.parse(saved);
      }
    },
    onUnload() {
      localStorage.setItem('entropy-validator-config', JSON.stringify(this.config));
    }
  },

  hooks: {
    onPasswordStrength(password) {
      let charsetSize = 0;
      if (/[a-z]/.test(password)) charsetSize += 26;
      if (/[A-Z]/.test(password)) charsetSize += 26;
      if (/[0-9]/.test(password)) charsetSize += 10;
      if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

      const entropy = password.length * Math.log2(charsetSize);

      return {
        entropy: entropy,
        strength: entropy >= this.config.minimumEntropy ? 'strong' : 'weak',
        message: `Entropy: ${entropy.toFixed(1)} bits (min: ${this.config.minimumEntropy})`
      };
    },

    onUIRender(container) {
      container.innerHTML = `
        <div class="plugin-settings">
          <h4>Entropy Validator Settings</h4>
          <div class="setting-row">
            <label for="min-entropy">Minimum Entropy (bits):</label>
            <input type="number" id="min-entropy" value="${this.config.minimumEntropy}" min="0" max="200">
          </div>
        </div>
      `;

      container.querySelector('#min-entropy').addEventListener('change', (e) => {
        this.config.minimumEntropy = parseInt(e.target.value);
        localStorage.setItem('entropy-validator-config', JSON.stringify(this.config));
      });
    }
  }
};

export default EntropyValidatorPlugin;
```

### Example 3: JSON Export Plugin

```javascript
const JSONExportPlugin = {
  name: 'json-export',
  version: '1.0.0',
  author: 'Example Author',
  description: 'Export passwords as formatted JSON',

  config: {
    indent: 2,
    includeMetadata: true
  },

  lifecycle: {
    onLoad() { },
    onUnload() { }
  },

  hooks: {
    onExport(passwords, options) {
      if (options.format !== 'json') {
        return null;
      }

      const data = {
        version: '1.0',
        exported: new Date().toISOString(),
        count: passwords.length,
        passwords: passwords.map(pwd => ({
          password: pwd.password || pwd,
          ...(this.config.includeMetadata && pwd.metadata ? { metadata: pwd.metadata } : {})
        }))
      };

      return JSON.stringify(data, null, this.config.indent);
    },

    onImport(data, options) {
      if (options.format !== 'json') {
        return null;
      }

      try {
        const parsed = JSON.parse(data);
        return parsed.passwords || [];
      } catch (error) {
        console.error('[JSON Export] Parse error:', error);
        return null;
      }
    }
  }
};

export default JSONExportPlugin;
```

---

## API Version Compatibility

| API Version | GenPwd Pro Version | Notes |
|-------------|-------------------|-------|
| 1.0         | 2.6.0+           | Initial plugin API |

---

## Support and Resources

### Documentation
- **This Guide:** Complete plugin development reference
- **Template:** `templates/plugin-template/`
- **Examples:** `src/plugins/`

### Community
- **GitHub Issues:** https://github.com/VBlackJack/genpwd-pro/issues
- **Discussions:** (Coming soon)
- **Plugin Directory:** (Coming soon)

### Contact
For questions or support:
- Open an issue on GitHub
- Tag issues with `plugin-development`

---

## Appendix

### Hook Execution Order

When multiple plugins implement the same hook:
1. Hooks execute in registration order
2. First successful result is used (if applicable)
3. Errors are isolated per plugin

### Plugin File Structure

```
my-plugin/
├── my-plugin.js        # Main plugin file
├── README.md           # Documentation
├── LICENSE             # License file
├── CHANGELOG.md        # Version history
└── examples/           # Usage examples
    └── example.html
```

### Reserved Plugin Names

The following names are reserved:
- `core`
- `system`
- `genpwd`
- `admin`
- `test`

### Character Set Reference

```javascript
const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  safe: '!@#%_+-=.,:;?',  // CLI-safe symbols
};
```

---

**End of Documentation**

For updates and latest information, visit:
https://github.com/VBlackJack/genpwd-pro
