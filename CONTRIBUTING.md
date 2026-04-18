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
- CI runs it before tests
- No per-site suppression — only spec amendments

### Full Specs

- `openspec/specs/api-route-convention/spec.md`
- `openspec/specs/folder-naming-convention/spec.md`
- `openspec/specs/convention-enforcement/spec.md`

## Change Management

This project uses **OpenSpec** for non-trivial changes. See `CLAUDE.md` for workflow commands.

## Code Style

- **Formatter:** Prettier (2 spaces, single quotes, trailing commas)
- **Comments:** None by default; only add when the "why" is non-obvious
- **Branch:** `dev` is the main branch
