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

1. `npm version patch|minor|major` — bumps `package.json`, runs `scripts/update-version.js` (syncs version into `src/index.ts`, `README.md`, `bundle/manifest.json`), commits, and creates a git tag.
2. Push the tag: `git push --follow-tags`
3. GitHub Actions (`release.yml`) builds, packages `bundle.dxt`, creates GitHub release with the bundle attached.
4. GitHub Actions (`publish.yml`) triggers on release publish: runs matrix tests (Node 18/20/22 × 3 OS), audits, verifies tag/version match, then publishes to NPM with provenance.

**Never manually edit version numbers** — always go through `npm version` so the sync script keeps everything consistent.
