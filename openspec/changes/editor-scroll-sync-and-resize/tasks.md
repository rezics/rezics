## 1. Source-line attribute injection

- [x] 1.1 Create `sourceLinePlugin` markdown-it plugin in `package/editor/src/markdown/preview/sourceLine.ts` that iterates block tokens with `token.map` and injects `data-source-line` attributes into their rendered opening tags
- [x] 1.2 Register `sourceLinePlugin` in `createNovelRenderer` (in `preserveFormatting.ts`) so all preview output includes source-line annotations
- [x] 1.3 Verify the plugin composes correctly with `novelModePlugin` — render sample markdown and confirm `data-source-line` attributes appear on `<p>`, `<h1>`–`<h6>`, `<pre>`, `<ul>`, `<ol>`, `<blockquote>` elements

## 2. Scroll sync hook

- [x] 2.1 Create `useScrollSync` hook in `package/editor/src/react/useScrollSync.ts` accepting `EditorView | null`, `RefObject<HTMLDivElement>` (preview ref), and `ViewMode`
- [x] 2.2 Implement editor → preview sync: on CodeMirror scroll, read top visible line via `view.lineBlockAtHeight(view.scrollDOM.scrollTop)`, find the matching `[data-source-line]` element in preview, and scroll it into view
- [x] 2.3 Implement preview → editor sync: on preview scroll, find the topmost visible `[data-source-line]` element via `getBoundingClientRect()`, extract its line number, and scroll the editor to that line via `EditorView.scrollIntoView`
- [x] 2.4 Implement scroll loop prevention using a `syncSourceRef` guard that suppresses echo events for ~50ms after each sync cycle
- [x] 2.5 Implement post-re-render scroll restoration: after preview `innerHTML` is replaced in dual mode, restore preview scroll position from the editor's current state via `queueMicrotask`

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

## 6. Validation

- [x] 5.1 Build the `package/editor` package (`bun run build` in `package/editor`) and confirm no type errors
- [ ] 6.2 Manual test: open dual-column mode, scroll the editor, confirm preview follows; scroll the preview, confirm editor follows
- [ ] 6.3 Manual test: type in the editor in dual mode, confirm preview scroll position is preserved after re-render
- [ ] 6.4 Manual test: resize the editor to its minimum height, confirm the content area remains usable (>= configured minHeight)
- [ ] 6.5 Manual test: with minimal content, confirm the entire editor height is clickable and places the cursor at the end of the document
- [ ] 6.6 Manual test: without `resize` prop, confirm the editor sizes to content (no fixed height)
