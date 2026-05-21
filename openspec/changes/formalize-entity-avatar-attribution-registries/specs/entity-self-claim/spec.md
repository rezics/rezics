## MODIFIED Requirements

### Requirement: /me/entities/new creates a creator-owned entity
The route `/me/entities/new` SHALL render a creation form with at minimum one `UnitTranslation` (language + title), a registered Entity kind key, and optional avatar. On submit, the form SHALL call `EntityService.create` with personal creation intent so the caller is the owner. On success, the route SHALL navigate to the entity's detail page (`/entity/:unitId`, since no slug is set at creation).

#### Scenario: Creating a personal entity navigates to its detail page
- **WHEN** the user submits `{ kind: "person", avatar: "https://cdn.example/me.png", translations: [{ language: "en", title: "Pen Name" }] }` through `/me/entities/new`
- **THEN** `EntityService.create` SHALL be called with personal creation intent
- **AND** on success, the user SHALL be navigated to `/entity/<newUnitId>`
- **AND** the Entity detail SHALL be able to display the avatar

#### Scenario: Form does not expose slug input
- **WHEN** `/me/entities/new` renders
- **THEN** no input bound to `slug` SHALL appear in the form
- **AND** the form payload submitted to `EntityService.create` SHALL omit the `slug` key

#### Scenario: Form rejects unregistered kind
- **WHEN** a user attempts to submit an Entity kind that is not in the registry
- **THEN** the form SHALL prevent submission or the API SHALL reject the payload

## ADDED Requirements

### Requirement: My entities list displays avatar
The `/me/entities` list SHALL display each Entity avatar when present, using a compact fallback when absent.

#### Scenario: Entity list row has avatar
- **WHEN** the current user's Entity has an avatar
- **THEN** `/me/entities` SHALL render that avatar in the entity row
