## Why

Currently, the codebase uses Zod for some validations (e.g., in the `ui` package) and TypeBox (via Elysia) for others, leading to inconsistent schema validation. Furthermore, environment variables are not strictly validated or unified across the monorepo packages. We need a unified schema validation strategy using TypeBox (`import { t } from '@package/contract'`) and a robust environment variable validation leveraging `@t3-oss/env-core` (t3-env) to ensure type safety and consistency across both frontend (Vite) and backend (Elysia Node) applications.

## What Changes

- **BREAKING**: Remove `zod` dependency entirely from the workspace, replacing all usages with `@sinclair/typebox` via `import { t } from '@package/contract'`.
- Introduce `@t3-oss/env-core` to the workspace.
- Each application package (`app`, `admin`, `preview`, `search`, `server`) will define its own `env.ts` file to validate its specific environment variables.
- Configure `t3-env` to distinguish between frontend (`clientPrefix: "VITE_"`, `client: {}`) and backend (`server: {}`) environments.
- Refactor Shadcn forms and other Zod-dependent components in `@package/ui` to utilize TypeBox resolvers.

## Capabilities

### New Capabilities
- `env-validation`: Establish strict, type-safe environment variable validation across all monorepo applications using `t3-env`.

### Modified Capabilities

## Problem
Inconsistent schema definitions (Zod vs. TypeBox) cause friction when sharing types between the frontend and backend. Unvalidated environment variables can lead to runtime crashes that are difficult to debug.

## Goals
- Unify all schema validations using TypeBox (`import { t } from '@package/contract'`).
- Ensure all environment variables are validated at startup for each application.
- Maintain type safety without shipping server dependencies to the frontend.

## Non-goals
- Changing the underlying business logic of the existing applications.
- Migrating to a different frontend or backend framework.

## Scope
The scope includes all applications and packages within the monorepo that currently rely on `process.env`, `import.meta.env`, or `zod`.

## Impact

- **Affected Packages**: `package/app`, `package/admin`, `package/server`, `package/ui`, `package/preview`, `package/search`, `package/contract`.
- **Backward-compatibility**: This is an internal refactoring; however, form validation schemas and environment variable access patterns will break and need to be updated.
- **Dependencies**: Removing `zod` and adding `@t3-oss/env-core`, `@sinclair/typebox`, and typebox resolvers for forms.
