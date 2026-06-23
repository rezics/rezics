# Effect Rewrite — rezics on Effect 4 + Next.js 16

## Context

Rewrite rezics (~382k lines, 26 packages) to Effect 4 + Next.js 16 + @shark UI +
Portable Text. Target: <100k maintained lines, all features preserved, better UX.

Reference implementations:
- **OpenWorks** — full-stack Effect v4 + Next.js 16 community platform (~30k lines, 2 packages)
- **ceno** — Effect v4 CouchDB client library (HttpApi/Schema/Service patterns)
- **effect-stack** — starter template (exact target stack scaffolding)

## Architecture

### Packages: 26 → 3

```
packages/
  backend/           # Effect v4 HTTP server
  frontend/          # Next.js 16 App Router
  core/              # Shared: i18n, portable-text schemas, shared types
```

### What merges where

| Current package(s) | Target | Why |
|---|---|---|
| server (125k) | backend/ | Effect HttpApi replaces Elysia |
| contract (25k) + api (27k) | eliminated | HttpApi IS the contract; AtomHttpApi.Service IS the client |
| reaction, ranking, history, notify, job-runner, preview, edge, jwt, email, shared, job (~25k) | backend/ services | Effect Layer composition, one process |
| search (10k) | backend/ services/search | Meilisearch service as Effect Layer |
| auth (7k) | backend/ services/auth | better-auth wrapped as Effect service |
| app (119k) + admin (16k) | frontend/ | Next.js App Router, admin under /admin routes |
| ui (19k) | frontend/ components/ui (generated) | @shark registry generates Ark UI components |
| editor (5k) + folio (4k) | frontend/ components/ | Portable Text editor + book reader components |
| utils (3k) | inline / effect stdlib | Effect's Array/Option/pipe replaces most utils |
| i18n (550) | core/ | Shared locale definitions |
| about (535) | frontend/ routes | Static pages in Next.js |
| storybook-config (317) | eliminated | Storybook optional, not day-1 |

### Line budget

| Scope | Target lines |
|---|---|
| backend/ (all services merged) | 15-20k |
| frontend/ (maintained code) | 35-45k |
| frontend/ components/ui (generated, @shark) | ~15k (not maintained) |
| core/ (i18n + shared schemas) | 2-3k |
| Config/infra (Taskfile, Dockerfile, deploy) | 2-3k |
| **Total maintained** | **~55-70k** |

## Tech Stack Mapping

| Concern | Current | Target |
|---|---|---|
| Runtime | Bun | Node.js 24 (Effect ecosystem standard) |
| Package manager | Bun workspaces | Yarn 4 workspaces |
| HTTP framework | Elysia | Effect HttpApi + HttpApiBuilder |
| API contract | TypeBox in @rezics/contract | Effect Schema in HttpApiEndpoint |
| API client | React Query hooks in @rezics/api | AtomHttpApi.Service (~15 lines) |
| ORM | Drizzle + pg | Drizzle + @effect/sql-pg + drizzle-orm/effect-postgres |
| Auth | better-auth | better-auth (same, Effect-wrapped) |
| Frontend framework | React 19 + Vite SPA | React 19 + Next.js 16 App Router (RSC) |
| Routing | TanStack Router (204 routes) | Next.js filesystem routing |
| State | Zustand + Jotai + SWR + React Query | @effect/atom-react |
| CSS | UnoCSS (Tailwind preset) | Tailwind CSS v4 |
| UI components | @rezics/ui (Base UI + custom) | @shark registry (Ark UI) |
| Rich text edit | CodeMirror 6 + Markdown | @portabletext/editor |
| Rich text store | Markdown strings | Portable Text JSON (jsonb) |
| Rich text render | markdown-it | @portabletext/react |
| Search | Meilisearch | Meilisearch (keep) |
| CDC | Sequin webhooks → pg-boss | Sequin → RabbitMQ (or keep Sequin direct) |
| Icons | Lucide + Tabler + 2 others | Lucide only |
| Bundler (backend) | Bun build | Rolldown |
| Task runner | go-task | go-task (keep) |
| Formatter | Biome | Prettier (Effect ecosystem) |
| Deploy (frontend) | CF Pages (SPA) | CF Pages via @opennextjs/cloudflare |
| Deploy (backend) | Nomad + CF Tunnel | Nomad + CF Tunnel (keep) |

## Code Style (from OpenWorks/effect-stack AGENTS.md)

- No `as` type assertions
- No `switch/case` — use Effect `Match`
- No `Effect.die`/`Effect.orDie` — map to `HttpApiError.InternalServerError`
- No `let` — all `const`
- No conditional spread — use `key: x ?? undefined`
- Yieldable errors: `yield* new XxxError()` directly
- `database` never abbreviated to `db`
- Boolean vars: `is`/`has`/`should`/`can` prefixes
- Drizzle Queries API (`db.query.*`) over query builder
- API: interfaces/ (contract) ↔ implementations/ (handlers) 1:1
- Frontend: server components default, `"use client"` only when needed
- Pages with state: server `page.tsx` + client `content.tsx` + `SectionBoundary`

## Database

Keep Postgres + Drizzle. Migrate existing schema to new naming conventions:
- 85 tables, 35 enums carry over (schema shape largely unchanged)
- Content columns change: markdown TEXT → Portable Text JSONB
- New migration from current schema
- Two databases remain: server + auth (same as current)

## Backend Architecture

```
packages/backend/src/
  index.ts                           # NodeRuntime.runMain
  services/
    api/
      interfaces/                    # HttpApiGroup definitions (contract)
        index.ts                     # Api class — all groups composed
        middlewares/auth.ts
        units.ts                     # Unit CRUD (books, games, media, posts, etc.)
        realms.ts                    # Realm/community
        comments.ts                  # Comments
        tags.ts                      # Tagging + votes
        scores.ts                    # Ratings
        shelves.ts                   # Shelves
        search.ts                    # Search
        users.ts                     # User profiles + settings
        governance.ts                # Moderation, staff
        engagement.ts                # Subscriptions, reactions, feedback
        content.ts                   # Content structure, translation
        entities.ts                  # Named entities
        zones.ts                     # Zones
        attribution.ts               # Credit/subject attribution
        upload.ts                    # File upload
        notifications.ts             # Inbox, DM
      implementations/               # 1:1 handler files
        ...
      routes/
        auth.ts                      # better-auth passthrough
    config/index.ts                  # All constants, env vars
    database/
      index.ts                       # Database + DatabasePool Effect services
      relations.ts
      schema/                        # Drizzle schema (from current, adapted)
    auth/index.ts                    # better-auth Effect wrapper
    search/index.ts                  # Meilisearch Effect service
    notification/index.ts            # Notification delivery
    ranking/index.ts                 # Ranking calculations
    history/index.ts                 # Revision tracking
    upload/index.ts                  # S3/R2 upload
  libraries/
    portable-text.ts                 # PT Effect Schema (from OpenWorks pattern)
```

## Frontend Architecture

```
packages/frontend/src/
  app/
    globals.css
    layout.tsx                       # Root: Providers, fonts
    (app)/
      layout.tsx                     # Shell: Header + Sidebar + BottomNav
      page.tsx / content.tsx         # Home
      book/[id]/                     # Book detail + reader
      r/[slug]/                      # Realm
      post/[id]/                     # Post
      user/[id]/                     # User profile
      e/[slug]/                      # Entity
      z/[slug]/                      # Zone
      search/                        # Global search
      inbox/                         # Notifications + DM
      create/                        # Universal create
      admin/                         # Admin routes (merged)
    (editor)/
      layout.tsx                     # Editor layout
      book/[id]/edit/
      post/new/
      ...
  atoms/
    runtime.ts                       # AtomHttpApi.Service (THE client)
    keys.ts                          # Cache invalidation keys
    units.ts, realms.ts, ...         # Per-domain query/mutation atoms
  components/
    ui/                              # @shark generated (do not edit)
    shared/                          # PagedList, EntityPicker, PortableTextEditor, ...
    book/, realm/, post/, ...        # Feature-specific components
  lib/
    api-client.ts                    # AtomHttpApi wiring
    auth-client.ts                   # better-auth client
    portable-text.ts                 # PT utilities
    utils.ts
    i18n/                            # i18next setup
  hooks/
```

## Execution Phases

### Phase 0: Scaffold (this session)
- Initialize packages/backend + packages/frontend from effect-stack template
- Set up Yarn 4, TypeScript 6, Taskfile, devenv
- Wire Effect v4, Next.js 16, @shark, Tailwind v4
- Verify `task dev` runs both services

### Phase 1: Backend core
- Port DB schema (Drizzle tables + enums) — mostly mechanical copy + rename
- Config service (env vars)
- Database + DatabasePool Effect services
- Auth service (better-auth wrapper)
- First API group (health) to verify end-to-end

### Phase 2: Frontend shell
- Next.js App Router skeleton
- @shark UI components generation
- AtomHttpApi.Service wiring
- Auth flow (login/register/session)
- Layout shell (header, sidebar, responsive)

### Phase 3: Feature domains (parallelizable with subagent clusters)
Each domain = backend API group + frontend routes + atoms. Independent, parallel:
- Units (book, game, media, post)
- Realms + membership + moderation
- Comments + reactions
- Tags + scores
- Shelves + pinboard
- Search (Meilisearch integration)
- Content structure + Portable Text editor
- Entities + attribution
- Zones
- User settings + preferences
- Notifications + DM
- Governance + admin

### Phase 4: Polish
- i18n (6 locales)
- Responsive verification (4 breakpoints)
- Book reader (folio port)
- CDC/sync (Sequin → search index)
- Deploy configs (CF Pages, Nomad, Docker)

## Decisions

- **Portable Text overrides** the old `content-doc-schema-redesign.md` rejection — user explicitly requested it
- **Keep Meilisearch** — it works, no reason to switch to Typesense
- **Keep 2 Postgres databases** — server + auth separation stays
- **Admin is routes, not a separate app** — `/admin/*` in the same Next.js instance
- **Storybook deferred** — not day-1, add when components stabilize
- **CDC**: evaluate keeping Sequin direct webhooks vs adding RabbitMQ. Start with direct.
