## ADDED Requirements

### Requirement: Preserve nested source leaf paths
The Book history compare page SHALL preserve the full path-snapshot compare
path for every rendered change, including nested rich content source paths such
as `translations.zh-hant.description.main.source`. The compare page SHALL NOT
collapse nested source paths into only their parent field when doing so would
hide which source leaf changed.

#### Scenario: ContentDoc main source path remains visible
- **WHEN** the path-snapshot compare response contains a changed path
  `translations.zh-hant.description.main.source`
- **THEN** the compare page SHALL render that path as the changed field
  identity
- **AND** it SHALL distinguish it from the parent
  `translations.zh-hant.description`

#### Scenario: Multiple source leaves remain independently diffable
- **WHEN** the path-snapshot compare response contains changed paths
  `translations.zh-hant.description.main.source` and
  `translations.zh-hant.description.slots.cast.title.source`
- **THEN** the compare page SHALL render two independently navigable changed
  fields
- **AND** it SHALL NOT merge their source text into one parent-level diff

### Requirement: Source leaves render as text diffs
The Book history compare page SHALL render recognized textual source leaves as
source text diffs when the base and target values are strings. This applies to
legacy long-text fields and to nested rich content source leaves. Unified and
split modes SHALL use the same changed source content and differ only by
layout.

#### Scenario: Nested description source renders line diff
- **WHEN** the path-snapshot compare response contains
  `translations.zh-hant.description.main.source`
- **AND** the base and target values are different Markdown strings
- **THEN** the compare page SHALL render added and removed source lines for
  that exact path
- **AND** it SHALL preserve Markdown syntax in the displayed diff

#### Scenario: Layout switch keeps the same source diff
- **WHEN** a viewer switches a nested source change from split mode to unified
  mode
- **THEN** the same changed path SHALL remain visible
- **AND** the same added and removed source content SHALL remain visible in the
  selected layout
