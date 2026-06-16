---
title: Zone Dynamic Tag Filters
status: done
created: 2026-06-14
completed: 2026-06-14
supersededBy:
tags: [zone, frontend, contract, api]
---

## Why

Zone query sections need a way to vary their topic without becoming new section
kinds or relying on cross-section result dedupe. A books zone should be able to
keep a stable "latest books" rail, then render several topic-varied rails by
randomly choosing from weighted tag filters, followed by a global hot feed.

The durable behavior is a query-section modifier: editors configure weighted tag
rows, optional page-local group coordination prevents the same selected tag set
from repeating across sections in one page visit, and the chosen tag filter is
sent as a transient query override when loading section data.

## Durable constraints & decisions

- `(type)` `dynamicTags` is an optional property on `query` sections, not a new
  zone section kind. It stores canonical `tagUnitIds`, probabilities, optional
  `groupId`, and fallback enablement.
- `(type)` Dynamic tag options have no option id. Repetition is determined by the
  normalized selected tag set, using sorted canonical `tagUnitIds`.
- `(test)` Submitting zone management changes must require total probability to
  resolve to `1`: without fallback, configured rows sum to `1`; with fallback,
  configured rows must sum to `<= 1` and the readonly fallback row contributes
  `1 - sum`. Sum greater than `1` is invalid even with fallback.
- `(test)` The editor may accept pasted tag unit ids, pasted tag slugs, and search
  picker additions, but saved section config must use canonical tag unit ids.
- `(test)` `tagUnitIds` inside one dynamic option are AND semantics. OR semantics
  are represented as multiple weighted rows.
- `(comment)` Frontend owns random selection and group coordination. The section
  data endpoint receives only the selected canonical tag unit ids as a temporary
  override; it does not pick random tags and does not mutate saved zone config.
- `(test)` A selected dynamic tag option stays stable for the current page visit,
  refetches, and load-more calls. Refreshing the page may select a different
  option.
- `(test)` Sections sharing a `dynamicTags.groupId` on the same page should avoid
  selecting the same normalized tag set until the group pool is exhausted; after
  exhaustion, fallback/repeat behavior may occur according to the configured
  fallback rules.
- `(test)` React Query keys for section data must include the selected dynamic
  tag unit ids so different selections do not share cached section pages.
- `(test)` Initial support is limited to `query.target === "unit"` because the
  existing zone query compiler only supports `tagUnitIds` on unit/content
  queries.

## Tasks

## 1. Contract and Validation Shape

- [x] 1.1 Extend `package/contract/src/zone/section.ts` with
  `zoneDynamicTagsSchema`, weighted option schema, and optional `dynamicTags` on
  `zoneQuerySectionSchema`.
- [x] 1.2 Add contract tests in `package/contract/src/zone/section.test.ts` for
  valid dynamic tags, invalid probability shape, and query-section-only
  placement.
- [x] 1.3 Update `package/app/src/zone/models/zoneManageDraft.ts` validation so
  dynamic tags are only accepted for unit query sections and probability totals
  obey the fallback rules.
- [x] 1.4 Add draft validation tests in
  `package/app/src/zone/models/zoneManageDraft.test.ts` for sum-to-one,
  fallback-derived probability, over-1 rejection, and unit-target restriction.

## 2. Dynamic Selection Runtime

- [x] 2.1 Add a zone page dynamic-tag selection helper under
  `package/app/src/zone/models/` that performs weighted selection, normalizes tag
  sets by sorted unit ids, and coordinates non-repeating selections by
  `groupId`.
- [x] 2.2 Thread a page-visit seed or memoized selection context through
  `package/app/src/zone/pages/ZonePortalPage.tsx`,
  `package/app/src/zone/components/sections/ZoneSectionList.tsx`, and nested
  section renderers so selections are ordered by page section position, not by
  async request completion.
- [x] 2.3 Update `package/app/src/zone/components/sections/QuerySection.tsx` to
  resolve the selected dynamic tag option and pass its canonical tag unit ids to
  the section data query.
- [x] 2.4 Add runtime tests for stable selection within a page visit, group
  non-repetition before exhaustion, fallback/no-tag selection, and deterministic
  behavior for a fixed seed.

## 3. Section Data Query Override

- [x] 3.1 Extend `package/api/src/zone/zone.api.ts`,
  `package/api/src/zone/zone.queries.ts`, and
  `package/api/src/zone/zone.keys.ts` so section data requests can include
  selected dynamic tag unit ids and cache keys include them.
- [x] 3.2 Extend `package/server/src/zone/zone.api.ts` to accept selected
  dynamic tag unit ids on the section data endpoint.
- [x] 3.3 Update `package/server/src/zone/zone.service.ts` so query sections
  apply selected dynamic tag unit ids as an additional temporary tag filter when
  executing the saved base query.
- [x] 3.4 Add API/service tests covering the transient override, cache-key
  separation, and no mutation of saved section config.

## 4. Zone Management UX

- [x] 4.1 Add a dynamic tag editor component under
  `package/app/src/zone/components/manage/` with rows shaped as
  "tag labels : probability", whole-row remove, readonly fallback row, and a
  `groupId` input.
- [x] 4.2 Integrate the dynamic tag editor into
  `package/app/src/zone/components/manage/ZoneQueryEditor.tsx` only when the
  query target supports `tagUnitIds`.
- [x] 4.3 Support tag entry by pasted unit id arrays, pasted slug arrays, and
  search-picker additions; resolve all inputs to canonical `tagUnitIds` before
  save.
- [x] 4.4 Add or reuse i18n keys under `package/i18n/locales/*/zone.json` for
  dynamic tag labels, probability validation, fallback display, and group id.
- [x] 4.5 Add focused component/model tests for row removal, fallback probability
  display, invalid probability states, and canonicalization from slugs/search.

## 5. Books Zone Configuration Path

- [x] 5.1 Update the seed/factory path that creates official zone pages so the
  books zone can express: latest books carousel, three dynamic topic carousels,
  and global hot feed.
- [x] 5.2 Add factory/scenario tests proving the generated books zone uses query
  sections with `dynamicTags`, not bespoke section kinds.

## Out of scope

- Cross-section result item dedupe.
- A unified section-list proxy API.
- Server-side random tag selection.
- URL-stable/shareable random seeds.
- Dynamic tag support for post, realm, or zone query targets.
