# attribution Specification

## Purpose

Defines `CreditAttribution`, the unit-to-entity credit junction
keyed by `(unitId, entityId, role)` with a `sortOrder`. Owns the
junction model (composite PK, cascade delete on both FK sides),
the link/unlink service that triggers Meilisearch content sync,
the retrieval path that returns each Entity's `translations[]`
(consumed by `bookQueries.detail()` so the frontend resolves
names per language without extra round-trips), the contract DTOs
(`CreditAttributionDTO`, `LinkAttributionInput`, per-type role
constant arrays such as `bookRoles`), the contract credit-role
registry (stable key, i18n label, applicable Unit types,
prominence hint), the service-layer rule that link writes
validate each Entity's `eligibleCreditRoles`, the storage of
`role` as a free string (no DB enum) gated by registry
validation, the verification that the `User.unitId` rename
leaves attribution-adjacent FK resolution intact, the
reservation of attribution for creator/production credits (not
subject indexing), and the `setCredits` batch reconciliation
that emits a single editorial history revision.

## Requirements

### Requirement: CreditAttribution is a Unit-to-Unit junction

The `CreditAttribution` model SHALL be a junction table linking a content Unit (`unitId`) to an Entity Unit (`entityId`) with a `role` string and `sortOrder` integer. The composite primary key SHALL be `(unitId, entityId, role)`. Both foreign keys SHALL reference `Unit.id` with cascade delete.

#### Scenario: Create an attribution

- **WHEN** a CreditAttribution is created with `unitId = "book-1"`, `entityId = "entity-1"`, `role = "author"`, `sortOrder = 0`
- **THEN** the record SHALL be persisted with composite PK `(book-1, entity-1, author)`

#### Scenario: Cascade delete from content unit

- **WHEN** a Unit (book) with credit attributions is deleted
- **THEN** all CreditAttribution rows where `unitId` matches SHALL be cascade-deleted

#### Scenario: Cascade delete from entity unit

- **WHEN** a Unit (entity) with credit attributions is deleted
- **THEN** all CreditAttribution rows where `entityId` matches SHALL be cascade-deleted

### Requirement: CreditAttribution link and unlink service trigger Meilisearch sync

The server SHALL provide methods to link and unlink credit attributions. Linking SHALL create a CreditAttribution row. Unlinking SHALL delete by composite PK. Both operations SHALL trigger Meilisearch content sync for the affected unit so search documents stay aligned with credit state.

#### Scenario: Link an attribution

- **WHEN** `linkCreditAttribution({ unitId: "book-1", entityId: "entity-1", role: "author", sortOrder: 0 })` is called
- **THEN** a CreditAttribution row SHALL be created
- **AND** Meilisearch content sync SHALL be triggered for `"book-1"`

#### Scenario: Unlink an attribution

- **WHEN** `unlinkCreditAttribution("book-1", "entity-1", "author")` is called
- **THEN** the CreditAttribution row SHALL be deleted
- **AND** Meilisearch content sync SHALL be triggered for `"book-1"`

### Requirement: Retrieve credit attributions for a unit with entity translations

The server SHALL provide a method to retrieve all credit attributions for a given unit, including each linked Entity's resolved `translations[]`. Results SHALL be grouped by role and ordered by `sortOrder` ascending within each role. `bookQueries.detail()` SHALL include the same shape in its response so the frontend can resolve entity names and bios per language without additional API calls.

#### Scenario: Book detail response includes entity translations

- **WHEN** a client fetches book detail via `bookQueries.detail(bookId)`
- **THEN** the response `attributions[]` SHALL include each entity's `translations[]` array

#### Scenario: Author name resolved by selected language

- **GIVEN** a book has a CreditAttribution with `role = "author"` pointing to entity "entity-1"
- **AND** entity-1 has translations: `[{language: "ja", name: "村上春樹"}, {language: "en", name: "Haruki Murakami"}]`
- **WHEN** the book detail page renders with selected language `"en"`
- **THEN** the author name SHALL display as "Haruki Murakami"

#### Scenario: Author name falls back when selected language unavailable

- **GIVEN** entity-1 has translations only for `"ja"`
- **WHEN** the selected language is `"en"`
- **THEN** the system SHALL fall back through the translation resolution chain and display the Japanese name

### Requirement: Credit attribution contract DTOs

The `@rezics/contract` package SHALL export `CreditAttributionDTO` (`unitId`, `entityId`, `role`, `sortOrder`, optional embedded `entity` reference), `LinkAttributionInput` (`unitId`, `entityId`, `role`, optional `sortOrder`), and per-content-type role constant arrays (e.g. `bookRoles`, `gameRoles`).

#### Scenario: CreditAttributionDTO includes embedded entity

- **WHEN** a CreditAttributionDTO is serialized with entity included
- **THEN** it SHALL contain `unitId`, `entityId`, `role`, `sortOrder`, and an `entity` object with translated name and kind

#### Scenario: Role constants are exported

- **WHEN** importing `bookRoles` from `@rezics/contract`
- **THEN** it SHALL be an array including `"author"`, `"translator"`, `"illustrator"`, `"editor"`, `"publisher"`

### Requirement: Credit attribution link validates Entity eligibility

Credit attribution link writes SHALL validate that the target Entity's `eligibleCreditRoles` contains the requested registered credit role. The validation SHALL run in the service layer after request schema validation and before creating the `CreditAttribution` row. Existing credit attribution reads SHALL continue to return stored rows even if the linked Entity's eligibility is later narrowed.

#### Scenario: Eligible Entity can be linked as author

- **GIVEN** Entity "entity-1" has `eligibleCreditRoles = ["author"]`
- **WHEN** a caller creates `CreditAttribution(unitId = "book-1", entityId = "entity-1", role = "author")`
- **THEN** the link SHALL be persisted

#### Scenario: Character Entity cannot be linked as author without eligibility

- **GIVEN** Entity "character-1" has `eligibleCreditRoles = []`
- **WHEN** a caller creates `CreditAttribution(unitId = "book-1", entityId = "character-1", role = "author")`
- **THEN** the service SHALL reject the write with a typed eligibility error
- **AND** no CreditAttribution row SHALL be created

#### Scenario: Existing ineligible credit remains readable

- **GIVEN** an existing CreditAttribution row has `role = "author"`
- **AND** the linked Entity no longer contains `"author"` in `eligibleCreditRoles`
- **WHEN** a client lists credits for the Unit
- **THEN** the existing row SHALL still be returned
- **AND** only new link writes SHALL be blocked by eligibility validation

### Requirement: roleKey is a flexible string with no enum constraint

The `role` field on Attribution SHALL be stored as a string in the database, NOT as a database enum. Public API writes SHALL accept only role keys defined by the contract credit attribution role registry. This allows role vocabulary expansion through code and i18n updates without a database migration, while preventing ordinary app users from creating arbitrary role slugs.

The field is named `role` for clarity.

#### Scenario: Use a registered role

- **WHEN** creating a CreditAttribution with `role = "translator"` and `translator` is registered
- **THEN** the record SHALL be persisted with `role = "translator"`

#### Scenario: Reject an unregistered role

- **WHEN** a public caller attempts to create a CreditAttribution with `role = "color_assistant"` and that key is not registered
- **THEN** Elysia schema validation SHALL reject the request
- **AND** no attribution row SHALL be created

#### Scenario: Role storage is not a database enum

- **GIVEN** the Prisma schema for CreditAttribution
- **WHEN** inspecting the `role` field
- **THEN** it SHALL be of type `String`
- **AND** it SHALL NOT reference a Prisma enum

### Requirement: sortOrder controls display ordering of credits

The `sortOrder` field on Attribution SHALL determine the display position of credits within the same role for a given unit. Lower sortOrder values appear first. Multiple credits with the same role on a unit SHALL be ordered by sortOrder ascending.

#### Scenario: Order multiple authors by sortOrder

- **GIVEN** Unit "unit-1" with Attribution records: (entity-A, "author", sortOrder 2), (entity-B, "author", sortOrder 1), (entity-C, "author", sortOrder 3)
- **WHEN** retrieving author credits for "unit-1"
- **THEN** the credits SHALL be returned in order: entity-B, entity-A, entity-C

#### Scenario: Order credits across different roles

- **GIVEN** Unit "unit-1" with Attribution records: (entity-A, "author", sortOrder 1), (entity-B, "illustrator", sortOrder 1), (entity-C, "author", sortOrder 2)
- **WHEN** retrieving all Attribution records for "unit-1" grouped by role
- **THEN** authors SHALL appear as entity-A then entity-C (by sortOrder)
- **AND** illustrators SHALL list entity-B

### Requirement: Same person can hold multiple roles on the same unit

An Entity SHALL be able to have multiple Attribution records for the same Unit with different role values. The composite primary key `(unitId, entityId, role)` ensures uniqueness per role while permitting multiple roles.

#### Scenario: Entity credited as both author and illustrator

- **GIVEN** Entity "entity-1" and Unit "unit-1"
- **WHEN** Attribution records are created for `(unit-1, entity-1, "author")` and `(unit-1, entity-1, "illustrator")`
- **THEN** both records SHALL coexist in the database
- **AND** querying credits for "unit-1" SHALL return "entity-1" under both "author" and "illustrator" roles

#### Scenario: Duplicate role for same entity on same unit is rejected

- **GIVEN** Attribution `(unit-1, entity-1, "author")` already exists
- **WHEN** a caller attempts to create another Attribution with `(unit-1, entity-1, "author")`
- **THEN** the system SHALL reject the operation with a uniqueness constraint violation
- **AND** no duplicate record SHALL be created

### Requirement: Attribution references resolve correctly under unified User identity

Attribution-bearing references (e.g., owner fields on Unit, claimer fields on WorkLinkClaim, follower / following ids, ApiToken owner ids) SHALL continue to refer to a user via the user's identifier — now `User.unitId` (renamed from `userId` by the `user-namespace-slug` change). FK columns on related tables MAY retain their existing names (often `userId`); their FK target SHALL be `User.unitId`, and resolution SHALL succeed because `User.unitId ≡ Unit.id where type = USER`.

This requirement is a verification clause: it does not alter the Attribution schema (`unitId`, `entityId`, `role`, `sortOrder`) or its uniqueness rules. It confirms that the User PK rename does not break any attribution-adjacent resolution path.

#### Scenario: Unit owner reference resolves to the user

- **GIVEN** a `Unit` row with `userId = <uuid>` (creator/owner reference)
- **WHEN** the system fetches the owning user
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`
- **AND** the resolution SHALL succeed without any code change beyond the FK target rename

#### Scenario: Claimer reference resolves under renamed PK

- **GIVEN** a `WorkLinkClaim` row with `claimerUserId = <uuid>`
- **WHEN** the system resolves the claimer
- **THEN** it SHALL find a `User` row where `unitId = <uuid>`

#### Scenario: Attribution-entity references remain unaffected

- **WHEN** an `Attribution` row links a Unit to an Entity (`(unitId, entityId, role)`)
- **THEN** the entity reference SHALL continue to target the `Entity` (or its successor `ENTITY`-typed Unit), independently of the User PK rename
- **AND** no existing Attribution row SHALL require data migration as a result of this change

### Requirement: Attribution is reserved for creator and production credits

The existing Attribution capability SHALL represent creator, contributor, production, publisher, studio, cast, and similar credit relationships. It SHALL NOT be used for character appearance, faction membership, setting references, canonical wiki pages, or other subject indexing relationships. Valid public credit roles SHALL come from the contract credit attribution role registry.

#### Scenario: Author remains a credit attribution

- **WHEN** a book is linked to an Entity with `role = "author"`
- **THEN** the relationship SHALL be represented by the credit attribution capability
- **AND** the linked Entity name SHALL contribute to credit-oriented display and search

#### Scenario: Character appearance is not a credit attribution

- **WHEN** a fan fiction is linked to a character Entity with `role = "primary_character"`
- **THEN** the relationship SHALL be represented by SubjectAttribution
- **AND** the character name SHALL NOT be added to credit-only fields

### Requirement: Credit attribution naming is explicit

The implementation SHALL expose current Attribution semantics with credit-specific naming, such as `CreditAttribution`, `CreditAttributionDTO`, and credit attribution service/API names. Credit role keys SHALL be registry-defined product keys whose labels render through i18n.

#### Scenario: Existing attribution data migrates as credits

- **GIVEN** development data contains Attribution rows linking books to authors, translators, illustrators, publishers, or studios
- **WHEN** the credit attribution naming and registry cutover is applied
- **THEN** those rows SHALL be migrated or reset to registered credit role keys
- **AND** their `(unitId, entityId, role)` uniqueness behavior SHALL be preserved

### Requirement: Credit role registry

The contract package SHALL export a credit attribution role registry. Each entry SHALL include a stable key, an i18n label key, applicable Unit types, Entity kind hints for EntityPicker, and prominence metadata indicating whether the role belongs in Metadata or a general Credits section.

#### Scenario: Author role is metadata-prominent for books

- **WHEN** the frontend loads the credit role registry
- **THEN** the `author` entry SHALL exist
- **AND** it SHALL apply to BOOK Units
- **AND** it SHALL indicate Metadata prominence
- **AND** its label SHALL be rendered through its i18n key

### Requirement: Credit role selector uses registry keys

Credit attribution editing UI SHALL present role choices from the credit role registry. The UI SHALL NOT expose an arbitrary text field for ordinary users to create new role keys.

#### Scenario: User selects a registered role

- **WHEN** a user edits book credits
- **THEN** the role selector SHALL show registered roles applicable to BOOK Units
- **AND** selecting `author` SHALL cause the saved CreditAttribution to use `role = "author"`

### Requirement: Book authorship remains CreditAttribution

Book authors SHALL be represented as `CreditAttribution(role = "author")`. The UI MAY display the author role inside a Metadata region because it is commonly used, but the data model SHALL NOT introduce `Book.author`.

#### Scenario: Book metadata author editor writes CreditAttribution

- **WHEN** a user adds an author from the book Metadata editor
- **THEN** the system SHALL create or update a CreditAttribution row with `role = "author"`
- **AND** it SHALL NOT write a `Book.author` field

### Requirement: Credit attribution batch reconciliation

The system SHALL support batch reconciliation of credit attribution rows through the unit-scoped entity attribution batch endpoint. A `setCredits` batch operation SHALL validate the submitted credit role key, validate every referenced Entity's credit-role eligibility, and reconcile the target Unit's `CreditAttribution` rows for that role to the submitted final ordered set.

#### Scenario: Reconcile author credits

- **GIVEN** Unit `book-1` has existing author credits `[entity-a, entity-b]`
- **WHEN** a batch request submits `setCredits(role = "author", entries = [entity-b, entity-c])`
- **THEN** the system SHALL remove the author credit for `entity-a`
- **AND** it SHALL keep or update the author credit for `entity-b`
- **AND** it SHALL create the author credit for `entity-c`

#### Scenario: Batch validates credit eligibility

- **GIVEN** Entity `entity-x` does not include `author` in `eligibleCreditRoles`
- **WHEN** a batch request submits `setCredits(role = "author", entries = [entity-x])`
- **THEN** the system SHALL reject the batch with an eligibility error
- **AND** no credit attribution rows from that batch SHALL be committed

### Requirement: Credit batch history stores final role state

Credit attribution changes made through entity attribution batch editing SHALL produce at most one editorial history revision for a successful canonical commit. The revision patch SHALL contain the final sparse credit state for changed roles and SHALL NOT contain the client's local add/remove/reorder operation log.

#### Scenario: Multiple author changes produce one history revision

- **WHEN** a user locally removes one author, adds another author, reorders the author list, and saves once
- **THEN** the server SHALL write one editorial history revision for `credits.author` or `credits.authors` according to the canonical path vocabulary
- **AND** the revision content SHALL represent the final ordered author set
