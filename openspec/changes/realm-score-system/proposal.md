## Why

The current `Rating` model is a flat aggregate where `domain` is always set to `unitId` itself, making it single-dimensional. Individual ratings are a bare number in `unit.metadata.rating` with no concept of scoring context. This prevents realm-scoped evaluation, rating distribution display, and extensible sub-dimension scoring. Reviews and scores are tightly coupled — users cannot rate without writing a review.

## What Changes

- **New `ScoreEntry` model**: Independent per-user scores scoped by `(userId, unitId, realm)` with an overall `value` (integer 1-10) and optional JSON `fields` for realm-specific sub-dimensions
- **New `ScoreAggregate` model**: Pre-computed aggregates per `(unitId, realm)` with `totalScore`, `totalCount`, JSON `distribution` (histogram of scores 1-10), and JSON `fields` (per-field aggregates including their own distributions)
- **New `ScoreRealmField` model**: Admin-managed registry of allowed extended fields per realm, used for validation and frontend rendering
- **New `score` server module**: Self-contained domain module (`score.api.ts`, `score.service.ts`, `score.mapper.ts`, `score.types.ts`) with endpoints under `/score`
- **Score-review decoupling**: Reviews/remarks gain a `scoreEntryId` FK to `ScoreEntry` (`onDelete: Restrict`). Users can rate without commenting. Reviews must reference a score. Deleting a score requires manually deleting linked reviews first (admins bypass this check)
- **BREAKING**: Remove the `Rating` model. Migrate existing rating data to `ScoreAggregate` + `ScoreEntry`. Remove `metadata.rating` from review units
- **Standardized score range**: All scores (overall and per-field) validated to integer 1-10

## Capabilities

### New Capabilities

- `realm-score`: Core realm-based scoring system — ScoreEntry and ScoreAggregate models, delta-based aggregate maintenance with distribution tracking, score CRUD API, field-level aggregation, 1-10 integer validation
- `score-realm-field`: Admin-managed field registry per realm — ScoreRealmField model, admin CRUD API under `/score/realm/:realmId`, field validation on score submission, sort ordering

### Modified Capabilities

- `type-extension-post`: Adding optional `scoreEntryId` FK on Unit for review/remark types, `onDelete: Restrict` semantics, review creation requires a linked ScoreEntry

## Impact

- **Affected packages**: `package/server` (new score module, schema migration, review service refactor), `package/contract` (new score DTOs), `package/api` (new score query hooks), `package/app` (score UI integration)
- **Database**: New tables `ScoreAggregate`, `ScoreEntry`, `ScoreRealmField`. New column `scoreEntryId` on `Unit`. Drop `Rating` table. Data migration required for existing ratings
- **API**: New endpoints under `/score` and `/score/realm/:realmId`. Review creation/update endpoints change to require `scoreEntryId`
- **Backward compatibility**: Breaking change for review API consumers — rating field moves from review metadata to a separate ScoreEntry. Migration script needed for existing data
