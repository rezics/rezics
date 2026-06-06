---
title: Share and Reference Counts
status: done
created: 2026-06-04
completed: 2026-06-06
supersededBy:
tags: [engagement, reaction, post, unit, share]
---

## Why

Rezics needs share metrics without introducing a standalone repost product model.
Sharing inside Rezics remains a post creation entrypoint: direct share creates a
post with empty main content plus a structured `unit-ref`, while quote/share with
comment opens the normal post editor preloaded with the referenced content.

The platform should expose two different counters. `shareCount` records
authenticated share intent and is owned by the reaction service. `referenceCount`
records durable post content relationships derived from structured ContentDoc
`unit-ref` blocks and is owned by the main server. These counters must be
materialized like existing `replyCount`, `usageCount`, `itemCount`, and
`subscriberCount`; hot read paths should not run count queries to render cards or
lists.

## Durable constraints & decisions

- (type) `shareCount` is an authenticated intent counter for any target Unit.
  The reaction service owns its storage and summary API, but it must not reuse
  the existing `Reaction` row shape because share intent is not a reversible
  reaction and must not consume reaction quota.
- (test) A user contributes at most one share per target Unit. Repeated share
  clicks by the same user are idempotent and do not increment `shareCount`.
- (test) Anonymous users do not contribute to `shareCount`.
- (test) `shareCount` has no target-type special cases. If a Unit can be reached
  by the UI and the authenticated user clicks share, the backend records the
  share intent without branching by Unit type.
- (comment) `shareCount` is monotonic per `(userId, targetId)`: external share
  failure, copy-link behavior, or failure to create an internal post does not
  decrement it.
- (type) `referenceCount` is server-owned and derived only from structured
  ContentDoc `unit-ref` blocks inside Units of type `POST`.
- (test) Each source post contributes at most one reference per target Unit,
  even if the same target appears in multiple languages or multiple `unit-ref`
  blocks.
- (test) All structured `unit-ref` blocks count as references. Markdown links do
  not count.
- (test) Realm membership, realm moderation, and realm submission state do not
  affect `referenceCount`. A source post contributes references as long as the
  source post is not globally deleted.
- (test) Updating post content increments references added by the new ContentDoc
  and decrements references removed from the previous ContentDoc.
- (test) Globally deleting a source post removes its reference rows and
  decrements the referenced targets' `referenceCount`.
- (comment) The post reference sync path should mirror the existing
  `PostPollReference` / `Poll.usageCount` pattern: extract old and new
  structured IDs, diff sets, write relation rows, and update materialized
  counters in the same transaction.
- (type) Public contract fields use singular count names:
  `shareCount` / `referenceCount`. UI copy may say "Shares" / "References" or
  localized equivalents, but DTO/schema fields should not use bare plural names
  such as `shares`, `references`, or `reposts`.

## 1. Reaction Service Share Count

- [x] 1.1 Add share schemas and types under
  `package/contract/src/reaction/`, including create/share-click input and
  batched summary response fields for `shareCount`.
- [x] 1.2 Add reaction-service Drizzle tables in
  `package/reaction/src/db/schema/`: `UnitShare` with
  `unique(userId, targetId)` and a materialized share summary table keyed by
  `targetId`.
- [x] 1.3 Add repository methods in
  `package/reaction/src/reaction/reaction.repository.ts` or a dedicated share
  repository for idempotent share creation and summary reads.
- [x] 1.4 Add service logic in `package/reaction/src/reaction/` that requires an
  authenticated user, inserts the first share only once, and increments summary
  only when a row is newly created.
- [x] 1.5 Add API routes in `package/reaction/src/reaction/reaction.api.ts` or a
  sibling share API for recording share clicks and reading share summaries.
- [x] 1.6 Add tests in `package/reaction/src/reaction/` for authenticated-only
  recording, per-user deduplication, repeated-click idempotency, no reaction
  quota interaction, and batched summary reads.

## 2. Frontend/API Share Flow

- [x] 2.1 Add frontend API client, query keys, and mutation helpers under
  `package/api/src/reaction/` or a dedicated share module, reusing existing
  React Query cache conventions.
- [x] 2.2 Update the share panel entrypoint so opening/clicking share records
  authenticated share intent once per target before offering copy-link,
  external share, or internal share actions.
- [x] 2.3 Keep unauthenticated share UI usable for copy/external actions, but do
  not call the share-count mutation without an authenticated user.
- [x] 2.4 Expose hydrated `shareCount` to cards/detail surfaces that already
  hydrate engagement summaries.
- [x] 2.5 Add focused app/API tests for share mutation behavior and cache updates
  without changing reaction reaction-count semantics.

## 3. Server Reference Count Schema

- [x] 3.1 Add `referenceCount` to the Unit model/schema and DTOs where Unit
  summaries are rendered or searched.
- [x] 3.2 Add a server-owned `PostUnitReference` relation table with
  `sourcePostUnitId`, `targetUnitId`, `createdAt`, primary/unique key on
  `(sourcePostUnitId, targetUnitId)`, and indexes for both source and target.
- [x] 3.3 Add the corresponding Prisma model/migration and update generated
  Drizzle schema artifacts according to the current server database workflow.
- [x] 3.4 Add contract tests that Unit/Post DTOs expose `referenceCount` as an
  optional numeric count using existing `xxxCount` naming conventions.

## 4. Server Reference Sync

- [x] 4.1 Add a ContentDoc helper in `package/contract/src/content/doc-v1.ts` to
  extract unique structured `unit-ref` target IDs, mirroring
  `extractPollUnitIdsFromContentDoc`.
- [x] 4.2 Add a post service sync helper beside `syncPostPollReferences` that
  diffs old/new unit-ref target sets and writes `PostUnitReference` rows.
- [x] 4.3 On post create and content update, call the reference sync helper in
  the same transaction that writes post content translations.
- [x] 4.4 On global post delete, delete all `PostUnitReference` rows for the
  source post and decrement `Unit.referenceCount` for affected targets.
- [x] 4.5 Ensure reference sync ignores comments and non-POST source Units.
- [x] 4.6 Add service tests for create, update add/remove, repeated target in one
  post, multiple language translations, markdown link exclusion, non-POST source
  exclusion, and global delete cleanup.

## 5. Search, Ranking, And Display Surfaces

- [x] 5.1 Add `referenceCount` and `shareCount` fields to relevant Meili search
  documents where content cards need to display or sort by engagement metrics.
- [x] 5.2 Update search sync paths to read the materialized `Unit.referenceCount`
  instead of counting `PostUnitReference` rows.
- [x] 5.3 Decide whether ranking formulas should include `shareCount` and
  `referenceCount`; if included, read materialized values or summaries only.
- [x] 5.4 Update card/detail mappers to expose `shareCount` and
  `referenceCount` without duplicating DTO shapes in app code.
- [x] 5.5 Add targeted mapper/search tests for count propagation.

## 6. Internal Share-To-Post UX

- [x] 6.1 Refactor the share card so selecting a Rezics target destination
  enables two actions: direct share and write/comment share.
- [x] 6.2 Direct share creates a normal post with empty main markdown content and
  a structured `unit-ref` to the shared Unit.
- [x] 6.3 Write/comment share opens the normal post editor with the structured
  `unit-ref` already inserted, leaving the user free to add ordinary post
  content and publish through existing post flows.
- [x] 6.4 Ensure both internal share actions produce ordinary posts, not a new
  repost Unit or repost domain.
- [x] 6.5 Add focused component or route tests for the two internal share actions
  and for the empty-main direct-share post shape.

## 7. Validation

- [x] 7.1 Run targeted contract tests for reaction share schemas, ContentDoc
  unit-ref extraction, Unit/Post DTO count fields, and search document shape.
- [x] 7.2 Run targeted reaction service tests for share recording and summary
  behavior.
- [x] 7.3 Run targeted server tests for `PostUnitReference` sync and
  `Unit.referenceCount` materialization.
- [x] 7.4 Run targeted app/API tests for share panel behavior and engagement
  hydration.
- [x] 7.5 Run `bun run check:convention`.
- [x] 7.6 Run `bun run check:tokens` if share panel JSX/CSS classes change.

## Out of scope

- A standalone repost product model or repost Unit type.
- Counting markdown links as references.
- Realm-scoped reference counts or moderation-aware reference counts.
- Decrementing `shareCount`, tracking external platform delivery success, or
  counting anonymous shares.
- A full engagement-summary service unifying reaction, share, and reference
  metrics. This plan keeps ownership split: reaction service for share intent,
  server for content references.
