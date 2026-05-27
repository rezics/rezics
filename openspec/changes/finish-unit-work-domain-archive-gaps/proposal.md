## Why

`introduce-unit-work-domain` was archived with all tasks checked, but a code
audit shows several requirements are only partially implemented. The remaining
gaps are mostly public/API surface cutovers and product path integration: legacy
chapter terminology still appears in reader/editor contracts, release discovery
is embedded as an info-page section instead of a Releases tab, some public
surfaces still query exact release targets where work-domain aggregation is
required, and some navigation still routes users to hidden work Units.

The archived specs are now part of the baseline, so this change finishes the
missed implementation work without reopening the archived change.

## What Changes

- Complete the content-structure terminology cutover for reader/editor-facing
  DTOs and app paths by replacing remaining public `chapterId` /
  `chapterUnitId` identity usage with `contentUnitId`, while documenting any
  intentionally retained route compatibility.
- Add a first-class Releases tab/route for same-work release discovery instead
  of using the overview/info page hash as the target.
- Ensure review, hero, and other release community surfaces use work-domain
  feeds by default when `UnitWork` release membership exists, with exact-release
  filtering available where the UI exposes it.
- Remove public navigation that sends ordinary users to hidden work Unit ids;
  public destinations must resolve to visible release Units.
- Replace remaining sibling-release selectors that read only legacy
  `BookDTO.workUnitId` with canonical `workMembership.workUnitId` fallback
  logic.
- Tighten API/service reads that still filter by `Unit.workUnitId` when the
  requirement says canonical reads should use `UnitWork`.

## Evidence From Audit

- `package/contract/src/progress.ts` still defines `kind: "chapter"` with a
  required `chapterUnitId`, and `BookReadChapterSection` writes that legacy
  shape when saving materialized chapter progress.
- Reader/editor routes and components still expose `$chapterId` as the
  materialized content Unit identity, including
  `package/app/src/routes/book_/$bookId/read/$chapterId/route.tsx` and
  `package/app/src/book-edit/pages/ChapterPage.tsx`.
- `BookDetailShell` has tabs for info/review/content/discussion/history only;
  the missing-language affordance navigates to `/book/$bookId/info#releases`
  instead of a Releases tab.
- `BookReviewPage`, `BookHeroSection`, `BookHeroCountLinks`, and
  `BookHeroStatCards` still query `postQueries.byTarget(bookId, REVIEW)` rather
  than a work-domain feed when the current release has work membership.
- `TrendingExcerptSection` navigates to `/excerpt/book/$bookId` using
  `first.workUnitId`, which can be a hidden work Unit.
- `AddTranslationDialog` and `SetSourceReleaseControl` choose sibling releases
  from `book.workUnitId` and do not use the canonical `workMembership` helper.
- `unit.service.ts` still filters general Unit reads through `Unit.workUnitId`
  directly.

## Impact

- Affected packages:
  - `package/contract`: progress/content-structure DTO compatibility shape.
  - `package/api`: query options and clients where work-domain feeds or
    canonical release membership are needed.
  - `package/server`: Unit listing/read paths that still use direct
    `Unit.workUnitId` semantics.
  - `package/app`: book detail tabs, language missing flow, review/hero
    community previews, reader/editor content identity naming, release sibling
    selectors, and public navigation from search/home cards.
- This change does not introduce a new domain model; it finishes the archived
  `UnitWork` and `contentStructure` cutover.
