## ADDED Requirements

### Requirement: Joined and Created realm filters
The Realms tab SHALL render L2 chips: "Joined" and "Created". "Joined" shows realms where the user is a member. "Created" shows realms owned by the user (`userId` filter). The active filter SHALL be persisted in the URL search param `filter`.

#### Scenario: Default to Joined
- **WHEN** a user navigates to the Realms tab without a `filter` param
- **THEN** the "Joined" chip is active and realms the user has joined are displayed

#### Scenario: Switch to Created
- **WHEN** a user clicks the "Created" chip
- **THEN** realms owned by the user are displayed and the URL updates to `?filter=created`

### Requirement: Realm list display
Each realm entry SHALL display: realm name (from translation), description snippet, member count, and badges for public/official status. Clicking a realm navigates to `/realm/:realmId`.

#### Scenario: Realm entry renders
- **WHEN** realms are loaded
- **THEN** each realm shows name, description, member count, and status badges

### Requirement: Empty state
When the user has no realms for the selected filter, an appropriate empty state SHALL be shown.

#### Scenario: No joined realms
- **WHEN** the user is not a member of any realms and the "Joined" chip is active
- **THEN** a message "Not a member of any realms yet" is displayed

#### Scenario: No created realms
- **WHEN** the user has not created any realms and the "Created" chip is active
- **THEN** a message "No realms created yet" is displayed
