## 1. Content Structure Identity Cutover

- [x] 1.1 Replace reader/editor-facing `chapterUnitId` progress payloads with `contentUnitId`; keep legacy parsing only as documented compatibility.
- [x] 1.2 Rename local reader/editor variables that carry materialized content Unit identity from `chapterId` / `chapterUnitId` to `contentUnitId` where they are not route-compatibility names.
- [x] 1.3 Audit public contract exports for `BookContentStructure` and `chapterUnitId`; either remove them from new call sites or document each remaining name as transitional compatibility.
- [x] 1.4 Add contract and app tests for saving progress with `contentUnitId` and for legacy `chapterUnitId` read compatibility.

## 2. Releases Tab And Language Flow

- [x] 2.1 Add a first-class book detail Releases tab/route.
- [x] 2.2 Move same-work release listing, position ordering, display policy treatment, and multi-select language filtering into the Releases tab.
- [x] 2.3 Change missing-language affordances to navigate to the Releases tab, not the overview/info page hash.
- [x] 2.4 Default the Releases tab language filter from viewer preferences when available, with an All option.
- [x] 2.5 Add route/component tests for the missing-language navigation and Releases tab filtering/order behavior.

## 3. Work-Domain Community Surfaces

- [x] 3.1 Update review tab previews and hero review/stat/count queries to use a work-domain feed when the current release has `UnitWork(role = RELEASE)` membership.
- [x] 3.2 Preserve exact-release review/post filtering where the UI explicitly chooses "this release".
- [x] 3.3 Render target release context on work-domain review/post cards when the precise `targetUnitId` differs from the current release.
- [x] 3.4 Add app/API tests covering default work-domain reviews and exact-release filtering.

## 4. Hidden Work Public Navigation

- [x] 4.1 Audit app navigation that uses `workUnitId` as a public route param.
- [x] 4.2 Replace hidden-work destinations with visible release destinations selected from grouped search metadata, primary release membership, or collapsed alternatives.
- [x] 4.3 Add regression tests so public search/home/result cards do not navigate ordinary users to hidden work Units.

## 5. Canonical UnitWork Reads

- [x] 5.1 Replace remaining release/work sibling lookup call sites that use only `BookDTO.workUnitId` with canonical `workMembership.workUnitId` fallback logic.
- [x] 5.2 Update general Unit list filtering that claims work-domain semantics to read through `UnitWork` instead of direct `Unit.workUnitId`.
- [x] 5.3 Verify work-link migration compatibility paths still keep `Unit.workUnitId` synchronized but do not become the canonical read path.

## 6. Verification

- [x] 6.1 Run targeted contract tests for progress/content-structure compatibility.
- [x] 6.2 Run targeted server tests for UnitWork canonical reads and work-domain post/review feeds.
- [x] 6.3 Run targeted app tests for Releases tab, language missing flow, review/hero community previews, and hidden-work navigation.
- [x] 6.4 Run `openspec validate finish-unit-work-domain-archive-gaps --strict`.
