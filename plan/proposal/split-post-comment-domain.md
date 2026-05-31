---
title: Split Post and Comment Domains
status: active
created: 2026-05-30
completed:
supersededBy:
tags: [post, comment, realm, search, ranking]
---

## Why

`Post` currently carries root submissions, replies, comment-tree topology, and
search projection in one model. That made the initial thread feature flexible,
but it blurs the boundary needed for reddit-style realm search: searching a
realm must find both top-level posts and comments under those posts, while still
letting post feeds and comment threads have different filters, ranking, and
moderation semantics.

Split the concepts. `Post` becomes the top-level submission/domain object.
`Comment` becomes the reply tree node. Comments are indexed independently with a
generic `rootUnitId`, not `rootPostUnitId`, so future roots can be posts first
and other units later without renaming the model again.

## Durable constraints & decisions

- `(type)` Add a first-class `Comment` Unit extension (`UnitType.COMMENT`) rather
  than continuing to encode comments as `Post(depth > 0)`.
- `(type)` `Comment.rootUnitId` is the generic domain root. Do not add
  `rootPostUnitId` to comments; post-rooted threads are represented by
  `rootUnitId = <post unit id>`.
- `(type)` `Comment.realmUnitId` is required for realm-partitioned discussion.
  The stable comment partition is `(rootUnitId, realmUnitId)`, not an array of
  realm ids.
- `(type)` Nested topology is `parentCommentUnitId` plus `depth` and `path`.
  Direct children of the root have `parentCommentUnitId = null`.
- `(comment)` A post only owns/query-lists its direct comment children. Whole
  subtree reads and search belong to the comment domain.
- `(test)` Realm-scoped search for comments must match comment text under posts
  in that realm, without leaking comments from another realm partition on the
  same root unit.
- `(test)` Post search must return root posts only; comment hits must come from
  the comment search path, even when the keyword matches comment body text.
- `(test)` Creating a direct comment under a root unit in multiple realms must
  choose an explicit `realmUnitId`; a single-realm root may default to that realm.
- `(test)` Comment ranking sorts apply inside comment scopes
  (`rootUnitId`/`realmUnitId`, parent sibling scope, or subtree scope), not to
  root post feeds.
- `(comment)` Keep `PostPin`/accepted-answer semantics rooted at the domain root:
  promoted targets are comments within a root unit's comment partition.

## 1. Contract Shape

- [ ] 1.1 Add `UnitType.COMMENT` and a `CommentDTO`/write schema in
  `package/contract/src/comment/*`, mirroring the post contract style but using
  `rootUnitId`, `realmUnitId`, and `parentCommentUnitId`.
- [ ] 1.2 Remove reply-tree fields from the long-term `PostDTO` surface:
  `rootPostUnitId`, `parentPostUnitId`, subtree query fields, and comment
  ranking fields become comment-domain concerns.
- [ ] 1.3 Add `CommentSearchDocument` and `CommentSearchOptions` in
  `package/contract/src/meili/comment.ts`.
- [ ] 1.4 Update federated search contract/types so post categories query root
  posts and comment categories/query modes can query comments independently.

## 2. Database Model

- [ ] 2.1 Add a `Comment` model to
  `package/server/prisma/schema.prisma` with `unitId`, `rootUnitId`,
  `realmUnitId`, `parentCommentUnitId`, `authorUserId`, `content`, `depth`,
  `path`, counters, lifecycle fields, and timestamps.
- [ ] 2.2 Keep `Post` focused on root submissions: author, target, kind, content,
  score, state, direct comment counters, locking, and root-level realm/work/tag
  memberships.
- [ ] 2.3 Replace post reply indexes with comment indexes:
  `(rootUnitId, realmUnitId, createdAt)`, `(rootUnitId, realmUnitId,
  parentCommentUnitId, createdAt)`, author/date, state, and GiST `path`.
- [ ] 2.4 Migrate existing `Post(depth > 0)` rows into `Comment` rows and keep
  `Post(depth = 0)` rows as root posts. Preserve unit ids where possible so
  reactions, moderation references, and links survive the cutover.

## 3. Server Domain

- [ ] 3.1 Create `package/server/src/comment/comment.api.ts`,
  `.service.ts`, `.mapper.ts`, and `.types.ts` following the existing domain
  layout.
- [ ] 3.2 Move reply creation, subtree reads, collapse/path attachment,
  reply-counter maintenance, and blocked-author filtering from
  `post.service.ts` into `comment.service.ts`.
- [ ] 3.3 Update `post.service.ts` so post list/search paths return root posts
  only and direct child lookup delegates to the comment service.
- [ ] 3.4 Move accepted-answer and comment pinning targets from `PostPin.postUnitId`
  semantics to comment targets while keeping the scope/root unit stable.
- [ ] 3.5 Mount the comment API from `package/server/src/index.ts` and expose
  frontend access through `@rezics/api`.

## 4. Search And Ranking

- [ ] 4.1 Add a `comments` Meilisearch index to `package/search/src/schema.ts`
  with `contentText`, author fields, `rootUnitId`, `realmUnitId`,
  `parentCommentUnitId`, `depth`, lifecycle, and ranking fields.
- [ ] 4.2 Split post sync from comment sync in `package/search/src/sync.ts`;
  root posts write only to `posts`, comments write only to `comments`.
- [ ] 4.3 Add comment search service/filter builders under
  `package/server/src/meili/comment` and wire federated realm search to query
  both `posts` and `comments` when the selected category permits it.
- [ ] 4.4 Update job commands and handlers for `search.comment.*` sync, delete,
  patch, fanout, and full-sync operations.
- [ ] 4.5 Update ranking projection so `RankKind = "comment"` patches the
  `comments` index instead of comment fields inside the `posts` index.

## 5. App Cutover

- [ ] 5.1 Add comment API hooks/types in `package/api/src/comment`.
- [ ] 5.2 Update post thread UI under `package/app/src/post` so root post render
  and comment tree render are separate data paths.
- [ ] 5.3 Update search result adapters so post hits and comment hits have
  distinct cards/destinations.
- [ ] 5.4 Update mocks/stories/tests that currently model replies as `PostDTO`.

## 6. Tests And Backfill Verification

- [ ] 6.1 Add contract tests for comment DTO/search schemas and post DTO removal
  of reply-only fields.
- [ ] 6.2 Add server tests for direct child listing, nested subtree reads,
  multi-realm root partitioning, and migration-preserved unit ids.
- [ ] 6.3 Add search tests proving post index excludes comments and comment index
  supports realm/root/parent filters.
- [ ] 6.4 Add ranking tests proving comment score patches land in `comments`.
- [ ] 6.5 Add migration/backfill tests or seed verification for converting
  existing post replies into comments.

## Out of scope

- Do not redesign tags or `RealmTagApplication`.
- Do not make one physical Meilisearch index per realm; realm partitioning is a
  required filter/document field.
- Do not make comments a catalog/content type visible in generic content search.
- Do not change the public meaning of realm membership, realm rules, or
  moderation states beyond moving reply behavior to the comment domain.
