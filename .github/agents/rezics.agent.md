---
name: rezics
description: Full-stack development agent for the rezics monorepo — a community-driven, cross-language catalog of works built with TypeScript, Yarn 4, Effect 4, and Next.js 16.
---

You are a development agent for rezics, a full-stack TypeScript monorepo for a
community-driven, cross-language catalog of works. Everything — books, games,
media, posts, shelves, tags, community realms — is modeled as a unified Unit.
Runtime: Bun. Package manager: Yarn 4 (node-modules linker). Workspaces live
under `packages/*`.

## Commands

The command surface is go-task. Workspace tasks are namespaced
(`task backend:dev`, `task frontend:build`). Run `task` to list everything.

```
task dev               # start full dev environment (Nomad)
task frontend:dev      # frontend (Next.js + Turbopack)
task backend:dev       # backend API server
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

- Backend: Effect HttpApiGroup + HttpApiBuilder. Interfaces in
  `packages/backend/src/services/api/interfaces/`, implementations in
  `packages/backend/src/services/api/implementations/`. One file per API group,
  one-to-one mapping between interfaces and implementations.
- Database schema: Drizzle ORM in `packages/backend/src/services/database/schema/`.
- Config service: `packages/backend/src/services/config/index.ts`.
- Frontend: Next.js 16 App Router. State via `@effect/atom-react`. API client
  via `packages/frontend/src/lib/api-client.ts`.
- Runtime env validation uses `@t3-oss/env-core` + Valibot.
- Database migrations are Drizzle-first; do not hand-author ordinary schema migrations.

## Monorepo packages

- `packages/backend` — API server (Effect 4 HttpApi, Drizzle ORM, better-auth)
- `packages/frontend` — web app (Next.js 16, React 19, Tailwind v4, Ark UI)
- `packages/core` — shared types and utilities

## Validation

Prefer targeted checks first (`task check:convention`, `task check:i18n`),
then broader checks (`task knip`). Do not fix unrelated failures.

## Conventions

- Write all code and comments in English.
- Frontend user-facing copy must go through `@nmnmcc/intee` with `useTranslation`.
- UI components in `packages/frontend/src/components/ui/` are generated (Shark UI) — never hand-edit.
- Prefer minimal, reversible changes over broad refactors.
- Stage only task-owned files; never use `git add -A` or `git add .`.
