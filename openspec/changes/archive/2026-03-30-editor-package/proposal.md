## Why

The current editor landscape in the monorepo is fragmented: `EasyEditor` (EasyMDE/CodeMirror 5) handles Markdown, `JsonEditorLight` (plain MUI textarea) handles JSON, and both live inside `@package/ui` with no shared abstractions. EasyMDE is a CodeMirror 5 wrapper that is no longer actively maintained, and its imperative API leads to complex ref-juggling (the mention system alone is ~150 lines of ref synchronization). The JSON editor lacks syntax highlighting entirely.

A dedicated `@package/editor` built on CodeMirror 6 unifies both use cases under a single plugin-based architecture, enables future language support, and decouples editor functionality from the UI component library so it can eventually be published as an independent package.

## What Changes

- **New package `@package/editor`** — A standalone CodeMirror 6-based editor with a plugin architecture, React integration layer, and theming via CM6 theme extensions.
- **Plugin system** — Pragmatic hybrid: flat plugins at the core level, with language presets (`markdownFull()`, `jsonFull()`) that bundle sensible defaults.
- **Markdown support** — Language highlighting, editing commands (bold, italic, heading, link, etc.), default keybindings, and configurable toolbar items.
- **Markdown preview** — Side-by-side or toggle preview panel powered by a markdown-it rendering pipeline, including a rewritten `preserveFormatting` plugin (plain TypeScript, no `effect` dependency) that preserves Rezics-style whitespace and blank lines.
- **Mention plugin** — Headless `@`-trigger autocomplete. The plugin owns trigger detection, keyboard navigation, and insertion logic; consumers provide the data source (`async (query) => MentionItem[]`) and optional custom rendering.
- **Emoji plugin** — Headless emoji insertion. The plugin manages trigger and insertion state; consumers provide the picker UI via a render callback.
- **JSON support** — Syntax highlighting via `@codemirror/lang-json`, real-time linting via `@codemirror/lint`, and a `formatJson` command using `JSON.stringify(JSON.parse(text), null, indent)`.
- **Dual toolbar variants** — A CM6 panel-based toolbar (lives inside EditorView DOM) and a React-rendered toolbar (lives outside, communicates via context/ref). Swappable via configuration.
- **Keybinding system** — Three-layer resolution: consumer overrides (highest priority) > plugin defaults > CM6 built-ins. Plugins register sensible defaults; consumers can override any binding.
- **Custom React binding** — A lightweight `useEditor` hook and `<Editor />` component managing EditorView lifecycle directly, without `@uiw/react-codemirror`.

## Capabilities

### New Capabilities

- `editor-core`: Core editor foundation — EditorView/EditorState lifecycle, plugin interface, keybinding registry, CM6 theme system, and React integration (`useEditor`, `<Editor />`, `EditorContext`).
- `editor-toolbar`: Generic toolbar system with pluggable item definitions and two rendering variants (CM6 panel, React component).
- `editor-markdown`: Markdown language support — syntax highlighting, editing commands, default keybindings, toolbar items, and the `markdownFull()` preset bundle.
- `editor-markdown-preview`: Markdown preview panel powered by markdown-it, including the rewritten `preserveFormatting` plugin for Rezics-style whitespace preservation.
- `editor-mention`: Headless `@`-mention autocomplete plugin built on CM6 autocompletion, with consumer-provided data source and optional render customization.
- `editor-emoji`: Headless emoji insertion plugin with consumer-provided picker UI via render callback.
- `editor-json`: JSON language support — syntax highlighting, linting, `formatJson` command, default keybindings, toolbar items, and the `jsonFull()` preset bundle.

### Modified Capabilities

_(none — this is a new package with no changes to existing specs)_

## Impact

- **Affected packages**: `package/editor` (new, currently empty shell), `package/ui` (existing editor code becomes legacy, not removed in this change).
- **New dependencies**: `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/lang-markdown`, `@codemirror/lang-json`, `@lezer/markdown`, `markdown-it`. React as peer dependency.
- **No breaking changes** — The existing `EasyEditor` and `JsonEditorLight` in `@package/ui` remain untouched. Consumers migrate at their own pace.
- **Backward compatibility** — `@package/editor` is additive. No existing APIs change. Migration from `EasyEditor`/`JsonEditorLight` to the new editor is a separate future change.
- **Independence** — `@package/editor` has zero internal monorepo dependencies. It must remain publishable as a standalone npm package.
