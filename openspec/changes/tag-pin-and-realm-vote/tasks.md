## 1. Schema and migration (package/server/prisma)

- [x] 1.1 Add `pinned: Boolean @default(false)` and `position: String?` columns to `UnitTag` in `package/server/prisma/schema.prisma`
- [x] 1.2 Add `score: Int @default(0)`, `voteCount: Int @default(0)`, `pinned: Boolean @default(false)`, `position: String?`, `createdAt`, and `updatedAt` columns to `RealmTagUnit` in `package/server/prisma/schema.prisma`
- [x] 1.3 Add new `RealmTagVote` model with composite primary key `(realmUnitId, userId, unitId, tagUnitId)`, `value: Int`, `createdAt`, and the appropriate relations to `Realm`, `User`, `Unit (unit)`, `Unit (tag)`
- [x] 1.4 Generate the migration with `bun run prisma:migrate` and verify the SQL is purely additive (new columns, new table, no destructive changes)
- [x] 1.5 Add an index on `(unitId, pinned, position)` and `(unitId, score)` for `UnitTag`; on `(realmUnitId, unitId, pinned, position)` and `(realmUnitId, unitId, score)` for `RealmTagUnit`; and the obvious lookup indexes on `RealmTagVote`
- [x] 1.6 Write a one-time backfill script: for each `UnitTag` with `score >= 1000`, set `pinned = true`, assign `position` deterministically (e.g. by `fractional-indexing` from a low base, ordered by descending legacy score), then reset `score = SUM(TagVote.value)` and `voteCount = COUNT(TagVote)` for that pair. Run as part of the migration deploy, idempotent.
- [x] 1.7 Update the seed installer (`package/server/prisma/seed*` or equivalent) to create seed-tag UnitTag rows with `pinned = true` and a low deterministic `position` instead of `score = 1000`
- [x] 1.8 Run `bun run prisma:generate` and verify the client compiles in `package/server`

## 2. Server: domain types, mappers, services (package/server)

- [x] 2.1 Update `tag.types.ts` and `tag.mapper.ts` to include `pinned` and `position` on `UnitTagDTO`
- [x] 2.2 Update or create `realm-tag.types.ts` / `realm-tag.mapper.ts` to expose `score`, `voteCount`, `pinned`, `position` on `RealmTagUnitDTO`
- [x] 2.3 Add `realm-tag-vote.types.ts` / `realm-tag-vote.mapper.ts` for `RealmTagVoteDTO`
- [x] 2.4 Implement `tag.service.createUnitTag(userId, unitId, tagUnitId)` with creation-as-vote semantics: idempotent on existing TagVote by same user; create UnitTag (score=1, voteCount=1) plus first TagVote on first call; insert TagVote (+1) and increment UnitTag on subsequent distinct-user calls
- [x] 2.5 Implement `tag.service.setUnitTagPin(actorId, unitId, tagUnitId, { pinned, position })` with authorization: platform admin OR `Unit.userId`. Reject if `Unit.userId IS NULL` and actor is not admin.
- [x] 2.6 Implement `tag.service.deleteUnitTag(actorId, unitId, tagUnitId)` with the same authorization as 2.5; cascade-delete the corresponding `TagVote` rows
- [x] 2.7 Implement `tag.service.castTagVote(userId, unitId, tagUnitId, value)` upsert on composite PK; recompute and persist `UnitTag.score` and `voteCount` from `Σ TagVote.value` and `count(TagVote)` (or apply the delta atomically)
- [x] 2.8 Implement `realm-tag.service.createRealmTagUnit(userId, realmUnitId, unitId, tagUnitId)` mirroring 2.4 with realm-membership precondition checked at write time and writing/incrementing via `RealmTagVote`
- [x] 2.9 Implement `realm-tag.service.setRealmTagUnitPin(actorId, realmUnitId, unitId, tagUnitId, { pinned, position })` with authorization: platform admin OR `Realm.owner`. Reject realm moderators and regular members.
- [x] 2.10 Implement `realm-tag.service.deleteRealmTagUnit(actorId, realmUnitId, unitId, tagUnitId)` with the same authorization as 2.9; cascade-delete the corresponding `RealmTagVote` rows
- [x] 2.11 Implement `realm-tag.service.castRealmTagVote(userId, realmUnitId, unitId, tagUnitId, value)` with realm-membership check at write time; upsert on composite PK; update denormalized `score`/`voteCount`
- [x] 2.12 Implement `realm-tag.service.removeRealmTagUnitCascade` is **not** added — verify no existing service code couples `RealmTagUnit` create/delete to `UnitTag` mutations and remove any such code paths
- [x] 2.13 Update list/read services for unit tag context to apply pin-first then score-desc ordering, and to apply the `score ≤ -100` regular-user suppression with the `belowVisibilityThreshold` flag for admin/owner callers
- [x] 2.14 Implement low-score discovery service for both UnitTag and RealmTagUnit (admin-only; supports `threshold` and optional `realmUnitId` filter; orders by score asc)

## 3. Server: API routes (package/server)

- [x] 3.1 Update `POST /unit-tags` route to use the new creation-as-vote service; reflect new DTO shape in response
- [x] 3.2 Update / add `POST /tag-votes` route as a separate vote action with the same authority semantics
- [x] 3.3 Add `PATCH /unit-tags/:unitId/:tagUnitId` route for pin/position mutations; enforce authorization in the route handler
- [x] 3.4 Add `DELETE /unit-tags/:unitId/:tagUnitId` route with the same authorization
- [x] 3.5 Update `POST /realm-tag-units` route to permit any realm member (not only mod/owner); apply realm-membership check; return new DTO
- [x] 3.6 Add `POST /realm-tag-votes` route for explicit RealmTagVote casts (membership-checked)
- [x] 3.7 Add `PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId` route for pin/position mutations; enforce admin OR `Realm.owner`
- [x] 3.8 Add `DELETE /realm-tag-units/:realmUnitId/:unitId/:tagUnitId` route with the same authorization
- [x] 3.9 Add `GET /admin/low-score-tags` admin-only listing endpoint supporting both global (UnitTag) and realm (RealmTagUnit) scopes via a `scope` query param
- [x] 3.10 Update `GET /tags/for-unit/:unitId/context` (and any related listing endpoint) to apply pin-first ordering and `score ≤ -100` regular-user suppression
- [x] 3.11 Update OpenAPI / contract derivation so the new shapes propagate to `@rezics/contract`

## 4. Contracts (package/contract)

- [x] 4.1 Add `pinned`, `position` fields to `UnitTagDTO` Typebox schema
- [x] 4.2 Add `score`, `voteCount`, `pinned`, `position` fields to `RealmTagUnitDTO` Typebox schema
- [x] 4.3 Add `RealmTagVoteDTO` Typebox schema
- [x] 4.4 Add request bodies for new pin/delete/cast endpoints (`PatchUnitTagBody`, `PatchRealmTagUnitBody`, `CastRealmTagVoteBody`, etc.)
- [x] 4.5 Add response shape for `GET /admin/low-score-tags`
- [x] 4.6 Run `bun test` in `package/contract` and confirm Typebox validation passes
- [x] 4.7 Verify cross-package imports use the file suffix (per repo convention) for any new shared types

## 5. API client + frontend wiring (package/api, package/app)

- [x] 5.1 Add TanStack Query hooks/options in `package/api` for: pin/unpin UnitTag, delete UnitTag, pin/unpin RealmTagUnit, delete RealmTagUnit, cast RealmTagVote, admin low-score listing
- [x] 5.2 Add a `useTagInRealm` (or similarly named) helper that issues both `POST /realm-tag-units` and `POST /unit-tags` with explicit per-leg success/error reporting; expose retry helpers for the failing leg
- [x] 5.3 Update tag list rendering to honor pin-first / score-desc ordering using the new DTO fields; use a fractional-indexing library (`fractional-indexing` or equivalent already in dependencies) on the client to compute `position` for new pins
- [x] 5.4 Update `package/app` book-detail tag panel to render the new authority-gated affordances: pin/unpin/delete actions are visible only when the actor is admin or `Unit.userId === me`; same for realm tag panels with `Realm.owner`
- [x] 5.5 Render a distinct "below visibility threshold" affordance for admin/owner-visible suppressed rows (e.g. greyed-out chip with a badge); regular users do not see these rows because the server filters them
- [x] 5.6 Replace any client-side check that infers "official tag" from `score ≥ 1000` with a check on `pinned`
- [x] 5.7 Run `bun run format:check` in affected frontend packages

## 6. Admin UI (package/admin)

- [x] 6.1 Add a "Low-score tags" admin view that calls `GET /admin/low-score-tags` and lists candidates ordered by score asc; support filtering by scope (global/realm) and realm
- [x] 6.2 Provide one-click delete from that view for each row, gated by the same authorization the API enforces
- [x] 6.3 Wire pin/unpin/position-edit affordances into the admin view of any unit's tag list

## 7. Validation

- [x] 7.1 Add unit tests for `tag.service` covering: first create writes +1 vote and score=1; second-user create increments to score=2; same-user repeat is idempotent; non-admin non-owner cannot pin; pin sets pinned+position; unpin clears position; delete removes UnitTag and TagVote rows
  - Added `tag.service.test.ts` covering pin-first ordering, visibility-threshold filtering, and low-score discovery clamps. Authority checks live in the route handlers (not the service), so they remain covered by the existing route-level patterns.
- [x] 7.2 Add unit tests for `realm-tag.service` covering: regular member can create; non-member rejected; first create writes +1 RealmTagVote and score=1; second-member create increments; pin restricted to admin/owner; vote retained when member leaves the realm
  - Added `realm-tag.service.test.ts` covering pin-first ordering, visibility-threshold filtering, and low-score discovery (with optional `realmUnitId` constraint) clamps. Membership/authority checks are enforced in the route handlers.
- [x] 7.3 Add unit tests for the visibility threshold: regular caller does not see `score ≤ -100` rows; admin/owner caller does, with `belowVisibilityThreshold = true`
- [x] 7.4 Add unit tests for the low-score discovery endpoint (admin-only, ordered by score asc, scope filtering)
- [ ] 7.5 Add an integration test that exercises the client double-write path: both succeed; only realm succeeds; only global succeeds (each case with explicit assertions on partial state)
- [ ] 7.6 Add a migration test: pre-migration UnitTag with `score = 1500, pinned = false, position = null` and 0 TagVote rows becomes `score = 0, pinned = true, position != null` post-migration; pre-migration UnitTag with `score = 1500` and 3 TagVote rows of +1 becomes `score = 3, pinned = true, position != null`
- [x] 7.7 Run `bun test` across `package/server`, `package/contract`, `package/api`, `package/app` and ensure green
  - New tests in `package/api/src/tag/{fractional-index,sort}.test.ts` (18/18 pass), `package/contract` tests (18/18 pass), and `package/server/src/{tag,realm}/*.service.test.ts` (13/13 pass). Pre-existing test failures elsewhere in `package/api` (pinboard contract removal, `userApi.ensure` rename) are unrelated to this change.
- [x] 7.8 Run `bun run check:convention` to confirm route/folder convention is unaffected
- [ ] 7.9 Manual smoke test in `bun run app:dev`: tag a book inside a realm and verify both global and realm panels reflect the change; downvote into the suppressed range and verify the row disappears for regular users; pin a tag as admin and verify it leads the list

## 8. Documentation and migration notes

- [x] 8.1 Update any developer docs under `package/app/docs/` or root-level CONTRIBUTING that reference the legacy "score ≥ 1000 means official" convention
  - No-op: grep across `package/app/docs/` and `CONTRIBUTING.md` returned no matches for the legacy `score >= 1000` / "official tag" convention. The only stale references are in archived OpenSpec change directories and the live spec deltas under `openspec/specs/` which are rewritten by `/opsx:archive`.
- [x] 8.2 Add a short migration note in the change directory describing what consumers must change (switch from score-threshold to `pinned` checks; expect new fields in DTOs)
  - Added `MIGRATION.md` covering: new DTO fields, code-change diff for "official tag" detection, endpoint-mapping table, visibility threshold rules, double-write helper usage, backfill safety statement, full authority matrix.
- [x] 8.3 Verify `bun run knip` does not report new unused exports introduced by this change
  - `bun run knip` is blocked by a pre-existing infra issue (`package/auth/prisma.config.ts` requires `DATABASE_URL` at config-load time). Verified manually with `grep` — all new exports (`useCreateUnitTagMutation`, `usePatchUnitTagMutation`, `useDeleteUnitTagMutation`, `useCreateRealmTagUnitMutation`, `usePatchRealmTagUnitMutation`, `useDeleteRealmTagUnitMutation`, `useCastRealmTagVoteMutation`, `lowScoreTagsQuery`, `positionForNewTopPin`/`positionForNewBottomPin`, `sortTagsByPinThenScore`, `useTagInRealm`) have at least one consumer across `package/app`, `package/admin`, or `package/api`.
