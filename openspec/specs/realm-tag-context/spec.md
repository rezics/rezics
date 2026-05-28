# realm-tag-context Specification

## Purpose

Defines the unit-detail tag aggregation surface: the global tag list
sorted by `UnitTag.score` descending plus collapsible per-realm
highlights of the tags each preferred realm has curated through
`RealmTagUnit`. The `GET /tags/for-unit/:unitId/context` endpoint
returns both in one response, resolves realm choices from
`User.settings.realmTagPreferences` (falling back to the 5 most
recently joined realms), caps preferences at 50 realms per unit type,
and localizes tag labels through the user's preferred language chain.
Anonymous callers receive only the global tag list. Includes the
`User.settings` JSON column plus its `GET`/`PUT /users/me/settings`
endpoints with deep-merge semantics, and keeps realm-tag highlights
distinct from the dedicated pair-level `RealmTagContext`
interpretation surface.

## Requirements

### Requirement: Global tag display sorted by score

The frontend SHALL display all tags for a unit sorted by `UnitTag.score` in descending order. Tags with equal scores SHALL maintain a stable sort order. Each tag SHALL display its label and score value.

#### Scenario: Tags displayed in score order

- **WHEN** a user views the tag section of a unit detail page
- **THEN** the tags SHALL appear sorted by score descending
- **AND** each tag SHALL show its resolved label and numeric score

#### Scenario: Unit with no tags shows empty state

- **WHEN** a user views a unit that has no UnitTag records
- **THEN** the tag section SHALL display an appropriate empty state

### Requirement: Realm tag highlights section

Below the global tag list, the frontend SHALL display a realm highlights section showing which tags each of the user's preferred realms has surfaced for the current unit. Each realm highlight entry SHALL contain the realm name and the subset of global tags that realm's moderators have curated via RealmTagUnit.

#### Scenario: Authenticated user sees realm highlights below global tags

- **WHEN** an authenticated user views tags for a unit
- **AND** the user has realm-tag preferences or joined realms
- **THEN** the realm highlights section SHALL appear below the global tag list
- **AND** each entry SHALL show the realm name and its curated tags for this unit

#### Scenario: Realm has no curated tags for the unit

- **WHEN** an authenticated user's preferred realm has no RealmTagUnit records for the current unit
- **THEN** that realm SHALL NOT appear in the realm highlights section

### Requirement: Realm highlights are collapsible

Each realm highlight entry SHALL be a collapsible section. The collapsed state SHALL show the realm name and a count of highlighted tags. The expanded state SHALL show the realm name and all highlighted tag labels. The default state SHALL be expanded.

#### Scenario: User collapses a realm highlight

- **WHEN** a user clicks the collapse control on a realm highlight entry
- **THEN** the entry SHALL collapse to show only the realm name and tag count

#### Scenario: User expands a collapsed realm highlight

- **WHEN** a user clicks the expand control on a collapsed realm highlight entry
- **THEN** the entry SHALL expand to show the realm name and all highlighted tag labels

### Requirement: Tag context endpoint

The server SHALL expose `GET /tags/for-unit/:unitId/context` that returns global tags and realm highlights in a single response. The response body SHALL conform to `{ tags: UnitTagDTO[], realmHighlights: RealmTagHighlight[] }` where each `RealmTagHighlight` contains a realm identifier, realm display data, and an array of tag entries resolved from existing global TAG Units. Authentication SHALL be optional for this endpoint.

The endpoint SHALL NOT be the pair-level `RealmTagContext` read endpoint. Pair-level interpretation pages SHALL be read through the dedicated realm-tag context API, while this endpoint MAY include lightweight context references for highlighted pairs.

#### Scenario: Authenticated user receives tags and realm highlights

- **WHEN** an authenticated user sends `GET /tags/for-unit/:unitId/context`
- **THEN** the server SHALL return `tags` sorted by score descending
- **AND** the server SHALL return `realmHighlights` based on the user's realm-tag preferences
- **AND** every highlighted tag SHALL resolve to an existing global tag Unit

#### Scenario: Request for non-existent unit returns 404

- **WHEN** a request is sent to `GET /tags/for-unit/:unitId/context` with a unitId that does not exist
- **THEN** the server SHALL return 404

### Requirement: Unit tag context endpoint distinguishes highlights from pair contexts

The `GET /tags/for-unit/:unitId/context` endpoint SHALL remain a unit-detail aggregation endpoint. Its `realmHighlights` entries SHALL describe realm-scoped tag applications for the current target Unit, while pair-level explanatory data SHALL belong to the separate `RealmTagContext(realmUnitId, tagUnitId)` capability. The endpoint MAY include `contextUnitId` or a context link for each highlighted realm/tag pair, but it SHALL NOT treat the pair itself as a Tag or Unit.

#### Scenario: Highlight entry references pair context without becoming identity

- **GIVEN** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **AND** `RealmTagContext(realm-1, tag-1)` exists with `contextUnitId = "context-1"`
- **WHEN** an authenticated user requests `GET /tags/for-unit/unit-1/context`
- **THEN** the relevant realm highlight entry MAY include `contextUnitId = "context-1"` or a context route
- **AND** the tag entry SHALL still identify the applied tag by global `tagUnitId = "tag-1"`
- **AND** the response SHALL NOT emit a fake tag id for `realm-1:tag-1`

#### Scenario: Highlight entry without pair context still renders as realm tag use

- **GIVEN** `RealmTagUnit(realm-1, tag-1, unit-1)` exists
- **AND** no `RealmTagContext(realm-1, tag-1)` exists
- **WHEN** an authenticated user requests `GET /tags/for-unit/unit-1/context`
- **THEN** the response SHALL still include the realm-highlight tag entry
- **AND** the context reference SHALL be null or absent according to the DTO contract

### Requirement: Server resolves realm-tag preferences

When processing the tag context endpoint for an authenticated user, the server SHALL read the user's `settings.realmTagPreferences` for the unit's type to determine which realms to include and in what rank order. The server SHALL query RealmTagUnit records for the resolved realm IDs in a single database pass. Realm highlights in the response SHALL be ordered according to the user's configured rank.

#### Scenario: User has explicit preferences for the unit type

- **WHEN** an authenticated user has `settings.realmTagPreferences[unitType].realmIds` configured
- **THEN** the server SHALL use those realm IDs in the configured order to build realm highlights

#### Scenario: User has preferences but none of the realms have tags for the unit

- **WHEN** an authenticated user's preferred realms have no RealmTagUnit records for the unit
- **THEN** the server SHALL return an empty `realmHighlights` array

### Requirement: Anonymous users see only global tags

When the tag context endpoint is called without authentication, the server SHALL return only global tags sorted by score. The `realmHighlights` array SHALL be empty. The frontend SHALL NOT render the realm highlights section for anonymous users.

#### Scenario: Anonymous request receives global tags only

- **WHEN** an unauthenticated request is sent to `GET /tags/for-unit/:unitId/context`
- **THEN** the server SHALL return `tags` sorted by score descending
- **AND** the server SHALL return `realmHighlights` as an empty array

### Requirement: Default realm highlights when no preferences configured

When an authenticated user has no realm-tag preferences for the current unit type, the server SHALL default to the 5 most recently joined realms (by RealmMember join date, descending). If the user has fewer than 5 memberships, the server SHALL use all of them.

#### Scenario: User with no preferences sees highlights from recent memberships

- **WHEN** an authenticated user has no `settings.realmTagPreferences` entry for the unit type
- **AND** the user is a member of 8 realms
- **THEN** the server SHALL use the 5 most recently joined realms for realm highlights

#### Scenario: User with fewer than 5 memberships and no preferences

- **WHEN** an authenticated user has no preferences and is a member of 2 realms
- **THEN** the server SHALL use both realms for realm highlights

#### Scenario: User with no realm memberships and no preferences

- **WHEN** an authenticated user has no preferences and no realm memberships
- **THEN** the server SHALL return an empty `realmHighlights` array

### Requirement: User realm-tag preferences page

The frontend SHALL provide a settings page where the user can configure realm-tag display preferences per unit type. For each unit type, the user SHALL be able to select which realms appear in realm highlights and arrange their rank order. The page SHALL list only realms the user has joined.

#### Scenario: User selects realms for a unit type

- **WHEN** a user navigates to the realm-tag preferences page
- **AND** selects 3 realms for the BOOK unit type and arranges their order
- **THEN** the preferences SHALL be saved with the selected realm IDs in the specified rank order

#### Scenario: User removes a realm from preferences

- **WHEN** a user removes a realm from their preferences for a unit type
- **THEN** that realm SHALL no longer appear in realm highlights for units of that type

### Requirement: Preferences stored in User.settings JSON column

User realm-tag preferences SHALL be persisted in the `settings` JSON column on the User model under the key `realmTagPreferences`. The structure SHALL be `{ [unitType: string]: { realmIds: string[], maxDisplay: number } }` where `realmIds` is ordered by rank.

#### Scenario: Preferences round-trip through settings column

- **WHEN** a user saves realm-tag preferences via the settings API
- **AND** subsequently requests tag context for a unit
- **THEN** the server SHALL resolve the same realm IDs and rank order from User.settings

### Requirement: Maximum 50 realms per unit type

The server SHALL enforce a maximum of 50 realm IDs per unit type in `settings.realmTagPreferences`. Validation SHALL occur server-side on write. Requests exceeding the limit SHALL be rejected with a 422 status and a descriptive error message.

#### Scenario: Saving exactly 50 realms succeeds

- **WHEN** a user sends a settings update with 50 realm IDs for a unit type
- **THEN** the server SHALL accept and persist the preferences

#### Scenario: Saving 51 realms is rejected

- **WHEN** a user sends a settings update with 51 realm IDs for a unit type
- **THEN** the server SHALL return 422 with an error indicating the maximum is 50 realms per unit type

### Requirement: User settings read endpoint

The server SHALL expose `GET /users/me/settings` that returns the authenticated user's settings JSON. The endpoint SHALL require authentication. If the user has no settings, the server SHALL return an empty object `{}`.

#### Scenario: Authenticated user reads their settings

- **WHEN** an authenticated user sends `GET /users/me/settings`
- **THEN** the server SHALL return the user's settings JSON

#### Scenario: User with no settings receives empty object

- **WHEN** an authenticated user with a null settings column sends `GET /users/me/settings`
- **THEN** the server SHALL return `{}`

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated request is sent to `GET /users/me/settings`
- **THEN** the server SHALL return 401

### Requirement: User settings write endpoint

The server SHALL expose `PUT /users/me/settings` that updates the authenticated user's settings. The endpoint SHALL perform a deep merge of the provided fields with existing settings, allowing partial updates without overwriting unrelated settings keys. The endpoint SHALL require authentication.

#### Scenario: Partial update merges with existing settings

- **WHEN** an authenticated user has existing settings `{ preferredLanguages: ['zh-CN'] }`
- **AND** sends `PUT /users/me/settings` with `{ realmTagPreferences: { BOOK: { realmIds: ['r1'], maxDisplay: 3 } } }`
- **THEN** the server SHALL persist `{ preferredLanguages: ['zh-CN'], realmTagPreferences: { BOOK: { realmIds: ['r1'], maxDisplay: 3 } } }`

#### Scenario: Overwriting a specific settings key

- **WHEN** an authenticated user sends `PUT /users/me/settings` with a new value for an existing key
- **THEN** the server SHALL replace that key's value while preserving other keys

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated request is sent to `PUT /users/me/settings`
- **THEN** the server SHALL return 401

### Requirement: User.settings column in User model

The User model in the server database SHALL have a `settings` column of type `Json?` (nullable JSON). A Prisma migration SHALL add this column. The column SHALL default to null for existing users.

#### Scenario: New column exists after migration

- **WHEN** the Prisma migration for User.settings is applied
- **THEN** the User table SHALL have a `settings` column of nullable JSON type
- **AND** existing user rows SHALL have `settings` as null

#### Scenario: Settings column accepts valid JSON

- **WHEN** a user's settings are written with a valid JSON object
- **THEN** the column SHALL store and return the exact JSON structure

### Requirement: Tag labels resolved in user preferred language

Tag labels in the tag context response SHALL be resolved using the authenticated user's preferred language from `settings.preferredLanguages`. The server SHALL apply the language fallback chain: explicit user preference, then system defaults. For anonymous users, the server SHALL use the system default language.

#### Scenario: User with language preference sees localized tag labels

- **WHEN** an authenticated user has `settings.preferredLanguages: ['en', 'zh-CN']`
- **AND** a tag has translations for both 'en' and 'zh-CN'
- **THEN** the tag label in the response SHALL be the 'en' translation

#### Scenario: Fallback when preferred language unavailable

- **WHEN** an authenticated user's preferred language has no translation for a tag
- **THEN** the server SHALL fall back through the language chain until a translation is found

#### Scenario: Anonymous user receives default language labels

- **WHEN** an unauthenticated request is sent to the tag context endpoint
- **THEN** tag labels SHALL be resolved using the system default language
