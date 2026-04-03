## Context
Currently, the codebase uses both Zod (frontend UI components) and TypeBox (Elysia backend) for schema validation. Environment variables are accessed directly via `process.env` or `import.meta.env` without strict validation at application startup, which can lead to hard-to-debug runtime errors.

## Goals / Non-Goals

**Goals:**
- Implement `@t3-oss/env-core` for type-safe environment variable validation across the monorepo.
- Unify schema validation by removing `zod` and standardizing on TypeBox (`import { t } from '@rezics/contract'`).
- Ensure each application (app, admin, preview, search, server) validates its own environment variables at startup.
- Differentiate frontend and backend environment configurations properly.

**Non-Goals:**
- Creating a shared environment variable module that applies globally to all packages.
- Changing the underlying features or logic of the applications.

## Decisions

- **Use App-Specific `env.ts` Files over a Global Shared Module:**
  - *Rationale:* Since `t3-env` requires passing the runtime environment manually (e.g., `import.meta.env` for Vite and `process.env` for Node), having application-specific `env.ts` files avoids bleeding server-side logic into the frontend and keeps configurations isolated to the apps that need them.
  - *Alternatives Considered:* A monorepo-wide shared `@rezics/env` module. Rejected because it complicates managing client vs. server environment scopes with `t3-env`.
- **Standardize on TypeBox for Schema Validation:**
  - *Rationale:* Elysia.js natively uses TypeBox for validation. By using Elysia's `t` export uniformly across the stack, we reduce duplicate dependencies (Zod) and maintain consistent schema definitions.
  - *Alternatives Considered:* Standardizing on Zod. Rejected because Elysia is heavily optimized for and built around TypeBox.

## Risks / Trade-offs

- **Risk: Frontend Bundling of Server Code.** Importing `t` from `@rezics/contract` (which re-exports `elysia`) might inadvertently bundle Elysia server code into the Vite frontend.
  - *Mitigation:* We should ensure that `@rezics/contract` uses `import { t } from 'elysia'` in a way that is tree-shakeable, or directly re-export TypeBox from `@sinclair/typebox` if bundling issues arise.
- **Risk: Breaking Shadcn Forms.** Shadcn UI components currently rely on Zod and `@hookform/resolvers/zod`.
  - *Mitigation:* We will need to migrate these forms to use `@hookform/resolvers/typebox` to ensure validation still works seamlessly.
