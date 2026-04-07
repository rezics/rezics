## 1. Source-line attribute injection

- [x] 1.1 Create `sourceLinePlugin` markdown-it plugin in `package/editor/src/markdown/preview/sourceLine.ts` that iterates block tokens with `token.map` and injects `data-source-line` attributes into their rendered opening tags
- [x] 1.2 Register `sourceLinePlugin` in `createNovelRenderer` (in `preserveFormatting.ts`) so all preview output includes source-line annotations
- [x] 1.3 Verify the plugin composes correctly with `novelModePlugin` — render sample markdown and confirm `data-source-line` attributes appear on `<p>`, `<h1>`–`<h6>`, `<pre>`, `<ul>`, `<ol>`, `<blockquote>` elements (unit test added in `sourceLine.test.ts`)

## 2. Scroll sync hook

- [x] 2.1 Create `useScrollSync` hook in `package/editor/src/react/useScrollSync.ts` accepting `EditorView | null`, `RefObject<HTMLDivElement>` (preview ref), and `ViewMode`
- [x] 2.2 Implement editor → preview sync: on CodeMirror scroll, read top visible line via `view.lineBlockAtHeight(view.scrollDOM.scrollTop)`, find the matching `[data-source-line]` element in preview, and scroll it into view
- [x] 2.3 Implement preview → editor sync: on preview scroll, find the topmost visible `[data-source-line]` element via `getBoundingClientRect()`, extract its line number, and scroll the editor to that line via direct `scrollDOM.scrollTop` assignment (avoids parent scroll leak)
- [x] 2.4 Implement scroll loop prevention using a `syncSourceRef` guard that suppresses echo events for ~50ms after each sync cycle
- [x] 2.5 Implement post-re-render scroll restoration: MutationObserver on preview container restores scroll position after innerHTML replacement

## 3. Wire scroll sync into MarkdownEditor

- [x] 3.1 Integrate `useScrollSync` in `MarkdownEditor.tsx` — pass `view`, `previewRef`, and `viewMode` to the hook
- [x] 3.2 Ensure scroll sync activates only in dual-column mode and all listeners are cleaned up on mode change

## 4. ResizableWrapper minHeight fix

- [x] 4.1 Add a ref to the header element in `MarkdownEditor.tsx` and measure its height after mount
- [x] 4.2 Pass the adjusted `minHeight` (configured min + header height) to `ResizableWrapper` via the `config` prop
- [x] 4.3 Add a `ResizeObserver` on the header element to recalculate effective minHeight when the header resizes (e.g., toolbar wrapping)

## 5. Fixed-height CodeMirror extension

- [x] 5.1 Create `fixedHeightEditor` extension in `package/editor/src/core/fixedHeight.ts` that returns an `EditorView.theme()` setting `& { height: 100% }` and `.cm-scroller { overflow: auto }`
- [x] 5.2 Conditionally include `fixedHeightEditor` in `useEditor` or the editor components when `resize` is provided — ensure it is NOT applied in free-flowing mode
- [x] 5.3 Remove `overflow: auto` from the content area container div in `MarkdownEditor.tsx` and `Editor.tsx` when in resize mode (CM's `.cm-scroller` handles scrolling now)
- [x] 5.4 Verify dual-column mode: both editor pane and preview pane fill available height and scroll independently

## 6. Bug fixes (post-implementation)

- [x] 6.1 Fix preview → editor scroll leaking to parent page: replaced `EditorView.scrollIntoView()` dispatch with direct `scrollDOM.scrollTop = block.top` assignment to keep scroll contained within the editor pane (`3f818907`)
- [x] 6.2 Fix enter key causing editor blur: added CSS containment rules and focus management in MarkdownEditor (`61c9e0bd`)
- [x] 6.3 Sync preview scroll position on mode switch: track last editor top line in `lastEditorLineRef` and restore preview scroll via `requestAnimationFrame` when switching back to dual mode (`efeb5f3d`)
- [x] 6.4 Add `overscroll-behavior: contain` on both `.cm-scroller` and `.md-editor-preview` to prevent scroll chaining to parent

## 7. Validation

- [x] 7.1 Build the `package/editor` package and confirm no type errors
- [x] 7.2 Unit test: `sourceLine.test.ts` validates attribute injection on headings, paragraphs, lists, blockquotes, and code blocks
- [x] 7.3 Manual test: dual-column scroll sync works bidirectionally
- [x] 7.4 Manual test: preview scroll position preserved after content re-render
- [x] 7.5 Manual test: resize to minimum height keeps content area usable
- [x] 7.6 Manual test: entire editor height is clickable in fixed-height mode
- [x] 7.7 Manual test: without `resize` prop, editor sizes to content (no fixed height)
