## RENAMED Requirements

### Requirement: RealmTagUnit has score, voteCount, pinned, and position fields
FROM: RealmTagUnit has score, voteCount, pinned, and position fields
TO: RealmTagApplication has score, voteCount, pinned, and position fields

### Requirement: Any realm member can create a RealmTagUnit
FROM: Any realm member can create a RealmTagUnit
TO: Any realm member can create a RealmTagApplication

### Requirement: RealmTagUnit display ordering pins-first then by score descending
FROM: RealmTagUnit display ordering pins-first then by score descending
TO: RealmTagApplication display ordering pins-first then by score descending

### Requirement: Pin and delete authority for RealmTagUnit is restricted to admin or realm owner
FROM: Pin and delete authority for RealmTagUnit is restricted to admin or realm owner
TO: Pin and delete authority for RealmTagApplication is restricted to admin or realm owner

### Requirement: RealmTagUnit deletion is unconditional for authorized actors
FROM: RealmTagUnit deletion is unconditional for authorized actors
TO: RealmTagApplication deletion is unconditional for authorized actors

### Requirement: RealmTagUnit rows with score at or below -100 are hidden from regular users
FROM: RealmTagUnit rows with score at or below -100 are hidden from regular users
TO: RealmTagApplication rows with score at or below -100 are hidden from regular users

### Requirement: Admin discovery endpoint for low-score RealmTagUnit rows
FROM: Admin discovery endpoint for low-score RealmTagUnit rows
TO: Admin discovery endpoint for low-score RealmTagApplication rows

### Requirement: RealmTagUnit and UnitTag have fully independent lifecycles
FROM: RealmTagUnit and UnitTag have fully independent lifecycles
TO: RealmTagApplication and UnitTag have fully independent lifecycles

### Requirement: RealmTagUnit and extra.tagTree have independent purposes
FROM: RealmTagUnit and extra.tagTree have independent purposes
TO: RealmTagApplication and extra.tagTree have independent purposes

### Requirement: RealmTagUnit is independent from RealmUnit
FROM: RealmTagUnit is independent from RealmUnit
TO: RealmTagApplication is independent from RealmUnit

### Requirement: RealmTagUnit relation roles are explicit and documented
FROM: RealmTagUnit relation roles are explicit and documented
TO: RealmTagApplication relation roles are explicit and documented

## ADDED Requirements

### Requirement: RealmTagApplication naming is used for realm-scoped tag applications
The schema-facing model, contract DTOs, API routes, API clients, services, mappers, tests, and documentation SHALL use `RealmTagApplication` for the triple `(realmUnitId, tagUnitId, unitId)` that records a realm applying an existing global TAG Unit to a target Unit.

#### Scenario: Old RealmTagUnit names are removed from public internal surfaces
- **WHEN** a developer imports realm-scoped tag application types from `@rezics/contract`
- **THEN** `RealmTagApplicationDTO`, `CreateRealmTagApplicationInput`, and `PatchRealmTagApplicationInput` SHALL be available
- **AND** `RealmTagUnitDTO`, `CreateRealmTagUnitInput`, and `PatchRealmTagUnitInput` SHALL NOT be exported

#### Scenario: Application identity remains unchanged
- **GIVEN** a realm tag application exists for `(realm-1, tag-1, unit-1)`
- **WHEN** the rename is applied
- **THEN** the application identity SHALL remain `(realmUnitId = "realm-1", tagUnitId = "tag-1", unitId = "unit-1")`
- **AND** no realm-local tag Unit SHALL be created

### Requirement: RealmTagApplication routes replace RealmTagUnit routes
The server SHALL expose realm-scoped tag application mutation routes under `/realm-tag-applications`. The old `/realm-tag-units` route prefix SHALL NOT remain as a compatibility alias.

#### Scenario: Create application through new route
- **WHEN** a realm member sends a valid create request to `POST /realm-tag-applications`
- **THEN** the server SHALL create or update the realm tag application using the existing creation-as-vote semantics

#### Scenario: Old route is not retained
- **WHEN** a developer audits the server route registry
- **THEN** no `/realm-tag-units` route prefix SHALL be mounted
