## ADDED Requirements

### Requirement: Pinboard as a named ordered list on a Realm

The system SHALL provide a `pinboard` capability: a realm-scoped, named, ordered list of `Post` unit ids that references existing posts rather than duplicating their content. Each pinboard SHALL be identified by the tuple `(realmUnitId, pinboardKey)`. The set of valid `pinboardKey` values SHALL be a fixed whitelist. For the first release the whitelist SHALL be exactly `{ "announcement", "pinned" }`. Unknown keys MUST be rejected with a 400 error.

Pinboard state SHALL be persisted on the existing `Realm.extra` JSON field as `Realm.extra.<pinboardKey>PostIds: string[]`. The capability MUST NOT require a new Prisma table or a schema migration.

#### Scenario: Invalid pinboard key is rejected

- **WHEN** a client requests any pinboard endpoint with `pinboardKey = "foo"`
- **THEN** the API SHALL respond with HTTP 400 and an error code indicating an invalid pinboard key

#### Scenario: Pinboard state lives on Realm.extra

- **GIVEN** a realm "realm-1" with `extra.announcementPostIds = ["u1", "u2"]`
- **WHEN** the `announcement` pinboard of "realm-1" is read
- **THEN** the service SHALL return entries corresponding to `"u1"` and `"u2"` in that order
- **AND** no additional database table SHALL be queried for the ordering

### Requirement: I18n-aware pinboard list reads

The pinboard list read endpoint SHALL accept a `language` query parameter and SHALL resolve, for each entry, the best-matching `UnitTranslation` using the precedence: requested language → unit's default language → platform fallback `en` → first available. Each list entry SHALL expose at least `{ unitId, title, summary, language, defaultLanguage, supportedLanguages, pinnedAt, authorUserId, createdAt, updatedAt }`. The entry body (`Post.body`) SHALL NOT be returned by the list endpoint.

List reads SHALL filter out postIds whose referenced `Unit` is missing or soft-deleted (`deletedAt != null`), preserving the relative order of the remaining ids.

#### Scenario: Language resolution falls back to default then en

- **GIVEN** a realm with `announcementPostIds = ["u1"]` where `u1` has UnitTranslation rows for `en` and `zh-Hans`, with `defaultLanguage = "zh-Hans"`
- **WHEN** a client requests the `announcement` pinboard with `language = "ja"`
- **THEN** the returned entry for `u1` SHALL resolve to the `zh-Hans` translation
- **AND** `entry.language` SHALL equal `"zh-Hans"`

#### Scenario: Stale pin ids are filtered from public read

- **GIVEN** a realm with `announcementPostIds = ["u1", "u2", "u3"]` and `u2` has `Unit.deletedAt != null`
- **WHEN** a non-admin client reads the `announcement` pinboard
- **THEN** the response SHALL contain entries for `u1` and `u3` only, in that order
- **AND** the response SHALL NOT include a `staleIds` field

#### Scenario: Admin read exposes stale ids for cleanup

- **GIVEN** the same realm and state as above
- **WHEN** a realm moderator or global admin reads the `announcement` pinboard with `adminView = true`
- **THEN** the response SHALL include `staleIds = ["u2"]`
- **AND** the live entries SHALL remain unchanged

### Requirement: Pinboard detail read uses TranslationGroup siblings

The pinboard detail read endpoint SHALL, given `(realmUnitId, pinboardKey, unitId, language)`, return the post content (including `body`) in the best language available across the unit's `TranslationGroup` siblings, using the same fallback precedence as list reads. If the unit has no `TranslationGroup`, the endpoint SHALL return the unit's own content. The detail response SHALL include `supportedLanguages` from the TranslationGroup (or an empty array for standalone units).

#### Scenario: Detail resolves sibling body via TranslationGroup

- **GIVEN** unit `u1` in a TranslationGroup with siblings `u1-en` (`defaultLanguage = "en"`) and `u1-ja` (`defaultLanguage = "ja"`), and `supportedLanguages = ["en", "ja"]`
- **WHEN** a client fetches the pinboard detail with `unitId = "u1"` and `language = "ja"`
- **THEN** the response body SHALL come from `u1-ja`'s `Post.body`
- **AND** the response SHALL include `supportedLanguages = ["en", "ja"]`

#### Scenario: Detail of standalone unit returns its own body

- **GIVEN** unit `u2` with no `translationGroupId`
- **WHEN** a client fetches the pinboard detail with `unitId = "u2"`
- **THEN** the response SHALL return `u2`'s own `Post.body`
- **AND** `supportedLanguages` SHALL be `[]`

### Requirement: Composite pinboard content creation

The pinboard service SHALL provide a composite `createPinboardEntry(realmUnitId, pinboardKey, input, actorUserId)` operation that, in a single Prisma transaction, SHALL:

1. Create a root `Unit` with `type = POST`, `status = PUBLISHED`, and `defaultLanguage = input.defaultLanguage`.
2. Create the root `Post` with `realmUnitId` pointing at the target realm and `authorUserId = actorUserId`.
3. Create one `UnitTranslation` per entry in `input.translations` (each supplying `title`, optional `summary`, optional `description`).
4. When `input.translations` covers more than one language, create a `TranslationGroup` with `supportedLanguages` equal to the set of keys and attach the root unit to it; for every non-default language create a sibling `Unit` + `Post` + `UnitTranslation` under the same group, with `Post.body` taken from the corresponding translation entry.
5. Take `SELECT ... FOR UPDATE` on the target `Realm` row and append the root unit id to `Realm.extra.<pinboardKey>PostIds`.

On any failure the transaction MUST roll back and leave `Realm.extra` unchanged.

#### Scenario: Create multilingual announcement

- **WHEN** a moderator calls `createPinboardEntry` with `pinboardKey = "announcement"`, `defaultLanguage = "zh-Hans"`, and `translations = { "zh-Hans": {...}, "en": {...} }`
- **THEN** one root `Unit` + `Post` + `UnitTranslation(zh-Hans)` SHALL be created
- **AND** a sibling `Unit` + `Post` + `UnitTranslation(en)` SHALL be created in the same `TranslationGroup`
- **AND** the group's `supportedLanguages` SHALL equal `["zh-Hans", "en"]` (order insensitive)
- **AND** the realm's `extra.announcementPostIds` SHALL have the root unit id appended at the end

#### Scenario: Create single-language entry skips TranslationGroup

- **WHEN** a moderator creates a pinboard entry with a single language
- **THEN** no `TranslationGroup` SHALL be created
- **AND** the root unit's `translationGroupId` SHALL be null

### Requirement: Composite pinboard content update

The pinboard service SHALL provide `updatePinboardEntry(realmUnitId, pinboardKey, unitId, input)` that MAY add, modify, or remove translations. Semantics:

- Upserting a `UnitTranslation` for a language SHALL update `title`, `summary`, and `description` atomically.
- Supplying a `body` for a language SHALL update `Post.body` on the corresponding sibling unit (or the root unit for the default language).
- Adding a new language SHALL create a sibling `Unit` + `Post` + `UnitTranslation` under the TranslationGroup, lazily creating the group if this is the first additional language.
- Removing a language SHALL soft-delete the sibling `Unit` and remove the language from the group's `supportedLanguages`. The default language MUST NOT be removable.

The update MUST run in one transaction and MUST NOT touch `Realm.extra` list order.

#### Scenario: Add a translation to an existing single-language entry

- **GIVEN** pinboard entry `u1` with only `en` translation and no TranslationGroup
- **WHEN** a moderator adds a `ja` translation with title/summary/body
- **THEN** a `TranslationGroup` SHALL be created with `supportedLanguages = ["en", "ja"]`
- **AND** a sibling `Unit + Post + UnitTranslation(ja)` SHALL be created
- **AND** `u1.translationGroupId` SHALL point at the new group

#### Scenario: Default language cannot be removed

- **WHEN** a moderator attempts to remove the default language from a pinboard entry
- **THEN** the API SHALL reject the request with HTTP 400 and an error code indicating the default language is protected

### Requirement: Soft-delete pinboard entry

The pinboard service SHALL provide `deletePinboardEntry(realmUnitId, pinboardKey, unitId)` that, in one transaction, SHALL soft-delete (`Unit.deletedAt = now()`) the root unit and all of its TranslationGroup siblings, remove the root unit id from `Realm.extra.<pinboardKey>PostIds`, and maintain `TranslationGroup.supportedLanguages` consistency (deleting the group if empty).

#### Scenario: Delete removes id from list and soft-deletes siblings

- **GIVEN** pinboard entry `u1` with siblings `u1-en` and `u1-ja` appearing in `announcementPostIds = ["u1", "u2"]`
- **WHEN** the entry is deleted
- **THEN** `u1`, `u1-en`, and `u1-ja` SHALL all have `deletedAt` set
- **AND** `announcementPostIds` SHALL equal `["u2"]`
- **AND** the associated TranslationGroup SHALL be removed

### Requirement: Pin and unpin existing posts

The pinboard service SHALL provide `pinToPinboard(realmUnitId, pinboardKey, unitId, position?)` and `unpinFromPinboard(realmUnitId, pinboardKey, unitId)` operations that only mutate `Realm.extra.<pinboardKey>PostIds`. The pin operation SHALL validate that the unit exists and is of type POST; it SHALL be idempotent — pinning an already-pinned id MUST NOT create duplicates, but SHALL update the position when `position` is supplied. The unpin operation MUST NOT modify the underlying post and MUST succeed silently if the id is not present.

Both operations SHALL take `SELECT ... FOR UPDATE` on the target `Realm` row.

#### Scenario: Pinning an existing post appends by default

- **GIVEN** realm with `pinnedPostIds = ["u1", "u2"]`
- **WHEN** a moderator pins an existing post `u3`
- **THEN** `pinnedPostIds` SHALL equal `["u1", "u2", "u3"]`

#### Scenario: Pinning with position inserts at index

- **GIVEN** realm with `pinnedPostIds = ["u1", "u2"]`
- **WHEN** a moderator pins `u3` with `position = 0`
- **THEN** `pinnedPostIds` SHALL equal `["u3", "u1", "u2"]`

#### Scenario: Unpin is distinct from delete

- **WHEN** a moderator unpins `u1` from the `pinned` pinboard
- **THEN** `u1` SHALL be removed from `pinnedPostIds`
- **AND** the underlying `Unit` and `Post` SHALL remain intact and queryable

### Requirement: Reorder pinboard

The pinboard service SHALL provide `reorderPinboard(realmUnitId, pinboardKey, orderedUnitIds)` that replaces the id array. The new array MUST be a permutation of the current array (same set of ids); otherwise the operation MUST be rejected with HTTP 409 so the client can refresh and retry, preventing silent reordering during a concurrent insert/delete.

#### Scenario: Reorder with permutation succeeds

- **GIVEN** realm with `pinnedPostIds = ["u1", "u2", "u3"]`
- **WHEN** a moderator reorders to `["u3", "u1", "u2"]`
- **THEN** `pinnedPostIds` SHALL equal `["u3", "u1", "u2"]`

#### Scenario: Reorder with stale set is rejected

- **GIVEN** realm with `pinnedPostIds = ["u1", "u2", "u3"]` at read time, but `u2` was unpinned concurrently to `["u1", "u3"]`
- **WHEN** a moderator submits a reorder of `["u3", "u2", "u1"]`
- **THEN** the API SHALL respond with HTTP 409 and an error indicating the list changed
- **AND** `pinnedPostIds` SHALL remain `["u1", "u3"]`

### Requirement: Pinboard write permission model

All pinboard write endpoints (`create`, `update`, `delete`, `pin`, `unpin`, `reorder`) SHALL require the caller to be one of:

- A `RealmMember` of the target realm with `roleKey` in `{ "owner", "moderator" }`, OR
- A user with global role in `{ "ADMIN", "ROOT" }`.

Read endpoints SHALL follow the realm's visibility rules — public realms SHALL allow anonymous reads; private realms SHALL require membership or a global admin role.

#### Scenario: Regular member cannot pin

- **GIVEN** a realm where `user-3` has `roleKey = "member"`
- **WHEN** `user-3` calls any pinboard write endpoint on that realm
- **THEN** the API SHALL respond with HTTP 403

#### Scenario: Global admin can manage default-realm announcement pinboard

- **GIVEN** a user with global role `ADMIN` who is NOT a member of `default-realm`
- **WHEN** the user calls any pinboard write endpoint targeting `default-realm`'s `announcement` pinboard
- **THEN** the API SHALL permit the operation

### Requirement: Concurrency via row-level serialization with OCC marker

All write endpoints that mutate `Realm.extra.<pinboardKey>PostIds` SHALL begin their transaction by acquiring `SELECT ... FOR UPDATE` on the target `Realm` row. The service code SHALL leave an explicit `TODO` comment at each such call site marking the future introduction of optimistic concurrency control (for example a monotonic `version` counter on `Realm.extra` writes).

#### Scenario: Concurrent writes are serialized

- **GIVEN** two moderators invoking reorder on the same pinboard at the same instant
- **WHEN** both transactions run
- **THEN** one transaction SHALL observe the other's result before writing
- **AND** no write SHALL be lost silently

### Requirement: Pinboard key whitelist in the contract

The `@rezics/contract` package SHALL export a `PINBOARD_KEYS` literal array equal to `["announcement", "pinned"]` and a Typebox `pinboardKeySchema = t.Union([t.Literal("announcement"), t.Literal("pinned")])`. Request and response schemas exposed by the pinboard API SHALL use this union for the `pinboardKey` field.

#### Scenario: Contract exposes the whitelist

- **WHEN** a consumer imports `PINBOARD_KEYS` from `@rezics/contract`
- **THEN** the value SHALL be exactly `["announcement", "pinned"]`
- **AND** the `pinboardKeySchema` SHALL accept only those two literals
