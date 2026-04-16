## Why

The seed data has fallen out of sync with the current schema after several major changes (entity model unification, zone introduction, shelf restructure). Critical models like Zone have no seed coverage at all, Entity and Tag seeds lack description/multi-language translations, and the Shelf seed has a sequencing bug that prevents ShelfItemReview from ever being created. Beyond coverage gaps, the data distribution is unrealistically uniform — every work gets the same number of reviews and posts — and the total volume (~200 works) is too small to exercise pagination, search ranking, or UI edge cases meaningfully.

## What Changes

- **Add Zone seed**: Create Zone units with varied templates, filters, styling, and temporal bounds (active, scheduled, expired).
- **Fix Shelf seed sequencing**: Move shelf seeding after post creation so ShelfItemReview junctions are actually populated. Add power-law item counts (3–150) and populate `shelf.extra`.
- **Enrich Entity seed**: Add multi-language translations and description fields for both person and organization entities. Introduce a small percentage of `verified: true` entities.
- **Add Tag descriptions**: Generate description translations for Tag units alongside existing title translations.
- **Introduce power-law distribution**: Replace fixed per-work counts (reviews, posts, chapters, shelf items, shelf inclusions) with a configurable power-law generator — most works get minimal engagement, a few get extremely high engagement.
- **Scale to 1000-level per content type**: Increase books, games, and media each to ~1000 units, scale entities and shelves proportionally.
- **Performance optimization**: Convert sequential `prisma.unit.create` loops to batch `createMany` where possible (entities, chapters, posts). Optimize the overall seed pipeline for the increased data volume.

## Capabilities

### New Capabilities
- `seed-zone`: Zone unit seeding with template/filter/styling variety and temporal states
- `seed-power-law-distribution`: Reusable power-law random distribution utility for all count-based seed parameters
- `seed-performance-batch`: Batch insert patterns replacing sequential creates for entities, chapters, and high-volume post seeding

### Modified Capabilities
- `infra-seed`: Shelf seed sequencing fix (ShelfItemReview), shelf.extra population, power-law item counts
- `multilingual-seed-generators`: Entity multi-language translations + descriptions, Tag description generation

## Impact

- **Affected package**: `package/server` (prisma/seed/mock/)
- **Affected files**: `seed.ts` (orchestration order), `config.ts` (new defaults + distribution params), `types.ts` (SeedCounts expansion), `attribution.ts` (batch + multilingual), `shelves.ts` (reorder + power-law), `tags.ts` (description), `books.ts` (chapter power-law), `posts.ts` (power-law counts), `generators.ts` (description generation for TAG/ENTITY), new `zones.ts`, new `utils.ts` power-law function
- **Seed runtime**: Will increase due to 10x data volume, partially offset by batch insert optimization
- **No API or schema changes**: All changes are seed-only; no Prisma schema modifications needed
- **No breaking changes**: Seed is a dev-only tool; existing `SEED_*` env var overrides remain functional with new defaults
- **Backward compatibility**: Fully backward-compatible. Existing env var overrides still work. `seed:database-reset` flow unchanged.
