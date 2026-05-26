## ADDED Requirements

### Requirement: Profile overview uses canonical card surfaces

The profile overview SHALL use Card/token-aligned surfaces for pinned items,
recent activity previews, and compact stats. These surfaces SHALL consume
`@rezics/ui/shadcn` Card directly or through feature-local app components.

#### Scenario: Pinned items render as card surfaces

- **WHEN** the Overview tab renders pinned content items
- **THEN** each pinned item SHALL render as an interactive card-backed preview
  or an equivalent app card component
- **AND** the pinned section itself SHALL remain an unframed layout section

#### Scenario: Recent activity uses token-aligned previews

- **WHEN** the Overview tab renders recent activity items
- **THEN** each activity preview SHALL use Rezics text, surface, spacing, and
  hover tokens
- **AND** it SHALL NOT use raw gray utility classes or ad hoc border colors

#### Scenario: Profile stats use consistent surfaces

- **WHEN** profile stats render in the sidebar or mobile overview area
- **THEN** the stat links SHALL use a shared Card/token-aligned visual pattern
- **AND** each stat SHALL remain keyboard-accessible and navigate to the
  corresponding profile tab or filtered profile view

### Requirement: Profile card surfaces preserve profile behavior

Profile card surface refactors SHALL preserve existing profile routing, current
user detection, follow/edit actions, and mock overview data behavior.

#### Scenario: Existing profile navigation remains unchanged

- **WHEN** a user clicks a profile stat, edit action, follow action, pinned item,
  or tab link after the refactor
- **THEN** the navigation target or action semantics SHALL match the behavior
  before the card surface refactor

#### Scenario: Mock overview data remains display-only

- **WHEN** the Overview tab renders pinned items or recent activity from existing
  mock-derived content search queries
- **THEN** the card surface refactor SHALL NOT introduce persistence claims,
  pin/unpin controls, or activity-stream API behavior
