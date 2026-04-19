## ADDED Requirements

### Requirement: Shelf cover image stored in UnitTranslation.extra

Shelf cover images SHALL be stored in `UnitTranslation.extra.coverUrl` via the `unitTranslationExtraSchema` defined in the `unit-translation` capability. The `Shelf` extension table SHALL NOT contain a `coverUrl` column. Because Shelf display text (title / description) already lives in `UnitTranslation`, the cover uses the same language-correlated storage and resolves through the same translation fallback chain.

#### Scenario: Shelf schema excludes coverUrl column

- GIVEN the Shelf model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain a field named `coverUrl`
- AND the only fields present SHALL be `unitId`, `kindKey`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Shelf cover URL retrieved from UnitTranslation.extra

- GIVEN a Shelf with `unitId = "shelf-1"` and a `UnitTranslation` with `language = "en"` and `extra = { coverUrl: "https://example.com/shelf.jpg" }`
- WHEN a client requests the shelf's display information in English
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/shelf.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Shelf table

#### Scenario: Shelf cover URL absent is not an error

- GIVEN a Shelf with `unitId = "shelf-1"` and UnitTranslation rows that do not set `extra.coverUrl`
- WHEN a client requests the shelf's display information
- THEN the returned DTO SHALL expose `coverUrl = null` or `undefined`
- AND the response SHALL succeed normally

## REMOVED Requirements

### Requirement: Shelf.coverUrl column

**Reason**: Shelf covers are language-correlated presentation metadata (a shelf translated to Japanese may reasonably want a Japanese cover banner) and belong alongside title / summary in `UnitTranslation`. A dedicated column on the extension table cannot vary per language. Unifying cover storage with the other type extensions also simplifies the client.

**Migration**: Every `Shelf.coverUrl` value SHALL be copied into `UnitTranslation.extra.coverUrl` for every translation row of the shelf's unit before the column is dropped. See `proposal.md` for the migration procedure.
