## 1. Contract And Data Model

- [x] 1.1 Add `eligibleCreditRoles` and `eligibleSubjectRoles` to `package/server/prisma/schema.prisma` Entity model with a migration/backfill strategy.
- [x] 1.2 Extend `package/contract/src/entity.ts` DTO/create/update schemas to expose and validate eligibility arrays against credit and subject role registries.
- [x] 1.3 Extend `package/contract/src/meili/entity.ts` search document/options schemas with `eligibleCreditRole` and `eligibleSubjectRole` filters, and remove actual-role history fields.
- [x] 1.4 Add contract tests covering valid/invalid Entity eligibility arrays and updated entity search options.

## 2. Server Entity Service

- [x] 2.1 Update `package/server/src/entity/entity.types.ts`, mapper, and service create/update paths to read and write eligibility arrays.
- [x] 2.2 Update EntityService field-key/history handling so eligibility edits are permission-gated consistently with Entity metadata edits.
- [x] 2.3 Update EntityService tests and API tests for create, update, DTO mapping, and Meili sync with eligibility fields.
- [x] 2.4 Run targeted server/entity tests after the service changes.

## 3. Attribution Enforcement

- [x] 3.1 Add credit eligibility validation to `package/server/src/credit-attribution/credit-attribution.service.ts` before creating new links.
- [x] 3.2 Add subject eligibility validation to `package/server/src/subject-attribution/subject-attribution.service.ts` before creating new links.
- [x] 3.3 Add typed errors for ineligible credit and subject attribution link attempts.
- [x] 3.4 Update credit and subject attribution service/API tests for eligible, ineligible, and existing-read behavior.

## 4. Entity Search Index

- [x] 4.1 Update `package/search/src/sync.ts` Entity document builder to project eligibility arrays and stop aggregating actual role history facets.
- [x] 4.2 Update `package/search/src/client.ts` Entity index settings to make eligibility arrays filterable and remove actual-role history filters.
- [x] 4.3 Update `package/server/src/meili/entity/entity.service.ts` to build Meili filters from eligibility search options.
- [x] 4.4 Remove or replace `patchEntityCreditFacets` and `patchEntitySubjectFacets` usage so attribution mutations no longer patch Entity actual-role facets.
- [x] 4.5 Update search package tests and server Meili tests for the new document shape and filters.

## 5. Frontend Picker And API Client

- [x] 5.1 Update `package/api/src/entity` query and API types to use the new eligibility search options.
- [x] 5.2 Update `package/app/src/entity-picker/components/EntityPicker.tsx` so selected roles search `eligibleCreditRole` or `eligibleSubjectRole` instead of actual-role facets.
- [x] 5.3 Add creation-time eligibility suggestion helpers based on `Entity.kind` and role registries.
- [x] 5.4 Update `EntityInlineCreateForm` to submit explicit eligibility arrays and allow users to add/remove suggested roles.
- [x] 5.5 Update attribution editing callsites and EntityPicker tests/stories for eligibility-filtered selection.

## 6. Seed And Meili Sync

- [x] 6.1 Update entity seed/factory data to persist explicit eligibility arrays for person, organization, character, and other seeded Entity kinds.
- [x] 6.2 Update factory manifest entries and targeted sync so seeded Entity Units synchronize to the `entities` index in `init-and-sync` mode.
- [x] 6.3 Add or update seed/factory tests verifying Entity eligibility population and Entity Meili sync targets.
- [x] 6.4 Document the required full Entity Meili resync after deploying the index document change.

## 7. Repo-Wide Migration And Validation

- [x] 7.1 Search the repo for `creditRoles`, `subjectRoles`, `creditUnitTypes`, `subjectUnitTypes`, `creditCount`, and `subjectCount` usage and migrate or remove callers.
- [x] 7.2 Run Prisma generate for `@rezics/server`.
- [x] 7.3 Run targeted tests for contract, search, server entity, attribution, subject-attribution, and app EntityPicker areas.
- [x] 7.4 Run `bun run check:convention` and relevant package type checks or test commands.
