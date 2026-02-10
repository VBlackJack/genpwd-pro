# GenPwd Pro - Build Tools

## Overview

This folder contains automated scripts for managing Android builds with automatic version management.

## Files

- `auto-build.bat` - Main build script (Windows)
- `version-helper.ps1` - PowerShell script for version management
- `BUILD.md` - This file (documentation)

## Usage

### Standard build

```batch
.\auto-build.bat
```

The script will guide you through the following steps:
1. Build type selection (Debug/Release)
2. Additional options (Lint, Tests, Copy to dist/)
3. Reading and confirming the current version
4. Automatic version increment
5. APK compilation
6. Verification and report

### Available options

#### Build options
- **Debug**: Generates a debug APK (unsigned)
- **Release**: Generates a production APK (signed)

#### Additional options
- **Lint**: Runs static code analysis before the build
- **Tests**: Runs unit tests before the build
- **Copy to dist/**: Copies the generated APK to a `dist/` folder with a standardized name

## Version Management

### Version format

The project uses the [Semantic Versioning](https://semver.org/) format with suffixes:
- **Format**: `MAJOR.MINOR.PATCH-STAGE.NUMBER`
- **Example**: `1.2.0-alpha.15`

Where:
- `MAJOR`: Major version (breaking changes)
- `MINOR`: Minor version (backward-compatible new features)
- `PATCH`: Patch version (bug fixes)
- `STAGE`: Development stage (`alpha`, `beta`, `rc`)
- `NUMBER`: Build number for the stage

### Version increment

The `version-helper.ps1` script supports several increment types:

```powershell
# Increment alpha (1.2.0-alpha.15 → 1.2.0-alpha.16)
.\version-helper.ps1 -Action IncrementAlpha

# Increment beta (1.2.0-beta.5 → 1.2.0-beta.6)
.\version-helper.ps1 -Action IncrementBeta

# Increment minor version (1.2.0 → 1.3.0-alpha.1)
.\version-helper.ps1 -Action IncrementMinor

# Increment major version (1.2.0 → 2.0.0-alpha.1)
.\version-helper.ps1 -Action IncrementMajor

# Get the current version
.\version-helper.ps1 -Action GetVersionName
.\version-helper.ps1 -Action GetVersionCode
.\version-helper.ps1 -Action GetFullVersion
```

### Handling build failures

**IMPORTANT**: If a build fails, the script automatically restores the previous version in `build.gradle.kts`.

However, this can cause issues:
- If you make several failed build attempts
- On the next successful build, you will use the same incremented version
- Result: you "skip" version numbers

**Solutions**:

1. **Option 1 - Keep the version after failure** (Recommended for development):
   - Do not restore the version after a failure
   - Each attempt uses a new version
   - Advantage: Full traceability of all attempts
   - Disadvantage: "Gaps" in version number history

2. **Option 2 - Restore and reuse** (Current default):
   - Restores the version after failure
   - The next successful build will use the same incremented version
   - Advantage: No gaps in version numbers
   - Disadvantage: Loss of traceability for failed attempts

3. **Option 3 - Manual**:
   - Do not increment automatically
   - Manage versions manually in `build.gradle.kts`

**Recommendation**: For active development, it is preferable to NOT restore after failure. Each build (even a failed one) should have its own number. Gaps in numbering are not a problem.

## Script Outputs

### Generated files

- **APK**: `app/build/outputs/apk/[debug|release]/*.apk`
- **Dist copy**: `dist/genpwd-pro-vX.Y.Z-[debug|release].apk` (if option enabled)
- **Report**: `build-report-X.Y.Z-[debug|release].txt`
- **Backup**: `app/build.gradle.kts.backup` (automatic backup before modification)

### Build report

The script generates a detailed report containing:
- Build date and time
- Version (versionName and versionCode)
- Build type (Debug/Release)
- APK name and size
- Options used (Lint, Tests, etc.)
- Gradle and Kotlin versions
- Version changes

## Security Checks

### For Release builds

The script automatically performs:
1. **Signature verification**: Checks that the APK is properly signed
2. **Size verification**: Warns if the APK is abnormally small (< 1 MB)

### For all builds

- Automatic backup of the `build.gradle.kts` file before modification
- Restoration on error (optional)
- Version format validation

## Usage Examples

### Scenario 1: Daily development build

```batch
# Launch the build
.\auto-build.bat

# Choose:
# - Type: 1 (Debug)
# - Lint: N
# - Tests: N
# - Copy to dist: Y

# Result:
# - Version automatically incremented
# - APK in dist/ ready to test
# - Build report generated
```

### Scenario 2: Release build for production

```batch
# Launch the build
.\auto-build.bat

# Choose:
# - Type: 2 (Release)
# - Lint: Y (recommended)
# - Tests: Y (recommended)
# - Copy to dist: Y

# Result:
# - Lint and tests executed
# - APK signed and verified
# - Ready for distribution
```

### Scenario 3: Transitioning from alpha to beta

```powershell
# Manually increment to beta
.\version-helper.ps1 -Action IncrementBeta

# Then build normally
.\auto-build.bat
```

### Scenario 4: New minor version

```powershell
# Move to the next version (e.g., 1.2.x → 1.3.0-alpha.1)
.\version-helper.ps1 -Action IncrementMinor
.\version-helper.ps1 -Action UpdateVersions -NewVersionCode 25 -NewVersionName "1.3.0-alpha.1"

# Then build normally
.\auto-build.bat
```

## Troubleshooting

### The script cannot find the generated APK

**Symptom**: Message "ERROR: No APK found"

**Solution**: The script now uses automatic detection with pattern matching. Check that:
1. The Gradle build actually succeeded
2. The `app/build/outputs/apk/[debug|release]/` folder exists
3. It contains at least one `.apk` file

### The version is not incremented

**Symptom**: The version remains the same after the build

**Solution**:
1. Check that you confirmed the increment (answered "Y")
2. Check write permissions on `app/build.gradle.kts`
3. Check the backup at `app/build.gradle.kts.backup`

### Signature error on Release

**Symptom**: "The release APK is not signed"

**Solution**:
1. Check your signing configuration in `build.gradle.kts`
2. Make sure the keystore is present and accessible
3. Verify the signing credentials

### Multiple failed builds - skipped versions

**Symptom**: After several failed builds, version numbers are skipped

**Current solution**: This is known behavior (see the "Handling build failures" section above)

**Workaround**:
- Option A: Accept gaps in numbering (recommended)
- Option B: After a failure, note the version and reuse it manually on the next build
- Option C: Modify the script to not restore after failure

## Tools Changelog

### Version 2.0 (Current)
- Automatic APK detection (more robust)
- Options for Lint and Tests
- Signature verification for Release
- APK size verification
- Build report generation
- Automatic copy to dist/
- Support for beta and major/minor increment
- Automatic backup before modification
- Improved error handling

### Version 1.0 (Initial)
- Basic alpha increment
- Debug/Release build
- Restoration on failure

## Upcoming

Features planned for future versions:
- [ ] Option to not restore after failure
- [ ] Support for RC (Release Candidate) versions
- [ ] Git integration (automatic tagging)
- [ ] Automatic changelog generation
- [ ] Build completion notification (sound/email)
- [ ] Multi-flavor/variant support
- [ ] Build statistics (duration, success/failure)

## Contributing

To contribute to the build tools:
1. Test modifications locally
2. Document changes in this README
3. Update the script version number
4. Create a separate commit for build tools
