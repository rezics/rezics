# @rezics/ranking

Ranking owns Unit rank projections and patches sortable ranking fields into
Meilisearch serving indexes.

## Local Setup

Create an env file:

```bash
cp package/ranking/.env.example package/ranking/.env
```

Required runtime env:

- `RANKING_DATABASE_URL`: dedicated ranking PostgreSQL database.
- `SERVER_DATABASE_URL`: main server database for current-state reads.
- `REACTION_BASE_URL` and `REACTION_INTERNAL_SECRET`: reaction service boundary
  for current summary reads.
- `MEILI_HOST` and `MEILI_MASTER_KEY`: Meilisearch serving projection target.

Run migrations:

```bash
bun --filter=@rezics/ranking run prisma:migrate
```

## Meili Rollout

Ranking adds sortable fields to existing `content` and `posts` indexes:

- `content`: `hotScore`, `topScore`, `trendingScore`, `qualityScore`
- `posts`: `hotScore`, `topScore`, `trendingScore`, `qualityScore`,
  `commentHotScore`, `commentTopScore`, `commentQualityScore`

Apply Meili settings with the normal search index initialization path, then run
a ranking full sync so stored projections patch serving documents:

```bash
curl -X POST http://localhost:3006/ranking/command \
  -H 'content-type: application/json' \
  -d '{"kind":"ranking.fullSync","lane":"ranking","payload":{"limit":100},"idempotencyKey":"ranking.fullSync:_","source":{"type":"maintenance","reason":"initial backfill"},"tags":["domain:ranking","effect:fullSync","source:maintenance"]}'
```

If the response includes `nextCursor`, enqueue or POST the returned
`continuation` command until no cursor remains.

## Repair

Recompute one Unit:

```bash
curl -X POST http://localhost:3006/ranking/recompute/<unitId>
```

Inspect stored projections:

```bash
curl http://localhost:3006/ranking/projection/<unitId>
```

Patch Meili again from stored projections:

```bash
curl -X POST http://localhost:3006/ranking/command \
  -H 'content-type: application/json' \
  -d '{"kind":"ranking.patchServing","lane":"ranking","payload":{"unitId":"<unitId>"},"idempotencyKey":"ranking.patchServing:<unitId>","source":{"type":"manual","reason":"repair"},"tags":["domain:ranking","effect:patchServing","source:manual"]}'
```

## Rollback

Disable ranking CDC routing in `package/job-runner/src/sequin/router.ts` and
stop requesting ranking sort fields from clients. The additive Meili fields and
ranking database tables can remain in place for inspection and later repair.
