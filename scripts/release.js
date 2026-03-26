#!/usr/bin/env node
// @ts-check
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function parseSemver(v) {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts;
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = parseSemver(current);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  return bump; // exact semver string
}

function isGreaterThan(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

function currentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
}

function run(cmd, dryRun) {
  if (dryRun) {
    console.log(`  [dry-run] ${cmd}`);
    return;
  }
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// ── main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force  = args.includes('--force');
const dev    = args.includes('--dev');
const posArgs = args.filter(a => !a.startsWith('--'));

const bumpArg = posArgs[0] ?? 'patch';
const validBumps = ['patch', 'minor', 'major'];
const isExact = !validBumps.includes(bumpArg);

if (isExact && !parseSemver(bumpArg)) {
  console.error(`❌ Invalid version argument: "${bumpArg}"`);
  console.error('   Use patch, minor, major, or an exact version like 3.0.0');
  process.exit(1);
}

console.log(`\n🚀 ${dev ? 'Dev Build' : 'Release'} Pipeline\n`);

// Branch guard (skipped for dev builds — no commit/tag will be created)
const branch = currentBranch();
if (branch !== 'main' && !force && !dev) {
  console.error(`❌ Current branch: ${branch}`);
  console.error('   Releases should be created from the main branch.');
  console.error('   Use --force to override (e.g. for release candidates).');
  console.error('   Use --dev to build a local .dxt without committing or tagging.');
  process.exit(1);
}

const currentVersion = readCurrentVersion();
const targetVersion  = bumpVersion(currentVersion, bumpArg);

if (!parseSemver(targetVersion)) {
  console.error(`❌ Could not resolve a valid target version from "${bumpArg}"`);
  process.exit(1);
}

if (!isGreaterThan(targetVersion, currentVersion)) {
  console.error(`❌ Target version ${targetVersion} is not greater than current version ${currentVersion}.`);
  console.error('   Downgrades and same-version bumps are not allowed.');
  process.exit(1);
}

const label = isExact ? 'exact' : bumpArg;
console.log(`📦 Current version: ${currentVersion}`);
console.log(`🎯 Target version:  ${targetVersion} (${label})`);

if (dryRun) {
  console.log('\n[dry-run] No changes will be made.\n');
  console.log('Step 1/2: Bumping version...');
  if (dev) {
    run(`npm version ${bumpArg} --no-git-tag-version --force`, true);
  } else {
    run(`npm version ${bumpArg} -m "release: v%s" --force`, true);
  }
  console.log('Step 2/2: Building artifacts...');
  run('npm run build:all', true);
  console.log(`\n🎉 ${dev ? 'Dev build' : 'Release'} ${targetVersion} ready! (dry-run)`);
  process.exit(0);
}

console.log('\nStep 1/2: Bumping version...');
try {
  if (dev) {
    run(`npm version ${bumpArg} --no-git-tag-version --force`, false);
  } else {
    run(`npm version ${bumpArg} -m "release: v%s" --force`, false);
  }
  console.log(`  ✅ Version bumped and synced to ${targetVersion}`);
} catch {
  console.error('  ❌ Version bump failed.');
  process.exit(1);
}

console.log('\nStep 2/2: Building artifacts...');
try {
  run('npm run build:all', false);
  console.log(`  ✅ tempo-filler-mcp-server-${targetVersion}.dxt created`);
} catch {
  console.error('  ❌ Build failed.');
  process.exit(1);
}

if (dev) {
  console.log(`\n⚠️  Dev build ${targetVersion} created (no commit, no tag).`);
  console.log('   Modified files:');
  console.log('     package.json, src/server-core.ts, README.md, bundle/manifest.json');
  console.log('   To revert: git checkout -- package.json src/server-core.ts README.md bundle/manifest.json\n');
} else {
  console.log(`\n🎉 Release ${targetVersion} ready!`);
  console.log('   Next: git push --follow-tags\n');
}
