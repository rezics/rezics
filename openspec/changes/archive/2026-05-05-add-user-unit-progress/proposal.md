## Why

Users' historical interactions with units (books, novels, comics, etc.) are currently encoded only as `Shelf` membership — which is fine for "viewed/favorite" classification but cannot answer questions like "how far through this unit did the user get" or "how much time have they spent on it". As the catalog grows toward tens of millions of units (web novels especially), product needs durable per-user-per-unit progress data: continue-reading lists, "n% complete", and the raw fact source that downstream stats and the search index can later project from.

This change introduces only the fact source. Aggregate/discovery use cases (counting viewers per unit, distribution of how-far-through users got) are addressed by a sibling change that projects this data into Meilisearch.

## What Changes

- Add a new `UserUnitProgress` Prisma model in `package/server/prisma/schema.prisma`. Composite PK `(userId, unitId)` — at most one progress row per user per unit.
- Fields: `progress` (Float, 0..1), `status` (enum: `BACKLOG` | `ACTIVE` | `COMPLETED` | `DROPPED`), `totalTimeMs` (BigInt, cumulative time spent), `lastPosition` (String, nullable — opaque pointer such as chapter id / scroll offset), `firstSeenAt`, `lastSeenAt`, `extra` (Json, nullable).
- Indexes: `(userId, lastSeenAt DESC)` for "continue reading" and recent-activity feeds; `(unitId, status)` for per-unit retrieval scoped to a status (rare, but cheap insurance).
- New backend domain `package/server/src/progress/` following the project's `*.api.ts` / `*.service.ts` / `*.mapper.ts` / `*.types.ts` pattern.
- New shared contract types in `@rezics/contract` and TanStack Query hooks in `@rezics/api`.
- User-facing endpoints (under the existing auth-gated mount):
  - `PUT /me/units/:unitId/progress` — upsert current progress.
  - `GET /me/units/:unitId/progress` — fetch the caller's progress for one unit.
  - `GET /me/progress` — paginated list of the caller's progress rows, ordered by `lastSeenAt DESC` (continue-reading source).
  - `DELETE /me/units/:unitId/progress` — clear the caller's progress.
- Add `extra Json?` to the `User` model (parallel to the existing `extra Json?` on `Unit`, `Realm`, `Shelf`, etc.). Within `extra`, store a `shelves` map from system-shelf `kindKey` to that user's shelf `unitId` — e.g. `{ shelves: { favorites: <uuid>, backlog: <uuid>, active: <uuid>, completed: <uuid> } }`. This is per-user, never used as a filter predicate, and is the natural extension point for future per-user system pointers.
- Bootstrap three new system shelves alongside the existing `favorites` shelf: `backlog`, `active`, `completed` (lowercase `kindKey`s, no `dropped`). Reserve these three keys as system kindKeys — user-created shelves cannot use them. Each user gets one shelf per kindKey, populated on registration; lazy-create as a fallback for pre-existing users on first need, with the resulting `unitId` patched into `User.extra.shelves`.
- Aggregate, summary, search-index, and CDC work remain out of scope. The model is the canonical fact source; downstream projections live in the sibling change `add-progress-search-index`. Cross-user aggregates (how many users have a unit in `BACKLOG`, completion rate, distribution) are answered exclusively by the Meilisearch projection of `UserUnitProgress`, not by Shelf — Shelf is per-user and has no aggregate role.
- Progress writes and shelf writes are orthogonal: the backend never mutates a Shelf row in response to a progress upsert and never mutates a `UserUnitProgress` row in response to a shelf collect/uncollect. The frontend issues two independent requests when a user action affects both surfaces; transient drift between them is acceptable and self-heals on the next write.

## Capabilities

### New Capabilities
- `user-unit-progress`: per-user-per-unit progress fact source — schema, write semantics, retrieval API, ordering guarantees, system-shelf bootstrap, and the orthogonality contract between progress and shelf writes.

### Modified Capabilities
(none — additive `User.extra` column and additional reserved shelf kindKeys do not change requirements of existing capabilities.)

## Impact

- Affected packages:
  - `package/server` — Prisma schema migration (new `UserUnitProgress` table + `extra Json?` on `User`); new `progress/` domain module mounted in `src/index.ts`; shelf service gains reserved-kindKey guard and three additional system-shelf bootstrap paths.
  - `package/contract` — new Typebox schemas for progress upsert / query.
  - `package/api` — new TanStack Query hooks for the four endpoints above.
- Database: one new table, one additive column on `User`. No FKs added beyond `userId` / `unitId` references already present in the schema's other relations. `User.extra.shelves` carries `unitId` references by convention (no FK; lazy-create fallback handles missing entries).
- Backward compatibility: purely additive; no existing API surface, schema, or behavior changes. Existing `Shelf`-based "Favorites" semantics are unaffected. The three new system kindKeys (`backlog`, `active`, `completed`) are introduced alongside the existing `favorites` kindKey without conflict.
- No factory/seed work required for this change; a follow-up factory generator can be added once aggregates and search projection land.
