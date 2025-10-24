# Specification: Automated Version Management

## Problem Statement

When publishing a new version, developers must manually:

1. Update version references in multiple locations:
   - **package.json** - NPM package version
   - **src/index.ts** - MCP server runtime version
   - **README.md** - GitHub release download URLs (2 locations)

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
- **FR3**: Integrate with `npm version` command so all updates happen automatically
- **FR4**: Stage all version-related file changes for the version commit

### Validation

- **FR5**: Verify all files were successfully updated before completing
- **FR6**: Provide clear error messages if any file update fails

### Developer Experience

- **FR7**: Support dry-run mode to preview changes without applying them
- **FR8**: Work consistently across Windows, macOS, and Linux platforms
- **FR9**: Script must be idempotent (safe to run multiple times)

### GitHub Release Automation

- **FR10**: When a version tag (e.g., `v1.0.3`) is pushed to the repository, automatically create a GitHub release
- **FR11**: GitHub release creation triggers the existing publish workflow (`.github/workflows/publish.yml`)
- **FR12**: Generate release notes automatically from commit messages between tags
- **FR13**: Attach the MCP bundle file (`.dxt`) to the GitHub release as a downloadable asset

## Acceptance Criteria

### Automated Updates
- [ ] Running `npm version patch` updates all 3 files automatically (package.json, src/index.ts, README.md)
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
- [ ] GitHub release triggers the publish workflow
- [ ] Release notes are generated and included in the release
- [ ] MCP bundle file is attached to the release as a downloadable asset
- [ ] Download URLs in README.md work immediately after release is created

## Files Requiring Updates

| File | Location | What to Update |
|------|----------|----------------|
| package.json | Line 3 | Already handled by npm version |
| src/index.ts | Line ~57 | MCP server version string |
| README.md | Lines 3, 15 | GitHub release URL version tags |

## Success Definition

Developer runs `npm version patch`, all version references are automatically synchronized, then pushes the version tag. GitHub automatically creates a release with the MCP bundle attached, which triggers the publish workflow to deploy to NPM. The entire process from version bump to NPM publication requires no manual file updates or UI interactions.

---

**Document Version**: 1.0
**Status**: Draft - Ready for Review
