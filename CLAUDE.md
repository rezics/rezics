# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Library.Book (rezics-book-library) is a full-stack TypeScript monorepo for a book library platform. It uses **Bun** workspaces with packages under `package/`.

## Common Commands

```bash
# Development
bun run dev              # Start all dev services (Zellij on Linux/macOS, tmux on Windows)
bun run app:dev          # Start frontend dev server (Vite, port 35001)
bun run server:dev       # Start backend dev server (Elysia with --watch)

# In package/server or package/auth:
bun run dev              # Start with --watch --no-cache
bun run build            # Compile to binary (bun build --compile --minify)
bun run prisma:generate  # Generate Prisma client
bun run prisma:migrate   # Run migrations + generate
bun run prisma:studio    # Open Prisma Studio

# Testing (bun:test)
bun test                           # Run all tests in current package
bun test src/path/to/file.test.ts  # Run a single test file

# Formatting & linting
bun run format           # Prettier (in frontend packages)
bun run format:check     # Check formatting
bun run knip             # Detect unused exports/dependencies (root)
```

## Architecture

### Package Map

| Package              | Role                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `@rezics/server`    | Main Elysia API server (PostgreSQL via Prisma)                    |
| `@rezics/auth`      | Authentication service (better-auth, separate DB + Prisma schema) |
| `@rezics/jwt`       | Shared JWT/JWKS utilities (jose)                                  |
| `@rezics/contract`  | Shared TypeScript API contracts (Elysia + Typebox schemas)        |
| `@rezics/api`       | Frontend API client (TanStack Query hooks + query options)        |
| `@rezics/app`       | Main React SPA (Vite + TanStack Router)                           |
| `@rezics/admin`     | Admin dashboard (Vite + React + shadcn)                           |
| `@rezics/ui`        | Shared UI components (Radix/shadcn, dnd-kit)                      |
| `@rezics/app-shell` | Shared shell/layout components                                    |
| `@rezics/search`    | Meilisearch integration                                           |

### Backend Pattern (Elysia)

Server modules follow a domain-based structure:
- `{domain}.api.ts` — Elysia route definitions
- `{domain}.service.ts` — Business logic
- `{domain}.mapper.ts` — Data transformation
- `{domain}.types.ts` — Domain types

Each domain API is mounted via `.use()` in `package/server/src/index.ts`.

### Contract-First API Design

Types are defined once in `@rezics/contract` using Typebox and shared across frontend/backend. The `@rezics/api` layer wraps these into TanStack Query hooks and query options — avoid duplicating type definitions in API functions.

### Frontend Feature Structure

Features in `package/app` follow a layered architecture (see `package/app/docs/feature standard.md`):
- `models/` — Pure business types and selectors (no React dependencies)
- `hooks/` — React logic and side effects
- `states/` — Jotai atoms or Zustand stores
- `components/` — Pure UI components
- `sections/` — Business sections (wire state into components)
- `pages/` — Thin route-level entry points
- `index.ts` — The only public export for the feature

**Key rule:** `models` must never import from `hooks` or `states`. External consumers must go through `index.ts`.

### Two Separate Databases

- **Server DB** (`package/server/prisma/schema.prisma`) — Books, chapters, users, comments, reactions, readlists, etc.
- **Auth DB** (`package/auth/prisma/schema.prisma`) — Users, sessions, accounts, organizations, OAuth providers, JWKS

### Environment Variables

Validated at runtime using `@t3-oss/env-core` + Valibot. Environment dependencies must be isolated from module exports.

## Tech Stack

- **Runtime:** Bun
- **Backend:** Elysia, Prisma 7, PostgreSQL
- **Frontend:** React 19, Vite 8, TanStack Router + Query, UnoCSS (Tailwind/shadcn presets), Jotai, Zustand
- **Auth:** better-auth, jose (JWT/JWKS)
- **Formatting:** Prettier (2 spaces, single quotes, trailing commas)

## API Route & Folder Convention

See `CONTRIBUTING.md` for a convention summary and `openspec/specs/` for authoritative specs.
Enforced by `bun run check:convention` (pre-commit + PR merge gate).

## Link Rendering Convention

All JSX links must use `<SafeLink href={url}>` from `@rezics/ui` instead of raw `<a href>`. This classifies URLs and routes external links through a confirmation modal. See `openspec/specs/outbound-link-protection/spec.md` for the full spec. Enforced by R5 in `bun run check:convention`.

## UI Work

Any UI work (JSX, UnoCSS classes, theme tokens, colors, typography, spacing, component selection) is governed by the **rezics-design** skill. Load it before generating or reviewing UI. Source-of-truth tokens live in `package/ui/src/config/tokens/`; canonical brief is `openspec/plans/design-system-research/briefs/01-foundation-v1.md`. Don't duplicate design rules outside the skill — point to it.

## UI Component Policy

The component selection policy is **shadcn-or-custom**: shadcn primitives from `@rezics/ui/shadcn` are the default; rezics-owned custom primitives (`@rezics/ui/primitive/`, `@rezics/ui/composite/`) cover gaps. Icons use `lucide-react` by default, `@tabler/icons-react` as the named fallback. See `openspec/specs/ui-component-foundation/spec.md` for the authoritative source. Introducing a third-party UI library requires an OpenSpec change updating `ui-component-foundation`.

## Change Management

This project uses **OpenSpec** for non-trivial changes:
1. `/opsx:propose <description>` — Create a change proposal
2. Review artifacts under `openspec/changes/<change>/`
3. `/opsx:apply <change>` — Implement
4. `/opsx:archive <change>` — Archive when complete

Keep implementation scoped to affected packages. Respect monorepo boundaries and shared package contracts.

## Git

- Main branch: `dev`

## Frontend-First Development

The frontend is implemented proactively — if a backend API or data source is not yet available, mock it and move forward. Backend development follows.

**Mock convention:** All mock data, functions, and constants must be annotated with a `// MOCK:` comment so they can be found via `grep -r "// MOCK:"` and replaced when the backend is ready. Keep mock implementations simple (e.g., deterministic hash-based values). Example:

```ts
// MOCK: view count derived from node id hash
function mockViewCount(id: string | number): number {
  return (hashCode(String(id)) % 5000) + 10;
}
```

## Database Seeding

The unified seed CLI is `bun run seed` (entry: `package/utils/bin/cli.ts`). Use named **presets** (`realistic`, `fast`, `minimal`, `post-tree-focus`) instead of `SEED_*` env vars (retired):

```bash
bun run seed:factory        # realistic preset, no prompts
bun run seed:factory:fast   # fast preset, no prompts
bun run seed                # interactive: pick users / infrastructure / factory
```

**Two seed concepts:**
- **`prisma/seed/`** — production-required infra (default realm, content type tags, root user, meilisearch init). Idempotent, safe to run anywhere.
- **`prisma/factory/`** — dev/demo synthetic data (books, posts, shelves, users, etc.). Generator framework with presets. Never run in production.

All count decisions in `package/server/prisma/factory/` go through `ctx.draw(plan.<spec>)` — never call `powerLaw`/`randomInt` directly for counts. R7 (`check:convention`) enforces this. See `CONTRIBUTING.md` for the preset list and `$EDITOR` tweak flow.

## Global Instructions

- Prefer reading local files and fetching docs over answering from memory
- Use `rg` for all codebase text search (recursive and `.gitignore`-aware by default)
- Use bash as a last resort; never run destructive commands without explicit confirmation
