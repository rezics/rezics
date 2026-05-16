## REMOVED Requirements

### Requirement: User table primary key is `userId`

**Reason**: This requirement was the architectural commitment that User identity is "first-class and independent of Unit identity." This change reverses that commitment in favor of unifying User into the Unit graph (`User.unitId ≡ Unit.id where type = USER`). The unification is the prerequisite for the `engagement-subscription` change (`Subscription(subscriberUnitId, targetUnitId, channels)`) and for owner-scoped slug surfaces (e.g., `/u/:userSlug/shelf/:slug`). The earlier rationale (avoiding User-as-Unit-subtype) traded substrate flexibility for an asymmetry the slug subsystem has since outgrown. See `account-identity-boundary` for the new invariant.

**Migration**: For every existing `User` row, a `Unit { id = User.userId, type = USER }` row is created. The `User` PK is renamed `userId` → `unitId`. FK columns on related tables (e.g., `Unit.userId`, `ApiToken.userId`, `Follow.followerId`) keep their current names; only the `references: [...]` target is updated to `User.unitId`. The user-facing DTO field rename (`user.userId` → `user.unitId`) is the visible cutover.

### Requirement: User DTOs expose `userId`, never `unitId`

**Reason**: Inverted by this change. User-shaped DTOs in `@rezics/contract` SHALL now expose `unitId` (matching the renamed PK). See `account-identity-boundary` for the new requirement.

**Migration**: All user-shaped contract schemas (`User`, `UserBrief`, `UserSummary`, profile responses) declare `unitId: string`. Frontend, admin, and any other consumer is updated to read `user.unitId` instead of `user.userId` in a single breaking cutover.

## MODIFIED Requirements

### Requirement: User relationship with Unit preserved for ownership tracking

The User model SHALL have a stable actor identifier exposed as `User.unitId` (the unified Unit identity established by this change). The Unit owner field SHALL reference the creating User's `unitId` for ownership and authorization checks. Where related tables retain a column named `userId` (for example, `Unit.userId`, `WorkLinkClaim.claimerUserId`), the column SHALL reference `User.unitId` as its FK target.

#### Scenario: User has stable actor id

- **WHEN** inspecting the User model and its related Unit records
- **THEN** the User SHALL expose `unitId` as its stable identifier for authentication and authorization
- **AND** the User row SHALL share that id with the matching `Unit` row where `type = USER`

#### Scenario: Content ownership queries use the user's unitId

- **WHEN** the system checks whether a user owns a specific Unit
- **THEN** it SHALL compare the Unit owner identifier (typically a column named `userId`) against the authenticated actor's `unitId`
- **AND** this check SHALL resolve correctly because `User.unitId` is the FK target
