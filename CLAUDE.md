# CLAUDE.md

## Build & Dev Commands

```bash
npm run build          # tsc + vite UI bundles (run before publish)
npm run build:ui       # vite build for get-schedule and get-worklogs UIs only
npm run build:mcpb     # package .dxt bundle for Claude Desktop distribution
npm run build:all      # build + build:mcpb
npm run dev            # tsc + run stdio server (production transport)
npm run dev:http       # tsc + run HTTP server on :3001 (for MCP Apps UI testing)
npm run typecheck      # type-check without emitting
npm run test:coverage  # run tests with coverage report (v8)
```

Output goes to `dist/`. Always run `npm run build` before testing end-to-end.

## Architecture

```
AI Assistant → MCP Server → TempoClient → [JIRA API + Tempo API] → Response → AI
                   ↓
              UI Resources → MCP Apps Host → Visual Rendering
```

**Entry points:**
- `src/index.ts` — stdio transport (production, Claude Desktop / VS Code)
- `src/http-server.ts` — HTTP transport (Express, port 3001, MCP Apps UI dev)

**Core module:**
- `src/tempo-client.ts` — all API calls; PAT auth, issue caching (5-min TTL), user identity caching

**Tools** (`src/tools/`): `get-worklogs`, `post-worklog`, `update-worklog`, `bulk-post`, `bulk-delete`, `bulk-update`, `delete-worklog`, `get-schedule`, barrel `index.ts`

**Type system layers** (`src/types/`):
- `tempo.ts` — raw API shapes (JIRA/Tempo responses, payloads)
- `mcp.ts` — Zod schemas + inferred types for tool inputs; constants (TOOL_NAMES, ENV_VARS, DEFAULTS)
- `responses.ts` — structured JSON response types for tool outputs

**UI components** (`src/ui/`): self-contained HTML bundles built by Vite (`vite-plugin-singlefile`), rendered via `@modelcontextprotocol/ext-apps`.

## Key Conventions

- **ESM with `.js` imports** — TypeScript target is ES2022, module resolution is Node16. All relative imports must end in `.js` even for `.ts` source files.
- **Zod for all inputs** — define schemas in `src/types/mcp.ts`, derive TS types with `z.infer<>`. Never accept raw unvalidated tool args.
- **Barrel exports** — `src/tools/index.ts` and `src/types/index.ts` re-export everything; import from the barrel, not individual files.
- **stderr-only logging** — MCP uses stdout for the protocol; all debug/error output must go to `console.error(...)`. Never `console.log` in server code.
- **JSON tool responses** — all tools return structured JSON (types in `responses.ts`), not markdown strings.
- **Issue caching** — use `TempoClient`'s built-in cache when resolving JIRA keys to numeric IDs; don't bypass it.
- **Batch processor pattern** — all bulk operations (post, update, delete) use `executeChunked()` from `batch-processor.ts` for chunked concurrent execution with retry on rate-limit/timeout errors.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TEMPO_BASE_URL` | Yes | JIRA instance root URL, e.g. `https://jira.company.com` |
| `TEMPO_PAT` | Yes | JIRA Personal Access Token with worklog read/write |
| `TEMPO_DEFAULT_HOURS` | No | Default hours per workday (default: 8) |
| `PORT` | No | HTTP server port for `dev:http` mode (default: 3001) |

## Release Workflow

### Official release (main branch → CI → NPM + GitHub Release)
1. `npm run release` — validates branch (must be `main`), bumps patch (default), syncs version + tools, commits, tags, builds `.dxt`. Override with `minor`, `major`, or exact version. Use `--force` to skip branch guard.
2. `git push --follow-tags` — triggers CI.
   **PowerShell:** `npm run release -- <args>` may not forward arguments. Use `node scripts/release.js <args>` directly.
3. `release.yml` (on `v*` tag) → builds, packages `.dxt`, creates GitHub Release.
4. `publish.yml` (on release publish) → matrix tests (Node 18/20/22 × 3 OS), audit, version check, `npm publish --provenance`.

### Dev/testing builds (any branch)
- `node scripts/release.js --dev` — bumps version, syncs all files, builds `.dxt`, but creates no commit or tag. Revert with `git checkout -- package.json src/server-core.ts README.md bundle/manifest.json`.
- `npm run build:all` — builds `.dxt` with the current version (no bump). Safe anywhere.

### How version sync works
- **Source of truth:** `package.json` version field.
- **`scripts/update-version.js`** syncs version to `server-core.ts`, `README.md`, `bundle/manifest.json`. Runs automatically during `npm version` (lifecycle hook) and as a safety net during `build:mcpb`.
- **`scripts/sync-manifest.js`** syncs tool descriptions from `TOOL_REGISTRY` (`src/types/mcp.ts`) into `bundle/manifest.json`. Runs during `build:mcpb`.
- **Never manually edit version numbers** — use `npm run release`.

### Downgrading version (manual)
`release.js` blocks downgrades by design. To force a lower version:

**Bash / Git Bash:**
```bash
npm version <target> --no-git-tag-version --force && node scripts/update-version.js
```
**PowerShell:**
```powershell
npm version <target> --no-git-tag-version --force; node scripts/update-version.js
```

This sets `package.json` and syncs the other files without creating a commit or tag.
