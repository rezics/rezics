## Context

Reactions currently live inside `@rezics/server` — the `reaction.api.ts`, `reaction.service.ts`, and three Prisma models (`Reaction`, `ReactionSummary`, `Bookmark`) share the main server's PostgreSQL database and process. The service handles sentiment reactions (like, dislike) and bookmark reactions (which trigger side-effect Bookmark row creation with tags). Notification emission is hard-coded into the reaction service via `emitNotificationEvent()`.

Two other services have already established the independent-service pattern: `@rezics/auth` (port 3001, own DB) and `@rezics/notify` (port 3002, own DB). Both use `@rezics/jwt` for token verification, `@t3-oss/env-core` + Valibot for env validation, and `x-internal-secret` headers for service-to-service trust.

The upcoming `unit-architecture` change introduces Shelves, which subsume bookmark functionality. Bookmark cleanup will follow that change. This design focuses solely on extracting reactions into a standalone service.

### Current Schema (server DB)

```prisma
model Reaction {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId    String   @db.Uuid
  targetId  String   @db.Uuid
  reaction  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [unitId], onDelete: Cascade)
  targetUnit Unit    @relation(fields: [targetId], references: [id], onDelete: Cascade)
  @@unique([userId, targetId, reaction])
  @@index([targetId])
  @@index([targetId, reaction])
  @@index([userId, reaction])
}

model ReactionSummary {
  targetId   String @db.Uuid
  reaction   String
  count      Int    @default(0)
  targetUnit Unit   @relation(fields: [targetId], references: [id], onDelete: Cascade)
  @@id([targetId, reaction])
  @@index([targetId])
}

model Bookmark {
  userId    String   @db.Uuid
  targetId  String   @db.Uuid
  tags      String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, targetId])
  @@index([userId])
  @@index([targetId])
}
```

## Goals / Non-Goals

**Goals:**
- Standalone reaction service with its own PostgreSQL database and Elysia server
- Clean service boundary: no foreign keys to the main DB, opaque UUIDs for `targetId`/`userId`
- Idempotent create/delete with denormalized summary counters
- Batch-capable summary and user-state endpoints for the content rendering hot path
- Decoupled notification: emit generic event to Notify, not reaction-type-specific notifications
- Contract-first: shared schemas in `@rezics/contract/src/reaction/`
- Same trust model as Notify: auth JWT for public reads/writes, shared secret for internal calls
- Redis caching designed into the interface but not required at launch

**Non-Goals:**
- Bookmark cleanup or migration (follows shelf redesign in `unit-architecture`)
- Bookmark model in the reaction service (organizational, belongs to shelf domain)
- Comment count tracking (content-domain concern, not sentiment)
- Reaction analytics or reporting
- Rate limiting (can be added later without schema changes)
- Horizontal scaling / Redis pub-sub (single-instance is sufficient initially)
- Frontend shelf UI replacement for the bookmark icon (separate work)

## Decisions

### D1: Separate Elysia Service on Port 3003

**Decision**: The reaction service runs as a standalone Elysia server on port 3003 with its own PostgreSQL database (`REACTION_DATABASE_URL`), following the exact pattern of `@rezics/notify` (port 3002).

**Rationale**: Reactions have a fundamentally different access pattern from content — every content page reads reaction data (summary + user state), and every engagement is a write. Isolating reaction I/O from content queries eliminates database contention. The pattern is already proven by auth and notify.

**Alternative considered**: Separate package, same process (mounted as Elysia plugin in server). Rejected because it still shares database connections and process failure scope. The network hop cost (~1-3ms local) is negligible relative to the isolation benefits, and the frontend loads reactions in parallel with content.

### D2: No Foreign Keys — Opaque UUIDs

**Decision**: `Reaction.targetId` and `Reaction.userId` are plain `@db.Uuid` columns with no foreign key constraints. The reaction service has no knowledge of what a targetId or userId refers to.

**Rationale**: Foreign keys create a hard dependency on the main database schema. Every migration to the Unit or User table would require coordinating with the reaction service. Without FKs, the reaction service is immune to content schema changes (including the massive `unit-architecture` migration).

**Orphan cleanup**: When a Unit is deleted, the main server calls the reaction service's `POST /internal/cleanup` endpoint with the deleted `targetId`. This is synchronous — the server waits for cleanup before completing the deletion transaction.

**Alternative considered**: Async cleanup via event bus. Rejected for now — adds infrastructure complexity (message broker) for minimal benefit. The cleanup call is a single DELETE by targetId, sub-millisecond.

### D3: Reaction Type Allowlist

**Decision**: The service validates `reaction` values against a configurable allowlist. Initial set: `["like", "dislike"]`. The `bookmark` and `comment` types are explicitly excluded.

**Rationale**: Open string reactions invite abuse (custom spam types) and make aggregation unpredictable. A constrained set ensures type safety, predictable UI mapping, and efficient indexing. The allowlist is configurable via environment variable (`REACTION_TYPES`) so new types can be added without code changes.

**Why no `bookmark`**: Bookmarks are organizational (save + classify with tags), not sentiment. They belong in the shelf domain. Including them in the reaction service would recreate the current coupling.

**Why no `comment`**: Comment counts are a property of the content domain — the server knows how many Posts target a given Unit. Tracking them in the reaction service duplicates state.

**Alternative considered**: Keep open strings with UI-side filtering. Rejected because it pushes validation to every consumer and allows junk data to accumulate.

### D4: Summary Counters in Synchronous Transaction

**Decision**: `ReactionSummary` is updated in the same transaction as the `Reaction` insert/delete. No async aggregation.

**Rationale**: The reaction schema is two tables. The transaction cost of `INSERT reaction + UPSERT summary` is minimal (~2-3ms). Async aggregation (event-driven counter updates) adds complexity (at-least-once delivery, eventual consistency window, reconciliation jobs) for no measurable benefit at current scale.

**Migration path**: If write volume grows to the point where transaction contention is measurable, the summary update can be moved to an async path (Redis INCR + periodic PostgreSQL sync) without changing the public API.

### D5: Split Read/Write Traffic — Reads Direct, Writes via Server

**Decision**: The frontend calls the reaction service directly for **reads** (`GET /reactions/summary`, `GET /reactions/my`). **Writes** (`POST /reactions`, `DELETE /reactions`) are routed through the main server, which proxies them to the reaction service's internal API and handles side-effects (notification dispatch).

**Rationale**: Reads are the hot path (every content page) and benefit from direct access for latency. Writes are lower frequency and require orchestration context (ownership resolution, notification dispatch, future economy system) that the main server already has. Routing writes through the server eliminates the reaction service's need to call back to the server for owner resolution and to the notify service for event dispatch — removing coupling and the need for retry queues for each new side-effect.

**CORS**: The reaction service allows the same origins as server and notify (`localhost:35001/35002` in dev, `*.rezics.com` in prod).

**Auth**: Read endpoints verify the same auth JWT that the server uses. The reaction service uses `@rezics/jwt`'s `createJwtVerifier()` + `createRemoteJWKSet()` to verify tokens against the auth service's JWKS endpoint. Write endpoints on the reaction service are internal-only (secret-guarded), while the main server's write proxy endpoints use JWT auth.

### D6: Server-Side Notification Dispatch

**Decision**: When a reaction write is proxied through the main server, the **server** dispatches the notification to Notify's `POST /internal/event`. The reaction service has no knowledge of notifications.

```typescript
// Server dispatches after successful reaction create:
{
  recipientId: string,    // resolved by server via prisma (direct DB access)
  type: "LIKE",           // server maps: all reactions → LIKE
  actorId: string,        // userId who reacted
  entityType: "unit",
  entityId: string,       // targetId
  meta: {}
}
```

**Rationale**: The server already has direct database access to resolve ownership (`prisma.unit.findUnique`), already has the notify client (`emitNotificationEvent`), and is the natural orchestrator for write side-effects. This eliminates the reaction service's need to call back to the server for owner resolution and to notify for event dispatch — two outbound HTTP calls per reaction write that previously had no retry mechanism. Future side-effects (economy system) can be added to the server's write handler without touching the reaction service.

**Previous approach (superseded)**: The reaction service previously called `GET /internal/units/owner` on the server to resolve ownership, then called Notify directly. This created circular coupling (reaction → server → reaction for cleanup, reaction → notify) and would require adding a new client + retry path for each new side-effect.

### D7: Simplified API Surface

**Decision**: The reaction service API is streamlined compared to the current server endpoints:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/reactions/summary` | GET | None | Batch summary counts (`?targetIds=a,b,c`) — reaction service |
| `/reactions/my` | GET | JWT | User's reactions for targets (`?targetIds=a,b,c`) — reaction service |
| `/reactions` | POST | JWT | Create reaction `{ targetId, reaction }` — **main server** (proxied) |
| `/reactions` | DELETE | JWT | Delete reaction `?targetId=x&reaction=y` — **main server** (proxied) |
| `/internal/create` | POST | Secret | Internal create `{ userId, targetId, reaction }` — reaction service |
| `/internal/remove` | POST | Secret | Internal remove `{ userId, targetId, reaction }` — reaction service |
| `/internal/cleanup` | POST | Secret | Delete all reactions for a target `{ targetId }` — reaction service |
| `/health` | GET | None | Health check — reaction service |

**Removed from current API:**
- `GET /reactions/` (list with pagination) — not used by any frontend component; can be re-added if needed
- `PUT /reactions/` (update reaction type) — unnecessary; delete old + create new achieves the same result atomically from the client's perspective
- All `/reactions/bookmarks/*` endpoints — bookmark domain removed

**Summary endpoint is unauthenticated**: Reaction counts are public data. No reason to require auth for "how many likes does this have?" This eliminates an unnecessary auth check on the hottest read path.

### D8: Data Migration Strategy

**Decision**: Migration is a one-time script that copies rows from the server DB to the reaction DB, then removes the reaction tables from the server schema.

**Steps:**
1. Deploy reaction service with empty database
2. Run migration script: `SELECT * FROM "Reaction" WHERE reaction NOT IN ('bookmark', 'comment')` from server DB → `INSERT INTO "Reaction"` on reaction DB. Same for `ReactionSummary`.
3. Verify counts match
4. Deploy updated server (reaction domain removed, reaction-client added for cleanup calls)
5. Deploy updated frontend (reaction API URL changed)
6. Drop `Reaction` and `ReactionSummary` tables from server DB (keep `Bookmark` for shelf migration later)

**Rollback**: If issues arise after step 4, revert server deployment. Reaction data in the new DB is append-only during the transition — any new reactions created after migration can be replayed from the reaction service's DB back to the server DB.

## Target Schema (Reaction Service DB)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("REACTION_DATABASE_URL")
}

generator client {
  provider = "prisma-client"
  output   = "./client"
}

model Reaction {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @db.Uuid
  targetId  String   @db.Uuid
  reaction  String   @db.VarChar(32)
  createdAt DateTime @default(now())

  @@unique([userId, targetId, reaction])
  @@index([targetId])
  @@index([targetId, reaction])
  @@index([userId, reaction])
  @@index([userId, createdAt])
}

model ReactionSummary {
  targetId  String @db.Uuid
  reaction  String @db.VarChar(32)
  count     Int    @default(0)

  @@id([targetId, reaction])
  @@index([targetId])
}
```

Changes from current:
- **No FK relations** — `userId` and `targetId` are plain UUIDs
- **`VarChar(32)`** — constrained reaction string length
- **New index `[userId, createdAt]`** — supports user reaction history queries
- **`gen_random_uuid()`** — standard PostgreSQL UUID generation (no UUIDv7 dependency)
- **No `Bookmark` model** — removed entirely

## Package Structure

```
package/reaction/
├── src/
│   ├── index.ts                  # Elysia server entry, CORS, error handler
│   ├── env.ts                    # @t3-oss/env-core + Valibot validation
│   ├── macro/
│   │   ├── auth.ts               # requireUser macro (JWT → userId) for read endpoints
│   │   └── internal.ts           # requireInternal macro (x-internal-secret) for write + cleanup
│   ├── reaction/
│   │   ├── reaction.api.ts       # Public read endpoints (summary, my)
│   │   └── reaction.service.ts   # Business logic + summary counter maintenance
│   └── internal/
│       └── internal.api.ts       # POST /internal/create, /internal/remove, /internal/cleanup
├── prisma/
│   ├── schema.prisma
│   └── client.ts                 # Prisma client singleton
├── package.json
└── tsconfig.json

package/contract/src/reaction/
├── index.ts
├── reaction.schema.ts            # Typebox schemas (create, delete, summary, my)
├── reaction.types.ts             # Shared types (ReactionType, ReactionSummaryDto)
└── internal.ts                   # Internal schemas (create, remove, cleanup)
```

## Data Flow

```
Content page load (parallel):
  Frontend → GET /units/:id (server)        → content data
  Frontend → GET /reactions/summary?targetIds=id (reaction service) → { like: 42, dislike: 3 }
  Frontend → GET /reactions/my?targetIds=id (reaction service, auth) → ["like"]

Reaction create (writes routed through server):
  Frontend → POST /reactions (server, JWT auth)
    → Server calls POST /internal/create { userId, targetId, reaction } (reaction service)
      → Reaction service: Transaction: INSERT Reaction + UPSERT ReactionSummary
      → Returns: { id, userId, targetId, reaction, createdAt, created }
    → If created: Server resolves owner via prisma (direct DB access)
      → If owner != actor: POST /internal/event (notify service, fire-and-forget)
    → Response: { id, userId, targetId, reaction, createdAt }

Reaction delete (writes routed through server):
  Frontend → DELETE /reactions?targetId=x&reaction=y (server, JWT auth)
    → Server calls POST /internal/remove { userId, targetId, reaction } (reaction service)
      → Reaction service: Transaction: DELETE Reaction + decrement ReactionSummary
      → Returns: { deleted }
    → Response: { deleted }

Unit deletion cleanup:
  Server deletes Unit
    → POST /internal/cleanup { targetId } (reaction service)
    → Reaction service: DELETE FROM Reaction WHERE targetId = :id
    → Reaction service: DELETE FROM ReactionSummary WHERE targetId = :id
```

## Environment Variables

### Reaction Service (`package/reaction/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACTION_DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REACTION_INTERNAL_SECRET` | Yes | — | Shared secret for internal endpoints |
| `AUTH_JWKS_URL` | No | `http://localhost:3001/.well-known/jwks.json` | Auth JWKS endpoint |
| `AUTH_ISSUER` | No | `http://localhost:3001` | JWT issuer |
| `AUTH_JWT_AUDIENCE` | No | `rezics` | JWT audience |
| `REACTION_TYPES` | No | `like,dislike` | Comma-separated allowed reaction types |
| `PORT` | No | `3003` | HTTP listen port |

Note: `NOTIFY_*` and `SERVER_*` env vars have been removed. The reaction service no longer makes outbound calls to other services. Notification dispatch is handled by the main server.

### Server additions (`package/server/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACTION_BASE_URL` | No | `http://localhost:3003` | Reaction service URL |
| `REACTION_INTERNAL_SECRET` | No | — | Secret for reaction internal cleanup calls |

### Frontend additions (`package/app/.env`)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_REACTION_SERVICE_URL` | No | `http://localhost:3003` | Reaction service URL |

## Key Queries

```sql
-- Batch summary (hot path — every content page)
SELECT "targetId", "reaction", "count"
FROM "ReactionSummary"
WHERE "targetId" IN ($1, $2, $3);

-- User reactions for targets (hot path — every authenticated page)
SELECT "targetId", "reaction"
FROM "Reaction"
WHERE "userId" = $1 AND "targetId" IN ($2, $3, $4);

-- Create reaction (idempotent — check first)
SELECT 1 FROM "Reaction"
WHERE "userId" = $1 AND "targetId" = $2 AND "reaction" = $3;

-- If not exists:
INSERT INTO "Reaction" ("userId", "targetId", "reaction") VALUES ($1, $2, $3);
INSERT INTO "ReactionSummary" ("targetId", "reaction", "count")
VALUES ($2, $3, 1)
ON CONFLICT ("targetId", "reaction") DO UPDATE SET "count" = "count" + 1;

-- Cleanup on unit deletion
DELETE FROM "Reaction" WHERE "targetId" = $1;
DELETE FROM "ReactionSummary" WHERE "targetId" = $1;
```

## Risks / Trade-offs

**[Network hop latency on reads] → Mitigation:** The reaction service adds ~1-3ms per request on localhost. The frontend loads reactions in parallel with content, so this does not increase perceived page load time.

**[Extra hop for writes] → Mitigation:** Writes go client → server → reaction service (one extra hop vs. direct). Likes aren't latency-critical — the UI optimistically updates immediately. The ~5ms overhead is invisible to the user.

**[Orphan reactions on failed cleanup] → Mitigation:** If the server fails to call `/internal/cleanup` during unit deletion (crash, network error), orphan reactions remain. A periodic background job (hourly) can reconcile. Not needed at launch — orphan reactions are harmless (never displayed, take negligible space).

**[Two databases to manage] → Mitigation:** The reaction schema is trivially small (2 tables, 6 indexes). Database provisioning, backups, and connection pooling are standard operations already handled for auth and notify databases. The operational cost is marginal.

**[Eventual consistency during migration] → Mitigation:** During the migration window (old server reactions → new service), there's a brief period where new reactions go to the new service while old data is still in the server DB. The migration script handles this by copying all data first, then switching the frontend.

## Migration Plan

1. **Phase 1 — Deploy reaction service**: Create `package/reaction`, deploy with empty database. Service is running but not receiving traffic.
2. **Phase 2 — Data migration**: Run migration script to copy `Reaction` and `ReactionSummary` rows (excluding bookmark/comment types) from server DB to reaction DB. Verify row counts match.
3. **Phase 3 — Server update**: Deploy updated `@rezics/server` with reaction domain removed, `reaction-client` added for cleanup calls, `GET /internal/units/owner` endpoint added.
4. **Phase 4 — Contract + API client update**: Deploy updated `@rezics/contract` (new reaction schemas) and `@rezics/api` (reaction client pointing to reaction service URL).
5. **Phase 5 — Frontend update**: Deploy updated `@rezics/app` with reaction components pointing to new service, bookmark UI removed from reaction bar.
6. **Phase 6 — Cleanup**: Drop `Reaction` and `ReactionSummary` from server Prisma schema. Keep `Bookmark` table for later shelf migration.

**Rollback**: At any phase, revert to the previous deployment. The server's reaction code is the rollback target. If data diverged during the transition, a reverse migration script copies new reactions from the reaction DB back to the server DB.

## Open Questions

1. **Redis caching timeline**: Redis is designed-in but optional. Should it be included in the initial deployment, or added as a follow-up change when performance metrics justify it?
2. **Reaction history page**: The current `ReactionInfoPage` shows a user's reaction history. With the list endpoint removed from the reaction service, should the frontend query reactions by `userId` directly, or should the reaction service expose a dedicated `/reactions/history` endpoint?
