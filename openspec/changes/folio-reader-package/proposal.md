## Why

The REZICS platform manages book content (chapters, metadata, reading lists) but has no built-in reading experience. Users currently rely on external tools to consume content. A first-party reader package closes this gap — allowing `@rezics/app` (and future consumers) to offer a mobile-first, paginated reading experience directly within the platform.

Building it as a standalone package (`@rezics/folio`) keeps the reader decoupled from any single app, enables independent versioning, and allows the rendering + pagination engine to be reused across different frontends.

## What Changes

- **New package `package/folio`** (`@rezics/folio`) — a pluggable web reader component library
- **Provider-driven chapter tree** — consumers supply a tree-structured table of contents where each leaf node carries its own async fetch method. Folio navigates the tree and lazy-loads content on demand.
- **CSS Multi-Column pagination** — page mode uses CSS columns for layout; scroll mode is plain vertical overflow
- **Ghost Snapshot page-turn animation** — cloned DOM snapshot animated via Web Animations API (WAAPI), zero animation library dependency
- **Gesture layer** — swipe and tap-zone navigation via `@use-gesture/react`
- **Built-in txt plugin** — tree builder (regex-based chapter splitting), renderer (plain text via `@rezics/editor` novel renderer), and Settings panel with regex configuration UI
- **Built-in epub plugin** — lightweight DIY parser (fflate + fast-xml-parser), extracts spine items as HTML chapters with blob URL asset resolution
- **Collapsible TOC panel** — renders the chapter tree with depth-based background banding, collapse/expand per branch and globally
- **Progress system** — events out (`onProgressChange`), position in (`initialPosition`), stable restoration via chapter `id` (unitID) with index fallback
- **Rendering via `@rezics/editor`** — uses `createNovelRenderer()` and related standalone utilities from `@rezics/editor/markdown` for content display

## Non-goals

- HTML source plugin (deferred — not needed for initial release)
- npm publishing (deferred until `@rezics/editor` is also publishable)
- Annotation, highlighting, or bookmarking UI (consumer responsibility)
- Offline/service-worker caching (consumer responsibility)
- Server-side rendering

## Capabilities

### New Capabilities

- `folio-core`: Package scaffold, core types (FolioNode, FolioContent, FolioState, FolioPosition, FolioProgress), FolioContext provider, useFolio hook, plugin registry (renderer plugins only)
- `folio-pagination`: CSS Multi-Column page mode, scroll mode, page count calculation, resize/font-load recalculation
- `folio-ghost-snapshot`: Ghost Snapshot page-turn animation engine using WAAPI, configurable turn styles (rotate, slide, fade)
- `folio-gesture`: Gesture layer — swipe navigation via @use-gesture/react, tap zones (left 30% prev, right 30% next, center toggle UI)
- `folio-tree-navigation`: Tree flattening to reading order, seamless chapter auto-advance, prefetch at configurable threshold, position restoration (id-first, index-fallback), collapsible TOC panel
- `folio-plugin-txt`: Built-in txt plugin — regex-based chapter splitting (tree builder), plain text renderer via @rezics/editor novel renderer, Settings panel with regex configuration/test/preview UI, re-split with tree change callback
- `folio-plugin-epub`: Built-in epub plugin — DIY ZIP/OPF/spine parser (fflate + fast-xml-parser), HTML chapter extraction with blob URL asset resolution, TOC Controls panel from NCX/nav document

### Modified Capabilities

_(none — this is a new package with no changes to existing specs)_

## Impact

### Affected packages

| Package | Change |
|---|---|
| `package/folio/` | **New** — entire package |
| `package/app/` | New consumer — integrates `<Folio />` into reading routes |
| `package/editor/` | No code changes — folio consumes existing `@rezics/editor/markdown` exports (`createNovelRenderer`, `highlightCode`, `addCopyButtons`, `novelModePlugin`) |
| `package/contract/` | May extend `ChapterTreeItem` or add folio-related types if shared between server and app |

### New dependencies

| Dependency | Package | Role |
|---|---|---|
| `@use-gesture/react` | `@rezics/folio` | Swipe + tap gesture detection |
| `fflate` | `@rezics/folio` | ZIP extraction for epub parsing |
| `fast-xml-parser` | `@rezics/folio` | OPF/NCX XML parsing for epub |

### Peer dependencies

| Dependency | Version |
|---|---|
| `react` | `>=18` |
| `react-dom` | `>=18` |
| `@rezics/editor` | `workspace:*` |

### Backward compatibility

- No breaking changes to any existing package
- `@rezics/folio` is entirely additive
- `package/app` integration is new route/feature, not a modification of existing behavior
