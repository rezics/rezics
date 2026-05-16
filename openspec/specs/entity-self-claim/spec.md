# entity-self-claim Specification

## Purpose

Defines the user-facing self-service surface for owning and managing ENTITY units the caller has authored. `/me/entities` lists only the caller's entities, `/me/entities/new` creates a creator-owned entity (no slug or verified inputs — those are admin-only), and the entry is exposed in the `/me/settings` left rail rather than the avatar dropdown, reflecting that the vast majority of users will never declare an entity.

## Requirements

### Requirement: /me/entities lists entities owned by the current user

The route `/me/entities` SHALL render a private index of all Entity units where `Unit.userId` equals the current user's unitId. The list SHALL display each entity's primary title, kind, verified status, and a link to the entity's public detail page (`/e/:slug` if a slug exists, otherwise `/entity/:unitId`). The page SHALL also expose an entry point to `/me/entities/new`.

#### Scenario: List shows only the caller's entities

- **WHEN** the current user has created two ENTITY units (unitId A and B) and another user has created a third (unitId C)
- **AND** the current user navigates to `/me/entities`
- **THEN** the list SHALL display A and B
- **AND** the list SHALL NOT display C

#### Scenario: Empty list shows the create CTA prominently

- **WHEN** the current user has zero entities
- **THEN** `/me/entities` SHALL render an empty state with a primary CTA pointing to `/me/entities/new`

### Requirement: /me/entities/new creates a creator-owned entity

The route `/me/entities/new` SHALL render a creation form with at minimum one `UnitTranslation` (language + title) and `kind`. On submit, the form SHALL call `EntityService.create` with the caller as owner. On success, the route SHALL navigate to the entity's detail page (`/entity/:unitId`, since no slug is set at creation).

#### Scenario: Creating a personal entity navigates to its detail page

- **WHEN** the user submits `{ kind: "person", translations: [{ language: "en", title: "Pen Name" }] }` through `/me/entities/new`
- **THEN** `EntityService.create` SHALL be called with `userId = caller.unitId`
- **AND** on success, the user SHALL be navigated to `/entity/<newUnitId>`

#### Scenario: Form does not expose slug input

- **WHEN** `/me/entities/new` renders
- **THEN** no input bound to `slug` SHALL appear in the form
- **AND** the form payload submitted to `EntityService.create` SHALL omit the `slug` key

### Requirement: Sidebar entry in /me/settings

The `/me/settings` left-rail navigation SHALL include an "Entities" entry that navigates to `/me/entities`. The entry SHALL NOT appear in the main avatar dropdown or the top-level navigation, since the vast majority of users will never declare an entity.

#### Scenario: Settings sidebar shows the Entities entry

- **WHEN** a user navigates to any `/me/settings` page
- **THEN** the left-rail navigation SHALL include an "Entities" link
- **AND** clicking it SHALL navigate to `/me/entities`

#### Scenario: Main avatar dropdown does not show Entities

- **WHEN** a user opens the main avatar dropdown
- **THEN** no "Entities" entry SHALL appear in that dropdown
