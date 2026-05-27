## Legacy Reference Audit

Command run:

```bash
rg "workUnitId|work-link|WorkLink|chapterUnitId|BookContentStructure|book\.contentStructure" package
```

Allowed temporary compatibility locations during this cutover:

- Historical Prisma migrations that create, backfill, or drop legacy storage.
- `WorkLinkClaim` Prisma model/client references until the underlying table is
  renamed or retired. Public contract, API, route, and notification names now
  use work membership claim terminology.
- Book/chapter product adapters where `$chapterId` and materialization APIs
  still name materialized content Unit ids for route compatibility.
- Archived or legacy history display tests that explicitly cover pre-cutover
  `book.contentStructure.batch` rows.

All generic runtime reads and writes should use `UnitWork`, `ownerUnitId`, and
`contentUnitId` only.
