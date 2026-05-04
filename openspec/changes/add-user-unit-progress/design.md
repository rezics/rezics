## Context

The product currently expresses "user has interacted with unit X" only through `Shelf` / `ShelfUnit` membership, which is a set relation, not a measurement. We have no place to store *how much* of a unit a user has consumed, *how long* they spent, or *where they left off*. As web-novel volume scales toward 10M+ units, two product features are blocked:

1. "Continue reading" feeds — needs `(user, ordered by recent activity)` lookup with a position pointer.
2. Per-unit progress distribution / viewer count — covered by a sibling change that projects this data into Meilisearch as a separate index. That sibling change cannot exist without a fact source, which is what this design establishes.

The Meilisearch projection, the search query surface, and any aggregate-level reporting are explicitly out of scope here and live in `add-progress-search-index`.

## Goals / Non-Goals

**Goals:**
- Define a single, durable fact source for per-user-per-unit progress, suitable as input to downstream projections.
- Support O(1) upsert per progress event, O(1) read per `(userId, unitId)`, and O(log n) retrieval of "the caller's most recently touched units".
- Keep this change's surface area minimal: schema + service + four endpoints. No counters, no aggregates, no Meilisearch coupling.
- Stay aligned with the project's existing domain layout (`{domain}.api.ts` / `.service.ts` / `.mapper.ts` / `.types.ts`).

**Non-Goals:**
- Aggregate per-unit stats (viewer count, average progress, bucket distribution).
- Meilisearch index, sync, bucketization, or query routing.
- Cross-unit "library overview" stats (total time across catalog, etc.).
- Anonymous / pre-login progress capture.
- Realm- or score-aware progress segmentation (`ScoreAggregate` already covers per-realm rating; progress is per-user, realm-agnostic for now).
- Reaction-related counters (the reaction service is independent and stays so).

## Decisions

### Fact source vs. derived state

**Decision:** `UserUnitProgress` is a write-through fact source — every client upsert writes the canonical row. No event log, no append-only ledger.

**Why:** The product reads "current progress for (user, unit)" two orders of magnitude more than it reads history; the natural representation is the current value. Event-sourcing would require a fold on every read or a maintained projection — the projection *is* the row we're storing now, so collapse it.

**Alternative considered — append-only `ProgressEvent` table with a derived `UserUnitProgress` projection:** rejected. It doubles write volume, adds a consistency boundary (when does the projection become correct?), and we have no use case for raw event history. If a future audit / replay use case appears, we can layer a side-stream into the service write path without rewriting reads.

### Composite primary key `(userId, unitId)`

**Decision:** Use `@@id([userId, unitId])` rather than a synthetic `id`.

**Why:** There is exactly one progress row per `(user, unit)` by definition. A composite PK gives us the uniqueness invariant, the natural lookup key, and a clustered access path for free. A surrogate `id` adds a column we'd never query by and forces a separate unique index on `(userId, unitId)` anyway.

**Trade-off:** Some ORMs prefer single-column PKs for relation modeling. Prisma supports composite PKs first-class, so this is not a constraint here.

### `progress` as `Float` in `[0, 1]`

**Decision:** Store progress as a single `Float` representing fractional completion, not as `(currentChapter, totalChapters)` or as raw byte/word offsets.

**Why:** Different unit types (web novels, comics, audiobooks one day) have different natural progress units. A normalized fraction is the only representation that lets us compute "how far through" uniformly across types and bucketize cleanly downstream. Domain-specific cursors live in `lastPosition` (opaque string), not in the progress field.

**Trade-off:** Floating point comparisons are imprecise. We never `==` compare; we only store, return verbatim, and bucketize on the read path of the projection (which truncates to discrete buckets and is therefore robust).

### `lastPosition` as opaque `String?`

**Decision:** `lastPosition` is a free-form string the client owns. Server does not parse, validate format, or compare it.

**Why:** The cursor for a novel chapter ("ch-42#scroll=0.83") differs from a comic page ("page-117") differs from an audiobook timestamp ("00:42:11.500"). Pinning a structure server-side either over-specifies one type or fragments the field per-type — neither helps. Treat it like an opaque resume token.

### Status enum

**Decision:** Four-value enum: `VIEWED`, `READING`, `COMPLETED`, `DROPPED`.

**Why:** These are the four states the product surface needs:
- `VIEWED` — touched but not actively reading (transient; the row exists but no commitment).
- `READING` — currently in progress.
- `COMPLETED` — user marked finished (or progress hit 1.0 with the right kind of unit).
- `DROPPED` — user explicitly abandoned (distinct from "stopped reading because life happened" — the latter stays `READING`).

The enum is the bucket axis for the per-unit aggregate that the sibling change builds. We deliberately separate `progress` (number) from `status` (intent) — a user can be at 0.85 and `DROPPED`, or at 0.05 and `READING`.

**Alternative considered — derive status from progress + lastSeenAt staleness:** rejected. `DROPPED` is an explicit user signal; deriving it from inactivity would be wrong half the time.

### `totalTimeMs` as `BigInt`

**Decision:** Store cumulative time spent as `BigInt` milliseconds, accumulated server-side from client-reported deltas.

**Why:** A `Number` (53-bit) covers ~285K years of milliseconds, so `Int` would have been fine. We use `BigInt` for two reasons: (a) Postgres `bigint` matches it directly with no precision loss in the Prisma client, and (b) it removes any ambiguity for downstream serialization / accumulation across millions of rows. Client sends *deltas* (e.g., "user spent another 12s on this unit"); server adds. Clients never report absolute totals — that turns reconciliation into a war.

### Upsert API shape — single `PUT` endpoint

**Decision:** One auth-gated `PUT /me/units/:unitId/progress` accepting a partial body (`progress?`, `status?`, `lastPosition?`, `addTimeMs?`, `extra?`). Server upserts the row, applying these semantics:
- `progress`, `status`, `lastPosition`, `extra` overwrite if provided (last-write-wins).
- `addTimeMs` is *additive* (`totalTimeMs += addTimeMs`); negative values rejected.
- `firstSeenAt` is set on first row creation only and never updated; `lastSeenAt = now()` on every write.

**Why:** Clients emit progress events at irregular cadence; merging into "the current state" is exactly what an upsert is for. Splitting into multiple endpoints (separate "set progress" / "add time" / "set status") would force the client to fan out one event into several requests for no semantic gain.

**Alternative considered — `POST` event endpoint with derived state:** rejected per the fact-source decision above.

**Concurrency:** Per `(userId, unitId)`, a single user typically writes from one device at a time. Two devices racing produces last-write-wins for non-additive fields and correct accumulation for `totalTimeMs` (the additive update is a Postgres `UPDATE ... SET totalTimeMs = totalTimeMs + $1`, which is atomic). No advisory locks or optimistic-concurrency tokens are needed.

### Pagination of `GET /me/progress`

**Decision:** Cursor-based pagination using `lastSeenAt` (descending) plus `unitId` as a tiebreaker. Page size capped server-side (e.g., 50).

**Why:** The natural use case ("continue reading") is "give me the most recent N items". Offset pagination drifts as the user reads more. A cursor on `(lastSeenAt, unitId)` gives stable pagination with the `(userId, lastSeenAt DESC)` index doing all the work.

### Indexes

**Decision:** PK gives `(userId, unitId)` lookup. Add two secondary indexes:
- `(userId, lastSeenAt DESC)` — drives `GET /me/progress` and any "recent activity" feed.
- `(unitId, status)` — admin / moderation use ("show me everyone currently `READING` this unit"). Cheap because `unitId` is already high-cardinality and this isn't a primary read path.

**Not added:** an index on `(userId, status)` — currently no API filters by it, and it would be redundant with the `lastSeenAt` index for the dominant read.

### Service / API layout

**Decision:** New domain folder `package/server/src/progress/`:
- `progress.types.ts` — domain types and the status enum.
- `progress.service.ts` — single-row upsert / get / list / delete; no cross-domain logic.
- `progress.mapper.ts` — Prisma row ↔ contract DTO.
- `progress.api.ts` — Elysia routes, mounted via `.use()` in `src/index.ts` under the auth-gated namespace.

Contract types live in `package/contract` (Typebox), and `package/api` exposes TanStack Query hooks for the four endpoints. No special exposure pattern — this follows the convention every other domain in the server already uses.

## Risks / Trade-offs

- **Hot-row write contention on a single popular unit by a single user is impossible** (one row per user per unit), but a user with 10K rows still pays log(N) on the `lastSeenAt` index for the continue-reading query. → Mitigation: page size cap and cursor pagination keep this at constant client cost.
- **Float progress is approximate.** Two clients reporting 0.5000001 and 0.5000003 will overwrite each other and the user might briefly see 0.5000001 displayed even after the later write. → Mitigation: the projection bucketizes to ~10 buckets, so this is invisible downstream; user-facing display rounds to whole percent.
- **`totalTimeMs` reflects only what clients report.** A user who reads with the tab closed produces no time signal. → Mitigation: this is a known limitation of any client-reported time metric. We accept it; product surfaces the value as "approximate".
- **Schema migration on a large table is currently free** (the table doesn't exist yet), but the table will grow without bound — one row per `(active user, touched unit)`. → Mitigation: at the data scale this becomes a problem (≫100M rows), we revisit with partitioning by `userId` hash. Not now.
- **No CDC, no Meilisearch coupling here.** The sibling change adds an in-process call from the upsert path into the search sync layer. That call lives in the sibling spec; this change leaves the service hook open (the upsert path is the natural integration point). → Mitigation: keep `progress.service.ts` framed so the upsert is one function call — the sibling change wraps it without restructuring.

## Migration Plan

- One additive Prisma migration adding the `UserUnitProgress` table and its enum. No existing data is touched, no FKs are tightened on existing tables.
- Deploy in normal release sequence: schema migration → server release with the new endpoints. Feature has no client surface until `package/app` consumes the hooks; consumers ship later.
- Rollback: drop the table. No other system depends on it (the sibling Meilisearch projection is a separate change shipped after this one).

## Open Questions

- Should `progress >= 1.0` automatically transition `status` to `COMPLETED`? Lean yes, but only as a server-side coercion on write (clients can still be explicit). Decision deferred to implementation; small enough to revisit without spec churn.
- Do we want a `device` / `clientId` field on the row for future multi-device reconciliation? Currently no; can be added additively if needed.
