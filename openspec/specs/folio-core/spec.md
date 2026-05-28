# folio-core Specification

## Purpose

Defines the `@rezics/folio` reader runtime end-to-end: the
`FolioNode` chapter tree, the `FolioContent` and `FolioState`
shapes, the discriminated `FolioStatus` lifecycle, the explicit
`FolioDispatch` action surface, the `FolioProvider` / `useFolio`
context, the renderer plugin registry, and the `<Folio />`
component contract. The same spec owns reader interaction:
page-mode gestures (swipe, three-zone tap, scroll-mode
passthrough, boundary handling), the Ghost Snapshot page-turn
mechanism with three configurable turn styles backed by the Web
Animations API, the scroll-vs-page pagination model with column
math and recalculation triggers, and chapter-tree navigation
including depth-first flattening, seamless auto-advance,
prefetching with `AbortSignal`, position restoration, and the
collapsible TOC panel.

## Runtime types and component contract

### Requirement: Package scaffold

The `package/folio` directory SHALL contain a valid Bun workspace package with `package.json` (name: `@rezics/folio`), `tsconfig.json` extending the monorepo base, and `src/index.ts` as the main entry point. The package SHALL declare `@use-gesture/react` as a dependency and `react`, `react-dom`, `@rezics/editor` as peer dependencies.

#### Scenario: Package resolves in workspace
- **WHEN** a consumer package adds `"@rezics/folio": "workspace:*"` to its dependencies
- **THEN** Bun resolves the package and its exports without error

### Requirement: FolioNode tree type

The system SHALL export a `FolioNode` interface representing a tree node with `id: string`, `title: string`, optional `children: FolioNode[]` (branch nodes), and optional `fetch: (signal: AbortSignal) => Promise<FolioContent>` (leaf nodes). A node with `fetch` is a readable chapter. A node with `children` is a structural grouping.

#### Scenario: Backend-sourced chapter tree
- **WHEN** a consumer maps `ChapterTreeItem[]` from the Rezics API to `FolioNode[]`, wiring `fetch` to API calls on leaf nodes
- **THEN** each leaf node's `fetch()` returns a `Promise<FolioContent>` with `contentType` and `raw` fields

#### Scenario: Branch node without content
- **WHEN** a `FolioNode` has `children` but no `fetch`
- **THEN** the node is treated as a structural grouping (part/section) and is not navigable as a chapter

### Requirement: FolioContent type

The system SHALL export a `FolioContent` interface with `contentType: string` (e.g., `'txt'`, `'html'`, `'markdown'`), `raw: string` (the full chapter text), and optional `meta: Record<string, unknown>` for plugin-specific metadata.

#### Scenario: Content type used for renderer resolution
- **WHEN** a leaf node's `fetch()` resolves with `{ contentType: 'txt', raw: '...' }`
- **THEN** the plugin registry resolves the renderer registered for `'txt'` content type

### Requirement: FolioState type

The system SHALL maintain state via `FolioState` containing: `readMode: 'scroll' | 'page'`, `chapterIndex: number`, `pageIndex: number`, `pageCount: number`, `scrollOffset: number`, `fontSize: number`, `lineHeight: number`, `theme: 'light' | 'dark' | 'sepia'`, `turnStyle: 'rotate' | 'slide' | 'fade'`, and `status: FolioStatus`.

#### Scenario: Initial state defaults
- **WHEN** `<Folio />` mounts without explicit state overrides
- **THEN** the initial state uses `readMode: 'page'`, `theme: 'light'`, `turnStyle: 'rotate'`, `fontSize: 16`, `lineHeight: 1.6`

### Requirement: FolioStatus type

The system SHALL track loading status as a discriminated union: `{ state: 'idle' }`, `{ state: 'loading', chapterIndex?: number }`, `{ state: 'ready' }`, or `{ state: 'error', error: Error, retry: () => void }`.

#### Scenario: Loading state during chapter fetch
- **WHEN** a chapter's `fetch()` is in-flight
- **THEN** `status` is `{ state: 'loading', chapterIndex: <index> }`

#### Scenario: Error state with retry
- **WHEN** a chapter's `fetch()` rejects
- **THEN** `status` is `{ state: 'error', error: <Error>, retry: <function> }` and calling `retry()` re-invokes the fetch

### Requirement: FolioDispatch action surface

The system SHALL expose a `FolioDispatch` function accepting a discriminated union of actions: `SET_READ_MODE`, `SET_CHAPTER`, `SET_PAGE`, `SET_FONT_SIZE`, `SET_LINE_HEIGHT`, `SET_THEME`, `SET_TURN_STYLE`. No generic `SET_STATE` action SHALL exist.

#### Scenario: Plugin dispatches theme change
- **WHEN** a plugin's Settings panel calls `dispatch({ type: 'SET_THEME', theme: 'sepia' })`
- **THEN** `FolioState.theme` updates to `'sepia'` and the content area re-renders with sepia styling

### Requirement: FolioContext provider and useFolio hook

The system SHALL provide a `<FolioProvider>` React context provider that holds `FolioState`, `FolioDispatch`, the flattened chapter list, and the plugin registry. A `useFolio()` hook SHALL return `{ state, dispatch, flatChapters, registry }`.

#### Scenario: Nested component accesses state
- **WHEN** a component inside `<FolioProvider>` calls `useFolio()`
- **THEN** it receives the current `FolioState`, dispatch function, flat chapter array, and plugin registry

#### Scenario: Hook outside provider throws
- **WHEN** `useFolio()` is called outside a `<FolioProvider>`
- **THEN** it throws a descriptive error

### Requirement: Plugin registry (renderer plugins only)

The system SHALL provide a `PluginRegistry` class with `register(...plugins: RendererPlugin[])`, `resolveRenderer(contentType: string): RendererPlugin | undefined`, and `collectSlot(slot: 'Toolbar' | 'Controls' | 'Settings'): React.ComponentType<PanelProps>[]`.

#### Scenario: Renderer resolution by content type
- **WHEN** `resolveRenderer('txt')` is called and a plugin registered with `contentTypes: ['txt']` exists
- **THEN** that plugin is returned

#### Scenario: No matching renderer
- **WHEN** `resolveRenderer('unknown')` is called and no plugin handles that content type
- **THEN** `undefined` is returned and the content area displays a fallback message

### Requirement: RendererPlugin interface

Each renderer plugin SHALL declare `kind: 'renderer'`, `id: string`, `contentTypes: string[]`, a `Renderer` React component, and optional `Toolbar`, `Controls`, `Settings` panel components. The `kind` field SHALL be used for type discrimination.

#### Scenario: Plugin with Settings panel
- **WHEN** a renderer plugin provides a `Settings` component
- **THEN** `collectSlot('Settings')` includes that component in its result array

### Requirement: Folio component props

The `<Folio />` component SHALL accept: `tree: FolioNode[]`, `plugins: RendererPlugin[]`, `initialPosition?: FolioPosition`, `onProgressChange?: (progress: FolioProgress) => void`, `onTreeChange?: (tree: FolioNode[]) => void`, `renderLoading?: () => ReactNode`, `renderError?: (error: Error, retry: () => void) => ReactNode`, and `config?: FolioConfig`.

#### Scenario: Consumer provides all props
- **WHEN** `<Folio tree={nodes} plugins={[txtPlugin]} initialPosition={{ chapterIndex: 5 }} onProgressChange={save} />` is rendered
- **THEN** folio initializes at chapter 5, renders using the txt plugin, and calls `save()` on navigation

### Requirement: FolioConfig options

The system SHALL accept a `FolioConfig` with `prefetchThreshold: number` (default: 2). This controls how many pages before the end of a chapter folio begins prefetching the next chapter.

#### Scenario: Prefetch triggers at threshold
- **WHEN** the user is within `prefetchThreshold` pages of the last page of a chapter
- **THEN** folio begins fetching the next chapter's content via its `fetch()` method

## Gestures

### Requirement: Swipe navigation

In page mode, the system SHALL detect horizontal swipe gestures via `@use-gesture/react`. A left swipe (swipeX === -1) SHALL trigger a next-page turn. A right swipe (swipeX === 1) SHALL trigger a previous-page turn.

#### Scenario: Swipe left to advance
- **WHEN** the user swipes left on the content area in page mode
- **THEN** the reader navigates to the next page (or next chapter's first page if on the last page)

#### Scenario: Swipe right to go back
- **WHEN** the user swipes right on the content area in page mode
- **THEN** the reader navigates to the previous page (or previous chapter's last page if on the first page)

#### Scenario: Swipe in scroll mode
- **WHEN** the user swipes horizontally in scroll mode
- **THEN** no page navigation occurs — scroll mode uses native vertical scrolling

### Requirement: Tap zone navigation

In page mode, the content area SHALL be divided into three horizontal tap zones: left 30% (previous page), center 40% (toggle UI chrome), and right 30% (next page).

#### Scenario: Tap right zone
- **WHEN** the user taps the right 30% of the content area in page mode
- **THEN** the reader navigates to the next page

#### Scenario: Tap left zone
- **WHEN** the user taps the left 30% of the content area in page mode
- **THEN** the reader navigates to the previous page

#### Scenario: Tap center zone
- **WHEN** the user taps the center 40% of the content area in page mode
- **THEN** the UI chrome (toolbar, controls, TOC) toggles visibility

### Requirement: Gesture layer scope

The gesture layer SHALL only be active in page mode. In scroll mode, native browser scrolling and touch behavior SHALL not be intercepted.

#### Scenario: Scroll mode passthrough
- **WHEN** `readMode` is `'scroll'`
- **THEN** no swipe or tap zone handlers are attached to the content area

### Requirement: Boundary behavior

When the user attempts to navigate past the first page of the first chapter or past the last page of the last chapter, no navigation SHALL occur.

#### Scenario: At the beginning
- **WHEN** the user swipes right or taps the left zone while on chapter 0, page 0
- **THEN** nothing happens — no navigation, no error

#### Scenario: At the end
- **WHEN** the user swipes left or taps the right zone while on the last page of the last chapter
- **THEN** nothing happens

## Ghost snapshots

### Requirement: Ghost Snapshot page turn mechanism

Page turns in page mode SHALL use the Ghost Snapshot technique: (1) clone the current viewport as a fixed-position overlay, (2) instantly jump the real content to the new page (no transition), (3) animate the ghost clone out using Web Animations API, (4) remove the ghost from the DOM on animation completion.

#### Scenario: Forward page turn
- **WHEN** the user navigates to the next page
- **THEN** a ghost clone of the current viewport appears as a fixed overlay, the real content jumps to the next page, and the ghost animates out over 320ms

#### Scenario: Backward page turn
- **WHEN** the user navigates to the previous page
- **THEN** the ghost animation plays in the reverse direction (e.g., `rotateY` toward positive degrees for `rotate` style)

#### Scenario: Ghost cleanup
- **WHEN** the ghost animation completes (via `animation.finished` promise)
- **THEN** the ghost element is removed from the DOM immediately

### Requirement: Configurable turn styles

The system SHALL support three turn styles configured via `state.turnStyle`:

- `'rotate'`: `rotateY(0 → ±90deg)` with `opacity(1 → 0)`, transform origin at the trailing edge. Default style.
- `'slide'`: `translateX(0 → ±100%)` — the ghost slides off-screen.
- `'fade'`: `opacity(1 → 0)` with `scale(1 → 0.97)` — minimal, suitable for plain text.

#### Scenario: Rotate style animation
- **WHEN** `turnStyle` is `'rotate'` and the user turns to the next page
- **THEN** the ghost animates with `rotateY(0 → -90deg)`, `opacity(1 → 0)`, transform origin `'right center'`, duration 320ms, easing `ease-in`

#### Scenario: Slide style animation
- **WHEN** `turnStyle` is `'slide'` and the user turns to the next page
- **THEN** the ghost animates with `translateX(0 → -100%)`, duration 320ms

#### Scenario: Fade style animation
- **WHEN** `turnStyle` is `'fade'` and the user turns to the next page
- **THEN** the ghost animates with `opacity(1 → 0)` and `scale(1 → 0.97)`, duration 320ms

### Requirement: Animation uses Web Animations API only

Ghost animations SHALL use the Web Animations API (`element.animate()` + `animation.finished`) exclusively. No animation library (framer-motion, GSAP, etc.) SHALL be used.

#### Scenario: WAAPI usage
- **WHEN** a ghost animation is triggered
- **THEN** it is created via `ghost.animate(keyframes, options)` and cleanup awaits the `finished` promise

### Requirement: Animation lock during turn

While a ghost animation is in-flight, additional page turn requests SHALL be ignored to prevent overlapping animations.

#### Scenario: Rapid page turns
- **WHEN** the user swipes next while a ghost animation is still playing
- **THEN** the second turn request is discarded until the current animation completes

## Pagination

### Requirement: Scroll mode

When `readMode` is `'scroll'`, the content area SHALL render as a plain vertically-scrollable container with no pagination logic. The full chapter content is visible via scrolling.

#### Scenario: Scroll mode rendering
- **WHEN** `state.readMode` is `'scroll'`
- **THEN** the content renders in a single vertical overflow container without column layout

#### Scenario: Progress tracking in scroll mode
- **WHEN** the user scrolls in scroll mode
- **THEN** `scrollOffset` in state updates and `onProgressChange` fires with `chapterFraction` based on `scrollTop / scrollHeight`

### Requirement: Page mode via CSS Multi-Column

When `readMode` is `'page'`, the content area SHALL use CSS `column-width` equal to the container width. The inner content element spans all columns. Only one column (page) is visible at a time via `overflow: hidden` on the container and `translateX(-pageIndex * containerWidth)` on the inner element, applied without CSS transition.

#### Scenario: Page mode column layout
- **WHEN** `state.readMode` is `'page'` and content fills 4 columns
- **THEN** `pageCount` is 4 and the visible page is determined by `pageIndex`

#### Scenario: Translate without transition
- **WHEN** `pageIndex` changes
- **THEN** the inner element's `translateX` updates instantly (no CSS transition) — animation is handled by the Ghost Snapshot layer

### Requirement: Page count calculation

Total pages SHALL be calculated as `Math.round(innerElement.scrollWidth / container.clientWidth)`. This value SHALL be recalculated on: component mount, `ResizeObserver` callback, `document.fonts.ready` resolution, and image `onload` events within the content.

#### Scenario: Font load triggers recalculation
- **WHEN** `document.fonts.ready` resolves after content mount
- **THEN** `pageCount` is recalculated and `state.pageCount` updates

#### Scenario: Resize triggers recalculation
- **WHEN** the container is resized (orientation change, window resize)
- **THEN** `pageCount` is recalculated and `pageIndex` is clamped to the valid range

### Requirement: Mode switching

The user SHALL be able to switch between `'scroll'` and `'page'` modes at any time via `dispatch({ type: 'SET_READ_MODE', mode })`. Position SHALL be approximately preserved across mode switches.

#### Scenario: Switch from scroll to page
- **WHEN** the user switches from scroll mode (at 60% scroll progress) to page mode
- **THEN** `pageIndex` is set to approximately 60% of `pageCount`

#### Scenario: Switch from page to scroll
- **WHEN** the user switches from page mode (page 3 of 10) to scroll mode
- **THEN** `scrollOffset` is set to approximately 30% of the scroll height

## Tree navigation

### Requirement: Tree flattening to reading order

The system SHALL flatten the `FolioNode[]` tree depth-first into a `FlatChapter[]` array containing only leaf nodes (nodes with `fetch`). Each `FlatChapter` SHALL include `index: number` (position in reading order), `node: FolioNode` (reference), `depth: number` (tree depth), and `path: number[]` (tree path indices).

#### Scenario: Nested tree flattening
- **WHEN** a tree has `Part 1 > [Ch1, Ch2]` and `Part 2 > Section A > [Ch3]`
- **THEN** the flat array is `[{ index: 0, node: Ch1, depth: 1 }, { index: 1, node: Ch2, depth: 1 }, { index: 2, node: Ch3, depth: 2 }]`

#### Scenario: Branch nodes excluded from flat array
- **WHEN** a node has `children` but no `fetch`
- **THEN** it does not appear in the flat chapter array

### Requirement: Seamless chapter auto-advance

When the user navigates past the last page of a chapter, the system SHALL automatically advance to the first page of the next chapter without any interstitial, break page, or user confirmation.

#### Scenario: Auto-advance on last page
- **WHEN** the user is on the last page of chapter N and navigates forward
- **THEN** the reader displays page 0 of chapter N+1 seamlessly

#### Scenario: Auto-reverse on first page
- **WHEN** the user is on page 0 of chapter N (N > 0) and navigates backward
- **THEN** the reader displays the last page of chapter N-1

### Requirement: Chapter prefetching

The system SHALL prefetch the next chapter's content when the user is within `config.prefetchThreshold` pages of the end of the current chapter. The prefetch SHALL use the next chapter's `node.fetch()` with an `AbortSignal` that cancels if the user navigates away.

#### Scenario: Prefetch at threshold
- **WHEN** `prefetchThreshold` is 2 and the user reaches page `pageCount - 2`
- **THEN** the next chapter's `fetch()` is called in the background

#### Scenario: Prefetch cancellation
- **WHEN** a prefetch is in-flight and the user navigates to a different chapter (not the prefetched one)
- **THEN** the prefetch's `AbortSignal` is aborted

#### Scenario: Content already prefetched
- **WHEN** the user advances to a chapter whose content was already prefetched
- **THEN** the content displays immediately without a loading state

### Requirement: Position restoration with unitID priority

When `initialPosition` is provided, the system SHALL restore position using `chapterId` first: find the matching node `id` in the flat array and use its index. If no match is found, fall back to `chapterIndex`. If the index exceeds the flat array length, clamp to the last chapter.

#### Scenario: Restore by chapterId
- **WHEN** `initialPosition` has `chapterId: "abc-123"` and a leaf node with `id: "abc-123"` exists at flat index 7
- **THEN** the reader opens at chapter index 7

#### Scenario: chapterId not found, fallback to index
- **WHEN** `initialPosition` has `chapterId: "deleted-id"` which doesn't exist, and `chapterIndex: 3`
- **THEN** the reader opens at chapter index 3

#### Scenario: Index out of bounds
- **WHEN** `initialPosition` has `chapterIndex: 999` but only 50 chapters exist
- **THEN** the reader opens at chapter index 49 (last chapter)

### Requirement: FolioPosition and FolioProgress types

`FolioPosition` SHALL contain `chapterIndex: number`, optional `chapterId: string`, `pageIndex: number`, and optional `scrollOffset: number`. `FolioProgress` SHALL contain `position: FolioPosition`, `fraction: number` (0–1, overall), and `chapterFraction: number` (0–1, within current chapter).

#### Scenario: Progress callback on navigation
- **WHEN** the user navigates to page 5 of 20 in chapter 2 of 10
- **THEN** `onProgressChange` fires with `chapterFraction: 0.25` and `fraction` reflecting overall book position

### Requirement: Collapsible TOC panel

The system SHALL render a table-of-contents panel from the `FolioNode[]` tree. Branch nodes render as section headers with background colors graduated by depth. Leaf nodes render as flat chapter entries with no indentation, regardless of depth. The currently active chapter SHALL be visually highlighted.

#### Scenario: TOC depth styling
- **WHEN** the tree has depth-0 branches (parts) and depth-1 branches (sections)
- **THEN** depth-0 headers have the strongest background contrast, depth-1 have medium contrast, and leaves have the base background

#### Scenario: Tap leaf to navigate
- **WHEN** the user taps a leaf entry in the TOC
- **THEN** the reader navigates to that chapter's `chapterIndex`

### Requirement: Branch collapse and expand

Each branch node in the TOC SHALL be individually collapsible. When collapsed, its child entries (branches and leaves) are hidden. The TOC SHALL also provide "Expand All" and "Collapse All" global controls.

#### Scenario: Collapse a branch
- **WHEN** the user taps a branch header in the TOC
- **THEN** all children of that branch are hidden

#### Scenario: Expand all
- **WHEN** the user taps "Expand All"
- **THEN** all branches in the TOC are expanded, showing all entries

#### Scenario: Collapse all
- **WHEN** the user taps "Collapse All"
- **THEN** all branches are collapsed, showing only top-level entries

#### Scenario: Collapse state does not affect navigation
- **WHEN** branches are collapsed in the TOC
- **THEN** the flat reading order and `chapterIndex` are unaffected — only the TOC visual display changes
