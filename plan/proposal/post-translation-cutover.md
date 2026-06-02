---
title: Post Translation Cutover
status: active
created: 2026-06-02
completed:
supersededBy:
tags: [post, unit, content-translation, pinboard, wiki]
---

## Why

Root posts currently behave like comments in several read/write paths: `Post.content`
is treated as the body fast path, review titles are stored in `Post.extra.title`,
and `PostCard` renders body content without a title. That breaks Unit-first
surfaces such as the realm pinboard, which resolve display metadata from
`UnitTranslation` and therefore show POST units as untitled when no
`UnitTranslation.title` exists.

Cut root posts over to the same multilingual anchor model used by other
first-class units: `UnitTranslation` owns post display metadata (`title`,
`subtitle`, `summary`) and `ContentTranslation` owns post body content. Root post
detail, feeds, pinboard cards, review/remark pages, wiki editing, drafts, search,
and activity should all read the same resolved title/body for the active
language, falling back through the unit default language.

## Durable constraints & decisions

- (type) Root post create/update requires an explicit language and writes
  `Unit.defaultLanguage`, `Unit.supportLanguages`, `UnitTranslation.title`, and
  `ContentTranslation.content` for that language.
- (type) `PostDTO` exposes a resolved `title` and resolved `content`; the source
  is `UnitTranslation` plus `ContentTranslation`, not `Post.extra.title` or
  `Post.content`.
- (test) Language resolution falls back from requested language to
  `Unit.defaultLanguage`, then to the primary/first available support language,
  so Unit-first cards and post detail agree on title/body.
- (test) `Post.extra.title` is repair-only migration input. New review/remark/wiki
  and realm post writes must not store fresh titles there, and normal read paths
  must not depend on it after repair.
- (test) Root post UI renders a title; comment/reply UI remains titleless.
- (comment) `Post.content` is repair-only migration input during this internal
  development cutover. Do not keep old-reader writes or mapper fallbacks for
  compatibility; after repair, root post body reads come from
  `ContentTranslation`.
- (test) Every root post kind, including ordinary realm posts, reviews, remarks,
  excerpts, chapters, and wiki posts, supports full multilingual title/body
  editing through the same UnitTranslation + ContentTranslation model. Wiki is
  not a separate storage model.
- (test) Draft/publish state keeps `ContentTranslation.status` in sync with the
  owning `Unit.status` for post-owned content translations.

## 1. Contract and API Shape

- [x] 1.1 Update `package/contract/src/post/post.ts` so post create/update
  carries language-aware title/body translation input for all root post kinds
  instead of relying on `extra.title` or bare `Post.content`.
- [x] 1.2 Add resolved `title` to `PostDTO` and clarify `content` as the resolved
  body content for the selected/default language.
- [x] 1.3 Update `package/api/src/post/post.types.ts`,
  `package/api/src/post/post.api.ts`, and post mutation helpers to send the new
  shape without a legacy compatibility wrapper.
- [x] 1.4 Add or adjust contract/API tests for post create/update payloads,
  resolved title, required language, and repair-only `extra.title` rejection.

## 2. Server Write Path

- [x] 2.1 Update `package/server/src/post/post.service.ts` create to write
  `Unit.defaultLanguage`, `supportLanguages`, `UnitTranslation.title`, and
  `ContentTranslation.content/status` for every root post kind without writing a
  compatibility body to `Post.content`.
- [x] 2.2 Update post edit paths so title edits write `UnitTranslation` and body
  edits write `ContentTranslation`; preserve wiki collaborative authority checks
  for `post.content.*` equivalent body paths.
- [x] 2.3 Remove new writes to `Post.extra.title`; treat existing values only as
  migration fallback input.
- [x] 2.4 Keep draft/publish transitions syncing `ContentTranslation.status` for
  all post kinds that support drafts, not only wiki.
- [x] 2.5 Add server tests for create, update, publish, language fallback, and
  repair-only migration behavior with no normal legacy read fallback.

## 3. Server Read and Mapping

- [x] 3.1 Extend post include/query helpers to load Unit translations and
  ContentTranslation rows needed for resolved-language mapping.
- [x] 3.2 Update `package/server/src/post/post.mapper.ts` to resolve `title` from
  `UnitTranslation` and `content` from `ContentTranslation` without falling back
  to `extra.title` / `Post.content`.
- [x] 3.3 Update draft, activity, search sync, account data, and other post title
  readers to use Unit translations rather than `Post.extra.title`.
- [ ] 3.4 Add mapper/search/draft/activity tests so root post title/body
  resolution stays consistent across surfaces and does not read legacy storage.

## 4. Frontend UI Cutover

- [x] 4.1 Update root post cards/detail pages to render the resolved post title
  above body content.
- [x] 4.2 Keep comment/reply components titleless and ensure shared post/comment
  components do not erase the model boundary.
- [x] 4.3 Update ordinary realm post, review, remark, excerpt, chapter, and wiki
  create/edit forms to write title/body through the new post translation input,
  not `extra.title` or `Post.content`.
- [ ] 4.4 Add a shared root-post translation editor surface for managing all
  available languages, usable by wiki and non-wiki post kinds alike.
- [x] 4.5 Update pinboard/admin display only as needed after the data cutover;
  it should continue to work through Unit detail translations rather than
  learning post-specific title rules.
- [ ] 4.6 Update frontend tests/stories for root post title rendering and
  titleless comments.

## 5. Migration and Cleanup

- [x] 5.1 Add a server-side data repair/migration path that copies existing
  `Post.extra.title` into `UnitTranslation.title` and existing `Post.content`
  into `ContentTranslation.content` using the unit default/support language.
- [x] 5.2 Remove the `Post.content` compatibility dependency after repair; if the
  column remains temporarily nullable, code must not use it for normal root-post
  reads or writes.
- [x] 5.3 Remove legacy `extra.title` and `Post.content` readers after the repair
  path is covered.
- [x] 5.4 Run focused tests plus repo convention checks that cover contract,
  server post/content translation, and app post/review/wiki surfaces.

## Out of scope

- Comment/reply multilingual body support.
- Changing pinboard storage; it remains an ordered list of Unit IDs.
- Reworking post promotion/pinning semantics inside thread comments.
