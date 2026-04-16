## Why

Person and Organization are structurally identical standalone models that lack translation, slug, and language support — features already provided by the Unit system. On a Chinese book page, seeing an author's name and bio only in Japanese is jarring; most authors have translated names and bios. The same applies to publishers and other organizations. Additionally, maintaining two parallel models (Person/Organization) with duplicated CRUD, DTOs, and credit tables adds unnecessary complexity when their only difference is a metadata label.

## What Changes

- **BREAKING**: Drop `Person`, `Organization`, `PersonCredit`, and `OrgCredit` models entirely
- Add `ENTITY` to the `UnitType` enum — persons and organizations become Units with full translation, slug, and language support
- Add `Entity` extension table on Unit with optional `kind` (free string: `"person"`, `"organization"`, etc.) and `verified` flag for future use
- **BREAKING**: Replace `PersonCredit` and `OrgCredit` with a unified `Attribution` table — a Unit-to-Unit relationship (`unitId` → content, `entityId` → entity, `role` string, `sortOrder`)
- Rewrite the `@rezics/contract` attribution schemas into a unified Entity + Attribution contract
- Rewrite `AttributionService` — single Entity CRUD + single attribution link/unlink (replaces 2x duplicated code paths)
- Update `@rezics/api` attribution layer — unified query hooks and mutations
- Update Meilisearch content sync to use the new Attribution schema

## Capabilities

### New Capabilities

- `entity-unit-type`: Entity as a Unit subtype — schema, extension table, CRUD service, and contract DTOs for the new ENTITY UnitType with optional kind and verified fields
- `unified-attribution`: Unified Attribution model — single Unit-to-Unit credit table replacing PersonCredit/OrgCredit, with role (free string) and sortOrder

### Modified Capabilities

- `attribution`: Attribution contract and service rewrite — replace person/org-specific DTOs, CRUD, and credit link schemas with unified Entity and Attribution schemas
- `attribution-api-client`: Frontend API client update — unified hooks and mutations replacing duplicated person/org query patterns
- `content-search-translations`: Meilisearch sync update — adapt credit indexing to new Attribution + Entity-as-Unit schema

## Impact

- **`package/server`**: Schema migration (drop 4 models, add 2 + enum value), rewrite `AttributionService`, mapper, types, API routes, seed data
- **`package/contract`**: Rewrite `attribution.ts` — unified DTOs and schemas
- **`package/api`**: Rewrite attribution queries, mutations, keys, types
- **`package/app`**: Update any components consuming attribution data (book detail pages, entity pages)
- **`package/admin`**: Update admin attribution management UI
- **Database**: Requires migration — existing Person/Organization data must be migrated to Unit + Entity rows, existing credits migrated to Attribution rows
- **Meilisearch**: Content sync logic in `patchContentCreditsToMeili` needs updating
- **Breaking**: All attribution API endpoints change shape; frontend must update in lockstep
