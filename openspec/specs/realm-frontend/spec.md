## ADDED Requirements

### Requirement: Realm landing page displays public and official realms
The route `/realm` SHALL render a landing page that displays public and official realms for discovery. The page SHALL show a curated selection of realms including an official realms section and a public realms section. Each realm SHALL be represented by a realm card. The page SHALL be accessible to both authenticated and unauthenticated users.

#### Scenario: Unauthenticated user views realm landing
- **WHEN** an unauthenticated user navigates to `/realm`
- **THEN** the page SHALL display sections for official realms and public realms
- **AND** each realm SHALL be rendered as a realm card showing name, description, member count, and badges

#### Scenario: No realms exist
- **WHEN** a user navigates to `/realm` and no realms are available
- **THEN** the page SHALL display an empty state indicating no realms are available yet

### Requirement: Realm search page with filtering and sorting
The route `/realm/search` SHALL render a search page that allows users to find realms by keyword, filter by public or official status, and sort by member count. The search SHALL be powered by the content search API.

#### Scenario: User searches realms by keyword
- **WHEN** a user enters a keyword in the realm search input
- **THEN** the page SHALL display realms whose name or description matches the keyword

#### Scenario: User filters by official status
- **WHEN** a user applies the "official" filter on the realm search page
- **THEN** only realms marked as official SHALL be displayed in the results

#### Scenario: User filters by public status
- **WHEN** a user applies the "public" filter on the realm search page
- **THEN** only realms marked as public SHALL be displayed in the results

#### Scenario: User sorts by member count
- **WHEN** a user selects "member count" as the sort option
- **THEN** the results SHALL be ordered by member count in descending order

### Requirement: Realm detail page with tabbed layout
The route `/realm/:realmId` SHALL render a realm detail page with the realm's name, description, and metadata in a header area, followed by a tabbed interface with three tabs: Feed, Tags, and Members.

#### Scenario: User views realm detail
- **WHEN** a user navigates to `/realm/:realmId`
- **THEN** the page SHALL display the realm's name, description, and metadata
- **AND** the page SHALL render three tabs: Feed, Tags, and Members
- **AND** the Feed tab SHALL be selected by default

#### Scenario: Realm not found
- **WHEN** a user navigates to `/realm/:realmId` with a non-existent realm ID
- **THEN** the page SHALL display a not-found state

### Requirement: Realm content feed tab
The Feed tab on the realm detail page SHALL display a paginated list of units (books, posts, shelves, etc.) that have been added to the realm. The feed SHALL be loaded via the realm units API.

#### Scenario: Feed tab displays realm content
- **WHEN** a user selects the Feed tab on a realm detail page
- **THEN** the tab SHALL display a paginated list of units associated with the realm
- **AND** each unit SHALL be rendered with its appropriate card representation

#### Scenario: Feed tab with no content
- **WHEN** a user selects the Feed tab and the realm has no associated units
- **THEN** the tab SHALL display an empty state indicating the realm has no content yet

### Requirement: Realm tags tab with realm-scoped tag curation
The Tags tab on the realm detail page SHALL display realm-scoped tag-unit associations managed by realm moderators. Users with moderator role or above SHALL see controls to add or remove tag-unit associations within the realm context.

#### Scenario: User views realm tags
- **WHEN** a user selects the Tags tab on a realm detail page
- **THEN** the tab SHALL display the tag-unit associations curated for this realm

#### Scenario: Moderator adds a tag-unit association
- **WHEN** a user with moderator role or above adds a tag-unit association on the Tags tab
- **THEN** the system SHALL call the realm tag unit creation API
- **AND** the tag list SHALL update to reflect the new association

#### Scenario: Moderator removes a tag-unit association
- **WHEN** a user with moderator role or above removes a tag-unit association on the Tags tab
- **THEN** the system SHALL call the realm tag unit removal API
- **AND** the tag list SHALL update to reflect the removal

#### Scenario: Regular member cannot manage tags
- **WHEN** a user with member role views the Tags tab
- **THEN** tag management controls SHALL NOT be visible

### Requirement: Realm members tab with role badges
The Members tab on the realm detail page SHALL display a list of realm members. Each member entry SHALL show the user's display name and a badge indicating their role (owner, admin, moderator, or member).

#### Scenario: User views realm members
- **WHEN** a user selects the Members tab on a realm detail page
- **THEN** the tab SHALL display a list of all realm members
- **AND** each member SHALL display a role badge indicating their role

#### Scenario: Members sorted by role hierarchy
- **WHEN** a user views the Members tab
- **THEN** members SHALL be presented with higher-privilege roles (owner, admin, moderator) visually distinguishable from regular members

### Requirement: Join and leave realm with member count
The realm detail page SHALL display a join/leave button and the current member count. Authenticated users who are not members SHALL see a "Join" button. Authenticated users who are members SHALL see a "Leave" button. The member count SHALL update after join or leave actions.

#### Scenario: Non-member joins a realm
- **WHEN** an authenticated user who is not a member of the realm clicks the "Join" button
- **THEN** the system SHALL call the realm join API
- **AND** the button SHALL change to "Leave"
- **AND** the displayed member count SHALL increment

#### Scenario: Member leaves a realm
- **WHEN** an authenticated member of the realm clicks the "Leave" button
- **THEN** the system SHALL call the realm leave API
- **AND** the button SHALL change to "Join"
- **AND** the displayed member count SHALL decrement

#### Scenario: Unauthenticated user sees member count but no join button
- **WHEN** an unauthenticated user views a realm detail page
- **THEN** the member count SHALL be displayed
- **AND** no join or leave button SHALL be rendered

### Requirement: Realm management page for owner and admin
The route `/realm/:realmId/manage` SHALL render a management page accessible only to users with owner or admin role in the realm, **or users with global admin/root role**. The page SHALL allow editing realm metadata (name, description, public/private setting), managing member roles, and deleting the realm (owner or global admin/root only).

#### Scenario: Owner accesses management page
- **WHEN** a realm owner navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls, member role management, and a realm deletion option

#### Scenario: Admin accesses management page
- **WHEN** a realm admin navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL display realm metadata editing controls and member role management
- **AND** the realm deletion option SHALL NOT be visible

#### Scenario: Global admin accesses management page of any realm
- **WHEN** a global admin navigates to `/realm/:realmId/manage` for a realm they do not own
- **THEN** the page SHALL display realm metadata editing controls, member role management, and the realm deletion option

#### Scenario: Admin manages member roles
- **WHEN** an admin changes a member's role on the management page
- **THEN** the system SHALL call the appropriate realm member role update API
- **AND** the member list SHALL refresh to reflect the change

#### Scenario: Owner deletes a realm
- **WHEN** a realm owner clicks the delete action and confirms
- **THEN** the system SHALL call the realm deletion API
- **AND** the user SHALL be navigated to `/realm`

#### Scenario: Translation update uses correct API
- **WHEN** a user edits the realm title or description on the manage page and saves
- **THEN** the system SHALL call the unit translation upsert endpoint (not embed translations in the realm update payload)

#### Scenario: Non-admin user denied access
- **WHEN** a user without owner/admin realm role and without global admin/root role navigates to `/realm/:realmId/manage`
- **THEN** the page SHALL redirect the user to the realm detail page

### Requirement: Create realm form
The route `/realm/new` SHALL render a form for creating a new realm. The form SHALL require a realm name (provided via translations), a description, and a public/private toggle. On successful creation, the user SHALL be navigated to the new realm's detail page.

#### Scenario: User creates a public realm
- **WHEN** an authenticated user fills in the realm name, description, sets the toggle to public, and submits
- **THEN** the system SHALL call the realm creation API with the provided data
- **AND** the user SHALL be navigated to `/realm/:newRealmId`

#### Scenario: User creates a private realm
- **WHEN** an authenticated user fills in the realm name, description, sets the toggle to private, and submits
- **THEN** the system SHALL call the realm creation API with the visibility set to private
- **AND** the user SHALL be navigated to `/realm/:newRealmId`

#### Scenario: Unauthenticated user cannot create realm
- **WHEN** an unauthenticated user navigates to `/realm/new`
- **THEN** the user SHALL be redirected to the authentication flow

#### Scenario: Form validation rejects empty name
- **WHEN** a user submits the create realm form without providing a name
- **THEN** the form SHALL display a validation error and SHALL NOT submit

### Requirement: Realm card component
The system SHALL provide a reusable realm card component that displays the realm's name, description (truncated), member count, and badges for public and official status. The card SHALL link to the realm's detail page.

#### Scenario: Realm card renders with full data
- **WHEN** a realm card is rendered with a realm that is public and official
- **THEN** the card SHALL display the realm name, truncated description, member count, a public badge, and an official badge
- **AND** clicking the card SHALL navigate to `/realm/:realmId`

#### Scenario: Realm card renders for private non-official realm
- **WHEN** a realm card is rendered with a realm that is private and not official
- **THEN** the card SHALL display the realm name, truncated description, and member count
- **AND** public and official badges SHALL NOT be displayed

### Requirement: Navigation sidebar entry for Realms
The application navigation sidebar SHALL include a "Realms" entry that links to `/realm`. The entry SHALL be placed alongside other content-type navigation items (Shelves, Reviews, etc.).

#### Scenario: Realms entry visible in sidebar
- **WHEN** a user views the navigation sidebar
- **THEN** a "Realms" entry SHALL be visible and SHALL link to `/realm`

#### Scenario: User clicks Realms navigation entry
- **WHEN** a user clicks the "Realms" entry in the sidebar
- **THEN** the application SHALL navigate to `/realm`

### Requirement: Create menu entry for Realm
The application's create menu (used for creating new content) SHALL include a "Realm" option that navigates to `/realm/new`.

#### Scenario: Realm option in create menu
- **WHEN** an authenticated user opens the create menu
- **THEN** a "Realm" option SHALL be available
- **AND** selecting it SHALL navigate to `/realm/new`

### Requirement: My Realms link in navigation
The application navigation SHALL include a "My Realms" entry that allows authenticated users to view their joined realms. This entry SHALL be placed in the personal section of the navigation alongside "My Shelves" and "My Reviews".

#### Scenario: Authenticated user sees My Realms link
- **WHEN** an authenticated user views the navigation sidebar
- **THEN** a "My Realms" entry SHALL be visible in the personal navigation section

#### Scenario: User clicks My Realms
- **WHEN** an authenticated user clicks the "My Realms" navigation entry
- **THEN** the application SHALL display the user's joined realms, fetched via the `GET /realms/me` endpoint

#### Scenario: Unauthenticated user does not see My Realms
- **WHEN** an unauthenticated user views the navigation sidebar
- **THEN** the "My Realms" entry SHALL NOT be visible

### Requirement: Backend endpoint GET /realms/me returns user's joined realms
The backend SHALL provide a `GET /realms/me` endpoint that returns the list of realms the authenticated user has joined. The endpoint SHALL require authentication. The response SHALL include realm metadata and the user's role in each realm.

#### Scenario: Authenticated user fetches joined realms
- **WHEN** an authenticated user calls `GET /realms/me`
- **THEN** the endpoint SHALL return a list of realms the user is a member of
- **AND** each entry SHALL include the realm metadata and the user's role in that realm

#### Scenario: User with no realm memberships
- **WHEN** an authenticated user with no realm memberships calls `GET /realms/me`
- **THEN** the endpoint SHALL return an empty list

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated request is made to `GET /realms/me`
- **THEN** the endpoint SHALL respond with an authentication error

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
