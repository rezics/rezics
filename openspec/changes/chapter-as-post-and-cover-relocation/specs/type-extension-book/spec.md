## MODIFIED Requirements

### Requirement: Book MUST NOT contain title, description, language, coverUrl, tags, author, press, or producer fields

The Book extension table SHALL store only language-neutral facts. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Language information SHALL be stored in `UnitSupportLanguage`. Author, press, and producer attribution SHALL be stored in `PersonCredit` and `OrgCredit`. Tags SHALL be stored in `UnitTag`. **Cover images SHALL be stored in `UnitTranslation.extra.coverUrl` via the `unitTranslationExtraSchema` defined in the `unit-translation` capability.** The Book table SHALL NOT hold a `coverUrl` column or any IMAGE-unit reference for covers.

#### Scenario: Book schema excludes language-dependent and attribution fields

- GIVEN the Book model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `coverAssetUnitId`, `tags`, `author`, `press`, or `producer`
- AND the only fields present SHALL be `unitId`, `isbn13`, `publicationDate`, `pageCount`, `textLength`, `formatKey`, `isLicensed`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Book display text retrieved from UnitTranslation

- GIVEN a Book with `unitId = "unit-1"` and a `UnitTranslation` record with `unitId = "unit-1"`, `language = "en"`, `title = "The Great Gatsby"`
- WHEN a client requests the book's display information in English
- THEN the system SHALL return the title from `UnitTranslation` and the language-neutral facts from the Book record
- AND no title SHALL be read from or written to the Book table

#### Scenario: Book cover URL retrieved from UnitTranslation.extra

- GIVEN a Book with `unitId = "unit-1"` and a `UnitTranslation` with `language = "en"` and `extra = { coverUrl: "https://example.com/cover.jpg" }`
- WHEN a client requests the book's display information in English
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/cover.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Book table

## REMOVED Requirements

### Requirement: coverAssetUnitId references an IMAGE unit

**Reason**: IMAGE `UnitType` is reserved for first-class image posts (Pixiv-style posted artwork with its own author, tags, and reactions). Using an IMAGE unit for what is fundamentally a decorative/ornamental thumbnail is overweight and was never implemented (the Prisma schema shipped `Book.coverUrl String?`, not `coverAssetUnitId`). The cover is presentation-layer, language-correlated metadata and belongs in `UnitTranslation.extra`.

**Migration**: This requirement is retired together with the requirement that Book stores a `coverUrl` column. Any production data currently in `Book.coverUrl` SHALL be copied into `UnitTranslation.extra.coverUrl` for every translation row of that unit before the column is dropped (see `proposal.md` for the migration procedure). No data exists under an IMAGE-unit indirection today, so no IMAGE-unit-based migration is required.
