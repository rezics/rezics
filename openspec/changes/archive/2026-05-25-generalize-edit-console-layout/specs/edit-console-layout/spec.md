## ADDED Requirements

### Requirement: Generic edit console layout

The app SHALL provide a reusable edit console layout for Unit-backed and
Post-backed edit surfaces. The layout SHALL be configured by the owning feature
with a localized return action, primary edit navigation, optional operational
navigation, optional lower context content, and routed main content.

#### Scenario: Book edit uses generic edit console

- **WHEN** an authorized actor opens a Book edit route
- **THEN** the page SHALL render through the generic edit console layout
- **AND** the Book feature SHALL provide the Book-specific return action and
  primary edit navigation through layout configuration

#### Scenario: Simple editor uses minimal console

- **WHEN** an edit surface has only one editable page and no edit-only
  operations
- **THEN** the edit console layout SHALL be able to render a localized return
  action and routed main content without authority or history navigation

### Requirement: Surface capabilities control operational items

The edit console layout SHALL render operational navigation from explicit surface
capability configuration. It SHALL NOT infer authority or history availability
from a hardcoded `UnitType` or `PostKind` switch inside the layout.

#### Scenario: Library Unit exposes authority and history

- **WHEN** a library Unit edit surface such as Book provides authority and
  history operational items
- **THEN** the edit console SHALL render those items in the operational
  navigation group
- **AND** activating those items SHALL keep the actor in the edit route family

#### Scenario: Non-operational surface hides operations

- **WHEN** a surface does not provide authority or history operational items
- **THEN** the edit console SHALL omit those operation links
- **AND** the absence of those links SHALL NOT affect the return action or
  primary edit navigation

### Requirement: Context slot renders below the console divider

The edit console layout SHALL provide an optional lower sidebar context slot
below a visual divider. The context slot SHALL be used for route-local context,
not for page-level management forms.

#### Scenario: Chapter edit renders book context and chapter context

- **WHEN** an actor opens a chapter edit route under a Book edit console
- **THEN** the upper sidebar navigation SHALL remain the Book edit navigation
- **AND** the lower context slot SHALL render context for the currently edited
  chapter when available

#### Scenario: Empty context slot does not consume scroll area

- **WHEN** the current edit route provides no lower context content
- **THEN** the sidebar SHALL NOT show a permanent scrollbar caused only by an
  empty lower context area

### Requirement: Edit console layout follows app design constraints

The edit console SHALL use the app design system tokens, localized labels,
keyboard-accessible navigation, and decorative icons unless an icon is the only
visible label.

#### Scenario: Navigation is localized and accessible

- **WHEN** the app renders the edit console in Traditional Chinese
- **THEN** the return action, primary navigation, operational navigation, and
  context labels SHALL render localized text
- **AND** every navigation entry SHALL be keyboard focusable and expose its
  active state through semantic markup or equivalent accessible text
