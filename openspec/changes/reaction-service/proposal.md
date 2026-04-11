## Why

Reactions are the highest-frequency engagement operation in Rezics — every content page reads reaction summaries and the current user's reactions, and every like/dislike is a write. Today, this logic lives inside `@rezics/server`, sharing the same database and process as content, search sync, and attribution. Reaction writes contend with content queries for database connections and locks, and any schema migration (especially the upcoming unit-architecture overhaul) forces the reaction tables through the same migration pipeline. Extracting reactions into a standalone service with its own database follows the same pattern already established by `@rezics/auth` and the incoming `@rezics/notify`, giving reactions independent scaling, failure isolation, and immunity from content schema churn.

A secondary concern is the current coupling between reactions and bookmarks — creating a "bookmark" reaction triggers a side-effect `Bookmark` row with its own tags model inside every reaction write transaction. Bookmarks are organizational (save + classify), not sentiment-based, and belong in the shelf domain. This change removes that coupling; bookmark cleanup itself is out of scope and will follow the shelf redesign in `unit-architecture`.

## What Changes

- **New `package/reaction` service** — standalone Elysia server with its own PostgreSQL database (Prisma 7). Owns `Reaction` and `ReactionSummary` tables with no foreign keys to the main database. Uses opaque UUIDs for `targetId` and `userId`.
- **New `@rezics/contract` reaction schemas** — shared Typebox schemas for reaction endpoints under `package/contract/src/reaction/`, replacing the existing `package/contract/src/reaction.ts` file. Bookmark-related schemas removed.
- **`@rezics/server` integration** — server drops its local reaction tables, service, and API routes. Gains an internal HTTP client (`reaction-client`) for calling the reaction service's cleanup endpoint on unit deletion. Notification emission moves out of the server's reaction code entirely.
- **Reaction service notification integration** — on reaction create, the reaction service calls Notify's `POST /internal/event` with a `reaction.created` payload. Notify decides notification type mapping (like -> LIKE). **BREAKING**: The `FAVORITE` notification type is no longer emitted by the reaction service (bookmark reactions removed).
- **`@rezics/api` client rewrite** — reaction API functions point to the reaction service URL. Bookmark-related functions (`getBookmarkTags`, `setBookmarkTags`) and mutation hooks removed.
- **Frontend component updates** — `ReactionBar` and `MiniActionBar` drop the bookmark icon (shelf UI replaces it separately). Bookmark management components (`BookmarkTagManager`, `BookmarkItemCard`, `UserBookmarkTagsCard`) removed. `BookmarkPage` and bookmark tab in `ReactionInfoPage` removed.
- **Redis caching layer** — designed into the service interface but optional at launch. Can be added without API changes when needed.

## Capabilities

### New Capabilities

- `reaction-crud`: Create, delete, and query reactions. Idempotent writes with denormalized summary counters maintained in transaction. Validates reaction types against a configurable allowlist (initially: `like`, `dislike`).
- `reaction-summary`: Batch-capable aggregated reaction counts per target. Single and multi-target modes. Optimized for the content rendering hot path.
- `reaction-user-state`: Per-user reaction state for one or many targets. Powers "did I like this?" UI state. Single and multi-target modes.
- `reaction-internal-api`: Shared-secret-protected endpoints for trusted backend services — cleanup on unit deletion, bulk operations.
- `reaction-auth`: JWT verification of user identity via auth JWKS for public endpoints; shared secret verification for internal endpoints. Same trust model as `@rezics/notify`.
- `reaction-notification`: Emit reaction events to Notify's internal event ingestion endpoint. Fire-and-forget with no coupling to notification types.

### Modified Capabilities

_(none — no existing spec-level behavior changes)_

## Impact

**Affected packages:**
- `package/reaction` — new package (Elysia service + Prisma schema)
- `package/contract` — rewrite `src/reaction/` with new schemas, remove bookmark schemas
- `package/server` — remove reaction domain (`reaction.api.ts`, `reaction.service.ts`, etc.), remove `Reaction`/`ReactionSummary`/`Bookmark` from Prisma schema, add `reaction-client` for internal cleanup calls
- `package/api` — rewrite reaction API client to point to reaction service, remove bookmark functions
- `package/app` — update `ReactionBar`/`MiniActionBar` (remove bookmark icon), remove bookmark management components and pages

**Dependencies added:**
- `package/reaction`: `elysia@^1.4.22`, `prisma@^7.6.0`, `@rezics/contract`, `@rezics/jwt`

**New infrastructure:**
- Separate PostgreSQL database for Reaction service (`REACTION_DATABASE_URL`)
- `REACTION_INTERNAL_SECRET` shared between server and reaction service
- `REACTION_SERVICE_URL` env var in server and frontend

**Backward compatibility:** **BREAKING** for any consumer of the reaction API — endpoint base URL changes from main server to reaction service. The `bookmark` reaction type is no longer accepted. The `FAVORITE` notification type is no longer emitted by reactions. Bookmark management endpoints are removed entirely.

**Migration:** Existing `Reaction` and `ReactionSummary` rows (excluding `reaction = 'bookmark'`) must be migrated from the server database to the reaction database. Bookmark-typed reactions and Bookmark rows are preserved in the server DB for later shelf migration.
