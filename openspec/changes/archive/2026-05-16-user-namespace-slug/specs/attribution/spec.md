## ADDED Requirements

### Requirement: Attribution references resolve correctly under unified User identity

Attribution-bearing references (e.g., owner fields on Unit, claimer fields on WorkLinkClaim, follower / following ids, ApiToken owner ids) SHALL continue to refer to a user via the user's identifier — now `User.unitId` (renamed from `userId` by the `user-namespace-slug` change). FK columns on related tables MAY retain their existing names (often `userId`); their FK target SHALL be `User.unitId`, and resolution SHALL succeed because `User.unitId ≡ Unit.id where type = USER`.

This requirement is a verification clause: it does not alter the Attribution schema (`unitId`, `entityId`, `role`, `sortOrder`) or its uniqueness rules. It confirms that the User PK rename does not break any attribution-adjacent resolution path.

#### Scenario: Unit owner reference resolves to the user

- **GIVEN** a `Unit` row with `userId = <uuid>` (creator/owner reference)
- **WHEN** the system fetches the owning user
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`
- **AND** the resolution SHALL succeed without any code change beyond the FK target rename

#### Scenario: Claimer reference resolves under renamed PK

- **GIVEN** a `WorkLinkClaim` row with `claimerUserId = <uuid>`
- **WHEN** the system resolves the claimer
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`

#### Scenario: Attribution-entity references remain unaffected

- **WHEN** an `Attribution` row links a Unit to an Entity (`(unitId, entityId, role)`)
- **THEN** the entity reference SHALL continue to target the `Entity` (or its successor `ENTITY`-typed Unit), independently of the User PK rename
- **AND** no existing Attribution row SHALL require data migration as a result of this change
