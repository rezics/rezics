## Why

Release-aware content now has two valid query scopes: an exact visible release
and the hidden work domain that groups sibling releases. Several list and search
surfaces currently blur those scopes, so a user can see work-level previews on a
book page and then lose results after opening a full shelf, review, remark,
excerpt, or scoped search page.

This needs to be fixed before more release-first surfaces ship, because the
ambiguous parameter names (`containsUnitId`, `targetUnitId`, route `bookId`) are
already spreading across app, API, server, and search code.

## What Changes

- Make the naming rule explicit across list and search APIs:
  - `*UnitId`, `targetUnitId`, and `containsUnitId` mean exact Unit matching.
  - `*WorkUnitId`, `workUnitId`, and `containsWorkUnitId` mean work-domain matching through `UnitWork`.
- Change shelf list semantics so `containsUnitId` is exact shelf containment and
  `containsWorkUnitId` is the work-domain shelf list filter.
- Update release-aware shelf pages, preview counts, and cards to use the
  work-domain filter by default when the current release has a work domain, with
  an exact-release mode where the UI needs it.
- Align post/review/remark list and search surfaces so work-domain pages query
  `workUnitId` plus `workRoles`, while exact target pages continue to query
  `targetUnitId`.
- Define how book-scoped federated search chooses exact-release versus
  work-domain scope for shelves, reviews, remarks, excerpts, and posts.
- Audit series and excerpt/unit-list surfaces for the same naming rule,
  preserving already-clear parameters such as `containsReleaseUnitId` and
  `relatedWorkUnitId`.
- **BREAKING**: API callers relying on `shelf.list({ containsUnitId })` to
  include sibling-release shelves must switch to `containsWorkUnitId`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `shelf-collection`: Clarify exact shelf containment versus work-domain shelf
  lookup and add the `containsWorkUnitId` list filter.
- `content-search-api`: Clarify content and post search option naming for exact
  Unit scope versus work-domain scope.
- `federated-search`: Clarify book-scoped federated search behavior for exact
  release and work-domain matching.
- `post-search-index`: Require post search filters to preserve exact
  `targetUnitId` semantics and use `workUnitId`/`workRoles` for work-domain
  feeds.
- `review-remark-ux`: Align review and remark list pages with release-aware
  work-domain defaults.
- `series-content-index`: Confirm release-member and work-domain series filters
  remain separately named and define which app surfaces use each.

## Impact

- Affected packages:
  - `package/contract`: shelf list schemas, search option schemas, tests.
  - `package/api`: shelf, post, and search query helpers and query keys.
  - `package/server`: shelf list service, Meilisearch content/post/federated
    filter builders, related tests.
  - `package/search`: shelf content document projection if work-domain shelf
    filtering needs index fields beyond `UnitWork`-backed server queries.
  - `package/app`: book detail shelves/reviews/count links, shelf-by-book,
    review-by-book, remark-by-book, excerpt-by-book, and book-scoped search
    surfaces.
- No new infrastructure dependencies.
- Migration is a development-stage clear cutover: update internal callsites in
  the same change. No compatibility shim is required beyond precise schema and
  test failures for ambiguous payloads.
