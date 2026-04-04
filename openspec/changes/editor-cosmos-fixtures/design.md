## Context

The `@rezics/editor` package uses React Cosmos for visual component testing. Current fixtures live flat in `src/editor/` with minimal coverage:

- `MarkdownEditor.fixture.tsx` — 3 variants (Default, WithPreview, NoToolbar)
- `JsonEditor.fixture.tsx` — 3 variants (Default, WithLint, NoLint)
- `CodeEditor.fixture.tsx` — 1 variant (default)
- `EditorOptions.fixture.tsx` — interactive playground (theme + mode switching)

The Cosmos config uses `fixtureFileSuffix: "fixture"` and renders the sidebar tree based on file/folder structure. Fixture files can export a single component (default export) or a named multi-fixture object.

The editor has a rich configuration surface that is not visually covered: preview modes (write/preview/dual/fullscreen), toolbar with/without preview buttons, mention/emoji plugins, theme variations (light/dark + custom settings + syntax styles), and the `PreviewConfig` object with highlight options.

## Goals / Non-Goals

**Goals:**
- Achieve comprehensive visual coverage of every meaningful editor configuration.
- Organize fixtures by editor type for a clean Cosmos sidebar tree.
- Create minimal stub configs for mention/emoji so plugin fixtures work without external dependencies.
- Use interactive Cosmos controls (`useFixtureSelect`, `useFixtureInput`) where toggling state in-browser adds value, and static named fixtures where a specific state should be immediately visible.

**Non-Goals:**
- Changing any runtime editor code (components, plugins, theme system).
- Adding assertion-based tests (Bun tests are a separate concern).
- Achieving pixel-perfect visual regression (no screenshot comparison tooling).
- Testing the `EditorOptions.fixture.tsx` playground — it stays as-is.

## Decisions

### 1. Folder structure: subfolders by editor type

Fixtures move into `src/editor/markdown/`, `src/editor/json/`, `src/editor/code/`, and `src/editor/theme/`.

**Rationale:** Cosmos derives its sidebar tree from the filesystem. Grouping by editor type creates a navigable hierarchy:

```
▼ editor
  ▼ markdown
    ▼ MarkdownEditor        (core variants)
    ▼ MarkdownPreview       (preview-focused)
    ▼ MarkdownToolbar       (toolbar configs)
    ▼ MarkdownPlugins       (mention/emoji/custom)
  ▼ json
    ▼ JsonEditor            (core + lint)
    ▼ JsonToolbar           (toolbar configs)
  ▼ code
    ▼ CodeEditor            (plain + plugins)
  ▼ theme
    ▼ EditorTheme           (cross-editor themes)
  ▼ EditorOptions           (kept: interactive playground)
```

**Alternative considered:** Keeping flat files with more variants — rejected because the sidebar becomes a long unsorted list as fixture count grows.

### 2. Static fixtures for specific states, interactive for exploration

- **Static named fixtures** for states that should be visually verifiable at a glance (e.g., `PreviewOff`, `DualMode`, `DarkTheme`). Each is a separate named export in the multi-fixture object.
- **Interactive fixtures** using `useFixtureSelect` for scenarios where toggling between states reveals behavior (e.g., switching viewMode between write/preview/dual, toggling theme variant). These use a single default-export component.

**Rationale:** Static fixtures serve as regression checkpoints — you open them and immediately see the expected state. Interactive fixtures serve as exploration tools — you toggle controls to observe transitions and edge cases. Both patterns are idiomatic Cosmos.

### 3. Minimal stubs for mention and emoji

Mention fixtures use a hardcoded list of `MentionItem[]` with 3-5 entries. Emoji fixtures use a simple config with a small emoji set. These stubs live in a shared `src/editor/markdown/_stubs.ts` file (prefixed with `_` to signal non-fixture helper).

**Rationale:** Real mention/emoji configs depend on API data. Stubs decouple fixtures from external services while still demonstrating the UI behavior (autocomplete dropdown, emoji insertion).

**Alternative considered:** Inline stubs per fixture — rejected because mention/emoji stubs would be duplicated across `MarkdownPlugins.fixture.tsx` and any future fixture that needs them.

### 4. Theme fixtures in a dedicated `theme/` folder

Theme fixtures render editors across types (markdown with preview, JSON with lint) to verify theme application doesn't clash with editor-specific styling.

**Rationale:** Themes are cross-cutting — a dark theme must work with markdown preview pane styles, JSON lint highlighting, etc. Testing themes in isolation (just a bare editor) would miss these interactions. A dedicated folder groups all theme scenarios together.

### 5. Old flat fixtures are removed

After migration, `MarkdownEditor.fixture.tsx`, `JsonEditor.fixture.tsx`, and `CodeEditor.fixture.tsx` are deleted from `src/editor/`. `EditorOptions.fixture.tsx` stays — it serves a different purpose as an interactive playground.

**Rationale:** Keeping both old and new fixtures creates duplication and sidebar noise.

## Risks / Trade-offs

- **Cosmos sidebar depth** — Subfolders add nesting. Mitigated by keeping the tree to 2-3 levels max and using descriptive fixture names.
- **Stub drift** — Mention/emoji stubs may diverge from real configs over time. Mitigated by keeping stubs minimal (just the shape, not real data) so they're unlikely to break.
- **No automated regression** — Cosmos fixtures are manually inspected, not auto-asserted. This is a known limitation of visual testing without screenshot comparison. Acceptable because the goal is developer-facing verification, not CI gates.
