## Context

The `package/editor` markdown editor supports a dual-column mode where the CodeMirror editor and a markdown-it HTML preview sit side-by-side. Currently:

- Each pane has independent `overflow: auto` with no scroll coordination.
- `ResizableWrapper` clamps the container height between `minHeight` and `maxHeight`, but does not account for the header bar (~40px), so the content area can shrink below the intended minimum.

The editor is used across the app for chapter editing, reviews, quotes, and comments via the `RezicsMarkdownEditor` wrapper (default: 300px initial, 150–800px range).

## Goals / Non-Goals

**Goals:**

- Bidirectional line-based scroll sync in dual-column mode so scrolling either pane updates the other.
- Ensure the resizable container's minimum height guarantees the content area is always >= the configured `minHeight`.

**Non-Goals:**

- Scroll sync in non-dual modes (write-only, preview-only, fullscreen).
- Sub-block-level scroll precision (e.g., syncing within a long paragraph).
- Debounced or throttled preview re-rendering (separate concern).
- Changing the public `MarkdownEditorProps` or `ResizeConfig` API.

## Decisions

### 1. Line-based sync via `data-source-line` attributes

**Choice:** Inject `data-source-line` attributes on block-level HTML elements during markdown-it rendering, then use these as anchors for bidirectional mapping.

**Why:** markdown-it already computes `token.map` (source line ranges) for every block token. This is the same metadata used by `preserveFormatting.ts`. Annotating the rendered HTML with these line numbers creates a natural bridge between source and preview without any external mapping table.

**Alternatives considered:**
- *Proportional scroll* (map scroll percentages): Simple but drifts badly when content has uneven height distribution (images, code blocks, tables).
- *Heading-anchor sync*: Accurate at heading boundaries but useless for flat content without headings.

### 2. Scroll direction: editor → preview and preview → editor

**Choice:** Fully bidirectional. Whichever pane the user scrolls becomes the "source" and drives the other.

**Implementation:** A `syncSourceRef` (mutable ref, not state) tracks which pane initiated the current sync cycle. When pane A fires a scroll event:
1. If `syncSourceRef.current === 'B'`, ignore (this is an echo from syncing B → A).
2. Set `syncSourceRef.current = 'A'`.
3. Compute the target scroll position for pane B and apply it.
4. Clear `syncSourceRef` after a short timeout (~50ms) to re-enable normal listening.

This prevents infinite loops without requiring complex debounce logic.

### 3. CodeMirror scroll observation

**Choice:** Use `EditorView.domEventHandlers({ scroll })` as a CM6 extension to listen for scroll events on CodeMirror's scroll DOM.

**Why:** This integrates cleanly into the existing plugin/extension architecture. The handler reads `view.lineBlockAtHeight(view.scrollDOM.scrollTop)` to determine the top visible document line, then finds the matching `data-source-line` element in the preview.

### 4. Preview → editor sync

**Choice:** Attach a native `scroll` event listener to the preview container div. On scroll, find the topmost visible `[data-source-line]` element using `getBoundingClientRect()` comparison, extract its line number, and scroll the CodeMirror editor to that line via `view.dispatch({ effects: EditorView.scrollIntoView(linePos) })`.

### 5. Post-re-render scroll restoration

**Choice:** After the preview `innerHTML` is replaced (on content change in dual mode), re-apply sync from the editor's current scroll position in a microtask (`queueMicrotask`).

**Why:** `innerHTML` replacement resets `scrollTop` to 0. A microtask ensures the DOM has settled before we read positions and apply the scroll correction. This avoids a visible flash.

### 6. Scroll sync as a dedicated hook

**Choice:** Extract all sync logic into a `useScrollSync(editorView, previewRef, viewMode)` hook in `package/editor/src/react/`.

**Why:** Keeps `MarkdownEditor.tsx` clean. The hook encapsulates all event listener setup/teardown, the sync guard, and the post-render restoration. It activates only when `viewMode === 'dual'` and both refs are available.

### 7. Source-line injection as a markdown-it plugin

**Choice:** Create a `sourceLinePlugin` for markdown-it that iterates block tokens and injects `data-source-line="N"` attributes into their opening HTML tags during rendering.

**Why:** Keeps the annotation logic decoupled from the scroll sync logic. The plugin is composable with the existing `novelModePlugin` pipeline and produces self-describing HTML that could be useful for other features (e.g., click-to-edit).

### 8. Fixed-height CodeMirror extension

**Choice:** Create a small `EditorView.theme()` extension that sets `height: 100%` on `&` (`.cm-editor`) and `overflow: auto` on `.cm-scroller`. This extension is applied conditionally — only when the editor is in fixed-height/resizable mode.

**Why:** By default, CodeMirror sizes `.cm-editor` to its content height. In fixed-height mode, the container has an explicit height from `ResizableWrapper`, but the CM editor inside it doesn't stretch to fill it. This leaves dead space below the last line of content that is not part of the editor — clicking it does nothing, and the editor area appears smaller than the configured minimum.

Setting `height: 100%` on `.cm-editor` makes it fill the flex container. Moving `overflow: auto` to `.cm-scroller` (instead of the parent div) ensures CodeMirror handles its own scrolling, which means clicking anywhere in the editor area — including below the last line — focuses the editor and places the cursor correctly.

**Alternatives considered:**
- *CSS from parent targeting `.cm-editor`*: Works but mixes concerns; the editor should own its sizing.
- *Adding height styles to `createTheme()`*: Would always apply; we only want this in resize mode.
- *Passing a `fixedHeight` flag to `createTheme()`*: Viable but couples theming to layout concerns.

**Implementation:** A new export `fixedHeightEditor` in `package/editor/src/core/` that returns an `Extension`. The `useEditor` hook or the `MarkdownEditor`/`Editor` components conditionally include it in their extension array when `resize` is provided.

### 9. ResizableWrapper minHeight adjustment

**Choice:** Measure the header height via a ref on the header element and pass it to `ResizableWrapper` so the effective `minHeight` becomes `configuredMinHeight + headerHeight`. This ensures the content area below the header never drops below the configured minimum.

**Why:** Simple, no API changes needed. The header ref is already adjacent to the content area in `MarkdownEditor.tsx`. The measured value is passed as a prop adjustment, not a new config field.

### 10. Direct scrollTop assignment for preview → editor sync

**Choice:** Use `scrollDOM.scrollTop = block.top` instead of `view.dispatch({ effects: EditorView.scrollIntoView(...) })` for preview → editor sync.

**Why:** `EditorView.scrollIntoView` dispatches a transaction that can propagate scroll effects to ancestor containers, causing the entire page to jump. Direct `scrollTop` assignment on the editor's own scroll DOM keeps the scroll contained within the editor pane.

### 11. Scroll position restoration on mode switch

**Choice:** Track the editor's last top visible line in a `lastEditorLineRef` and restore preview scroll via `requestAnimationFrame` when switching back to dual mode.

**Why:** When the editor pane is `display: none` (preview-only mode), CodeMirror loses its scroll state. When switching back to dual mode, the preview would show position 0. By tracking the last known line and restoring after the DOM settles via RAF, the user sees a seamless transition.

### 12. Overscroll containment CSS

**Choice:** Apply `overscroll-behavior: contain` on both `.cm-scroller` and `.md-editor-preview` via CSS.

**Why:** Without containment, when a user scrolls to the end of either pane, the browser chains the scroll event to the parent page. This is jarring in an embedded editor context. CSS containment is the simplest and most reliable prevention.

### 13. Focus management for enter key

**Choice:** Add CSS containment rules and explicit focus management in `MarkdownEditor.tsx` to prevent the enter key from causing editor blur.

**Why:** In certain layout configurations, pressing enter would cause the CodeMirror editor to lose focus as the DOM restructured. Containment rules ensure layout changes from new lines stay isolated within the editor boundary.

## Risks / Trade-offs

**Block-level granularity** → For very long paragraphs without internal block boundaries, sync snaps to the paragraph start. Mitigation: acceptable for structured book content; sub-block sync would require a custom markdown-it token splitter which adds complexity without proportional UX gain.

**`innerHTML` replacement flicker** → Between the moment `innerHTML` is set and the microtask fires, the preview briefly sits at `scrollTop: 0`. Mitigation: the microtask fires before the next paint in practice, so the flash is invisible. If it becomes visible on slow devices, a future optimization could diff the DOM instead of replacing it.

**Header height measurement timing** → The header height is measured after mount. If the toolbar wraps to multiple lines (very narrow viewport), the measured height could be stale. Mitigation: re-measure on resize via a `ResizeObserver` on the header element.
