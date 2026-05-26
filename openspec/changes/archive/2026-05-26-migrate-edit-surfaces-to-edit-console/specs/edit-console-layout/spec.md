## ADDED Requirements

### Requirement: Migrated edit surfaces use the generic edit console

The app SHALL render migrated Unit-backed and Post-backed editor routes through
the reusable edit console layout instead of the main browsing layout. Each
owning feature SHALL provide its own localized return action, primary edit
navigation, optional operational navigation, and optional context slot.

#### Scenario: Simple edit surface uses minimal console

- **WHEN** an authorized actor opens a migrated simple editor such as Shelf,
  Review, Remark, Excerpt, Entity, or focal Post edit
- **THEN** the page SHALL render inside the edit console layout
- **AND** the console SHALL be valid with only a localized return action and the
  routed editor content when no operational pages are configured

#### Scenario: Rich edit surface keeps operational navigation

- **WHEN** an authorized actor opens a rich editor such as Book edit
- **THEN** the page SHALL render inside the edit console layout
- **AND** the surface SHALL provide its operational navigation explicitly rather
  than relying on hardcoded Unit type checks inside the layout

### Requirement: Editor console handles partial capability availability

The edit console SHALL allow individual routes, navigation items, fields, and
operations to be unavailable even when the viewer can enter the editor. The
layout SHALL NOT infer that editor entry means every tab or field is editable.

#### Scenario: Editor entered with locked content fields

- **WHEN** a viewer enters a collaborative editor where all ordinary content
  fields are locked but tag editing remains available
- **THEN** the edit console SHALL render the available editor area
- **AND** locked or unauthorized sections SHALL indicate their unavailable state
  instead of disappearing the entire editor shell
