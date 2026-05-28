# editor-plugins Specification

## Purpose

Defines the optional editor plugins that compose with the
CodeMirror runtime: the emoji insertion plugin and its
consumer-supplied picker contract; the `@`-trigger mention
autocomplete; the JSON language plugin (highlighting,
`formatJson`, real-time lint, default keybindings/toolbar,
and the `jsonFull()` preset); the Markdown language plugin
(highlighting, formatting commands, default keybindings,
default toolbar, and the `markdownFull()` preset); the live
Markdown preview pane with `preserveFormatting` and
`sourceLinePlugin`; the bidirectional scroll synchronization
between the editor and preview in dual-column mode; and the
React Cosmos fixture coverage that documents these plugins'
behaviors. Previously split across `editor-emoji`,
`editor-mention`, `editor-json`, `editor-markdown`,
`editor-markdown-preview`, `editor-scroll-sync`, and
`editor-cosmos-coverage`.

## Emoji plugin

### Requirement: Emoji insertion plugin
The system SHALL provide an `emoji()` plugin that manages emoji insertion into the editor. The plugin SHALL provide a toolbar button and an open/close state for a consumer-provided emoji picker UI.

#### Scenario: Emoji toolbar button
- **WHEN** the emoji plugin is active and a toolbar is rendered
- **THEN** an "Emoji" button SHALL appear in the toolbar

### Requirement: Consumer-provided emoji picker
The emoji plugin SHALL accept a `renderPicker` configuration: a function `(onSelect: (emoji: string) => void, onClose: () => void) => ReactNode`. The plugin SHALL call this function to render the picker UI when the picker state is open. The plugin SHALL NOT bundle any emoji data or picker component.

#### Scenario: Picker opens on toolbar button click
- **WHEN** the user clicks the "Emoji" toolbar button
- **THEN** the picker state SHALL change to open
- **THEN** the `renderPicker` function SHALL be called to render the picker UI

#### Scenario: Picker closes on onClose
- **WHEN** the picker is open and `onClose` is invoked (e.g., user clicks outside or presses Escape)
- **THEN** the picker state SHALL change to closed
- **THEN** the picker UI SHALL be removed

### Requirement: Emoji insertion into editor
When an emoji is selected via the `onSelect` callback, the plugin SHALL insert the emoji string at the current cursor position or replace the current selection. The editor SHALL retain focus after insertion.

#### Scenario: Insert emoji at cursor
- **WHEN** the picker is open and the user selects "😀"
- **THEN** "😀" SHALL be inserted at the current cursor position
- **THEN** the cursor SHALL advance past the inserted emoji
- **THEN** the editor SHALL retain focus

#### Scenario: Insert emoji replacing selection
- **WHEN** text is selected and the user selects an emoji from the picker
- **THEN** the selected text SHALL be replaced with the emoji

### Requirement: Emoji picker closes on editor scroll
When the editor scrolls while the emoji picker is open, the picker SHALL close to prevent the picker from visually detaching from its anchor position.

#### Scenario: Scroll closes picker
- **WHEN** the emoji picker is open and the editor content scrolls
- **THEN** the picker SHALL close

## Mention plugin

### Requirement: @-trigger mention autocomplete
The system SHALL provide a `mention()` plugin that activates an autocomplete dropdown when the user types `@` preceded by a whitespace character, punctuation, or the start of a line. The plugin SHALL query a consumer-provided async data source with the text following `@` as the search query.

#### Scenario: Mention triggered by @ character
- **WHEN** the user types `@` at the start of a line or after a space
- **THEN** the mention autocomplete SHALL activate and query the data source with an empty string

#### Scenario: Mention query updates as user types
- **WHEN** the user types `@john`
- **THEN** the data source SHALL be queried with `"john"`
- **THEN** the autocomplete dropdown SHALL display matching results

#### Scenario: Mention not triggered mid-word
- **WHEN** the user types `email@example`
- **THEN** the mention autocomplete SHALL NOT activate

### Requirement: Mention data source injection
The mention plugin SHALL accept a `source` configuration: an async function `(query: string) => Promise<MentionItem[]>` where `MentionItem` has at minimum `id` (string) and `label` (string) fields. The plugin SHALL NOT contain any application-specific data fetching logic.

#### Scenario: Custom data source provides results
- **WHEN** the mention autocomplete is active and the source returns `[{ id: '1', label: 'Alice' }, { id: '2', label: 'Bob' }]`
- **THEN** the dropdown SHALL display "Alice" and "Bob" as options

#### Scenario: Data source returns empty results
- **WHEN** the source returns an empty array
- **THEN** the autocomplete dropdown SHALL close or show an empty state

### Requirement: Mention selection and insertion
When the user selects a mention item (via Enter, Tab, or click), the plugin SHALL replace the `@query` text with a formatted mention string. The default format SHALL be `@{label} ` (with a trailing space). The insertion format SHALL be configurable via an optional `formatMention` function.

#### Scenario: Select mention with Enter
- **WHEN** the user types `@ali`, the dropdown shows "Alice", and the user presses Enter
- **THEN** `@ali` SHALL be replaced with `@Alice ` (default format)
- **THEN** the cursor SHALL be placed after the trailing space

#### Scenario: Custom mention format
- **WHEN** the plugin is configured with `formatMention: (item) => \`[@${item.label}](user:${item.id})\``
- **THEN** selecting "Alice" (id: "1") SHALL insert `[@Alice](user:1)`

### Requirement: Mention keyboard navigation
The mention autocomplete dropdown SHALL support keyboard navigation: `ArrowDown` to move to the next item, `ArrowUp` to move to the previous item, `Enter` or `Tab` to select the active item, and `Escape` to close the dropdown.

#### Scenario: Arrow key navigation
- **WHEN** the dropdown is open with items ["Alice", "Bob", "Charlie"] and the user presses ArrowDown twice
- **THEN** "Charlie" SHALL be the active (highlighted) item

#### Scenario: Escape closes mention
- **WHEN** the dropdown is open and the user presses Escape
- **THEN** the dropdown SHALL close without inserting anything

### Requirement: Optional custom mention item rendering
The mention plugin SHALL accept an optional `renderItem` function `(item: MentionItem) => ReactNode` for custom dropdown item rendering. When not provided, the plugin SHALL render items using their `label` field as plain text.

#### Scenario: Custom rendered mention items
- **WHEN** `renderItem` is provided and returns an element with an avatar and name
- **THEN** the dropdown SHALL display each item using the custom rendering

## JSON plugin

### Requirement: JSON syntax highlighting
The system SHALL provide a `json()` plugin that enables JSON syntax highlighting using `@codemirror/lang-json`. The highlighting SHALL cover strings, numbers, booleans, null, property keys, brackets, and colons.

#### Scenario: JSON content is highlighted
- **WHEN** the user types `{"name": "test", "count": 42, "active": true}` in an editor with the JSON plugin
- **THEN** property keys SHALL be highlighted differently from string values
- **THEN** numbers and booleans SHALL be highlighted with their respective styles

### Requirement: JSON formatting command
The system SHALL provide a `formatJson` command that formats the entire editor content as indented JSON. The command SHALL use `JSON.stringify(JSON.parse(text), null, 2)` for formatting. When the content is not valid JSON, the command SHALL NOT modify the content and SHALL trigger the lint diagnostics to display the parse error.

#### Scenario: Format valid JSON
- **WHEN** the editor contains `{"a":1,"b":[2,3]}` and the user invokes `formatJson`
- **THEN** the content SHALL be replaced with the pretty-printed equivalent with 2-space indentation

#### Scenario: Format invalid JSON
- **WHEN** the editor contains `{"a": 1,}` (trailing comma) and the user invokes `formatJson`
- **THEN** the content SHALL NOT change
- **THEN** the lint panel SHALL display the JSON parse error with its position

### Requirement: JSON real-time linting
The system SHALL provide a `jsonLint()` plugin that validates the editor content as JSON in real time using `@codemirror/lint`. Parse errors SHALL be displayed as lint diagnostics with the error position highlighted in the editor.

#### Scenario: Lint error on invalid JSON
- **WHEN** the user types `{"key": value}` (unquoted value)
- **THEN** a lint diagnostic SHALL appear at the position of `value` indicating a parse error

#### Scenario: No lint errors on valid JSON
- **WHEN** the editor contains valid JSON
- **THEN** no lint diagnostics SHALL be displayed

### Requirement: JSON default keybindings
The JSON plugin SHALL register `Shift-Mod-f` → `formatJson` as a default keybinding. This binding SHALL be overridable by consumer keybindings.

#### Scenario: Shift-Mod-f triggers format
- **WHEN** the user presses `Shift-Mod-f` with the JSON plugin active
- **THEN** `formatJson` SHALL be invoked

### Requirement: JSON toolbar items
The JSON plugin SHALL contribute a default set of toolbar items: a "Format" button that invokes `formatJson`.

#### Scenario: Format button in toolbar
- **WHEN** the JSON plugin is active with a toolbar
- **THEN** a "Format" button SHALL appear in the toolbar

### Requirement: jsonFull preset bundle
The system SHALL provide a `jsonFull()` factory function that bundles the JSON core plugin (language, keybindings, toolbar) with the JSON linting plugin. The lint plugin SHALL be included by default and disablable via `jsonFull({ lint: false })`.

#### Scenario: Full JSON preset
- **WHEN** `jsonFull()` is used
- **THEN** the editor SHALL have JSON syntax highlighting, formatting keybinding, toolbar items, and real-time linting

#### Scenario: JSON preset without lint
- **WHEN** `jsonFull({ lint: false })` is used
- **THEN** the editor SHALL have JSON syntax highlighting, formatting, and toolbar but no real-time linting

## Markdown plugin

### Requirement: Markdown syntax highlighting
The system SHALL provide a `markdown()` plugin that enables Markdown syntax highlighting using `@codemirror/lang-markdown` and `@lezer/markdown`. The highlighting SHALL cover headings, bold, italic, code blocks, links, lists, blockquotes, and inline code.

#### Scenario: Markdown text is highlighted
- **WHEN** the user types `## Hello **world**` in an editor with the markdown plugin
- **THEN** the heading markup SHALL be highlighted as a heading
- **THEN** the bold markup SHALL be highlighted as bold/strong emphasis

### Requirement: Markdown editing commands
The system SHALL provide the following editing commands: `toggleBold` (wraps/unwraps selection with `**`), `toggleItalic` (wraps/unwraps with `*`), `toggleStrikethrough` (wraps/unwraps with `~~`), `toggleHeading` (cycles heading level), `toggleBlockquote` (toggles `>` prefix), `toggleUnorderedList` (toggles `- ` prefix), `toggleOrderedList` (toggles `1. ` prefix), `toggleCode` (wraps/unwraps with `` ` ``), `toggleCodeBlock` (wraps/unwraps with `` ``` ``), `insertLink` (inserts `[text](url)` template), `insertImage` (inserts `![alt](url)` template), and `insertTable` (inserts a markdown table template).

#### Scenario: Toggle bold on selection
- **WHEN** the user selects "hello" and invokes `toggleBold`
- **THEN** the text SHALL become `**hello**`

#### Scenario: Toggle bold on already bold text
- **WHEN** the user selects `**hello**` and invokes `toggleBold`
- **THEN** the bold markers SHALL be removed, leaving `hello`

#### Scenario: Toggle bold with no selection
- **WHEN** the cursor is at a position with no selection and `toggleBold` is invoked
- **THEN** the editor SHALL insert `****` and place the cursor between the markers

### Requirement: Markdown default keybindings
The markdown plugin SHALL register the following default keybindings: `Mod-b` → `toggleBold`, `Mod-i` → `toggleItalic`, `Mod-k` → `insertLink`, `Mod-e` → `toggleCode`. These keybindings SHALL be registered at default priority and overridable by consumer keybindings.

#### Scenario: Mod-b triggers bold
- **WHEN** the user presses `Mod-b` with the markdown plugin active
- **THEN** `toggleBold` SHALL be invoked

### Requirement: Markdown toolbar items
The markdown plugin SHALL contribute a default set of toolbar items: bold, italic, heading, separator, blockquote, unordered list, ordered list, separator, link, image, table, separator, and code block. Each item SHALL specify a `name`, `label`, `action`, and optionally `isActive`.

#### Scenario: Toolbar items registered
- **WHEN** the markdown plugin is loaded with toolbar items
- **THEN** the toolbar SHALL display formatting buttons in the defined order with separators

### Requirement: markdownFull preset bundle
The system SHALL provide a `markdownFull()` factory function that bundles the markdown core plugin with optional sub-features: `mention` (enabled by providing a config object with `source`), `emoji` (enabled by providing a config object with `renderPicker`), and `preview` (enabled by setting to `true` or providing a config). When a sub-feature is not configured, its plugin SHALL NOT be included.

#### Scenario: Full preset with all features
- **WHEN** `markdownFull({ mention: { source }, emoji: { renderPicker }, preview: true })` is used
- **THEN** the resulting plugin array SHALL include markdown core, mention, emoji, and preview plugins

#### Scenario: Minimal preset
- **WHEN** `markdownFull()` is used with no options
- **THEN** only the markdown core plugin (language, commands, keybindings, toolbar) SHALL be included

## Markdown preview plugin

### Requirement: Markdown preview panel
The system SHALL provide a `preview()` plugin that renders a live HTML preview of the editor's Markdown content. The preview SHALL be rendered using a `markdown-it` pipeline. The preview panel SHALL be implemented as a CM6 panel and support two modes: side-by-side (panel beside the editor) and toggle (panel replaces the editor content).

#### Scenario: Side-by-side preview
- **WHEN** the preview plugin is active in side-by-side mode
- **THEN** a panel SHALL display to the right of the editor showing rendered HTML
- **THEN** the preview SHALL update as the user types

#### Scenario: Toggle preview
- **WHEN** the user toggles preview mode
- **THEN** the rendered HTML preview SHALL replace the editor content area
- **THEN** toggling again SHALL restore the editor content area

### Requirement: Preview updates on content change
The preview panel SHALL update its rendered HTML when the editor document changes. Updates SHALL be debounced to avoid excessive re-renders during fast typing.

#### Scenario: Typing updates preview
- **WHEN** the user types new Markdown content
- **THEN** the preview SHALL re-render after a short debounce period
- **THEN** the preview SHALL reflect the full current document content

### Requirement: preserveFormatting markdown-it plugin
The system SHALL provide a `preserveFormatting` markdown-it plugin that preserves Rezics-style whitespace in rendered output. The plugin SHALL:
1. Preserve consecutive blank lines by converting extra newlines beyond the standard paragraph break (`\n\n`) into visible `&nbsp;` line breaks.
2. Preserve consecutive spaces by converting runs of 2+ spaces into `&nbsp;` HTML entities.

The plugin SHALL accept an options object with `preserveSpaces` (boolean, default `true`) and `preserveEmptyLines` (boolean, default `true`).

#### Scenario: Multiple blank lines preserved
- **WHEN** the source contains `"line1\n\n\n\nline2"` (3 blank lines between content)
- **THEN** the rendered output SHALL display 3 visible blank lines between "line1" and "line2"

#### Scenario: Multiple spaces preserved
- **WHEN** the source contains `"hello    world"` (4 spaces)
- **THEN** the rendered output SHALL display 4 visible spaces between "hello" and "world"

#### Scenario: Options disable space preservation
- **WHEN** the plugin is configured with `{ preserveSpaces: false }`
- **THEN** consecutive spaces SHALL be collapsed by standard Markdown rendering

#### Scenario: Standard single blank line unaffected
- **WHEN** the source contains `"line1\n\nline2"` (standard paragraph break)
- **THEN** rendering SHALL produce a normal paragraph break with no extra spacing

### Requirement: Preview toolbar items
The preview plugin SHALL contribute toolbar items for toggling preview mode: a "Preview" button to toggle the preview panel and a "Side by Side" button to toggle side-by-side mode.

#### Scenario: Preview toggle button
- **WHEN** the user clicks the "Preview" toolbar button
- **THEN** the preview panel SHALL toggle between visible and hidden

### Requirement: Source-line attribute injection

The markdown-it rendering pipeline SHALL inject `data-source-line` attributes on block-level HTML elements. The attribute value SHALL be the 0-based starting source line number from the token's `token.map[0]` metadata.

The injection SHALL be implemented as a composable markdown-it plugin (`sourceLinePlugin`) that can be used independently of scroll sync.

#### Scenario: Paragraph receives source-line attribute

- **WHEN** a markdown paragraph starting at source line 5 is rendered
- **THEN** the output `<p>` tag SHALL include `data-source-line="5"`

#### Scenario: Heading receives source-line attribute

- **WHEN** a heading starting at source line 12 is rendered
- **THEN** the output heading tag SHALL include `data-source-line="12"`

#### Scenario: Tokens without map are unaffected

- **WHEN** a token has no `map` metadata (e.g., inline tokens)
- **THEN** no `data-source-line` attribute SHALL be injected

#### Scenario: Plugin composes with existing plugins

- **WHEN** `sourceLinePlugin` is used alongside `novelModePlugin`
- **THEN** both plugins SHALL produce their respective output without conflict

## Scroll sync plugin

### Requirement: Bidirectional line-based scroll sync in dual mode

The system SHALL synchronize scroll positions between the CodeMirror editor and the markdown preview when in dual-column view mode. Synchronization SHALL be bidirectional: scrolling either pane SHALL update the other to show the corresponding content region.

The system SHALL use source-line numbers as the mapping key. The top visible line in the scrolled pane SHALL determine the scroll target in the opposite pane.

Scroll sync SHALL only be active when `viewMode === 'dual'`. It SHALL have no effect in write-only or preview-only modes.

#### Scenario: Editor scroll updates preview

- **WHEN** the user scrolls the CodeMirror editor in dual-column mode
- **THEN** the preview pane SHALL scroll to show the rendered HTML corresponding to the editor's top visible source line

#### Scenario: Preview scroll updates editor

- **WHEN** the user scrolls the preview pane in dual-column mode
- **THEN** the CodeMirror editor SHALL scroll to show the source line corresponding to the preview's topmost visible annotated element

#### Scenario: Sync inactive in write-only mode

- **WHEN** the view mode is `write`
- **THEN** no scroll synchronization listeners SHALL be active

#### Scenario: Sync inactive in preview-only mode

- **WHEN** the view mode is `preview`
- **THEN** no scroll synchronization listeners SHALL be active

### Requirement: Scroll loop prevention

The system SHALL prevent infinite scroll event loops caused by bidirectional sync. When pane A triggers a sync update to pane B, the resulting scroll event on pane B SHALL NOT trigger a reverse sync back to pane A.

#### Scenario: No feedback loop on editor scroll

- **WHEN** the editor fires a scroll event and the sync logic scrolls the preview
- **THEN** the preview's scroll event SHALL be suppressed for the current sync cycle
- **THEN** no reverse sync from preview to editor SHALL occur

#### Scenario: No feedback loop on preview scroll

- **WHEN** the preview fires a scroll event and the sync logic scrolls the editor
- **THEN** the editor's scroll event SHALL be suppressed for the current sync cycle
- **THEN** no reverse sync from editor to preview SHALL occur

### Requirement: Post-re-render scroll restoration

When the preview HTML is replaced due to content changes in dual-column mode, the system SHALL restore the preview's scroll position to match the editor's current scroll state.

#### Scenario: Typing preserves preview scroll position

- **WHEN** the user types in the editor while in dual-column mode
- **THEN** the preview's `innerHTML` SHALL be updated with the new rendered content
- **THEN** the preview's scroll position SHALL be restored to align with the editor's top visible line before the next paint

### Requirement: useScrollSync hook encapsulation

All scroll synchronization logic SHALL be encapsulated in a `useScrollSync` hook. The hook SHALL accept the `EditorView`, a ref to the preview container, and the current view mode. The hook SHALL manage all event listener setup and teardown.

#### Scenario: Hook cleanup on mode change

- **WHEN** the view mode changes from `dual` to `write`
- **THEN** all scroll event listeners SHALL be removed
- **THEN** no scroll sync processing SHALL occur

## Cosmos coverage

### Requirement: Markdown editor core fixtures

The system SHALL provide Cosmos fixtures at `src/editor/markdown/MarkdownEditor.fixture.tsx` covering the fundamental MarkdownEditor states.

#### Scenario: Editor without preview
- **WHEN** the `Default` fixture renders with `preview={false}`
- **THEN** the editor SHALL display without Write/Preview tabs
- **AND** the toolbar SHALL NOT include dual-column or fullscreen buttons

#### Scenario: Editor with preview enabled
- **WHEN** the `WithPreview` fixture renders with `preview={true}`
- **THEN** the editor SHALL display Write and Preview tabs
- **AND** the toolbar SHALL include dual-column and fullscreen buttons

#### Scenario: Long content
- **WHEN** the `LongContent` fixture renders with a large markdown document
- **THEN** the editor SHALL render with scrollable content

#### Scenario: Empty content
- **WHEN** the `EmptyContent` fixture renders with `value=""`
- **THEN** the editor SHALL render an empty editable area

### Requirement: Markdown preview mode fixtures

The system SHALL provide Cosmos fixtures at `src/editor/markdown/MarkdownPreview.fixture.tsx` covering all preview-related configurations and view modes.

#### Scenario: Interactive view mode switching
- **WHEN** the `ViewModes` interactive fixture renders
- **THEN** a `useFixtureSelect` control SHALL allow switching between write, preview, and dual view modes
- **AND** each mode SHALL display the correct layout (editor-only, preview-only, side-by-side)

#### Scenario: Fullscreen mode
- **WHEN** the `Fullscreen` fixture renders
- **THEN** the editor SHALL be in fullscreen mode covering the viewport

#### Scenario: Highlight disabled
- **WHEN** the `NoHighlight` fixture renders with `preview={{ highlight: false }}`
- **THEN** code blocks in the preview pane SHALL render without syntax coloring

#### Scenario: Novel formatting preservation
- **WHEN** the `NovelFormatting` fixture renders with content containing extra blank lines and multiple spaces
- **THEN** the preview pane SHALL preserve blank lines as spacer elements and multiple spaces as non-breaking spaces

#### Scenario: Code blocks with copy buttons
- **WHEN** the `CodeBlocks` fixture renders with content containing fenced code blocks in multiple languages
- **THEN** each code block in the preview SHALL have a copy button visible on hover

### Requirement: Markdown toolbar fixtures

The system SHALL provide Cosmos fixtures at `src/editor/markdown/MarkdownToolbar.fixture.tsx` covering toolbar configuration variations.

#### Scenario: Default toolbar with grouping
- **WHEN** the `DefaultToolbar` fixture renders
- **THEN** toolbar items SHALL be grouped with separators between text, block, and insert groups

#### Scenario: Toolbar disabled
- **WHEN** the `NoToolbar` fixture renders with `toolbar={false}`
- **THEN** no toolbar row SHALL be visible

#### Scenario: Custom icons
- **WHEN** the `CustomIcons` fixture renders with `toolbar={{ icons: { bold: customElement } }}`
- **THEN** the bold button SHALL display the custom element instead of the default icon

#### Scenario: Extended toolbar
- **WHEN** the `ExtendedToolbar` fixture renders with `toolbar={{ extend: fn }}`
- **THEN** the toolbar SHALL include additional items added by the extend function

#### Scenario: Preview buttons conditional on preview prop
- **WHEN** the `WithPreviewButtons` fixture renders with `preview={true}`
- **THEN** dual-column and fullscreen buttons SHALL appear in the toolbar
- **AND** when the `WithoutPreviewButtons` fixture renders with `preview={false}`
- **THEN** dual-column and fullscreen buttons SHALL NOT appear

### Requirement: Markdown plugin fixtures

The system SHALL provide Cosmos fixtures at `src/editor/markdown/MarkdownPlugins.fixture.tsx` demonstrating plugin combinations with minimal stub configurations.

#### Scenario: Mention plugin
- **WHEN** the `WithMention` fixture renders with a stub `MentionConfig`
- **THEN** typing `@` in the editor SHALL trigger the mention autocomplete

#### Scenario: Emoji plugin
- **WHEN** the `WithEmoji` fixture renders with a stub `EmojiConfig`
- **THEN** the emoji plugin SHALL be active

#### Scenario: All plugins combined
- **WHEN** the `AllPlugins` fixture renders with mention, emoji, and preview all enabled
- **THEN** all plugins SHALL be active simultaneously without conflicts

### Requirement: Shared plugin stubs

The system SHALL provide a stub file at `src/editor/markdown/_stubs.ts` containing minimal mock configurations for mention and emoji plugins.

#### Scenario: Mention stub
- **WHEN** a fixture imports the mention stub
- **THEN** it SHALL provide a `MentionConfig` with a hardcoded list of 3-5 `MentionItem` entries and a trigger character

#### Scenario: Emoji stub
- **WHEN** a fixture imports the emoji stub
- **THEN** it SHALL provide an `EmojiConfig` sufficient to activate the emoji plugin

### Requirement: JSON editor fixtures

The system SHALL provide Cosmos fixtures at `src/editor/json/JsonEditor.fixture.tsx` covering core JSON editor states.

#### Scenario: Valid JSON
- **WHEN** the `Default` fixture renders with well-formatted JSON
- **THEN** the editor SHALL display with syntax highlighting and a format toolbar button

#### Scenario: Invalid JSON with lint errors
- **WHEN** the `WithLintErrors` fixture renders with malformed JSON
- **THEN** inline lint diagnostics SHALL be visible

#### Scenario: Lint disabled
- **WHEN** the `NoLint` fixture renders with `lint={false}`
- **THEN** no lint diagnostics SHALL appear even for invalid JSON

#### Scenario: Large JSON document
- **WHEN** the `LargeDocument` fixture renders with a large JSON object
- **THEN** the editor SHALL handle the content with scrolling

### Requirement: JSON toolbar fixtures

The system SHALL provide Cosmos fixtures at `src/editor/json/JsonToolbar.fixture.tsx` covering JSON toolbar configurations.

#### Scenario: Default toolbar
- **WHEN** the `DefaultToolbar` fixture renders
- **THEN** the format button with its default icon SHALL be visible

#### Scenario: Custom format icon
- **WHEN** the `CustomFormatIcon` fixture renders with `toolbar={{ icons: { format: customElement } }}`
- **THEN** the format button SHALL display the custom element

#### Scenario: Toolbar disabled
- **WHEN** the `NoToolbar` fixture renders with `toolbar={false}`
- **THEN** no toolbar SHALL be visible

### Requirement: Code editor fixtures

The system SHALL provide Cosmos fixtures at `src/editor/code/CodeEditor.fixture.tsx` covering the plain code editor.

#### Scenario: Default plain text
- **WHEN** the `Default` fixture renders
- **THEN** a plain text editor with no toolbar and no language plugins SHALL be visible

#### Scenario: With custom plugin
- **WHEN** the `WithCustomPlugin` fixture renders with a consumer-provided plugin
- **THEN** the plugin's toolbar items (if any) SHALL NOT appear (CodeEditor disables toolbar)

### Requirement: Theme fixtures

The system SHALL provide Cosmos fixtures at `src/editor/theme/EditorTheme.fixture.tsx` covering the theme system across editor types.

#### Scenario: Interactive theme variant switching
- **WHEN** the `ThemeVariants` interactive fixture renders
- **THEN** a `useFixtureSelect` control SHALL allow switching between light and dark variants
- **AND** the editor background, foreground, selection, and gutter colors SHALL update accordingly

#### Scenario: Custom color settings
- **WHEN** the `CustomColors` fixture renders with a theme specifying custom background, foreground, caret, and selection colors
- **THEN** the editor SHALL visually reflect those custom colors

#### Scenario: Custom syntax styles
- **WHEN** the `CustomSyntaxStyles` fixture renders with TagStyle rules for keywords, strings, and comments
- **THEN** the syntax highlighting in the editor SHALL use the custom colors

#### Scenario: Dark theme with markdown preview
- **WHEN** the `DarkMarkdownWithPreview` fixture renders with a dark theme and `preview={true}`
- **THEN** the editor pane SHALL use dark theme styling
- **AND** the preview pane SHALL render markdown content (note: preview pane uses its own CSS, independent of CodeMirror theme)

#### Scenario: Light theme with JSON lint
- **WHEN** the `LightJsonWithLint` fixture renders with a light theme and invalid JSON
- **THEN** lint diagnostics SHALL be visible against the light theme background

### Requirement: Old fixture cleanup

The system SHALL remove the flat fixture files from `src/editor/` that are superseded by the new subfolder structure.

#### Scenario: Removed files
- **WHEN** the migration is complete
- **THEN** `src/editor/MarkdownEditor.fixture.tsx`, `src/editor/JsonEditor.fixture.tsx`, and `src/editor/CodeEditor.fixture.tsx` SHALL be deleted
- **AND** `src/editor/EditorOptions.fixture.tsx` SHALL remain unchanged

### Requirement: Sample content quality

Fixture sample content SHALL be representative and meaningful, not trivial placeholder text.

#### Scenario: Markdown sample content
- **WHEN** markdown fixtures render
- **THEN** the sample content SHALL include headers, bold/italic text, lists, blockquotes, code blocks (with language tags), links, tables, and images — covering the full markdown feature set

#### Scenario: Novel formatting sample content
- **WHEN** the novel formatting fixture renders
- **THEN** the sample content SHALL include paragraphs separated by multiple blank lines and sentences with multiple consecutive spaces — demonstrating the formatting preservation features

#### Scenario: JSON sample content
- **WHEN** JSON fixtures render
- **THEN** the sample content SHALL include nested objects, arrays, strings, numbers, booleans, and nulls — covering common JSON structures
