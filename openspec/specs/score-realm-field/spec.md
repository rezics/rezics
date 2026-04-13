### Requirement: ScoreRealmField stores field definitions per realm

The system SHALL maintain a `ScoreRealmField` model keyed by `(realm, key)`. Each record MUST have a `key` (VarChar 64, the field identifier), an optional `label` (display name), and a `sortOrder` (integer, default 0). Only admin users SHALL be able to create, modify, or delete field records. The default realm SHALL have no field records.

#### Scenario: Field definition structure

- GIVEN a realm "realm-story" with a field `key = "pacing"`, `label = "Pacing"`, `sortOrder = 1`
- WHEN the field record is queried
- THEN it SHALL contain `realm = "realm-story"`, `key = "pacing"`, `label = "Pacing"`, `sortOrder = 1`

#### Scenario: Unique constraint on realm + key

- GIVEN a field `(realm = "realm-story", key = "pacing")` already exists
- WHEN an admin attempts to create another field with the same realm and key
- THEN the system SHALL reject with a conflict error

### Requirement: List realm fields API

The system SHALL expose `GET /score/realm/:realmId` to retrieve all ScoreRealmField records for a given realm, ordered by `sortOrder` ascending. No authentication is required for this endpoint.

#### Scenario: List fields for a realm with multiple fields

- GIVEN realm "realm-story" has fields: `pacing (sortOrder=1)`, `plot (sortOrder=2)`, `characters (sortOrder=3)`
- WHEN a client calls `GET /score/realm/realm-story`
- THEN the system SHALL return the three fields ordered by sortOrder: pacing, plot, characters

#### Scenario: List fields for a realm with no fields

- GIVEN realm "realm-default" has no ScoreRealmField records
- WHEN a client calls `GET /score/realm/realm-default`
- THEN the system SHALL return an empty array

### Requirement: Add field API (admin only)

The system SHALL expose `POST /score/realm/:realmId` to create a new ScoreRealmField record. The request MUST include `key` and MAY include `label` and `sortOrder`. Only admin users SHALL be authorized to call this endpoint. The `key` MUST match the pattern `[a-z][a-z0-9-]*` (lowercase kebab-case).

#### Scenario: Admin adds a field

- GIVEN an admin user and realm "realm-story"
- WHEN the admin calls `POST /score/realm/realm-story` with `{ key: "world-building", label: "World Building", sortOrder: 4 }`
- THEN a ScoreRealmField record SHALL be created with the provided values

#### Scenario: Non-admin rejected

- GIVEN a non-admin user
- WHEN the user calls `POST /score/realm/realm-story` with a field definition
- THEN the system SHALL reject with 403 Forbidden

#### Scenario: Invalid key format rejected

- WHEN an admin submits a field with `key = "World Building"` (contains uppercase and space)
- THEN the system SHALL reject with a validation error

### Requirement: Remove field API (admin only)

The system SHALL expose `DELETE /score/realm/:realmId/:key` to remove a ScoreRealmField record. Only admin users SHALL be authorized. Removing a field definition SHALL NOT retroactively modify existing ScoreAggregate or ScoreEntry data -- the field data becomes inert.

#### Scenario: Admin removes a field

- GIVEN realm "realm-story" has a field `key = "pacing"`
- WHEN an admin calls `DELETE /score/realm/realm-story/pacing`
- THEN the ScoreRealmField record SHALL be deleted
- AND existing ScoreAggregate.fields entries for "pacing" SHALL remain unchanged (inert data)

#### Scenario: Remove non-existent field returns 404

- WHEN an admin calls `DELETE /score/realm/realm-story/nonexistent`
- THEN the system SHALL return 404 Not Found

### Requirement: Field validation on score submission

When a user submits a score with `fields`, the system SHALL validate every field key against the ScoreRealmField registry for the specified realm. Field keys not present in the registry MUST be rejected. Field keys present in the registry but omitted from the submission SHALL be treated as not scored (no aggregate impact for those fields).

#### Scenario: Valid fields accepted

- GIVEN realm "realm-story" has registered fields `["pacing", "plot", "characters"]`
- WHEN a user submits a score with `fields = { "pacing": 7, "plot": 9 }`
- THEN the system SHALL accept the submission (partial field submission is allowed)

#### Scenario: Unregistered field rejected

- GIVEN realm "realm-story" has registered fields `["pacing", "plot", "characters"]`
- WHEN a user submits a score with `fields = { "pacing": 7, "unknown-field": 5 }`
- THEN the system SHALL reject the submission with a validation error listing the invalid field key

#### Scenario: Fields submitted for fieldless realm rejected

- GIVEN realm "realm-default" has no registered fields
- WHEN a user submits a score with `fields = { "pacing": 7 }`
- THEN the system SHALL reject the submission
