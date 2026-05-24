## ADDED Requirements

### Requirement: Compare sparse editorial revisions
The Book history compare page SHALL correctly compare post-cutover sparse PATCH
revision payloads. It SHALL NOT assume every revision content payload is a full
Unit snapshot.

#### Scenario: Title-only translation edit compares as title change
- **WHEN** a user compares a base revision and target revision where the target
  changed only `translations.zh-hant.title`
- **THEN** the compare page SHALL show one changed field for
  `translations.zh-hant.title`
- **AND** it SHALL show the base title and target title values
- **AND** it SHALL NOT show unchanged `summary`, `subtitle`, or `description`
  fields as changed

### Requirement: Compare supports translation payload shapes
The compare model SHALL normalize both legacy/full translation arrays and
post-cutover object-shaped translation PATCH payloads before computing changed
fields.

#### Scenario: Object-shaped translation payload is comparable
- **WHEN** revision content contains
  `translations: { "zh-hant": { title: "A" } }`
- **AND** the target revision content contains
  `translations: { "zh-hant": { title: "B" } }`
- **THEN** the compare model SHALL emit a scalar change at
  `translations.zh-hant.title`

#### Scenario: Array-shaped translation payload remains comparable
- **WHEN** legacy revision content contains
  `translations: [{ language: "zh-hant", title: "A" }]`
- **AND** the target revision content contains
  `translations: [{ language: "zh-hant", title: "B" }]`
- **THEN** the compare model SHALL emit a scalar change at
  `translations.zh-hant.title`

### Requirement: Compare builds effective state when possible
For sparse PATCH revisions, the compare page SHALL build effective comparable
states by applying revision patches in sequence order from the earliest
available initial revision through the requested base and target revisions.
When an initial revision is unavailable for legacy data, the compare page SHALL
fall back to comparing the stored revision payloads while preserving shape
normalization.

#### Scenario: Non-adjacent sparse revision comparison
- **WHEN** revision 1 creates title `A`
- **AND** revision 2 changes summary
- **AND** revision 3 changes title to `B`
- **AND** a user compares revision 1 with revision 3
- **THEN** the compare page SHALL report the title change from `A` to `B`
- **AND** it SHALL NOT report the revision 2 summary value as a target change
  unless the selected comparison range makes it different between base and
  target states

#### Scenario: Missing initial revision falls back safely
- **WHEN** the available history window does not contain an initial revision
- **AND** a user compares two sparse revisions
- **THEN** the compare page SHALL still compare the stored payloads using
  normalized payload shapes
- **AND** it SHALL render a no-changes state only when the normalized payloads
  contain no visible differences
