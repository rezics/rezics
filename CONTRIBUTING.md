# Contributing

## Project Overview

Rezics (repo `rezics/rezics`) is a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works — books, games, media, posts,
shelves, tags, and community `realm`s, all modeled as a unified `Unit`.
Communities (`realm`s) collectively classify and discuss works, co-locating a
work's index, discussion, and collaborative knowledge. Package manager:
**Yarn 4** (node-modules linker). Workspaces live under `packages/`.

## Development Setup

**Prerequisites:** devenv (provides Node.js, Bun, Yarn, Nomad, go-task, PostgreSQL client)

```bash
yarn install             # install workspace deps
task                     # list every task (task --list)
task dev                 # start full dev environment (Nomad: infra + app services)
task dev:stop            # stop all services
task dev:status          # show service status
task dev:logs -- server  # follow logs for a specific task
task frontend:dev        # frontend only (Next.js + Turbopack, port 35001)
task backend:dev         # backend only (Effect HttpApi with tsx watch)
```

`task dev` starts the full development environment through Nomad
(`deploy/dev/`). Infrastructure (PostgreSQL, Meilisearch, Redis, RustFS,
Sequin) runs as Docker containers managed by Nomad. Application dev servers
(backend, frontend) run as raw_exec tasks with filesystem watch.

If the source database comes from an old or manually modified volume, verify CDC
readiness first:

```bash
task cdc:verify
task cdc:repair -- --source=reaction   # repair reaction source only
task cdc:recover                       # end-to-end: repair + restart Sequin + verify
```

## Git Workflow

`main` is the only integration baseline for current work. Feature, fix, and
refactor branches start from `main`; completed work enters `main` as one
coherent squash commit unless a maintainer explicitly chooses another merge
strategy.

Use task branches such as `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`, or
`<owner>/<topic>` for active work. Preserve detailed task history under
`archive/YYMMDD-type-topic` before landing the squash commit on `main`.

`main` should answer which completed feature, fix, or refactor introduced a
line. `archive/*` should answer which internal task commit introduced it.

See `docs/guide/git-workflow.md` for branch roles, task lifecycle, archive
trailers, mainline cutovers, and blame tracing.

## Conventions

### Route Convention

Resource prefixes are **singular**: `/book`, `/user`, `/post`.

Collection access uses the **`/list` suffix**:
- `GET /{resource}/list?ids=a,b,c` — small, cacheable CSV (up to 200 ids)
- `POST /{resource}/list` — large id arrays or nested filters (JSON body)

List query patterns are defined in the backend API interfaces (`packages/backend/src/services/api/interfaces/`). GET list endpoints accept an `ids` CSV param (up to 200 ids); POST list endpoints accept JSON body with id arrays or nested filters.

`@rezics/auth` is out of scope (governed by better-auth).

### Folder Convention (dual-track)

- **Domain / feature folders** are **singular**: `book/`, `user/`, `translation-group/`
- **Container folders** are **plural** from a fixed allowlist: `hooks`, `utils`, `components`, `pages`, `sections`, `states`, `models`, `types`, `routes`, `relations`, `handlers`, `providers`, `plugins`, `styles`, `helpers`, `constants`, `fixtures`, `mocks`, `layouts`, `assets`, `docs`, `templates`
- Everything else is singular. Allowlist changes require a spec amendment.

### Enforcement

```bash
task check:convention   # Scans routes and folders; exits non-zero on violations
```

- Pre-commit hook runs it in `--staged` mode
- PR merge gate runs a full scan (GitHub Actions on PRs to `main`)
- Not in CI on every push
- No per-site suppression — only spec amendments

### URL Convention: short-prefix = slug, long-prefix = unitId

Every public Unit-resolving URL falls into one of two families, and the prefix tells the reader which one:

- **Short-prefix routes** (`/u`, `/r`, `/t`, `/z`, `/e`) take a **slug**. Examples: `/u/alice`, `/r/slow-reading`, `/t/spec-fic`. Slugs are resolved against the per-scope `SlugScope` row.
- **Long-prefix routes** (`/user`, `/realm`, `/tag`, `/zone`, `/entity`, `/unit`) take a **UUID**. Examples: `/user/01976a…`, `/unit/01976a…`. UUIDs resolve `Unit.id` directly.

Mixing the two is forbidden: a slug under a long prefix or a UUID under a short prefix MUST be rejected at the route layer (typed by-slug endpoints like `/user/by-slug/:slug` are the only exception and exist precisely so this rule stays clean).

`R10` in `task check:convention` flags route definitions whose param names violate this convention (a `:userSlug` under `/user`, or a `:unitId` under `/u`).

### Enforcement

These conventions are enforced by `task check:convention`; each rule
(`tool/src/commands/convention/rules/`) states its own normative rule and is
the authoritative source.

## Database Workflow

Backend schema lives in `@rezics/backend`. The database schema is in
`packages/backend/src/services/database/schema/`. There is one PostgreSQL
database (`rezics_server`) for the main application.

Schema migrations are Drizzle-first: edit the owning package's Drizzle schema,
generate migrations with the repo `db:generate` workflow, then validate with
`db:migrate` or `db:reset`. Do not hand-author ordinary table, column, index, or
foreign-key migrations. Hand-written SQL is only for database features Drizzle
cannot express, or for correcting a documented Drizzle-generated SQL defect
while keeping the schema source in sync.

```bash
task db:generate
task db:migrate
task db:deploy
task db:reset -- --yes
task db:ensure
task db:smoke
```

`db:migrate` runs the schema migrations. The tool preflight requires a
reachable PostgreSQL 18+ database with built-in `uuidv7()`.

Resetting local databases is destructive and development-only. After a reset,
run the required seed and optional factory workflows explicitly; never depend on
application startup to backfill seed/factory data.

See `docs/guide/database-workflow.md` for the full migration policy, custom SQL
rules, and Drizzle rc caveats.

## Seeding

The unified CLI is `task seed` (entry: `tool/bin/tool.ts`). It covers users, infrastructure, and factory (synthetic dev) data.

**Two seed concepts**, kept separate for safety:
- **`tool/src/commands/seed/`** — production-required infra: default realm, content type tags, root user, meilisearch init. Idempotent.
- **`tool/src/commands/factory/`** — dev/demo synthetic data generators (books, posts, shelves, users, ...) with presets and a `SeedPlan` framework. Never run in production.

Seed and factory flows synchronize Meilisearch directly. Setup-time
seed/factory flows must not require external workers or job queues.

```bash
# Interactive baseline seed; does not reset databases
task seed

# Factory data only, named preset, no prompts
task seed:factory              # shortcut for --preset=realistic --no-interactive
task seed:factory:fast         # shortcut for --preset=fast --no-interactive
task seed:factory:medium       # shortcut for --preset=medium --no-interactive
task factory -- --preset=minimal --no-interactive

# Explicit destructive reset
task seed:database-reset
# CI/headless reset requires explicit confirmation
task seed:database-reset -- --yes
```

**Presets** (defined in the factory command):

| Preset            | Mode      | Use                                                                                                    |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `realistic`       | realistic | Default — power-law distributed counts, prod-ish shape                                                 |
| `fast`            | realistic | Smaller envelope for quick iteration                                                                   |
| `medium`          | fixed     | Mid-volume deterministic dataset (50 books/games/media, 40 tags, 20 reviews + 100 tree posts per work) |
| `minimal`         | fixed     | Tiny deterministic dataset for unit-style scenarios                                                    |
| `post-tree-focus` | fixed     | One work per type, deterministic post tree shape                                                       |

**Plan tweaking.** When running interactively, after picking a preset you can tweak the `SeedPlan`. The CLI writes it as JSON to `node_modules/.cache/rezics-seed/edit-*/plan.json`, prints the absolute path, and waits at a "Done editing — continue?" prompt. Open the file in any editor, save, then confirm to continue; the plan is validated against `SeedPlanSchema` and you are re-prompted on parse or validation errors. Stale edit dirs older than one hour are swept on every CLI start.

**Modes.** A `Mode` (`realistic | fixed | uniform`) is set once per preset and threaded through `SeedCtx`; each `CountSpec = { min?, max, target?, alpha? }` is interpreted by `ctx.draw(spec)`:
- `realistic` → `powerLaw(min ?? 0, max, alpha ?? 1.5)`
- `fixed` → clamp(`target ?? floor((min+max)/2)`, min, max)
- `uniform` → `randInt(min ?? 0, max)`

Seeders never read counts directly — all count decisions go through `ctx.draw(...)`. R7 (`task check:convention`) blocks new `powerLaw` imports outside `strategy.ts`/`utils.ts`.

## UI Component Policy

Pick UI primitives in this order:

1. **Shark UI** — `@shark` registry (Ark UI based, generated in `packages/frontend/src/components/ui/`) — never hand-edit generated files
2. **Custom components** — feature-local `components/`

Icons: `lucide-react` by default, `@tabler/icons-react` as the named fallback when lucide lacks the glyph.

### Frontend Copy and i18n

All user-facing frontend product copy must go through `@nmnmcc/intee`, not
hard-coded strings in JSX or component state. Language files live in
`packages/frontend/src/lib/i18n/languages/`.

Use `useTranslation` from `@nmnmcc/intee` in React components. For dynamic enum
or slug labels, use typed key maps instead of branching to raw strings in app
code.

User-generated content, imported catalog metadata, API identifiers, test fixture
data, route paths, aria IDs, and non-display constants are not product copy and
do not need i18n keys.

The retired `SEED_*` env vars (e.g. `SEED_PROFILE=fast`) no longer have any effect — replace with `--preset=<name>`.

## Change Management

Planning is **code-first**: capture a plan in `plan/proposal/<change>.md` with
`/rezics-propose`, implement with `/rezics-apply`, and route durable knowledge
into code (types/tests/comments) so the plan file stays disposable. See
`plan/README.md`.

## Code Style

- **Formatter:** Biome (primary). Prettier handles import sorting and Tailwind class ordering.
- **Comments:** None by default; only add when the "why" is non-obvious
- **Branch:** `main` is the main branch
