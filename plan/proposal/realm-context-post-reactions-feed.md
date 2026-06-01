---
title: Realm Context Post Reactions And Feed
status: done
created: 2026-06-01
completed:
supersededBy:
tags: [post, realm, reaction, feed, ranking]
---

## Why

`Post` is a first-class Unit, not a child object of a realm. At the same time,
realm pages and future recommendations need reddit-like context: a user may read,
comment on, and react to the same post from a specific realm lens. Today comment
storage already partitions by `(rootUnitId, realmUnitId)`, but the app still
falls back to a single `PostDTO.realmUnitId` and the reaction service only knows
`targetId`.

Make the context explicit. Canonical post identity remains `/post/:postUnitId`.
Realm-context reads use `/r/:realmSlug/post/:postUnitId` or
`/realm/:realmUnitId/post/:postUnitId`. Reactions become scoped events: direct
and realm-scoped reactions are counted independently, and global post views sum
direct plus all realm scopes without deduplicating by user.

## Durable constraints & decisions

- `(type)` `Post` remains the identity-bearing first-class Unit. Realm context
  must be carried as route/API context, not by treating the post as realm-owned.
- `(type)` Reaction scope is explicit and non-null. Use a stable `scopeKey`
  value such as `direct` or `realm:<realmUnitId>` rather than nullable
  `realmUnitId` in unique keys.
- `(test)` A user may react to the same target in multiple scopes. Global
  summaries count each active scoped reaction row, so direct + two realm likes
  count as three.
- `(test)` Context-free `/post/:postUnitId` displays global reaction summary
  but uses the `direct` scope for the current viewer's active button state and
  write/delete operations.
- `(test)` Realm-context post pages display and write only the current realm's
  reaction scope, while their comment tree reads the matching
  `(rootUnitId, realmUnitId)` partition.
- `(type)` Reaction writes enforce an active per-user-per-target quota across
  all scopes and reaction kinds. Default quota is 3; future paid or trust-based
  quota expansion must be representable without changing reaction row identity.
- `(test)` Deleting a reaction releases one active quota slot. Rate limits can
  later prevent rapid churn, but the durable quota is active-count based.
- `(comment)` The reaction service owns scoped reaction identity and quota
  accounting. The main server boundary owns realm validation and policy checks
  before forwarding scoped writes to the reaction service.
- `(test)` Feed candidate selection can choose either direct context or a realm
  context. Realm context is used when the recommendation reason comes from
  realm membership, realm feed activity, realm comments, realm tags, or
  realm-scoped reaction activity.
- `(test)` Feed rendering deduplicates repeated candidates by `postUnitId` when
  needed and selects a primary context by viewer relationship, recommendation
  score, then recent activity.

## 1. Contract Shape

- [x] 1.1 Add reaction scope request/response shape in
  `package/contract/src/reaction/reaction.schema.ts`,
  `reaction.types.ts`, and `internal.ts`: optional public `scopeKey` defaults
  to `direct`; internal create/remove/list rows carry explicit `scopeKey`.
- [x] 1.2 Extend reaction summary and my-reaction query contracts with an
  optional `scopeKey`. Omitted summary means global aggregate across all scopes;
  omitted my-reaction means `direct` for backwards-compatible button state.
- [x] 1.3 Add typed constants/helpers for `direct` and `realm:<realmUnitId>`
  scope keys in the reaction contract package or a shared API helper, keeping
  parsing/formatting consistent across app, server, reaction, and ranking.
- [x] 1.4 Add a feed context DTO/type in the most local existing feed/ranking
  contract home: `{ kind: "direct" } | { kind: "realm"; realmUnitId: string }`.

## 2. Reaction Service

- [x] 2.1 Add `scopeKey` and `ReactionTargetUsage` (or equivalent active quota
  table) to `package/reaction/prisma/schema.prisma`, with unique identity
  `(userId, targetId, reaction, scopeKey)` and summary identity
  `(targetId, reaction, scopeKey)`.
- [x] 2.2 Add a migration that backfills all existing reactions and summaries
  to `scopeKey = direct` and initializes usage rows from active reaction counts.
- [x] 2.3 Update `package/reaction/src/reaction/reaction.service.ts` so create
  validates reaction type, locks/creates the usage row, rejects quota overflow,
  inserts the scoped reaction, increments scoped summary, and increments active
  usage in one transaction.
- [x] 2.4 Update remove to delete by `(userId, targetId, reaction, scopeKey)`,
  decrement the scoped summary, and decrement active usage in the same
  transaction.
- [x] 2.5 Update `getSummary` to support both scoped and global reads: scoped
  reads filter `scopeKey`; global reads group all summaries for the requested
  target ids by `(targetId, reaction)` without user dedupe.
- [x] 2.6 Update `getUserReactions`, `listGiven`, and `listByUser` to carry or
  filter `scopeKey` where needed, preserving existing direct-scope behavior for
  callers that do not pass a scope.
- [x] 2.7 Add tests in `package/reaction/src/reaction/reaction.service.test.ts`
  for scoped duplicate behavior, global aggregation, quota rejection,
  quota release on delete, and backwards-compatible direct defaults.

## 3. Server Boundary And Policy

- [x] 3.1 Update `package/server/src/reaction-boundary/reaction-boundary.api.ts`
  to accept scope input, validate `realm:<realmUnitId>` scopes against realm
  visibility/membership/policy, and forward explicit `scopeKey` to the reaction
  service.
- [x] 3.2 Keep notification ownership tied to `targetId`, not scope. Include
  scope metadata in notification `extra` only if the target owner needs context.
- [x] 3.3 Update `package/server/src/reaction-boundary/reaction-boundary.client.ts`
  and internal contract calls for scoped create/remove/list/cleanup.
- [x] 3.4 Update profile reaction history hydration in
  `package/server/src/profile-reaction-history` so scoped rows render sensible
  targets and, for realm scopes, can link to the realm-context post route when
  the target is a post.
- [x] 3.5 Update server tests for direct defaults, realm policy rejection, and
  realm-scoped reaction history hydration.

## 4. App Routes And Engagement

- [x] 4.1 Add post-context routes under
  `package/app/src/routes/_mainLayout/r/$realmSlug/post/$postUnitId.tsx` and
  `package/app/src/routes/_mainLayout/realm/$realmId/post/$postUnitId.tsx`.
  Both should resolve a `realmUnitId` and render the existing post thread page
  with explicit context.
- [x] 4.2 Update `package/app/src/post/pages/PostThreadPage.tsx` so context-free
  `/post/:postUnitId` does not infer `root.realmUnitId`; it should render global
  reaction summary and either direct comments or an all-realm grouped comment
  overview according to the comment API changes chosen at apply time.
- [x] 4.3 Update `package/app/src/post/sections/PostTreeSection.tsx` and reply
  composer wiring so realm-context routes pass the route realm, not
  `PostDTO.realmUnitId`.
- [x] 4.4 Extend `ReactionBar`, `VoteGroup`, `useVoteController`, and reaction
  hooks under `package/app/src/engagement` and `package/api/src/reaction` with
  a reaction scope prop. Summary scope and my-reaction/write scope must be
  independently expressible so `/post/:id` can show global counts while writing
  direct reactions.
- [x] 4.5 Update `package/api/src/reaction/reaction.keys.ts`,
  `reaction.queries.ts`, `reaction.mutations.ts`, and `useReactionData.ts` so
  cache keys include summary scope and user scope. Optimistic updates must only
  touch matching scoped/my caches and any global summary caches containing the
  target.
- [x] 4.6 Update realm feed cards in
  `package/app/src/realm/components/RealmContentFeed.tsx` to link post cards to
  the realm-context post route and pass realm reaction scope into the reaction
  bar.
- [x] 4.7 Add app/API tests or stories proving direct post pages, realm-context
  post pages, and realm feed cards use the intended scope and link shape.

## 5. Feed And Ranking

- [x] 5.1 Introduce a feed candidate/context model near the first feed/ranking
  implementation site. Candidate identity is `postUnitId`; candidate context is
  direct or realm.
- [x] 5.2 Route direct-context feed items to `/post/:postUnitId`; route
  realm-context items to `/r/:realmSlug/post/:postUnitId` when a slug is
  available, otherwise `/realm/:realmUnitId/post/:postUnitId`.
- [x] 5.3 Define feed context selection rules in tests: direct when the reason is
  author follow, target/work affinity, profile activity, search, or global post
  rank; realm when the reason is realm membership, realm feed activity, realm
  comment activity, realm tags, realm moderation, or realm reaction activity.
- [x] 5.4 Update `package/ranking/src/ranking/reaction-client.ts` so existing
  global score inputs keep reading global summaries, while future realm-context
  ranking can request scoped summaries.
- [x] 5.5 Update ReactionSummary CDC handling in
  `package/job-runner/src/sequin/router.ts` so scoped summary changes can
  invalidate both the post's global rank and, for realm scopes, the realm-scoped
  rank/context.

## Out of scope

- Do not make post identity realm-owned or replace `/post/:postUnitId` with a
  realm route.
- Do not deduplicate global reaction counts by user across scopes.
- Do not implement paid quota purchase UI; only keep the quota model extensible
  for future paid or trust-based expansion.
- Do not redesign `RealmTagApplication`, realm moderation, pinboard, or comment
  promotion semantics beyond passing explicit realm context.
- Do not build a full recommendation product UI in this plan; only establish
  the context model and the code surfaces that future feed work will consume.
