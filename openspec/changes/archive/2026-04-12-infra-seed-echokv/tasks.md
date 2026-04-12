## 1. Clean up contract package

- [x] 1.1 Remove `SEED_TAG_IDS`, `uuidv5()`, `buildSeedTagId()`, `SEED_TAG_NAMESPACE` from `package/contract/src/seed-tags.ts`. Keep `SEED_TAG_NAMES`, `SeedTagName`, `SEED_TAG_TITLES`, `SEED_TAG_SCORE`.
- [x] 1.2 Verify `package/contract` compiles and no other contract consumers reference `SEED_TAG_IDS` (grep repo-wide, fix any remaining imports).

## 2. Shared infrastructure seed module

- [x] 2.1 Create `tool/seed/lib/seed-infra.ts` with `seedContentTypeTags(prisma)` — creates tag Units with DB-generated v7 IDs, looks up existing tags by English title + type TAG, returns `Record<SeedTagName, string>` (name→ID map).
- [x] 2.2 Add `seedDefaultRealm(prisma, rootUserId)` to `tool/seed/lib/seed-infra.ts` — creates official public realm if none exists (query by `isOfficial: true`), returns realm ID.
- [x] 2.3 Add `seedInfraEchoKV(prisma, tagMap, realmId)` to `tool/seed/lib/seed-infra.ts` — upserts `infra:seed_tags` and `infra:default_realm` keys in EchoKV.

## 3. Integrate into cross-seed

- [x] 3.1 Update `tool/seed/cross-seed.ts` to import and call `seedContentTypeTags`, `seedDefaultRealm` (using root user ID), and `seedInfraEchoKV` after user seeding.
- [x] 3.2 Verify cross-seed runs end-to-end: `bun run tool/seed/cross-seed.ts` succeeds and EchoKV entries are written.

## 4. Update mock seed

- [x] 4.1 Delete `package/server/prisma/seed/mock/seed-tags.ts`.
- [x] 4.2 Update `package/server/prisma/seed/mock/seed.ts` to import `seedContentTypeTags` from `tool/seed/lib/seed-infra.ts` instead of the deleted file. Adjust the seed flow to pass the returned tag map downstream.
- [x] 4.3 Verify mock seed runs end-to-end: `bun run package/server/prisma/seed/mock/seed.ts` succeeds.

## 5. Frontend: runtime tag ID resolution

- [x] 5.1 Update `package/app/src/collection/component/CollectionModal.tsx` — remove `SEED_TAG_IDS` import, fetch `echoKvGetQuery("infra:seed_tags")` for tag ID resolution, gracefully handle loading/error state (show all shelves when IDs unavailable).
- [x] 5.2 Verify `package/app` compiles with no references to `SEED_TAG_IDS`.

## 6. Validation

- [x] 6.1 Grep repo-wide for any remaining references to `SEED_TAG_IDS`, `uuidv5`, `SEED_TAG_NAMESPACE`, `buildSeedTagId` — confirm zero results.
- [x] 6.2 Build all affected packages: `@rezics/contract`, `@rezics/app`, `@rezics/server`.
