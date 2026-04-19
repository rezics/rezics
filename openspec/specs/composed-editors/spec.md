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

### Requirement: ExcerptSourcePicker editor field

The editor surface for Excerpt posts SHALL provide an `<ExcerptSourcePicker>` field that produces a value matching `excerptSourceSchema` (`mode: 'unit' | 'url'` discriminated union; see `type-extension-post`). The field SHALL be URL-first: a single text input is the primary affordance, accepting any URL the author types or pastes.

The field SHALL also expose a collapsed disclosure "Pick from this work" that, when expanded, shows a tree of units rooted at the post's `targetUnitId` from which the author can select. The disclosure SHALL remain collapsed by default.

The field SHALL produce one of:
- `{ mode: 'unit', unitId, title }` when the author picks from the tree, or when the URL input auto-classifies as an internal unit reference (see next requirement).
- `{ mode: 'url', url, title }` for any other URL.
- `undefined` when the author leaves the field blank.

#### Scenario: Default state is empty URL field

- WHEN an author opens the Excerpt editor
- THEN the source picker shows an empty URL input and a collapsed "Pick from this work" disclosure

#### Scenario: Tree picker disclosure starts collapsed

- WHEN an author opens the Excerpt editor
- THEN the unit tree under `targetUnitId` is NOT visible until the disclosure is expanded

#### Scenario: Picking from tree produces unit-mode value

- GIVEN the author expands "Pick from this work" and selects a chapter unit
- WHEN the form value is read
- THEN it equals `{ mode: 'unit', unitId: <chapter id>, title: <prefilled display name> }`

#### Scenario: Plain external URL produces url-mode value

- GIVEN the author types `https://example.com/article` into the URL input
- WHEN the form value is read
- THEN it equals `{ mode: 'url', url: 'https://example.com/article', title: <author-entered title> }`

#### Scenario: Empty input produces undefined

- WHEN the author leaves the source field blank
- THEN the form value is `undefined` and the post saves without an `extra.source`

### Requirement: Auto-classification upgrades pasted unit URLs to unit mode

When the URL input contains a string that classifies as an in-app `/unit/:id` route or a typed-page route mappable back to a unit (e.g., `/book/:id`, `/chapter/:id`, `/excerpt/:id`), the picker SHALL extract the unit id and store the value as `{ mode: 'unit', unitId, title }` rather than `{ mode: 'url', url, title }`.

This auto-upgrade SHALL be reversible: if the author edits the URL away from a recognizable in-app form, the value SHALL switch back to `{ mode: 'url', url, title }`.

When the auto-upgrade fires, the picker SHALL surface a single-line affordance (e.g., "Linked to: Chapter 3") so the author understands that the source was upgraded. The affordance SHALL NOT be modal or interrupting.

#### Scenario: Pasting /unit/:id upgrades to unit mode

- GIVEN the URL input is empty
- WHEN the author pastes `/unit/u-1`
- THEN the stored value becomes `{ mode: 'unit', unitId: 'u-1', title: <prefilled> }`
- AND a "Linked to: <unit name>" affordance appears once

#### Scenario: Pasting typed-page URL upgrades to unit mode

- WHEN the author pastes `/book/book-1`
- THEN the picker reverses the route to a unit id and stores `{ mode: 'unit', unitId: 'book-1', title: <prefilled> }`

#### Scenario: Editing away from in-app form reverts to url mode

- GIVEN a value of `{ mode: 'unit', unitId: 'u-1', title: 'Chapter 3' }`
- WHEN the author edits the URL field to `https://example.com/article`
- THEN the stored value becomes `{ mode: 'url', url: 'https://example.com/article', title: 'Chapter 3' }`

#### Scenario: Unrecognized in-app path falls back to url mode

- WHEN the author pastes `/something/not-a-route/abc`
- THEN no auto-upgrade fires and the value remains `{ mode: 'url', url: '/something/not-a-route/abc', title: <author-entered> }`

### Requirement: Title pre-fill is editable

When auto-classification upgrades a URL to `mode: 'unit'`, the picker SHALL pre-fill `title` with the linked unit's display name (translated into the viewer's language using the existing translation helpers). The author SHALL be able to overwrite the pre-filled title freely; subsequent edits SHALL NOT be re-overwritten by the picker.

When the author manually picks from the unit tree, the same pre-fill behavior SHALL apply.

When the author enters a non-internal URL, the title field SHALL remain empty and the author SHALL fill it in.

#### Scenario: Pre-fill on unit selection

- GIVEN the unit named "第三章 第一節" is selected from the tree
- WHEN the form value is read
- THEN `title` equals "第三章 第一節" (or the appropriate translation)

#### Scenario: Author edit is preserved

- GIVEN `title` was pre-filled as "Chapter 3"
- WHEN the author edits it to "《指環王》第三章，第一節" and continues editing other fields
- THEN the title remains "《指環王》第三章，第一節" and is never silently overwritten

#### Scenario: Url-only source has empty title initially

- WHEN the author pastes `https://example.com/article` (no auto-upgrade)
- THEN the title field is empty and the author types it in

### Requirement: ExcerptSourcePicker integrates with composed editor toolbar

The `<ExcerptSourcePicker>` SHALL be a composed editor field (consistent with the existing composed-editors pattern). It SHALL accept standard form-field props (`value`, `onChange`, `disabled`, `error`) and SHALL be usable inside the larger Excerpt post editor without prop drilling.

#### Scenario: Controlled usage

- GIVEN a parent form holding `[value, setValue]` state
- WHEN `<ExcerptSourcePicker value={value} onChange={setValue} />` is rendered
- THEN the picker reflects `value` and emits updated values via `onChange`, matching the controlled-component convention used by other composed-editor fields

#### Scenario: Disabled state

- WHEN `<ExcerptSourcePicker disabled />` is rendered
- THEN the URL input and the tree disclosure are both inert and visibly indicate the disabled state

#### Scenario: Error display

- WHEN `<ExcerptSourcePicker error="URL too long" />` is rendered
- THEN the error message is displayed beneath the URL input using the same error styling as other composed-editor fields
