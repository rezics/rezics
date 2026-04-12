## 1. Schema & Migration

- [ ] 1.1 Add `ScoreAggregate`, `ScoreEntry`, and `ScoreRealmField` models to `package/server/prisma/schema.prisma` with all columns, indexes, and composite keys as specified in the design
- [ ] 1.2 Add optional `scoreEntryId` FK to the `Post` model (or `Unit` model) with `onDelete: Restrict` and create the relation to `ScoreEntry`
- [ ] 1.3 Run `bun run prisma:generate` in `package/server` to regenerate the Prisma client
- [ ] 1.4 Create a Prisma migration (`bun run prisma:migrate`) for the new tables and the `scoreEntryId` column
- [ ] 1.5 Write a data migration script that converts existing `Rating` rows and `unit.metadata.rating` values into `ScoreEntry` + `ScoreAggregate` records using the default realm
- [ ] 1.6 Remove the `Rating` model from the schema after migration is verified

## 2. Contract Definitions

- [ ] 2.1 Create score DTOs in `package/contract/src/score.ts`: `ScoreEntryDTO`, `ScoreAggregateDTO` (including `distribution` and `fields` shapes), `UpsertScoreInput`, `ScoreRealmFieldDTO`
- [ ] 2.2 Add validation constants (`SCORE_MIN = 1`, `SCORE_MAX = 10`) and the Typebox schema for score value validation
- [ ] 2.3 Export new types from `package/contract/src/index.ts`

## 3. Score Module — Core Service

- [ ] 3.1 Create `package/server/src/score/score.types.ts` with Prisma include types, domain types, and score constants
- [ ] 3.2 Create `package/server/src/score/score.mapper.ts` with DTO mapping functions, validation helpers (`validateScore`, `validateFields`), and aggregate delta computation utilities
- [ ] 3.3 Create `package/server/src/score/score.service.ts` implementing:
  - `upsertScore(userId, unitId, realm, value, fields?)` — ScoreEntry upsert + ScoreAggregate delta update (totalScore, totalCount, distribution, field aggregates with distribution) in a single transaction
  - `deleteScore(id, isAdmin)` — review-existence check (reject with blocking IDs if non-admin), admin bypass (delete linked units first), ScoreEntry deletion + aggregate delta
  - `getAggregatesByUnit(unitId)` — all realm aggregates for a unit
  - `getAggregate(unitId, realm)` — single realm aggregate
  - `getUserScores(userId, unitId)` — user's ScoreEntry records across realms
  - `recalculateAggregate(unitId, realm)` — admin recalculation from ScoreEntry source data
- [ ] 3.4 Write tests for `score.service.ts` covering: create, update, delete flows, distribution correctness, field-level aggregation with distribution, delete-with-review-protection, admin bypass, aggregate recalculation

## 4. Score Module — Realm Field Service

- [ ] 4.1 Add realm field methods to `score.service.ts` (or a separate section):
  - `listRealmFields(realmId)` — ordered by sortOrder
  - `addRealmField(realmId, key, label?, sortOrder?)` — admin only, validate key format
  - `removeRealmField(realmId, key)` — admin only, 404 if not found
- [ ] 4.2 Implement field key validation (lowercase kebab-case: `/^[a-z][a-z0-9-]*$/`)
- [ ] 4.3 Write tests for realm field CRUD and key format validation

## 5. Score Module — API Routes

- [ ] 5.1 Create `package/server/src/score/score.api.ts` with Elysia route definitions:
  - `POST /score` — upsert score (auth required)
  - `DELETE /score/:id` — delete score (auth required)
  - `GET /score/unit/:unitId` — all realm aggregates
  - `GET /score/unit/:unitId/:realm` — single realm aggregate
  - `GET /score/user/:userId/:unitId` — user's scores
  - `GET /score/realm/:realmId` — list realm fields
  - `POST /score/realm/:realmId` — add field (admin)
  - `DELETE /score/realm/:realmId/:key` — remove field (admin)
  - Admin recalculation endpoint
- [ ] 5.2 Mount the score API via `.use()` in `package/server/src/index.ts`
- [ ] 5.3 Write route-level tests for request validation, auth checks, and response shapes

## 6. Review Service Refactor

- [ ] 6.1 Update `package/server/src/review/review.service.ts` to require `scoreEntryId` when creating reviews (`kindKey = "review"`) and remarks (`kindKey = "note"`)
- [ ] 6.2 Remove `applyRatingDelta` from `ReviewService` — score aggregation is now handled by the score module
- [ ] 6.3 Remove `metadata.rating` extraction logic from `review/mapper.ts` (`extractRatingFromMetadata`, `buildMetadataWithRating`, `normalizeRatingValue`, `buildRatingWhereClause`)
- [ ] 6.4 Update review DTOs and mappers to include `scoreEntryId` instead of inline `rating`
- [ ] 6.5 Update the book API (`package/server/src/book/book.api.ts`) rating endpoint to use `ScoreAggregate` instead of the old `Rating` model
- [ ] 6.6 Verify existing review tests pass or update them to reflect the new score-linked flow

## 7. API Client & Contract Integration

- [ ] 7.1 Create score query options and hooks in `package/api` (TanStack Query): `useScoreAggregates`, `useScoreAggregate`, `useUserScores`, `useUpsertScore`, `useDeleteScore`, `useRealmFields`
- [ ] 7.2 Update review-related hooks in `package/api` to handle `scoreEntryId` instead of inline `rating`

## 8. Validation & Cleanup

- [ ] 8.1 Run `bun run prisma:generate` and verify the Prisma client compiles cleanly
- [ ] 8.2 Run `bun test` across `package/server` to verify no regressions
- [ ] 8.3 Run `bun run knip` at the repo root to detect unused exports from the removed Rating model and old review rating helpers
- [ ] 8.4 Grep for remaining references to the old `Rating` model, `metadata.rating`, and `applyRatingDelta` across all packages and remove them
