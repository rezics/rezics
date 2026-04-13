## Context

The server currently has a `Rating` model keyed by `(unitId, domain)` storing `totalScore` and `totalCount`. The `domain` column is always set to `unitId` itself — effectively unused. Individual ratings are a single number in `unit.metadata.rating`, tightly coupled to reviews. There is no realm scoping, no rating distribution, and no field-level scoring.

The tag voting system (`UnitTag`/`TagVote`) is a separate system and remains unchanged.

## Goals / Non-Goals

**Goals:**

- Realm-based scoring: scores scoped by `(unitId, realm)` where realm is a Realm entity
- High-performance reads: pre-aggregated totals in columns, no JSON parsing on the hot path (list views)
- Extensible fields: realm-specific sub-dimensions stored in JSON, with distribution, managed by admins
- Distribution tracking: 1-10 histogram at both the overall and per-field level
- Score-review decoupling: ScoreEntry is independent; reviews/remarks FK to it
- Standardized range: all scores are integers 1-10
- Modular design: self-contained `score` domain module with unidirectional dependency (`review → score`)

**Non-Goals:**

- Weighted or algorithmic scoring (simple sum/count aggregates only)
- Tag voting system changes (remains as-is)
- Frontend UI implementation (this change covers server, contract, and API client)
- Real-time leaderboards or ranking
- Per-realm score range configuration (range is globally fixed at 1-10)

## Decisions

### 1. Split-layer aggregate: columns + JSON on the same row

`ScoreAggregate` stores `totalScore` and `totalCount` as first-class integer columns (hot path), while `distribution` and `fields` are JSON columns parsed only when detail is requested.

- **Why**: List views read `totalScore/totalCount` without JSON overhead. Detail pages parse JSON from the same row — no extra I/O.
- **Alternative considered**: Fixed columns (`dist1`...`dist10`) — rejected for schema noise (10 extra columns) and the hot path would always read them. A separate `ScoreDistribution` table was also considered — rejected because 10 rows per aggregate adds JOINs for a fixed-structure histogram.

### 2. JSON distribution over fixed columns

Distribution is a JSON object `{ "1": 5, "2": 12, ..., "10": 40 }` stored in a single column. Field-level aggregates follow the same pattern: `{ "pacing": { "total": 450, "count": 100, "dist": { "1": 5, ..., "10": 40 } } }`.

- **Why**: The histogram is always 10 buckets (fixed range 1-10). It's always read as a unit (never a single bucket). JSON keeps the schema concise and the data co-located.
- **Alternative considered**: Fixed columns — simpler atomic increments but pollutes every query with 10 unused columns on the hot path.

### 3. ScoreEntry with UUID PK + unique constraint

ScoreEntry uses a `uuidv7` primary key plus a `@@unique([userId, unitId, realm])` constraint.

- **Why**: The UUID PK enables a simple single-column FK from `Unit.scoreEntryId`. The unique constraint enforces one score per user per unit per realm.
- **Alternative considered**: Composite PK `(userId, unitId, realm)` — would require a 3-column FK from Unit, which is verbose and fragile.

### 4. `onDelete: Restrict` on Unit.scoreEntryId

The FK from reviews/remarks to ScoreEntry uses `Restrict`, not `Cascade`.

- **Why**: Users must manually delete linked reviews before deleting a score — this prevents accidental loss of review content. Admins bypass by deleting linked reviews in the same transaction before deleting the score.
- **Alternative considered**: `Cascade` — simpler but violates the requirement that reviews are intentionally deleted.

### 5. Default realm entity, not NULL

Scores for the common case (no specific realm) use the default realm's `unitId`. The `realm` column is never NULL.

- **Why**: NULL in a composite index `(unitId, realm)` breaks uniqueness semantics in PostgreSQL. Using a concrete entity keeps queries uniform — always `WHERE unitId = ? AND realm = ?`.
- **Alternative considered**: Empty string sentinel — semantically unclear, not a valid UUID.

### 6. ScoreRealmField as a dedicated table

Admin-managed field definitions stored in a `ScoreRealmField` table keyed by `(realm, key)`.

- **Why**: Acts as the authoritative validation source on score submission. Queryable and sortable. Tiny table (few realms x few fields). Admin CRUD API maps directly to table operations.
- **Alternative considered**: Store field definitions in `Realm.extra` JSON — harder to query, no sort order, validation requires JSON parsing. Querying `ScoreAggregate.fields` was also considered — fails the bootstrap problem (no fields discoverable before first score) and requires a full scan.

## Data Flow

```
Write path (score upsert):
  1. Validate value + fields against 1-10 range and ScoreRealmField registry
  2. Upsert ScoreEntry (create or update)
  3. Read existing ScoreAggregate
  4. Compute deltas for totalScore, totalCount, distribution, field aggregates
  5. Upsert ScoreAggregate with deltas — single transaction

Read hot path (list view):
  SELECT totalScore, totalCount FROM ScoreAggregate WHERE unitId = ? AND realm = ?
  → PK lookup, no JSON parsing

Read detail path (histogram + field breakdown):
  SELECT * FROM ScoreAggregate WHERE unitId = ? AND realm = ?
  → Same row, parse distribution + fields JSON
```

## Module Structure

```
package/server/src/score/
  score.api.ts        — Elysia routes under /score
  score.service.ts    — ScoreEntry + ScoreAggregate + delta logic
  score.mapper.ts     — DTO transformations, validation helpers
  score.types.ts      — Prisma includes, domain types, constants (SCORE_MIN/MAX)
```

Dependency: `review.service → score.service` (one-way). The score module has no knowledge of reviews or posts.

## Endpoint Layout

```
POST   /score                          — Upsert score (create/update ScoreEntry + delta)
DELETE /score/:id                      — Delete score (review check / admin bypass)
GET    /score/unit/:unitId             — All realm aggregates for a unit
GET    /score/unit/:unitId/:realm      — Single realm aggregate
GET    /score/user/:userId/:unitId     — User's score entries for a unit

GET    /score/realm/:realmId           — List realm fields
POST   /score/realm/:realmId           — Add field (admin)
DELETE /score/realm/:realmId/:key      — Remove field (admin)
```

## Risks / Trade-offs

- **[Delta drift]** Aggregate counters can diverge from source entries due to bugs or partial transaction failures. → Mitigation: admin-only recalculation endpoint that recomputes ScoreAggregate from all ScoreEntry records for a given `(unitId, realm)`.
- **[Migration complexity]** Existing `Rating` data and `metadata.rating` on reviews must be migrated. → Mitigation: single-transaction migration script that creates ScoreEntry + ScoreAggregate from existing data, then drops the Rating table.
- **[Review API breaking change]** Rating field moves from review metadata to a separate ScoreEntry reference. → Mitigation: frontend and contract updated in the same release. Review creation endpoint changes to accept `scoreEntryId`.
- **[JSON field update concurrency]** Read-modify-write on JSON columns within a transaction. → Mitigation: Prisma transactions with serializable isolation already used in the codebase. The aggregate row is locked by the transaction.

## Open Questions

- Should the admin recalculation endpoint cover all aggregates at once, or only per `(unitId, realm)` pair?
