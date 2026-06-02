---
title: Clean Up Post Content Seed
status: active
created: 2026-06-02
completed:
supersededBy:
tags: [server, post, content-translation, seed]
---

## Why

Post and chapter body reads have moved to `ContentTranslation`, while `Post`
still carries a legacy `content` column and several seed/factory paths still
write body data there. In a fresh dev seed this recreates empty list/detail
content because DTO mappers resolve body text from `unit.contentTranslations`,
not from `Post.content`.

This is a clear development-stage cutover: remove the old surface instead of
maintaining repair/backfill compatibility, then rebuild seed data so a fresh
database starts directly on the current model.

## Durable constraints & decisions

- (type) `Post` stores root submission metadata only; post/chapter body content
  is stored in `ContentTranslation` rows keyed by `(unitId, language)`.
- (test) Fresh factory/infra seed paths that create `Post(kind=REVIEW|EXCERPT|REMARK|POST|CHAPTER|WIKI)` must create matching support-language and
  content-translation rows when the post has displayable body content.
- (test) `mapPostToDTO` and chapter mappers must not read, accept, or test
  fallback behavior from `Post.content`.
- (type) `Post.extra` should only expose durable metadata (`rating`, `book`,
  `source`, `stateSchemaTag`); legacy `title` and `poll` compatibility keys are
  not part of the fresh schema.
- (type) Runtime POST creators outside factory/seed must also stop writing
  `Post.content`; this includes realm-tag context materialization, not only
  user-facing post create/update.
- (decision) Editorial/authority paths named `post.content` remain conceptual
  patch paths for wiki/post body editing. They do not require a persisted
  `Post.content` column.
- (comment) Seed/factory code should write the canonical storage shape directly;
  repair scripts are not part of fresh managed dev databases.
- (test) Generated/fresh seeded post list queries should surface non-null
  `PostDTO.content` for body-bearing posts without running repair scripts.
- (scan) No other schema field currently matches the `Post.content` problem
  shape. `Comment.content` is still canonical comment body storage, while
  `ContentStructureAnchor`, `SeriesContentIndex`, and counter fields are
  intentional projections/caches.

## 1. Remove Legacy Post Content Shape

- [ ] 1.1 Drop `Post.content` from `package/server/prisma/schema.prisma` and update generated Prisma usage after migration/generation.
- [ ] 1.2 Update `PostKind.CHAPTER` comments in `package/server/prisma/schema.prisma` and `package/contract/src/book/chapter.ts` to say body content lives in `ContentTranslation`.
- [ ] 1.3 Update `package/server/src/post/types.ts` and `package/server/src/post/post.mapper.test.ts` to remove repair-only `Post.content` language and fixtures.
- [ ] 1.4 Update `package/server/src/post/post.service.ts` delete/poll-reference helper logic so it no longer writes or assumes `Post.content`; remove or replace `rebuildPollUsageFromPostContents`.
- [ ] 1.5 Tighten `package/contract/src/post/post.ts` and `package/contract/src/post/post.test.ts` so `PostExtra` no longer accepts legacy `title` or `poll`.
- [ ] 1.6 Update `package/server/src/realm/realm-tag-context.service.ts` so realm tag context POST materialization does not write an empty `Post.content`; create a `ContentTranslation` only if that context post should have an initial body.
- [ ] 1.7 Fix stale schema/contract comments discovered during the sweep, including the `Shelf` comment that still says it replaces `Series` even though `Series` is a first-class model again.

## 2. Rebuild Seed And Factory Writers

- [ ] 2.1 Update `package/server/prisma/factory/posts.ts` so all post kinds create body content through `Unit.contentTranslations` or batched `contentTranslation.createMany`.
- [ ] 2.2 Update `package/server/prisma/factory/books.ts` chapter materialization seed paths to create `ContentTranslation` rows instead of `Post.content`.
- [ ] 2.3 Update `package/server/prisma/factory/scenarios.ts` large post tree and wiki-zone scenario writers to stop writing `Post.content`.
- [ ] 2.4 Update `package/server/prisma/seed/infra/seed-realm-taxonomy.ts` post creation to write rule/about body content through `ContentTranslation`; update its idempotency lookup so it no longer finds existing infra posts by `post.content.main.source`.
- [ ] 2.5 Keep `UnitSupportLanguage` creation aligned with every seeded `ContentTranslation` language, especially batch paths.
- [ ] 2.6 Remove duplicate legacy body writes from paths that already create `contentTranslations`, such as factory wiki and wiki-zone scenario writers.

## 3. Remove Repair Compatibility

- [ ] 3.1 Delete `package/server/src/script/repair-post-translations.ts` and remove `repair:post-translations` from `package/server/package.json`.
- [ ] 3.2 Delete `package/server/src/script/repair-content-doc-descriptions.ts` and its package script; if no other caller remains, also delete `package/server/src/content-doc/repair-rich-description.ts` and its test.
- [ ] 3.3 Remove or rewrite tests that only assert legacy migration/repair behavior for post content or legacy post replies where the current schema no longer carries those fields.
- [ ] 3.4 Rewrite search-index tests in `package/search/src/post.test.ts` so they no longer seed legacy `Post.content` or `extra.title` fallback rows.

## 4. Verification

- [ ] 4.1 Run focused post/chapter/contract tests covering `PostDTO.content`, chapter content mapping, and `PostExtra` schema.
- [ ] 4.2 Run factory/seed tests that exercise post, chapter, wiki, realm tag context, and scenario seed output.
- [ ] 4.3 Run a fresh reset + factory seed locally, then verify `/post/list` returns body-bearing posts with non-null `content`.
- [ ] 4.4 Run `bun run check:convention` and relevant format checks after code changes.

## Out of scope

This plan does not preserve existing local database content, add a compatibility
read fallback from `Post.content`, or maintain repair scripts for old seeded
databases. It also does not redesign comment topology, moderation, reactions, or
search ranking beyond making fresh seed data write the current content model.
It does not rename conceptual authority/editor paths like `post.content`, and it
does not remove intentional projection/cache tables or counters such as
`ContentStructureAnchor`, `SeriesContentIndex`, `replyCount`, `memberCount`,
`voteCount`, or `subscriberCount`.
