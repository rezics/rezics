## Why

Search results and profile overview surfaces currently use several local row and
border recipes even though Rezics now has a canonical Card primitive and app-level
search card components. This creates inconsistent hover behavior, duplicated
layout rules, and token drift in high-traffic content surfaces.

This change aligns search results and user profile content previews with the new
card surface vocabulary before more result types and profile sections build on
the older recipes.

## What Changes

- Refactor federated search result rendering to use the app card components under
  `package/app/src/components/card`.
- Refactor legacy content search result fallback rendering to use the same card
  surface language.
- Keep `@rezics/ui/shadcn` Card as the only primitive source; do not change the
  UI package Card API for this work.
- Refactor profile overview pinned items, recent activity, and stats surfaces to
  use Card/token-aligned patterns instead of ad hoc borders and raw gray classes.
- Clean `ProfileBasicInfo` stat/action styling so it follows Rezics design
  tokens and the same profile card vocabulary.
- Add or update app Storybook coverage for search result cards and profile card
  surfaces.
- No breaking route, API, contract, or database changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `app-search-feature`: Search result rendering SHALL use the canonical app card
  components backed by `@rezics/ui/shadcn` Card surfaces instead of local row
  border recipes.
- `profile-overview`: Profile overview and sidebar stats surfaces SHALL use
  Card/token-aligned patterns for pinned items, recent activity, and stats.

## Impact

- Affected packages:
  - `package/app`: search result components, profile components/pages, Storybook
    docs/stories.
  - `package/ui`: no source changes expected; existing Card docs may be used as
    reference only.
- Existing routes and query contracts remain backward compatible.
- Existing `SearchContentResultCard` and `SearchLibraryUnitCard` consumers keep
  their public prop API unless a small additive prop is needed for profile/search
  reuse.
- No data migration is needed.
- Implementation should remove unnecessary container/show encapsulation when
  replacing old row wrappers with card components.
