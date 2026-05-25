## Why

Book editing currently owns a private sidebar layout even though the same edit
console pattern is needed by future library Unit types such as Game, Media,
Wiki posts, and other Unit-backed editors. The current book history migration
also left duplicate non-edit history routes and a nested compare route that
does not render because the history parent route has no child outlet.

This change introduces a reusable edit console layout contract so Book can move
off a one-off layout now, while future library editors can adopt the same
navigation, operation, and context model without re-solving the sidebar.

## What Changes

- Introduce a generic edit console layout for Unit-backed edit surfaces in
  `package/app`.
- Replace the book-specific edit sidebar composition with configuration passed
  into the generic edit console layout.
- Preserve Book edit as the first concrete implementation while defining the
  extension shape for future Game, Media, Wiki post, and Post editors.
- Model chapter editing as context within the Book edit console rather than as a
  separate edit console. Chapter content remains represented by `Unit(type=POST)`
  plus `Post.kind=CHAPTER`.
- Add an explicit context area below the edit console divider for route-local
  context such as the currently edited chapter.
- Gate authority and history navigation by surface capability. Library Unit and
  Wiki-capable surfaces may expose authority and history; simple editors may
  expose only a return action and primary edit navigation.
- **BREAKING**: Remove direct non-edit Book history routes such as
  `/book/:bookId/history`, `/book/:bookId/history/:sequence`, and
  `/book/:bookId/history/compare/:targetSequence`. Book history is reached only
  through the edit console route family.
- Fix Book edit history nested routes so revision detail and compare pages render
  through a route outlet under `/book/:bookId/edit/history`.
- Fix the edit console sidebar overflow behavior so an empty lower context area
  does not create a permanent scrollbar.

## Capabilities

### New Capabilities

- `edit-console-layout`: Defines the reusable app-side edit console layout
  contract, including return action, primary navigation, operational navigation,
  context slot, route ownership, and surface capability rules.

### Modified Capabilities

- `edit-console-navigation`: Generalizes the existing Book edit sidebar
  navigation requirements so they apply through the reusable edit console layout
  rather than a Book-only layout.
- `history-product-ui`: Removes the legacy non-edit Book history route option
  and requires Book history detail and compare routes to render inside the edit
  console route family.

## Impact

- Affected packages:
  - `package/app`: New shared edit console layout, Book edit layout migration,
    Book edit navigation configuration, Book history route restructuring,
    sidebar overflow fix, and focused tests/stories.
  - `package/i18n`: Shared edit console labels and per-surface return labels
    where existing Book-only labels are not sufficient.
  - `package/ui`: No new primitive is expected. Existing tokens, lucide icons,
    and app sidebar primitives should be reused unless implementation discovers
    a reusable component belongs in `@rezics/ui`.
- API and backend impact:
  - No contract, server, Prisma, or API behavior changes are expected.
  - Authority and history visibility continue to follow existing server-side
    permission and history contracts.
- Dependencies:
  - No new runtime dependencies are expected.
- Backward compatibility and migration:
  - Book edit URLs under `/book/:bookId/edit...` remain canonical.
  - Direct `/book/:bookId/history...` URLs are intentionally removed rather than
    retained as aliases or redirects.
  - Internal app links that still target non-edit Book history routes must be
    migrated in the same change.
  - The implementation should remove obsolete Book-only wrapper/container code
    where the generic edit console layout fully replaces it.
