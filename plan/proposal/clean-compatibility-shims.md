---
title: Clean Compatibility Shims
status: done
created: 2026-06-01
completed: 2026-06-01
supersededBy:
tags: [cleanup, contract, server, app, history, tool, prisma]
---

## Why

Rezics is still in development, so internal compatibility shims should not shape
the codebase as if older imports, routes, payloads, commands, or database shapes
were public commitments. The intended outcome is a clean cutover to the current
model: contracts expose only current fields, services accept only current
storage shapes, tools expose only current commands, and tests lock the current
behavior instead of proving old behavior still works.

This cleanup must be precise. Normal product semantics named "fallback" or
"alias" are not compatibility debt: translation resolution, avatar/UI fallback
content, generic Unit route fallback behavior, source/entity aliases, UnitAlias
search, and content-structure restore fallback behavior remain valid product
features.

## Durable constraints & decisions

- (test) No test should assert acceptance of old-only compatibility fields such
  as `chapterUnitId`, history `slots`, `legacyChangedKeys`, old Post reply
  topology, legacy Game platform rows, or deprecated service command aliases.
- (type) `ChapterMaterializationResponse` has one materialized chapter identity:
  `contentUnitId`. `chapterUnitId` is removed from contract, server responses,
  API consumers, and tests.
- (type) History editorial revision payloads use `patch` only. Legacy `slots`
  and `legacyChangedKeys` are removed from contract and ingestion/read paths.
- (type) Game/media taxonomy storage uses platform Entity subject attributions
  and rating UnitTag rows only. `Game.ageRatingKey` and `GamePlatform` are
  removed from the Prisma schema and runtime/admin/seed code.
- (comment) The app may keep existing browser route parameter names when a
  rename would create unrelated router churn, but comments must describe the
  current identity (`contentUnitId`) rather than preserving "legacy" language.
- (test) Post promotion and comment behavior must exercise `Comment` rows only;
  `Post` is not a reply-tree compatibility source.
- (test) History outbox processing has one owner path: job-runner queue
  ingestion. The in-process fallback poller and `HISTORY_OUTBOX_POLLER_FALLBACK`
  are removed.
- (comment) Do not remove normal product semantics that happen to use words like
  fallback, alias, deprecated, or legacy in domain content. Source-site
  `deprecated` status, `UnitAlias`, locale fallback chains, UI avatar fallback,
  `/unit/:unitId` generic fallback, and content-structure restore
  `fallbackToRoot` are explicitly out of scope.

## Tasks

## 1. Tooling and convention cleanup

- [x] 1.1 Remove the Paraglide legacy import scanner from
  `tool/src/commands/convention/rules/i18n-invariants.ts` and update
  `tool/tests/check-convention-i18n.test.ts` so R11/R12 covers only current
  i18n invariants: no dynamic keys, no string fallback args, and no contract
  `i18nKey`.
- [x] 1.2 Delete deprecated service command wrappers
  `tool/src/commands/service/legacy.ts` and
  `tool/src/commands/service/sequin-legacy.ts`; remove any script/bin references
  to those files.
- [x] 1.3 Update tool/service docs if they mention old command aliases; keep
  only `bun run service ...` and `bun run tool/bin/service.ts ...` paths.

## 2. Chapter materialization cutover

- [x] 2.1 Remove `chapterUnitId` from
  `package/contract/src/book/chapter.ts` and update contract tests in
  `package/contract/src/book/book.test.ts` / chapter tests so materialized
  nodes and materialization responses use `contentUnitId`.
- [x] 2.2 Update `package/server/src/chapter/chapter.service.ts` and
  `package/server/src/chapter/chapter.materialization.test.ts` to return and
  assert `contentUnitId` only.
- [x] 2.3 Update frontend API/app consumers, especially
  `package/app/src/book-library/hooks/useEnsureChapterUnit.ts`,
  `package/app/src/book-edit/components/BookTocEditor.tsx`, and
  `package/app/src/book-edit/pages/ChapterPage.tsx`, so local variable names and
  comments use `contentUnitId` even if existing route params remain named
  `$chapterId`.
- [x] 2.4 Search all packages for `chapterUnitId` and remove every non-migration
  runtime/test reference.

## 3. Post/comment reply topology cleanup

- [x] 3.1 Remove the `legacyPostTarget` branch from
  `package/server/src/post/post.service.ts`; `loadPromotableTarget` should query
  `Comment` only.
- [x] 3.2 Update post/comment/governance tests that reference legacy Post reply
  topology so they assert current Comment-only behavior or delete tests that
  only protect removed compatibility.
- [x] 3.3 Leave historical Prisma migration files intact; do not rewrite applied
  migration history just to remove the word "legacy".

## 4. Game/media legacy taxonomy storage cleanup

- [x] 4.1 Add a new Prisma migration under `package/server/prisma/migrations/`
  that drops `Game.ageRatingKey` and the `GamePlatform` table after current
  platform/rating storage is the only runtime model.
- [x] 4.2 Update `package/server/prisma/schema.prisma` and generated Prisma
  client expectations so `Game` no longer exposes `ageRatingKey` or
  `platforms`.
- [x] 4.3 Remove `LEGACY_PLATFORM_MAP`, legacy rating map usage, and backfill
  helpers from `package/server/prisma/seed/infra/seed-game-media-taxonomy.ts`;
  update its tests to assert seeding platform Entities and rating Tags only.
- [x] 4.4 Remove legacy row counts, row samples, and mismatch candidates from
  `package/server/src/game-media-library/admin-readiness.ts` and its tests.
- [x] 4.5 Search `package/server`, `package/api`, `package/contract`,
  `package/admin`, `package/app`, and `package/search` for `ageRatingKey` and
  `GamePlatform`; remove all runtime/test references outside old migration SQL.

## 5. History payload and outbox cleanup

- [x] 5.1 Remove `legacyChangedKeys` from
  `package/contract/src/content/history.ts` and update contract/API tests for
  history payloads.
- [x] 5.2 Remove `LegacyEditorialRevisionPayload`, `slots` handling, and
  `legacyChangedKeys` path derivation from
  `package/history/src/revision/revision.service.ts`,
  `package/history/src/outbox/outbox-consumer.ts`, and their tests.
- [x] 5.3 Remove tests that assert legacy `book.contentStructure.batch` event
  readability; current structure events should use
  `contentStructure.content.batch`.
- [x] 5.4 Remove `HISTORY_OUTBOX_POLLER_FALLBACK` from
  `package/history/src/env.ts`, `package/history/src/outbox/startup.ts`, and
  `package/history/src/outbox/startup.test.ts`; delete the in-process fallback
  poller branch if it becomes unreachable.
- [x] 5.5 Update docs in `package/history/README.md`,
  `package/job-runner/docs/operations.md`, `docs/guide/content-authority-history.md`,
  `docs/reference/production-env-and-secrets.md`, and
  `docs/reference/production-runtime-inventory.md` so history ingestion is
  described as job-runner owned only.

## 6. Book content structure naming cleanup

- [x] 6.1 Remove "legacy wire shape" wording from
  `package/server/src/book/book.service.ts`; if a comment remains, it should
  explain the current book-to-generic content-structure adapter.
- [x] 6.2 Audit `BookContentStructureItem` / `BookContentStructureResponse`
  usage in `package/contract`, `package/api`, `package/app`, and
  `package/server`. Rename only where it improves current clarity without
  creating broad route churn; otherwise keep the wrapper as the book-domain
  adapter over generic `ContentStructure`.
- [x] 6.3 Keep normal content-structure restore semantics, including
  `fallbackToRoot`, because that is current product behavior rather than legacy
  compatibility.

## 7. Final cleanup pass and checks

- [x] 7.1 Run targeted `rg` scans for `legacy`, `deprecated`,
  `backward-compatible`, `temporary fallback`, `chapterUnitId`,
  `legacyChangedKeys`, `LegacyEditorialRevisionPayload`, `GamePlatform`,
  `ageRatingKey`, `HISTORY_OUTBOX_POLLER_FALLBACK`, `legacyParagilde`, and
  `sequin-legacy`; classify remaining hits as old migrations, normal product
  semantics, or cleanup misses.
- [x] 7.2 Run relevant focused tests for changed packages, then
  `bun run check:convention` and `bun run format:check`.
- [x] 7.3 Regenerate Prisma client for `@rezics/server` after schema changes and
  run impacted server/history/tool tests.
- [x] 7.4 Update this plan's completed tasks during apply. Set `status: done`
  only if all task-owned compatibility cleanup is complete or explicitly no
  longer applicable.

## Out of scope

- Rewriting old migration SQL solely to remove historical words like `legacy`.
- Removing current product fallbacks: locale resolution, UI/avatar fallback
  content, suspense/error fallbacks, content-structure restore `fallbackToRoot`,
  deterministic sort fallbacks, and route fallback behavior.
- Removing current alias features: `UnitAlias`, alias search projection,
  source-site/entity aliases, and search text containing private aliases.
- Removing source-site `deprecated` status or other domain states that are
  current product concepts.
- Browser route renames that are pure URL aesthetics and not required to remove
  compatibility behavior.
