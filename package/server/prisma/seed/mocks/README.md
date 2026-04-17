# Mock Seed Module

Generates development data for the Library.Book platform. Uses a power-law
distribution for per-work engagement so most works get minimal activity and a
few get extreme activity, matching real-world forum behavior.

## Pipeline Order

1. Reset
2. Users + People + Organizations (parallel)
3. Tags
4. Books + Games + Media (parallel)
5. Realms (needed by Scores)
6. Scores (needs realms + works)
7. Posts (power-law per work, needs scores)
8. Shelves (needs review posts — bug-fix ordering)
9. Chapters + BookIndex (power-law per book)
10. Engagement (follows + bookmarks)
11. Zones (needs works + tags)
12. EchoKV

## Default Counts

| Key | Default | Env Var |
|-----|---------|---------|
| users | 200 | `SEED_USERS` |
| tags | 400 | `SEED_TAGS` |
| books | 1000 | `SEED_BOOKS` |
| games | 1000 | `SEED_GAMES` |
| media | 1000 | `SEED_MEDIA` |
| shelves | 500 | `SEED_SHELVES` |
| realms | 20 | `SEED_REALMS` |
| zones | 40 | `SEED_ZONES` |
| personEntities | 800 | `SEED_PERSON_ENTITIES` |
| organizationEntities | 200 | `SEED_ORGANIZATION_ENTITIES` |
| followsPerUser | 5 | `SEED_FOLLOWS_PER_USER` |
| bookmarksPerUser | 8 | `SEED_BOOKMARKS_PER_USER` |

## Distribution Model

Per-work and per-shelf counts are drawn from `powerLaw(min, max, alpha)` in
`utils.ts`. Larger alpha = heavier skew toward the minimum.

| Domain | min | max | α | Shape |
|--------|-----|-----|---|-------|
| reviews/work | 0 | 50 | 1.8 | Most 0–2, rare spikes to 50 |
| tree posts/work | 0 | 120 | 1.8 | Most 0–3, rare spikes to 120 |
| quotes/work | 0 | 15 | 2.0 | Most 0–1 |
| remarks/work | 0 | 10 | 2.0 | Most 0 |
| items/shelf | 3 | 150 | 1.5 | Most 3–8, rare 50+ |
| chapters/book | 5 | 1200 | 2.0 | Most 5–30, rare 500+ mega-books |

## Performance

- Entity seed (person + organization) uses two-phase `createMany` batches.
- Chapter seed switches to batch `createMany` when a book has >50 chapters.
- Post seed switches to batch `createMany` when a work has >20 posts of a given kind.
- Attributions and `UnitTag` links are accumulated across each work seeder and
  flushed in a single batched `createMany` per seeder.
- Batch sizes cap at 500 rows per `createMany` call.

## Running

```bash
cd package/server
bun run seed

# Override counts via env vars
SEED_BOOKS=50 SEED_GAMES=50 SEED_MEDIA=50 bun run seed
```
