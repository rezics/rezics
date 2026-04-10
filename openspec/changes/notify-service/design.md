## Context

Rezics is a multi-service monorepo with `server` (domain logic), `auth` (identity infrastructure), and shared packages (`contract`, `jwt`). There is no real-time communication layer. The platform needs in-app notifications and direct messaging. A new `package/notify` service will own this, running as a separate Elysia server with its own PostgreSQL database.

Existing infrastructure already anticipates this: `@rezics/contract` reserves a `notification-session-token` header, and `@rezics/jwt` provides reusable JWKS verification utilities.

**Versions:** Elysia ^1.4.22, Prisma ^7.6.0 (matching server and auth).

## Goals / Non-Goals

**Goals:**
- Standalone notification service with persistence, query-time aggregation, and SSE real-time push
- Bilateral direct messaging with server-mediated authorization and WebSocket delivery
- Clean trust boundary: shared secret for internal writes, auth JWT for user reads
- Hybrid metadata: entity snapshots in Notify, actor profiles resolved fresh by frontend
- Contract-first: shared schemas in `@rezics/contract/src/notify/`

**Non-Goals:**
- Email, push, or SMS delivery (out of scope — Notify owns in-app only)
- Group conversations (bilateral only in this iteration)
- Notification preferences/settings (users cannot mute types yet)
- Horizontal scaling / Redis pub-sub (single-instance is sufficient initially)
- Admin notification management UI

## Decisions

### 1. Query-time aggregation over write-time merging

**Decision:** Notifications are stored as individual rows. Aggregation (e.g., "3 people liked Book X") is computed at query time by grouping on `(recipientId, type, entityType, entityId)`.

**Why:** Write-time merging complicates the ingest path — Notify must find-and-update existing rows, handle race conditions on concurrent likes, and decide what happens after a read notification receives new activity. Query-time grouping keeps writes as simple inserts and moves complexity to a single SQL query with `GROUP BY`.

**Aggregation rules:**
- Aggregatable types: `LIKE`, `FAVORITE`, `FOLLOW` — grouped by entity
- Individual types: `COMMENT`, `MENTION`, `SYSTEM`, `INVITATION` — each shown separately
- The aggregation query collects `actor_ids` (array), `count`, and `latest_at` per group

**Alternative considered:** Write-time batch merge (fold new actors into existing notification row). Rejected because it introduces upsert contention, complicates the read-marking model, and requires deciding whether to re-open read notifications.

### 2. Unread count = aggregated group count

**Decision:** `GET /notifications/unread-count` returns the number of distinct aggregated groups that contain at least one unread row, not the total number of unread rows.

**Why:** This matches what the user sees in the notification list. If 5 people liked the same book, that's 1 notification item, not 5. The badge should show 1.

### 3. SSE pushes raw events, frontend merges

**Decision:** When a new event arrives and the recipient has an active SSE connection, Notify pushes the raw individual event (same shape as a single notification row). The frontend is responsible for merging it into its local aggregated state.

**Why:** Notify's SSE layer is the fan-out module — it shouldn't re-run aggregation queries per push. The frontend already holds the current notification list in state and can locally append an actor to an existing group or create a new group. This keeps the SSE path simple and stateless.

### 4. DM sends are server-mediated (Option 1)

**Decision:** The frontend sends DMs via `POST /dm/send` on the server. The server validates permissions (follow status, blocks, org membership), then forwards to Notify's `POST /internal/dm`. The WebSocket channel to the frontend is receive-only.

**Why:** This maintains the principle that Notify never makes authorization decisions. The server already owns the social graph (follows, blocks). Routing DM sends through the server avoids coupling Notify to a server callback API and keeps the trust model simple: Notify trusts the shared secret, period.

**Alternative considered:** Bidirectional WebSocket where Notify calls server to check permissions on each send. Rejected because it couples Notify to server availability at request time and contradicts the design principle of Notify not calling other services.

### 5. Hybrid metadata strategy

**Decision:** Notification rows store `actorId` (ID only) and entity snapshots (`entityTitle`, `entityCover`, etc.) in `meta`. The frontend resolves actor display data (name, avatar) via a batch endpoint on the server.

**Why:** Actor profiles change frequently (name, avatar updates). Entity attributes (book title, cover) are stable. Snapshotting stable data avoids unnecessary fetches. Resolving volatile data (actors) at render time keeps the UI fresh. The frontend batches all unique actor IDs across the notification page into a single `GET /users/batch?ids=...` call, cached by TanStack Query.

**Server-side requirement:** New `GET /users/batch` endpoint on `@rezics/server` that accepts a comma-separated list of user IDs and returns `{ [id]: { name, slug, avatar } }`.

### 6. Reuse `@rezics/jwt` for token verification

**Decision:** Notify uses `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` to verify auth-issued JWTs. No custom JWKS module.

**Why:** The infrastructure already exists, is tested, and handles caching with cooldown. Building a separate `auth/jwks.ts` in Notify would duplicate this.

### 7. Elysia macro for user identity

**Decision:** Notify defines a `requireUser` Elysia macro that extracts and verifies the JWT, deriving `userId` from the `sub` claim. Applied to all read endpoints. Follows the same macro pattern as `@authMacro` in the server.

### 8. Conversation creation is implicit

**Decision:** Sending the first message between two users implicitly creates the conversation. There is no explicit `POST /dm/conversations` endpoint. The server's `POST /dm/send` handler calls Notify's internal DM endpoint, which upserts the conversation (using lexicographic participant ordering for uniqueness).

## Data Flow

```
Notification flow:
  Server action (like/comment/follow)
    → Server builds event payload with entity meta snapshot
    → POST /internal/event (x-internal-secret header)
    → Notify: insert row + fan-out to SSE if recipient connected
    → Frontend: receives raw event via SSE, merges into local state

DM flow:
  Frontend: POST /dm/send → Server
    → Server: validates permission (follow/block check)
    → Server: POST /internal/dm (x-internal-secret header)
    → Notify: upsert conversation, insert message, push via WS
    → Recipient frontend: receives message on WS connection

Notification read flow:
  Frontend: GET /notifications
    → Notify: query-time aggregation (GROUP BY type+entity)
    → Response includes actorIds per group
    → Frontend: GET /users/batch?ids=... (cached)
    → Render with fresh actor profiles + snapshotted entity data
```

## Package Structure

```
package/notify/
├── src/
│   ├── index.ts                 # Entry point, Elysia app assembly
│   ├── env.ts                   # @t3-oss/env-core + Valibot validation
│   ├── macro/
│   │   └── auth.ts              # requireUser macro (JWT → userId)
│   ├── notification/
│   │   ├── notification.api.ts  # GET/POST/DELETE notification endpoints
│   │   ├── notification.service.ts  # Aggregation queries, read marking
│   │   └── notification.mapper.ts   # Row → aggregated response shape
│   ├── stream/
│   │   ├── stream.api.ts        # GET /stream (SSE endpoint)
│   │   └── fan-out.ts           # In-process userId → Set<connection> map
│   ├── dm/
│   │   ├── dm.api.ts            # WS /dm, GET conversations/messages
│   │   └── dm.service.ts        # Conversation upsert, message persistence
│   └── internal/
│       └── internal.api.ts      # POST /internal/event, POST /internal/dm
├── prisma/
│   └── schema.prisma
├── package.json
└── tsconfig.json

package/contract/src/notify/
├── index.ts
├── notification.ts              # NotificationType enum, event payload schema
├── dm.ts                        # DM message schema, conversation schema
└── internal.ts                  # Internal event/dm request schemas
```

## Risks / Trade-offs

**[Single-instance fan-out] → Mitigation:** In-process SSE/WS maps don't survive restarts and don't scale horizontally. Acceptable for initial deployment. Migration path to Redis pub-sub is localized to `fan-out.ts` and does not touch routes or data model.

**[Actor batch endpoint latency] → Mitigation:** `GET /users/batch` adds one extra HTTP call per notification page load. TanStack Query caching (`staleTime: 5min`) means this call is skipped for repeat views. The batch endpoint should cap at ~50 IDs per request.

**[SSE reconnection state] → Mitigation:** On reconnect, the frontend re-fetches the notification list via HTTP. SSE does not replay missed events. The `Last-Event-ID` header could be supported later but is not required initially — the notification list is the source of truth, SSE is best-effort real-time.

**[Meta snapshot staleness for entities] → Mitigation:** If a book title changes, old notifications show the old title. This is acceptable and arguably correct — the notification describes what happened at the time it happened. No mitigation required.

**[DM round-trip latency] → Mitigation:** Server-mediated sends add one HTTP hop vs. direct WebSocket send. For a messaging feature that is not latency-critical (not a chat app), this is acceptable. If DM volume grows significantly, a direct WebSocket send path with permission caching could be revisited.
