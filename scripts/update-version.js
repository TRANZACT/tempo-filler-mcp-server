#!/usr/bin/env node

/**
 * Version Synchronization Script
 *
 * Automatically updates version references across the project when package.json version changes.
 * Integrated with `npm version` command via lifecycle hook.
 *
 * Usage:
 *   node scripts/update-version.js           # Update all files
 *   node scripts/update-version.js --dry-run # Preview changes without applying
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FILES_TO_UPDATE = [
  {
    name: 'src/index.ts',
    path: path.join(PROJECT_ROOT, 'src', 'index.ts'),
    pattern: /version:\s*"[0-9]+\.[0-9]+\.[0-9]+"/,
    replacement: (version) => `version: "${version}"`
  },
  {
    name: 'README.md',
    path: path.join(PROJECT_ROOT, 'README.md'),
    pattern: /v[0-9]+\.[0-9]+\.[0-9]+/g,
    replacement: (version) => `v${version}`
  },
  {
    name: 'bundle/manifest.json',
    path: path.join(PROJECT_ROOT, 'bundle', 'manifest.json'),
    pattern: /"version":\s*"[0-9]+\.[0-9]+\.[0-9]+"/,
    replacement: (version) => `"version": "${version}"`
  }
];

/**
 * Read the current version from package.json
 */
function getPackageVersion() {
  try {
    const packagePath = path.join(PROJECT_ROOT, 'package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    return packageJson.version;
  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    process.exit(1);
  }
}

/**
 * Update a single file with the new version
 */
function updateFile(file, newVersion) {
  try {
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      console.error(`❌ Error: File not found: ${file.name}`);
      return false;
    }

    // Read file content
    const content = fs.readFileSync(file.path, 'utf8');

    // Replace version references
    const updatedContent = content.replace(file.pattern, file.replacement(newVersion));

    // Check if any changes were made
    if (content === updatedContent) {
      console.log(`ℹ️  No changes needed in ${file.name}`);
      return true;
    }

    // Show what will change
    const matches = content.match(file.pattern);
    if (matches) {
      console.log(`✏️  Updating ${file.name}:`);
      if (file.pattern.global) {
        console.log(`   Found ${matches.length} occurrence(s)`);
      }
      console.log(`   ${matches[0]} → ${file.replacement(newVersion)}`);
    }

    // Write file if not dry-run
    if (!DRY_RUN) {
      fs.writeFileSync(file.path, updatedContent, 'utf8');
      console.log(`✅ Updated ${file.name}`);
    } else {
      console.log(`🔍 [DRY-RUN] Would update ${file.name}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error updating ${file.name}:`, error.message);
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🔄 Version Synchronization Script\n');

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN MODE: No files will be modified\n');
  }

  // Get new version from package.json
  const newVersion = getPackageVersion();
  console.log(`📦 Package version: ${newVersion}\n`);

  // Update all files
  let allSuccessful = true;
  for (const file of FILES_TO_UPDATE) {
    const success = updateFile(file, newVersion);
    allSuccessful = allSuccessful && success;
  }

  // Summary
  console.log();
  if (allSuccessful) {
    if (DRY_RUN) {
      console.log('✅ Dry-run completed successfully');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('✅ All version references synchronized');
      console.log(`   Version ${newVersion} applied to all files`);
    }
    process.exit(0);
  } else {
    console.error('❌ Some files failed to update');
    process.exit(1);
  }
}

// Run the script
main();
