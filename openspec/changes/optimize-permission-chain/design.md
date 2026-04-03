## Context

The server permission system in `package/server/src/middleware/permission.ts` defines three Elysia guard plugins (`requireLogin`, `requireOwner`, `requireAdmin`) composed via `.use()`. Each plugin chains `tokenContext` (a type-cast derive hack) and uses `set.status + throw Error` for error handling.

Current issues:
1. `tokenContext` is a `derive()` that casts `ctx as unknown as {…}` — a runtime no-op providing only types, flagged with a TODO.
2. `requireOwner` and `requireAdmin` redundantly check `if (!identity)` after `.use(requireLogin)`. When `requireLogin`'s scoped resolve doesn't propagate, users get `"Unauthorized: Missing identity"` (401) instead of the correct 403.
3. Route files apply `.use(requireOwner)` globally, gating even public reads. Per-route `requireLogin: true` / `requireOwner: true` options are dead config (no macros defined).
4. `requireAdminSession()` is a standalone function called manually in every handler of `jwt.admin.api.ts`, duplicating checks `requireAdmin` already performs.

The two global token resolvers (`authIdentityToken`, `rezicsSessionToken`) registered in `index.ts` with `as: 'global'` scope work correctly and remain unchanged.

## Goals / Non-Goals

**Goals:**
- Replace plugin-based guards with Elysia macros for per-route declarative auth
- Use `return status()` instead of `throw Error` for proper resolve chain short-circuiting
- Eliminate `tokenContext` type-cast hack, redundant identity checks, and `requireAdminSession`
- Fix `book.api.ts` and `chapter.api.ts` so public reads have no auth overhead and admin-only queries use `requireAdmin`
- Remove duplicated admin permission checks from route handlers

**Non-Goals:**
- Adding new permission roles (e.g., `requireRoot`, `requireModerator`)
- Changing the global token resolver mechanism in `index.ts` or `@package/jwt`
- Modifying frontend API client or auth token storage
- Changing the `@package/contract` permission functions (`BasicAdminPermission`, `hasPermissionToUpdateBook`, etc.)

## Decisions

### Decision 1: Elysia macros over plugin guards

**Choice:** Define `requireLogin`, `requireOwner`, `requireAdmin` as macros in a single Elysia plugin.

**Why:** Macros are Elysia's recommended pattern for composable auth (per `macro.md` skill reference). They:
- Compose via key-value stacking (`requireAdmin` includes `requireOwner` which includes `requireLogin`)
- Are opt-in per route, not global per instance
- Use `return status()` which properly short-circuits the resolve chain
- Eliminate the need for the `tokenContext` type-cast hack

**Alternative considered:** Keep plugin guards, fix with `as: 'global'` on `requireLogin`'s resolve. Rejected because it would make identity resolution run on every route (including public), and doesn't solve the per-route opt-in problem.

**Macro composition:**
```
requireAdmin: true
  └─ requireOwner: true
       └─ requireLogin: true
            └─ reads authIdentityToken (global)
            └─ returns { identity }
       └─ reads rezicsSessionToken (global)
       └─ verifies role match, blocked check
       └─ returns { session, currentUser }
  └─ checks admin role + BasicAdminPermission
```

### Decision 2: `return status()` instead of `throw Error`

**Choice:** All macro resolvers use `return status(401, msg)` or `return status(403, msg)`.

**Why:** Elysia's macro documentation explicitly recommends `return status()` over `throw`. This ensures proper short-circuiting — when a resolve returns a status, subsequent resolves in the macro chain do not execute. The current `throw` approach may not reliably short-circuit scoped resolves across plugin boundaries.

### Decision 3: Remove global `.use(requireOwner)` from route files

**Choice:** Remove `.use(requireOwner)` / `.use(requireLogin)` / `.use(requireAdmin)` from route Elysia instances. Instead, add macro flags per route.

**Route-level assignment for `book.api.ts`:**

| Route | Current | New |
|-------|---------|-----|
| `GET /books/:unitId` | `requireOwner` (global) | none (public) |
| `GET /books/:unitId/rating` | `requireOwner` (global) | none (public) |
| `GET /books/:unitId/chapterIndex` | `requireOwner` (global) | none (public) |
| `POST /books/` | `requireOwner` (global) + dead `requireLogin: true` | `requireLogin: true` |
| `GET /books/` (list all) | `requireOwner` (global) + dead `requireOwner: true` | `requireAdmin: true` |
| `PUT /books/:unitId` | `requireOwner` (global) + dead `requireOwner: true` | `requireOwner: true` |
| `PUT /books/:unitId/chapterIndex` | `requireOwner` (global) + dead `requireOwner: true` | `requireOwner: true` |
| `DELETE /books/:unitId` | `requireOwner` (global) + dead `requireOwner: true` | `requireOwner: true` |

**Route-level assignment for `chapter.api.ts`:**

| Route | Current | New |
|-------|---------|-----|
| `GET /chapters/:unitId` | `requireOwner` (global) | none (public) |
| `POST /chapters/` | `requireOwner` (global) + dead `requireLogin: true` | `requireLogin: true` |
| `GET /chapters/` (list all) | `requireOwner` (global) + dead `requireOwner: true` | `requireAdmin: true` |
| `PUT /chapters/:unitId` | `requireOwner` (global) + dead `requireOwner: true` | `requireOwner: true` |
| `DELETE /chapters/:unitId` | `requireOwner` (global) + dead `requireOwner: true` | `requireOwner: true` |

### Decision 4: Fold `requireAdminSession` into `requireAdmin` macro

**Choice:** Delete the `requireAdminSession` function. The `requireAdmin` macro already checks admin role and `BasicAdminPermission`. Remove all `requireAdminSession()` calls from `jwt.admin.api.ts` handlers.

**Why:** The function exists only because the plugin-based `requireAdmin` couldn't be trusted to short-circuit. With macros using `return status()`, the guard is reliable and the redundant check is dead code.

### Decision 5: Remove duplicated admin checks from route handlers

**Choice:** In `user.admin.api.ts`, remove the per-handler role + `BasicAdminPermission` checks. The `requireAdmin` macro already gates these routes.

**Why:** Currently every handler in `user.admin.api.ts` re-checks `session.permission.role` and `BasicAdminPermission`. This is pure duplication — `requireAdmin` verifies both before the handler runs.

## Risks / Trade-offs

**[Risk: Macro type inference]** Elysia macro type inference requires named macros for cross-macro resolve access. If TypeScript can't see `identity` from `requireLogin` in `requireOwner`'s resolve, we may need to use named single macros (`.macro('requireLogin', { ... })`).
→ Mitigation: Use named macro syntax if stacked property shorthand doesn't infer. The skill reference documents this pattern.

**[Risk: Existing test mocks break]** Tests that mock guards as `requireLogin: new Elysia()` (e.g., `echokv.api.test.ts`, `session.api.test.ts`) will fail because the guards are no longer plugins.
→ Mitigation: Update test mocks to provide the macro plugin instead, or provide context values directly in test setups.

**[Risk: Public read routes lose auth context]** Routes like `GET /books/:unitId` currently have access to `identity` and `currentUser` via the global `requireOwner`. After removing the global guard, they won't have these unless explicitly requesting a macro.
→ Mitigation: These routes don't use `identity` or `currentUser` in their handlers. Verify this is true for all affected routes before removing the guard.

**[Trade-off: Single macro plugin vs separate plugins]** All three macros in one plugin means one `.use()` per route file. This is simpler but means the plugin carries all three macro definitions even if a route file only needs `requireLogin`. Acceptable because macros are just function definitions with no runtime cost until invoked.
