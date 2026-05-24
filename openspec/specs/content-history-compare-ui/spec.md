# content-history-compare-ui Specification

## Purpose

Defines user-facing comparison behavior for content history on the Book history
compare page. The compare page SHALL correctly handle both legacy full-slot
revision payloads and post-cutover sparse PATCH revision payloads, and SHALL
delegate effective base/target state assembly to the history service's
path-snapshot compare reconstruction rather than folding revision payloads in
the app layer.

## Requirements

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

### Requirement: Compare reads from the path-snapshot reconstruction
The Book history compare page SHALL obtain base and target effective values
through the history service's path-snapshot compare reconstruction rather than
by folding revision payloads in the app layer. The compare page SHALL NOT
attempt to merge sparse PATCH payloads in sequence order on the client.

#### Scenario: Compare delegates to path-snapshot reconstruction
- **WHEN** a user opens the Book compare page for any two revisions of the
  same Book
- **THEN** the compare page SHALL request reconstructed base and target values
  keyed by editorial path from the history service
- **AND** the compare page SHALL NOT iterate revision payloads in sequence
  order to build effective state

#### Scenario: Non-adjacent compare renders range-internal changes
- **WHEN** revision 1 sets title `A`
- **AND** revision 2 changes summary
- **AND** revision 3 changes title to `B`
- **AND** a user compares revision 1 with revision 3
- **THEN** the compare page SHALL render the title change from `A` to `B`
- **AND** it SHALL render the summary change introduced by revision 2 as a
  range-internal change reflected in the target state
- **AND** the rendering SHALL match the values returned by the path-snapshot
  reconstruction

#### Scenario: Missing base value renders as additive change
- **WHEN** the path-snapshot reconstruction returns a null base value for a
  path because no revision at or before the base touched that path
- **THEN** the compare page SHALL render the change as additive, showing the
  target value with no base value
- **AND** it SHALL NOT render it as a no-changes state

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
