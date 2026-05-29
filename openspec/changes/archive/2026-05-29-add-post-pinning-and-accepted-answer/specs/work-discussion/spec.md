## ADDED Requirements

### Requirement: Threaded view applies the promotion overlay

The threaded reply view SHALL apply the post promotion overlay on top of its database-ordered base. When loading a thread, the system SHALL fetch `PostPin` rows for the loaded root-post scope and for the realm context being viewed, and within each sibling group SHALL render accepted answers and pins ahead of ordinary replies (accepted answers ahead of pins, each ordered by `position`). Each promoted reply SHALL render its `pinKind` badge. Applying the overlay SHALL NOT modify any post `path` or the underlying base ordering.

#### Scenario: Thread renders accepted answer and pin before ordinary replies

- **GIVEN** a thread whose root has a direct reply accepted as an answer and another reply pinned
- **WHEN** the thread is loaded for display
- **THEN** the accepted answer SHALL render first with an accepted-answer badge
- **AND** the pinned reply SHALL render next with a pin badge
- **AND** the remaining replies SHALL follow in the base sort order

#### Scenario: Thread with no promotions renders unchanged

- **WHEN** a thread has no `PostPin` rows for the viewed scopes
- **THEN** the thread SHALL render exactly as it would without the overlay
