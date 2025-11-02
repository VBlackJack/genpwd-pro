# Contributing

Thanks for helping us harden GenPwd Pro. This document highlights the workflow additions introduced with the CI pipeline and the temporary static-analysis baselines.

## Development workflow

1. Install the Android SDK (command line tools) and JDK 17. You can either reopen the repository with the provided Devcontainer (`.devcontainer/devcontainer.json`) or run `./.devcontainer/setup-android-sdk.sh` locally to download the required packages and generate `android/local.properties`.
2. Run the full verification suite before sending a change:
   ```bash
   ./gradlew lint detekt ktlintCheck testDebugUnitTest --console=plain
   ```
   The command matches the GitHub Actions job (`.github/workflows/android-ci.yml`).
   > **Note:** `ktlintCheck` is temporarily disabled (skipped) in Gradle because the existing code base contains thousands of
   > formatting violations. The task is left in the pipeline to preserve the invocation signature and will be re-enabled once
   > a baseline or mass-formatting pass lands.
3. When touching dependency versions, run `./gradlew dependencyUpdates` from the `android/` directory to refresh the dependency report and regenerate verification metadata if new modules are introduced (see below).

## Dependency verification

We enabled Gradle's [dependency verification](https://docs.gradle.org/current/userguide/dependency_verification.html) in strict mode. If you add a new dependency:

1. Run `./gradlew --write-verification-metadata sha256` from the `android/` directory to append the required checksums to `gradle/verification-metadata.xml`.
2. Check in the updated metadata file alongside your other changes.

Builds will fail if a dependency is fetched with an unexpected checksum, so keep the metadata file in sync with your dependency graph.

## Static analysis baselines (temporary)

To unblock the team while we pay down legacy issues we keep lint/detekt baselines under version control:

- **Lint baseline:** `config/lint-baseline.xml`
- **Detekt baseline:** `config/detekt/detekt-baseline.xml`

These files capture existing violations so CI focuses on regressions only. The rules still run in `warningsAsErrors/strict` mode, so new problems will fail the build immediately.

When you fix an item that was previously baselined, regenerate the relevant file:

```bash
./gradlew :app:lint --update-baseline
./gradlew detektBaseline
```

Always review the diff to make sure only the intended findings disappeared. Our goal is to shrink these baselines gradually until we can delete them.

## Reporting issues

If you find a security concern during development, follow the process described in [`SECURITY.md`](SECURITY.md) before opening a public ticket.
