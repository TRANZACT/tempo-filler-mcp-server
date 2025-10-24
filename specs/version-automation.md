# Specification: Automated Version Management

## Problem Statement

When publishing a new version, developers must manually:

1. Update version references in multiple locations:
   - **package.json** - NPM package version
   - **src/index.ts** - MCP server runtime version
   - **README.md** - GitHub release download URLs (2 locations)
   - **bundle/manifest.json** - MCP bundle metadata version

2. Create a GitHub release manually through the UI:
   - Navigate to GitHub releases page
   - Click "Create new release"
   - Select the version tag
   - Write release notes
   - Upload the MCP bundle file

Missing any update causes version mismatches, broken download links, or CI/CD validation failures. This manual multi-step process is error-prone, time-consuming, and easy to forget.

## Objectives

1. Automatically synchronize all version references when running `npm version patch/minor/major`, using `package.json` as the single source of truth
2. Automatically create GitHub release when version tag is pushed, triggering the publish workflow

## Functional Requirements

### Version Synchronization

- **FR1**: When `package.json` version changes, automatically update `src/index.ts` server version
- **FR2**: When `package.json` version changes, automatically update README.md GitHub release URLs to match new version
- **FR3**: When `package.json` version changes, automatically update `bundle/manifest.json` version field
- **FR4**: Integrate with `npm version` command so all updates happen automatically
- **FR5**: Stage all version-related file changes for the version commit

### Validation

- **FR6**: Verify all files were successfully updated before completing
- **FR7**: Provide clear error messages if any file update fails

### Developer Experience

- **FR8**: Support dry-run mode to preview changes without applying them
- **FR9**: Work consistently across Windows, macOS, and Linux platforms
- **FR10**: Script must be idempotent (safe to run multiple times)

### GitHub Release Automation

- **FR11**: When a version tag (e.g., `v1.0.3`) is pushed to the repository, automatically create a GitHub release
- **FR12**: Build the MCP bundle by running `mcpb pack` in the project root to generate `bundle.dxt`
- **FR13**: Attach the generated `bundle.dxt` file to the GitHub release as a downloadable asset
- **FR14**: Generate release notes automatically from commit messages between tags
- **FR15**: GitHub release creation triggers the existing publish workflow (`.github/workflows/publish.yml`)

## Acceptance Criteria

### Automated Updates
- [ ] Running `npm version patch` updates all 4 files automatically (package.json, src/index.ts, README.md, bundle/manifest.json)
- [ ] GitHub release URLs use correct version format with v-prefix (e.g., `v1.0.3`)
- [ ] No manual file editing required after running npm version command
- [ ] Script can be run multiple times safely (idempotent)

### Validation
- [ ] All files contain matching version numbers after update
- [ ] Script exits with error if any update fails
- [ ] Clear error messages identify which file failed and why

### Integration
- [ ] Works with existing GitHub Actions publish workflow
- [ ] Compatible with npm's automatic git commit and tag creation
- [ ] Version validation in `.github/workflows/publish.yml` still passes

### GitHub Release Automation
- [ ] Pushing a version tag automatically creates a GitHub release
- [ ] MCP bundle is built automatically using `mcpb pack`
- [ ] Generated `bundle.dxt` file is attached to the release as a downloadable asset
- [ ] Release notes are generated from commit messages and included in the release
- [ ] GitHub release triggers the publish workflow
- [ ] Download URLs in README.md work immediately after release is created

## Files Requiring Updates

| File | Location | Pattern to Update |
|------|----------|-------------------|
| package.json | Line 3 | Already handled by npm version |
| src/index.ts | Line ~57 | `version: "X.X.X",` → `version: "{NEW_VERSION}",` |
| README.md | Multiple | `vX.X.X` (matches v + semver pattern) → `v{NEW_VERSION}` |
| bundle/manifest.json | Line 4 | `"version": "X.X.X"` → `"version": "{NEW_VERSION}"` |

## Implementation Approach

### Version Sync Script

- **Location**: `scripts/update-version.js`
- **Integration**: Add to package.json: `"version": "node scripts/update-version.js && git add -A"`
- **Dry-run**: Support `--dry-run` flag via `node scripts/update-version.js --dry-run`
- **Platform**: Use Node.js (not bash) for cross-platform compatibility

### GitHub Actions Workflow

- **File**: Create new `.github/workflows/release.yml`
- **Trigger**: `on: push: tags: ['v*']` (any tag starting with 'v')
- **Actions**:
  - Use `softprops/action-gh-release@v1` for release creation
  - Use GitHub's auto-generated release notes from commits
  - Run `npm ci && npm run build && mcpb pack` to generate bundle
- **Integration**: Existing `.github/workflows/publish.yml` already triggers on `on: release: types: [published]`

## Complete Automation Flow

```bash
# Developer runs:
npm version patch              # 1. Updates 4 files automatically + creates git tag
git push origin main --tags    # 2. Pushes tag to GitHub

# GitHub Actions automatically:
# 3. Detects version tag push
# 4. Runs `mcpb pack` to generate bundle.dxt
# 5. Creates GitHub release with bundle.dxt attached
# 6. Generates release notes from commit messages
# 7. Triggers publish workflow
# 8. Publishes to NPM with provenance
```

## Success Definition

Developer runs `npm version patch`, all version references are automatically synchronized, then pushes the version tag. GitHub automatically creates a release with the MCP bundle attached, which triggers the publish workflow to deploy to NPM. The entire process from version bump to NPM publication requires no manual file updates or UI interactions.

---

**Document Version**: 1.0
**Status**: Draft - Ready for Review
