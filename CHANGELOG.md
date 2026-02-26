# Changelog

All notable changes to the "Project Dashboard" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Backup and Restore**: Export/Import projects to/from JSON files
  - `Project Dashboard: Export Projects to JSON` - Save all projects to a JSON backup file
  - `Project Dashboard: Import Projects from JSON` - Restore projects from backup (skips duplicates)
  - Automatic duplicate detection during import
  - Backup files can be used to sync projects between computers or restore after reinstallation
  - Human-readable JSON format with indentation

## [0.0.1] - 2026-02-27

### Added
- Initial release
- 5 view modes for project display:
  - Table view: Compact table layout
  - Grouped by Date: Projects grouped by last update (Today, Yesterday, This Week, This Month, Older)
  - Grouped by Tags: Projects organized by tags with collapsible sections
  - Cards view: Card layout with full descriptions and tags
  - Explorer view: Tree-like view with tags as folders
- Project management features:
  - Create projects with name, description, tags, color and folder path
  - Edit projects inline in detail view
  - Delete projects with confirmation dialog
  - View project details in dedicated panel
- Search and filter:
  - Real-time search across name, description, tags and path
  - Debounced search (200ms) for performance
  - Shows "Found: X of Y projects" counter
- Security features:
  - XSS protection: All user input sanitized
  - Race condition prevention: Map-based promise locking for concurrent operations
  - Type-safe WebView messaging with TypeScript union types
- Folder tracking:
  - Automatic folder rename detection using inode
  - Updates project path when folder is renamed
  - Warns when parent directory is not found
- Data persistence:
  - Projects stored in VS Code globalState
  - Synced across machines via Settings Sync
  - Survives VS Code restarts and extension updates
- UI/UX improvements:
  - Color-coded projects for visual identification
  - Hover actions on cards and table rows
  - Collapsible sections in grouped views
  - Responsive layout for different panel sizes
  - Empty state with helpful prompts
- Activity Bar integration:
  - Custom "Projects" panel in Activity Bar
  - Quick access buttons: Add (+), Toggle View, Settings
- Commands:
  - `Project Dashboard: Add Project`
  - `Project Dashboard: Edit Project`
  - `Project Dashboard: Delete Project`
  - `Project Dashboard: Toggle View`
  - `Project Dashboard: Settings & Info`

### Fixed
- Race condition when loading projects on first open
- Projects not displaying on initial panel load (WebView readiness fix)
- "Open Project" button not working from detail view
- XSS vulnerability in color field (13 instances)
- Blocking synchronous file system operations (6 instances)
- Memory leak from uncleaned WebView message handlers

### Security
- Implemented `sanitizeColor()` to validate hex color format
- Implemented `escapeHtml()` for all user content in HTML
- Added Map-based locking to prevent race conditions in folder path verification

[Unreleased]: https://github.com/svt/project-dashboard/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/svt/project-dashboard/releases/tag/v0.0.1
