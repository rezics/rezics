# entity-admin-page Specification

## Purpose

Defines the admin-only surfaces for managing ENTITY units: a global index at `/admin/entities` listing every entity regardless of owner, and an edit page at `/admin/entities/:unitId` that is the sole place where the `verified` flag and the canonical `slug` can be mutated. The admin page wires both controls through `EntityService.update`, enforces the `verified` → `slug` ordering in the UI, and also supports `UnitTranslation` editing as part of the same atomic payload.
## Requirements
### Requirement: /admin/entities lists all entities with admin-relevant fields

The admin route `/admin/entities` SHALL render a paginated index of all Entity units in the system, regardless of `Unit.userId`. Each row SHALL display at minimum: `unitId`, primary title, `kind`, `verified`, `slug` (if set), `createdAt`, and a link to the entity's admin edit page. The list SHALL support filtering by `verified` and `kind`, and text search across translation titles via the Meili `entities` index.

#### Scenario: Admin index lists all entities

- **WHEN** an admin navigates to `/admin/entities`
- **AND** the system contains entities owned by multiple users
- **THEN** every entity SHALL appear in the list regardless of owner

#### Scenario: Non-admin is denied access

- **WHEN** a non-admin user navigates to `/admin/entities`
- **THEN** the route SHALL return a forbidden state
- **AND** SHALL NOT render the list

### Requirement: /admin/entities/:unitId is the sole surface for slug and verified mutation

The admin route `/admin/entities/:unitId` SHALL render an edit page exposing two controls dedicated to admin authority: a `verified` toggle and a `slug` input. Both controls SHALL submit through `EntityService.update`. The slug input SHALL be disabled in the UI when `verified = false`, and the server SHALL reject any slug write that arrives without `verified = true` (per `entity-service`).

#### Scenario: Toggling verified persists immediately

- **WHEN** an admin toggles `verified` from false to true on the edit page
- **AND** confirms the change
- **THEN** `EntityService.update(unitId, { verified: true })` SHALL be called
- **AND** on success, the slug input SHALL become enabled

#### Scenario: Slug input disabled when entity is unverified

- **WHEN** the edit page renders for an Entity with `verified = false`
- **THEN** the slug input SHALL be disabled
- **AND** a tooltip or inline hint SHALL explain that verification is a prerequisite

#### Scenario: Admin sets slug on a verified entity

- **WHEN** an admin enters `"liu-cixin"` in the slug input on an entity with `verified = true`
- **AND** submits the change
- **THEN** `EntityService.update(unitId, { slug: "liu-cixin" })` SHALL be called
- **AND** on success, the entity SHALL be addressable via `/e/liu-cixin`

#### Scenario: Slug input applies validateSlug rules client-side

- **WHEN** an admin types an invalid slug (too short, leading hyphen, reserved word, etc.)
- **THEN** the input SHALL surface the same validation error as the server would, using the shared `validateSlug` helper from `@rezics/contract`
- **AND** the submit button SHALL be disabled until the slug is valid or cleared

### Requirement: Admin edit page supports translation editing

The admin edit page SHALL allow admins to add, update, and remove `UnitTranslation` rows for the entity using the standard translation editor pattern used elsewhere in the codebase. Translation edits SHALL submit through `EntityService.update` as part of the same payload that can carry `verified` and `slug` changes.

#### Scenario: Adding a new translation

- **WHEN** an admin adds a translation `{ language: "ja", title: "劉慈欣" }`
- **AND** submits the change
- **THEN** a new UnitTranslation row SHALL be persisted for that entity in ja
- **AND** the new translation SHALL appear in EntityPicker queries searching the Japanese title

### Requirement: Entity admin participates in content operations

Entity admin index and detail pages SHALL follow the shared admin content operation patterns for filters, table density, authority actions, audit reason capture, and repair links.

#### Scenario: Entity authority action requires reason

- **WHEN** an admin changes verified status or canonical slug
- **THEN** the UI SHALL capture a reason when audit policy requires it
