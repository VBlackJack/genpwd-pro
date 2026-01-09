# Accessibility Guide - GenPwd Pro

## Overview

This document tracks accessibility compliance efforts for GenPwd Pro v3.0.1, targeting WCAG 2.1 Level AA conformance to ensure the application is usable by everyone, including people with disabilities.

## Accessibility Goals

### Target: WCAG 2.1 Level AAA

| Standard | Level | Target | Status |
|----------|-------|--------|--------|
| **WCAG 2.1** | AAA | 0 violations | 📋 To audit |
| **axe-core violations** | Critical | 0 | 📋 To audit |
| **Lighthouse Accessibility** | Score | ≥95 | 📋 To audit |
| **Keyboard Navigation** | Full support | 100% | 📋 To test |
| **Screen Reader Support** | NVDA, JAWS, VoiceOver | Full | 📋 To test |
| **Color Contrast** | AAA Ratio | ≥7:1 | 📋 To verify |

## WCAG 2.1 Principles (POUR)

### 1. Perceivable
Information and UI components must be presentable to users in ways they can perceive.

### 2. Operable
UI components and navigation must be operable by all users.

### 3. Understandable
Information and UI operation must be understandable.

### 4. Robust
Content must be robust enough to be interpreted by various user agents and assistive technologies.

## Accessibility Features

### Current Implementation

✅ **Implemented:**
- Semantic HTML structure
- Multiple theme options (including high contrast)
- Keyboard-accessible form controls
- Focus indicators on interactive elements

⏳ **To Implement:**
- Comprehensive ARIA labels
- Skip navigation links
- Focus management in modals
- Screen reader announcements
- Enhanced keyboard shortcuts
- Error announcements

### Required Improvements

#### 1. ARIA Labels and Descriptions

**Current state:** Minimal ARIA attributes
**Target:** Complete ARIA labeling for all interactive elements

```html
<!-- Before -->
<button class="generate-btn">Generate</button>
<input type="number" id="length">

<!-- After -->
<button
  class="generate-btn"
  aria-label="Generate secure password"
  aria-describedby="generate-help">
  Generate
</button>
<span id="generate-help" class="sr-only">
  Creates a new password based on your current settings
</span>

<input
  type="number"
  id="length"
  aria-label="Password length"
  aria-describedby="length-help"
  aria-valuemin="8"
  aria-valuemax="128"
  aria-valuenow="20">
<span id="length-help" class="sr-only">
  Choose password length between 8 and 128 characters
</span>
```

#### 2. Skip Navigation Links

**Purpose:** Allow keyboard users to skip repetitive content

```html
<body>
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>
  <a href="#password-generator" class="skip-link">
    Skip to password generator
  </a>

  <!-- Header, navigation, etc. -->

  <main id="main-content">
    <div id="password-generator">
      <!-- Main content -->
    </div>
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
  text-decoration: none;
}

.skip-link:focus {
  top: 0;
}
```

#### 3. Focus Management

**Modal Focus Trap:**
```javascript
// src/js/ui/modal.js enhancement
class AccessibleModal {
  constructor(modalElement) {
    this.modal = modalElement;
    this.focusableElements = null;
    this.previousFocus = null;
  }

  open() {
    // Store currently focused element
    this.previousFocus = document.activeElement;

    // Get all focusable elements within modal
    this.focusableElements = this.modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Trap focus
    this.modal.addEventListener('keydown', this.trapFocus.bind(this));

    // Focus first element
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    // Announce modal opening
    this.announce('Dialog opened');
  }

  close() {
    // Remove focus trap
    this.modal.removeEventListener('keydown', this.trapFocus.bind(this));

    // Restore focus
    if (this.previousFocus) {
      this.previousFocus.focus();
    }

    // Announce modal closing
    this.announce('Dialog closed');
  }

  trapFocus(event) {
    if (event.key !== 'Tab') return;

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  announce(message) {
    const announcer = document.getElementById('aria-announcer');
    if (announcer) {
      announcer.textContent = message;
    }
  }
}
```

**ARIA Live Region for Announcements:**
```html
<!-- Add to index.html -->
<div
  id="aria-announcer"
  class="sr-only"
  aria-live="polite"
  aria-atomic="true"
  role="status">
</div>
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

#### 4. Keyboard Navigation

**Full Keyboard Support Matrix:**

| Action | Shortcut | Implemented |
|--------|----------|-------------|
| Generate password | `Alt+G` | ⏳ To implement |
| Copy password | `Alt+C` | ⏳ To implement |
| Regenerate | `Alt+R` | ⏳ To implement |
| Open settings | `Alt+S` | ⏳ To implement |
| Navigate controls | `Tab` / `Shift+Tab` | ✅ Native |
| Activate button | `Enter` / `Space` | ✅ Native |
| Close modal | `Escape` | ⏳ To enhance |

**Implementation:**
```javascript
// src/js/ui/keyboard-shortcuts.js
export class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map([
      ['Alt+KeyG', () => this.generatePassword()],
      ['Alt+KeyC', () => this.copyPassword()],
      ['Alt+KeyR', () => this.regeneratePassword()],
      ['Alt+KeyS', () => this.openSettings()],
    ]);

    document.addEventListener('keydown', this.handleShortcut.bind(this));
  }

  handleShortcut(event) {
    const key = `${event.altKey ? 'Alt+' : ''}${event.code}`;
    const action = this.shortcuts.get(key);

    if (action) {
      event.preventDefault();
      action();
      this.announce(`Shortcut ${key} activated`);
    }
  }

  announce(message) {
    const announcer = document.getElementById('aria-announcer');
    if (announcer) {
      announcer.textContent = message;
    }
  }
}
```

#### 5. Color Contrast Compliance

**WCAG AAA Requirements:**
- Normal text: ≥7:1 contrast ratio
- Large text (≥18pt or 14pt bold): ≥4.5:1 contrast ratio
- UI components: ≥3:1 contrast ratio

**Current Theme Analysis:**

| Theme | Background | Text | Ratio | Status |
|-------|-----------|------|-------|--------|
| Dark | #1a1a1a | #ffffff | 17.99:1 | ✅ AAA |
| Light | #ffffff | #000000 | 21:1 | ✅ AAA |
| High Contrast | #000000 | #ffffff | 21:1 | ✅ AAA |
| Ocean | #0a2540 | #e0f2ff | TBD | 📋 To verify |
| Forest | #1a3a2a | #e8f5e9 | TBD | 📋 To verify |

**Verification Tool:**
```javascript
// src/js/utils/contrast-checker.js
export function checkContrast(foreground, background) {
  const getLuminance = (color) => {
    // Convert hex to RGB
    const rgb = parseInt(color.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = (rgb >> 0) & 0xff;

    // Calculate relative luminance
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: ratio.toFixed(2),
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7,
    wcagAALarge: ratio >= 3,
    wcagAAALarge: ratio >= 4.5
  };
}
```

#### 6. Form Validation and Error Handling

**Accessible Error Messages:**
```html
<div class="form-group">
  <label for="password-length">
    Password Length
    <span aria-label="required" class="required">*</span>
  </label>

  <input
    type="number"
    id="password-length"
    aria-required="true"
    aria-invalid="false"
    aria-describedby="length-error length-help"
    min="8"
    max="128">

  <span id="length-help" class="help-text">
    Choose a length between 8 and 128 characters
  </span>

  <span
    id="length-error"
    class="error-message"
    role="alert"
    aria-live="assertive"
    style="display: none;">
  </span>
</div>
```

```javascript
// Error handling
function validatePasswordLength(value) {
  const input = document.getElementById('password-length');
  const error = document.getElementById('length-error');

  if (value < 8 || value > 128) {
    input.setAttribute('aria-invalid', 'true');
    error.textContent = `Password length must be between 8 and 128. You entered ${value}.`;
    error.style.display = 'block';
    return false;
  } else {
    input.setAttribute('aria-invalid', 'false');
    error.textContent = '';
    error.style.display = 'none';
    return true;
  }
}
```

#### 7. Screen Reader Optimization

**Dynamic Content Announcements:**
```javascript
// Announce password generation
function announcePasswordGeneration(password) {
  const announcer = document.getElementById('aria-announcer');
  const strength = calculateStrength(password);
  const length = password.length;

  announcer.textContent = `New password generated. Length: ${length} characters. Strength: ${strength}.`;
}

// Announce copy action
function announceCopy() {
  const announcer = document.getElementById('aria-announcer');
  announcer.textContent = 'Password copied to clipboard';
}

// Announce theme change
function announceThemeChange(themeName) {
  const announcer = document.getElementById('aria-announcer');
  announcer.textContent = `Theme changed to ${themeName}`;
}
```

**Progress Indicators:**
```html
<div
  role="progressbar"
  aria-valuenow="75"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-label="Password strength">
  <div class="progress-bar" style="width: 75%"></div>
</div>
```

## Testing Procedures

### 1. Automated Testing

#### axe-core Integration
```bash
# Install axe-core
npm install --save-dev @axe-core/cli

# Run accessibility audit
npx axe http://localhost:8000 --exit
```

**CI Integration:**
```javascript
// Add to test suite
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('should have no accessibility violations', async () => {
  const results = await axe(document.body);
  expect(results).toHaveNoViolations();
});
```

#### Lighthouse Accessibility Audit
```bash
lighthouse http://localhost:8000 --only-categories=accessibility --output html
```

### 2. Manual Testing

#### Keyboard Navigation Test
1. **Tab through all interactive elements**
   - Ensure logical tab order
   - Verify focus indicators are visible
   - Check no keyboard traps exist

2. **Test keyboard shortcuts**
   - Alt+G: Generate password
   - Alt+C: Copy password
   - Escape: Close modals

3. **Form interaction**
   - Navigate between form fields
   - Activate controls with Enter/Space
   - Verify error messages appear and are announced

#### Screen Reader Testing

**NVDA (Windows - Free):**
```bash
# Download from: https://www.nvaccess.org/
# Test checklist:
- [ ] All interactive elements have labels
- [ ] Dynamic content changes are announced
- [ ] Form errors are read correctly
- [ ] Button purposes are clear
- [ ] Headings create logical structure
```

**JAWS (Windows - Commercial):**
```bash
# Similar to NVDA testing
# Focus on complex interactions (modals, dynamic content)
```

**VoiceOver (macOS - Built-in):**
```bash
# Enable: Cmd+F5
# Test checklist:
- [ ] Rotor navigation works (headings, links, form controls)
- [ ] Dynamic content announced correctly
- [ ] Custom controls described properly
```

#### Color Contrast Testing
```bash
# Use browser extensions:
# - WAVE (Web Accessibility Evaluation Tool)
# - axe DevTools
# - Color Contrast Analyzer

# Manual verification:
1. Check all text against backgrounds
2. Verify UI component borders/states
3. Test in all theme modes
```

### 3. User Testing

**Recruit users with disabilities:**
- Screen reader users
- Keyboard-only users
- Users with visual impairments
- Users with cognitive disabilities

**Test scenarios:**
1. Generate a new password
2. Adjust settings and regenerate
3. Copy password to clipboard
4. Change theme
5. Save a preset
6. View history

## Accessibility Checklist

### Level A (Minimum)
- [ ] Non-text content has text alternatives
- [ ] Content is keyboard accessible
- [ ] Sufficient time to read/use content
- [ ] No content causes seizures
- [ ] Content is navigable
- [ ] Content is readable
- [ ] Content appears and operates predictably
- [ ] Input assistance for errors

### Level AA (Target Minimum)
- [ ] Captions for audio/video
- [ ] Multiple ways to find content
- [ ] Headings and labels describe purpose
- [ ] Keyboard focus is visible
- [ ] Color is not the only visual means
- [ ] Contrast ratio minimum 4.5:1
- [ ] Text can be resized 200%
- [ ] Images of text avoided

### Level AAA (Target Goal)
- [ ] Sign language for audio
- [ ] Extended audio descriptions
- [ ] No timing requirements
- [ ] No interruptions
- [ ] Re-authenticating doesn't lose data
- [ ] Contrast ratio minimum 7:1
- [ ] Spacing can be adjusted
- [ ] Help is available
- [ ] Error prevention for all submissions

## Common Issues and Fixes

### Issue 1: Missing Form Labels
**Problem:** Input fields without associated labels
**Fix:**
```html
<!-- Before -->
<input type="text" placeholder="Enter password length">

<!-- After -->
<label for="pwd-length">Password Length</label>
<input type="text" id="pwd-length" placeholder="e.g., 20">
```

### Issue 2: Poor Focus Indicators
**Problem:** Focus outline removed with CSS
**Fix:**
```css
/* Before */
*:focus {
  outline: none; /* ❌ Never do this */
}

/* After */
*:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

### Issue 3: Non-Descriptive Link Text
**Problem:** Links with "Click here" text
**Fix:**
```html
<!-- Before -->
<a href="/docs">Click here</a> for documentation

<!-- After -->
<a href="/docs">View documentation</a>
```

### Issue 4: Inaccessible Custom Controls
**Problem:** Div/span used as button
**Fix:**
```html
<!-- Before -->
<div class="btn" onclick="generate()">Generate</div>

<!-- After -->
<button type="button" onclick="generate()">Generate Password</button>
```

## Resources

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/) - Desktop app
- [NVDA](https://www.nvaccess.org/) - Free screen reader

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/) - Accessibility resources

### Testing Services
- [Accessibility testing services](https://www.levelaccess.com/)
- [User testing with people with disabilities](https://www.fable.app/)

---

**Last Updated:** 2025-11-14
**Status:** 📋 Planning Phase - Ready for Audit
**Target:** WCAG 2.1 Level AAA (0 violations)
**Next Step:** Run axe-core audit and document violations
