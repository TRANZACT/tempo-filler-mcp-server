#!/usr/bin/env node

/**
 * Manifest Tools Synchronization Script
 *
 * Reads TOOL_REGISTRY from compiled dist/types/mcp.js and replaces the `tools`
 * array in bundle/manifest.json so the two never drift apart.
 *
 * Requires dist/ to exist — run `tsc` (or `npm run build`) first.
 *
 * Usage:
 *   node scripts/sync-manifest.js           # update manifest in-place
 *   node scripts/sync-manifest.js --dry-run # preview without writing
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'bundle', 'manifest.json');
const REGISTRY_PATH = join(ROOT, 'dist', 'types', 'mcp.js');
const DRY_RUN = process.argv.includes('--dry-run');

console.log('🔧 Manifest Tools Sync\n');

if (DRY_RUN) {
  console.log('🔍 DRY-RUN MODE: No files will be modified\n');
}

// Dynamically import TOOL_REGISTRY from compiled output
let TOOL_REGISTRY;
try {
  const module = await import(pathToFileURL(REGISTRY_PATH).href);
  TOOL_REGISTRY = module.TOOL_REGISTRY;
} catch (err) {
  console.error(`❌ Failed to import TOOL_REGISTRY from ${REGISTRY_PATH}`);
  console.error('   Make sure you have run tsc (or npm run build) first.');
  console.error(`   ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(TOOL_REGISTRY) || TOOL_REGISTRY.length === 0) {
  console.error('❌ TOOL_REGISTRY is empty or not an array');
  process.exit(1);
}

// Read current manifest
let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  console.error(`❌ Failed to read ${MANIFEST_PATH}: ${err.message}`);
  process.exit(1);
}

// Build tools array from registry
const newTools = TOOL_REGISTRY.map(({ name, description }) => ({ name, description }));
const oldTools = manifest.tools ?? [];

const added = newTools.filter((t) => !oldTools.some((o) => o.name === t.name)).map((t) => t.name);
const removed = oldTools.filter((o) => !newTools.some((t) => t.name === o.name)).map((o) => o.name);
const updated = newTools.filter((t) => {
  const old = oldTools.find((o) => o.name === t.name);
  return old && old.description !== t.description;
}).map((t) => t.name);

if (added.length === 0 && removed.length === 0 && updated.length === 0) {
  console.log('ℹ️  No changes needed in bundle/manifest.json');
  process.exit(0);
}

if (added.length > 0) console.log(`   ➕ Adding:   ${added.join(', ')}`);
if (removed.length > 0) console.log(`   ➖ Removing: ${removed.join(', ')}`);
if (updated.length > 0) console.log(`   ✏️  Updating: ${updated.join(', ')}`);

manifest.tools = newTools;

if (!DRY_RUN) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('\n✅ bundle/manifest.json tools synced');
} else {
  console.log('\n🔍 [DRY-RUN] Would update bundle/manifest.json');
}
