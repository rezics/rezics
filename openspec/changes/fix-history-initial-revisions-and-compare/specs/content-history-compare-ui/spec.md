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
