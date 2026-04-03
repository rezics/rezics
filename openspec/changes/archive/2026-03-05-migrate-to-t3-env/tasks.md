## 1. Setup

- [x] 1.1 Add dependencies to workspace (`@t3-oss/env-core`, `@sinclair/typebox`, `@hookform/resolvers`)
- [x] 1.2 Remove `zod` dependency from all `package.json` files in the monorepo

## 2. Infrastructure (Contracts)

- [x] 2.1 Update `@rezics/contract/src/schema.ts` to export Elysia `t` securely for both frontend and backend
- [x] 2.2 Verify `@rezics/contract` tree-shaking to ensure Elysia server dependencies do not leak into Vite bundles

## 3. Server Validation (Elysia)

- [x] 3.1 Create `package/server/src/env.ts` using `t3-env` and `t` from `@rezics/contract` to validate `process.env` (e.g. `JWT_SECRET`)
- [x] 3.2 Update `package/server` codebase to use the new `env` config object instead of `process.env` directly

## 4. Frontend Validation (Vite Apps)

- [x] 4.1 Create `package/app/src/env.ts` using `t3-env` with `clientPrefix: "VITE_"` and validate `import.meta.env`
- [x] 4.2 Create `package/admin/src/env.ts` using `t3-env` with `clientPrefix: "VITE_"` and validate `import.meta.env`
- [x] 4.3 Create `package/search/src/env.ts` and validate its specific envs
- [x] 4.4 Create `package/preview/src/env.ts` and validate its specific envs

## 5. UI Package Refactoring (Zod removal)

- [x] 5.1 Refactor `package/ui/src/shadcn/section/data-table.tsx` to replace `zod` schema with `t` from `@rezics/contract` (migrating `z.infer` to typebox `Static`)
- [x] 5.2 Refactor any Shadcn forms in `package/ui` to use typebox resolvers instead of zod resolvers
- [x] 5.3 Audit and fix any other `zod` usages in `package/ui` or `package/app`

## 6. Verification

- [x] 6.1 Run typecheck across the monorepo to ensure no `zod` references remain
- [x] 6.2 Start the server and verify it throws on missing backend envs
- [x] 6.3 Start the frontend apps and verify they throw on missing `VITE_` envs
- [x] 6.4 Verify Shadcn data table and forms render and validate correctly
