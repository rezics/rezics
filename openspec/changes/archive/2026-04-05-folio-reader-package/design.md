## Context

The REZICS platform stores book content as a tree of chapters (`ChapterTreeItem` in `@rezics/contract`) served by the Elysia API. The frontend (`@rezics/app`) manages chapter metadata, ordering, and editing via the `ChapterArborist` component (react-arborist). There is no reading experience — content consumption happens outside the platform.

`@rezics/editor` recently refactored its markdown preview into standalone utilities: `createNovelRenderer()`, `novelModePlugin`, `highlightCode`, and `addCopyButtons` — all importable from `@rezics/editor/markdown` without any CodeMirror dependency. This makes it viable as a rendering engine for a reader.

## Goals / Non-Goals

**Goals:**

- Deliver a self-contained reader package (`package/folio`) usable by `@rezics/app` and future consumers
- Provider-driven architecture: consumers supply the chapter tree and fetch logic, folio handles navigation and rendering
- Mobile-first paginated reading with smooth page-turn animations
- Extensible via typed renderer plugins with UI slot contributions
- Built-in support for txt (with regex split configuration) and epub content

**Non-Goals:**

- HTML source plugin (deferred)
- npm publishing (deferred until `@rezics/editor` is also publishable)
- Content editing, annotation, or highlighting within the reader
- Server-side rendering or offline caching
- Replacing or modifying `ChapterArborist` — folio's TOC is a separate, read-only component

## Decisions

### 1. Provider-driven chapter tree (not source plugins)

**Decision:** Consumers supply a `FolioNode[]` tree where each leaf carries an async `fetch()` method. Folio does not own content acquisition.

**Alternative considered:** Source plugins that load entire books (original plan). Rejected because:
- A single source plugin can't serve mixed-origin chapters (some from Rezics API, some from local files)
- All-at-once loading doesn't scale for large books
- The consumer already knows where content lives — duplicating that knowledge in folio creates coupling

**Result:** The source plugin concept dissolves. Folio's plugin system is renderers + panel UI only. Content acquisition is the consumer's responsibility. The txt and epub plugins export tree builder utilities that consumers call before passing the tree to folio.

### 2. Flat `chapterIndex` for position, `id` for persistence

**Decision:** Folio flattens the tree depth-first into a leaf array. Runtime navigation uses `chapterIndex: number` (index into the flat array). Position persistence uses `chapterId: string` (the node's `id`, which is a unitID for backend-sourced chapters) with index fallback.

**Alternative considered:** Path-based addressing (`[partIndex, chapterIndex]`). Rejected — adds complexity without benefit since folio's navigation is strictly linear (prev/next through leaves).

**Restore logic:**
1. If `initialPosition.chapterId` exists, find it in the flat array → use its index
2. If not found (tree changed), fall back to `initialPosition.chapterIndex`
3. If index also out of bounds, clamp to last chapter

### 3. Seamless chapter auto-advance (no break pages)

**Decision:** When the user navigates past the last page of a chapter, folio automatically advances to the next chapter's first page. No interstitial, no break page.

**Alternative considered:** Chapter break pages (a visual separator between chapters). Rejected per user preference — uninterrupted reading flow is prioritized.

**Prefetching:** Folio begins fetching the next chapter when the user is within `prefetchThreshold` pages of the end (default: 2). If the fetch hasn't completed by the time the user turns, a loading state is shown.

### 4. CSS Multi-Column for pagination

**Decision:** Page mode uses `column-width` equal to the viewport width. The inner content spans all columns; a `translateX` shift (no CSS transition) positions the visible column. Page count is `Math.round(scrollWidth / clientWidth)`.

**Alternative considered:** Manual DOM slicing (splitting content into page-sized chunks). Rejected — fragile with rich content (images, tables), browser-dependent, and reinvents what CSS columns already solve.

**Recalculation triggers:** ResizeObserver, `document.fonts.ready`, image `onload` events.

### 5. Ghost Snapshot animation via WAAPI

**Decision:** Page turns clone the departing viewport as a fixed-position ghost, jump the real content instantly, then animate the ghost out via Web Animations API.

**Alternative considered:** `framer-motion` `animate()`. Rejected — adds ~30kb for a single animation that WAAPI handles natively. The ghost animations (rotateY, translateX, opacity+scale) are well within WAAPI's capabilities.

**Turn styles:**

| Style | Keyframes | Use case |
|---|---|---|
| `rotate` | `rotateY(0 → ±90deg)` + `opacity(1 → 0)` | Book feel, default |
| `slide` | `translateX(0 → ±100%)` | Magazine feel |
| `fade` | `opacity(1 → 0)` + `scale(1 → 0.97)` | Minimal, good for plain text |

### 6. Rendering via `@rezics/editor/markdown` standalone utilities

**Decision:** Folio imports `createNovelRenderer`, `highlightCode`, and `addCopyButtons` from `@rezics/editor/markdown`. The novel renderer (markdown-it + format preservation plugins) converts raw content to HTML. Folio owns the reader-specific CSS (themes, typography, safe areas).

**Alternative considered:** Folio depends on `markdown-it` directly. Rejected — the editor already provides a well-configured renderer with novel mode (empty line preservation, space preservation, line breaks). Duplicating that configuration is unnecessary.

**CSS ownership:** The editor's preview styles are scoped to `.cm-preview-panel` and embedded in CodeMirror's `baseTheme`. Folio does NOT use those styles. Folio provides its own `.folio-content` styles with reader-specific theming (light/dark/sepia, configurable font size/line height, mobile safe areas).

### 7. Epub parsing: DIY with fflate + fast-xml-parser

**Decision:** The epub plugin implements its own parser (~200 LOC) using `fflate` for ZIP extraction and `fast-xml-parser` for OPF/NCX XML parsing.

**Alternative considered:**
- `epubjs` — unmaintained since 2023, rendering-focused (iframe-based), heavy for parse-only use
- `@lingo-reader/epub-parser` — viable but adds a dependency for something achievable in minimal code

**The parser does:**
1. Unzip the epub (fflate)
2. Read `META-INF/container.xml` → locate OPF file
3. Parse OPF manifest + spine → reading order of XHTML items
4. Parse NCX/nav document → TOC structure
5. For each spine item: extract raw HTML, resolve relative asset paths to blob URLs
6. Return `FolioNode[]` tree (from TOC) with fetch methods that return the pre-extracted HTML

### 8. State: React Context + useReducer

**Decision:** Folio state lives in `FolioContext` using `useReducer`. No external store (Jotai/Zustand).

**Rationale:** Folio is a standalone package. Coupling to the host app's state library creates a peer dependency and integration friction. Context + reducer is sufficient — folio state is local to the reader component tree. The `onProgressChange` callback is the escape hatch for consumers who need folio state in their own stores.

### 9. Txt plugin Settings panel with regex configuration

**Decision:** The txt plugin contributes a Settings panel that allows users to view, add, remove, reorder, and test regex split rules at runtime. Re-splitting triggers `onTreeChange` on the consumer.

**Re-split flow:**
1. User edits rules in Settings panel
2. User taps "Re-split"
3. Plugin calls `splitTxt(originalRaw, { splitRules: newRules })`
4. Plugin calls `requestTreeChange(newTree)` via PanelProps
5. Consumer's `onTreeChange` fires → updates state → folio re-renders with new tree
6. Position resets to chapter 0

### 10. TOC: flat list with depth-based background banding

**Decision:** The TOC panel renders a flat list. Branch nodes are section headers with background colors graduated by depth. Leaf nodes are flat chapter entries with no indentation. Branches are collapsible (per-branch toggle + expand/collapse all).

**Alternative considered:** react-arborist. Rejected — it's designed for editable trees with drag-and-drop. Folio's TOC is read-only navigation. A simple list with `Set<string>` collapse state is sufficient.

## Architecture

```
Consumer (e.g. @rezics/app)
│
│  Builds FolioNode[] tree:
│  - Maps ChapterTreeItem → FolioNode, wiring fetch() to API calls
│  - Or calls createTxtPlugin(rawText) for local .txt files
│  - Or calls createEpubPlugin(file) for .epub files
│
│  <Folio tree={tree} plugins={[...]} onProgressChange={...} />
│
▼
┌─────────────────────────────────────────────────────────┐
│  <FolioProvider>                                        │
│                                                         │
│  FolioContext (useReducer)                               │
│  ├── state: FolioState                                  │
│  ├── dispatch: FolioDispatch                            │
│  ├── flatChapters: FlatChapter[]  (memoized from tree)  │
│  └── registry: PluginRegistry                           │
│                                                         │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ TOC Panel  │ │ Content Area │ │ Settings/Controls │  │
│  │            │ │              │ │                   │  │
│  │ Collapsible│ │ Pagination   │ │ Plugin UI slots   │  │
│  │ tree list  │ │ (scroll/page)│ │ Toolbar, Controls │  │
│  │ with depth │ │              │ │ Settings          │  │
│  │ bg bands   │ │ Ghost layer  │ │                   │  │
│  │            │ │ Gesture area │ │                   │  │
│  └────────────┘ └──────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
tree prop                    FolioNode[]
    │
    ▼
flattenTree()               FlatChapter[] (depth-first leaves)
    │
    ├── chapterIndex         indexes into flat array
    │       │
    │       ▼
    │   node.fetch(signal)   lazy content loading
    │       │
    │       ▼
    │   FolioContent         { contentType, raw, meta }
    │       │
    │       ▼
    │   registry             resolveRenderer(contentType)
    │       │
    │       ▼
    │   <Renderer />         plugin renders via @rezics/editor
    │
    ├── prefetch             fetch chapter[i+1] at threshold
    │
    └── onProgressChange     { position, fraction, chapterFraction }
            │
            ▼
        Consumer persists    (localStorage, API, etc.)
```

## Risks / Trade-offs

**[CSS Multi-Column cross-browser inconsistency]** → Safari on iOS has known column gap calculation bugs. Mitigation: explicit `column-gap: 0` with padding on the container, and browser-specific test coverage for page count accuracy.

**[cloneNode(true) limitations]** → Ghost snapshot cloning doesn't preserve `<canvas>`, `<video>`, or shadow DOM state. Mitigation: acceptable for a text reader. If epub content includes embedded media, the ghost will show a blank frame for that element — visually imperfect but brief (320ms animation).

**[Epub asset blob URL memory]** → Each epub load creates blob URLs for images/fonts that persist until explicitly revoked. Mitigation: revoke all blob URLs on chapter unload and component unmount via cleanup in the epub plugin's fetch closures.

**[Re-split resets reading position]** → When txt regex rules change and the tree is rebuilt, there's no reliable way to map old chapter positions to new ones. Mitigation: reset to chapter 0 with a confirmation prompt in the Settings UI before re-splitting.

**[Large document performance in page mode]** → CSS Multi-Column with very long chapters (100k+ words) may cause layout thrash. Mitigation: defer as a known limitation. If it becomes a real issue, chunk long chapters into virtual sections client-side.

## Open Questions

1. **Epub plugin scope for initial release** — should the epub plugin ship in the first implementation pass, or be deferred to a follow-up? Asset blob URL resolution is the most complex piece. A spike is recommended before committing.
2. **Keyboard navigation** — should folio handle arrow key / Page Up / Page Down in page mode? Likely yes, but needs to coexist with browser defaults in scroll mode.
3. **`@rezics/contract` changes** — does `ChapterTreeItem` need a `contentType` field to avoid content-sniffing? Currently consumers would need to know the content type when building the tree.
