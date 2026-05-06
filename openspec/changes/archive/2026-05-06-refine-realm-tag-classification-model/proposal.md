## Why

The realm/tag model has accumulated correct pieces but unclear boundaries: `RealmUnit`, `RealmTagUnit`, and `RealmTagVote` are easy to misread as variants of the same relation, and the current Prisma relation names (`realmTagAsRealm`, `realmTagVoteAsTag`, etc.) reinforce that confusion. This change clarifies the backend model so realms remain subreddit-like community spaces while realm-tag usage becomes a first-class, community-specific interpretation layer over the existing global tag vocabulary.

## Problem

Rezics needs realm-scoped tag interpretation because pure global tag voting collapses different communities into one generic meaning. A global tag like "slow burn", "hard sci-fi", "female protagonist", or "beginner friendly" may be useful to one group and misleading to another. `RealmTagUnit` solves this by letting each realm apply and rank existing global tags in its own context, while still contributing to ordinary global `UnitTag` discovery.

The current backend model does not explain this clearly enough:

- `Realm` is sometimes described as tag-like because `RealmUnit` uses a junction-table shape similar to `UnitTag`, but product-wise a realm is a community space with membership, posting rules, moderation, rules/about pages, pinboards, and curated tag usage.
- `RealmTagUnit` is sometimes misread as a local tag or a new tag identity. It is neither. Realms cannot mint local tag identities; they can only interpret and apply existing global `TAG` Units.
- `RealmTagUnit` needs a pair-level explanation/discussion surface for `(realmUnitId, tagUnitId)`, but that pair is not itself a `Unit`.
- Prisma relation names on `Unit` are technically valid but semantically poor, making future maintenance error-prone.

## Goals

- Clarify backend semantics for `Realm`, `RealmUnit`, `UnitTag`, `RealmTagUnit`, and `RealmTagVote`.
- Add a dedicated pair-level `RealmTagContext` model for `(realmUnitId, tagUnitId)` interpretation pages.
- Keep `RealmTagUnit` independent from `RealmUnit`; a realm may classify any target Unit even if that Unit is not posted into the realm feed.
- Preserve the intended double-write behavior: creating a realm-scoped tag application also idempotently contributes the caller's ordinary global `TagVote` for `(unitId, tagUnitId)`.
- Rename Prisma relation fields to business-role names and add JSDoc comments that prevent repeated misinterpretation.
- Define backend APIs/contracts for resolving and materializing realm-tag context Units.
- Add seed support so development data demonstrates the product semantics.
- Capture frontend follow-up work required after the backend model lands.

## Non-goals

- Do not turn `Realm` into a tag/classifier.
- Do not allow realms to create local tag identities.
- Do not require `RealmTagUnit` rows to have matching `RealmUnit` rows.
- Do not redesign the entire tag system, global tag voting, or Unit identity model.
- Do not implement the full frontend redesign in this backend-focused change.
- Do not remove `RealmUnit`; it remains the feed/community membership relation for realm posts and cross-posting.

## Scope

The primary implementation scope is backend and shared contract work across:

- `package/server`: Prisma schema, migrations, realm/tag services, APIs, mappers, validation, tests, and seed/factory data.
- `package/contract`: DTOs, schemas, request/response contracts, and documentation comments.
- `package/search`: sync and indexing adjustments only where the model changes affect realm-tag fields.
- `package/api`: client query/mutation surfaces for new backend endpoints.

Frontend work is explicitly scoped as follow-up analysis and task planning after the backend is complete:

- Identify incorrect assumptions in current UI, especially realm/tag rendering, `RealmTagHighlights`, tag context display, realm tag management, and route/query syntax.
- Define the missing UI flows for realm-tag context pages and badges.
- Avoid implementing those UI changes until the backend contract is stable.

## What Changes

- Add a new `RealmTagContext` backend model keyed by `(realmUnitId, tagUnitId)` with optional `contextUnitId`.
- Add backend routes/services to read a realm-tag context, create/update metadata, and materialize a `contextUnitId` when explanation/discussion content is needed.
- Clarify that `contextUnitId` is a materialized content carrier, not the identity of `realmId:tagId`.
- Keep `RealmTagUnit(realmUnitId, tagUnitId, unitId)` as the independent triple-level application/vote aggregate.
- Preserve `RealmTagUnit` independence from `RealmUnit`.
- Rename Prisma relations away from `realmTagAsRealm`, `realmTagAsTag`, `realmTagAsUnit`, `realmTagVoteAsRealm`, `realmTagVoteAsTag`, and `realmTagVoteAsUnit`.
- Move the realm side of `RealmTagUnit` relations to the `Realm` extension model where practical.
- Change `RealmTagVote` relations so votes are modeled as votes on a realm-tag application rather than three independent links to `Unit`.
- Add backend validation that `realmUnitId` references a `REALM` Unit and `tagUnitId` references a `TAG` Unit for realm-tag context and application writes.
- Add product-semantics JSDoc to schema-facing contract and service types.
- Add seed data demonstrating:
  - a realm as a community space,
  - global tags as shared vocabulary,
  - realm-specific tag interpretation,
  - a realm-tag context with explanation content,
  - realm-tag applications against Units that may or may not appear in that realm feed.
- Add migration and backfill strategy for existing `RealmTagUnit` and `RealmTagVote` rows.
- **BREAKING** for internal generated Prisma consumers: relation field names will change.
- **Non-breaking** for public API consumers unless endpoint paths or DTO field names are explicitly changed in the design.

## Capabilities

### New Capabilities

- `realm-tag-interpretation-context`: Pair-level interpretation context for `(realmUnitId, tagUnitId)`, including `contextUnitId` materialization and backend APIs.
- `realm-taxonomy-seed-support`: Seed and factory data that demonstrates realm community semantics, global tags, realm-scoped tag applications, and realm-tag context pages.

### Modified Capabilities

- `realm-tag-unit`: Clarify that `RealmTagUnit` is an independent realm-scoped application of an existing global tag to any Unit, not a local tag and not dependent on `RealmUnit`.
- `realm-tag-vote`: Clarify that `RealmTagVote` is a user's vote on a specific realm-tag application and should relate to that application semantically.
- `realm-tag-context`: Update existing tag context behavior and naming so it does not conflict with pair-level realm-tag interpretation context.
- `realm-post-junction`: Clarify that `RealmUnit` is community/feed membership for realm posts and cross-posting, not semantic tagging.
- `content-index`: Preserve and document `realmTagKeys` as machine-facing compound keys for realm-scoped tag filtering.

## Impact

- Database:
  - New table: `RealmTagContext`.
  - Prisma schema relation renames.
  - Migration for relation metadata and any new FKs/unique constraints.
  - No requirement that `RealmTagUnit` reference `RealmUnit`.

- Backend APIs:
  - New realm-tag context endpoints.
  - Stronger validation for realm/tag target types.
  - Existing realm-tag unit APIs keep their core behavior but receive clearer docs/tests.

- Contracts:
  - New DTOs and schemas for `RealmTagContext`.
  - JSDoc comments for realm semantics and realm-tag application semantics.

- Search/indexing:
  - `realmTagKeys` remain machine keys formatted as `"{realmUnitId}:{tagUnitId}"`.
  - Context pages may require sync only if the materialized context Unit is indexable.

- Seeds:
  - Add deterministic or stable seed examples that exercise the intended semantics.

- Frontend follow-up:
  - Existing UI likely misrepresents realm highlights and tag labels in places.
  - Frontend routes/badges should later support `realmTitle:tagTitle` display and slug/id mixed query parsing.
  - The frontend follow-up should happen after backend contracts stabilize.

- Backward compatibility:
  - Data migration should preserve existing realm-tag applications and votes.
  - Public API compatibility should be preserved where possible.
  - Internal Prisma code will require updates because relation names change.
