# Project Dashboard

Visual dashboard for managing projects in VS Code with tags, descriptions and multiple view modes.

## Features

- 🎨 **5 View Modes**: Table, Grouped by Date, Grouped by Tags, Cards, Explorer-like tree view
- 🏷️ **Tags**: Organize projects with custom tags
- 🎨 **Color Labels**: Assign colors for quick visual identification
- 📝 **Descriptions**: Add detailed descriptions to each project
- 🔍 **Search & Filter**: Quickly find projects by name, description, tags or path
- ⚡ **Quick Access**: Add, edit and delete projects with confirmation
- 📂 **Folder Tracking**: Automatically tracks folder renames using inode
- ✏️ **Inline Editing**: Edit project details directly in detail view
- 💾 **Persistent Storage**: Projects stored in VS Code globalState (synced across machines)

## Usage

### Adding a Project

1. Open "Projects" panel in Activity Bar (left sidebar)
2. Click "+" button in panel header
3. Enter name, description, tags, color and select project folder
4. Click "Create"

### View Modes

Click the view toggle button (📋) in panel header to cycle through 5 modes:

1. **Table** - Compact table layout with all projects
2. **Grouped by Date** - Projects grouped by: Today, Yesterday, This Week, This Month, Older
3. **Grouped by Tags** - Projects grouped by their tags
4. **Cards** - Card layout with descriptions and tags visible
5. **Explorer** - Tree view similar to VS Code Explorer, with tags as folders

### Editing a Project

- Click on project card/row to open detail view
- Click on any field (name, description, tags, color) to edit inline
- Or hover over project and click ✏️ button

### Deleting a Project

- Hover over project card/row and click 🗑️
- Confirm deletion in dialog

### Search

When you have projects, search bar appears automatically:
- Type to filter by name, description, tags or path
- Search is debounced (200ms delay)
- Shows "Found: X of Y projects"

## Commands

- `Project Dashboard: Add Project` - Add new project
- `Project Dashboard: Edit Project` - Edit project
- `Project Dashboard: Delete Project` - Delete project (with confirmation)
- `Project Dashboard: Toggle View` - Cycle through 5 view modes
- `Project Dashboard: Settings & Info` - Open settings panel

## Installation

### From Local Build

1. Clone repository
2. Install dependencies: `npm install`
3. Compile: `npm run compile`
4. Package: `vsce package`
5. Install: `code --install-extension project-dashboard-0.0.1.vsix`

### Development Mode

1. Open folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test your changes
4. Make edits and reload window (Cmd/Ctrl+R in Extension Development Host)

## Building & Publishing

### Local Package

```bash
npm install -g @vscode/vsce
vsce package
# Creates: project-dashboard-0.0.1.vsix
```

### Publishing to Marketplace

Before publishing, update `package.json`:

1. **Publisher ID**: Change `"publisher": "svt"` to your Marketplace publisher ID
   - Create publisher at: https://marketplace.visualstudio.com/manage
   
2. **Repository URL**: Update `"repository.url"` to your actual GitHub repository

3. **Version**: Update version following semver (e.g., `0.1.0` for first release)

Then publish:

```bash
vsce login <publisher-name>
vsce publish
```

## Architecture

### File Structure

```
src/
├── extension.ts          # Main extension entry point
├── projectsView.ts       # Main projects panel with 5 view modes
├── projectDetailView.ts  # Detail view with inline editing
├── projectsProvider.ts   # Data layer (CRUD operations)
├── settingsView.ts       # Settings panel
├── types.ts             # TypeScript interfaces
└── utils.ts             # Utility functions (sanitize, escape, debounce, etc.)

resources/
└── icon.svg             # Extension icon

out/                      # Compiled JavaScript (generated)
```

### Data Storage

Projects are stored in **VS Code globalState** (key: `'projects'`):
- Location: `~/Library/Application Support/Code/User/globalStorage/state.vscdb` (macOS)
- Persistent across VS Code restarts
- Synced via Settings Sync (if enabled)
- Not deleted when extension is reinstalled (only when uninstalled via UI)

### Security Features

- **XSS Protection**: All user input sanitized via `sanitizeColor()` and `escapeHtml()`
- **Race Condition Prevention**: Map-based promise locking for concurrent folder path updates
- **Type Safety**: Strict TypeScript with union types for WebView messages

## Technologies

- TypeScript 5.3.3
- VS Code Extension API 1.85.0+
- WebView API
- fs.promises (async file operations)
- globalState persistence

## License

MIT
