# Contributing

## Project Overview

Rezics (repo `rezics/rezics`) is a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works — books, games, media, posts,
shelves, tags, and community `realm`s, all modeled as a unified `Unit`.
Communities (`realm`s) collectively classify and discuss works, co-locating a
work's index, discussion, and collaborative knowledge. Built on **Bun**
workspaces; packages live under `package/`.

## Development Setup

**Prerequisites:** Bun, Docker Compose v2 for repo-managed local services

```bash
bun install
bun run dev              # Start all dev services
bun run app:dev          # Frontend only (Vite, port 35001)
bun run server:dev       # Backend only (Elysia with --watch)
bun --filter=@rezics/history run dev # History service only (Elysia, port 3004)
```

`bun run dev` starts application processes only. It does not provision external
dependencies such as PostgreSQL, Meilisearch, Redis, object storage, or Sequin.
For the repo-managed local path, start Docker Compose v2 services first:

```bash
bun run service:up
bun run service:health
bun run service:logs
bun run service:down
```

This starts the managed source PostgreSQL, Meilisearch, Sequin state
PostgreSQL, Sequin Redis, and Sequin stack. The source PostgreSQL container is
created with logical replication enabled and creates the local development
databases on fresh volumes. User-managed external services remain possible by
editing package env files manually, but `service:*` commands do not discover,
start, stop, or repair unrelated services.

If the managed source database comes from an old or manually modified volume,
use `bun run service:source:verify` first. Reserve
`bun run service:source:repair` for existing, external, or broken local source
databases; it is not required for a fresh managed Docker volume.

Start any other required external services first, then start the dependent
application process. A service failing fast because an external dependency is
unavailable is expected behavior when the error points at the missing service
and setup command.

The local dev layout keeps `@rezics/job-runner` eligible to auto-start. If its
`http` or `all` role needs Sequin, start the managed services first or use
`JOB_RUNNER_ROLE=worker` for queue draining without webhook ingress.

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

### URL Convention: short-prefix = slug, long-prefix = unitId

Every public Unit-resolving URL falls into one of two families, and the prefix tells the reader which one:

- **Short-prefix routes** (`/u`, `/r`, `/t`, `/z`, `/e`) take a **slug**. Examples: `/u/alice`, `/r/slow-reading`, `/t/spec-fic`. Slugs are resolved against the per-scope `SlugScope` row.
- **Long-prefix routes** (`/user`, `/realm`, `/tag`, `/zone`, `/entity`, `/unit`) take a **UUID**. Examples: `/user/01976a…`, `/unit/01976a…`. UUIDs resolve `Unit.id` directly.

Mixing the two is forbidden: a slug under a long prefix or a UUID under a short prefix MUST be rejected at the route layer (typed by-slug endpoints like `/user/by-slug/:slug` are the only exception and exist precisely so this rule stays clean).

`R10` in `bun run check:convention` flags route definitions whose param names violate this convention (a `:userSlug` under `/user`, or a `:unitId` under `/u`).

### Enforcement

These conventions are enforced by `bun run check:convention`; each rule
(`tool/scripts/check-convention/rules/`) states its own normative rule and is
the authoritative source.

## Seeding

The unified CLI is `bun run seed` (entry: `package/utils/bin/cli.ts`). It covers users, infrastructure, and factory (synthetic dev) data.

**Two seed concepts**, kept separate for safety:
- **`package/server/prisma/seed/`** — production-required infra: default realm, content type tags, root user, meilisearch init. Idempotent.
- **`package/server/prisma/factory/`** — dev/demo synthetic data generators (books, posts, shelves, users, …) with presets and a `SeedPlan` framework. Never run in production.

Seed and factory Meilisearch synchronization remains direct through
`@rezics/search`. Runtime server mutations enqueue job-runner commands, but
setup-time seed/factory flows must not require `JOB_RUNNER_BASE_URL`,
`JOB_DATABASE_URL`, Sequin, or a job-runner worker.

```bash
# Fully interactive (multi-select users / infrastructure / factory)
bun run seed

# Factory data only, named preset, no prompts
bun run seed:factory              # shortcut for --preset=realistic --no-interactive
bun run seed:factory:fast         # shortcut for --preset=fast --no-interactive
bun run seed:factory:medium       # shortcut for --preset=medium --no-interactive
bun run seed --preset=minimal --no-interactive
```

**Presets** (`package/utils/src/factory/presets/`):

| Preset           | Mode      | Use                                                    |
| ---------------- | --------- | ------------------------------------------------------ |
| `realistic`      | realistic | Default — power-law distributed counts, prod-ish shape |
| `fast`           | realistic | Smaller envelope for quick iteration                   |
| `medium`         | fixed     | Mid-volume deterministic dataset (50 books/games/media, 40 tags, 20 reviews + 100 tree posts per work) |
| `minimal`        | fixed     | Tiny deterministic dataset for unit-style scenarios    |
| `post-tree-focus`| fixed     | One work per type, deterministic post tree shape       |

**Plan tweaking.** When running interactively, after picking a preset you can tweak the `SeedPlan`. The CLI writes it as JSON to `node_modules/.cache/rezics-seed/edit-*/plan.json`, prints the absolute path, and waits at a "Done editing — continue?" prompt. Open the file in any editor, save, then confirm to continue; the plan is validated against `SeedPlanSchema` and you are re-prompted on parse or validation errors. Stale edit dirs older than one hour are swept on every CLI start.

**Modes.** A `Mode` (`realistic | fixed | uniform`) is set once per preset and threaded through `SeedCtx`; each `CountSpec = { min?, max, target?, alpha? }` is interpreted by `ctx.draw(spec)`:
- `realistic` → `powerLaw(min ?? 0, max, alpha ?? 1.5)`
- `fixed` → clamp(`target ?? floor((min+max)/2)`, min, max)
- `uniform` → `randInt(min ?? 0, max)`

Seeders never read counts directly — all count decisions go through `ctx.draw(...)`. R7 (`bun run check:convention`) blocks new `powerLaw` imports outside `strategy.ts`/`utils.ts`.

## UI Component Policy

Pick UI primitives in this order:

1. **shadcn** — `@rezics/ui/shadcn` (Radix-based, token-aligned)
2. **Custom rezics primitives** — `@rezics/ui/primitive/`, `@rezics/ui/composite/`, or feature-local `components/`

There is no third option. Icons: `lucide-react` by default, `@tabler/icons-react` as the named fallback when lucide lacks the glyph. Load the `rezics-design` skill and see the `@rezics/ui` Storybook for the authoritative rules.

The retired `SEED_*` env vars (e.g. `SEED_PROFILE=fast`) no longer have any effect — replace with `--preset=<name>`.

## Change Management

Planning is **code-first**: capture a plan in `plan/proposal/<change>.md` with
`/rezics-propose`, implement with `/rezics-apply`, and route durable knowledge
into code (types/tests/comments) so the plan file stays disposable. See
`plan/README.md`.

## Storybook

The design system is documented across **five package-owned Storybooks** plus an aggregating host. Each publishable surface owns its Storybook so the package can ship standalone.

### Port assignments

| Port | Instance | Owner |
| ---- | -------- | ----- |
| 6006 | host | root `.storybook/` (refs the rest) |
| 6007 | UI · Foundation | `@rezics/ui` |
| 6008 | Editor · CodeMirror | `@rezics/editor` |
| 6009 | Folio · Reader | `@rezics/folio` |
| 6010 | Admin | `@rezics/admin` |
| 6011 | App | `@rezics/app` |

> **Chrome unsafe ports.** Don't reassign to `:6000` (X11 — `ERR_UNSAFE_PORT`), `:6566`, `:6665–6669`, or `:6697`. Storybook's own default `:6006` is what we use for the host.

### Running

- `bun run storybook` — boots all six instances concurrently (color-prefixed output via `concurrently`).
- `bun run build-storybook` — builds all six static dists concurrently.
- `bun run storybook:host` / `bun --cwd package/<name> run storybook` — boot one at a time.

The host on `:6006` aggregates the others via `refs`, so visiting a single URL is enough once the per-package instances are up.

## Code Style

- **Formatter:** Prettier (2 spaces, single quotes, trailing commas)
- **Comments:** None by default; only add when the "why" is non-obvious
- **Branch:** `dev` is the main branch
