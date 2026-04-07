# Design: Book Edit Overhaul

## Layout Changes

### BookEditLayout
- Remove `LinearChapterList` from sidebar
- Sidebar contains only navigation links
- Main content area gets more horizontal space

### Chapter List Page
- Centered: `max-w-2xl mx-auto`
- Toolbar: single row with search + expand/collapse + new chapter button
- Tree: fills available vertical space (`calc(100vh - offsets)`)
- Footer: aggregate stats + download JSON + save button
- JSON editor retained as tab

### Metadata Page (Info)
- Replace MUI components with shadcn (Input, Label, Checkbox, Card, Button, Tooltip)
- Card-based section grouping (Basic Info, Contributors, Description, Extra)
- Extra section collapsible (closed by default)
- `max-w-3xl mx-auto` for consistent centering

## Component Architecture

### New Components (in `book-edit/`)
- `ChapterTreeEditor` — editor-only wrapper around react-arborist (keeps library)
- `ChapterTreeEditorNode` — always shows drag handle + word count
- `ChapterTreeEditorToolbar` — search + action buttons
- `ChapterTreeContextMenu` — Radix ContextMenu with animations

### Simplified Components (in `book-library/`)
- `ChapterArborist` — stripped to reader-only (remove edit props)
- `ChapterArboristNode` — reader-only rendering

### Moved/Deleted
- `ChapterArboristContextMenu` — replaced by new `ChapterTreeContextMenu`
- `CreateChapterDialog` — moved to `book-edit/component/`

## Key Decisions

- **Keep react-arborist** with clean editor wrapper, not replace
- **shadcn for metadata** — Input/Label pattern instead of MUI TextField with floating labels
- **Word count** — mock with seeded random for now (based on node id hash)
- **Drag & rename always on** in editor — no toggle switches
- **Context menu** — Radix ContextMenu, same animation system as existing DropdownMenu
- **One-click new chapter** — appends to last non-leaf node, enters rename mode
- **UsersMultiSelect** — keep MUI Autocomplete for now (complex async multi-select), migrate later
