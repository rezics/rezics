# edit-console-navigation Specification

## Purpose

Defines the persistent edit-console sidebar for Unit-backed and Post-backed edit
surfaces in `package/app`, rendered through the reusable edit console layout.
Covers editorial navigation entries, edit-only operational tools (authority and
history), route-local context, active-state derivation from the current route,
the route-family ownership of edit-only authority and history pages, and the
accessibility and localization rules for return actions, sidebar labels, context
labels, icon-only controls, active states, and route titles.

## Requirements

### Requirement: Edit console sidebar navigation

Unit-backed and Post-backed edit surfaces SHALL use the reusable edit console
layout for editorial navigation and edit-only operational tools. The sidebar
SHALL contain navigation entries and route-local context only; page-specific
management UI SHALL render in the routed main content area.

#### Scenario: Book editor shows edit console navigation

- **WHEN** an authorized actor opens a book edit route
- **THEN** the page SHALL render the generic edit console layout with Book edit
  configuration
- **AND** the sidebar SHALL include entries for core Book edit sections,
  authority management, and history

#### Scenario: Sidebar item opens standalone page

- **WHEN** an actor activates the authority or history sidebar entry
- **THEN** the app SHALL navigate to a standalone edit-console page for that
  concern
- **AND** the sidebar SHALL remain visible as navigation context

#### Scenario: Future library editor reuses the console shape

- **WHEN** a future library Unit editor such as Game adopts the edit console
  layout
- **THEN** it SHALL provide its own return label, primary edit entries, and
  supported operational entries
- **AND** it SHALL NOT import Book-specific navigation labels or Book-specific
  layout components

### Requirement: Edit console active state and route ownership

The edit console sidebar SHALL indicate the active edit page from the current
route. Edit-only authority and history pages SHALL live under the edit route
family for the edited surface.

#### Scenario: Authority route is active

- **WHEN** the current route is the book edit authority route
- **THEN** the authority sidebar item SHALL be marked active
- **AND** unrelated book detail tabs SHALL NOT be treated as the active
  navigation model

#### Scenario: History route is part of edit console

- **WHEN** the current route is the book edit history route
- **THEN** the history sidebar item SHALL be marked active
- **AND** restore, revision detail, and compare actions SHALL keep the actor
  within the edit console route family

### Requirement: Edit console accessibility and localization

The edit console SHALL use localized user-facing copy and accessible labels for
return actions, sidebar labels, context labels, icon-only controls, active
states, and route titles. Sidebar icons SHALL be decorative unless they are the
only visible label.

#### Scenario: Sidebar navigation is keyboard accessible

- **WHEN** a keyboard user tabs through the edit console sidebar
- **THEN** every sidebar entry SHALL be focusable in logical order
- **AND** the active page SHALL be conveyed through text, ARIA state, or
  equivalent semantic markup

#### Scenario: Sidebar labels are localized

- **WHEN** the app renders in Traditional Chinese
- **THEN** the return action, authority label, history label, and any visible
  context labels SHALL render localized copy
- **AND** they SHALL NOT rely on hardcoded English labels

### Requirement: Editor routes preserve public URLs outside main layout

Migrated edit routes SHALL preserve their public URL paths while rendering under
an editor route family that is separate from the main browsing layout. Route
organization MAY use a TanStack Router pathless editor segment so the file
structure owns editor layout without adding path segments to URLs.

#### Scenario: Review edit URL remains stable

- **WHEN** an actor opens `/review/:reviewId/edit`
- **THEN** the app SHALL render the Review editor under the edit console route
  family
- **AND** the URL SHALL remain `/review/:reviewId/edit`
- **AND** the main browsing layout SHALL NOT wrap the editor page

#### Scenario: Book edit URL remains stable after migration

- **WHEN** an actor opens `/book/:bookId/edit`
- **THEN** the app SHALL render the Book editor under the edit console route
  family
- **AND** existing Book edit child URLs such as `/book/:bookId/edit/tag` SHALL
  remain valid

### Requirement: Focal editor navigation returns to read surface

Every migrated editor console SHALL expose a localized return action that sends
the actor back to the corresponding read/detail surface for the edited content.

#### Scenario: Focal post editor returns to thread

- **WHEN** an actor opens a focal Post editor route
- **THEN** the editor console SHALL include a localized return action to the
  corresponding post thread or continue-thread read surface
