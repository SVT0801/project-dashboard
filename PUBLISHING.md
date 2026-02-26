# Publishing Guide

This guide explains how to prepare and publish the Project Dashboard extension.

## Prerequisites

1. Install vsce (Visual Studio Code Extensions CLI):
```bash
npm install -g @vscode/vsce
```

2. Create a publisher account:
   - Visit: https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft account
   - Create new publisher (e.g., "your-publisher-id")

3. Create Personal Access Token (PAT):
   - Go to: https://dev.azure.com/[your-org]/_usersSettings/tokens
   - Create token with **Marketplace > Manage** scope
   - Save token securely

## Configuration

### 1. Update package.json

Before publishing, update these fields in `package.json`:

```json
{
  "publisher": "your-actual-publisher-id",  // Change from "svt"
  "repository": {
    "url": "https://github.com/your-username/project-dashboard"  // Your actual repo
  }
}
```

### 2. Update Version

Follow [Semantic Versioning](https://semver.org/):
- `0.1.0` - First public release
- `0.1.1` - Bug fixes
- `0.2.0` - New features
- `1.0.0` - Stable release

Update version in `package.json`:
```json
{
  "version": "0.1.0"
}
```

### 3. Create CHANGELOG.md (recommended)

Document changes for each version:

```markdown
# Changelog

## [0.1.0] - 2026-02-27

### Added
- 5 view modes: Table, Grouped by Date, Grouped by Tags, Cards, Explorer
- Search and filter functionality
- Inline editing in detail view
- Folder tracking with inode
- Delete confirmation
- XSS protection and security improvements
```

## Local Testing

Before publishing, test locally:

```bash
# Compile
npm run compile

# Package
vsce package

# Install locally
code --install-extension project-dashboard-0.1.0.vsix

# Test in VS Code
# Open Command Palette (Cmd/Ctrl+Shift+P)
# Type "Project Dashboard"
```

## Publishing

### First Time Setup

Login to marketplace:
```bash
vsce login your-publisher-id
# Enter your Personal Access Token when prompted
```

### Publish Extension

```bash
# Verify package contents
vsce ls

# Package and publish
vsce publish

# Or publish specific version
vsce publish minor  # 0.1.0 -> 0.2.0
vsce publish patch  # 0.1.0 -> 0.1.1
vsce publish major  # 0.1.0 -> 1.0.0
```

### Update Published Extension

To release an update:

1. Make your changes
2. Test thoroughly
3. Update version in `package.json`
4. Update `CHANGELOG.md`
5. Commit changes
6. Run: `vsce publish`

## Post-Publishing

### Extension Page

Your extension will be available at:
```
https://marketplace.visualstudio.com/items?itemName=your-publisher-id.project-dashboard
```

### Add Icon (Optional)

1. Create 128x128 PNG icon
2. Save as `resources/icon.png`
3. Add to package.json:
```json
{
  "icon": "resources/icon.png"
}
```

### Add Badges (Optional)

Add to README.md:
```markdown
[![Version](https://img.shields.io/vscode-marketplace/v/your-publisher-id.project-dashboard)](https://marketplace.visualstudio.com/items?itemName=your-publisher-id.project-dashboard)
[![Installs](https://img.shields.io/vscode-marketplace/i/your-publisher-id.project-dashboard)](https://marketplace.visualstudio.com/items?itemName=your-publisher-id.project-dashboard)
[![Rating](https://img.shields.io/vscode-marketplace/r/your-publisher-id.project-dashboard)](https://marketplace.visualstudio.com/items?itemName=your-publisher-id.project-dashboard)
```

## Troubleshooting

### "Publisher not found"
- Create publisher at https://marketplace.visualstudio.com/manage
- Update `package.json` with correct publisher ID

### "Invalid Personal Access Token"
- Regenerate token at https://dev.azure.com
- Ensure **Marketplace > Manage** scope is enabled
- Run `vsce login` again

### "Missing README"
- README.md is required
- Must contain description and usage instructions

### "Icon not found"
- Remove `"icon"` field from package.json if no icon
- Or add 128x128 PNG icon at specified path

## Best Practices

1. **Test thoroughly** before publishing
2. **Update CHANGELOG** for every release
3. **Respond to issues** on GitHub
4. **Monitor ratings** and feedback
5. **Keep dependencies** up to date
6. **Follow semver** for versions

## Resources

- [Publishing Extensions Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
