## ADDED Requirements

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
