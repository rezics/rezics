## 1. Package Scaffold

- [x] 1.1 Create `package/folio/` directory with `package.json` (name: `@rezics/folio`, deps: `@use-gesture/react`, `fflate`, `fast-xml-parser`, peerDeps: `react`, `react-dom`, `@rezics/editor`), `tsconfig.json` extending monorepo base, and `src/index.ts` entry point
- [x] 1.2 Verify the package resolves in the Bun workspace — import `@rezics/folio` from `package/app` and confirm no resolution errors
- [x] 1.3 Configure `package.json` exports: `"."` → `./src/index.ts`, `"./plugin/txt"` → `./src/plugin/txt/index.ts`, `"./plugin/epub"` → `./src/plugin/epub/index.ts`

## 2. Core Types

- [x] 2.1 Define and export `FolioNode`, `FolioContent`, `FolioPosition`, `FolioProgress` interfaces in `src/types.ts`
- [x] 2.2 Define and export `FolioState`, `FolioStatus`, `FolioConfig` types in `src/types.ts` — include all state fields: `readMode`, `chapterIndex`, `pageIndex`, `pageCount`, `scrollOffset`, `fontSize`, `lineHeight`, `theme`, `turnStyle`, `status`
- [x] 2.3 Define and export `FolioAction` discriminated union and `FolioDispatch` type in `src/types.ts` — actions: `SET_READ_MODE`, `SET_CHAPTER`, `SET_PAGE`, `SET_FONT_SIZE`, `SET_LINE_HEIGHT`, `SET_THEME`, `SET_TURN_STYLE`
- [x] 2.4 Define and export `RendererPlugin`, `PanelProps` interfaces in `src/types.ts` — renderer uses `kind: 'renderer'` discriminator, PanelProps includes `requestTreeChange`
- [x] 2.5 Define and export `FlatChapter` interface in `src/types.ts`

## 3. Plugin Registry

- [x] 3.1 Implement `PluginRegistry` class in `src/registry.ts` with `register()`, `resolveRenderer()`, `collectSlot()` methods
- [x] 3.2 Write tests for registry: renderer resolution by content type, missing content type returns `undefined`, `collectSlot` collects panel components from registered plugins

## 4. Tree Flattening

- [x] 4.1 Implement `flattenTree(nodes: FolioNode[]): FlatChapter[]` in `src/tree.ts` — depth-first walk, only leaf nodes with `fetch`, records `index`, `depth`, `path`
- [x] 4.2 Write tests for tree flattening: nested tree, flat tree, branch-only tree (empty result), single leaf

## 5. FolioContext and State Management

- [x] 5.1 Implement `folioReducer` in `src/state.ts` handling all `FolioAction` types with proper state transitions
- [x] 5.2 Implement `<FolioProvider>` and `useFolio()` hook in `src/context.tsx` — provider holds state, dispatch, memoized flat chapters, and registry
- [x] 5.3 Implement position restoration logic in provider initialization: `chapterId`-first lookup, `chapterIndex` fallback, out-of-bounds clamping
- [x] 5.4 Implement `onProgressChange` callback firing — compute `fraction` and `chapterFraction` on chapter/page/scroll changes

## 6. Pagination Engine

- [x] 6.1 Implement scroll mode container in `src/pagination/ScrollContainer.tsx` — plain vertical overflow, `scrollOffset` tracking via `onScroll`
- [x] 6.2 Implement page mode container in `src/pagination/PageContainer.tsx` — CSS `column-width` layout, `overflow: hidden`, `translateX` positioning (no transition)
- [x] 6.3 Implement page count calculation: `Math.round(scrollWidth / clientWidth)`, attach recalculation to `ResizeObserver`, `document.fonts.ready`, and image `onload`
- [x] 6.4 Implement mode switching logic: approximate position preservation when switching between scroll and page modes
- [x] 6.5 Write tests for page count calculation edge cases

## 7. Ghost Snapshot Animation

- [x] 7.1 Implement `turnPage()` function in `src/animation/ghost.ts` — clone viewport, apply fixed positioning, jump real content, animate ghost via WAAPI
- [x] 7.2 Implement `rotate` turn style keyframes: `rotateY(0 → ±90deg)` + `opacity(1 → 0)`, transform origin at trailing edge
- [x] 7.3 Implement `slide` turn style keyframes: `translateX(0 → ±100%)`
- [x] 7.4 Implement `fade` turn style keyframes: `opacity(1 → 0)` + `scale(1 → 0.97)`
- [x] 7.5 Implement animation lock: reject new turn requests while a ghost animation is in-flight, clear lock on `animation.finished`

## 8. Gesture Layer

- [x] 8.1 Implement gesture hook in `src/gesture/useFolioGesture.ts` — `@use-gesture/react` `useGesture` with `onDrag` for swipe detection (swipeX -1 = next, 1 = prev)
- [x] 8.2 Implement tap zone detection in the `onClick` handler: left 30% = prev, right 30% = next, center 40% = toggle UI
- [x] 8.3 Wire gesture hook into page mode container only — no gesture interception in scroll mode
- [x] 8.4 Implement boundary guards: no-op on swipe/tap at first page of first chapter or last page of last chapter

## 9. Chapter Navigation

- [x] 9.1 Implement seamless chapter auto-advance: when `pageIndex` exceeds `pageCount - 1`, advance to next chapter page 0; when `pageIndex` goes below 0, move to previous chapter's last page
- [x] 9.2 Implement chapter prefetch logic: trigger `fetch()` for next chapter when within `prefetchThreshold` pages of chapter end, cancel via `AbortSignal` on navigation away
- [x] 9.3 Implement content caching: store fetched `FolioContent` by chapter id/index to avoid re-fetching previously loaded chapters
- [x] 9.4 Implement loading and error status transitions: `idle` → `loading` → `ready` / `error`, error state includes `retry()` function

## 10. TOC Panel

- [x] 10.1 Implement `buildToc()` function in `src/toc/buildToc.ts` — converts `FolioNode[]` tree to flat `TocEntry[]` array with branch/leaf discrimination and depth
- [x] 10.2 Implement `<TocPanel />` component in `src/toc/TocPanel.tsx` — renders branch headers with depth-graduated backgrounds, leaf entries as flat items, active chapter highlight
- [x] 10.3 Implement collapse/expand state: `Set<string>` of collapsed branch IDs, per-branch toggle on header tap, "Expand All" and "Collapse All" controls
- [x] 10.4 Style TOC for mobile: touch-friendly tap targets, theme-aware colors (light/dark/sepia)

## 11. Content Rendering Integration

- [x] 11.1 Implement `<ContentRenderer />` in `src/render/ContentRenderer.tsx` — resolves renderer plugin from registry by `contentType`, renders `<plugin.Renderer raw={} meta={} />`, shows fallback for unmatched content types
- [x] 11.2 Implement folio-owned reader CSS in `src/styles/` — `.folio-content` base styles, theme variants (light/dark/sepia), font size / line height CSS custom properties, mobile safe area insets via `env(safe-area-inset-*)`
- [x] 11.3 Implement `renderLoading` and `renderError` slot rendering in the main `<Folio />` component

## 12. Panel Slot System

- [x] 12.1 Implement `<PanelSlot />` component in `src/panel/PanelSlot.tsx` — collects components from registry via `collectSlot()`, renders them with `PanelProps`
- [x] 12.2 Wire Toolbar, Controls, Settings slots into the `<Folio />` layout — Toolbar at top, Controls for chapter navigation, Settings for reader configuration
- [x] 12.3 Implement UI chrome toggle: center tap hides/shows Toolbar and Controls panels

## 13. Main Folio Component

- [x] 13.1 Implement `<Folio />` component in `src/Folio.tsx` — composes FolioProvider, ContentRenderer, pagination container, gesture layer, panel slots, TOC panel
- [x] 13.2 Wire all props: `tree`, `plugins`, `initialPosition`, `onProgressChange`, `onTreeChange`, `renderLoading`, `renderError`, `config`
- [x] 13.3 Export public API from `src/index.ts`: `Folio`, `useFolio`, `PluginRegistry`, all types, `flattenTree`

## 14. Built-in Plugin: txt

- [x] 14.1 Implement `splitTxt()` tree builder in `src/plugin/txt/split.ts` — ordered regex matching, chunk extraction with title from matched line, `FolioNode[]` output with synchronous `fetch()`
- [x] 14.2 Implement default split rules array in `src/plugin/txt/rules.ts`
- [x] 14.3 Implement `<TxtRenderer />` component in `src/plugin/txt/TxtRenderer.tsx` — uses `createNovelRenderer()` from `@rezics/editor/markdown`, applies reader theme CSS
- [x] 14.4 Implement `<TxtSettings />` panel in `src/plugin/txt/TxtSettings.tsx` — displays current rule list, add/remove/reorder rules
- [x] 14.5 Implement regex test/preview in `<TxtSettings />` — test input, match count, matched line preview, syntax validation
- [x] 14.6 Implement re-split flow: "Re-split" button calls `splitTxt()` with updated rules, calls `requestTreeChange()`, shows updated chapter count
- [x] 14.7 Implement `createTxtPlugin()` factory in `src/plugin/txt/index.ts` — returns `{ plugin, tree }`, plugin retains reference to original raw text
- [x] 14.8 Write tests for `splitTxt()`: CJK markers, English markers, markdown headings, custom rules, no-match fallback, empty input

## 15. Built-in Plugin: epub

- [x] 15.1 Implement ZIP extraction in `src/plugin/epub/zip.ts` — read epub `File` as `ArrayBuffer`, decompress with `fflate`, return file map
- [x] 15.2 Implement container.xml parser in `src/plugin/epub/container.ts` — locate OPF path from `META-INF/container.xml`
- [x] 15.3 Implement OPF parser in `src/plugin/epub/opf.ts` — parse manifest (item id → href map), parse spine (reading order), extract metadata (title, author)
- [x] 15.4 Implement NCX/nav TOC parser in `src/plugin/epub/toc.ts` — extract hierarchical TOC, produce `FolioNode[]` tree structure
- [x] 15.5 Implement asset resolver in `src/plugin/epub/assets.ts` — scan chapter HTML for relative `src`/`href`, create blob URLs from ZIP entries, rewrite references. Track blob URLs for cleanup.
- [x] 15.6 Implement spine-to-tree builder: map spine items to `FolioNode` leaves with `fetch()` returning pre-extracted HTML, nest under TOC hierarchy
- [x] 15.7 Implement blob URL cleanup: revoke all blob URLs on unmount via cleanup callback
- [x] 15.8 Implement `<EpubControls />` panel in `src/plugin/epub/EpubControls.tsx` — TOC navigation extracted from NCX/nav
- [x] 15.9 Implement `createEpubPlugin()` async factory in `src/plugin/epub/index.ts` — returns `Promise<{ plugin, tree }>`, handles partial parse errors with warnings
- [x] 15.10 Write tests for epub parser: container.xml parsing, OPF manifest/spine extraction, NCX TOC parsing, asset URL rewriting

## 16. Mobile and Accessibility

- [x] 16.1 Apply mobile safe area CSS: `padding` using `env(safe-area-inset-*)` on the folio container, handle orientation changes via `ResizeObserver`
- [x] 16.2 Implement keyboard navigation in page mode: left arrow / Page Up = previous page, right arrow / Page Down = next page

## 17. Validation

- [x] 17.1 Run `bun test` in `package/folio` — all unit tests pass
- [x] 17.2 Run workspace build verification — `@rezics/folio` compiles without TypeScript errors
- [x] 17.3 Verify `@rezics/editor/markdown` imports resolve: `createNovelRenderer`, `highlightCode`, `addCopyButtons` are importable from `package/folio`
- [x] 17.4 Run `bun run knip` at repo root — no unused export warnings introduced by the new package
