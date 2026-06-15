# Contributing

## Project Overview

Rezics (repo `rezics/rezics`) is a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works — books, games, media, posts,
shelves, tags, and community `realm`s, all modeled as a unified `Unit`.
Communities (`realm`s) collectively classify and discuss works, co-locating a
work's index, discussion, and collaborative knowledge. Built on **Bun**
workspaces; packages live under `package/`.

## Development Setup

**Prerequisites:** Bun, Zellij, Nomad (local agent for dev infrastructure)

```bash
bun install              # install workspace deps (Bun is the package manager)
task                     # list every task (task --list)
task dev                 # Start all dev processes (zellij)
task devenv:up           # Start all dev processes (devenv process-compose)
task app:dev             # Frontend only (Vite, port 35001)
task server:dev          # Backend only (Elysia with --watch)
task history:dev         # History service only (Elysia, port 3004)
```

`task dev` starts application processes only. It does not provision external
dependencies such as PostgreSQL, Meilisearch, Redis, object storage, or Sequin.
Infrastructure runs as Nomad jobs (`nomad/jobs/infra-*.nomad.hcl`) on a local
Nomad agent.

If the source database comes from an old or manually modified volume, verify CDC
readiness first:

```bash
task cdc:verify
task cdc:repair                        # repair publications and replication slots
task cdc:repair -- --source=reaction   # repair reaction source only
```

Start any other required external services first, then start the dependent
application process. A service failing fast because an external dependency is
unavailable is expected behavior when the error points at the missing service
and setup command.

The local dev layout keeps `@rezics/job-runner` eligible to auto-start. If its
`http` or `all` role needs Sequin, start the managed services first or use
`JOB_RUNNER_ROLE=worker` for queue draining without webhook ingress.

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

Every `*ListQuerySchema` spreads `listGetQueryBase.properties` from `@rezics/contract` for the shared `ids` field. POST body schemas spread `listPostBodyBase.properties`. Services call `parseIdsCsv(query.ids)` and intersect with other where-clause filters.

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

Backend schema ownership is package-local. `@rezics/server` and `@rezics/auth`
use separate Drizzle schemas and databases; `notify`, `reaction`, `history`,
and `ranking` also own package-specific Drizzle schemas. `job-runner` is the
exception: its database is pg-boss-owned, so it uses `db:ensure` rather than
Drizzle schema migrations.

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

`db:migrate`, `db:deploy`, and `db:reset` run schema owners in package order:
`auth -> server -> notify -> reaction -> history -> ranking`. The tool preflight
requires a reachable PostgreSQL 18+ database with built-in `uuidv7()`. Each
schema owner keeps migrations in its package-local `drizzle/` folder and uses
Drizzle Kit's default migration journal table.

Resetting local databases is destructive and development-only. After a reset,
run the required seed and optional factory workflows explicitly; never depend on
application startup to backfill seed/factory data.

See `docs/guide/database-workflow.md` for the full migration policy, custom SQL
rules, and Drizzle rc caveats.

## Seeding

The unified CLI is `task seed` (entry: `package/utils/bin/cli.ts`). It covers users, infrastructure, and factory (synthetic dev) data.

**Two seed concepts**, kept separate for safety:
- **`package/server/src/db/seed/`** — production-required infra: default realm, content type tags, root user, meilisearch init. Idempotent.
- **`package/server/src/db/factory/`** — dev/demo synthetic data generators (books, posts, shelves, users, …) with presets and a `SeedPlan` framework. Never run in production.

Seed and factory Meilisearch synchronization remains direct through
`@rezics/search`. Runtime server mutations enqueue job-runner commands, but
setup-time seed/factory flows must not require `JOB_RUNNER_BASE_URL`,
`JOB_DATABASE_URL`, Sequin, or a job-runner worker.

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

**Presets** (`package/utils/src/factory/presets/`):

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

1. **shadcn** — `@rezics/ui/shadcn` (Radix-based, token-aligned)
2. **Custom rezics primitives** — `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local `components/`

There is no third option. Icons: `lucide-react` by default, `@tabler/icons-react` as the named fallback when lucide lacks the glyph. Load the `rezics-design` skill and see the `@rezics/ui` Storybook for the authoritative rules.

### Frontend Copy and i18n

All user-facing frontend product copy must go through `@rezics/i18n`, not
hard-coded strings in JSX or component state. Add keys to
`package/i18n/locales/{locale}/{ns}.json`, choose the namespace closest to the
feature domain, and use `common` only for genuinely shared words or actions.

Use `useTranslation` / `Trans` from `@rezics/i18n/react` in React components.
For dynamic enum or slug labels, use typed key maps in `@rezics/i18n` helpers
instead of branching to raw strings in app code. Reusable `@rezics/ui`
components that own default copy must also resolve it through i18n; host string
override props remain host-owned and are rendered as supplied.

User-generated content, imported catalog metadata, API identifiers, test fixture
data, route paths, aria IDs, and non-display constants are not product copy and
do not need i18n keys.

The retired `SEED_*` env vars (e.g. `SEED_PROFILE=fast`) no longer have any effect — replace with `--preset=<name>`.

## Change Management

Planning is **code-first**: capture a plan in `plan/proposal/<change>.md` with
`/rezics-propose`, implement with `/rezics-apply`, and route durable knowledge
into code (types/tests/comments) so the plan file stays disposable. See
`plan/README.md`.

## Storybook

The design system is documented across **five package-owned Storybooks** plus an aggregating host. Each publishable surface owns its Storybook so the package can ship standalone.

### Port assignments

| Port | Instance            | Owner                              |
| ---- | ------------------- | ---------------------------------- |
| 6006 | host                | root `.storybook/` (refs the rest) |
| 6007 | UI · Foundation     | `@rezics/ui`                       |
| 6008 | Editor · CodeMirror | `@rezics/editor`                   |
| 6009 | Folio · Reader      | `@rezics/folio`                    |
| 6010 | Admin               | `@rezics/admin`                    |
| 6011 | App                 | `@rezics/app`                      |

> **Chrome unsafe ports.** Don't reassign to `:6000` (X11 — `ERR_UNSAFE_PORT`), `:6566`, `:6665–6669`, or `:6697`. Storybook's own default `:6006` is what we use for the host.

### Running

- `task storybook` — boots all six instances concurrently (color-prefixed output via `concurrently`).
- `task build:storybook` — builds all six static dists concurrently.
- `task storybook:host` / `task <name>:storybook` (e.g. `task ui:storybook`) — boot one at a time.

The host on `:6006` aggregates the others via `refs`, so visiting a single URL is enough once the per-package instances are up.

## Code Style

- **Formatter:** Prettier (2 spaces, single quotes, trailing commas)
- **Comments:** None by default; only add when the "why" is non-obvious
- **Branch:** `main` is the main branch
