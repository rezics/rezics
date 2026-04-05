## Why

The markdown editor's dual-column mode has two usability problems: the editor and preview panes scroll independently with no synchronization, making it difficult to correlate source text with rendered output; and in resizable mode, the container's minimum height does not account for the header, allowing the content area to shrink below a usable size.

## What Changes

- Add bidirectional line-based scroll synchronization between the CodeMirror editor and the markdown-it preview in dual-column mode.
- Inject `data-source-line` attributes into preview HTML via a markdown-it plugin, leveraging existing `token.map` source-line metadata on block tokens.
- Listen to scroll events on both the CodeMirror `scrollDOM` and the preview container, mapping visible lines between the two panes.
- Include scroll-loop prevention (a `syncSource` guard) and post-re-render scroll restoration to handle `innerHTML` replacement on content changes.
- Adjust `ResizableWrapper` so the container's effective `minHeight` accounts for the header height, ensuring the content area is always >= the configured editor minimum height.

## Capabilities

### New Capabilities

- `editor-scroll-sync`: Bidirectional line-based scroll synchronization between CodeMirror editor and markdown-it preview in dual-column mode.

### Modified Capabilities

- `editor-markdown-preview`: The preview renderer gains a `data-source-line` injection plugin for scroll sync support.
- `editor-core`: `ResizableWrapper` minHeight calculation updated to account for header height.

## Impact

- **Affected package**: `package/editor` only — all changes are internal to the editor library.
- **New files**: Scroll sync hook/utility within `package/editor/src/react/` or `package/editor/src/markdown/preview/`.
- **Modified files**: `MarkdownEditor.tsx` (wire scroll sync, measure header height), `ResizableWrapper.tsx` (minHeight adjustment), `preserveFormatting.ts` or new plugin file (source-line attribute injection).
- **No API changes**: No changes to `MarkdownEditorProps` or any public exports. Scroll sync activates automatically in dual-column mode.
- **No breaking changes**.
- **No new dependencies**.
- **Backward compatibility**: Fully backward-compatible. Scroll sync is internal to dual mode; resize behavior only changes minimum clamping.
