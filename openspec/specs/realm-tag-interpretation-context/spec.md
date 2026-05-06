## ADDED Requirements

### Requirement: RealmTagContext stores pair-level realm tag interpretation

The system SHALL store realm-specific interpretation metadata for an existing global tag in a dedicated `RealmTagContext` record keyed by `(realmUnitId, tagUnitId)`. `realmUnitId` MUST reference a `Unit(type = REALM)` through the Realm extension model, and `tagUnitId` MUST reference a `Unit(type = TAG)`. A `RealmTagContext` row SHALL NOT represent a local tag, SHALL NOT create a new tag identity, and SHALL NOT require any `RealmTagUnit` rows to exist.

#### Scenario: Create context for existing realm and tag

- **GIVEN** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **WHEN** the backend creates `RealmTagContext(realmUnitId = "realm-1", tagUnitId = "tag-1")`
- **THEN** exactly one context row SHALL exist for the pair
- **AND** no new tag Unit SHALL be created

#### Scenario: Context can exist before any unit has that realm tag

- **GIVEN** no `RealmTagUnit` row exists for `(realm-1, tag-1, *)`
- **WHEN** a realm member with write permission creates `RealmTagContext(realm-1, tag-1)`
- **THEN** the operation SHALL succeed
- **AND** no `RealmTagUnit` row SHALL be inserted as a side effect

#### Scenario: Invalid realm or tag type is rejected

- **GIVEN** `book-1` exists as a BOOK Unit
- **AND** `realm-1` exists as a REALM Unit
- **WHEN** a caller attempts to create `RealmTagContext(book-1, realm-1)`
- **THEN** the server SHALL reject the request with a validation error
- **AND** no context row SHALL be persisted

### Requirement: RealmTagContext materializes optional context content

The system SHALL support an optional `contextUnitId` on `RealmTagContext`. `contextUnitId` SHALL point to a materialized content Unit used for explanation, discussion, examples, and edit history. The identity of the realm-tag pair SHALL remain `(realmUnitId, tagUnitId)`; `contextUnitId` is only a content carrier and SHALL NOT be used as the primary identifier for the pair.

#### Scenario: Materialize context content for a pair

- **GIVEN** `RealmTagContext(realm-1, tag-1)` exists with `contextUnitId = null`
- **WHEN** an authorized caller requests materialization
- **THEN** the server SHALL create a content Unit for the context
- **AND** the server SHALL set `contextUnitId` on `RealmTagContext(realm-1, tag-1)`
- **AND** the pair identity SHALL remain `(realm-1, tag-1)`

#### Scenario: Materialization is idempotent

- **GIVEN** `RealmTagContext(realm-1, tag-1)` already has `contextUnitId = "context-1"`
- **WHEN** the same materialization request is retried
- **THEN** the server SHALL return the existing `contextUnitId`
- **AND** the server SHALL NOT create a duplicate content Unit

#### Scenario: Context content deletion does not delete the pair

- **GIVEN** `RealmTagContext(realm-1, tag-1)` references `contextUnitId = "context-1"`
- **WHEN** the referenced context content Unit is deleted by an authorized content deletion path
- **THEN** the `RealmTagContext(realm-1, tag-1)` row SHALL remain
- **AND** its `contextUnitId` SHALL become null or otherwise be reported as unavailable without creating a new pair identity

### Requirement: RealmTagContext API exposes read, update, and materialize operations

The backend SHALL expose contract-backed API operations for reading, updating, and materializing a `RealmTagContext` by `(realmUnitId, tagUnitId)`. Reads SHALL be available wherever the realm and tag are visible. Updates and materialization SHALL require authentication and SHALL use the same realm permission service that governs realm-owned explanatory content.

#### Scenario: Read existing realm tag context

- **GIVEN** `RealmTagContext(realm-1, tag-1)` exists
- **WHEN** a caller requests the pair context
- **THEN** the response SHALL include `realmUnitId`, `tagUnitId`, `contextUnitId`, `createdAt`, and `updatedAt`
- **AND** any included realm, tag, or context content objects SHALL use existing contract DTOs

#### Scenario: Read missing realm tag context

- **GIVEN** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **AND** no context row exists for `(realm-1, tag-1)`
- **WHEN** a caller requests the pair context
- **THEN** the server SHALL return an explicit empty context response or 404 according to the endpoint contract
- **AND** the response SHALL NOT imply that the tag is realm-local

#### Scenario: Unauthorized materialization is rejected

- **GIVEN** a caller lacks permission to create or manage explanatory content in `realm-1`
- **WHEN** the caller requests materialization for `(realm-1, tag-1)`
- **THEN** the server SHALL reject the request with an authorization error
- **AND** no context content Unit SHALL be created

### Requirement: RealmTagContext documentation prevents identity confusion

Schema-facing types, contract schemas, and service entry points related to `RealmTagContext` SHALL include JSDoc or equivalent source comments explaining that the pair `(realmUnitId, tagUnitId)` is the identity, that `contextUnitId` is only a materialized content carrier, and that the pair is neither a Tag nor a Unit.

#### Scenario: Developer reads context service docs

- **WHEN** a developer inspects the service or contract used to materialize a realm-tag context
- **THEN** the source documentation SHALL state that `RealmTagContext` is a pair-level explanation surface
- **AND** the documentation SHALL state that it does not create a realm-local tag or a new Unit identity for the pair
