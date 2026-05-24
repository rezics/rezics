## ADDED Requirements

### Requirement: Unit-scoped entity attribution batch endpoint

The server SHALL expose `PATCH /unit/:unitId/entity-attributions/batch` for committing credit and subject attribution edits for a target Unit. The request body SHALL contain `ops`, MAY contain `baseVersion`, and MAY contain `message`. The endpoint SHALL be unit-scoped because the edited relationship belongs to the target content Unit rather than to the referenced Entity.

#### Scenario: Batch endpoint commits attribution changes for a Unit

- **WHEN** a client sends `PATCH /unit/book-1/entity-attributions/batch` with valid attribution batch operations
- **THEN** the server SHALL apply the operations to Unit `book-1`
- **AND** the server SHALL return a typed batch response describing the committed credit and subject attribution state

#### Scenario: Entity attribution batch is not routed through referenced Entity

- **WHEN** a client edits authors, characters, studios, or subject links for a target Unit
- **THEN** the client SHALL call the unit-scoped batch endpoint
- **AND** the client SHALL NOT route the edit through an endpoint scoped to the referenced Entity id

### Requirement: Batch operations reconcile final per-role sets

Entity attribution batch operations SHALL describe final per-role sets rather than local UI add/remove/reorder gestures. The initial operation family SHALL include `setCredits` for credit attribution roles and `setSubjects` for subject attribution roles. Each operation SHALL replace the target Unit's rows for that role with the submitted ordered entries.

#### Scenario: Set authors in one operation

- **WHEN** a batch request includes `setCredits` for role `author` with two entity entries
- **THEN** the server SHALL reconcile `CreditAttribution` rows for `(unitId, role = "author")` to exactly those entries
- **AND** it SHALL preserve the submitted order through `sortOrder`

#### Scenario: Set featured characters in one operation

- **WHEN** a batch request includes `setSubjects` for role `primary_character`
- **THEN** the server SHALL reconcile `SubjectAttribution` rows for `(unitId, role = "primary_character")` to exactly the submitted entity entries
- **AND** it SHALL persist `sortOrder` and `weight` values from the entries

### Requirement: Entity attribution batch writes one editorial revision

An entity attribution batch commit SHALL run in one transaction. The server SHALL authorize all affected editorial paths, validate role keys and Entity eligibility, reconcile all requested rows, update dependent search projections, and write one `HistoryOutbox` editorial revision when the batch produces an effective change. If the batch produces no effective change, the server SHALL write no history row.

#### Scenario: Multi-role batch creates one revision

- **WHEN** a batch request changes `credits.authors` and `subjects.primary_character`
- **THEN** the server SHALL write one `HistoryOutbox` row for the successful canonical commit
- **AND** the revision payload SHALL contain final sparse state for the changed paths rather than the client's local operation log

#### Scenario: No-op batch creates no revision

- **WHEN** a batch request submits final per-role sets identical to the stored attribution rows
- **THEN** the server SHALL return success
- **AND** it SHALL NOT write a `HistoryOutbox` row

#### Scenario: Invalid operation rejects whole batch

- **WHEN** any operation in the batch references an ineligible Entity or invalid role key
- **THEN** the server SHALL reject the request
- **AND** no attribution rows or history rows from that batch SHALL be committed

### Requirement: Existing immediate attribution APIs remain available

Existing single credit and subject link/unlink endpoints SHALL remain available for simple immediate actions. Multi-edit entity attribution editor surfaces SHALL use the batch endpoint when saving a local queue as one semantic commit.

#### Scenario: Simple immediate link still works

- **WHEN** a simple UI invokes the existing single credit link endpoint
- **THEN** the existing endpoint SHALL continue to link the credit according to its current validation rules

#### Scenario: Multi-edit editor saves through batch

- **WHEN** an editor lets a user add, remove, and reorder multiple entity attributions before saving
- **THEN** the editor SHALL submit one entity attribution batch request
- **AND** it SHALL NOT replay each local add/remove as a separate history-scoped mutation
