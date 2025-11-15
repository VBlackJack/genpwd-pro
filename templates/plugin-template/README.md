# GenPwd Pro Plugin Template

This template provides a starting point for creating your own GenPwd Pro plugins.

## Quick Start

1. **Copy the template:**
   ```bash
   cp -r templates/plugin-template my-custom-plugin
   cd my-custom-plugin
   ```

2. **Customize plugin-template.js:**
   - Replace `MyPlugin` with your plugin name
   - Update the `name`, `author`, and `description` fields
   - Implement the hooks you need
   - Remove unused hooks

3. **Test your plugin:**
   - Load your plugin in GenPwd Pro via the Plugin Manager
   - Use "Install from File" to load your `.js` file
   - Or use "Load Demo Plugins" to see examples

4. **Deploy:**
   - Share your `.js` file with users
   - Submit to the GenPwd Pro plugin repository (coming soon!)

## Plugin Structure

```javascript
const MyPlugin = {
  // REQUIRED FIELDS
  name: 'my-plugin',           // Unique identifier
  version: '1.0.0',            // Semantic versioning
  author: 'Your Name',         // Author name
  description: 'Description',  // Brief description

  // OPTIONAL CONFIGURATION
  config: {
    // Your settings
  },

  // REQUIRED LIFECYCLE
  lifecycle: {
    onLoad() { },   // Called when plugin loads
    onUnload() { }  // Called when plugin unloads
  },

  // OPTIONAL HOOKS
  hooks: {
    onGenerate(config) { },          // Custom password generation
    onExport(passwords, options) { }, // Custom export format
    onImport(data, options) { },      // Custom import parser
    onPasswordValidate(password) { }, // Custom validation
    onPasswordStrength(password) { }, // Custom strength calculation
    onUIRender(container) { }         // Custom settings UI
  }
};
```

## Available Hooks

### onGenerate(config)
Called during password generation. Return a generated password or `null` to skip.

**Parameters:**
- `config.length` - Desired password length
- `config.mode` - Generation mode (syllables, passphrase, leet)
- `config.options` - Additional options

**Returns:** `string` or `null`

**Example:**
```javascript
onGenerate(config) {
  if (config.mode === 'syllables') {
    return generateCustomPassword(config.length);
  }
  return null;
}
```

### onExport(passwords, options)
Called when exporting passwords. Return exported data or `null` to skip.

**Parameters:**
- `passwords` - Array of password objects
- `options.format` - Requested format

**Returns:** `string` or `null`

**Example:**
```javascript
onExport(passwords, options) {
  if (options.format === 'xml') {
    return convertToXML(passwords);
  }
  return null;
}
```

### onImport(data, options)
Called when importing passwords. Return array of password objects or `null` to skip.

**Parameters:**
- `data` - File content as string
- `options.format` - Requested format

**Returns:** `Array` or `null`

**Example:**
```javascript
onImport(data, options) {
  if (options.format === 'xml') {
    return parseXMLToPasswords(data);
  }
  return null;
}
```

### onPasswordValidate(password)
Called to validate passwords. Return validation result or `null` to skip.

**Parameters:**
- `password` - Password string

**Returns:** `Object` or `null`
- `valid` - Boolean indicating if valid
- `message` - Validation message
- `errors` - Array of error strings

**Example:**
```javascript
onPasswordValidate(password) {
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(password);
  return {
    valid: hasEmoji,
    message: hasEmoji ? 'Valid!' : 'Must contain emoji',
    errors: hasEmoji ? [] : ['No emoji found']
  };
}
```

### onPasswordStrength(password)
Called to calculate password strength. Return strength metrics or `null` to skip.

**Parameters:**
- `password` - Password string

**Returns:** `Object` or `null`
- `entropy` - Entropy in bits
- `strength` - Strength level (weak, medium, strong)
- `message` - Human-readable message

**Example:**
```javascript
onPasswordStrength(password) {
  const entropy = calculateEntropy(password);
  return {
    entropy: entropy,
    strength: entropy > 80 ? 'strong' : 'medium',
    message: `${entropy} bits of entropy`
  };
}
```

### onUIRender(container)
Called to render custom settings UI. Manipulate the provided container element.

**Parameters:**
- `container` - HTMLElement to render into

**Returns:** `void`

**Example:**
```javascript
onUIRender(container) {
  container.innerHTML = `
    <div class="plugin-settings">
      <h4>My Settings</h4>
      <input type="checkbox" id="my-setting">
    </div>
  `;

  // Bind events
  container.querySelector('#my-setting').addEventListener('change', (e) => {
    this.config.mySetting = e.target.checked;
  });
}
```

## Security Guidelines

### DO's
- ✅ Validate all inputs
- ✅ Use whitelisting for allowed values
- ✅ Sanitize user input
- ✅ Handle errors gracefully
- ✅ Test thoroughly before sharing

### DON'Ts
- ❌ Use `eval()` or `Function()` constructor
- ❌ Access sensitive browser APIs without user consent
- ❌ Make network requests without disclosure
- ❌ Modify global scope
- ❌ Include malicious code

## Best Practices

1. **Keep it simple:** Focus on one feature
2. **Document well:** Add clear comments
3. **Handle errors:** Use try-catch blocks
4. **Test edge cases:** Empty inputs, large inputs, special characters
5. **Follow conventions:** Match GenPwd Pro's code style
6. **Optimize performance:** Don't block the UI thread

## Example Plugins

See these example plugins for inspiration:
- `src/plugins/emoji-generator-plugin.js` - Custom password generator
- `src/plugins/xml-export-plugin.js` - Custom export format

## Publishing Your Plugin

### Checklist
- [ ] Plugin name is unique
- [ ] Version follows semantic versioning
- [ ] All required fields are filled
- [ ] Code is well-commented
- [ ] Security guidelines followed
- [ ] Tested in GenPwd Pro
- [ ] README.md included
- [ ] LICENSE included (use Apache 2.0 for compatibility)

### Sharing
1. Create a GitHub repository for your plugin
2. Add README with installation instructions
3. Tag releases with version numbers
4. Share on GenPwd Pro community forums
5. Submit to plugin directory (coming soon)

## Support

- Documentation: `docs/PLUGIN_DEVELOPMENT.md`
- Examples: `src/plugins/`
- Issues: https://github.com/VBlackJack/genpwd-pro/issues
- Community: [Coming soon]

## License

Plugins should use Apache License 2.0 for compatibility with GenPwd Pro.

## Version History

- 1.0.0 (2025-01-14): Initial template release
