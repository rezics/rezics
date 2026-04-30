# Contributing

## Project Overview

Library.Book (rezics-book-library) is a full-stack TypeScript monorepo using **Bun** workspaces. Packages live under `package/`.

## Development Setup

**Prerequisites:** Bun, PostgreSQL, Meilisearch

```bash
bun install
bun run dev              # Start all dev services
bun run app:dev          # Frontend only (Vite, port 35001)
bun run server:dev       # Backend only (Elysia with --watch)
```

## Conventions

### Route Convention

Resource prefixes are **singular**: `/book`, `/user`, `/post`.

Collection access uses the **`/list` suffix**:
- `GET /{resource}/list?ids=a,b,c` — small, cacheable CSV (up to 200 ids)
- `POST /{resource}/list` — large id arrays or nested filters (JSON body)

Every `*ListQuerySchema` spreads `listGetQueryBase.properties` from `@rezics/contract` for the shared `ids` field. POST body schemas spread `listPostBodyBase.properties`. Services call `parseIdsCsv(query.ids)` and intersect with other where-clause filters.

`@rezics/auth` is out of scope (governed by better-auth).

### Folder Convention (dual-track)

- **Domain / feature folders** are **singular**: `book/`, `user/`, `translation-group/`
- **Container folders** are **plural** from a fixed allowlist: `hooks`, `utils`, `components`, `pages`, `sections`, `states`, `models`, `types`, `routes`, `handlers`, `providers`, `plugins`, `styles`, `helpers`, `constants`, `fixtures`, `mocks`, `layouts`, `assets`, `docs`, `templates`
- Everything else is singular. Allowlist changes require a spec amendment.

### Enforcement

```bash
bun run check:convention   # Scans routes and folders; exits non-zero on violations
```

- Pre-commit hook runs it in `--staged` mode
- PR merge gate runs a full scan (GitHub Actions on PRs to `dev`)
- Not in CI on every push
- No per-site suppression — only spec amendments

### Full Specs

- `openspec/specs/api-route-convention/spec.md`
- `openspec/specs/folder-naming-convention/spec.md`
- `openspec/specs/convention-enforcement/spec.md`

## Seeding

The unified CLI is `bun run seed` (entry: `package/utils/bin/cli.ts`). It covers users, infrastructure, and factory (synthetic dev) data.

**Two seed concepts**, kept separate for safety:
- **`package/server/prisma/seed/`** — production-required infra: default realm, content type tags, root user, meilisearch init. Idempotent.
- **`package/server/prisma/factory/`** — dev/demo synthetic data generators (books, posts, shelves, users, …) with presets and a `SeedPlan` framework. Never run in production.

```bash
# Fully interactive (multi-select users / infrastructure / factory)
bun run seed

# Factory data only, named preset, no prompts
bun run seed:factory              # alias for --preset=realistic --no-interactive
bun run seed:factory:fast         # alias for --preset=fast --no-interactive
bun run seed --preset=minimal --no-interactive
```

**Presets** (`package/utils/src/factory/presets/`):

| Preset           | Mode      | Use                                                    |
| ---------------- | --------- | ------------------------------------------------------ |
| `realistic`      | realistic | Default — power-law distributed counts, prod-ish shape |
| `fast`           | realistic | Smaller envelope for quick iteration                   |
| `minimal`        | fixed     | Tiny deterministic dataset for unit-style scenarios    |
| `post-tree-focus`| fixed     | One work per type, deterministic post tree shape       |

**Plan tweaking.** When running interactively, after picking a preset you can tweak the `SeedPlan` in `$VISUAL`/`$EDITOR` (notepad on Windows, vi otherwise). The plan is dumped as JSON in `node_modules/.cache/rezics-seed/edit-*/plan.json`, validated against `SeedPlanSchema` on save, and re-prompted on parse errors. Stale edit dirs older than one hour are swept on every CLI start.

**Modes.** A `Mode` (`realistic | fixed | uniform`) is set once per preset and threaded through `SeedCtx`; each `CountSpec = { min?, max, target?, alpha? }` is interpreted by `ctx.draw(spec)`:
- `realistic` → `powerLaw(min ?? 0, max, alpha ?? 1.5)`
- `fixed` → clamp(`target ?? floor((min+max)/2)`, min, max)
- `uniform` → `randInt(min ?? 0, max)`

Seeders never read counts directly — all count decisions go through `ctx.draw(...)`. R7 (`bun run check:convention`) blocks new `powerLaw` imports outside `strategy.ts`/`utils.ts`.

The retired `SEED_*` env vars (e.g. `SEED_PROFILE=fast`) no longer have any effect — replace with `--preset=<name>`.

## Change Management

This project uses **OpenSpec** for non-trivial changes. See `CLAUDE.md` for workflow commands.

## Code Style

- **Formatter:** Prettier (2 spaces, single quotes, trailing commas)
- **Comments:** None by default; only add when the "why" is non-obvious
- **Branch:** `dev` is the main branch
