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

#### Scenario: Legacy book history route has explicit behavior

- **WHEN** a viewer opens an existing non-edit Book history route
- **THEN** the app SHALL either render a compatible history view or redirect to
  the canonical edit-console history route
- **AND** the behavior SHALL be intentional rather than a duplicated accidental
  navigation path

#### Scenario: Empty history state is successful

- **WHEN** the history service returns no revisions for a visible Unit
- **THEN** the app SHALL render an empty state explaining that no history is
  available yet
- **AND** it SHALL NOT render the state as an error

## ADDED Requirements

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
