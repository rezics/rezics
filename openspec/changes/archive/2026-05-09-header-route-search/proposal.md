## Why

The main app header currently has a larger fixed height than desired and only
renders search on the desktop home page. Search is becoming a persistent
navigation affordance, but full scoped/federated search is a larger project and
has been captured separately in `openspec/plans/search-scope-indexing-plan.md`.

This change narrows the first header step to route-aware presentation:

- desktop header height becomes 56px
- mobile header height becomes 49px
- desktop gets a persistent basic search entry
- mobile home keeps the existing page-level search input and omits the header
  search icon
- other mobile pages show a compact search icon
- realm/user desktop contexts render scoped-looking badges without promising the
  future federated search semantics

## What Changes

- Replace the header's current implicit 64px height with explicit responsive
  header heights and matching main content offset.
- Add a header-owned search entry component that can render:
  - a full desktop search input
  - a mobile icon button
  - optional scope badge for realm/user routes
- Keep the current mobile home search box in the page body.
- Use basic/general search navigation for non-realm and non-user pages.
- For now, avoid implementing book/realm/user scoped result semantics. Those
  remain future work.

## Impact

- Affected package: `@rezics/app`
- Affected UI:
  - main layout header
  - home page mobile search behavior
  - desktop search entry presentation
- No backend/API/indexing changes.
