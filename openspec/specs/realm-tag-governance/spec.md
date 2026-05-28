# realm-tag-governance Specification

## Purpose

Owns the governance surfaces around the realm-tag model: the
`GET /tags/for-unit/:unitId/context` unit-detail aggregation that
returns the global tag list plus collapsible per-realm highlights,
the pair-level `RealmTagContext(realmUnitId, tagUnitId)` explanatory
surface with its optional materialized `contextUnitId` content,
the `RealmTagApplicationVote` model that records realm-member
agreement on whether a global tag applies to a Unit inside a realm,
and the seed-data invariants that demonstrate realms as communities
with shared global tags, per-realm interpretations, and idempotent
reseed. Previously split across `realm-tag-context`,
`realm-tag-interpretation-context`, `realm-tag-vote`, and
`realm-taxonomy-seed-support`; the underlying data-model spec
remains in `realm-tag-unit`.

## Tag context endpoint

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

## Pair-level interpretation

### Requirement: RealmTagContext stores pair-level realm tag interpretation

The system SHALL store realm-specific interpretation metadata for an existing global tag in a dedicated `RealmTagContext` record keyed by `(realmUnitId, tagUnitId)`. `realmUnitId` MUST reference a `Unit(type = REALM)` through the Realm extension model, and `tagUnitId` MUST reference a `Unit(type = TAG)`. A `RealmTagContext` row SHALL NOT represent a local tag, SHALL NOT create a new tag identity, and SHALL NOT require any `RealmTagUnit` rows to exist.

#### Scenario: Create context for existing realm and tag

- **GIVEN** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **WHEN** the backend creates `RealmTagContext(realmUnitId = "realm-1", tagUnitId = "tag-1")`
- **THEN** exactly one context row SHALL exist for the pair
- **AND** no new tag Unit SHALL be created

#### Scenario: Context can exist before any unit has that realm tag

- **GIVEN** no `RealmTagUnit` row exists for `(realm-1, tag-1, *)`
- **WHEN** a realm member with write permission creates `RealmTagContext(realm-1, tag-1)`
- **THEN** the operation SHALL succeed
- **AND** no `RealmTagUnit` row SHALL be inserted as a side effect

#### Scenario: Invalid realm or tag type is rejected

- **GIVEN** `book-1` exists as a BOOK Unit
- **AND** `realm-1` exists as a REALM Unit
- **WHEN** a caller attempts to create `RealmTagContext(book-1, realm-1)`
- **THEN** the server SHALL reject the request with a validation error
- **AND** no context row SHALL be persisted

### Requirement: RealmTagContext materializes optional context content

The system SHALL support an optional `contextUnitId` on `RealmTagContext`. `contextUnitId` SHALL point to a materialized content Unit used for explanation, discussion, examples, and edit history. The identity of the realm-tag pair SHALL remain `(realmUnitId, tagUnitId)`; `contextUnitId` is only a content carrier and SHALL NOT be used as the primary identifier for the pair.

#### Scenario: Materialize context content for a pair

- **GIVEN** `RealmTagContext(realm-1, tag-1)` exists with `contextUnitId = null`
- **WHEN** an authorized caller requests materialization
- **THEN** the server SHALL create a content Unit for the context
- **AND** the server SHALL set `contextUnitId` on `RealmTagContext(realm-1, tag-1)`
- **AND** the pair identity SHALL remain `(realm-1, tag-1)`

#### Scenario: Materialization is idempotent

- **GIVEN** `RealmTagContext(realm-1, tag-1)` already has `contextUnitId = "context-1"`
- **WHEN** the same materialization request is retried
- **THEN** the server SHALL return the existing `contextUnitId`
- **AND** the server SHALL NOT create a duplicate content Unit

#### Scenario: Context content deletion does not delete the pair

- **GIVEN** `RealmTagContext(realm-1, tag-1)` references `contextUnitId = "context-1"`
- **WHEN** the referenced context content Unit is deleted by an authorized content deletion path
- **THEN** the `RealmTagContext(realm-1, tag-1)` row SHALL remain
- **AND** its `contextUnitId` SHALL become null or otherwise be reported as unavailable without creating a new pair identity

### Requirement: RealmTagContext API exposes read, update, and materialize operations

The backend SHALL expose contract-backed API operations for reading, updating, and materializing a `RealmTagContext` by `(realmUnitId, tagUnitId)`. Reads SHALL be available wherever the realm and tag are visible. Updates and materialization SHALL require authentication and SHALL use the same realm permission service that governs realm-owned explanatory content.

#### Scenario: Read existing realm tag context

- **GIVEN** `RealmTagContext(realm-1, tag-1)` exists
- **WHEN** a caller requests the pair context
- **THEN** the response SHALL include `realmUnitId`, `tagUnitId`, `contextUnitId`, `createdAt`, and `updatedAt`
- **AND** any included realm, tag, or context content objects SHALL use existing contract DTOs

#### Scenario: Read missing realm tag context

- **GIVEN** `realm-1` exists as a REALM Unit
- **AND** `tag-1` exists as a TAG Unit
- **AND** no context row exists for `(realm-1, tag-1)`
- **WHEN** a caller requests the pair context
- **THEN** the server SHALL return an explicit empty context response or 404 according to the endpoint contract
- **AND** the response SHALL NOT imply that the tag is realm-local

#### Scenario: Unauthorized materialization is rejected

- **GIVEN** a caller lacks permission to create or manage explanatory content in `realm-1`
- **WHEN** the caller requests materialization for `(realm-1, tag-1)`
- **THEN** the server SHALL reject the request with an authorization error
- **AND** no context content Unit SHALL be created

### Requirement: RealmTagContext documentation prevents identity confusion

Schema-facing types, contract schemas, and service entry points related to `RealmTagContext` SHALL include JSDoc or equivalent source comments explaining that the pair `(realmUnitId, tagUnitId)` is the identity, that `contextUnitId` is only a materialized content carrier, and that the pair is neither a Tag nor a Unit.

#### Scenario: Developer reads context service docs

- **WHEN** a developer inspects the service or contract used to materialize a realm-tag context
- **THEN** the source documentation SHALL state that `RealmTagContext` is a pair-level explanation surface
- **AND** the documentation SHALL state that it does not create a realm-local tag or a new Unit identity for the pair

## Tag votes

### Requirement: RealmTagApplicationVote records per-member votes on realm tag applications

RealmTagApplicationVote SHALL be a vote table keyed by the realm-tag application and voter. Its composite primary key SHALL be `(realmUnitId, tagUnitId, unitId, userId)`. It SHALL contain a `value` field constrained to `+1` or `-1` and a `createdAt` timestamp. Each realm member MAY hold at most one RealmTagApplicationVote per `RealmTagApplication(realmUnitId, tagUnitId, unitId)` application, indicating whether they agree (+1) or disagree (-1) that the global tag applies to the target Unit within that realm.

RealmTagApplicationVote SHALL relate to `RealmTagApplication` as its application target rather than exposing separate reverse relations from Unit for realm, tag, and target roles.

#### Scenario: Member upvotes a realm tag application

- **GIVEN** user "user-1" is a member of "realm-1"
- **AND** RealmTagApplication `(realm-1, tag-1, unit-1)` exists
- **WHEN** "user-1" submits a +1 RealmTagApplicationVote on `(realm-1, tag-1, unit-1)`
- **THEN** a RealmTagApplicationVote record SHALL be persisted with `(realmUnitId = "realm-1", tagUnitId = "tag-1", unitId = "unit-1", userId = "user-1", value = +1)`

#### Scenario: Member downvotes a realm tag application

- **GIVEN** user "user-2" is a member of "realm-1"
- **AND** RealmTagApplication `(realm-1, tag-1, unit-1)` exists
- **WHEN** "user-2" submits a -1 RealmTagApplicationVote on `(realm-1, tag-1, unit-1)`
- **THEN** a RealmTagApplicationVote record SHALL be persisted with `value = -1`

#### Scenario: Member cannot hold two votes on the same realm tag application

- **GIVEN** user "user-1" already has a +1 RealmTagApplicationVote on `(realm-1, tag-1, unit-1)`
- **WHEN** "user-1" submits another vote on the same application
- **THEN** the system SHALL update the existing record rather than creating a duplicate
- **AND** the composite primary key constraint SHALL enforce uniqueness

### Requirement: RealmTagApplicationVote write requires realm membership at write time

The system SHALL verify that the voter is a current member of the target realm at the moment a RealmTagApplicationVote is created or updated. Non-members and unauthenticated callers SHALL be rejected with an authorization error.

#### Scenario: Non-member is rejected

- **GIVEN** user "user-3" is NOT a member of "realm-1"
- **WHEN** "user-3" attempts to cast a RealmTagApplicationVote on a triple in "realm-1"
- **THEN** the system SHALL deny the operation with an authorization error
- **AND** no RealmTagApplicationVote record SHALL be created

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated caller attempts to write a RealmTagApplicationVote
- **THEN** the system SHALL deny the operation with an authentication error

#### Scenario: Member submits a vote successfully

- **GIVEN** user "user-1" is a current member of "realm-1"
- **WHEN** "user-1" submits a +1 RealmTagApplicationVote on `(realm-1, unit-1, tag-1)`
- **THEN** the operation SHALL succeed and persist the vote

### Requirement: RealmTagApplicationVote retention is permanent across membership changes

Once a RealmTagApplicationVote record has been created, it SHALL persist regardless of whether the voter remains a member of the realm. Removal of a RealmMember record SHALL NOT delete or modify any RealmTagApplicationVote rows previously written by that user. The denormalized `RealmTagApplication.score` SHALL continue to reflect retained historical votes.

#### Scenario: Member leaves the realm; their vote remains

- **GIVEN** user "user-1" cast a +1 RealmTagApplicationVote on `(realm-1, unit-1, tag-1)`
- **AND** the corresponding RealmTagApplication row reflects that vote in `score` and `voteCount`
- **WHEN** "user-1" leaves "realm-1" (RealmMember record removed)
- **THEN** the RealmTagApplicationVote record SHALL still exist
- **AND** the RealmTagApplication row's `score` and `voteCount` SHALL be unchanged

#### Scenario: Former member cannot cast a new vote

- **GIVEN** user "user-1" is no longer a member of "realm-1"
- **WHEN** "user-1" attempts to write a new RealmTagApplicationVote in "realm-1"
- **THEN** the system SHALL reject the write with an authorization error
- **AND** any prior RealmTagApplicationVote rows by "user-1" SHALL remain unchanged

### Requirement: RealmTagApplicationVote rows are the sole source of RealmTagApplication score

`RealmTagApplication.score` SHALL equal the sum of `value` across all RealmTagApplicationVote rows matching the application `(realmUnitId, tagUnitId, unitId)`. `RealmTagApplication.voteCount` SHALL equal the count of those rows. The denormalized values on RealmTagApplication are maintained for read performance, but the RealmTagApplicationVote table is authoritative; any divergence is treated as a recovery scenario, not a feature.

#### Scenario: Score reflects sum of vote values

- **GIVEN** RealmTagApplicationVote rows for `(realm-1, tag-1, unit-1)`: `(user-A, +1)`, `(user-B, +1)`, `(user-C, -1)`
- **WHEN** the system computes the canonical score
- **THEN** RealmTagApplication `(realm-1, tag-1, unit-1)` SHALL have `score = +1` and `voteCount = 3`

#### Scenario: Recovery from drift

- **GIVEN** RealmTagApplication `(realm-1, tag-1, unit-1)` has `score = 7` but RealmTagApplicationVote rows sum to `5`
- **WHEN** an integrity recovery is run
- **THEN** the RealmTagApplication row SHALL be updated to `score = 5` and `voteCount = count(RealmTagApplicationVote rows)`

### Requirement: Creating a RealmTagApplication row writes the creator's first +1 RealmTagApplicationVote

When a `POST /realm-tag-application` request creates a RealmTagApplication row that did not previously exist, the system MUST atomically insert a `RealmTagApplicationVote` row of `(realmUnitId, tagUnitId, unitId, userId = caller, value = +1)`. The newly created RealmTagApplication row SHALL therefore have `score = 1` and `voteCount = 1`.

#### Scenario: First-time create initializes vote and score

- **GIVEN** no RealmTagApplication exists for `(realm-1, tag-1, unit-1)`
- **AND** caller "user-1" is a member of "realm-1"
- **WHEN** "user-1" sends `POST /realm-tag-application` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagApplication row SHALL be created with `score = 1`, `voteCount = 1`, `pinned = false`, `position = null`
- **AND** a RealmTagApplicationVote row SHALL be created with `(realm-1, tag-1, unit-1, user-1, +1)`

### Requirement: A subsequent create by another member behaves as a +1 vote on the existing row

When a `POST /realm-tag-application` request targets a `(realmUnitId, tagUnitId, unitId)` application for which a RealmTagApplication already exists, and the caller has not previously cast a vote on that application, the system MUST insert a RealmTagApplicationVote row of value `+1` from the caller and increment the existing RealmTagApplication's `score` and `voteCount` by 1.

#### Scenario: Second member tags the same triple

- **GIVEN** RealmTagApplication `(realm-1, tag-1, unit-1)` exists with `score = 1`, `voteCount = 1`
- **AND** caller "user-2" is a member of "realm-1" and has no prior RealmTagApplicationVote on this application
- **WHEN** "user-2" sends `POST /realm-tag-application` for `(realm-1, unit-1, tag-1)`
- **THEN** a RealmTagApplicationVote row SHALL be created with `(realm-1, tag-1, unit-1, user-2, +1)`
- **AND** the RealmTagApplication row SHALL be updated to `score = 2`, `voteCount = 2`
- **AND** no duplicate RealmTagApplication SHALL be created

### Requirement: Repeated create by the same member is idempotent

When a `POST /realm-tag-application` request targets an application on which the caller already holds a RealmTagApplicationVote, the system MUST treat the request as a no-op for vote insertion: it SHALL NOT create a duplicate vote row and SHALL NOT increment `score` or `voteCount`. The endpoint SHALL return success with the current RealmTagApplication state. The global TagVote contribution owned by the same request path SHALL also remain idempotent.

#### Scenario: Member retries a create they already performed

- **GIVEN** "user-1" previously created RealmTagApplication `(realm-1, tag-1, unit-1)`, producing a RealmTagApplicationVote row
- **WHEN** "user-1" sends `POST /realm-tag-application` for the same application again
- **THEN** the system SHALL return success
- **AND** no additional RealmTagApplicationVote row SHALL be inserted
- **AND** RealmTagApplication `score` and `voteCount` SHALL be unchanged
- **AND** no duplicate global TagVote SHALL be inserted for `(user-1, unit-1, tag-1)`

### Requirement: RealmTagApplicationVote cascades from the realm tag application

RealmTagApplicationVote rows SHALL be modeled as votes on a specific `RealmTagApplication` application. Deleting a `RealmTagApplication(realmUnitId, tagUnitId, unitId)` row SHALL delete all `RealmTagApplicationVote` rows for that application through the application relation or an equivalent transactional cascade.

#### Scenario: Application delete removes its votes

- **GIVEN** `RealmTagApplication(realm-1, tag-1, unit-1)` exists
- **AND** RealmTagApplicationVote rows exist for users "user-1" and "user-2" on that application
- **WHEN** an authorized actor deletes `RealmTagApplication(realm-1, tag-1, unit-1)`
- **THEN** all RealmTagApplicationVote rows for `(realm-1, tag-1, unit-1)` SHALL be deleted
- **AND** votes for other realm-tag applications SHALL remain unchanged

### Requirement: RealmTagApplicationVote names the application as its vote target

The vote model, DTOs, routes, service methods, and tests SHALL use `RealmTagApplicationVote` to make clear that each vote targets one `RealmTagApplication(realmUnitId, tagUnitId, unitId)` row.

#### Scenario: Vote DTO uses application vocabulary

- **WHEN** a consumer imports the realm application vote DTO from `@rezics/contract`
- **THEN** `RealmTagApplicationVoteDTO` SHALL be available
- **AND** `RealmTagVoteDTO` SHALL NOT be exported

#### Scenario: Vote route uses application vocabulary

- **WHEN** a member casts a vote through `POST /realm-tag-application-vote`
- **THEN** the vote SHALL be applied to the matching `RealmTagApplication`
- **AND** the old `/realm-tag-votes` route prefix SHALL NOT remain mounted

## Seed data invariants

### Requirement: Seed data demonstrates realm community semantics

The seed system SHALL include development data where a realm is visibly modeled as a community space rather than a classifier. At least one seeded realm SHALL include community-facing configuration such as title/description translations, membership, posting or joining constraints where supported, pinboard/rules/about data, and `extra.tagTree` quick-pick tags.

#### Scenario: Seeded realm has community metadata

- **WHEN** the development seed is applied
- **THEN** at least one realm SHALL exist as a `Unit(type = REALM)` with a Realm extension row
- **AND** the realm SHALL include community metadata beyond tag classification data
- **AND** the realm SHALL be usable as a feed/community target through `RealmUnit`

#### Scenario: Seeded tag tree does not create local tags

- **GIVEN** a seeded realm has `extra.tagTree` entries
- **WHEN** the seed completes
- **THEN** every tag referenced by `extra.tagTree` SHALL exist as a global `Unit(type = TAG)`
- **AND** no realm-local tag identity SHALL be created

### Requirement: Seed data demonstrates shared global tags with realm-specific interpretation

The seed system SHALL create global tag Units that are reused by multiple realms, and SHALL demonstrate that the same tag can have different realm-specific meanings through `RealmTagContext` and `RealmTagApplication` data.

#### Scenario: Same global tag appears in multiple realm contexts

- **WHEN** the development seed is applied
- **THEN** at least one global tag Unit SHALL be referenced by two or more realm-tag contexts or realm-tag applications
- **AND** each reference SHALL use the same `tagUnitId`
- **AND** the seed data SHALL NOT create duplicate tags to simulate different realm meanings

#### Scenario: Realm-specific context explains a shared tag

- **GIVEN** a shared global tag is used by `realm-A` and `realm-B`
- **WHEN** the seeded context data is inspected
- **THEN** at least one realm SHALL have a `RealmTagContext` row explaining that realm's interpretation of the tag
- **AND** the context SHALL be connected through `(realmUnitId, tagUnitId)`, not through a new tag Unit

### Requirement: Seed data covers realm-tag applications inside and outside realm feeds

The seed system SHALL include `RealmTagApplication` examples for target Units that are also present in a realm feed through `RealmUnit`, and examples for target Units that are not present in that realm feed. This protects the invariant that `RealmTagApplication` is independent from `RealmUnit`.

#### Scenario: Realm tag application for feed member

- **WHEN** the seeded data is inspected
- **THEN** at least one target Unit SHALL have both `RealmUnit(realmUnitId, unitId)` and `RealmTagApplication(realmUnitId, tagUnitId, unitId)` rows for the same realm

#### Scenario: Realm tag application for non-feed target

- **WHEN** the seeded data is inspected
- **THEN** at least one target Unit SHALL have a `RealmTagApplication(realmUnitId, tagUnitId, unitId)` row
- **AND** the same `(realmUnitId, unitId)` pair SHALL NOT require a `RealmUnit` row

### Requirement: Seed data preserves global vote contribution semantics

Seed helpers that create realm-scoped tag applications through the standard backend path SHALL also create or preserve the corresponding global `TagVote` and aggregate `UnitTag` state. Seed helpers that intentionally bypass services for bulk setup SHALL explicitly create consistent `RealmTagApplicationVote`, `RealmTagApplication`, `TagVote`, and `UnitTag` rows.

#### Scenario: Seeded realm application contributes to global tag aggregate

- **GIVEN** a seeded `RealmTagApplication(realm-1, tag-1, unit-1)` was created through the standard helper
- **WHEN** the seeded database is inspected
- **THEN** a global `UnitTag(unit-1, tag-1)` aggregate SHALL exist
- **AND** the creator's global `TagVote(userId, unitId, tagUnitId)` SHALL exist at most once

#### Scenario: Re-running seed is idempotent

- **WHEN** the seed is applied repeatedly in a reset-capable development environment
- **THEN** seeded realm-tag contexts, realm-tag applications, and vote aggregates SHALL remain deterministic
- **AND** duplicate composite-key rows SHALL NOT be created

### Requirement: Seed helpers use RealmTagApplication vocabulary

Seed helpers and seed data SHALL use `RealmTagApplication` and `RealmTagApplicationVote` names when creating realm-scoped tag classifications and their votes. Seed behavior SHALL remain equivalent to the previous model: application creation also preserves or creates the corresponding global `TagVote` and `UnitTag` aggregate where the standard helper path requires it.

#### Scenario: Seeded realm tag application creates consistent rows

- **GIVEN** a seed helper creates a realm-scoped tag application for `(realm-1, tag-1, unit-1)`
- **WHEN** the seed completes
- **THEN** a `RealmTagApplication(realm-1, tag-1, unit-1)` row SHALL exist
- **AND** the creator's `RealmTagApplicationVote` SHALL exist at most once
- **AND** the expected global `UnitTag(unit-1, tag-1)` state SHALL be consistent with the standard seed path
