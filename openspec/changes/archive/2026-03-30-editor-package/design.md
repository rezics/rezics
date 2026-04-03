## Context

The monorepo currently has two editor implementations in `@rezics/ui`:

1. **EasyEditor** — Wraps EasyMDE (CodeMirror 5). ~410 lines with tightly coupled mention/emoji ref-juggling. Markdown only.
2. **JsonEditorLight** — MUI `TextField` with `react-json-view-lite` for preview. No syntax highlighting, no keyboard shortcuts.

Both are embedded in `@rezics/ui`, making it impossible to use editor functionality without pulling in the entire UI package. There is also an empty `package/editor` shell (package.json + vite config, no source).

CodeMirror 6 is a ground-up rewrite with a functional, immutable state model and a composable extension system. It replaces CM5's imperative API with transactions and facets, making it well-suited for a plugin architecture.

## Goals / Non-Goals

**Goals:**

- Provide a unified editor package (`@rezics/editor`) supporting Markdown and JSON via a plugin system.
- Design a plugin interface that maps cleanly to CM6's extension system while remaining ergonomic.
- Support two toolbar rendering strategies (CM6 panel and React component) swappable via configuration.
- Implement headless mention and emoji plugins that are domain-agnostic.
- Rewrite `preserveFormatting` as a clean markdown-it plugin without the `effect` dependency.
- Keep `@rezics/editor` fully independent — zero internal monorepo dependencies, publishable standalone.

**Non-Goals:**

- Migrating existing consumers from `EasyEditor`/`JsonEditorLight` (separate future change).
- Removing the existing editors from `@rezics/ui`.
- Collaborative editing or real-time sync (CRDT/OT).
- Supporting languages beyond Markdown and JSON in this change.
- Building a full-featured emoji picker — the plugin is headless, consumers provide the UI.
- Mobile-specific optimizations.

## Decisions

### 1. Direct CM6 integration instead of `@uiw/react-codemirror`

**Choice:** Custom `useEditor` hook (~100 lines) managing `EditorView` lifecycle directly.

**Alternatives considered:**
- `@uiw/react-codemirror`: Provides controlled value management, extension diffing, theme integration (~8KB gzipped). However, its opinionated extension update mechanism may conflict with our plugin system's extension merging. It also adds a dependency that complicates independent publishing.

**Rationale:** Full control over how extensions are composed and updated. The React binding is thin enough that maintaining it is cheaper than working around a wrapper's assumptions. Eliminates a third-party dependency for the publishability goal.

### 2. Pragmatic hybrid plugin architecture

**Choice:** Plugins are flat at the core level (any plugin works with any language). Language presets (`markdownFull()`, `jsonFull()`) bundle related plugins with sensible defaults.

```
// Fine-grained composition
<Editor plugins={[markdown(), mention({ source }), preview()]} />

// Preset bundle
<Editor plugins={[markdownFull({ mention: { source }, preview: true })]} />
```

**Alternatives considered:**
- Nested plugins (markdown hosts mention/emoji as sub-plugins): More coupling, less flexibility.
- Flat-only (no presets): Forces every consumer to assemble plugins manually.

**Rationale:** Flat plugins preserve composability (mention can theoretically work in any context), while presets provide the "just works" experience for common cases. Most consumers use the preset; advanced consumers compose freely.

### 3. Plugin interface

```ts
interface EditorPlugin {
  name: string
  extensions?: Extension | Extension[]
  keybindings?: KeyBinding[]
  toolbar?: ToolbarItem[]
}

type EditorPluginFactory<T = void> = (config?: T) => EditorPlugin
```

The core collects all plugins and merges:
- `extensions` → single `Extension[]` for `EditorState.create()`
- `keybindings` → merged keymap with consumer overrides at `Prec.highest`, plugin defaults at `Prec.default`, CM6 built-ins at `Prec.low`
- `toolbar` → fed to whichever toolbar variant is active

### 4. Dual toolbar variants

**Choice:** Two interchangeable toolbar renderers sharing the same `ToolbarItem[]` data.

- **CM6 Panel** (`toolbar="panel"`): Uses CM6's `showPanel` extension. Toolbar DOM lives inside the EditorView. Reflects editor state natively (e.g., bold button active when cursor is in bold text). Limited to DOM API for rendering.
- **React Toolbar** (`toolbar="react"`): A React component rendered outside the EditorView. Communicates with the editor via `EditorContext` (provides `EditorView` ref). Supports full React ecosystem — dropdowns, popovers, icons from any library. Requires an `updateListener` bridge to sync editor state to React.

**Rationale:** CM6 panel is simpler and tighter for basic toolbars. React toolbar is necessary for rich interactions (dropdown menus, color pickers, emoji pickers) that are awkward to build with raw DOM. Both consume the same plugin-contributed `ToolbarItem[]`, so switching is a one-prop change.

### 5. Headless mention and emoji plugins

**Choice:** Both plugins own editor integration logic only. External concerns are injected.

**Mention:**
```ts
mention({
  source: async (query: string) => MentionItem[],  // consumer provides
  renderItem?: (item: MentionItem) => ReactNode,    // optional custom rendering
})
```
Built on CM6's `@codemirror/autocomplete`. The plugin registers an autocompletion source triggered by `@`, handles keyboard navigation, and inserts the selected mention. The data source is fully external.

**Emoji:**
```ts
emoji({
  renderPicker: (onSelect: (emoji: string) => void, onClose: () => void) => ReactNode
})
```
The plugin manages open/close state and insertion. The picker UI is entirely consumer-provided.

**Rationale:** Keeps `@rezics/editor` domain-agnostic. No Rezics user API, no specific emoji dataset. Consumers wire in their data sources and UI components.

### 6. JSON formatting via `JSON.stringify`

**Choice:** `formatJson` command uses `JSON.stringify(JSON.parse(text), null, indent)`.

**Alternatives considered:**
- Lightweight formatter lib (e.g., `json-stringify-pretty-compact`): More control, extra dependency.
- Lezer parse tree reformat: Works on partial JSON, but significantly more code.

**Rationale:** Covers the vast majority of use cases with zero extra dependencies. When formatting fails (invalid JSON), the linter highlights the parse error via `@codemirror/lint`, giving clear feedback.

### 7. Preview pipeline with rewritten `preserveFormatting`

**Choice:** markdown-it renders preview HTML. A rewritten `preserveFormatting` plugin (plain TypeScript, ~60 lines) ensures Rezics-style whitespace is preserved.

The rewrite eliminates:
- `effect/Array`, `effect/Option`, `pipe()` — replaced with plain loops and string operations
- Over-abstracted token processing — simplified to two direct rules

The plugin lives in `markdown/preview/` since it only affects rendered output, not editor behavior.

### 8. Theming via CM6 theme extensions

**Choice:** `EditorView.theme()` for editor chrome. CSS variables for toolbar and preview panel styling.

```ts
import { createTheme } from '@rezics/editor'

const darkTheme = createTheme({
  variant: 'dark',
  settings: { background: '#1e1e1e', foreground: '#d4d4d4', ... },
  styles: [{ tag: tags.keyword, color: '#569cd6' }, ...]
})

<Editor theme={darkTheme} ... />
```

**Rationale:** CM6's theme system is the canonical way to style the editor. CSS variables for surrounding chrome (toolbar, preview) keep things simple without requiring a CSS-in-JS runtime.

## Architecture

```
@rezics/editor/src/
├── core/
│   ├── create.ts              EditorView + EditorState factory
│   ├── keybindings.ts         Keymap merging (3-layer resolution)
│   ├── theme.ts               createTheme() helper wrapping EditorView.theme()
│   ├── plugin.ts              EditorPlugin interface + resolution logic
│   └── types.ts               Shared types
│
├── toolbar/
│   ├── types.ts               ToolbarItem, ToolbarGroup, ToolbarConfig
│   ├── panel/index.ts         CM6 showPanel variant
│   ├── react/index.ts         React-rendered variant
│   └── index.ts
│
├── markdown/
│   ├── core/
│   │   ├── language.ts        @codemirror/lang-markdown + @lezer/markdown
│   │   ├── keybindings.ts     Mod-b, Mod-i, Mod-k, etc.
│   │   ├── commands.ts        toggleBold, toggleItalic, insertLink, etc.
│   │   └── index.ts
│   ├── toolbar/index.ts       Default ToolbarItem[] for markdown
│   ├── preview/
│   │   ├── preview.ts         CM6 panel rendering markdown-it output
│   │   ├── preserveFormatting.ts  Rewritten whitespace plugin
│   │   └── index.ts
│   ├── mention/
│   │   ├── mention.ts         CM6 autocompletion source
│   │   ├── types.ts           MentionItem, MentionConfig
│   │   └── index.ts
│   ├── emoji/
│   │   ├── emoji.ts           Headless trigger + insertion + state
│   │   └── index.ts
│   └── index.ts               markdownFull() bundle
│
├── json/
│   ├── core/
│   │   ├── language.ts        @codemirror/lang-json
│   │   ├── keybindings.ts     Shift-Mod-f → formatJson
│   │   ├── commands.ts        formatJson, validateJson
│   │   └── index.ts
│   ├── toolbar/index.ts       Default ToolbarItem[] for JSON
│   ├── lint/
│   │   ├── lint.ts            Real-time JSON validation
│   │   └── index.ts
│   └── index.ts               jsonFull() bundle
│
├── react/
│   ├── Editor.tsx             <Editor /> component
│   ├── useEditor.ts           EditorView lifecycle + imperative handle
│   ├── context.ts             EditorContext for toolbar ↔ view bridge
│   └── index.ts
│
└── index.ts                   Public API
```

### Data Flow

```
Consumer
  │
  ├── plugins={[markdownFull({ mention: { source }, preview: true })]}
  ├── toolbar="react"
  ├── keybindings={{ 'Mod-s': handleSave }}
  ├── theme={darkTheme}
  │
  ▼
<Editor />  (react/Editor.tsx)
  │
  ├── useEditor hook creates EditorView
  │   ├── Collects all plugin.extensions → merged Extension[]
  │   ├── Collects all plugin.keybindings → layered keymap
  │   └── Applies theme extension
  │
  ├── EditorContext.Provider exposes view ref
  │   └── React toolbar reads view state via updateListener
  │       and dispatches commands via view.dispatch()
  │
  └── EditorView manages its own DOM
      ├── Language extensions (syntax, folding, completion)
      ├── Keybinding layers (consumer > plugin > built-in)
      └── Panels (preview, CM6 toolbar variant)
```

## Risks / Trade-offs

**[Risk] CM6 bundle size** → The full CM6 stack (`state`, `view`, `commands`, `language`, `autocomplete`, `lint`, two lang packages) adds ~80-120KB gzipped. Mitigated by tree-shaking — consumers who only use JSON don't pull in markdown dependencies thanks to separate entry points (`@rezics/editor/markdown`, `@rezics/editor/json`).

**[Risk] React toolbar state sync lag** → The React toolbar variant relies on `updateListener` to reflect editor state changes. Fast typing with format toggling could show stale toolbar state for a frame. Mitigated by debouncing toolbar updates and using `requestAnimationFrame` for visual sync.

**[Risk] `preserveFormatting` rewrite correctness** → The existing plugin handles edge cases that may not be obvious. Mitigated by writing test cases capturing current behavior before rewriting.

**[Risk] Mention plugin completeness** → CM6's autocompletion system has its own UI (dropdown). The headless mention plugin must override or disable this default UI to let consumers provide their own rendering. This may require wrapping CM6's completion API rather than using it directly.

**[Trade-off] No `@uiw/react-codemirror`** → We own the React binding, which means we own maintenance of EditorView lifecycle management (creation, updates, cleanup). Accepted cost for full control and zero wrapper dependency.

**[Trade-off] Headless emoji** → Unlike EasyEditor which bundles `emoji-mart`, the new plugin requires consumers to provide a picker. This adds integration work for consumers but keeps the editor package lightweight and domain-agnostic.
