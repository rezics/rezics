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

**Decision:** Four-value enum, medium-neutral: `BACKLOG`, `ACTIVE`, `COMPLETED`, `DROPPED`.

**Why:** These are the four states the product surface needs across every unit type (books, novels, comics, future games / media). The vocabulary deliberately avoids reading-only verbs:
- `BACKLOG` — the row exists but the user has no meaningful engagement yet (covers both "user added it to their want-list via shelf" and "user briefly tapped through"). This is the safe default when a row is created without an explicit status.
- `ACTIVE` — the user is currently consuming the unit.
- `COMPLETED` — the user marked it finished, or `progress` reached `1.0` and the server coerced the status (see auto-coercion rule below).
- `DROPPED` — the user explicitly abandoned the unit (distinct from "stopped because life happened" — the latter stays `ACTIVE`).

The enum is the bucket axis for the per-unit aggregate that the sibling change `add-progress-search-index` builds. Cross-user aggregates (how many users have a unit in each bucket) are computed by Meilisearch from this column — Shelf is per-user and cannot answer cross-user questions efficiently. We deliberately separate `progress` (number) from `status` (intent) — a user can be at 0.85 and `DROPPED`, or at 0.05 and `ACTIVE`.

**Naming convention:** Status values are `UPPER_SNAKE` (Prisma enum convention). The three corresponding system shelf `kindKey`s are lowercase (`backlog`, `active`, `completed`) — same vocabulary, different casing because they live in different stores with different conventions.

**Alternative considered — derive status from progress + lastSeenAt staleness:** rejected. `DROPPED` is an explicit user signal; deriving it from inactivity would be wrong half the time.

**Alternative considered — book-flavored vocabulary (`VIEWED` / `READING` / ...):** rejected. The catalog is multi-medium by design; reading verbs would force per-medium translation tables in every consumer.

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

### Progress and shelf are orthogonal stores

**Decision:** The backend treats `UserUnitProgress` and `Shelf` / `ShelfItem` as independent stores. A progress upsert never reads or writes a shelf row, and a shelf collect / uncollect never reads or writes a progress row. The frontend issues two separate requests when a user action affects both surfaces (e.g. clicking "I'm reading this" fires `PUT /me/units/:id/progress { status: "ACTIVE" }` *and* a shelf collect to the user's `active` shelf).

**Why:**
- Shelf is per-user (`Shelf.unitId` is owned by a single user). It cannot serve cross-user aggregates — counting "how many users have this unit in `BACKLOG`" via shelves is an O(全站) scan with a dedupe step. The Meilisearch projection in `add-progress-search-index` reads `UserUnitProgress.status` directly. Therefore shelf has no aggregate role; its only role is per-user UI (curated lists, drag-to-reorder, the user-visible "my backlog" tab).
- Drift between the two stores is local to the affected user's UI. It cannot corrupt aggregates, search results, or any downstream stat. Cost of drift = a card temporarily missing from a tab; cost of synchronization = backend cross-store transactions, write-amplification on hot shelf rows, and a coupling between the stats path and the curation path that buys nothing.
- Self-healing: the next user action on the same unit re-fires both requests with the intended state and re-converges the stores without explicit reconciliation logic.

**Auto-coercion exception:** When an upsert sets `progress >= 1.0` and the client did not set a different `status`, the server coerces `status` to `COMPLETED`. This coercion stays inside the progress row — the server still does **not** touch any shelf. The frontend is responsible for any UX prompt ("you finished this — move it to your completed shelf?") and for issuing the corresponding shelf request if the user accepts.

**Alternative considered — backend transactional dual-write:** rejected. It introduces a consistency boundary the system does not need (no aggregate reads shelves), forces every progress write through the shelf write path's locking and indexes, and gives shelf an aggregate role it cannot fulfill efficiently.

### System shelves and the `User.extra.shelves` pointer

**Decision:** Add `extra Json?` to the `User` model. Within `extra`, store a `shelves` map from system-shelf `kindKey` to that user's shelf `unitId`:

```jsonc
user.extra = {
  shelves: {
    favorites: "uuid-...",
    backlog:   "uuid-...",
    active:    "uuid-...",
    completed: "uuid-..."
  }
  // future: onboarding flags, recommender opt-in, device prefs, etc.
}
```

**Why:**
- These pointers are never used as filter predicates — every consumer that needs them already has the `userId` in hand and just needs the unitId of "this user's backlog shelf". Typed columns + `findFirst by kindKey` would either pay an extra query per request or grow the User row by one column per system shelf forever.
- The shape is per-user variable (a future user-tier may add more system shelves) and conventional for this schema — `extra Json?` already exists on `Unit`, `Realm`, `Shelf`, `Post`, `UnitTranslation`, etc. Adding it to `User` aligns with the existing pattern.
- `User` already has `permission Json?` and `settings Json?` — the codebase is comfortable with JSON columns on User. `extra` is the catch-all extension point parallel to the rest of the schema.

**TypeScript safety:** A Typebox schema in `@rezics/contract` describes the `extra` shape (`extra.shelves` is a `Record<string, Uuid>`), and the server reads/writes through a typed accessor. Storage stays JSON-untyped at the Postgres layer.

**Bootstrap:** New users get all four system shelves created at registration time inside the same transaction as `User` creation; the four resulting `unitId`s are written into `User.extra.shelves` in the same transaction. Existing pre-change users have `extra = NULL`; the first request needing a system shelf for them lazy-creates the missing shelf and patches `extra.shelves[kindKey]` (read-modify-write at the service layer is sufficient — the column is per-user with negligible write contention, and `jsonb_set` is available as an optimization later if needed).

**Reserved kindKeys:** `favorites`, `backlog`, `active`, and `completed` are reserved system kindKeys. The shelf service rejects any user-initiated shelf creation that attempts to use one of these keys. This guard lives in the shelf service create path; it is an implementation invariant rather than a separately specified requirement.

**Alternative considered — four typed `*ShelfUnitId` columns on User:** rejected. The values are pointers, not predicates; typed columns burn a migration per future system shelf for no query benefit.

**Alternative considered — keep the runtime `findFirst by kindKey` lookup with no User extension:** rejected. It pays an extra query on every request that needs a system-shelf id, and it scales worse as the number of system shelves grows.

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
- **Frontend dual-write requires both requests to be idempotent.** Progress upsert is idempotent by construction; shelf collect must also be idempotent under repeated calls (the existing `collect` path already de-duplicates via the `(shelfUnitId, itemRef)` PK). → Mitigation: existing behavior covers it; no change required.
- **Lazy-create race on `User.extra.shelves`:** if two concurrent requests for the same pre-existing user both find a missing system shelf, both may try to create it. → Mitigation: the bootstrap path is a `findFirst by kindKey + userId` followed by create; wrap in a small advisory check or accept the rare duplicate (the second create is the loser; cleanup is trivial). Pragmatically rare because real users only hit lazy-create once per system shelf.

## Migration Plan

- One additive Prisma migration:
  - Adds the `UserUnitProgress` table and its enum.
  - Adds `extra Json?` to `User`.
- Existing data is not modified by the migration. Pre-existing users have `User.extra = NULL` after migration; the lazy-create fallback populates `extra.shelves` on first need.
- The new `backlog` / `active` / `completed` shelves are not back-filled in bulk — they are created on demand per user (registration for new users, lazy-create for old). This avoids a one-shot bulk job that would create three rows per existing user up front, the vast majority of which will never be read.
- Deploy in normal release sequence: schema migration → server release with the new endpoints and bootstrap hook. Feature has no client surface until `package/app` consumes the hooks; consumers ship later.
- Rollback: drop the `UserUnitProgress` table; drop the `extra` column from `User` (or leave it — additive and harmless). Lazy-created system shelves remain as ordinary `SHELF` units; they continue to function as user-visible shelves but lose their "system" privileges. No other system depends on this change (the sibling Meilisearch projection ships after).

## Open Questions

- Do we want a `device` / `clientId` field on the row for future multi-device reconciliation? Currently no; can be added additively if needed.
- Visibility default for the three new system shelves — `PRIVATE` matches Favorites today and is the safe default. Whether a user can flip a system shelf to `PUBLIC` (e.g. share their `completed` shelf as a "books I've read" page) is deferred to a later product decision; the schema supports either.
