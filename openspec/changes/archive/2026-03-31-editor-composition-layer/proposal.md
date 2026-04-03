## Why

Consumers of `@rezics/editor` must manually compose plugins, choose toolbar variants, and wire configuration to get a working markdown or JSON editor. This leaks implementation details (plugin names, preset factories, toolbar modes) into every call site and makes the simple case unnecessarily verbose.

A composition layer (`src/editor/`) would let consumers write `<MarkdownEditor />` or `<JsonEditor />` and get a fully configured, opinionated editor out of the box — while still allowing toolbar customization, icon replacement, and full render overrides for advanced use cases.

Additionally, the existing toolbar items lack icons (text-only labels), which falls short of the GitHub-style editing experience expected for the markdown editor. The JSON editor's format button similarly needs an icon and improved UX.

## What Changes

- New `src/editor/` folder containing composed editor components:
  - **MarkdownEditor** — preconfigured with `markdownFull()` plugins, lucide-react toolbar icons, Write/Preview tab UI, and GitHub-style keyboard shortcuts displayed in tooltips.
  - **JsonEditor** — preconfigured with `jsonFull()` plugins, lucide-react format icon, and `Shift+Mod+F` shortcut support.
  - **CodeEditor** — plain editor with no language plugins, for generic text/code input.
- Toolbar override system in the composition layer:
  - Replace individual icons via props.
  - Extend/modify the default toolbar item set.
  - Provide a fully custom toolbar render function.
- Fixture files moved from `src/react/` to `src/editor/` (they demonstrate composed editors, not the generic binding layer).
- New package export: `"./editor": "./src/editor/index.ts"`.
- `lucide-react` added as a dependency for default toolbar icons.

**No changes** to `src/core/`, `src/react/`, `src/toolbar/`, `src/markdown/`, or `src/json/`.

## Feature Scope

- Feature name: editor (composition layer)
- Affected layers:
  - component (MarkdownEditor, JsonEditor, CodeEditor wrapper components)
  - index.ts (barrel export from `src/editor/index.ts`)

Note: This is a library package (`@rezics/editor`), not an app feature. The layered architecture maps as:
- `component` = the composed editor components
- `index.ts` = `src/editor/index.ts` barrel export

## Package Scope

- `package/editor` — new `src/editor/` folder, updated `package.json` exports, new `lucide-react` dependency

## Impact

- Backward compatibility: Fully backward compatible. Existing `<Editor>` component and plugin imports are unchanged. The new `./editor` export is additive.
- Migration needed: None required. Existing consumers can adopt composed editors incrementally. Fixture files move from `src/react/` to `src/editor/` but this only affects Cosmos development, not consumers.
