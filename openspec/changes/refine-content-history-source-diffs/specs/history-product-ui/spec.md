## MODIFIED Requirements

### Requirement: Compare surface

The compare surface SHALL provide a navigable list of changed fields, split/unified text diff controls, Markdown source diff rendering, collection diff rendering, and responsive behavior for narrow screens. Unified and split modes SHALL be layout choices for textual diffs; switching between them SHALL NOT change which changed fields are treated as text diffs. Nested source paths MAY be visually grouped for readability, but each changed source leaf SHALL remain independently navigable.

#### Scenario: Changed field navigation

- **WHEN** a compare result contains changes in multiple fields
- **THEN** the compare surface SHALL provide a way to jump between changed fields

#### Scenario: Mobile compare remains usable

- **WHEN** the compare view is opened on a narrow viewport
- **THEN** the UI SHALL use a single-column or unified layout that avoids horizontal overflow for normal prose content

#### Scenario: Layout mode does not change text diff eligibility

- **WHEN** a compare result contains a nested textual source change
- **AND** a viewer switches between unified and split modes
- **THEN** the changed source leaf SHALL remain rendered as a text diff in both modes
- **AND** the changed-field navigation SHALL continue to point to the same leaf path

#### Scenario: Grouped rich paths remain addressable

- **WHEN** the compare surface groups multiple changed source leaves under the same rich description parent
- **THEN** each source leaf SHALL still have its own navigable target
- **AND** the UI SHALL distinguish paths such as `main.source` and `slots.cast.title.source`
