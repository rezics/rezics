## 1. Schema Changes

- [ ] 1.1 Add `ENTITY` to `UnitType` enum in `package/server/prisma/schema.prisma`
- [ ] 1.2 Add `Entity` extension model (`unitId` PK, `kind String? @db.VarChar(32)`, `verified Boolean @default(false)`) with 1:1 relation to Unit and cascade delete
- [ ] 1.3 Add `Attribution` model (`unitId`, `entityId`, `role @db.VarChar(64)`, `sortOrder @default(0)`) with composite PK `(unitId, entityId, role)`, two named relations to Unit (`AttributedUnit`, `AttributionEntity`), cascade deletes, and indexes on `(entityId, role)` and `(unitId, role, sortOrder)`
- [ ] 1.4 Add `entity Entity?` and `attributions Attribution[] @relation("AttributedUnit")` and `attributedAs Attribution[] @relation("AttributionEntity")` to the Unit model
- [ ] 1.5 Remove `Person`, `Organization`, `PersonCredit`, `OrgCredit` models and their relations from Unit (`personCredits`, `organizationCredits`)
- [ ] 1.6 Generate Prisma client and create migration (`bun run prisma:migrate` in `package/server`). Write SQL migration to convert existing Person/Organization rows to Unit + Entity rows and PersonCredit/OrgCredit rows to Attribution rows before dropping old tables

## 2. Contract Layer

- [ ] 2.1 Rewrite `package/contract/src/attribution.ts` — replace all person/org DTOs with unified `EntityDTO`, `CreateEntityInput`, `UpdateEntityInput`, `EntityListQuery`, `AttributionDTO`, `LinkAttributionInput` TypeBox schemas
- [ ] 2.2 Add role constant arrays (`bookRoles`, `gameRoles`, `mediaRoles`) and optional `entityKinds` array to the contract
- [ ] 2.3 Verify contract builds: run `tsc --noEmit` in `package/contract`

## 3. Server Attribution Domain

- [ ] 3.1 Rewrite `package/server/src/attribution/types.ts` — update Prisma include types for Entity and Attribution
- [ ] 3.2 Rewrite `package/server/src/attribution/attribution.mapper.ts` — unified `mapEntityToDTO` and `mapAttributionToDTO` mappers replacing person/org-specific mappers
- [ ] 3.3 Rewrite `package/server/src/attribution/attribution.service.ts` — unified Entity CRUD (create with Unit+Entity+translations in transaction, update, delete, list with kind/q filter) and unified attribution link/unlink (replacing separate person/org credit methods)
- [ ] 3.4 Rewrite `package/server/src/attribution/attribution.api.ts` — unified Elysia routes (`/attribution/entities` CRUD, `/attribution/credits` link/unlink)
- [ ] 3.5 Update `package/server/src/attribution/index.ts` barrel export
- [ ] 3.6 Update any imports in `package/server/src/book/book.service.ts` or other server modules that reference old Person/Organization types

## 4. Meilisearch Sync

- [ ] 4.1 Update `patchContentCreditsToMeili` in `package/server/src/meili/content/sync.ts` (or equivalent) to read from `Attribution` table and resolve entity names from `UnitTranslation.title`
- [ ] 4.2 Update `package/contract/src/meili/content.ts` if the content search document schema references person/org credit fields

## 5. API Client Layer

- [ ] 5.1 Rewrite `package/api/src/attribution/attribution.types.ts` — re-export unified types from contract
- [ ] 5.2 Rewrite `package/api/src/attribution/attribution.api.ts` — unified `attributionApi` with entity CRUD + attribution link/unlink methods
- [ ] 5.3 Rewrite `package/api/src/attribution/attribution.keys.ts` — unified key factory (`entityList`, `entityDetail`, `attributionsByUnit`)
- [ ] 5.4 Rewrite `package/api/src/attribution/attribution.queries.ts` — unified `entityListQuery`, `entityDetailQuery` options
- [ ] 5.5 Rewrite `package/api/src/attribution/attribution.mutations.ts` — unified mutation hooks (`useCreateEntityMutation`, `useUpdateEntityMutation`, `useDeleteEntityMutation`, `useLinkAttributionMutation`, `useUnlinkAttributionMutation`)
- [ ] 5.6 Update `package/api/src/attribution/attribution.ts` barrel export
- [ ] 5.7 Update `package/api/src/book/book.ts`, `book.api.ts`, `book.queries.ts`, `book.keys.ts` if they reference old person/org types

## 6. Frontend Updates

- [ ] 6.1 Update `package/app/src/shared/util/translation-helpers.ts` if it references Person/Organization types
- [ ] 6.2 Grep for remaining `Person`, `Organization`, `PersonCredit`, `OrgCredit` references across `package/app` and `package/admin` and update to use Entity/Attribution types

## 7. Seed Data

- [ ] 7.1 Update `package/server/prisma/seed/mock/attribution.ts` — create Entity units (with translations) instead of standalone Person/Organization records, create Attribution rows instead of PersonCredit/OrgCredit
- [ ] 7.2 Update `package/server/prisma/seed/mock/types.ts` if it defines Person/Organization seed types
- [ ] 7.3 Update `package/server/prisma/seed/mock/books.ts`, `games.ts`, `media.ts` if they reference old credit types
- [ ] 7.4 Update `package/server/prisma/seed/mock/data/text/en.ts` if it contains person/org name data

## 8. Validation

- [ ] 8.1 Run `tsc --noEmit` in `package/server`, `package/contract`, `package/api`
- [ ] 8.2 Run `bun test` in `package/server` to verify attribution tests pass (update tests if they exist)
- [ ] 8.3 Run `bun run knip` at root to check for unused exports from the migration
- [ ] 8.4 Grep repo-wide for any remaining references to `Person`, `Organization`, `PersonCredit`, `OrgCredit`, `personCredit`, `orgCredit`, `roleKey` and clean up
