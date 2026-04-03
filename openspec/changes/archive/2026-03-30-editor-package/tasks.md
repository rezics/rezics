## 1. Package Setup

- [x] 1.1 Update `package/editor/package.json` with dependencies: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/lang-markdown`, `@codemirror/lang-json`, `@lezer/markdown`, `markdown-it`; peer deps: `react`, `react-dom`; dev deps: `@types/markdown-it`
- [x] 1.2 Update `package/editor/tsconfig.json` for TypeScript ESM with proper paths and JSX support
- [x] 1.3 Update `package/editor/vite.config.ts` as a library build with external peer deps and multiple entry points (`index`, `markdown`, `json`)
- [x] 1.4 Create `src/index.ts` with public API barrel exports
- [x] 1.5 Run `bun install` and verify clean build with `bun run build` in `package/editor`

## 2. Core — Types and Plugin Interface

- [x] 2.1 Create `src/core/types.ts` — define `EditorPlugin`, `EditorPluginFactory<T>`, `EditorConfig` types
- [x] 2.2 Create `src/core/plugin.ts` — implement `resolvePlugins()` that collects extensions, keybindings, and toolbar items from an array of `EditorPlugin`
- [x] 2.3 Create `src/core/keybindings.ts` — implement `mergeKeybindings()` with three-layer precedence (consumer `Prec.highest`, plugin `Prec.default`, built-ins `Prec.low`)
- [x] 2.4 Create `src/core/theme.ts` — implement `createTheme()` helper wrapping `EditorView.theme()` with variant support (light/dark)
- [x] 2.5 Create `src/core/create.ts` — implement `createEditor()` factory that takes parent element, doc, plugins, consumer keybindings, and theme; returns `EditorView`

## 3. React Integration Layer

- [x] 3.1 Create `src/react/context.ts` — define `EditorContext` providing `EditorView | null`
- [x] 3.2 Create `src/react/useEditor.ts` — hook managing EditorView lifecycle (create on mount, destroy on unmount), exposing container ref callback and view ref
- [x] 3.3 Create `src/react/Editor.tsx` — `<Editor />` component accepting `value`, `onChange`, `plugins`, `keybindings`, `toolbar`, `theme`; wires `useEditor` + `EditorContext.Provider`
- [x] 3.4 Create `src/react/index.ts` — export `Editor`, `useEditor`, `EditorContext`
- [x] 3.5 Verify `<Editor />` renders a basic CM6 instance with no plugins (manual test or minimal test file)

## 4. Toolbar System

- [x] 4.1 Create `src/toolbar/types.ts` — define `ToolbarItem`, `ToolbarGroup`, `ToolbarConfig`, separator type
- [x] 4.2 Create `src/toolbar/panel/index.ts` — implement CM6 `showPanel` toolbar variant; renders `ToolbarItem[]` as DOM buttons, handles `isActive` state via `EditorView.updateListener`
- [x] 4.3 Create `src/toolbar/react/index.ts` — implement React toolbar component; reads `EditorView` from `EditorContext`, syncs active states via `updateListener`, dispatches commands on click
- [x] 4.4 Create `src/toolbar/index.ts` — export both variants and a `createToolbarExtension(items, variant)` factory
- [x] 4.5 Wire toolbar variant selection into `src/react/Editor.tsx` — collect plugin toolbar items and render chosen variant

## 5. Markdown Core Plugin

- [x] 5.1 Create `src/markdown/core/commands.ts` — implement `toggleBold`, `toggleItalic`, `toggleStrikethrough`, `toggleHeading`, `toggleBlockquote`, `toggleUnorderedList`, `toggleOrderedList`, `toggleCode`, `toggleCodeBlock`, `insertLink`, `insertImage`, `insertTable`
- [x] 5.2 Create `src/markdown/core/language.ts` — configure `@codemirror/lang-markdown` with `@lezer/markdown`
- [x] 5.3 Create `src/markdown/core/keybindings.ts` — register `Mod-b` → bold, `Mod-i` → italic, `Mod-k` → link, `Mod-e` → code as default-priority keybindings
- [x] 5.4 Create `src/markdown/core/index.ts` — export `markdown()` plugin factory returning `EditorPlugin`
- [x] 5.5 Create `src/markdown/toolbar/index.ts` — define default `ToolbarItem[]` for markdown (bold, italic, heading, |, quote, ul, ol, |, link, image, table, |, code)
- [x] 5.6 Write tests for markdown commands (toggle bold on/off, toggle with selection, toggle without selection)

## 6. Markdown Preview Plugin

- [x] 6.1 Create `src/markdown/preview/preserveFormatting.ts` — rewrite `preserveFormattingPlugin` in plain TypeScript: empty-line rule (~10 lines) and space-preservation rule (~30 lines), no `effect` dependency
- [x] 6.2 Write tests for `preserveFormatting` — multiple blank lines, multiple spaces, standard paragraph break unaffected, options toggle
- [x] 6.3 Create `src/markdown/preview/preview.ts` — implement preview CM6 panel extension using `markdown-it` with `preserveFormatting` plugin; support side-by-side and toggle modes, debounced updates
- [x] 6.4 Create `src/markdown/preview/index.ts` — export `preview()` plugin factory with toolbar items (Preview toggle, Side-by-side toggle)

## 7. Mention Plugin

- [x] 7.1 Create `src/markdown/mention/types.ts` — define `MentionItem` (`id`, `label`, plus extensible fields), `MentionConfig` (`source`, optional `renderItem`, optional `formatMention`)
- [x] 7.2 Create `src/markdown/mention/mention.ts` — implement CM6 autocompletion source: `@`-trigger detection (after whitespace/punctuation/line start), async source query, keyboard navigation (ArrowUp/Down, Enter/Tab, Escape), insertion with configurable format
- [x] 7.3 Create `src/markdown/mention/index.ts` — export `mention()` plugin factory
- [x] 7.4 Write tests for mention trigger detection (valid triggers, mid-word rejection, query extraction)

## 8. Emoji Plugin

- [x] 8.1 Create `src/markdown/emoji/emoji.ts` — implement headless emoji plugin: open/close state management, toolbar button, insertion at cursor/replacing selection, close on scroll, consumer-provided `renderPicker` callback
- [x] 8.2 Create `src/markdown/emoji/index.ts` — export `emoji()` plugin factory
- [x] 8.3 Write tests for emoji insertion logic (insert at cursor, replace selection)

## 9. Markdown Full Preset

- [x] 9.1 Create `src/markdown/index.ts` — implement `markdownFull()` factory that bundles core + conditionally includes mention, emoji, preview based on config
- [x] 9.2 Verify `markdownFull()` with no options returns only core plugin
- [x] 9.3 Verify `markdownFull({ mention: { source }, emoji: { renderPicker }, preview: true })` returns all plugins

## 10. JSON Core Plugin

- [x] 10.1 Create `src/json/core/language.ts` — configure `@codemirror/lang-json`
- [x] 10.2 Create `src/json/core/commands.ts` — implement `formatJson` command using `JSON.stringify(JSON.parse(text), null, 2)`; on parse failure, trigger lint refresh without modifying content
- [x] 10.3 Create `src/json/core/keybindings.ts` — register `Shift-Mod-f` → `formatJson` as default keybinding
- [x] 10.4 Create `src/json/core/index.ts` — export `json()` plugin factory
- [x] 10.5 Create `src/json/toolbar/index.ts` — define `ToolbarItem[]` for JSON (Format button)
- [x] 10.6 Write tests for `formatJson` (valid JSON formats correctly, invalid JSON is not modified)

## 11. JSON Lint Plugin

- [x] 11.1 Create `src/json/lint/lint.ts` — implement JSON linting using `@codemirror/lint`; parse content with `JSON.parse`, convert errors to lint diagnostics with position
- [x] 11.2 Create `src/json/lint/index.ts` — export `jsonLint()` plugin factory
- [x] 11.3 Write tests for JSON linting (valid JSON = no diagnostics, invalid JSON = diagnostic at error position)

## 12. JSON Full Preset

- [x] 12.1 Create `src/json/index.ts` — implement `jsonFull()` factory bundling core + lint (lint disablable via `{ lint: false }`)
- [x] 12.2 Verify `jsonFull()` includes lint by default and `jsonFull({ lint: false })` excludes it

## 13. Public API and Build Verification

- [x] 13.1 Finalize `src/index.ts` — export `Editor`, `useEditor`, `EditorContext`, `createEditor`, `createTheme`, `EditorPlugin` type, `markdownFull`, `jsonFull`, and granular plugin factories (`markdown`, `preview`, `mention`, `emoji`, `json`, `jsonLint`)
- [x] 13.2 Verify full build passes: `bun run build` in `package/editor`
- [x] 13.3 Verify all tests pass: `bun test` in `package/editor`
- [x] 13.4 Verify tree-shaking: importing only `@rezics/editor/json` does not pull in markdown dependencies (inspect build output)
