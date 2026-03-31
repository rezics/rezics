## Context

`@package/editor` is a CodeMirror 6 wrapper library with a plugin-based architecture. It currently has:

- **core/** — `createEditor()`, plugin resolution, keybinding merging, theme system
- **react/** — generic `<Editor>` component, `useEditor` hook, `EditorContext`
- **toolbar/** — `ToolbarItem` types, `ReactToolbar` and panel-based toolbar implementations
- **markdown/** — language support, commands, keybindings, preview, mention, emoji plugins
- **json/** — language support, format command, linting plugin

Consumers must manually compose plugins and toolbar configuration. There is no "just works" component for a specific file type.

## Goals / Non-Goals

**Goals:**
- Provide `<MarkdownEditor>`, `<JsonEditor>`, `<CodeEditor>` as zero-config composed components
- Add lucide-react icons to all default toolbar items
- Support toolbar customization: icon replacement, item extension, full render override
- Move fixture files to the composition layer where they semantically belong
- Add `"./editor"` package export

**Non-Goals:**
- Modify core/, react/, toolbar/, markdown/, or json/ layers
- Add drag-and-drop file upload
- Add task list (`- [ ]`) support (future change)
- Add auto-continue list behavior (future change)
- Change the existing `<Editor>` API or toolbar implementation

## Layered Design

Since this is a library package (not an app feature), the standard app feature layers don't apply directly. The composition layer maps as follows:

### component

The `src/editor/` folder contains three composed editor components and supporting utilities:

```
src/editor/
├── MarkdownEditor.tsx          # Composed markdown editor
├── MarkdownEditor.test.tsx     # Co-located tests
├── MarkdownEditor.fixture.tsx  # Cosmos fixture (moved from react/)
├── JsonEditor.tsx              # Composed JSON editor
├── JsonEditor.test.tsx
├── JsonEditor.fixture.tsx      # Moved from react/
├── CodeEditor.tsx              # Composed plain editor
├── CodeEditor.test.tsx
├── CodeEditor.fixture.tsx      # Moved from react/
├── EditorOptions.fixture.tsx   # Multi-mode demo (moved from react/)
├── toolbar-defaults.tsx        # Default icon mappings (lucide-react)
├── toolbar-utils.ts            # Toolbar merge/override logic
├── types.ts                    # ToolbarOverride, composed editor prop types
└── index.ts                    # Barrel export
```

### index.ts

`src/editor/index.ts` re-exports all composed components and the toolbar override types:

```ts
export { MarkdownEditor } from './MarkdownEditor'
export type { MarkdownEditorProps } from './MarkdownEditor'
export { JsonEditor } from './JsonEditor'
export type { JsonEditorProps } from './JsonEditor'
export { CodeEditor } from './CodeEditor'
export type { CodeEditorProps } from './CodeEditor'
export type { ToolbarOverride } from './types'
```

## Data and State Flow

### Component Composition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  <MarkdownEditor                                                │
│     value={md}                                                  │
│     onChange={setMd}                                            │
│     preview={true}                                              │
│     toolbar={{ icons: { bold: <MyIcon /> } }}                   │
│  />                                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  MarkdownEditor.tsx (composition layer)                         │
│                                                                 │
│  1. Call markdownFull({ preview, mention, emoji })              │
│     → EditorPlugin[] with toolbar items (no icons)              │
│                                                                 │
│  2. Apply icon defaults from toolbar-defaults.tsx               │
│     → markdownIconMap: { bold: <Bold />, italic: <Italic />, } │
│                                                                 │
│  3. Process toolbar override from props                         │
│     → mergeToolbarOverrides(defaults, props.toolbar)            │
│     → Final ToolbarItem[] with icons + any consumer overrides   │
│                                                                 │
│  4. Render <Editor                                              │
│       plugins={[...mdPlugins, ...extraPlugins]}                 │
│       toolbar="react" (or false, or custom render)              │
│     />                                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Toolbar Override Resolution

```
Consumer props.toolbar
        │
        ▼
┌───────────────────┐     ┌──────────────────────┐
│ toolbar === false  │────▶│ No toolbar rendered   │
└───────────────────┘     └──────────────────────┘
        │ (object)
        ▼
┌───────────────────────────────────────────────────┐
│ 1. Start with default ToolbarItem[]               │
│    (from plugin + icon defaults)                   │
│                                                    │
│ 2. If toolbar.icons: replace matching item.icon    │
│    by item.name                                    │
│                                                    │
│ 3. If toolbar.extend: call fn(items) to get        │
│    final item array                                │
│                                                    │
│ 4. If toolbar.render: use custom render fn         │
│    instead of ReactToolbar                         │
└───────────────────────────────────────────────────┘
```

### Toolbar Override Type

```ts
interface ToolbarOverride {
  /** Replace default icons by toolbar item name */
  icons?: Record<string, ReactNode>;

  /** Transform the default toolbar items array.
   *  Receives items with icons already applied.
   *  Return the final items array. */
  extend?: (items: ToolbarItem[]) => ToolbarItem[];

  /** Fully replace the toolbar rendering.
   *  Receives the final items array and the EditorView. */
  render?: (items: ToolbarItem[], view: EditorView) => ReactNode;
}
```

The three override mechanisms compose in order: `icons` → `extend` → `render`. This means `extend` sees items with icon overrides already applied, and `render` receives the fully processed item array.

### Icon Default Mapping

`toolbar-defaults.tsx` maps toolbar item names to lucide-react icons:

```ts
// Markdown icons
const markdownIconMap: Record<string, ReactNode> = {
  'bold':            <Bold size={16} />,
  'italic':          <Italic size={16} />,
  'heading':         <Heading size={16} />,
  'blockquote':      <Quote size={16} />,
  'unordered-list':  <List size={16} />,
  'ordered-list':    <ListOrdered size={16} />,
  'link':            <Link size={16} />,
  'image':           <Image size={16} />,
  'table':           <Table size={16} />,
  'code-block':      <Code size={16} />,
  'preview':         <Eye size={16} />,
}

// JSON icons
const jsonIconMap: Record<string, ReactNode> = {
  'format':          <Braces size={16} />,
}
```

The `applyIconDefaults(items, iconMap)` utility iterates toolbar items and sets `item.icon` from the map only when not already set. This is a pure data transform — no UI or toolbar logic enters the plugin layers.

### Composed Editor Props

```ts
// Shared base props (forwarded to <Editor>)
interface BaseEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  theme?: Extension;
  className?: string;
  keybindings?: KeyBinding[];
  plugins?: EditorPlugin[];   // Additional plugins appended to defaults
}

// MarkdownEditor-specific
interface MarkdownEditorProps extends BaseEditorProps {
  preview?: boolean | PreviewConfig;     // Default: true
  mention?: MentionConfig;
  emoji?: EmojiConfig;
  toolbar?: false | ToolbarOverride;     // Default: icons + react toolbar
}

// JsonEditor-specific
interface JsonEditorProps extends BaseEditorProps {
  lint?: boolean;                        // Default: true
  toolbar?: false | ToolbarOverride;
}

// CodeEditor — no domain-specific props
interface CodeEditorProps extends BaseEditorProps {}
```

### Key Design Decisions

**1. Icons live in the composition layer, not in plugin definitions.**
The markdown and json toolbar items (`markdownToolbarItems`, `jsonToolbarItems`) define `action`, `label`, and `name` but no `icon`. The composition layer applies icons via `applyIconDefaults()`. This keeps the domain plugins framework-agnostic (no React import, no lucide dependency) and moves all UI concerns to `editor/`.

**2. Toolbar override uses an object shape, not separate props.**
A single `toolbar` prop with `icons`, `extend`, and `render` fields keeps the API surface small and makes it clear these are related concerns. `toolbar={false}` disables it entirely.

**3. `plugins` prop appends rather than replaces.**
Consumer-provided `plugins` are appended to the preconfigured set, giving consumers extensibility without needing to reconstruct the default plugin stack.

**4. Fixtures move to `editor/` and use composed components.**
The fixture files in `react/` are currently composing plugins manually — they're testing the composed experience, not the generic `<Editor>`. Moving them to `editor/` and rewriting them to use `<MarkdownEditor>` etc. gives accurate coverage of the composition layer.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `lucide-react` adds bundle size | Tree-shakeable; only imported icons are bundled. Size impact is ~2-3KB gzipped for ~12 icons. |
| Toolbar override API may be too rigid | The `extend` callback gives full control over the items array, and `render` allows complete replacement. This covers simple and advanced cases. |
| Moving fixtures may break Cosmos paths | Cosmos uses file-based discovery with glob patterns. Verify `cosmos.config.json` fixture paths still match after the move. |
| Composed editors may limit advanced use cases | The generic `<Editor>` remains available for consumers who need full control. Composed editors are the "easy path," not the only path. |

## Validation Plan

- TypeScript compilation: `bun run build` in `package/editor`
- Co-located tests: `bun test` in `package/editor` (MarkdownEditor.test.tsx, JsonEditor.test.tsx, CodeEditor.test.tsx)
- Cosmos fixtures: `bun run cosmos` and verify all fixtures render correctly after migration
- Package export: verify `import { MarkdownEditor } from '@package/editor/editor'` resolves

## Rollout / Migration

No migration required. This is a purely additive change:
- New `src/editor/` folder
- New `"./editor"` export in `package.json`
- New `lucide-react` dependency
- Fixtures move from `src/react/` to `src/editor/` (development-only impact)

Existing consumers of `<Editor>`, `markdownFull()`, `jsonFull()`, etc. are unaffected.
