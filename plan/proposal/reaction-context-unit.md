---
title: Reaction Context Unit Cutover
status: completed
created: 2026-06-13
completed: 2026-06-13
supersededBy:
tags: [reaction, contract, schema, feed, ranking, app]
---

## Why

Feed and detail interactions currently rely on `scopeKey` strings such as
`direct` and `realm:<id>`. That makes realm interaction context a string
protocol instead of a Unit-backed identity, creates confusing names such as
`interactionContext` / `reactionScopeKey`, and leaves feed rows and comment
reactions inconsistently wired.

Cut reaction context over to a nullable `contextUnitId`: `null` is direct/global
interaction, and a non-null value is the Unit that supplies the interaction
context. Reaction targets remain opaque UUID entities, not necessarily Units,
so comments can be reacted to without adding `targetKind` purely for collision
avoidance.

## Durable constraints & decisions

- (type) Reaction rows use `contextUnitId: string | null`; no persisted
  `scopeKey`, `reactionScopeKey`, `summaryScopeKey`, `interactionContext`,
  `mode`, or `realm:<id>` string protocol remains in reaction surfaces.
- (type) `targetId` is an opaque UUID for a reactable entity. It may identify a
  Unit, Comment, poll option, or future UUID-backed entity. It does not imply a
  Unit target.
- (comment) `contextUnitId`, when non-null, is a Unit id. The reaction service
  database may not be able to foreign-key it across service boundaries, so the
  main-server boundary validates context existence and policy before writes.
- (comment) Do not add `targetKind` only to defend against cross-table UUIDv7
  collisions. If a future product need requires target-specific behavior, add
  a typed target route/service boundary rather than stringifying identities.
- (test) Writes normalize absent `contextUnitId` to `null`; non-null context
  writes are accepted only after the main server validates the context Unit and
  target policy.
- (test) User reaction state is context-specific: a direct/global vote and a
  realm-context vote for the same target are distinct rows.
- (test) Summary reads can return direct/context-specific counts, and ranking or
  profile code can still request an all-context aggregate by using a separate
  read path that groups without `contextUnitId`. This aggregate is not a
  persisted interaction mode.
- (test) Unique constraints handle nullable context correctly, either with
  partial unique indexes for `contextUnitId IS NULL` / `IS NOT NULL` or the
  repository's supported `NULLS NOT DISTINCT` equivalent.
- (type) Shelf item identity keeps `itemType` / `kind` where needed. Shelf is
  not part of this reaction context cleanup; only fake reaction context values
  such as `shelf-item:<id>` are removed.
- (test) Feed rows decide the interaction context they expose. App components
  consume the server-provided `contextUnitId` and do not infer realm context
  from route shape or card location.
- (test) Reply from feed cards opens the post detail route selected by the feed
  row, including any realm context carried by that row.

## Tasks

## 1. Contract And Naming Cutover

- [x] 1.1 Replace reaction contract `scopeKey` request/response fields with
  `contextUnitId?: string | null` in `package/contract/src/reaction/*`.
- [x] 1.2 Delete `reaction.scope.ts` string helpers and replace callsites with
  nullable context Unit ids.
- [x] 1.3 Rename API client option names from `scopeKey` to `contextUnitId` in
  `package/api/src/reaction/*`.
- [x] 1.4 Rename app reaction props and hooks from `summaryScopeKey`,
  `reactionScopeKey`, and `targetUnitId` to context/target names that match the
  new model.

## 2. Reaction Service Storage

- [x] 2.1 Replace `Reaction.scopeKey` with nullable `contextUnitId` in
  `package/reaction/src/db/schema/reactions.ts`.
- [x] 2.2 Replace `ReactionSummary.scopeKey` with nullable `contextUnitId` and
  update primary/unique/index definitions for nullable context semantics.
- [x] 2.3 Update `ReactionRepository` create/delete/list/summary methods to
  compare nullable `contextUnitId` correctly instead of using string equality.
- [x] 2.4 Keep `ReactionTargetUsage` keyed by `(userId, targetId)` unless product
  policy explicitly wants a separate quota per context.
- [x] 2.5 Generate the Drizzle migration from schema changes; no compatibility
  columns are required in this development cutover.

## 3. Main Server Boundary

- [x] 3.1 Update `package/server/src/reaction-boundary/*` to accept
  `contextUnitId`, validate non-null contexts as Units, and remove realm scope
  parsing.
- [x] 3.2 Preserve realm policy checks by treating a realm `contextUnitId` as the
  current realm-context interaction case.
- [x] 3.3 Add typed validation paths for non-Unit targets that need writes, most
  importantly Comment reactions, instead of introducing `targetKind` into
  reaction storage.
- [x] 3.4 Update profile reaction history hydration to resolve target display
  data for Unit targets while tolerating non-Unit targets such as comments.

## 4. Ranking And Projection Consumers

- [x] 4.1 Replace `RankingReactionBucket.scopeKey` with nullable
  `contextUnitId` in `package/ranking/src/db/schema/ranking.ts`.
- [x] 4.2 Update ranking repository/service ingestion to pass context ids and to
  support all-context aggregation through an explicit aggregate read path.
- [x] 4.3 Revisit `UnitRankProjection.scopeKey`: remove the redundant string key
  where `scopeKind + scopeId` already identifies the ranking scope, or document
  why a non-reaction ranking scope still needs a generated key.
- [x] 4.4 Update ranking tests and timestamp-default integration fixtures that
  currently insert/read `scopeKey`.

## 5. Feed, Detail, And Comment Interaction Wiring

- [x] 5.1 Extend feed row DTOs and mappers so each feed row carries
  `contextUnitId: string | null` for reaction interactions.
- [x] 5.2 Update feed service realm/home/zone paths so the server chooses the row
  context once and returns it with the row.
- [x] 5.3 Add reaction hydration to feed sections that currently render votes
  without priming summary/my-reaction caches.
- [x] 5.4 Fix realm feed hydration so review posts and ordinary posts both use
  the same context-aware target list.
- [x] 5.5 Make feed-card reply navigate to the row detail href instead of using a
  no-op fallback.
- [x] 5.6 Remove `shelf-item:<id>` reaction context wiring from shelf item
  renderers; shelf keeps its own item kind identity, but reactions do not use
  shelf item identity as context.
- [x] 5.7 Wire comment reaction targets through `targetId` rather than names that
  imply `targetUnitId`.

## 6. Verification

- [x] 6.1 Update focused contract tests for nullable `contextUnitId` input,
  output, and absence handling.
- [x] 6.2 Update reaction repository/service tests for direct, context-specific,
  and all-context summary behavior.
- [x] 6.3 Update main-server boundary tests for realm context validation and
  comment reaction writes.
- [x] 6.4 Update app/API tests around reaction query keys, hydration cache lookup,
  feed card reply navigation, and context-specific vote state.
- [x] 6.5 Run focused package tests for contract, reaction, ranking, server, and
  app reaction/feed surfaces, then run the available repo checks relevant to
  touched packages.

## Out of scope

- Reworking Shelf item identity. Shelf still needs `itemType` / `kind` for its
  collection semantics.
- Adding `targetKind` to reaction rows solely for UUID collision avoidance.
- Generalizing every existing `realmUnitId` domain field. Comment and score may
  later move to `contextUnitId`, but this plan only changes the reaction
  interaction context and directly affected consumers.
- Building a compatibility layer for old `scopeKey` clients or data.
