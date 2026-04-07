# Tasks: Book Edit Overhaul

## Phase 1: Foundation

- [x] Add `@radix-ui/react-context-menu` dependency to `package/ui`
- [x] Create shadcn `ContextMenu` component in `package/ui/src/shadcn/context-menu.tsx`
- [x] Add shadcn `Collapsible` component in `package/ui/src/shadcn/collapsible.tsx` (for Extra section)

## Phase 2: Chapter Tree Editor

- [x] Create `ChapterTreeEditorNode` in `book-edit/component/` — node renderer with always-visible drag handle, word count display, inline rename
- [x] Create `ChapterTreeContextMenu` in `book-edit/component/` — Radix ContextMenu with rename, new child, new sibling, move first/last, delete actions
- [x] Create `ChapterTreeEditorToolbar` in `book-edit/component/` — search input, expand/collapse, one-click new chapter button
- [x] Create `ChapterTreeEditor` in `book-edit/component/` — main editor component wrapping react-arborist with mock word count, toolbar, footer stats
- [x] Rewrite `ChapterListPage` — centered max-w-2xl layout, toolbar + tree + footer, JSON editor as tab, remove height slider and alert banner

## Phase 3: Layout Cleanup

- [x] Simplify `BookEditLayout` — remove `LinearChapterList` from sidebar, keep nav only
- [x] Simplify `ChapterArborist` in `book-library/` — strip edit-mode props and code, reader-only
- [x] Simplify `ChapterArboristNode` — remove edit-mode branches (drag handle, context menu, rename)
- [x] Delete `ChapterArboristContextMenu` and `LinearChapterListEdit` (replaced by new components)

## Phase 4: Metadata Page

- [x] Rewrite `BookMetadataEditor` — shadcn Input/Label/Checkbox/Tooltip, card-based layout
- [x] Rewrite `BookExtraEditor` — shadcn components, collapsible section
- [x] Update `BookEditInfoSection` — card-based sections, shadcn buttons, max-w-3xl centering

## Phase 5: Exports & Cleanup

- [x] Update `book-edit/index.ts` exports for new/renamed components
- [x] Verify all routes still work (info, chapter, chapter/:id, tag pages)
