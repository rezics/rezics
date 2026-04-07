## Why

The markdown editor's dual-column mode has three usability problems: the editor and preview panes scroll independently with no synchronization, making it difficult to correlate source text with rendered output; in resizable mode, the container's minimum height does not account for the header, allowing the content area to shrink below a usable size; and CodeMirror does not stretch to fill its container in fixed-height/resizable mode, leaving dead space below the content that is not clickable or editable.

## What Changes

- Add bidirectional line-based scroll synchronization between the CodeMirror editor and the markdown-it preview in dual-column mode.
- Inject `data-source-line` attributes into preview HTML via a markdown-it plugin, leveraging existing `token.map` source-line metadata on block tokens.
- Listen to scroll events on both the CodeMirror `scrollDOM` and the preview container, mapping visible lines between the two panes.
- Include scroll-loop prevention (a `syncSource` guard) and post-re-render scroll restoration via MutationObserver to handle `innerHTML` replacement on content changes.
- Track last editor top line and restore preview scroll position on view mode switch (e.g., write → dual) using `requestAnimationFrame`.
- Use direct `scrollDOM.scrollTop` assignment instead of `EditorView.scrollIntoView()` for preview → editor sync to prevent scroll leaking to parent containers.
- Add `overscroll-behavior: contain` on both editor and preview scroll containers to prevent scroll chaining.
- Adjust `ResizableWrapper` so the container's effective `minHeight` accounts for the header height, ensuring the content area is always >= the configured editor minimum height.
- Add a conditional CodeMirror extension that makes `.cm-editor` and `.cm-scroller` stretch to fill the container in fixed-height/resizable mode, so the entire editor area is clickable and editable.
- Add CSS containment rules and focus management to prevent enter key from causing editor blur.

## Capabilities

### New Capabilities

- `editor-scroll-sync`: Bidirectional line-based scroll synchronization between CodeMirror editor and markdown-it preview in dual-column mode.

### Modified Capabilities

- `editor-markdown-preview`: The preview renderer gains a `data-source-line` injection plugin for scroll sync support.
- `editor-core`: `ResizableWrapper` minHeight calculation updated to account for header height. CodeMirror gains a conditional fixed-height extension that stretches the editor to fill its container.

## Impact

- **Affected package**: `package/editor` only — all changes are internal to the editor library.
- **New files**:
  - `package/editor/src/react/useScrollSync.ts` — Bidirectional scroll sync hook
  - `package/editor/src/markdown/preview/sourceLine.ts` — markdown-it source-line injection plugin
  - `package/editor/src/markdown/preview/sourceLine.test.ts` — Unit tests for source-line plugin
  - `package/editor/src/core/fixedHeight.ts` — Conditional CodeMirror fixed-height extension
- **Modified files**:
  - `MarkdownEditor.tsx` — Wire scroll sync, measure header height, focus management, CSS containment
  - `MarkdownEditor.css` — `overscroll-behavior: contain` on editor and preview panes
  - `Editor.tsx` — Conditional `fixedHeightEditor` extension
  - `useEditor.ts` — Extra extensions support
  - `preserveFormatting.ts` — Register `sourceLinePlugin` in `createNovelRenderer`
- **No API changes**: No changes to `MarkdownEditorProps` or any public exports. Scroll sync activates automatically in dual-column mode.
- **No breaking changes**.
- **No new dependencies**.
- **Backward compatibility**: Fully backward-compatible. Scroll sync is internal to dual mode; resize behavior only changes minimum clamping.
