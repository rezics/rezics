## Context

The mock seed system (`package/server/prisma/seed/mock/`) generates development data for the platform. After recent schema changes — entity model unification, zone introduction, shelf restructure — the seed has diverged from the current data model. Additionally, the uniform distribution and small volume (~200 total works) don't exercise real-world scenarios like pagination under load, search ranking with skewed engagement, or UI behavior on popular vs. niche content.

Current seed pipeline order:
```
Reset → Users + Entities → Tags → Works (Book/Game/Media) → Shelves + Realms (parallel)
  → Scores → Posts → Chapters → Engagement → EchoKV
```

Key problems:
1. Shelves are seeded before posts exist, so `ShelfItemReview` is never populated
2. All works get identical engagement counts (10 reviews, 15 posts each)
3. Zone model has zero seed coverage
4. Entity/Tag seeds lack descriptions and (for entities) multi-language translations
5. Sequential `prisma.unit.create` loops become a bottleneck at 1000-level scale

## Goals / Non-Goals

**Goals:**
- Full coverage of current schema models in seed data (including Zone)
- Realistic power-law engagement distribution across all content
- Scale to ~1000 units per content type (books, games, media)
- Fix the Shelf ↔ Post sequencing bug
- Optimize seed performance for the increased volume via batch inserts
- Enrich Entity and Tag seeds with descriptions and multi-language support

**Non-Goals:**
- Changing the Prisma schema or API layer
- Achieving sub-minute seed times (minutes are acceptable)
- Seeding auth database data (separate concern)
- Adding new seed CLI commands or interactive features
- Real-time seed progress UI

## Decisions

### 1. Power-law distribution utility

**Decision**: Implement a single `powerLaw(min, max, alpha)` function in `utils.ts` that all count-based seeds use.

**Rationale**: A Pareto-like distribution where `P(X > x) ~ x^(-α)` naturally produces the long-tail pattern seen in real forums — most items have minimal engagement, a few have extreme engagement. Using a single shared function ensures consistent behavior and easy tuning.

**Parameters per domain**:
| Domain | min | max | α | Expected shape |
|--------|-----|-----|---|----------------|
| reviews/work | 0 | 50 | 1.8 | ~80% get 0–2, rare spikes to 50 |
| tree posts/work | 0 | 120 | 1.8 | ~80% get 0–3, rare spikes to 120 |
| quotes/work | 0 | 15 | 2.0 | Most get 0–1 |
| remarks/work | 0 | 10 | 2.0 | Most get 0 |
| items/shelf | 3 | 150 | 1.5 | Most 3–8, rare large collections |
| chapters/book | 5 | 1200 | 2.0 | Most 5–30, rare 500+ mega-books |
| shelf inclusions/work | 0 | 200 | 1.8 | Most in 0–5 shelves, popular works in many |

**Alternative considered**: Normal distribution with high variance — rejected because it doesn't produce the extreme outliers that stress-test the system.

### 2. Seed pipeline reordering

**Decision**: Reorder to seed posts before shelves, so ShelfItemReview can reference actual review posts.

**New pipeline order**:
```
Reset → Users + Entities → Tags → Works → Scores → Posts → Shelves + Realms → Chapters → Engagement → Zones → EchoKV
```

**Rationale**: Shelves need review posts to populate the `ShelfItemReview` junction table. Moving posts before shelves is the minimal change that fixes the data integrity issue. Zones are added at the end since they depend on works existing but have no downstream dependents.

### 3. Batch insert strategy

**Decision**: Use two-phase `createMany` pattern (Units first, then translations/extensions) wherever the entity doesn't need the created ID for nested relations in the same transaction.

**Applies to**:
- **Entity seed** (person + organization): Currently sequential `for` loop with `prisma.unit.create`. Convert to batch `createMany` for Units, then batch `createMany` for Entity extensions and UnitTranslation rows.
- **Chapter seed**: Currently sequential creates per chapter. For mega-books (500+ chapters), batch into `createMany` chunks.
- **Post seed**: Already uses `chunkedParallel` but with individual `create`. For works with 50+ posts, use `createMany` for the Unit rows then batch the Post extension rows.

**Pattern** (already proven in `tags.ts`):
```
Phase 1: prisma.unit.createMany({ data: units })
Phase 2: prisma.unitTranslation.createMany({ data: translations })
Phase 3: prisma.<extension>.createMany({ data: extensions })
```

**Keeps individual create for**: Shelves (need ShelfItem + ShelfItemReview in same flow), Realms (complex nested member creation).

**Alternative considered**: Raw SQL `INSERT ... VALUES` — rejected as it bypasses Prisma's type safety and migration tracking for marginal performance gain.

### 4. Zone seed design

**Decision**: Create a new `zones.ts` module that generates Zone units with varied templates, filter configurations, and temporal states.

**Zone variety**:
- Templates: `featured-carousel`, `trending-grid`, `seasonal-banner`, `topic-spotlight`, `new-releases`
- Filters: JSON objects referencing content types, tags, date ranges, or specific work IDs
- Temporal states: ~40% always-active (no dates), ~30% currently-active (startsAt in past, endsAt in future), ~20% scheduled (startsAt in future), ~10% expired (endsAt in past)
- Styling: Optional JSON with theme colors, layout variants

**Scale**: ~30–50 zones (zones are curated, not user-generated, so volume is modest).

### 5. Config restructure

**Decision**: Replace fixed `reviewsPerWork` / `treePostsPerWork` counts with power-law distribution parameters in `SeedCounts`. Keep env var overrides for total counts (books, games, media) but distribution shape is code-defined.

**New config shape**:
```typescript
interface SeedCounts {
  users: number;
  tags: number;
  books: number;
  games: number;
  media: number;
  shelves: number;
  realms: number;
  zones: number;
  personEntities: number;
  organizationEntities: number;
  followsPerUser: number;
  bookmarksPerUser: number;
  // Distribution params replaced by powerLaw calls in each seeder
}
```

Per-work counts are removed from config because they're now determined by the power-law function at seed time. The total generated count is emergent from `sum(powerLaw(...) for each work)`.

### 6. Entity enrichment approach

**Decision**: Extend entity seed to generate multi-language translations (using existing `generateTranslations` infrastructure) and add descriptions. Add ~5% `verified: true` entities.

**For descriptions**: Person entities get a short bio-style description. Organization entities get a company-description-style text. Both use the curated text corpus `getSummaryPool()` for the description field.

**Multi-language**: Entities currently pick a single random locale. Change to: pick a primary locale (weighted as before), then use `generateTranslations`-style probability for additional languages. Each additional language gets a locale-appropriate name from faker + a description from the corpus.

## Risks / Trade-offs

**[Seed time increase]** → 10x data volume will significantly increase seed runtime. Mitigation: batch inserts, chunked parallelism (already in place), and the acceptance that seed is a dev-only tool where minutes are tolerable.

**[Power-law randomness]** → Each seed run produces different distributions, making exact reproducibility harder. Mitigation: `faker.seed()` can be used for deterministic runs if needed. The distribution parameters are tuned to always produce a realistic spread.

**[Chapter mega-books]** → A single book with 1000+ chapters creates thousands of Unit rows. Mitigation: batch `createMany` for chapters; the probability is low (~3% of books, so ~30 books out of 1000, most of those in the 100–500 range, with only 1–3 reaching 1000+).

**[Memory pressure]** → Holding 3000+ work objects in memory for the post/shelf seed phases. Mitigation: only hold `{ id, type }` tuples (already the case with `CreatedUnit`), which is lightweight.
