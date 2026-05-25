## 1. Shared Edit Console Layout

- [ ] 1.1 Create a shared edit console layout module in `package/app/src/core` or another existing app-level layout boundary, with props for `returnItem`, `primaryItems`, `operationalItems`, `contextSlot`, and routed children.
- [ ] 1.2 Define reusable edit console navigation item types that can be provided by Book now and future Game/Wiki/Post editors later.
- [ ] 1.3 Render the sidebar groups in the required order: return action, primary edit navigation, optional operational navigation, divider, optional lower context slot.
- [ ] 1.4 Preserve the existing app header, responsive sidebar behavior, active route styling, keyboard focus behavior, and localized text handling.
- [ ] 1.5 Keep the layout free of hardcoded `UnitType`, `PostKind`, and Book-specific label switches.

## 2. Book Edit Migration

- [ ] 2.1 Replace `BookEditLayout` composition with the shared edit console layout while preserving `/book/:bookId/edit...` route URLs.
- [ ] 2.2 Move Book sidebar navigation construction out of the Book-only layout shape into a Book edit console configuration factory.
- [ ] 2.3 Preserve Book primary entries for book details, tags, and chapters.
- [ ] 2.4 Preserve Book operational entries for authority and history.
- [ ] 2.5 Add a chapter edit context renderer for `/book/:bookId/edit/:chapterId` that appears below the sidebar divider without replacing Book-level navigation.
- [ ] 2.6 Ensure non-chapter Book edit routes render no lower context content and do not reserve empty sidebar height.

## 3. Book History Route Cleanup

- [ ] 3.1 Restructure Book edit history routes so `/book/:bookId/edit/history` is a parent route with an outlet.
- [ ] 3.2 Move the history timeline to the Book edit history index child route.
- [ ] 3.3 Keep revision detail at `/book/:bookId/edit/history/:sequence` and ensure it renders through the history parent outlet.
- [ ] 3.4 Keep compare at `/book/:bookId/edit/history/compare/:targetSequence` and ensure it renders through the history parent outlet.
- [ ] 3.5 Remove the non-edit Book history route files under `_mainLayout/book/$bookId/history`.
- [ ] 3.6 Update all internal links and navigation calls that target `/book/:bookId/history...` to use `/book/:bookId/edit/history...`.
- [ ] 3.7 Regenerate or update TanStack Router generated route metadata after route file changes.

## 4. Sidebar Overflow Fix

- [ ] 4.1 Remove the unconditional sidebar `overflow-auto` behavior that creates a scrollbar when no lower context content exists.
- [ ] 4.2 Make the lower context slot render only when content is provided.
- [ ] 4.3 Bound lower context scrolling with `min-h-0` and an internal overflow container when content exceeds available sidebar space.
- [ ] 4.4 Verify desktop inline sidebar and mobile fixed drawer behavior remain usable after the overflow change.

## 5. Localization, Tests, And Validation

- [ ] 5.1 Add or adjust i18n keys for shared edit console labels and per-surface return labels where Book-only labels are no longer sufficient.
- [ ] 5.2 Add focused tests or stories proving Book edit uses the shared edit console layout and preserves active navigation states.
- [ ] 5.3 Add a focused test or story for chapter edit showing Book navigation above the divider and current chapter context below it.
- [ ] 5.4 Add a focused route/rendering test or equivalent coverage for Book history compare and revision detail rendering under the edit history outlet.
- [ ] 5.5 Add a focused assertion or story coverage for the sidebar empty-context overflow bug.
- [ ] 5.6 Run targeted app tests for changed layout, navigation, and history modules.
- [ ] 5.7 Run `bun run check:convention` for route/link and project convention coverage.
- [ ] 5.8 Run `openspec validate generalize-edit-console-layout --strict`.
