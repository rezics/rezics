## Context

The work/release model is release-first: users collect, review, remark on, and
read visible release Units, while hidden work Units group sibling releases and
drive inherited discovery and community aggregation through `UnitWork`.

The current codebase has already adopted this split in some places:

- Post list/search APIs expose exact `targetUnitId` and work-domain
  `workUnitId`/`workRoles`.
- Book detail review previews use `workUnitId` when available.
- Series list APIs distinguish `containsReleaseUnitId` from
  `relatedWorkUnitId`.

Other surfaces still blur the split:

- Shelf list `containsUnitId` currently behaves partly like exact containment
  and partly like work-domain lookup.
- Book-scoped federated search maps book scope to exact release filters
  (`containedUnitIds`, `rootTargetUnitId`) without a work-domain option.
- Full review, remark, and excerpt pages reached from release routes can query
  exact release data even when their preview surfaces use work-domain data.

## Goals / Non-Goals

**Goals:**

- Establish one naming rule across list/search APIs: Unit id filters are exact;
  Work id filters are work-domain.
- Make shelf work-domain lookup explicit with `containsWorkUnitId`.
- Align app list/search surfaces so previews and full pages use the same scope
  by default.
- Preserve exact-release modes for users who need to inspect one release only.
- Keep implementation compatible with existing `UnitWork` projection and
  release-first shelf storage.

**Non-Goals:**

- Do not change how releases are stored in shelves; shelves continue storing
  visible release Unit ids.
- Do not introduce a generic UnitEdge or new work/release data model.
- Do not redesign rating storage. Ratings remain release-based.
- Do not add hidden work pages as ordinary public catalog destinations.

## Decisions

### D1. Unit filters stay exact

`containsUnitId`, `targetUnitId`, `rootTargetUnitId`, and similarly named
filters SHALL keep exact Unit semantics. They SHALL NOT silently expand a
release to sibling releases.

Alternative considered: change `containsUnitId` to accept a hidden work Unit id.
Rejected because it would make a containment filter query a membership
projection and conflict with the shelf requirement that shelves store visible
release Units by default.

### D2. Work-domain filters are explicit

Shelf list gains `containsWorkUnitId`. Post and post-search keep existing
`workUnitId`/`workRoles`. Federated book scope gains an explicit way to choose
or derive work-domain matching for release-aware scopes.

Alternative considered: add dedicated endpoints such as
`/shelf/work/:workUnitId/list`. Rejected for now because shelf list pagination,
sorting, owner filters, and matched-unit display are the same list capability.
A second endpoint would duplicate shape and cache behavior.

### D3. App release pages default to work-domain when available

For release-aware book pages, shelves/reviews/remarks/excerpts and scoped
search SHALL default to work-domain results when the current release has a
canonical work domain. Exact-release mode remains available where users need to
inspect one release.

Standalone Units with no work domain fall back to exact Unit queries.

### D4. Matched release display is preserved

Work-domain shelf and post results SHALL keep enough target metadata to show
which release caused a result to match. A shelf found through
`containsWorkUnitId` should be able to render the matched contained release,
not imply that the shelf directly contains the current route release.

### D5. Rating filters apply to matched visible releases

When a release-aware surface combines work-domain matching with rating filters,
the rating constraint applies to the visible release candidates that can match,
not to hidden work Units.

## Risks / Trade-offs

- [Risk] Existing internal callers may rely on `containsUnitId` work expansion.
  → Mitigation: clear-cutover all internal callsites and add contract/server
  tests that assert exact `containsUnitId` behavior.
- [Risk] Work-domain Meilisearch filters may require additional projected
  fields for shelf documents.
  → Mitigation: first prefer existing `UnitWork(role=SHELF)` server-side list
  queries for shelf lists; only extend content index projection where federated
  search requires index-side filtering.
- [Risk] Full pages can drift from previews again.
  → Mitigation: add shared app helpers for resolving release scope
  `{ exactUnitId | workUnitId }` from a BookDTO and use them in preview and full
  pages.
- [Risk] UI labels can become unclear.
  → Mitigation: release-aware toggles use localized labels for "All releases"
  and "This release"; exact work ids are never exposed as user-facing labels.

## Migration Plan

1. Extend contract schemas and tests with explicit exact/work-domain filters.
2. Update server services and Meilisearch/federated filter builders.
3. Update API helpers and query keys so exact and work-domain calls cache
   separately.
4. Update app surfaces from detail previews outward: counts, previews, full
   pages, then scoped search.
5. Run targeted contract/server/app tests, plus convention checks for changed
   packages.

Rollback is a development-stage source rollback. No persisted data migration is
needed because shelf membership and post target storage do not change.
