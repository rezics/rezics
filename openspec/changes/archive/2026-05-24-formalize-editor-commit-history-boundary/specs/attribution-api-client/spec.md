## ADDED Requirements

### Requirement: Entity attribution batch API client

The API package SHALL expose a typed client method for `PATCH /unit/:unitId/entity-attributions/batch`. The method SHALL accept the target `unitId` and an `EntityAttributionBatchRequest`, and SHALL return the typed batch response from `@rezics/contract`.

#### Scenario: Client sends batch request

- **WHEN** `entityAttributionApi.batchUpdate("book-1", request)` is called
- **THEN** the client SHALL send `PATCH /unit/book-1/entity-attributions/batch`
- **AND** it SHALL serialize the request as JSON

### Requirement: Entity attribution batch mutation invalidates attribution queries

The API package SHALL expose a TanStack Query mutation for entity attribution batch commits. On success, the mutation SHALL invalidate the credit and subject attribution queries for the target Unit and any entity attribution batch query keys introduced for the shared editor.

#### Scenario: Batch mutation invalidates target Unit attribution data

- **WHEN** the entity attribution batch mutation succeeds for Unit `book-1`
- **THEN** credit attribution queries for `book-1` SHALL be invalidated
- **AND** subject attribution queries for `book-1` SHALL be invalidated
