## Context

The DB-backed list endpoints (`GET /books/`, `GET /posts/`, `GET /realms/`) are currently gated behind admin role checks (`BasicAdminPermission` / manual ADMIN+ROOT checks + `verifyAdminFromDb`). Full-text search via Meilisearch is already public at `/meili/*`. The DB list endpoints carry a `q` parameter that triggers expensive SQL LIKE queries across joins (e.g., `contains` on translations.title, translations.description, isbn13, person.name for books).

The frontend needs structured DB listing (filter by userId, tags, realm, status, sort, cursor pagination) with real-time data, but currently cannot access it without admin credentials.

## Goals / Non-Goals

**Goals:**
- Open `GET /books/`, `GET /posts/`, `GET /realms/` to unauthenticated callers for structured filtering
- Remove `q` parameter from these endpoints to eliminate SQL LIKE performance risk
- Apply role-aware filtering so public callers only see published content while admins retain full access
- Standardize pagination limits across all list endpoints via a shared contract schema

**Non-Goals:**
- Changing Meilisearch endpoints (they remain as-is)
- Opening `GET /chapters/` or `GET /feedbacks/` (stay admin-only)
- Adding rate limiting (can be addressed separately)
- Modifying the `GET /users/` or `GET /tags/` or `GET /shelves/` endpoints (already public)

## Decisions

### 1. Same endpoint, role-aware behavior (not separate routes)

Use a single `GET /` route per domain. The handler checks whether the caller is an admin and adjusts the query constraints accordingly.

**Why not separate `/public` and `/admin` routes?** Duplicate routes means duplicate query schemas, duplicate service calls, and more surface area to maintain. A single endpoint with conditional logic is simpler and matches the existing pattern where other endpoints already inspect `identity.permission`.

**Implementation pattern:**

```
GET /books/  (requireLogin: false)
  │
  ├─ anonymous / non-admin caller
  │   → force status=PUBLISHED, visibility constraints
  │   → `q` param not available (removed from schema)
  │
  └─ admin caller (ADMIN/ROOT verified)
      → full filter access (any status, visibility)
      → `q` param not available (removed from schema)
```

The `requireLogin` option changes from `true` to `false` (or removed). The identity is still resolved when present — the auth macro already handles optional auth by providing a guest identity.

### 2. Remove `q` from query schemas in contract

Remove the `q` field from `bookListQuerySchema`, `postListQuerySchema`, and `realmListQuerySchema` in `@rezics/contract`. This is a schema-level removal — Elysia will reject requests that include `q` as an unknown query param (depending on `additionalProperties` setting), or silently ignore it.

On the service side, remove the `q`-based `contains` / LIKE logic from:
- `BookService.buildWhereClause` (lines 40-75 in book.service.ts)
- `RealmService` list query builder (the `q` contains on translations.title)

`PostService.list` does not use `q` in the DB query (posts have no text search in the DB layer), but the schema field should still be removed for consistency.

### 3. Role-aware filter constraints in service layer

Rather than adding permission logic to the Elysia handler, push it into the service layer. The service `list()` method receives an `isAdmin` boolean (or a role) and applies constraints:

| Filter | Public caller | Admin caller |
|--------|--------------|--------------|
| `status` | Forced to `PUBLISHED` | Any value (or omit for all) |
| `visibility` | Forced to `PUBLIC` (books) | Any value |
| All other filters | Passed through | Passed through |

This keeps the handler thin and the logic testable.

### 4. Shared PaginationLimit in contract

Add to `@rezics/contract/src/pagination.ts`:

```ts
export const paginationLimitSchema = t.Optional(
  t.Number({ minimum: 1, maximum: 100, default: 20 })
);
```

Replace `t.Optional(t.Number())` for `limit` in all list query schemas with this shared schema. Elysia validates the constraint at the framework level — no service-side clamping needed.

### 5. Auth macro: optional identity resolution

Currently the list endpoints use `requireLogin: true`. Changing to `requireLogin: false` (or omitting it) means the auth macro resolves identity when a token is present but doesn't reject anonymous requests. The handler then checks `identity.permission.role` to determine admin vs public behavior.

Need to verify the auth macro supports this — specifically that `identity` is available (possibly as a guest/anonymous object) when no token is provided.

## Risks / Trade-offs

**[Risk] Unindexed filter combinations cause slow queries on public endpoints**
→ Mitigation: The existing filters (userId, tagUnitIds, status, realmUnitId) all target indexed columns. The `maximum: 100` limit caps result set size. Monitor slow query logs after rollout.

**[Risk] `q` removal is breaking for admin clients**
→ Mitigation: The admin panel should use `/meili/*` endpoints for search. Verify no admin UI code depends on the `q` parameter in DB list endpoints before deploying.

**[Risk] Anonymous identity handling in auth macro**
→ Mitigation: Verify during implementation that the auth macro provides a usable identity object (with guest role) for unauthenticated requests. If not, the handler can check for identity presence directly.

## Open Questions

- Should `total` count be omitted for public callers to avoid `COUNT(*)` cost on large tables? (Admins may need it for dashboards, public callers typically don't.)
