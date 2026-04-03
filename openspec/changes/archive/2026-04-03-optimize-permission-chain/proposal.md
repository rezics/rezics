## Why

The server permission middleware (`package/server/src/middleware/permission.ts`) has a broken resolve chain: `requireAdmin` and `requireOwner` redundantly check `identity` after `.use(requireLogin)`, use `throw Error` instead of Elysia's `return status()`, and rely on a fragile `tokenContext` type-cast hack. This causes users to see `"Unauthorized: Missing identity"` (401) instead of the expected `"Forbidden: Admin role required"` (403) when they are authenticated but lack permissions.

Additionally, `book.api.ts` applies `.use(requireOwner)` globally — meaning even public reads run the full session+permission check. Route-level `requireLogin: true` / `requireOwner: true` flags exist in route options but no macros are defined, so they are silently ignored.

## What Changes

- **Replace plugin-based permission guards with Elysia macros** — Define `requireLogin`, `requireOwner`, and `requireAdmin` as composable macros using `return status()` instead of `throw Error`, eliminating the `tokenContext` type-cast hack and redundant identity checks.
- **Fix `book.api.ts` permission assignments** — Remove the global `.use(requireOwner)` and apply per-route macros: public reads get no guard, writes get `requireOwner`, admin-only queries (list all books) get `requireAdmin`.
- **Fold `requireAdminSession` into `requireAdmin` macro** — The standalone `requireAdminSession()` function duplicates what the `requireAdmin` guard already checks. Route handlers using `requireAdmin` should not need to re-check admin role/permissions.
- **Remove duplicated admin checks in route handlers** — `user.admin.api.ts` and `jwt.admin.api.ts` handlers manually re-check admin role after `requireAdmin` middleware already verified it.

## Capabilities

### New Capabilities

- `macro-permission-guards`: Elysia macro-based permission system replacing the current plugin-based `requireLogin`, `requireOwner`, and `requireAdmin` guards with composable, per-route key-value macros that use `return status()` for proper short-circuiting.

### Modified Capabilities

- `server-permission-guards`: Guard behavior moves from plugin `.use()` to macro route options. The `requireLogin`, `requireOwner`, `requireAdmin` contracts remain the same but the mechanism changes from scoped resolve plugins to macros with `return status()`.

## Impact

- **`package/server`** — Primary target. `middleware/permission.ts` rewritten. All route files using `.use(requireLogin|requireOwner|requireAdmin)` switch to macro route options.
- **`package/server/src/book/book.api.ts`** — Public reads no longer gated behind `requireOwner`. Admin-only list query gets `requireAdmin`.
- **`package/server/src/user/api/user.admin.api.ts`** — Duplicated admin permission checks removed from handlers.
- **`package/server/src/jwt/jwt.admin.api.ts`** — `requireAdminSession()` calls removed; `requireAdmin` macro handles it.
- **No frontend changes** — API contracts and response shapes are unchanged. Error messages become more accurate (403 vs 401).
- **No breaking changes** — HTTP status codes change from incorrect 401 to correct 403 for authenticated-but-unauthorized requests. This is a bug fix, not a contract change.
- **Backward compatibility** — No migration needed. Existing tests that mock guards (`new Elysia()`) will need to be updated to use the macro pattern.
