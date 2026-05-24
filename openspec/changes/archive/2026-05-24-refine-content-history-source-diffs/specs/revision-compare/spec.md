## MODIFIED Requirements

### Requirement: Markdown source diff

Markdown and long plain-text fields SHALL be compared as source text. The app SHALL provide split and unified display modes, line-level changes, and inline changed-token highlighting for changed lines. Rich content source leaves, including nested paths such as `description.main.source`, SHALL be compared as source text when their base and target values are strings, while preserving the full semantic path of the changed leaf.

#### Scenario: Markdown description diff renders source changes

- **WHEN** a book description changes from one Markdown paragraph to two paragraphs
- **THEN** the compare view SHALL show added and removed source lines
- **AND** it SHALL preserve Markdown syntax in the displayed diff

#### Scenario: Viewer switches diff layout

- **WHEN** a viewer switches from split mode to unified mode
- **THEN** the same Markdown changes SHALL remain visible in the selected layout

#### Scenario: Nested ContentDoc source diff renders source changes

- **WHEN** a rich description source leaf changes at `translations.en.description.main.source`
- **AND** both compared values are Markdown strings
- **THEN** the compare view SHALL show added and removed source lines for `translations.en.description.main.source`
- **AND** it SHALL preserve the full changed path rather than collapsing it to `translations.en.description`

### Requirement: Field-level compare model

The compare view SHALL group changes by semantic field paths such as `translations.zh.description`, `translations.zh.description.main.source`, `extension.book.pageCount`, `credits.authors`, `subjects`, and `tags`. Non-text scalar fields SHALL display before/after values. Multiple textual source leaves under the same rich object SHALL remain separate field-level changes, although the UI MAY visually group them under a readable parent for scanning.

#### Scenario: Short scalar field displays before and after

- **WHEN** `extension.book.pageCount` changes from `200` to `220`
- **THEN** the compare view SHALL display the old and new values under the page count field

#### Scenario: Unchanged fields are hidden by default

- **WHEN** a field is identical between the compared revisions
- **THEN** the compare view SHALL omit it from the default changed-fields list

#### Scenario: Multiple rich source leaves stay separate

- **WHEN** `translations.en.description.main.source` and `translations.en.description.slots.cast.title.source` both change
- **THEN** the compare model SHALL contain separate changed fields for both paths
- **AND** it SHALL NOT combine their text values into a single `translations.en.description` change
