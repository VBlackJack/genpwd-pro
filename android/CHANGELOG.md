# Changelog - GenPwd Pro Android

## [1.2.0-alpha.7] - 2025-10-30

### Phase 3: Advanced Features - COMPLETED

#### Password Health Dashboard
- **NEW**: Visual health dashboard with circular animated gauge (0-100 score)
- **NEW**: Real-time password security analysis
  - Weak password detection (< 60% strength) with detailed explanations
  - Reused password grouping and tracking
  - Compromised password detection via HaveIBeenPwned API
  - Old password alerts (> 90 days without update)
- **NEW**: Quick stats cards (total passwords, average strength)
- **NEW**: Navigation integration via VaultListScreen overflow menu
- **NEW**: Material 3 design with color-coded severity levels

#### Biometric UX Improvements
- **IMPROVED**: Comprehensive error messages with actionable guidance
  - Detailed explanations for each error scenario
  - Clear next steps for users
  - Support for all biometric error codes
- **IMPROVED**: Context-aware authentication prompts
  - Better titles and descriptions
  - Vault-specific messaging
  - Enhanced negative button labels
- **NEW**: Short and long message variants for different UI contexts
- **NEW**: Availability state messages explaining biometric status

#### Material You Dynamic Colors
- **CONFIRMED**: Material You fully enabled on Android 12+ (API 31+)
- **CONFIRMED**: Automatic wallpaper-based color extraction
- **CONFIRMED**: Graceful fallback to custom colors on older Android versions
- **IMPROVED**: Comprehensive documentation in Theme.kt and Color.kt
  - Detailed KDoc explaining Material You functionality
  - Clear fallback behavior documentation
  - Parameter usage guidance

### Documentation Updates
- **UPDATED**: README.md Phase 3 marked as 100% complete
- **UPDATED**: Roadmap progression documented
- **UPDATED**: Version bumped to 1.2.0-alpha.7 (versionCode: 9)
- **NEW**: CHANGELOG.md created
- **ARCHIVED**: Obsolete build logs and diagnostic files

### Technical Details
- Enhanced BiometricHelper.kt with dual message variants
- Enhanced BiometricManager.kt with availability messages
- Enhanced BiometricVaultManager.kt with context-aware prompts
- Updated Theme.kt with comprehensive Material You documentation
- Updated Color.kt with fallback color palette documentation
- Integrated PasswordHealthScreen navigation in NavGraph.kt
- Added Password Health menu item in VaultListScreen.kt

---

## [1.2.0-alpha.6] - 2025-10-29

### Comprehensive Tag and Favorite Management System

#### Tag Management (Complete Implementation)
- **NEW**: Full CRUD operations for tags
  - Create, edit, delete tags
  - Assign/unassign tags to entries
  - Visual tag chips with colors
- **NEW**: Tag management UI
  - Bottom sheet for tag selection
  - Tag creation dialog
  - Tag list with entry counts
- **NEW**: FileVaultRepository tag operations
  - `getTags()`, `createTag()`, `updateTag()`, `deleteTag()`
  - `getTagsForEntry()`, `assignTag()`, `unassignTag()`
  - Real-time tag synchronization

#### Favorite System (Complete Implementation)
- **NEW**: One-click favorite toggle
  - Heart icon button in entry cards
  - Visual feedback with animations
  - Instant UI updates
- **NEW**: Favorites filtering
  - Filter button in VaultListScreen
  - Show/hide favorites only
  - Reactive state management
- **NEW**: FileVaultRepository favorite operations
  - `toggleFavorite()` with automatic save
  - Real-time favorite status updates

### Technical Improvements
- Implemented TagManagementViewModel
- Enhanced VaultListViewModel with favorite filtering
- Added TagComponents.kt (TagChip, TagSelectionBottomSheet)
- Updated EntryEditScreen with tag management
- Updated VaultListScreen with favorite filtering

---

## [1.2.0-alpha.5] - 2025-10-28

### Cloud Sync System (Complete)
- **NEW**: Multi-provider cloud synchronization
  - Google Drive integration
  - Dropbox integration
  - OneDrive integration
  - WebDAV support
- **NEW**: Conflict resolution system
  - Manual conflict resolution UI
  - Automatic merge strategies
  - Version tracking
- **NEW**: OAuth2 authentication flow
- **NEW**: Sync history and status tracking

### QR Code Scanner (TOTP Setup)
- **NEW**: QR code scanner for TOTP setup
- **NEW**: otpauth:// URI parsing
- **NEW**: Camera permission handling

---

## [1.2.0-alpha.4] - 2025-10-27

### Generator UI Improvements (Phase 1 & 2)
- **NEW**: Visual placement mode for digits and special characters
- **NEW**: Individual positioning sliders (0-100%)
- **NEW**: Block-based pattern editor
- **NEW**: Enhanced preset system
- **NEW**: Material 3 design improvements

---

## Earlier Versions

See git history for versions prior to 1.2.0-alpha.4.

---

## Legend
- **NEW**: New feature
- **IMPROVED**: Enhancement to existing feature
- **FIXED**: Bug fix
- **CHANGED**: Breaking or significant change
- **DEPRECATED**: Feature marked for removal
- **REMOVED**: Feature removed
- **SECURITY**: Security-related change
- **CONFIRMED**: Existing feature verified/documented
- **UPDATED**: Documentation or configuration update
- **ARCHIVED**: File moved to archive
