## ADDED Requirements

### Requirement: Batch actor resolution for history

The system SHALL provide a batch mechanism for resolving `actorUserId` values used by history timelines into display data suitable for UI rendering. Resolution results SHALL include a stable status and SHALL avoid one request per history row.

#### Scenario: Timeline resolves actors in one batch

- **WHEN** a history timeline contains ten distinct actorUserId values
- **THEN** the app SHALL resolve those actors through a batch query
- **AND** it SHALL render display names or fallback labels without issuing ten independent actor requests

#### Scenario: Deleted actor renders fallback

- **WHEN** an actor id no longer resolves to an active user display record
- **THEN** the resolution result SHALL return a fallback status
- **AND** history UI SHALL render a stable deleted or removed actor label

### Requirement: Batch Unit reference resolution for history payloads

The system SHALL provide a batch mechanism for resolving Unit ids found in history payloads into display data. Resolution results SHALL include `OK`, `DELETED`, `GONE`, and `RESTRICTED` statuses.

#### Scenario: Referenced entity resolves to display name

- **WHEN** a revision payload references an Entity Unit id in credits
- **THEN** the history UI SHALL resolve that id through the batch Unit resolver
- **AND** it SHALL display the entity name instead of the raw UUID

#### Scenario: Restricted reference renders private fallback

- **WHEN** a revision payload references a Unit the viewer cannot access
- **THEN** the resolution result SHALL use status `RESTRICTED`
- **AND** the UI SHALL render a private fallback label instead of leaking the Unit name

### Requirement: Resolution cache is shared across history surfaces

History actor and Unit reference resolution SHALL use stable query keys so timeline, revision detail, and compare surfaces reuse cached results for the same ids.

#### Scenario: Compare reuses timeline reference cache

- **WHEN** a viewer opens a history timeline and then opens compare for two revisions from the same Unit
- **THEN** references already resolved by the timeline SHALL be served from the query cache where possible

### Requirement: History payloads remain id-only

History payload storage SHALL continue to store references as ids rather than denormalized display names. Display names SHALL be resolved at read/render time.

#### Scenario: Attribution payload stores id only

- **WHEN** a revision captures a credit attribution
- **THEN** the stored payload SHALL contain the referenced Unit id
- **AND** it SHALL NOT copy the referenced Unit's display title into the stored payload
