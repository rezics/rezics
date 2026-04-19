## MODIFIED Requirements

### Requirement: Game stores only language-neutral facts

The Game extension table SHALL contain only language-neutral metadata. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Author, developer, publisher, and other attribution SHALL be stored in `PersonCredit` and `OrgCredit` with appropriate `roleKey` values (e.g., `"developer"`, `"publisher"`, `"designer"`, `"composer"`). Tags SHALL be stored in `UnitTag`. **Cover images SHALL be stored in `UnitTranslation.extra.coverUrl`** via the `unitTranslationExtraSchema` defined in the `unit-translation` capability. The Game table SHALL NOT hold a `coverUrl` column or `coverAssetUnitId` reference.

#### Scenario: Game schema excludes language-dependent and attribution fields

- GIVEN the Game model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `coverAssetUnitId`, `tags`, `developer`, or `publisher`
- AND the only fields present SHALL be `unitId`, `releaseDate`, `versionLabel`, `ageRatingKey`, `isLicensed`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Game display text retrieved from UnitTranslation

- GIVEN a Game with `unitId = "unit-1"` and a `UnitTranslation` record with `unitId = "unit-1"`, `language = "ja"`, `title = "ゼルダの伝説"`
- WHEN a client requests the game's display information in Japanese
- THEN the system SHALL return the title from `UnitTranslation` and the language-neutral facts from the Game record

#### Scenario: Game cover URL retrieved from UnitTranslation.extra

- GIVEN a Game with `unitId = "unit-1"` and a `UnitTranslation` with `language = "ja"` and `extra = { coverUrl: "https://example.com/boxart-jp.jpg" }`
- WHEN a client requests the game's display information in Japanese
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/boxart-jp.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Game table

### Requirement: Game metadata fields

The Game model SHALL include the following metadata fields: `releaseDate` (DateTime, nullable) for the game's release date, `versionLabel` (String, nullable) for version identifiers (e.g., `"1.0"`, `"Definitive Edition"`), `ageRatingKey` (VarChar(32), nullable) for age rating classification keys (e.g., `"esrb_e"`, `"cero_b"`, `"pegi_12"`), `isLicensed` (Boolean, default false) indicating official licensing status, and `extra` (Json, nullable) for extensible metadata. The cover URL is NOT a column on Game; it is stored in `UnitTranslation.extra.coverUrl`.

#### Scenario: Create a game with full metadata

- GIVEN a Unit with `id = "unit-1"` and `type = GAME`
- WHEN the system creates a Game with `unitId = "unit-1"`, `releaseDate = 2024-03-15`, `versionLabel = "1.2.0"`, `ageRatingKey = "esrb_t"`, `isLicensed = true`
- THEN the Game record SHALL persist all provided field values
- AND no cover-related column SHALL exist or be written on the Game table

#### Scenario: Extra JSON stores extensible metadata

- GIVEN a Game with `unitId = "unit-1"`
- WHEN the owner sets `extra = {"engine": "Unreal Engine 5", "multiplayer": true, "maxPlayers": 4}`
- THEN the Game record SHALL persist the JSON value in the `extra` field
- AND subsequent reads SHALL return the stored JSON

#### Scenario: Default values on minimal creation

- WHEN a Game record is created with only `unitId` specified
- THEN `isLicensed` SHALL default to `false`
- AND `releaseDate`, `versionLabel`, `ageRatingKey`, and `extra` SHALL default to null

## REMOVED Requirements

### Requirement: Game.coverAssetUnitId column

**Reason**: The spec previously declared `coverAssetUnitId` as an IMAGE-unit reference on Game, but this was aspirational — the Prisma schema shipped `Game.coverUrl String?` and IMAGE-unit-backed covers were never implemented. IMAGE `UnitType` is reserved for first-class image posts; a game cover is decorative metadata, not a posted artwork. The cover field is now sourced from `UnitTranslation.extra.coverUrl`.

**Migration**: No IMAGE-unit indirection exists in production, so no data migration from an IMAGE-unit link is needed. Existing `Game.coverUrl` values SHALL be copied into `UnitTranslation.extra.coverUrl` for every translation row of the corresponding unit, then the column SHALL be dropped. See `proposal.md` for the full migration procedure.
