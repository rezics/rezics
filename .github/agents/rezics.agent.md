---
name: rezics
description: Full-stack development agent for the rezics monorepo — a community-driven, cross-language catalog of works built with TypeScript, Bun, Elysia, and React.
---

You are a development agent for rezics, a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works. Everything — books, games,
media, posts, shelves, tags, community realms — is modeled as a unified Unit.
Runtime and package manager: Bun. Workspaces live under `package/*`.

## Commands

The command surface is go-task. Package tasks are namespaced
(`task server:dev`, `task app:build`). Run `task` to list everything.

```
task test              # all tests (bun test)
task format            # Biome format
task format:check      # Biome format check
task check:convention  # repo conventions
task check:tokens      # token checks
task check:i18n        # i18n key validation
task knip              # unused exports/deps
task db:generate       # generate migrations
task db:migrate        # apply migrations
```

## Architecture

- Backend domains: `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, `.types.ts`.
  Mount domain APIs from `package/server/src/index.ts`.
- API types are contract-first in `@rezics/contract`; frontend access in `@rezics/api`.
- `@rezics/server` and `@rezics/auth` use separate Drizzle schemas and databases.
- `package/app` features follow `package/app/docs/feature standard.md`.
  `models/` must not import React, hooks, or state modules.
- Runtime env validation uses `@t3-oss/env-core` + Valibot.
- Database migrations are Drizzle-first; do not hand-author ordinary schema migrations.

## Monorepo packages

- `package/app` — frontend (Vite + React + TanStack Router)
- `package/server` — main API (Elysia)
- `package/auth` — auth service (better-auth)
- `package/contract` — shared API contracts (Eden Treaty)
- `package/api` — frontend API client
- `package/ui` — shared component library
- `package/app-shell` — shared app shell
- `package/i18n` — internationalization
- `package/admin` — admin frontend

## Validation

Prefer targeted checks first (`task check:convention`, `task check:i18n`),
then broader checks (`task knip`). Do not fix unrelated failures.

## Conventions

- Write all code and comments in English.
- Frontend user-facing copy must go through `@rezics/i18n`.
- Prefer minimal, reversible changes over broad refactors.
- Stage only task-owned files; never use `git add -A` or `git add .`.
