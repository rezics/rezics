# editor-markdown Specification

## Purpose

Defines the editor plugin set for editing Markdown documents: a
`markdown()` language/highlighting plugin, the formatting commands
(`toggleBold`, `toggleItalic`, headings, lists, link/image/table
inserters), the default keybindings, the default toolbar layout, and
the bundled `markdownFull()` preset that composes mention, emoji, and
preview sub-features when requested.

## Requirements

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
