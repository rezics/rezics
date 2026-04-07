# Book Edit Interface Overhaul

## Problem

The book editing interface (`@package/app/src/book-edit/`) has several UX and architecture issues:

1. **Shared component complexity** — `ChapterArborist` serves both reader and editor via boolean prop explosion (`isEditable`, `isDraggable`, `enableDoubleClickRename`, `showUpdateButton`, `readingMode`)
2. **Redundant chapter trees** — Sidebar renders a read-mode chapter list, edit page renders another with edit controls. Duplicate instances of the same data.
3. **Poor information density** — Chapter list page uses 1/3+2/3 grid, wasting space. Metadata page uses MUI outlined fields that look unattractive.
4. **Bad editing UX** — Toggle switches to enable drag/rename (should be default in editor), alert banner explaining how to use the UI, height slider for tree, multi-step chapter creation flow.
5. **Context menu** — Raw HTML `<ul>` with fixed positioning, no animation, no dark mode, can go off-screen.

## Solution

1. **Remove chapter sidebar** from `BookEditLayout` — only keep nav links
2. **Create dedicated `ChapterTreeEditor`** — editor-only component, independent from reader, centered/narrower layout
3. **Redesign metadata page** — replace MUI with shadcn components, card-based sections
4. **Add Radix ContextMenu** — animated, accessible, dark-mode-aware
5. **One-click chapter creation** — insert at last non-leaf node, auto-rename
6. **Mock word count display** — per-chapter stats in the tree

## Scope

- `package/app/src/book-edit/` — primary changes
- `package/app/src/book-library/component/Chapter/` — simplify to reader-only
- `package/ui/src/shadcn/` — add context-menu component
- Retain JSON editor for chapter list (as secondary tab or option)
