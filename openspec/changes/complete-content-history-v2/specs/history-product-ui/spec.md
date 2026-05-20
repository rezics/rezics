## ADDED Requirements

### Requirement: Product history page tabs

The app SHALL provide a product-grade history page for Units with separate views for editorial revisions, content-structure events where applicable, and authority events. The page SHALL render useful empty, loading, error, and ingestion-lag states.

#### Scenario: Book history shows tabs

- **WHEN** a viewer opens a Book history route
- **THEN** the page SHALL provide access to editorial revision history
- **AND** it SHALL provide access to BookContentStructure event history
- **AND** it SHALL provide access to authority history when authority events exist or the viewer has sufficient permission

#### Scenario: Empty history state is successful

- **WHEN** the history service returns no revisions for a visible Unit
- **THEN** the app SHALL render an empty state explaining that no history is available yet
- **AND** it SHALL NOT render the state as an error

### Requirement: Revision timeline items

Revision timeline items SHALL display sequence, actor, time, message, changed field chips, restore/compare affordances when authorized, and an indication when the revision content is still unavailable due to ingestion or permission.

#### Scenario: Timeline item shows resolved actor

- **WHEN** an actor id resolves successfully
- **THEN** the timeline item SHALL display the actor's user-facing name or handle
- **AND** it SHALL avoid exposing only the raw UUID as the primary label

#### Scenario: Compare action opens compare route

- **WHEN** a viewer activates compare on a revision timeline item
- **THEN** the app SHALL navigate to a compare surface for that revision

### Requirement: Revision detail page

The revision detail page SHALL render revision metadata and slot content in product-readable sections. Raw payload display SHALL be hidden unless the viewer is authorized for raw history payload access.

#### Scenario: Translation slot renders readable fields

- **WHEN** a revision contains translation slot data
- **THEN** the revision detail page SHALL display title, subtitle, summary, description, and language information in readable groups

#### Scenario: Raw payload hidden from public viewer

- **WHEN** a public viewer opens revision detail
- **THEN** the raw JSON payload panel SHALL not be visible

### Requirement: Structure event timeline

The BookContentStructure history view SHALL render `book.contentStructure.batch` events as one logical save that can expand to show individual operations.

#### Scenario: Batch event collapsed summary

- **WHEN** a batch event contains five operations
- **THEN** the structure timeline SHALL render one collapsed event summary
- **AND** the summary SHALL indicate the number and kinds of operations

#### Scenario: Expanded batch shows operations

- **WHEN** a viewer expands a structure batch event
- **THEN** the UI SHALL show create, update, move, delete, link, unlink, or bulk operations in their recorded order

### Requirement: Restore workflow

The app SHALL provide a restore workflow for authorized viewers that loads a prior editorial revision into the normal edit flow and saves it as a new revision. The UI SHALL explain that restoring creates a new latest version and does not delete later history.

#### Scenario: Authorized restore opens edit flow

- **WHEN** an authorized maintainer chooses to restore revision `12`
- **THEN** the app SHALL load revision `12` into the appropriate edit form or draft flow
- **AND** the save SHALL create a new current revision through the normal mutation path

#### Scenario: Restore confirmation explains history preservation

- **WHEN** a viewer starts restore
- **THEN** the UI SHALL state that later history remains preserved
- **AND** the viewer SHALL confirm before saving the restored content

### Requirement: Compare surface

The compare surface SHALL provide a navigable list of changed fields, split/unified text diff controls, Markdown source diff rendering, collection diff rendering, and responsive behavior for narrow screens.

#### Scenario: Changed field navigation

- **WHEN** a compare result contains changes in multiple fields
- **THEN** the compare surface SHALL provide a way to jump between changed fields

#### Scenario: Mobile compare remains usable

- **WHEN** the compare view is opened on a narrow viewport
- **THEN** the UI SHALL use a single-column or unified layout that avoids horizontal overflow for normal prose content

### Requirement: Accessibility and localization

History and compare UI SHALL use localized user-facing copy, keyboard-accessible controls, accessible labels for icon-only actions, and semantic status text for added, removed, changed, and restricted content.

#### Scenario: Icon action has accessible label

- **WHEN** an icon-only compare or restore button is rendered
- **THEN** it SHALL have an accessible label describing the action

#### Scenario: Diff status is not color-only

- **WHEN** a field contains added or removed content
- **THEN** the UI SHALL expose the status through text or semantic markup
- **AND** it SHALL NOT rely on color alone to communicate the change
