---
title: Poll Library Index
status: active
created: 2026-06-02
completed:
supersededBy:
tags: [poll, post, search, app]
---

## Why

Poll authoring needs to become a real reusable-asset workflow. Realm poll mode
should render and search polls that already exist, while post attach should
select an existing poll first and create a new poll only as a secondary action.
The current `extra.poll.unitId` path only supports a one-off "create and attach"
flow and does not provide a searchable poll library.

The intended cutover is: post content carries poll embeds through the existing
`ContentDoc` region block shape, the backend maintains weak post-to-poll
references and a denormalized `Poll.usageCount`, and a dedicated poll search
index powers both the poll workspace and attach picker.

## Durable constraints & decisions

- `(type)` `doc-v1` already has the poll content block shape:
  `{ type: "poll", source: string }`. Keep the schema shape; define `source` as
  the referenced `pollUnitId` through helpers and tests instead of inventing a
  new block.
- `(test)` New post writes that attach polls must write poll blocks into
  `content.beforeMain` / `content.afterMain`, not `post.extra.poll`. Because
  this is a development-stage cutover, remove `post.extra.poll` from contracts,
  app write/read paths, mappers, search documents, stories, and tests in the
  same change instead of keeping a legacy fallback.
- `(type)` Add `Poll.usageCount Int @default(0)` to Prisma. Do not add
  `Poll.used`; `used` is derived as `usageCount > 0` in DTOs/search documents.
- `(comment)` `PostPollReference` is a weak reference table. It records that a
  post content document mentions a poll, but it must not encode one-poll-only
  semantics or impose hard FK behavior that would make legacy/deleted/missing
  content hard to render or repair later.
- `(test)` A single post may reference multiple different polls. `usageCount`
  counts distinct posts using a poll, not occurrences, so the same poll appearing
  twice in one post counts once.
- `(comment)` `PostPollReference` is a maintenance aid for usage/search, not the
  render source of truth. Rendering reads the ordered poll blocks from post
  content; the weak table may omit ordering.
- `(test)` `usageCount` is maintained by the post backend API in the same
  transaction that creates or updates post content. The frontend must not call a
  standalone "increment usage" API.
- `(test)` On post content update, compute `oldPollIds` and `newPollIds`, then
  apply only the set diff: insert weak references and increment added poll
  counts; delete weak references and decrement removed poll counts.
- `(test)` Extracting poll ids from one post content document is local and cheap:
  it scans only `beforeMain` and `afterMain` region arrays, O(region block
  count), with no database reads. Avoid full-post-table scans on request paths.
- `(comment)` Cross-post usage is the expensive operation; keep it out of
  request-time aggregation by maintaining `PostPollReference` and
  `Poll.usageCount`, with repair/backfill able to rebuild counts from content.
- `(type)` Poll creation needs a human label for library/search UX. Store poll
  title, optional description, and language through `UnitTranslation` rather than
  duplicating title columns on `Poll`.
- `(type)` Add a surrogate `PollVote.id` UUIDv7 primary key and an optional
  `PollVote.realmUnitId`. Realm context is recorded as structured metadata for
  statistics and future per-realm voting, not as poll ownership.
- `(test)` First-pass vote identity remains globally unique per
  `(pollUnitId, userId, optionId)` through a Prisma-expressible unique
  constraint. This intentionally prevents the same user from voting the same
  option once globally and again in a realm for now; a later cutover may drop
  that constraint and introduce realm-aware uniqueness when multi-context votes
  are enabled.
- `(test)` Poll result reads must expose enough caller vote state for the
  frontend to make the current product restriction ergonomic: the caller's vote
  options plus any recorded realm context(s) for that poll. Frontend surfaces may
  block casting a new realm/global vote until the old vote is withdrawn.
- `(type)` Add a dedicated `polls` Meili index. The poll search document includes
  `usageCount` and derived `used`, plus title/options/config fields needed by the
  workspace and attach picker.

## Tasks

## 1. Content References

- [x] 1.1 Add contract helpers in `package/contract/src/content/doc-v1.ts`:
  `pollContentBlock(pollUnitId)`, `markdownContentDocWithPoll(...)`, and
  `extractPollUnitIdsFromContentDoc(content)`.
- [x] 1.2 Add contract tests in `package/contract/src/content/doc-v1.test.ts`
  covering multiple poll blocks, duplicate poll ids in one post, malformed
  blocks, and legacy docs without regions.
- [x] 1.3 Update app post rendering in
  `package/app/src/post/components/item/PostCard.tsx` and
  `package/app/src/post/components/item/PostReply.tsx` to render poll blocks
  from content.
- [x] 1.4 Update app create helpers in
  `package/app/src/realm/models/realmCreateMode.ts` and reply/post composers so
  new poll attachments write content poll blocks instead of `extra.poll`.
- [x] 1.5 Remove `post.extra.poll` from post contracts, DTO tests, app mocks,
  search document schemas/projection, and server mappers. Do not keep a legacy
  read fallback.

## 2. Poll Model And Usage Maintenance

- [x] 2.1 Add `usageCount` to `Poll` and add a weak `PostPollReference` model in
  `package/server/prisma/schema.prisma` with scalar `postUnitId`,
  `pollUnitId`, timestamps, `@@id([postUnitId, pollUnitId])`, and indexes for
  both lookup directions.
- [x] 2.2 Add a migration for `Poll.usageCount` and `PostPollReference`.
- [x] 2.3 Add backend helper code near the post domain to extract old/new poll
  id sets from post content and maintain `PostPollReference` plus
  `Poll.usageCount` in post create/update transactions.
- [x] 2.4 Add repair/backfill code or tests that prove `usageCount` can be
  rebuilt from post content references.
- [x] 2.5 Add server tests for create, update add, update remove, duplicate poll
  blocks in one post, multiple polls in one post, and no standalone frontend
  usage increment API.

## 3. Poll Title And DTOs

- [x] 3.1 Extend `package/contract/src/post/poll.ts` create poll schema with
  `title`, optional `description`, and optional `language`.
- [x] 3.2 Update `package/server/src/poll/poll.service.ts` to create the poll
  `UnitTranslation` in the same transaction as the poll.
- [x] 3.3 Update `package/server/src/poll/poll.mapper.ts` and poll DTOs if the
  UI needs title/description on direct poll reads.
- [x] 3.4 Update `package/app/src/poll/components/PollComposer.tsx` to collect a
  title before options/config.

## 4. Poll Vote Realm Context

- [x] 4.1 Change `PollVote` in `package/server/prisma/schema.prisma` from the
  composite primary key to `id String @id @default(dbgenerated("uuidv7()"))`
  plus nullable `realmUnitId String? @db.Uuid`.
- [x] 4.2 Add a Prisma-expressible unique constraint for the current global vote
  rule: `@@unique([pollUnitId, userId, optionId])`, while keeping lookup indexes
  for `pollUnitId + userId`, `pollUnitId + optionId`, and
  `pollUnitId + realmUnitId + optionId`.
- [x] 4.3 Update the existing single-choice partial unique migration/index from
  `(pollUnitId, userId)` semantics as needed for the new surrogate primary key,
  while keeping first-pass SINGLE behavior globally one choice per user/poll.
- [x] 4.4 Extend cast/withdraw vote contract inputs with optional
  `realmUnitId`, and persist it on new `PollVote` rows. Changing from one
  context to another may be blocked in the UI by requiring withdraw first.
- [x] 4.5 Extend poll results with caller vote context state so the app can know
  whether the current user already has a direct or realm-context vote before
  allowing another cast.
- [ ] 4.6 Add server and app-model tests for direct votes, realm-context votes,
  global uniqueness under the current rule, and frontend prevention of casting
  when another context already exists.

## 5. Poll Search Index

- [x] 5.1 Add poll search document/options/result schemas under
  `package/contract/src/meili` or the poll contract module.
- [x] 5.2 Add `polls` to `package/search/src/schema.ts`,
  `ExpectedMeiliIndexUid`, and `SearchClient` index initialization/deletion.
- [x] 5.3 Add poll document build/sync code in `package/search/src`, projecting
  title, description text, option labels, option unit ids, config, `usageCount`,
  and derived `used`.
- [x] 5.4 Add server search service/API wiring for `POST /meili/polls/search`
  plus init/sync admin endpoints following existing Meili patterns.
- [x] 5.5 Add API client/query wrappers in `package/api/src/meili` for poll
  search.
- [ ] 5.6 Add tests for poll index settings, document projection, user filtering,
  used/unused filtering, and search over titles/options.

## 6. Shared Poll Library UI

- [ ] 6.1 Create `package/app/src/poll/components/PollLibrarySurface.tsx` for
  search input, used/unused/closed filters, result list, and a
  `renderAction(poll)` slot.
- [ ] 6.2 Update `package/app/src/realm/components/RealmPollWorkspace.tsx` to
  render `PollLibrarySurface` instead of only a create shell.
- [ ] 6.3 Update `package/app/src/realm/components/RealmPostCreateForm.tsx` to
  use a poll attach dialog with "Existing" and "New" flows.
- [ ] 6.4 Update `package/app/src/post/forms/ReplyComposer.tsx` to use the same
  picker pattern for attach.
- [ ] 6.5 Add/adjust community i18n strings for poll library search, filters,
  usage count, attach existing, and create new.

## Out of scope

- Hard realm ownership for polls. Polls remain user-owned reusable units; realm
  feed entry happens through post content.
- Enforcing that a poll can only be attached once or only attached to one post.
  Multiple posts and multiple polls per post remain allowed.
- Enabling multiple simultaneous votes by the same user across direct and
  multiple realm contexts. The new `PollVote.id` and `realmUnitId` shape keeps
  that future cutover cheap, but this plan keeps the first-pass global
  uniqueness rule.
- Building a full moderation policy for poll usage. The weak reference table and
  usage counter support search/workspace behavior only.
