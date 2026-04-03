## 1. Rewrite permission middleware as macros

- [x] 1.1 Replace `tokenContext`, `requireLogin`, `requireOwner`, `requireAdmin` plugins and `requireAdminSession` function in `package/server/src/middleware/permission.ts` with a single `authMacro` Elysia plugin using `.macro()` that defines `requireLogin`, `requireOwner`, `requireAdmin` macros with `return status()` error handling. Keep `buildActorFromContext` as-is.
- [x] 1.2 Update `package/server/src/middleware/index.ts` to export `authMacro` instead of the old individual guard plugins and `requireAdminSession`.

## 2. Migrate route files to macro flags

- [x] 2.1 Update `package/server/src/book/book.api.ts`: replace `.use(requireOwner)` with `.use(authMacro)`, remove global guard, add per-route macro flags (public reads: none, `POST /`: `requireLogin: true`, `GET /` list: `requireAdmin: true`, `PUT`/`DELETE`: `requireOwner: true`).
- [x] 2.2 Update `package/server/src/chapter/chapter.api.ts`: same pattern as book — replace `.use(requireOwner)` with `.use(authMacro)`, assign per-route macro flags.
- [x] 2.3 Update `package/server/src/user/api/user.admin.api.ts`: replace `.use(requireAdmin)` with `.use(authMacro)`, add `requireAdmin: true` per route, remove duplicated admin role and `BasicAdminPermission` checks from every handler body.
- [x] 2.4 Update `package/server/src/jwt/jwt.admin.api.ts`: replace `.use(requireAdmin)` with `.use(authMacro)`, add `requireAdmin: true` per route, remove all `requireAdminSession()` calls from handler bodies.
- [x] 2.5 Update remaining route files that use `.use(requireLogin)` or `.use(requireOwner)`: `user.core.api.ts`, `user.follow.api.ts`, `readlist.api.ts`, `review.api.ts`, `comment.api.ts`, `reaction.api.ts`, `unit.api.ts`, `tag.api.ts`, `echokv.api.ts`, `meili.api.ts`, `token.api.ts`, `feedback.api.ts`, `session.api.ts`. Replace `.use(requireX)` with `.use(authMacro)` and add per-route macro flags.

## 3. Update tests

- [x] 3.1 Update test mocks in `package/server/src/echokv/echokv.api.test.ts` and `package/server/src/session/session.api.test.ts`: replace `requireLogin: new Elysia()` / `requireOwner: new Elysia()` / `requireAdmin: new Elysia()` mock pattern with macro-compatible test setup.
- [x] 3.2 Verify `package/server/src/user/api/user.ensure.integration.test.ts` still passes (exercises real token-resolver → JWT verification → requireLogin flow).

## 4. Validate

- [x] 4.1 Run `bun run build` in `package/server` to verify no compile errors from removed exports or changed imports.
- [x] 4.2 Run `bun test` in `package/server` to verify all tests pass.
- [x] 4.3 Grep repo-wide for any remaining references to `requireAdminSession`, old `requireLogin`/`requireOwner`/`requireAdmin` plugin imports, or `tokenContext` to ensure full migration.
