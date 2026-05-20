## ADDED Requirements

### Requirement: Compare two editorial revisions in the frontend

The app SHALL compare two editorial revisions by fetching both revision payloads and deriving a frontend compare model. The default compare SHALL be between a selected revision and its previous revision, with controls to choose another base or target revision.

#### Scenario: Default compare uses previous revision

- **WHEN** a viewer clicks compare on revision `15`
- **THEN** the app SHALL load revision `15` and the nearest previous revision for the same Unit
- **AND** it SHALL render their differences without requiring a server-side compare endpoint

#### Scenario: Viewer selects alternate revisions

- **WHEN** a viewer selects revision `8` as base and revision `15` as target
- **THEN** the compare view SHALL render differences between those two revisions

### Requirement: Markdown source diff

Markdown and long plain-text fields SHALL be compared as source text. The app SHALL provide split and unified display modes, line-level changes, and inline changed-token highlighting for changed lines.

#### Scenario: Markdown description diff renders source changes

- **WHEN** a book description changes from one Markdown paragraph to two paragraphs
- **THEN** the compare view SHALL show added and removed source lines
- **AND** it SHALL preserve Markdown syntax in the displayed diff

#### Scenario: Viewer switches diff layout

- **WHEN** a viewer switches from split mode to unified mode
- **THEN** the same Markdown changes SHALL remain visible in the selected layout

### Requirement: CJK-aware inline diff

Inline text diff SHALL use `Intl.Segmenter` where available for languages without whitespace word boundaries. When segmentation is unavailable, the app SHALL fall back to character-level inline diff for affected fields.

#### Scenario: Chinese text uses segmenter

- **WHEN** a Chinese Markdown field changes within a line
- **THEN** the inline diff SHALL use `Intl.Segmenter` token boundaries when available
- **AND** the diff SHALL avoid treating the whole sentence as one changed token solely because it lacks spaces

#### Scenario: Segmenter unavailable falls back safely

- **WHEN** `Intl.Segmenter` is unavailable in the runtime
- **THEN** the app SHALL still render an inline diff using a safe fallback
- **AND** compare SHALL NOT fail to render

### Requirement: Field-level compare model

The compare view SHALL group changes by semantic field paths such as `translations.zh.description`, `extension.book.pageCount`, `credits.authors`, `subjects`, and `tags`. Non-text scalar fields SHALL display before/after values.

#### Scenario: Short scalar field displays before and after

- **WHEN** `extension.book.pageCount` changes from `200` to `220`
- **THEN** the compare view SHALL display the old and new values under the page count field

#### Scenario: Unchanged fields are hidden by default

- **WHEN** a field is identical between the compared revisions
- **THEN** the compare view SHALL omit it from the default changed-fields list

### Requirement: Collection compare

Collections such as tags, credits, subjects, translations, and support languages SHALL render added, removed, updated, and reordered entries using semantic item identity rather than raw JSON string diff.

#### Scenario: Tag added renders as added item

- **WHEN** a tag Unit id exists only in the target revision
- **THEN** the compare view SHALL show that tag as added
- **AND** it SHALL use resolved display data when available

#### Scenario: Credit role update renders as update

- **WHEN** a credit attribution keeps the same referenced entity but changes role or order
- **THEN** the compare view SHALL show an updated attribution entry rather than only a raw JSON diff

### Requirement: Product-safe unknown fallback

If a field or slot is not recognized by the semantic compare model, the product compare view SHALL provide a product-safe changed-field indicator rather than a raw JSON diff. Authorized raw payload inspection MAY be provided by a separate maintainer/admin debug surface, but it is not required inside the public compare view.

#### Scenario: Unknown slot changes

- **WHEN** an unknown revision slot differs between base and target
- **THEN** the viewer SHALL see that the slot changed without seeing raw payload content
- **AND** the compare view SHALL NOT expose private content, user data, migration-only fields, or internal payload structure through raw JSON fallback
