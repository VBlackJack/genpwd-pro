# Google Play Data Safety mapping

This document maps the Play Console “Data safety” form to the implementation details of GenPwd Pro.

## Data collection and sharing

| Question | Answer | Notes |
| --- | --- | --- |
| Does the app collect data? | **No** | Secrets never leave the device. Sync features only upload user-approved encrypted blobs. |
| Does the app share data with third parties? | **No** | There is no analytics, advertising SDK, or outbound data sharing. |

## Data types handled on-device

| Category | Status | Mitigations |
| --- | --- | --- |
| Personal info, financial info, health info | Not collected | The app only processes credentials provided by the user locally. |
| Messages, Photos/Videos, Audio files | Not collected | OTP QR images are processed in-memory and discarded immediately. |
| Files and docs | Not collected | Vault content remains encrypted inside the SQLCipher database. |
| Device or other IDs | Not collected | No fingerprinting or telemetry. |

## Security practices

- **Encryption at rest**: SQLCipher protects the Room database; symmetric keys are wrapped by Tink and stored via `AndroidKeysetManager` with a Keystore master key.
- **Encryption in transit**: Optional sync uses TLS and encrypts payloads with the same Tink engine before upload.
- **Minimised access**: The camera permission is requested only when launching the OTP scanner. Gallery imports use the system picker and never persist images.
- **Clipboard hygiene**: Sensitive clipboard entries are redacted, auto-expire, and the UI enforces `FLAG_SECURE` across activities, dialogs, and widgets.

## Data deletion

Users can delete all vault content from the security settings screen (“Supprimer toutes les clés”) which wipes the Tink keyset and SQLCipher database. Sync tokens can also be revoked individually. There is no server-side copy of secrets.

## Permissions summary

| Permission | Reason | Data exposure |
| --- | --- | --- |
| `android.permission.CAMERA` | Scan OTP QR codes locally. | No media is uploaded or persisted. |
| `android.permission.USE_BIOMETRIC` | Unlock vaults and confirm sensitive actions. | Only used for local authentication. |

## Backups

`android:allowBackup="false"` prevents inclusion of secrets in system backups. Sync is opt-in and only handles encrypted payloads.

## Testing & verification

- Automated tests (`./gradlew :tools:doctor && ./gradlew lint detekt ktlintCheck testDebugUnitTest`) validate that SDK configuration and static analysis policies remain green.
- Robolectric coverage ensures that the Tink keyset stays bound to the Keystore path, and crash handlers redact sensitive information.

The engineering team reviews this mapping before every release to keep the Play Console declaration accurate.
