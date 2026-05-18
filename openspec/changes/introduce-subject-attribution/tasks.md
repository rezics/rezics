## 1. Schema And Contracts

- [x] 1.1 Add Prisma `SubjectAttribution` model in `package/server/prisma/schema.prisma` with `(unitId, entityId, role)` uniqueness, subject-centric indexes, `sortOrder`, optional `weight`, and cascade relations to `Unit`.
- [x] 1.2 Generate and commit a Prisma migration that creates `SubjectAttribution` and preserves existing Attribution rows.
- [x] 1.3 Extend `package/contract/src/entity.ts` Entity kind constants with subject kinds.
- [x] 1.4 Add subject attribution DTO, link/unlink input, list query, and recommended role constants in `package/contract`.
- [x] 1.5 Decide and apply the credit attribution naming cutover in `package/contract`, preserving backward-compatible data migration semantics.

## 2. Server Services And APIs

- [x] 2.1 Add `package/server/src/subject-attribution/` service, mapper, types, API, and tests following domain module conventions.
- [x] 2.2 Validate that `SubjectAttribution.entityId` references a `Unit(type = ENTITY)` before linking.
- [x] 2.3 Implement link, unlink, list-by-unit, and list-by-subject operations with Entity translations included in DTOs.
- [x] 2.4 Mount the subject attribution API from `package/server/src/index.ts`.
- [x] 2.5 Rename or alias current attribution server modules to credit-specific names and update all internal imports.

## 3. API Client And Frontend Surfaces

- [x] 3.1 Add `package/api/src/subject-attribution/` keys, API calls, queries, mutations, and exported types.
- [x] 3.2 Update `package/api/src/attribution/` naming to credit-specific surfaces if the cutover is implemented.
- [x] 3.3 Add admin subject attribution management affordances for linking Entities to target Units.
- [x] 3.4 Update app-side Entity kind labels and pickers to include subject kinds without changing the Entity i18n resolution path.
- [x] 3.5 Add initial subject browsing/query UI only where required by the implementation scope.

## 4. Search Indexing

- [x] 4.1 Extend `package/search` content document types with `subjectEntityIds`, `subjectNames`, `subjectKinds`, and `subjectRoles`.
- [x] 4.2 Update full content sync to denormalize SubjectAttribution rows separately from credit attributions.
- [x] 4.3 Add partial sync helper for subject fields and call it from SubjectAttribution mutations.
- [x] 4.4 Update Meilisearch searchable/filterable attribute configuration for subject fields.
- [x] 4.5 Add search tests proving subject names do not appear in `creditNames`.

## 5. Migration And Repo Cutover

- [x] 5.1 Run repo-wide searches for `Attribution`, `attribution`, and `/attribution` and update affected imports/routes/docs according to the chosen credit naming strategy.
- [x] 5.2 Update OpenAPI route summaries and tags for credit attribution and subject attribution.
- [x] 5.3 Update admin and app locale keys for subject kinds, subject roles, and credit attribution naming.
- [x] 5.4 Update seed/factory data to include representative subject Entities and SubjectAttribution rows.

## 6. Verification

- [x] 6.1 Run `bun --filter=@rezics/server run prisma:generate`.
- [x] 6.2 Run targeted server tests for entity, credit attribution, subject attribution, and search sync.
- [x] 6.3 Run `bun run check:convention`.
- [x] 6.4 Run `bun run format:check`.
- [ ] 6.5 Run `bun run knip` or targeted export checks if public names are changed.
