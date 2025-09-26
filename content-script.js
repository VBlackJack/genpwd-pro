const IGNORED_HOST_PATTERNS = [
  /\.bank$/i,
  /(?:^|\.)secure\./i,
  /banque/i,
  /bank/i
];

const ContentScript = {
  fields: [],
  observer: null,
  initialized: false,
  pendingFieldCountTimer: null,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.isAllowedHost()) {
      this.log('Sensitive host detected, disabling content script actions.');
      return;
    }

    this.detectPasswordFields();
    this.observeMutations();
    this.bindMessageListener();
    this.registerFocusListeners();
    this.sendFieldCount();
  },

  isAllowedHost() {
    const host = window.location.hostname || '';
    return !IGNORED_HOST_PATTERNS.some((pattern) => pattern.test(host));
  },

  log(...args) {
    if (typeof console !== 'undefined') {
      console.debug('[GenPwd Content]', ...args);
    }
  },

  bindMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'GENPWD_FILL_PASSWORD') {
        const password = message.payload;
        const { status, reason } = this.fillPassword(password);
        sendResponse({ status, reason });
        return true;
      }
      if (message.type === 'GENPWD_REQUEST_FIELD_COUNT') {
        sendResponse({ count: this.fields.length });
      }
      return false;
    });
  },

  observeMutations() {
    if (typeof MutationObserver === 'undefined') return;
    this.observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length)) {
          shouldUpdate = true;
          break;
        }
        if (mutation.type === 'attributes' && this.isPotentialPasswordField(mutation.target)) {
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) {
        this.detectPasswordFields();
      }
    });

    const rootNode = document.documentElement || document.body;
    if (!rootNode) return;

    this.observer.observe(rootNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type', 'data-password', 'data-pass', 'data-field', 'data-type']
    });
  },

  registerFocusListeners() {
    window.addEventListener('focus', () => {
      this.detectPasswordFields();
    }, true);
  },

  detectPasswordFields() {
    const collected = [];
    const visited = new Set();

    const collectFromRoot = (root) => {
      if (!root || visited.has(root)) return;
      visited.add(root);

      if (typeof root.querySelectorAll === 'function') {
        const nodes = root.querySelectorAll(
          'input[type="password"], input[data-password], input[data-pass], input[data-field*="password" i], input[data-type*="password" i]'
        );
        nodes.forEach((node) => {
          if (this.validateField(node)) {
            collected.push(node);
          }
        });
      }

      const ownerDocument = root.ownerDocument || document;
      const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
      let current = walker.currentNode;
      while (current) {
        if (current.shadowRoot) {
          collectFromRoot(current.shadowRoot);
        }
        current = walker.nextNode();
      }
    };

    collectFromRoot(document);

    const unique = [];
    const seen = new Set();
    collected.forEach((field) => {
      if (!field || !(field instanceof HTMLInputElement)) return;
      if (seen.has(field)) return;
      seen.add(field);
      unique.push(field);
    });

    this.fields = unique;
    this.sendFieldCount();
  },

  validateField(field) {
    if (!field || typeof field !== 'object') return false;
    if (!(field instanceof HTMLInputElement)) return false;

    const typeAttr = (field.getAttribute('type') || '').toLowerCase();
    const looksPassword = this.looksLikePassword(field);

    if (typeAttr && typeAttr !== 'password' && !looksPassword) return false;
    if (field.disabled || field.readOnly) return false;

    if (typeAttr === 'password') return true;
    if (looksPassword) return true;

    return false;
  },

  looksLikePassword(field) {
    const tokens = [
      field.name,
      field.id,
      field.getAttribute('placeholder'),
      field.getAttribute('aria-label'),
      field.getAttribute('autocomplete'),
      field.getAttribute('data-field'),
      field.getAttribute('data-type')
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
      .join(' ');

    if (!tokens) return false;
    return /password|passcode|passwd|passwort|motdepasse/.test(tokens);
  },

  isPotentialPasswordField(node) {
    if (!(node instanceof HTMLInputElement)) return false;
    const typeAttr = (node.getAttribute('type') || '').toLowerCase();
    if (typeAttr === 'password') return true;
    return this.looksLikePassword(node);
  },

  getActiveField() {
    let active = document.activeElement;

    if (active && active.shadowRoot) {
      const nested = active.shadowRoot.activeElement;
      if (nested) active = nested;
    }

    if (active instanceof HTMLInputElement && this.fields.includes(active) && !active.disabled && !active.readOnly) {
      return active;
    }

    return null;
  },

  fillPassword(password) {
    if (!this.isAllowedHost()) {
      return { status: 'blocked', reason: 'sensitive_host' };
    }

    if (!password) {
      return { status: 'error', reason: 'missing_password' };
    }

    if (!this.fields.length) {
      return { status: 'error', reason: 'no_fields' };
    }

    const target = this.getActiveField() || this.fields[0];
    if (!target) {
      return { status: 'error', reason: 'no_target' };
    }

    if (target.disabled || target.readOnly) {
      return { status: 'error', reason: 'field_not_editable' };
    }

    try {
      const proto = Object.getPrototypeOf(target);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(target, password);
      } else {
        target.value = password;
      }

      target.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));

      target.focus();
      if (typeof target.setSelectionRange === 'function') {
        const end = password.length;
        target.setSelectionRange(end, end);
      }

      return { status: 'filled' };
    } catch (error) {
      this.log('Error filling password field', error);
      return { status: 'error', reason: 'exception' };
    }
  },

  sendFieldCount() {
    if (this.pendingFieldCountTimer) {
      clearTimeout(this.pendingFieldCountTimer);
    }

    this.pendingFieldCountTimer = setTimeout(() => {
      this.pendingFieldCountTimer = null;
      const count = this.fields.length;
      try {
        chrome.runtime.sendMessage({ type: 'GENPWD_FIELD_COUNT', count });
      } catch (error) {
        this.log('Failed to send field count', error);
      }
    }, 100);
  }
};

ContentScript.init();
