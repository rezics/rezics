## Why

The `@rezics/editor` package has minimal Cosmos fixture coverage. The existing fixtures are flat (3 MarkdownEditor variants, 1 CodeEditor, 3 JsonEditor) and leave major configuration surfaces untested visually — custom themes are never rendered, `preview=false` toolbar behavior is not demonstrated, mention/emoji plugin integration has no fixtures, and preview modes (dual, fullscreen, novel formatting) lack dedicated scenarios. This makes it impossible to visually verify or regression-check the editor across its full configuration space.

## What Changes

- Reorganize editor fixtures from flat `src/editor/*.fixture.tsx` into subfolders by editor type: `src/editor/markdown/`, `src/editor/json/`, `src/editor/code/`, `src/editor/theme/`.
- Add comprehensive Cosmos fixtures covering:
  - **Preview modes**: `preview=true` vs `preview=false` vs `PreviewConfig` object, write/preview/dual view modes, fullscreen, code highlighting on/off, novel formatting preservation.
  - **Toolbar configurations**: default toolbar, `toolbar=false`, custom icons, extended toolbar, custom render, preview buttons presence/absence based on `preview` prop.
  - **Plugin combinations**: mention, emoji, mention+emoji, custom plugins, all plugins together — with minimal stub configs.
  - **Theme system**: light/dark variants, custom color settings, custom syntax styles, themes applied across different editor types.
  - **JSON editor**: default, invalid JSON with lint errors, lint disabled, toolbar overrides.
  - **Code editor**: plain text, with custom plugin.
- Remove old flat fixture files after migration.
- Use a mix of static named fixtures (for specific states) and interactive `useFixtureSelect`/`useFixtureInput` fixtures (for toggling viewMode, theme variant, etc.).

## Capabilities

### New Capabilities

- `editor-cosmos-coverage`: Comprehensive Cosmos fixture suite for all editor types, covering preview modes, toolbar configurations, plugin combinations, and theme variations.

### Modified Capabilities

_(none — no spec-level behavior changes, only visual test coverage)_

## Impact

- **Affected package**: `package/editor` only.
- **Files removed**: `src/editor/MarkdownEditor.fixture.tsx`, `src/editor/JsonEditor.fixture.tsx`, `src/editor/CodeEditor.fixture.tsx` (replaced by subfolder fixtures). `src/editor/EditorOptions.fixture.tsx` is kept as the interactive playground.
- **No runtime code changes** — this is purely fixture/test infrastructure.
- **No dependency additions** — uses existing `react-cosmos/client` APIs (`useFixtureSelect`, `useFixtureInput`).
- **Backward compatibility**: N/A (fixtures are dev-only, not shipped).
