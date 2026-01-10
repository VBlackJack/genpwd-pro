# Threat Model - GenPwd Pro

## Document Information

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0 |
| **Last Updated** | 2026-01-10 |
| **Status** | Active |
| **Classification** | Public |

---

## 1. System Overview

GenPwd Pro is a multi-platform password manager with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        GenPwd Pro                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Web/PWA   │  │  Desktop    │  │  Browser Extensions     │  │
│  │             │  │  (Electron) │  │  (Chrome/Firefox)       │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         └────────────────┼─────────────────────┘                 │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Core Engine                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │  Generator  │  │    Vault    │  │  Import/Export  │    │  │
│  │  │             │  │   Storage   │  │    Service      │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Cryptographic Layer                        │  │
│  │  Argon2id │ AES-256-GCM │ XSalsa20-Poly1305 │ SHA-256     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Assets to Protect

### Critical Assets (Tier 1)

| Asset | Description | Confidentiality | Integrity | Availability |
|-------|-------------|-----------------|-----------|--------------|
| Master Password | User's vault unlock password | CRITICAL | CRITICAL | HIGH |
| Vault Encryption Key | Derived key for vault access | CRITICAL | CRITICAL | HIGH |
| Stored Credentials | Username/password pairs | CRITICAL | HIGH | MEDIUM |
| TOTP Seeds | 2FA secret keys | CRITICAL | HIGH | HIGH |

### Important Assets (Tier 2)

| Asset | Description | Confidentiality | Integrity | Availability |
|-------|-------------|-----------------|-----------|--------------|
| Vault Metadata | Entry titles, folder structure | HIGH | MEDIUM | MEDIUM |
| Session Keys | Temporary unlock keys | HIGH | HIGH | LOW |
| Generated Passwords | Before storage/copy | HIGH | MEDIUM | LOW |
| Import/Export Files | CSV, JSON, KDBX | HIGH | HIGH | LOW |

### Supporting Assets (Tier 3)

| Asset | Description | Confidentiality | Integrity | Availability |
|-------|-------------|-----------------|-----------|--------------|
| Application Settings | User preferences | LOW | MEDIUM | LOW |
| Dictionary Files | Passphrase generation | LOW | MEDIUM | MEDIUM |
| Audit Logs | Error/debug logs | MEDIUM | MEDIUM | LOW |

## 3. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED ZONE                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Network   │  │  Clipboard  │  │   External Files        │  │
│  │   (HIBP)    │  │  (System)   │  │   (KDBX, CSV)           │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
├─────────┼────────────────┼─────────────────────┼─────────────────┤
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    TRUST BOUNDARY 1                          ││
│  │              (Input Validation & Sanitization)               ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    SEMI-TRUSTED ZONE                         ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │           Renderer Process (Sandboxed)               │    ││
│  │  │  - UI Components                                     │    ││
│  │  │  - User Interaction                                  │    ││
│  │  │  - Display Logic                                     │    ││
│  │  └─────────────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    TRUST BOUNDARY 2                          ││
│  │                 (Context Isolation / IPC)                    ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      TRUSTED ZONE                            ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │              Main Process (Privileged)               │    ││
│  │  │  - Cryptographic Operations                          │    ││
│  │  │  - File System Access                                │    ││
│  │  │  - OS Credential Storage                             │    ││
│  │  └─────────────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 4. Threat Actors

### Tier 1: Opportunistic Attackers

- **Capability**: Low - Automated tools, known exploits
- **Motivation**: Financial gain, data theft
- **Attack Vectors**: Phishing, malware, credential stuffing

### Tier 2: Targeted Attackers

- **Capability**: Medium - Custom tools, some resources
- **Motivation**: Targeted data theft, corporate espionage
- **Attack Vectors**: Social engineering, supply chain attacks

### Tier 3: Advanced Persistent Threats

- **Capability**: High - Nation-state resources
- **Motivation**: Surveillance, intelligence gathering
- **Attack Vectors**: Zero-days, hardware attacks, insider threats

## 5. Threat Catalog

### T1: Brute Force Master Password

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Spoofing |
| **Likelihood** | Medium |
| **Impact** | Critical |
| **Risk** | High |

**Description**: Attacker attempts to guess master password through brute force.

**Mitigations**:
- [x] Argon2id KDF with 64MB memory cost
- [x] 3 iterations, 4 threads parallelism
- [x] Rate limiting on unlock attempts
- [ ] Account lockout after N failures (not applicable - local only)

---

### T2: Memory Extraction Attack

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Information Disclosure |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Risk** | Medium |

**Description**: Attacker extracts decrypted vault data from application memory.

**Mitigations**:
- [x] Session timeout (5 min default)
- [x] Memory wipe on lock (`buffer.fill(0)`)
- [x] Lock on screen lock/suspend
- [ ] Secure memory allocation (limited by JS runtime)

**Accepted Risk**: JavaScript GC prevents guaranteed memory clearing.

---

### T3: Clipboard Interception

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Information Disclosure |
| **Likelihood** | Medium |
| **Impact** | High |
| **Risk** | Medium |

**Description**: Malware monitors clipboard to capture copied passwords.

**Mitigations**:
- [x] Auto-clear clipboard after 30 seconds
- [x] Warning about Windows Clipboard History
- [x] Notification on clipboard clear
- [ ] Secure clipboard API (OS dependent)

---

### T4: Malicious Plugin Injection

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Tampering, Elevation of Privilege |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Risk** | Medium |

**Description**: Attacker installs malicious plugin to steal credentials.

**Mitigations**:
- [x] Plugin size limit (100KB)
- [x] Hook whitelist (6 allowed hooks)
- [x] No eval()/Function() allowed
- [x] ES6 modules only
- [x] Error isolation

---

### T5: KDBX Import Exploitation

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Tampering |
| **Likelihood** | Low |
| **Impact** | High |
| **Risk** | Low |

**Description**: Crafted KDBX file exploits parsing vulnerabilities.

**Mitigations**:
- [x] File size validation (50MB max)
- [x] DOMPurify sanitization of imported data
- [x] ProtectedValue for password handling
- [x] Error handling prevents info leakage
- [ ] Fuzzing tests for import parsers

---

### T6: IPC Message Tampering

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Tampering |
| **Likelihood** | Low |
| **Impact** | High |
| **Risk** | Low |

**Description**: Attacker manipulates IPC messages between renderer and main process.

**Mitigations**:
- [x] Context isolation enabled
- [x] Preload script with limited API
- [x] `ipcRenderer.invoke()` only (no `send()`)
- [x] Input validation in main process handlers

---

### T7: Network Eavesdropping (HIBP)

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Information Disclosure |
| **Likelihood** | Low |
| **Impact** | Low |
| **Risk** | Low |

**Description**: Attacker intercepts HIBP API requests to learn password status.

**Mitigations**:
- [x] K-anonymity (only 5-char SHA-1 prefix sent)
- [x] HTTPS-only communication
- [x] Add-Padding header for response obfuscation
- [x] Rate limiting prevents timing attacks

---

### T8: Supply Chain Attack

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Tampering |
| **Likelihood** | Low |
| **Impact** | Critical |
| **Risk** | Medium |

**Description**: Compromised npm package introduces malicious code.

**Mitigations**:
- [x] Minimal dependencies (6 production packages)
- [x] npm audit in CI/CD
- [x] Dependabot automatic updates
- [x] Lock file for reproducible builds
- [ ] Subresource Integrity for CDN resources

---

### T9: Duress/Coercion Attack

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Spoofing |
| **Likelihood** | Very Low |
| **Impact** | Critical |
| **Risk** | Low |

**Description**: User forced to unlock vault under duress.

**Mitigations**:
- [x] Duress mode with decoy vault
- [x] Separate duress key storage
- [x] Vault nuke capability
- [x] No visual indication of duress mode

---

### T10: Cross-Site Scripting (XSS)

| Attribute | Value |
|-----------|-------|
| **STRIDE** | Tampering, Information Disclosure |
| **Likelihood** | Low |
| **Impact** | High |
| **Risk** | Low |

**Description**: Attacker injects malicious scripts via user input.

**Mitigations**:
- [x] Strict CSP (no inline scripts)
- [x] DOMPurify for all user content
- [x] No `eval()` or `innerHTML` with user data
- [x] Context isolation in Electron

---

## 6. Security Controls Matrix

| Control | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 |
|---------|----|----|----|----|----|----|----|----|----|----|
| Argon2id KDF | ✓ | | | | | | | | | |
| Session Timeout | | ✓ | | | | | | | | |
| Memory Wipe | | ✓ | | | | | | | | |
| Clipboard Auto-clear | | | ✓ | | | | | | | |
| Plugin Sandboxing | | | | ✓ | | | | | | |
| Input Sanitization | | | | | ✓ | ✓ | | | | ✓ |
| Context Isolation | | | | ✓ | | ✓ | | | | ✓ |
| K-Anonymity | | | | | | | ✓ | | | |
| npm audit | | | | | | | | ✓ | | |
| Duress Mode | | | | | | | | | ✓ | |
| CSP | | | | | | | | | | ✓ |

## 7. Residual Risks

### Accepted Risks

| Risk | Reason | Mitigation Status |
|------|--------|-------------------|
| JS GC memory clearing | Platform limitation | Documented, session timeout mitigates |
| `unsafe-inline` CSS | Required for CSSOM API | XSS prevented by other controls |
| Windows Clipboard History | OS feature | User warning implemented |

### Risks Requiring Monitoring

| Risk | Current Status | Review Frequency |
|------|----------------|------------------|
| Electron CVEs | Automated monitoring | Weekly |
| npm vulnerabilities | Daily CI scan | Daily |
| kdbxweb security | Manual review | Quarterly |

## 8. Incident Response

### Security Issue Classification

| Severity | Response Time | Examples |
|----------|---------------|----------|
| Critical | 24 hours | RCE, master password leak |
| High | 72 hours | Encryption bypass, XSS |
| Medium | 1 week | Information disclosure |
| Low | Next release | Minor issues |

### Reporting

Security issues should be reported to: **security@genpwd.app**

PGP key available upon request.

## 9. Review Schedule

| Review Type | Frequency | Last Review | Next Review |
|-------------|-----------|-------------|-------------|
| Threat Model Update | Quarterly | 2026-01-10 | 2026-04-10 |
| Dependency Audit | Weekly | Automated | Automated |
| Penetration Test | Annually | - | 2026-12-01 |
| Code Review | Per PR | Continuous | Continuous |

---

## References

- [STRIDE Threat Model](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
