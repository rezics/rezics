---
title: Progress Post Links
status: done
created: 2026-06-14
completed: 2026-06-14
supersededBy:
tags: [progress, post, shelf, contract, schema, app, search]
---

## Why

Progress should be the product surface for a user's relationship with a Unit:
current status, reading position, completion count, time spent, and the notes or
posts written in that progress context. System shelf mirroring makes those
states look like curated collections, but the best UX is a progress library with
status/search/tag filters, not hidden writes into shelves.

Cut progress post attachment out of `extra.reasonPostUnitIds` and into a normal
relational link. A linked post belongs to one `UserUnitProgress` row and records
the original `UserUnitProgressStatus` at the time it was attached. That status
is the role; do not create a second role taxonomy.

## Durable constraints & decisions

- (type) `UserUnitProgress` has a first-class `id` primary key. `(userId,
  unitId)` remains unique because upsert and "my progress for this Unit" are
  natural-key operations, but other tables link by `progressId`.
- (type) `UserUnitProgressPost` links one progress row to one post Unit and
  stores `status: UserUnitProgressStatus`. The status value is copied verbatim
  from the progress status enum; do not add values such as `PAUSE_REASON`,
  `DROP_REASON`, `REVIEW`, or `NOTE`.
- (test) `UserUnitProgressPost.status` is a snapshot of the progress status at
  link time. Later status transitions do not rewrite existing link rows.
- (test) A post can be linked at most once to the same progress row. Reassigning
  it to another status for that progress row updates the link's `status`
  instead of creating a duplicate.
- (test) Only the owner of the progress row can add, update, or remove progress
  post links. First implementation should also require the linked post to be
  authored by that user; linking someone else's post is a later product choice.
- (type) `ProgressExtra` no longer carries `reasonPostUnitIds`; progress post
  links are returned through explicit DTO fields or endpoints, not JSON.
- (comment) Progress post links are progress context, not shelf context.
  ShelfItem review children remain for curated collection explanations only.
- (test) Progress status writes do not mirror to system shelves. Backlog,
  active, completed, paused, and dropped are progress library filters, not
  automatically maintained ShelfItem rows.
- (test) Progress library rows remain sourceable from progress alone. A row does
  not require membership in any shelf to appear in the user's progress library.
- (type) Search progress documents remain a progress index, not a shelf item
  index. They may include the new progress id for identity, while status/tag/unit
  filtering stays progress-owned.

## Tasks

## 1. Schema And Relations

- [x] 1.1 Update `package/server/src/db/schema/progress.ts` so
  `UserUnitProgress.id` is the primary key and `(userId, unitId)` is a unique
  natural key used by upsert.
- [x] 1.2 Add `UserUnitProgressPost` in the progress schema with
  `progressId`, `postUnitId`, `status`, and timestamps; use the existing
  `UserUnitProgressStatus` enum for `status`.
- [x] 1.3 Add indexes for owner/status reads through `UserUnitProgress` and for
  post reverse lookups where progress detail or post detail needs them.
- [x] 1.4 Update `package/server/src/db/relations/content-relations.ts`,
  `unit-relations.ts`, and any generated/manual relation maps so progress rows,
  linked posts, Units, and Users hydrate through normal relations.
- [x] 1.5 Update schema row type exports in `package/server/src/db/schema/index.ts`.
- [x] 1.6 Generate the Drizzle migration from the schema changes; this is a
  development cutover, so no compatibility columns or backfill shims are needed.

## 2. Contract And API Shape

- [x] 2.1 Remove `reasonPostUnitIds` from
  `package/contract/src/shelf/progress.ts` `ProgressExtra` and the matching
  JSON-column schema.
- [x] 2.2 Add contract DTOs for progress-linked posts: link row shape, grouped
  status buckets, and request bodies for add/update/remove link operations.
- [x] 2.3 Extend `UnitProgressRowDTO` or the progress detail response with the
  linked post summaries needed by the reason modal; keep list responses bounded.
- [x] 2.4 Add progress API routes in `package/server/src/progress/progress.api.ts`
  for linking, relabeling by status, listing, and unlinking posts for
  `/me/units/:unitId/progress`.
- [x] 2.5 Mirror the new routes in `package/api/src/progress/progress.api.ts`,
  query keys, queries, and mutations.

## 3. Progress Service Behavior

- [x] 3.1 Update `ProgressRepository` and the Drizzle repository in
  `package/server/src/progress/progress.service.ts` to return progress ids and
  to upsert by `(userId, unitId)`.
- [x] 3.2 Implement progress post link create/update/delete methods with owner
  checks and same-author post checks.
- [x] 3.3 Ensure link creation records the current or requested
  `UserUnitProgressStatus` as a snapshot and does not update that status on
  later progress transitions.
- [x] 3.4 Remove `extra` validation paths that only exist to carry reason post
  ids; keep unrelated `extra` behavior only if it still has a durable use.
- [x] 3.5 Update `progress.mapper.ts` so DTOs no longer sanitize JSON post ids
  and instead expose explicit linked-post data.
- [x] 3.6 Update service tests for progress id identity, natural-key upsert,
  status snapshot links, owner/authorship enforcement, and deletion behavior.

## 4. Remove Shelf Mirroring

- [x] 4.1 Delete progress-status system shelf planning from
  `package/app/src/progress-status/models/transition.ts` and its tests.
- [x] 4.2 Simplify `useStatusTransition` so progress status writes call only the
  progress API and no longer resolve system shelves or run ShelfItem mutations.
- [x] 4.3 Remove progress-status dependencies on `useSystemShelfIdResolver`,
  system shelf recovery, and shelf mutation hooks where they only exist for
  progress mirroring.
- [x] 4.4 Keep ordinary shelf actions separate: users can still manually add a
  Unit to a shelf through shelf UI, but progress transitions do not do that.
- [x] 4.5 Update cache invalidation so progress writes refresh progress surfaces
  without invalidating shelf surfaces unless an explicit shelf action happened.

## 5. App Progress Post UX

- [x] 5.1 Replace `package/app/src/progress-status/models/extra.ts` with helpers
  that group linked posts by `UserUnitProgressStatus`.
- [x] 5.2 Update `ReasonModal` and `useReasonPostHistory` to read linked posts
  from progress link DTOs or progress link queries instead of post ids stored in
  `ProgressExtra`.
- [x] 5.3 Update `BookProgressStatusSection` so saving or appending a reason
  creates/updates the post and then creates/updates a `UserUnitProgressPost`
  link with the selected status.
- [x] 5.4 Preserve the current UX distinction between skip, edit latest, and
  append, but make the data source relational links rather than JSON extra.
- [x] 5.5 Update progress library/detail UI copy only as needed to reflect that
  backlog/active/completed are progress filters, not shelves.
- [x] 5.6 Run the required i18n validation if any user-facing copy changes.

## 6. Search And Reporting Surfaces

- [x] 6.1 Update `package/search/src/progress.ts` and sync code to carry
  `UserUnitProgress.id` where useful while preserving unit/status/progress
  filters.
- [x] 6.2 Update progress backfill/sync cursor logic for the new primary key or
  keep the `(userId, unitId)` cursor deliberately if it remains the better
  stable ordering.
- [x] 6.3 Ensure progress stats continue to aggregate by `unitId` and status,
  not by shelf membership.
- [x] 6.4 Update tests around progress search document ids and backfill rows.

## 7. Cleanup And Validation

- [x] 7.1 Remove obsolete `ProgressExtra` reason helpers, tests, and imports
  across `package/app`, `package/server`, `package/api`, and `package/contract`.
- [x] 7.2 Remove dead progress system-shelf recovery usage, but keep system
  shelves for non-progress product surfaces if still used.
- [x] 7.3 Update focused contract, server, API, app model, and search tests for
  the cutover.
- [x] 7.4 Run focused package tests first, then the relevant repo checks
  (`task contract:test`, `task server:test`, `task api:test`,
  `task app:test`, `task search:test` if available, plus `task check:i18n`
  when copy changes).

## Out of scope

- Building a full progress event timeline. The link status snapshot gives
  status-grouped history without introducing a separate event model.
- Linking other users' posts to a user's progress row.
- Replacing ordinary curated shelves or ShelfItem review children.
- Designing public progress/privacy policy beyond post-level visibility and
  existing authenticated `/me` progress ownership.
- Hand-authoring ordinary Drizzle migrations.
