## ADDED Requirements

### Requirement: ContentRating enum definition

The system SHALL define a `ContentRating` enum with exactly four members in a single canonical spelling shared by the database, contract, and frontend:

- `GENERAL` — suitable for all audiences.
- `R_15` — content unsuitable for viewers under 15.
- `R_18` — adult content, predominantly sexual.
- `R_18G` — adult content containing grotesque/violent imagery.

The enum members SHALL be considered non-strictly ordinal. `R_18` and `R_18G` are siblings distinguishing the nature of adult content, not an ordered pair. Any "at-or-below tier X" comparison SHALL be synthesized at the point of use and SHALL NOT be a schema-level invariant.

#### Scenario: Enum identifier is shared across layers

- **GIVEN** the Prisma enum, the Typebox contract, and the frontend constant
- **WHEN** a `ContentRating` value is serialized through any layer
- **THEN** it SHALL use exactly one of the four identifiers `GENERAL`, `R_15`, `R_18`, `R_18G`

#### Scenario: No ordering invariant between R_18 and R_18G

- **WHEN** the system evaluates whether a Unit with `rating = R_18G` should match a caller whose allowed set is `{GENERAL, R_15, R_18}`
- **THEN** the system SHALL NOT treat `R_18G` as a superset of `R_18`
- **AND** the Unit SHALL NOT match unless `R_18G` is explicitly in the allowed set

### Requirement: Rating is a Unit-level, maintainer-asserted label

Every Unit SHALL carry a single `rating: ContentRating` value on the `Unit` row, defaulting to `GENERAL` on creation. The rating is declaratively set by the Unit's maintainer and represents the rating appropriate for the Unit at the catalog/discovery layer. The system SHALL NOT derive, aggregate, or enforce the Unit's rating from any related entity (child Units, chapters, embedded content). In particular, the system SHALL NOT enforce `book.rating ≥ max(chapter.rating)`.

#### Scenario: Unit rating is stored, not derived

- **GIVEN** a Book Unit "book-1" with `rating = R_15` and a chapter Unit "ch-5" (linked via `Post.targetUnitId = "book-1"`) with `rating = R_18`
- **WHEN** the system loads "book-1"
- **THEN** the returned `rating` SHALL be `R_15`
- **AND** no validator SHALL reject the combination

#### Scenario: Default rating on creation

- **WHEN** a new Unit is created without specifying `rating`
- **THEN** the Unit SHALL be persisted with `rating = GENERAL`

#### Scenario: Unit rating update changes only the Unit row

- **GIVEN** a Book Unit "book-1" with `rating = GENERAL` and 10 chapter Units with various ratings
- **WHEN** the maintainer updates `book-1.rating` to `R_15`
- **THEN** only the `book-1` row's `rating` column SHALL be changed
- **AND** none of the chapter Units' `rating` values SHALL be modified

### Requirement: Chapter Units carry their own rating

A chapter (represented as `Unit(type=POST)` with `Post.kind = CHAPTER`) SHALL carry its own `Unit.rating` field independently from the Book Unit it targets. Creating or editing a chapter SHALL permit setting any `ContentRating` value regardless of the parent Book's rating.

#### Scenario: Chapter may exceed parent Book rating

- **GIVEN** a Book Unit "book-1" with `rating = R_15`
- **WHEN** the maintainer creates a chapter Unit targeting "book-1" with `rating = R_18`
- **THEN** the chapter SHALL be persisted with `rating = R_18`
- **AND** no validator SHALL reject the operation

#### Scenario: Chapter may undercut parent Book rating

- **GIVEN** a Book Unit "book-1" with `rating = R_18`
- **WHEN** the maintainer creates a chapter Unit targeting "book-1" with `rating = GENERAL`
- **THEN** the chapter SHALL be persisted with `rating = GENERAL`

### Requirement: Allowed-rating set derivation per caller

The allowed rating set for any search or discovery operation SHALL be computed per caller as the union of:

- Baseline: `{GENERAL, R_15}` — always included, regardless of authentication state.
- User opt-ins: `User.settings.content.optedInRatings` if the caller is authenticated and the field is set; otherwise the empty set.

Unauthenticated callers SHALL always receive the allowed set `{GENERAL, R_15}` regardless of any request parameter. Authenticated callers SHALL receive their derived set as above.

#### Scenario: Unauthenticated caller

- **GIVEN** an unauthenticated request
- **WHEN** the system derives the allowed rating set
- **THEN** the set SHALL be exactly `{GENERAL, R_15}`

#### Scenario: Authenticated caller without opt-ins

- **GIVEN** an authenticated user whose `User.settings.content.optedInRatings` is missing or equals `[]`
- **WHEN** the system derives the allowed rating set
- **THEN** the set SHALL be exactly `{GENERAL, R_15}`

#### Scenario: Authenticated caller with full opt-in

- **GIVEN** an authenticated user whose `User.settings.content.optedInRatings` equals `["R_18", "R_18G"]`
- **WHEN** the system derives the allowed rating set
- **THEN** the set SHALL be exactly `{GENERAL, R_15, R_18, R_18G}`

### Requirement: Opt-in storage shape

Per-user age-rating opt-ins SHALL be stored at the JSON path `User.settings.content.optedInRatings` as an array of `ContentRating` values containing ONLY the opted-in tiers. `GENERAL` and `R_15` SHALL NOT be stored in this array; they are implicit in the baseline. Only `R_18` and `R_18G` MAY appear in this array. Duplicate entries SHALL be treated as a single entry.

#### Scenario: Writing opt-in

- **WHEN** a user enables `R_18` in their preferences
- **THEN** the backend SHALL persist `User.settings.content.optedInRatings` as `["R_18"]`

#### Scenario: Writing both opt-ins

- **WHEN** a user enables both `R_18` and `R_18G`
- **THEN** the backend SHALL persist `User.settings.content.optedInRatings` as an array containing both values

#### Scenario: Clearing an opt-in

- **GIVEN** a user whose opt-ins are `["R_18", "R_18G"]`
- **WHEN** the user disables `R_18G`
- **THEN** the backend SHALL persist `User.settings.content.optedInRatings` as `["R_18"]`

#### Scenario: Baseline tiers are not stored

- **GIVEN** a user editing their preferences
- **WHEN** the client sends an update
- **THEN** the request SHALL NOT include `GENERAL` or `R_15` in the `optedInRatings` array
- **AND** the server SHALL reject any request that attempts to store them with a validation error

### Requirement: Content rating is independent from AI disclosure

The system SHALL keep `ContentRating` semantics independent from AI disclosure
semantics. `ContentRating` SHALL continue to represent audience suitability at
the catalog/discovery layer, while `AiDisclosureMode` SHALL represent declared
AI involvement/provenance.

No system component SHALL derive, modify, broaden, restrict, or validate a
Unit's `rating` based solely on its `aiDisclosureMode`. Allowed-rating set
derivation SHALL remain based only on baseline ratings and user rating opt-ins.

#### Scenario: AI disclosure does not affect rating persistence

- **GIVEN** a Unit with `rating = GENERAL`
- **WHEN** the maintainer updates `aiDisclosureMode = MACHINE_GENERATED`
- **THEN** the Unit's `rating` SHALL remain `GENERAL`
- **AND** the system SHALL NOT require a rating update

#### Scenario: Rating filters ignore AI disclosure unless explicitly requested

- **GIVEN** a caller whose allowed rating set is `{GENERAL, R_15}`
- **AND** a Unit with `rating = GENERAL` and `aiDisclosureMode = MACHINE_GENERATED`
- **WHEN** the caller performs a discovery query without an AI disclosure filter
- **THEN** the Unit SHALL be evaluated against the allowed rating set as `GENERAL`
- **AND** the Unit SHALL NOT be excluded because it is machine-generated
