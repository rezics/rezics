## ADDED Requirements

### Requirement: TranslationGroup aggregates parallel translation siblings

A `TranslationGroup` SHALL be a first-class record identified by a UUIDv7 id. It groups one or more `Unit` records that are parallel translations of the same wiki topic. A `TranslationGroup` MAY exist only while it has at least one member Unit; empty groups SHALL be garbage-collected by the system.

#### Scenario: Create a group when attaching a second translation

- **WHEN** a caller attaches a new translation Unit to a standalone POST that has no `translationGroupId`
- **THEN** the system SHALL create a new `TranslationGroup` with a fresh UUIDv7 id
- **AND** set `translationGroupId` on both the original POST and the new translation Unit
- **AND** populate `supportedLanguages` with both Units' `defaultLanguage` values
- **AND** perform all writes in a single transaction

#### Scenario: Attach a third translation to an existing group

- **GIVEN** a `TranslationGroup` with id `G` that already contains two Units
- **WHEN** a caller attaches a new translation Unit to the group
- **THEN** the new Unit's `translationGroupId` SHALL be set to `G`
- **AND** `G.supportedLanguages` SHALL be updated to include the new Unit's `defaultLanguage`
- **AND** all writes SHALL occur in one transaction

#### Scenario: Detach a translation

- **GIVEN** a `TranslationGroup` with id `G` containing Units A, B, and C
- **WHEN** a caller detaches Unit B
- **THEN** `B.translationGroupId` SHALL be set to NULL
- **AND** `G.supportedLanguages` SHALL no longer contain `B.defaultLanguage` (unless another remaining member shares that language, which is impossible given the uniqueness invariant)
- **AND** `G` SHALL continue to exist with members A and C

#### Scenario: Detach the last member deletes the group

- **GIVEN** a `TranslationGroup` with id `G` containing only Unit A
- **WHEN** Unit A is detached or deleted
- **THEN** `G` SHALL be removed
- **AND** `A.translationGroupId` SHALL be NULL

### Requirement: Unit.translationGroupId binds a Unit to at most one group

The `Unit` model SHALL have a nullable `translationGroupId` column referencing `TranslationGroup.id`. A Unit MAY belong to zero or one `TranslationGroup`. The foreign key SHALL use `onDelete: SetNull` so that deleting a `TranslationGroup` row makes its members standalone rather than cascading delete.

#### Scenario: Standalone Unit has NULL translationGroupId

- **GIVEN** a Unit that has never been attached to any translation group
- **THEN** its `translationGroupId` SHALL be NULL
- **AND** the Unit SHALL be treated as standalone

#### Scenario: TranslationGroup deletion nulls its members

- **GIVEN** a `TranslationGroup` with id `G` containing Units A and B
- **WHEN** the `G` row is deleted directly
- **THEN** `A.translationGroupId` SHALL become NULL
- **AND** `B.translationGroupId` SHALL become NULL
- **AND** A and B SHALL continue to exist as standalone Units

### Requirement: At most one Unit per language per TranslationGroup

For every `TranslationGroup`, the members SHALL have distinct `defaultLanguage` values. The system SHALL enforce this via a composite unique constraint `(translationGroupId, defaultLanguage)` on `Unit`. Rows with `translationGroupId = NULL` SHALL NOT participate in the uniqueness check.

#### Scenario: Attempt to attach a duplicate language fails

- **GIVEN** a `TranslationGroup` with id `G` already containing a Unit with `defaultLanguage = "ja"`
- **WHEN** a caller attempts to attach another Unit with `defaultLanguage = "ja"` to `G`
- **THEN** the operation SHALL fail with a unique-constraint error
- **AND** no change SHALL be persisted

#### Scenario: Two standalone Units may share a language

- **GIVEN** two Units with `translationGroupId = NULL` and `defaultLanguage = "ja"`
- **THEN** the unique constraint SHALL NOT trigger
- **AND** both Units SHALL coexist

### Requirement: TranslationGroup.supportedLanguages is the authoritative language list for reads

The `TranslationGroup.supportedLanguages` field (a `text[]`) SHALL contain, in no specified order, the `defaultLanguage` of every member Unit. It SHALL be maintained transactionally with every membership change. Readers SHALL prefer this field over computing the list by JOIN when the question is "what languages does this wiki topic support?".

#### Scenario: Reading supported languages is a single PK lookup

- **GIVEN** a Unit with `translationGroupId = G`
- **WHEN** a client asks which languages the wiki topic supports
- **THEN** the system SHALL resolve this by a single lookup on `TranslationGroup.id = G`
- **AND** return `supportedLanguages` directly without JOIN to `Unit`

#### Scenario: supportedLanguages stays in sync with membership

- **GIVEN** a `TranslationGroup` with `supportedLanguages = ["ja", "en"]`
- **WHEN** a third Unit with `defaultLanguage = "zh-hant"` is attached
- **THEN** `supportedLanguages` SHALL be updated to include `"zh-hant"`
- **AND** the update SHALL occur in the same transaction as the membership change

### Requirement: Attached Unit MUST have defaultLanguage set

A Unit SHALL NOT be attached to a `TranslationGroup` unless its `defaultLanguage` is a non-null canonical language code (as validated by `languageSchema`). Attempts to attach a Unit with NULL `defaultLanguage` SHALL be rejected.

#### Scenario: Attaching a Unit without defaultLanguage is rejected

- **GIVEN** a Unit with `defaultLanguage = NULL`
- **WHEN** a caller attempts to attach it to a `TranslationGroup`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no group or membership change SHALL be persisted

### Requirement: Wiki POST translations use TranslationGroup, not sourceReleaseUnitId

POST-type Units that serve as parallel translations SHALL be wired exclusively via `Unit.translationGroupId`. POST Units SHALL NOT set `UnitTranslation.sourceReleaseUnitId` on themselves or on any parent — that field is reserved for the work/release model and is undefined for POST.

#### Scenario: Wiki post group linkage

- **GIVEN** three POST Units maintained as parallel translations in languages `"en"`, `"ja"`, and `"zh-hant"`
- **THEN** all three SHALL share the same non-null `translationGroupId`
- **AND** none of them SHALL have `sourceReleaseUnitId` set on any `UnitTranslation` row
- **AND** the corresponding `TranslationGroup.supportedLanguages` SHALL be `["en", "ja", "zh-hant"]` (order unspecified)

### Requirement: Per-post UnitSupportLanguage row is still required

Each POST Unit participating in a translation group SHALL have its own `UnitSupportLanguage` row declaring its `defaultLanguage` with `isPrimary = true`. This keeps the platform-wide language-filter protocol uniform across all Unit types; the `TranslationGroup` mechanism is layered on top of, not a replacement for, `UnitSupportLanguage`.

#### Scenario: Each wiki post declares its own language via UnitSupportLanguage

- **GIVEN** a wiki POST Unit with `defaultLanguage = "ja"` attached to a `TranslationGroup`
- **THEN** a `UnitSupportLanguage` row SHALL exist with `(unitId = post.id, language = "ja", isPrimary = true)`
- **AND** this row SHALL exist regardless of the post's membership in a `TranslationGroup`

### Requirement: Language filtering does not dedup across translation groups

Language-filtered queries and searches SHALL treat each POST Unit as an independent document. A query `?language = X` SHALL match a POST if and only if the POST has a `UnitSupportLanguage` row for `X` (or is `isLanguageNeutral`). The `TranslationGroup` mechanism SHALL NOT cause a non-matching-language POST to be surfaced via its siblings.

#### Scenario: Japanese search does not return sibling English post

- **GIVEN** a `TranslationGroup` with an English POST `P_en` and a Japanese POST `P_ja`
- **WHEN** a client queries for POSTs with `language = "ja"`
- **THEN** the result set SHALL include `P_ja`
- **AND** the result set SHALL NOT include `P_en`
