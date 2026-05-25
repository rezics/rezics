## MODIFIED Requirements

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

#### Scenario: Non-edit book history route is unavailable

- **WHEN** a viewer opens a non-edit Book history route such as
  `/book/:bookId/history`, `/book/:bookId/history/:sequence`, or
  `/book/:bookId/history/compare/:targetSequence`
- **THEN** the app SHALL NOT render or redirect through a compatibility history
  alias
- **AND** product links to Book history SHALL target the canonical edit-console
  history route family

#### Scenario: Empty history state is successful

- **WHEN** the history service returns no revisions for a visible Unit
- **THEN** the app SHALL render an empty state explaining that no history is
  available yet
- **AND** it SHALL NOT render the state as an error

### Requirement: History route remains connected to edit workflows

Book history restore, revision detail, and compare actions SHALL keep authorized
actors within the edit-console route family when they originate from the edit
history page. Nested Book history routes SHALL render their routed child content
inside the edit console route family.

#### Scenario: Restore from edit history returns to edit flow

- **WHEN** an authorized actor starts restore from the edit-console history page
- **THEN** the restore flow SHALL navigate to the appropriate book edit route
- **AND** the edit sidebar SHALL remain the surrounding navigation context

#### Scenario: Compare from edit history preserves edit context

- **WHEN** an actor opens compare from the edit-console history page
- **THEN** the compare surface SHALL render within the edit-console history route
  family
- **AND** it SHALL provide an explicit path back to the edit history timeline

#### Scenario: Revision detail from edit history preserves edit context

- **WHEN** an actor opens revision detail from the edit-console history page
- **THEN** the revision detail surface SHALL render within the edit-console
  history route family
- **AND** the edit sidebar SHALL remain visible as navigation context
