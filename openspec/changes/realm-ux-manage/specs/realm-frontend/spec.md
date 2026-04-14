## MODIFIED Requirements

### Requirement: Role-based UI visibility
The realm frontend SHALL conditionally display management controls based on the authenticated user's role within the realm **or their global system role**. Global admin and root users SHALL see all management controls regardless of realm membership. Moderator and above SHALL see tag management controls on the Tags tab. Admin and above SHALL see member role management controls on the Members tab and access to the management page. Only the owner (or global admin/root) SHALL see the realm deletion option.

#### Scenario: Global admin sees manage icon without realm membership
- **WHEN** a user with global role `ADMIN` views a realm detail page (without being a member)
- **THEN** a manage icon/button SHALL be visible in the realm header
- **AND** clicking it SHALL navigate to `/realm/:realmId/manage`

#### Scenario: Global root sees manage icon
- **WHEN** a user with global role `ROOT` views any realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Realm moderator sees manage icon
- **WHEN** a user with realm role `moderator` views the realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Realm admin sees manage icon
- **WHEN** a user with realm role `admin` views the realm detail page
- **THEN** a manage icon/button SHALL be visible in the realm header

#### Scenario: Regular member does not see manage icon
- **WHEN** a user with realm role `member` views the realm detail page
- **THEN** no manage icon/button SHALL be visible

#### Scenario: Non-member does not see manage icon
- **WHEN** a non-member user views a public realm detail page
- **THEN** no manage icon/button SHALL be visible

### Requirement: Realm management page for owner and admin
The route `/realm/:realmId/manage` SHALL render a management page accessible only to users with owner or admin role in the realm, **or users with global admin/root role**. The page SHALL allow editing realm metadata (name, description, public/private setting), managing member roles, and deleting the realm (owner or global admin/root only).

#### Scenario: Global admin accesses management page of any realm
- **WHEN** a global admin navigates to `/realm/:realmId/manage` for a realm they do not own
- **THEN** the page SHALL display realm metadata editing controls, member role management, and the realm deletion option

#### Scenario: Non-admin user denied access
- **WHEN** a user without owner/admin realm role and without global admin/root role navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL redirect the user to the realm detail page

#### Scenario: Translation update uses correct API
- **WHEN** a user edits the realm title or description on the manage page and saves
- **THEN** the system SHALL call the unit translation upsert endpoint (not embed translations in the realm update payload)

## ADDED Requirements

### Requirement: Realm seed produces non-null titles
The mock seed generator SHALL ensure that all seeded realms have at least one UnitTranslation row with a non-null, non-empty `title` field.

#### Scenario: Seeded realm has title
- **GIVEN** the mock seed has been run
- **WHEN** any realm is queried via the API
- **THEN** `unit.translations` SHALL contain at least one entry with a non-empty `title`

### Requirement: Manage icon placement in RealmPage header
The manage icon SHALL appear in the realm detail page header row, positioned near the realm title and join button. The icon SHALL be an MUI settings or tune icon. It SHALL link to `/realm/:realmId/manage`.

#### Scenario: Manage icon renders in header
- **WHEN** a user with manage permission views the realm detail page
- **THEN** a settings icon SHALL be visible in the header area next to the realm title
- **AND** clicking it SHALL navigate to `/realm/:realmId/manage`
