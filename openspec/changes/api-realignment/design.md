## Context

The `@rezics/api` package acts as the sole HTTP client layer between the frontend (`@rezics/app`, `@rezics/admin`) and the backend (`@rezics/server`). Every domain module follows a 6-file pattern:

```
{domain}/
  {domain}.types.ts    — Re-export contract types + frontend-specific types
  {domain}.api.ts      — apiFetch calls (pure async functions, no React)
  {domain}.keys.ts     — Query key factory
  {domain}.queries.ts  — queryOptions / infiniteQueryOptions configs
  {domain}.mutations.ts — useMutation hooks with cache invalidation
  {domain}.ts          — Barrel export
```

This pattern is established in 14+ existing modules (book, chapter, post, tag, shelf, realm, etc.) and must be followed exactly for new modules.

**Current state:** The API layer was written speculatively — some methods target endpoints the server never implemented, while other server endpoints were added without corresponding client modules. The contract package (`@rezics/contract`) is the source of truth for types and is fully up-to-date with the server.

## Goals / Non-Goals

**Goals:**
- Every `apiFetch` call in `@rezics/api` hits a real, currently-registered server endpoint at the correct path
- Every server endpoint that a frontend consumer could plausibly call has a corresponding API client method
- No deprecated stubs or dead code remain in `@rezics/api` or `@rezics/app` mock handlers
- Frontend files that import deprecated shims are migrated to live alternatives
- All types flow from `@rezics/contract` — no duplicated or hand-rolled response shapes

**Non-Goals:**
- Adding new server endpoints (the server is the source of truth; the client aligns to it)
- Changing backend behavior or routes
- Migrating the admin panel's internal auth flows
- Adding new frontend features that consume the newly-added API modules (those come later)

## Decisions

### 1. Realm `leave()` resolves the current user's unitId from the JWT layer

**Choice:** Import `getRezicsSessionClaims()` from `../react-query/jwt` inside `realm.api.ts` and extract `unitId` at call time.

**Why not take userId as a parameter:** The existing call signature is `leave(realmUnitId)`. Changing it to `leave(realmUnitId, userId)` would leak authentication concerns into every call site. The JWT is always present when this method is called (it requires login), so reading from the token store is reliable and keeps the API ergonomic.

**Why not use the frontend user-profile store:** The API package has no dependency on Zustand or the app-layer store. The JWT layer is already a dependency within `@rezics/api`.

### 2. Remove phantom read methods from realm API rather than stubbing them

**Choice:** Delete `getMembers()`, `getUnits()`, `getTagUnits()` and their queries/keys entirely.

**Alternative considered:** Keep them with `// MOCK:` stubs. Rejected because the MOCK convention is for frontend-first development where the backend will follow. These are server design decisions (whether to add GET endpoints for realm sub-resources) that haven't been made, so stubs would be misleading.

### 3. Tag `getForUnit` response type aligns to server `{tags}` without `total`

**Choice:** Change the return type to `{ tags: UnitTagDTO[] }` (no `total`). Update the 3 consuming frontend files to not destructure `total`.

**Why:** The server's `GET /tags/for-unit/:unitId` returns all tags for a unit without pagination, so `total` is redundant. The consumer can use `tags.length` if needed.

### 4. New modules follow the established 6-file pattern exactly

**Choice:** Link, Attribution, and DM modules each get the full `types + api + keys + queries + mutations + barrel` structure, even when some layers are thin (e.g., DM has only one mutation).

**Why:** Consistency matters more than minimalism here. A thin module with the right shape is immediately usable when features grow. A special-cased module with a different structure creates confusion.

### 5. Deprecated meili stubs are replaced with content search queries

**Choice:** The 5 frontend files using `buildMeiliReadlistQuery` and `buildMeiliReviewQuery` will be migrated to use `contentSearchQueryOptions` (which calls `POST /meili/content/search`) or the shelf/post query options. The stubs are then removed.

**Alternative considered:** Leave the stubs. Rejected because they silently return empty arrays, which means the UI sections they power (TrendingReadListSection, TrendingReviewsSection, ReadListsPage, UserUnitsPage) show nothing. Migrating them to real queries makes these sections functional.

### 6. User batch lookup added to existing user module, not a new module

**Choice:** Add `batch()` to `userApi` in `user.api.ts`, add a query key and query option, re-export from the barrel.

**Why:** It's a user operation that returns user data. Creating a separate module would be over-fragmentation.

## Risks / Trade-offs

**[Risk] Realm `leave()` fails if no REZICS_SESSION token is set** → The method throws if `getRezicsSessionClaims()` returns null. This is acceptable because `leave()` requires authentication — if there's no session, the server would reject the request anyway. An early throw with a clear message is better than a 401 from the server.

**[Risk] Removing deprecated modules breaks external consumers** → Mitigated: grep confirms zero imports of `commentApi`, `reviewApi`, `readlistApi` across the entire monorepo. The `buildMeiliReadlistQuery`/`buildMeiliReviewQuery` stubs are used but will be migrated in the same change.

**[Risk] Frontend sections may render differently after meili stub migration** → The current stubs return empty arrays, so the sections already show nothing. Migrating to real queries can only improve the situation. If the meili index has no data, the result is the same (empty). If it does, the sections start working.

**[Trade-off] Attribution API is admin-only but lives in the shared API package** → This is consistent with how `statsApi`, `jwtServiceApi`, and `tokenApi` already work. Admin-gating happens at the server level, not the client module level.
