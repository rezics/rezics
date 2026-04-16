## Why

The main server's DB-backed list endpoints (`GET /books/`, `GET /posts/`, `GET /realms/`) are currently admin-only, but the frontend needs structured listing with real-time DB data (filter by user, tags, realm, status, sort, cursor pagination) that Meilisearch doesn't fully cover due to index sync lag and limited filter expressiveness. Opening these endpoints removes the need for workarounds while keeping full-text search exclusively in Meilisearch to avoid expensive SQL LIKE queries.

## What Changes

- **Remove admin guard** from `GET /books/`, `GET /posts/`, `GET /realms/` — these become public endpoints with role-aware behavior
- **Remove `q` parameter** (SQL LIKE full-text search) from all three query schemas — full-text search stays in Meilisearch only
- **Add role-aware filtering**: public callers get `status=PUBLISHED` forced; admins retain full filter control (drafts, visibility, etc.)
- **Standardize pagination limit**: introduce a shared `PaginationLimit` Typebox schema in `@rezics/contract` with `{ minimum: 1, maximum: 100, default: 20 }`, applied to all list query schemas
- `GET /chapters/` and `GET /feedbacks/` remain admin-only (no change)

## Capabilities

### New Capabilities

- `public-list-endpoints`: Role-aware access control for DB-backed list endpoints (books, posts, realms) — same endpoint serves public and admin callers with different filter capabilities
- `pagination-limit-contract`: Shared Typebox pagination limit schema with max 100, enforced at the Elysia validation layer across all list endpoints

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **Affected packages**: `package/contract` (query schemas, pagination), `package/server` (route guards, service layer filtering)
- **APIs**: `GET /books/`, `GET /posts/`, `GET /realms/` change from admin-only to public with role-aware behavior; `q` param removed from their query schemas
- **Backward compatibility**: Admin callers retain full existing functionality. The `q` param removal is **BREAKING** for any admin client relying on DB-backed text search — they should use `/meili/*` endpoints instead.
- **No migration needed**: No database or schema changes.
