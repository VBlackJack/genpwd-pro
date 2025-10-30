# Security Policy

## Supported Versions
| Version | Supported |
|---------|-----------|
| 1.1.x   | ✅
| 1.0.x   | ⚠️ Security fixes only for critical issues
| < 1.0   | ❌

We align support windows with the latest minor release train. Once a new minor ships, the previous line only receives high-priority security patches for 90 days.

## Reporting a Vulnerability
If you discover a security issue, please email **security@genpwd.app** with the following details:
- Steps to reproduce or proof-of-concept
- Impact assessment (data exposed, escalation vector, etc.)
- Any mitigation ideas or temporary workarounds

We acknowledge reports within three business days and aim to provide a remediation plan within ten business days. Please request our PGP key in your initial email if you prefer to share encrypted details; we will respond with the fingerprint and download location.

## Threat Model Summary
GenPwd Pro safeguards user secrets across several surfaces:
- **Autofill:** Autofill responses are scoped per-app, sanitized via `IntentSanitizer`, and require the vault session to be unlocked before serving data.
- **Keystore:** Device-bound keys are generated through Android Keystore/Hardware-backed MasterKey and never leave the secure hardware enclave.
- **SQLCipher:** The Room database runs on SQLCipher with per-user passphrase derivation (Argon2id) to resist offline extraction.
- **Sync tokens:** OAuth and WebDAV tokens are wrapped with EncryptedSharedPreferences and refreshed opportunistically to minimize exposure windows.

## Hardening & Trade-offs
- StrictMode, lint, and static analysis are enabled in debug builds to catch regressions early.
- R8/ProGuard strips logging and unused code to reduce attack surface.
- Widgets and notifications default to redacted states while the device is locked.
- Network stack pins to system trust anchors with custom overrides only for debug builds.

## Data handling guarantees
- **Clés Tink protégées par Keystore** : le `CryptoEngine` s’appuie sur `AndroidKeysetManager` et un URI maître `android-keystore://genpwdpro_master_key`. Les clés symétriques ne quittent jamais le keystore matériel.
- **SessionStore volatile** : aucune donnée secrète (mots de passe, OTP) n’est persistée dans `SessionStore`. Les sessions ne contiennent que des identifiants opaques.
- **SQLCipher** : la base Room applique les PRAGMA `cipher_page_size`, `cipher_memory_security` et `cipher_plaintext_header_size` pour renforcer le stockage chiffré.
- **Presse-papiers & FLAG_SECURE** : le contenu copié est effacé automatiquement, masqué dans les notifications et toutes les surfaces sensibles appliquent `FLAG_SECURE` (y compris les feuilles, dialogues et activités OTP).

Known trade-offs:
- Clipboard auto-clear relies on platform timers; some OEMs may ignore scheduled clears.
- Direct Boot support is limited to placeholder widgets until the user unlocks the device.
- Fallback to software cryptography occurs on devices lacking hardware-backed AES-GCM, with a warning logged for follow-up.

## OTP Threat Scenarios

We treat one-time-password ingestion as a separate attack surface because QR imports come from untrusted sources. Mitigations in place and under review:

- **Malformed imports:** every otpauth URI is parsed through `OtpUriParser`, which sanitizes secrets, issuers and labels. Inputs that fail validation are rejected with a generic error.
- **Label collisions:** vault entries carry issuer/label metadata; we warn on duplicates during review and plan to surface better UX cues so users can distinguish entries with similar names.
- **Secret duplication:** the clipboard sanitizer and copy flows avoid leaking raw secrets. Re-importing an existing OTP secret triggers an update rather than creating multiple copies when the target entry matches.
- **Namespace confusion:** custom intents and widget broadcasts are protected by `IntentSanitizer` and a signature-level permission (`com.julien.genpwdpro.permission.WIDGET_INTERNAL`) so third-party apps cannot inject forged OTP actions.

Future work includes anomaly detection for repeated import failures, richer issuer metadata (icons/domains) to mitigate phishing lookalikes, and telemetry (opt-in) on TOTP drift to catch clock-skew attacks.
