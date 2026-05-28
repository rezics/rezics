# editor-mention Specification

## Purpose

Defines the `@`-trigger mention plugin: when the user types `@` after
whitespace/punctuation/line start, an autocomplete dropdown queries a
consumer-supplied async data source and inserts the chosen mention
into the document. The capability owns the trigger detection, the
keyboard navigation contract, the default and custom insertion
formats, and the optional custom item renderer; it does not own any
application-specific data fetching.

## Requirements

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
