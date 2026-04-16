## MODIFIED Requirements

### Requirement: Shared infrastructure seed module

A shared module (`tool/seed/lib/seed-infra.ts`) SHALL encapsulate all infrastructure seeding logic. Both `tool/seed/cross-seed.ts` and `package/server/prisma/seed/mock/seed.ts` SHALL use this module. The existing `package/server/prisma/seed/mock/seed-tags.ts` SHALL be removed.

The mock seed orchestrator (`seed.ts`) SHALL execute steps in the following order to ensure data dependencies are satisfied:

1. Reset
2. Users + Entities (parallel)
3. Tags
4. Works — Books, Games, Media (parallel)
5. Scores (needs realms + works)
6. Posts (needs works, users, scores)
7. Shelves + Realms (parallel; shelves need works + posts)
8. Chapters (needs books)
9. Engagement (needs all unit IDs)
10. Zones (needs works, tags)
11. EchoKV

#### Scenario: Mock seed uses shared module

- **WHEN** the mock seed script runs
- **THEN** it calls the shared infrastructure seed module instead of its own tag creation logic

#### Scenario: Cross-seed uses shared module

- **WHEN** the cross-seed script runs
- **THEN** it calls the shared infrastructure seed module after user seeding

#### Scenario: Shelves are seeded after posts

- **WHEN** the seed pipeline executes
- **THEN** shelf seeding SHALL occur after post seeding so that review posts are available for ShelfItemReview creation

## ADDED Requirements

### Requirement: Shelf seed receives review posts

The `seedShelves` function SHALL receive the list of created review posts (not an empty array). For each shelf item, the seeder SHALL probabilistically attach matching review posts via the `ShelfItemReview` junction table.

#### Scenario: ShelfItemReview records are created

- **WHEN** shelves are seeded with available review posts
- **THEN** at least some shelf items SHALL have associated `ShelfItemReview` records linking to actual review posts

#### Scenario: Review matching by target work

- **WHEN** a shelf item references work X and a review post targets work X
- **THEN** the `ShelfItemReview` record SHALL link the shelf item to that review post

### Requirement: Shelf extra field population

The shelf seeder SHALL populate the `extra` JSON field on approximately 30% of shelves. The extra field SHALL contain metadata such as custom display settings, sort preferences, or theme overrides.

#### Scenario: Shelf with extra metadata

- **WHEN** a shelf is seeded with extra data
- **THEN** the `extra` JSON field SHALL contain at least one property

#### Scenario: Shelf without extra metadata

- **WHEN** a shelf is seeded without extra data
- **THEN** the `extra` field SHALL be `null`

### Requirement: Scaled default counts

The default seed counts SHALL be updated to the following values:

| Key | Old Default | New Default |
|-----|-------------|-------------|
| books | 100 | 1000 |
| games | 50 | 1000 |
| media | 50 | 1000 |
| shelves | 100 | 500 |
| personEntities | 300 | 800 |
| organizationEntities | 50 | 200 |
| zones | (new) | 40 |

The `reviewsPerWork`, `treePostsPerWork`, `quotesPerWork`, and `remarksPerWork` fixed counts SHALL be removed from `SeedCounts` and replaced by power-law distribution calls within each seeder.

#### Scenario: Default book count is 1000

- **WHEN** the seed runs without `SEED_BOOKS` env var
- **THEN** approximately 1000 books SHALL be created

#### Scenario: Per-work counts removed from config

- **WHEN** the `SeedCounts` interface is inspected
- **THEN** it SHALL NOT contain `reviewsPerWork`, `treePostsPerWork`, `quotesPerWork`, or `remarksPerWork` fields

#### Scenario: Env var overrides still work

- **WHEN** the seed runs with `SEED_BOOKS=50`
- **THEN** approximately 50 books SHALL be created (override respected)

### Requirement: Entity verified diversity

The entity seed SHALL set `verified: true` on approximately 5% of person entities and 10% of organization entities.

#### Scenario: Some persons are verified

- **WHEN** 800 person entities are seeded
- **THEN** approximately 40 (5%) SHALL have `verified: true`

#### Scenario: Some organizations are verified

- **WHEN** 200 organization entities are seeded
- **THEN** approximately 20 (10%) SHALL have `verified: true`
