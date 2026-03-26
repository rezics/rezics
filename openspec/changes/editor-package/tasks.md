## 1. Package Setup

- [ ] 1.1 Update `package/editor/package.json` with dependencies: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/lang-markdown`, `@codemirror/lang-json`, `@lezer/markdown`, `markdown-it`; peer deps: `react`, `react-dom`; dev deps: `@types/markdown-it`
- [ ] 1.2 Update `package/editor/tsconfig.json` for TypeScript ESM with proper paths and JSX support
- [ ] 1.3 Update `package/editor/vite.config.ts` as a library build with external peer deps and multiple entry points (`index`, `markdown`, `json`)
- [ ] 1.4 Create `src/index.ts` with public API barrel exports
- [ ] 1.5 Run `bun install` and verify clean build with `bun run build` in `package/editor`

## 2. Core — Types and Plugin Interface

- [ ] 2.1 Create `src/core/types.ts` — define `EditorPlugin`, `EditorPluginFactory<T>`, `EditorConfig` types
- [ ] 2.2 Create `src/core/plugin.ts` — implement `resolvePlugins()` that collects extensions, keybindings, and toolbar items from an array of `EditorPlugin`
- [ ] 2.3 Create `src/core/keybindings.ts` — implement `mergeKeybindings()` with three-layer precedence (consumer `Prec.highest`, plugin `Prec.default`, built-ins `Prec.low`)
- [ ] 2.4 Create `src/core/theme.ts` — implement `createTheme()` helper wrapping `EditorView.theme()` with variant support (light/dark)
- [ ] 2.5 Create `src/core/create.ts` — implement `createEditor()` factory that takes parent element, doc, plugins, consumer keybindings, and theme; returns `EditorView`

## 3. React Integration Layer

- [ ] 3.1 Create `src/react/context.ts` — define `EditorContext` providing `EditorView | null`
- [ ] 3.2 Create `src/react/useEditor.ts` — hook managing EditorView lifecycle (create on mount, destroy on unmount), exposing container ref callback and view ref
- [ ] 3.3 Create `src/react/Editor.tsx` — `<Editor />` component accepting `value`, `onChange`, `plugins`, `keybindings`, `toolbar`, `theme`; wires `useEditor` + `EditorContext.Provider`
- [ ] 3.4 Create `src/react/index.ts` — export `Editor`, `useEditor`, `EditorContext`
- [ ] 3.5 Verify `<Editor />` renders a basic CM6 instance with no plugins (manual test or minimal test file)

## 4. Toolbar System

- [ ] 4.1 Create `src/toolbar/types.ts` — define `ToolbarItem`, `ToolbarGroup`, `ToolbarConfig`, separator type
- [ ] 4.2 Create `src/toolbar/panel/index.ts` — implement CM6 `showPanel` toolbar variant; renders `ToolbarItem[]` as DOM buttons, handles `isActive` state via `EditorView.updateListener`
- [ ] 4.3 Create `src/toolbar/react/index.ts` — implement React toolbar component; reads `EditorView` from `EditorContext`, syncs active states via `updateListener`, dispatches commands on click
- [ ] 4.4 Create `src/toolbar/index.ts` — export both variants and a `createToolbarExtension(items, variant)` factory
- [ ] 4.5 Wire toolbar variant selection into `src/react/Editor.tsx` — collect plugin toolbar items and render chosen variant

## 5. Markdown Core Plugin

- [ ] 5.1 Create `src/markdown/core/commands.ts` — implement `toggleBold`, `toggleItalic`, `toggleStrikethrough`, `toggleHeading`, `toggleBlockquote`, `toggleUnorderedList`, `toggleOrderedList`, `toggleCode`, `toggleCodeBlock`, `insertLink`, `insertImage`, `insertTable`
- [ ] 5.2 Create `src/markdown/core/language.ts` — configure `@codemirror/lang-markdown` with `@lezer/markdown`
- [ ] 5.3 Create `src/markdown/core/keybindings.ts` — register `Mod-b` → bold, `Mod-i` → italic, `Mod-k` → link, `Mod-e` → code as default-priority keybindings
- [ ] 5.4 Create `src/markdown/core/index.ts` — export `markdown()` plugin factory returning `EditorPlugin`
- [ ] 5.5 Create `src/markdown/toolbar/index.ts` — define default `ToolbarItem[]` for markdown (bold, italic, heading, |, quote, ul, ol, |, link, image, table, |, code)
- [ ] 5.6 Write tests for markdown commands (toggle bold on/off, toggle with selection, toggle without selection)

## 6. Markdown Preview Plugin

- [ ] 6.1 Create `src/markdown/preview/preserveFormatting.ts` — rewrite `preserveFormattingPlugin` in plain TypeScript: empty-line rule (~10 lines) and space-preservation rule (~30 lines), no `effect` dependency
- [ ] 6.2 Write tests for `preserveFormatting` — multiple blank lines, multiple spaces, standard paragraph break unaffected, options toggle
- [ ] 6.3 Create `src/markdown/preview/preview.ts` — implement preview CM6 panel extension using `markdown-it` with `preserveFormatting` plugin; support side-by-side and toggle modes, debounced updates
- [ ] 6.4 Create `src/markdown/preview/index.ts` — export `preview()` plugin factory with toolbar items (Preview toggle, Side-by-side toggle)

## 7. Mention Plugin

- [ ] 7.1 Create `src/markdown/mention/types.ts` — define `MentionItem` (`id`, `label`, plus extensible fields), `MentionConfig` (`source`, optional `renderItem`, optional `formatMention`)
- [ ] 7.2 Create `src/markdown/mention/mention.ts` — implement CM6 autocompletion source: `@`-trigger detection (after whitespace/punctuation/line start), async source query, keyboard navigation (ArrowUp/Down, Enter/Tab, Escape), insertion with configurable format
- [ ] 7.3 Create `src/markdown/mention/index.ts` — export `mention()` plugin factory
- [ ] 7.4 Write tests for mention trigger detection (valid triggers, mid-word rejection, query extraction)

## 8. Emoji Plugin

- [ ] 8.1 Create `src/markdown/emoji/emoji.ts` — implement headless emoji plugin: open/close state management, toolbar button, insertion at cursor/replacing selection, close on scroll, consumer-provided `renderPicker` callback
- [ ] 8.2 Create `src/markdown/emoji/index.ts` — export `emoji()` plugin factory
- [ ] 8.3 Write tests for emoji insertion logic (insert at cursor, replace selection)

## 9. Markdown Full Preset

- [ ] 9.1 Create `src/markdown/index.ts` — implement `markdownFull()` factory that bundles core + conditionally includes mention, emoji, preview based on config
- [ ] 9.2 Verify `markdownFull()` with no options returns only core plugin
- [ ] 9.3 Verify `markdownFull({ mention: { source }, emoji: { renderPicker }, preview: true })` returns all plugins

## 10. JSON Core Plugin

- [ ] 10.1 Create `src/json/core/language.ts` — configure `@codemirror/lang-json`
- [ ] 10.2 Create `src/json/core/commands.ts` — implement `formatJson` command using `JSON.stringify(JSON.parse(text), null, 2)`; on parse failure, trigger lint refresh without modifying content
- [ ] 10.3 Create `src/json/core/keybindings.ts` — register `Shift-Mod-f` → `formatJson` as default keybinding
- [ ] 10.4 Create `src/json/core/index.ts` — export `json()` plugin factory
- [ ] 10.5 Create `src/json/toolbar/index.ts` — define `ToolbarItem[]` for JSON (Format button)
- [ ] 10.6 Write tests for `formatJson` (valid JSON formats correctly, invalid JSON is not modified)

## 11. JSON Lint Plugin

- [ ] 11.1 Create `src/json/lint/lint.ts` — implement JSON linting using `@codemirror/lint`; parse content with `JSON.parse`, convert errors to lint diagnostics with position
- [ ] 11.2 Create `src/json/lint/index.ts` — export `jsonLint()` plugin factory
- [ ] 11.3 Write tests for JSON linting (valid JSON = no diagnostics, invalid JSON = diagnostic at error position)

## 12. JSON Full Preset

- [ ] 12.1 Create `src/json/index.ts` — implement `jsonFull()` factory bundling core + lint (lint disablable via `{ lint: false }`)
- [ ] 12.2 Verify `jsonFull()` includes lint by default and `jsonFull({ lint: false })` excludes it

## 13. Public API and Build Verification

- [ ] 13.1 Finalize `src/index.ts` — export `Editor`, `useEditor`, `EditorContext`, `createEditor`, `createTheme`, `EditorPlugin` type, `markdownFull`, `jsonFull`, and granular plugin factories (`markdown`, `preview`, `mention`, `emoji`, `json`, `jsonLint`)
- [ ] 13.2 Verify full build passes: `bun run build` in `package/editor`
- [ ] 13.3 Verify all tests pass: `bun test` in `package/editor`
- [ ] 13.4 Verify tree-shaking: importing only `@package/editor/json` does not pull in markdown dependencies (inspect build output)
