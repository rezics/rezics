## ADDED Requirements

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
