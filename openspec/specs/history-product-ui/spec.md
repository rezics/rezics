# history-product-ui Specification

## Purpose

Defines the user-facing app history surfaces for Units in `package/app`. Covers the history page, editorial revision and structure-event timelines, revision detail, compare entry points, restore workflow, authority event surfaces, ingestion-lag/empty/loading/error states, accessibility/localization, and privileged raw-payload affordances for admins and maintainers.

## Requirements

### Requirement: Product history page tabs

The app SHALL provide a product-grade history page for Units with separate
views for editorial revisions, content-structure events where applicable, and
authority events. For book editing, the canonical history page SHALL be reached
from the edit-console sidebar. The page SHALL render useful empty, loading,
error, and ingestion-lag states.

#### Scenario: Book edit history shows tabs

- **WHEN** a viewer opens the Book edit-console history route
- **THEN** the page SHALL provide access to editorial revision history
- **AND** it SHALL provide access to BookContentStructure event history
- **AND** it SHALL provide access to authority history when authority events
  exist or the viewer has sufficient permission

#### Scenario: Legacy book history route has explicit behavior

- **WHEN** a viewer opens an existing non-edit Book history route
- **THEN** the app SHALL either render a compatible history view or redirect to
  the canonical edit-console history route
- **AND** the behavior SHALL be intentional rather than a duplicated accidental
  navigation path

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

### Requirement: Accessibility and localization

History and compare UI SHALL use localized user-facing copy, keyboard-accessible controls, accessible labels for icon-only actions, and semantic status text for added, removed, changed, and restricted content.

#### Scenario: Icon action has accessible label

- **WHEN** an icon-only compare or restore button is rendered
- **THEN** it SHALL have an accessible label describing the action

#### Scenario: Diff status is not color-only

- **WHEN** a field contains added or removed content
- **THEN** the UI SHALL expose the status through text or semantic markup
- **AND** it SHALL NOT rely on color alone to communicate the change

### Requirement: History route remains connected to edit workflows

Book history restore, compare, and revision detail actions SHALL keep authorized
actors within the edit-console route family when they originate from the edit
history page.

#### Scenario: Restore from edit history returns to edit flow

- **WHEN** an authorized actor starts restore from the edit-console history page
- **THEN** the restore flow SHALL navigate to the appropriate book edit route
- **AND** the edit sidebar SHALL remain the surrounding navigation context

#### Scenario: Compare from edit history preserves edit context

- **WHEN** an actor opens compare from the edit-console history page
- **THEN** the compare surface SHALL remain associated with the edit-console
  history route family or provide an explicit path back to it
