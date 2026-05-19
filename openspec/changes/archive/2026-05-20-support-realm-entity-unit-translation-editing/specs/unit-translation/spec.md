## ADDED Requirements

### Requirement: Metadata translation editors use Select for language selection

Frontend editing surfaces that mutate UnitTranslation metadata SHALL render the
current translation language with a Select control. Chip, badge, tab, or
segmented-control language choices SHALL NOT be used for in-place mutation of
the selected UnitTranslation language.

This requirement applies to unit-backed metadata editors such as book, realm,
entity, and future game-like catalog units. It SHALL NOT apply to chapter,
review, excerpt, or post body translation workflows, which use different domain
semantics.

#### Scenario: Editor switches metadata language

- **GIVEN** an entity, realm, or book has UnitTranslation rows for `["en", "ja"]`
- **WHEN** the user opens its metadata editor
- **THEN** the selected UnitTranslation language SHALL render through Select
- **AND** choosing another Select item SHALL change the active translation row
  being edited

#### Scenario: Chip language choices are not used for mutation

- **WHEN** an editor changes the active UnitTranslation language in-place
- **THEN** the control SHALL NOT render language choices as chips, badges, tabs,
  or segmented buttons

### Requirement: Metadata translation editors expose add-language as a separate action

Frontend metadata translation editors SHALL expose adding a new UnitTranslation
language as a distinct action next to the selected-language Select. The add
action MAY open a domain-specific dialog when creating the translation requires
additional fields.

#### Scenario: Add language from metadata editor

- **GIVEN** a realm has only an English UnitTranslation
- **WHEN** the editor opens the add-language action
- **THEN** the user SHALL be able to choose a missing supported language
- **AND** creation SHALL target a new UnitTranslation row for that language

#### Scenario: Domain-specific add fields remain outside the language control

- **GIVEN** a book work translation can optionally choose a source release
- **WHEN** the user adds a book translation language
- **THEN** the source-release picker MAY be rendered in the book-specific add
  dialog
- **AND** the shared language control SHALL NOT own source-release mutation
  behavior
