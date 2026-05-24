# wiki-content-creation Specification

## Purpose

Defines wiki-mode creation flows for catalog content and entities. Wiki-capable create endpoints accept an explicit `creationMode = "wiki"` that stamps `Unit.userId` to the seeded `rezics-wiki` User's `unitId`, while personal-mode flows keep the current user as owner. Creation mode affects only initial ownership and initial lock state; runtime edit admission is controlled by the content-authority gate. The frontend exposes clear wiki/catalog vs. personal paths without surfacing internal owner ids, and renderers avoid showing the seeded `rezics-wiki` User as a normal human author.

## Requirements

### Requirement: Wiki creation mode
Wiki-capable create endpoints SHALL accept an explicit `creationMode = "wiki"` input. When this mode is used, the server SHALL set the new Unit's `userId` to the seeded `rezics-wiki` User's `unitId` and SHALL NOT allow clients to submit arbitrary owner user ids.

#### Scenario: Ordinary user creates wiki catalog book
- **WHEN** an authenticated ordinary user submits a wiki-mode book creation request
- **THEN** the server SHALL create the BOOK Unit with `userId = rezicsWikiUser.unitId`
- **AND** the requesting user SHALL be recorded as the actor for history/audit purposes

#### Scenario: Client cannot spoof wiki owner
- **WHEN** a wiki-mode creation request includes an owner id supplied by the client
- **THEN** the server SHALL ignore or reject that owner id
- **AND** the created Unit owner SHALL be resolved by server policy

### Requirement: Personal creation mode
Wiki-capable create endpoints SHALL support personal creation where appropriate. Personal creation SHALL set `Unit.userId` to the current user's Unit id and SHALL apply the server-defined initial lock policy for personal content.

#### Scenario: User creates personal book
- **WHEN** an authenticated user submits a personal-mode book creation request
- **THEN** the server SHALL create the BOOK Unit with `userId` equal to the current user's Unit id
- **AND** the server SHALL apply the initial lock policy for personal-mode content

### Requirement: Creation mode is not runtime permission
Creation mode SHALL affect only initial owner and initial lock state. Runtime edit admission SHALL use current owner, collaborators, endpoint policy, and lock rows.

#### Scenario: Wiki-created Unit later locked
- **WHEN** a Unit was created in wiki mode and later receives a `UnitFieldLock("*")`
- **THEN** community edits SHALL be blocked by the lock despite the Unit having been created in wiki mode

### Requirement: EntityPicker inline creation uses wiki mode
EntityPicker inline entity creation from catalog/editing surfaces SHALL create `ENTITY` Units in wiki mode unless the surface is explicitly a personal claim/self-registration flow.

#### Scenario: EntityPicker creates author entity
- **WHEN** a user creates a new author entity from inside a book catalog form
- **THEN** the new ENTITY Unit's `userId` SHALL equal `rezicsWikiUser.unitId`
- **AND** the current user SHALL be recorded as the creation actor

### Requirement: Personal entity claim flows stay personal
Self-registration or claim-oriented entity flows SHALL create or transfer content according to claim rules and SHALL NOT silently set `Unit.userId` to `rezicsWikiUser.unitId`.

#### Scenario: User creates personal author entity
- **WHEN** a user uses a personal "register as author" flow
- **THEN** the ENTITY Unit SHALL be owned by that user
- **AND** it SHALL NOT be treated as an open wiki entity merely because its type is ENTITY

### Requirement: Initial lock policy
The server SHALL apply initial locks according to creation mode and content policy. Personal-mode content that has future collaborative edit surfaces SHALL be eligible for an initial `fieldKey = "*"` lock. Wiki-mode content SHALL default to no whole-object lock unless server policy locks specific fields.

#### Scenario: Personal content starts closed
- **WHEN** a personal-mode BOOK is created on a surface that also supports collaborative edits
- **THEN** the server SHALL create a whole-object lock or otherwise ensure community edits are closed by default

#### Scenario: Wiki content can start partly locked
- **WHEN** a wiki-mode catalog entry is created with verified identity fields supplied by trusted import logic
- **THEN** the server MAY create field locks for those protected identity fields
- **AND** unlocked fields SHALL remain community-editable through collaborative surfaces

### Requirement: Frontend creation-mode UI
The frontend SHALL expose clear wiki/catalog and personal creation paths where both are possible. It SHALL NOT require users to understand internal owner ids.

#### Scenario: User selects catalog creation
- **WHEN** a user creates a book through the catalog/wiki creation path
- **THEN** the frontend SHALL submit `creationMode = "wiki"`
- **AND** it SHALL render the created item as community catalog content after success

#### Scenario: User selects personal creation
- **WHEN** a user creates a book through the personal work path
- **THEN** the frontend SHALL submit personal creation intent
- **AND** it SHALL render the created item as owned by the current user

### Requirement: Rezics-wiki display
Client renderers SHALL avoid showing the seeded `rezics-wiki` User as a normal human author card for wiki-owned catalog content. They SHALL render community catalog ownership copy or an equivalent product label.

#### Scenario: Wiki-owned book card
- **WHEN** a book card receives a Unit whose `userId` equals `rezicsWikiUser.unitId`
- **THEN** the card SHALL NOT display a normal user-owner profile card for the seeded `rezics-wiki` User
- **AND** it SHALL display community catalog ownership treatment

### Requirement: Wiki-capable content creation records initial history
Wiki-capable creation paths SHALL emit an initial content-history revision in
the same transaction as canonical creation whenever the created content is in
editorial content-history scope. The creation actor SHALL be recorded as the
history actor even when wiki mode assigns ownership to the seeded `rezics-wiki`
User.

#### Scenario: Wiki catalog book creation records creator as actor
- **WHEN** an authenticated ordinary user creates a wiki-mode Book
- **THEN** the created Unit owner SHALL be `rezicsWikiUser.unitId`
- **AND** the initial history revision actor SHALL be the creating user's Unit
  id

#### Scenario: Wiki entity creation records creator as actor
- **WHEN** an authenticated ordinary user creates an Entity from a catalog
  editing surface
- **THEN** the created Entity Unit owner SHALL be `rezicsWikiUser.unitId`
- **AND** the initial history revision actor SHALL be the creating user's Unit
  id

#### Scenario: Personal creation records initial history actor
- **WHEN** an authenticated user creates personal Book or Entity content that
  is in editorial content-history scope
- **THEN** the initial history revision actor SHALL be the current user's Unit
  id
