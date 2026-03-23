# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Library.Book (rezics-book-library) is a full-stack TypeScript monorepo for a book library platform. It uses **Bun** workspaces with packages under `package/`.

## Common Commands

```bash
# Development
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
| `@package/server`    | Main Elysia API server (PostgreSQL via Prisma)                    |
| `@package/auth`      | Authentication service (better-auth, separate DB + Prisma schema) |
| `@package/jwt`       | Shared JWT/JWKS utilities (jose)                                  |
| `@package/contract`  | Shared TypeScript API contracts (Elysia + Typebox schemas)        |
| `@package/api`       | Frontend API client (TanStack Query hooks + query options)        |
| `@package/app`       | Main React SPA (Vite + TanStack Router)                           |
| `@package/admin`     | Admin dashboard (Vite + React + Material-UI)                      |
| `@package/ui`        | Shared UI components (Radix/shadcn, dnd-kit)                      |
| `@package/app-shell` | Shared shell/layout components                                    |
| `@package/search`    | Meilisearch integration                                           |

### Backend Pattern (Elysia)

Server modules follow a domain-based structure:
- `{domain}.api.ts` — Elysia route definitions
- `{domain}.service.ts` — Business logic
- `{domain}.mapper.ts` — Data transformation
- `{domain}.types.ts` — Domain types

Each domain API is mounted via `.use()` in `package/server/src/index.ts`.

### Contract-First API Design

Types are defined once in `@package/contract` using Typebox and shared across frontend/backend. The `@package/api` layer wraps these into TanStack Query hooks and query options — avoid duplicating type definitions in API functions.

### Frontend Feature Structure

Features in `package/app` follow a layered architecture (see `package/app/docs/feature standard.md`):
- `model/` — Pure business types and selectors (no React dependencies)
- `hooks/` — React logic and side effects
- `state/` — Jotai atoms or Zustand stores
- `component/` — Pure UI components
- `section/` — Business sections (wire state into components)
- `page/` — Thin route-level entry points
- `index.ts` — The only public export for the feature

**Key rule:** `model` must never import from `hooks` or `state`. External consumers must go through `index.ts`.

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

## Change Management

This project uses **OpenSpec** for non-trivial changes:
1. `/opsx:propose <description>` — Create a change proposal
2. Review artifacts under `openspec/changes/<change>/`
3. `/opsx:apply <change>` — Implement
4. `/opsx:archive <change>` — Archive when complete

Keep implementation scoped to affected packages. Respect monorepo boundaries and shared package contracts.

## Git

- Main branch: `dev`

## Global Instructions

- Prefer reading local files and fetching docs over answering from memory
- Use `rg` for all codebase text search (recursive and `.gitignore`-aware by default)
- Use bash as a last resort; never run destructive commands without explicit confirmation
