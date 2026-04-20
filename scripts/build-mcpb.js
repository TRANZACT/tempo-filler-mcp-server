#!/usr/bin/env node
import { execSync } from 'child_process';
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const ROOT = join(__dirname, '..');
const BUNDLE = join(ROOT, 'bundle');
const DIST = join(ROOT, 'dist');

// Read version from package.json for output filename
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const OUTPUT_NAME = `tempo-filler-mcp-server-${pkg.version}.dxt`;

console.log('🔧 Building MCPB bundle...\n');

// 1. Clean bundle directories
console.log('1. Cleaning bundle directories...');
rmSync(join(BUNDLE, 'server'), { recursive: true, force: true });
rmSync(join(BUNDLE, 'node_modules'), { recursive: true, force: true });
if (existsSync(join(BUNDLE, 'package.json'))) {
  rmSync(join(BUNDLE, 'package.json'));
}

// 2. Build TypeScript and UI
console.log('2. Compiling TypeScript and UI...');
execSync('npm run build:ui && tsc', { stdio: 'inherit', cwd: ROOT });

// 2a. Sync version across all files
console.log('2a. Syncing version...');
execSync('node scripts/update-version.js', { stdio: 'inherit', cwd: ROOT });

// 2b. Sync manifest tools from TOOL_REGISTRY
console.log('2b. Syncing manifest tools...');
execSync('node scripts/sync-manifest.js', { stdio: 'inherit', cwd: ROOT });

// 3. Copy dist/ to bundle/server/
console.log('3. Copying dist/ to bundle/server/...');
mkdirSync(join(BUNDLE, 'server'), { recursive: true });
cpSync(DIST, join(BUNDLE, 'server'), { recursive: true });

// 4. Create bundle package.json with production deps only
console.log('4. Creating bundle package.json...');
const bundlePkg = {
  name: pkg.name,
  version: pkg.version,
  type: 'module',
  dependencies: pkg.dependencies
};
writeFileSync(join(BUNDLE, 'package.json'), JSON.stringify(bundlePkg, null, 2));

// 5. Install production dependencies (omit dev and optional like @oven/bun)
console.log('5. Installing production dependencies...');
execSync('npm install --omit=dev --omit=optional', { stdio: 'inherit', cwd: BUNDLE });

// 6. Pack with mcpb
console.log('6. Creating MCPB bundle...');
execSync('npx @anthropic-ai/mcpb pack bundle', { stdio: 'inherit', cwd: ROOT });

// 7. Rename to .dxt with version
console.log('7. Renaming to .dxt...');
const mcpbPath = join(ROOT, 'bundle.mcpb');
const dxtPath = join(ROOT, OUTPUT_NAME);
if (existsSync(dxtPath)) {
  rmSync(dxtPath);
}
renameSync(mcpbPath, dxtPath);

console.log(`\n✅ Bundle created: ${OUTPUT_NAME}`);
