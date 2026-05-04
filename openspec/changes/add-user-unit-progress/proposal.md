## Why

Users' historical interactions with units (books, novels, comics, etc.) are currently encoded only as `Shelf` membership — which is fine for "viewed/favorite" classification but cannot answer questions like "how far through this unit did the user get" or "how much time have they spent on it". As the catalog grows toward tens of millions of units (web novels especially), product needs durable per-user-per-unit progress data: continue-reading lists, "n% complete", and the raw fact source that downstream stats and the search index can later project from.

This change introduces only the fact source. Aggregate/discovery use cases (counting viewers per unit, distribution of how-far-through users got) are addressed by a sibling change that projects this data into Meilisearch.

## What Changes

- Add a new `UserUnitProgress` Prisma model in `package/server/prisma/schema.prisma`. Composite PK `(userId, unitId)` — at most one progress row per user per unit.
- Fields: `progress` (Float, 0..1), `status` (enum: `VIEWED` | `READING` | `COMPLETED` | `DROPPED`), `totalTimeMs` (BigInt, cumulative time spent), `lastPosition` (String, nullable — opaque pointer such as chapter id / scroll offset), `firstSeenAt`, `lastSeenAt`, `extra` (Json, nullable).
- Indexes: `(userId, lastSeenAt DESC)` for "continue reading" and recent-activity feeds; `(unitId, status)` for per-unit retrieval scoped to a status (rare, but cheap insurance).
- New backend domain `package/server/src/progress/` following the project's `*.api.ts` / `*.service.ts` / `*.mapper.ts` / `*.types.ts` pattern.
- New shared contract types in `@rezics/contract` and TanStack Query hooks in `@rezics/api`.
- User-facing endpoints (under the existing auth-gated mount):
  - `PUT /me/units/:unitId/progress` — upsert current progress.
  - `GET /me/units/:unitId/progress` — fetch the caller's progress for one unit.
  - `GET /me/progress` — paginated list of the caller's progress rows, ordered by `lastSeenAt DESC` (continue-reading source).
  - `DELETE /me/units/:unitId/progress` — clear the caller's progress.
- No aggregate, summary, search-index, or CDC work in this change. The model is the canonical fact source; downstream projections live in separate changes.

## Capabilities

### New Capabilities
- `user-unit-progress`: per-user-per-unit progress fact source — schema, write semantics, retrieval API, and ordering guarantees.

### Modified Capabilities
(none — no existing spec changes its requirements.)

## Impact

- Affected packages:
  - `package/server` — Prisma schema migration; new `progress/` domain module mounted in `src/index.ts`.
  - `package/contract` — new Typebox schemas for progress upsert / query.
  - `package/api` — new TanStack Query hooks for the four endpoints above.
- Database: one new table, no FKs added beyond `userId` / `unitId` references already present in the schema's other relations.
- Backward compatibility: purely additive; no existing API surface, schema, or behavior changes. Existing `Shelf`-based "viewed" semantics are unaffected and continue to work in parallel — `Shelf` answers "is this on the user's list", `UserUnitProgress` answers "how far through it are they".
- No factory/seed work required for this change; a follow-up factory generator can be added once aggregates and search projection land.
