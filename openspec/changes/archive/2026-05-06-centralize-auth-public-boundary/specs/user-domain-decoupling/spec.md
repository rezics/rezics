## MODIFIED Requirements

### Requirement: User model has no book-specific relations

The User model SHALL NOT contain `authorBook`, `pressBook`, `producerBook`, or any other content-type-specific attribution relations. The User model's relations SHALL be limited to platform concerns: owned Units through explicit owner user identifiers, follows, reactions, API tokens, and similar platform-level associations.

#### Scenario: User schema has no book attribution relations

- **WHEN** inspecting the User model in the Prisma schema
- **THEN** it SHALL NOT contain relations named `authorBook`, `pressBook`, or `producerBook`
- AND no implicit M2M junction tables (`_BookAuthor`, `_BookPress`, `_BookProducer`) SHALL exist in the schema

#### Scenario: User still owns units via explicit owner user identifier

- **WHEN** a User creates a Unit (book, post, shelf, etc.)
- **THEN** the Unit's owner field SHALL reference the creating User's `userId`
- AND the User's ownership relation SHALL include all units whose owner user identifier matches

#### Scenario: User profile does not expose attribution roles

- **WHEN** a client fetches a User profile via the User API
- **THEN** the response SHALL NOT include `authorBook`, `pressBook`, or `producerBook` arrays
- AND attribution information for content the user is credited on SHALL be retrievable through the PersonCredit/OrgCredit query path, not through the User model

### Requirement: User relationship with Unit preserved for ownership tracking

The User model SHALL have a stable actor `userId` that is distinct from any associated Unit identifier. The Unit owner field SHALL reference the creating User's `userId` for ownership and authorization checks. Any profile or identity Unit associated with a User SHALL be modeled as a related domain Unit and SHALL NOT be treated as the user's primary actor identifier.

#### Scenario: User has distinct actor id

- **WHEN** inspecting the User model and its related Unit records
- **THEN** the User SHALL expose a stable `userId` for authentication and authorization
- AND any related `unitId` SHALL remain a separate domain resource identifier

#### Scenario: Content ownership queries use explicit userId

- **WHEN** the system checks whether a user owns a specific Unit
- **THEN** it SHALL compare the Unit owner user identifier against the authenticated actor `userId`
- AND this check SHALL NOT assume the actor `userId` equals the Unit's own `id`
