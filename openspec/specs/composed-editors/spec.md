# composed-editors Specification

## Purpose
TBD - created by archiving change editor-composition-layer. Update Purpose after archive.

## Requirements
### Requirement: MarkdownEditor component

The system SHALL provide a composed React `MarkdownEditor` component that renders a fully configured markdown editor with toolbar, preview, and standard formatting commands. It SHALL wrap the generic `<Editor>` with `markdownFull()` plugins preconfigured.

#### Scenario: Default rendering
- **GIVEN** a consumer renders `<MarkdownEditor value={md} onChange={setMd} />`
- **WHEN** the component mounts
- **THEN** a CodeMirror editor with markdown syntax highlighting, GFM support, and a toolbar with lucide-react icons SHALL be rendered
- **AND** the toolbar SHALL include buttons for: Bold, Italic, Heading, Quote, Bullet List, Numbered List, Link, Image, Table, Code Block

#### Scenario: Preview mode
- **GIVEN** a MarkdownEditor with `preview` prop enabled (default: `true`)
- **WHEN** the user clicks the Preview tab/button
- **THEN** the editor SHALL toggle to show a rendered HTML preview of the markdown content
- **AND** clicking Write/Edit SHALL return to the editor view

#### Scenario: Keyboard shortcuts
- **GIVEN** a MarkdownEditor is focused
- **WHEN** the user presses `Mod+B`, `Mod+I`, `Mod+K`, or `Mod+E`
- **THEN** the corresponding formatting command (bold, italic, link, code) SHALL execute
- **AND** toolbar button tooltips SHALL display the keyboard shortcut alongside the label

#### Scenario: Mention and emoji opt-in
- **GIVEN** a consumer renders `<MarkdownEditor mention={mentionConfig} emoji={emojiConfig} />`
- **WHEN** the component mounts
- **THEN** the mention and emoji plugins SHALL be activated with the provided configuration

### Requirement: JsonEditor component

The system SHALL provide a composed React `JsonEditor` component that renders a fully configured JSON editor with syntax highlighting, a format button with icon, and keyboard shortcut support.

#### Scenario: Default rendering
- **GIVEN** a consumer renders `<JsonEditor value={json} onChange={setJson} />`
- **WHEN** the component mounts
- **THEN** a CodeMirror editor with JSON syntax highlighting and linting SHALL be rendered
- **AND** the toolbar SHALL include a Format button with a lucide-react icon

#### Scenario: Format shortcut
- **GIVEN** a JsonEditor is focused
- **WHEN** the user presses `Shift+Mod+F` or clicks the Format button
- **THEN** the JSON content SHALL be pretty-printed with 2-space indentation
- **AND** the toolbar button tooltip SHALL display `Shift+Ctrl+F` (or `Shift+Cmd+F` on macOS)

#### Scenario: Linting opt-out
- **GIVEN** a consumer renders `<JsonEditor lint={false} />`
- **WHEN** the component mounts
- **THEN** JSON linting SHALL be disabled and no inline diagnostics SHALL appear

### Requirement: CodeEditor component

The system SHALL provide a composed React `CodeEditor` component that renders a plain text or code editor with no language-specific plugins.

#### Scenario: Default rendering
- **GIVEN** a consumer renders `<CodeEditor value={text} onChange={setText} />`
- **WHEN** the component mounts
- **THEN** a CodeMirror editor with no language plugins and no toolbar SHALL be rendered
- **AND** core features (cursor, selection, undo/redo, line wrapping) SHALL work

### Requirement: Toolbar override system

All composed editors with toolbars (MarkdownEditor, JsonEditor) SHALL support a toolbar customization API that allows icon replacement, item modification, and full render override.

#### Scenario: Replace a toolbar icon
- **GIVEN** a consumer renders `<MarkdownEditor toolbar={{ icons: { bold: <MyBoldIcon /> } }} />`
- **WHEN** the toolbar renders
- **THEN** the Bold button SHALL use the provided `<MyBoldIcon />` instead of the default lucide-react icon

#### Scenario: Extend toolbar items
- **GIVEN** a consumer renders `<MarkdownEditor toolbar={{ extend: (items) => [...items, myCustomItem] }} />`
- **WHEN** the toolbar renders
- **THEN** the custom item SHALL appear alongside the default toolbar items

#### Scenario: Fully custom toolbar
- **GIVEN** a consumer renders `<MarkdownEditor toolbar={{ render: (items, view) => <MyToolbar items={items} view={view} /> }} />`
- **WHEN** the toolbar renders
- **THEN** the consumer's render function SHALL be used instead of the default ReactToolbar
- **AND** the default toolbar items (with icons) SHALL be passed as the `items` argument

#### Scenario: Disable toolbar
- **GIVEN** a consumer renders `<MarkdownEditor toolbar={false} />`
- **WHEN** the component mounts
- **THEN** no toolbar SHALL be rendered

### Requirement: Shared props passthrough

All composed editors SHALL forward common editor props to the underlying `<Editor>` component.

#### Scenario: Theme and className
- **GIVEN** a consumer renders `<MarkdownEditor theme={darkTheme} className="my-editor" />`
- **WHEN** the component renders
- **THEN** the theme and className SHALL be forwarded to the underlying `<Editor>`

#### Scenario: Extra keybindings
- **GIVEN** a consumer renders `<MarkdownEditor keybindings={[myBinding]} />`
- **WHEN** the editor initializes
- **THEN** the consumer's keybindings SHALL be merged with the plugin keybindings at highest precedence

#### Scenario: Extra plugins
- **GIVEN** a consumer renders `<MarkdownEditor plugins={[myPlugin]} />`
- **WHEN** the editor initializes
- **THEN** the consumer's plugins SHALL be appended to the preconfigured plugin set

### Requirement: Package export entry

The `@rezics/editor` package SHALL expose a new export path for composed editors.

#### Scenario: Import composed editors
- **GIVEN** a consumer adds `import { MarkdownEditor } from '@rezics/editor/editor'`
- **WHEN** the module resolves
- **THEN** the MarkdownEditor component SHALL be available
- **AND** all composed editors (MarkdownEditor, JsonEditor, CodeEditor) SHALL be re-exported from `src/editor/index.ts`

### Requirement: Fixture migration

Fixture files currently in `src/react/` that demonstrate composed editor use cases SHALL be moved to `src/editor/`.

#### Scenario: Fixtures relocated
- **GIVEN** the composition layer is created
- **WHEN** a developer opens React Cosmos
- **THEN** `MarkdownEditor.fixture.tsx`, `JsonEditor.fixture.tsx`, `CodeEditor.fixture.tsx`, and `EditorOptions.fixture.tsx` SHALL be in `src/editor/`
- **AND** fixtures SHALL use the composed editor components instead of the generic `<Editor>` with manual plugin wiring
