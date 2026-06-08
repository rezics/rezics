# Production Release Runbook

A release promotes an immutable image revision and rolls it out unit-by-unit.
Backends roll out before frontends so the API contract a new bundle expects
already exists.

## 1. Image promotion

- `build-images.yml` builds and pushes `ghcr.io/rezics/rezics-<svc>:<sha>`
  runtime images and `…-<svc>-migrate:<sha>` build-stage images on push to
  `dev`. Releases never rebuild — they deploy an existing `<sha>`.

## 2. Env validation gate

```bash
bin/deploy <sha> validate     # decrypts SOPS, asserts every required secret present
```

Missing/empty required secrets fail here, **before** any service is mutated.

## 3. Migration jobs

```bash
bin/deploy <sha> migrations
```

One-shot jobs run from the `…-migrate:<sha>` image (the slim runtime images
carry only the compiled binary). A failure aborts the release before service
rollout.

### Migration order and forward-compatibility

Migrations follow database ownership; `ranking` is parallel-safe:

```text
auth      → package/auth     db:deploy
server    → package/server   db:deploy
notify    → package/notify   db:deploy
reaction  → package/reaction db:deploy
history   → package/history  db:deploy
ranking   → package/ranking  db:deploy       (no cross-service ordering)
job       → package/job-runner db:ensure     (pg-boss queue prep, no schema)
```

- **Forward-compatible only.** Because frontends and backends deploy on
  independent lifecycles and rollout is per-unit, each migration MUST be safe
  against the previous app version still running (additive columns, nullable or
  defaulted, no destructive renames in the same release as the code that needs
  them). Split breaking changes across two releases (expand → migrate code →
  contract).
- **Staging dry-run** any migration that is not purely additive.

## 4. Service rollout

```bash
bin/deploy <sha> services     # server, auth, notify, reaction, history, ranking
```

kamal-proxy health-gates each swap on `/health`; an unhealthy new container is
not promoted and the previous one keeps serving.

## 5. Worker rollout

```bash
bin/deploy <sha> workers      # job-runner (http) + job-runner-worker + ranking-worker
```

Worker units scale independently of HTTP services (replica count + `WORKERS`).

## 6. Search Meili index refresh

After search document-shape or index-settings changes, check the admin status
page or `GET /meili/status` for drift before opening the frontend rollout.
Language-resolution releases that add `languages` or `isLanguageNeutral`
filtering must refresh these root/admin operations in order:

```text
POST /meili/content/init
POST /meili/posts/init
POST /meili/polls/init
POST /meili/realms/init

POST /meili/content/sync
POST /meili/posts/sync
POST /meili/polls/sync
POST /meili/realms/sync
```

Federated search sections read from those same indexes, so no separate
federated index exists to backfill. Re-check `GET /meili/status` after the syncs
and confirm the affected indexes have no settings drift or failed Meili tasks.

## 7. Ranking Meili backfill

After ranking-relevant schema or index-settings changes:

```bash
bin/deploy <sha> backfill     # enqueues ranking.fullSync (idempotent)
```

## 8. Preview and Edge

Deploy `@rezics/preview` with the backend service wave before public edge
routing points at it. Use read-only `DATABASE_URL`, Meilisearch access, and
`PREVIEW_INTERNAL_SECRET`.

After `@rezics/app` is built and deployed, deploy `@rezics/edge` with Wrangler:

```bash
task edge:deploy
```

The Worker needs `PREVIEW_BASE_URL` and `PREVIEW_INTERNAL_SECRET`. Route changes
should happen after the preview origin is healthy so bot traffic can be proxied
without affecting human SPA traffic.

## 9. Frontends (Cloudflare)

Run `deploy-frontend.yml` (or `wrangler pages deploy`) for `app` and `admin`
**after** backends and preview. `VITE_*` are build-time public config.

## Release logs

`kamal deploy` output records the image tag, rollout targets, healthcheck
results, and (via the migration step) migration status — capture it with the
workflow run for audit.

## Rollback limitations

- Service/worker rollback is immediate (previous image tag) — see the
  [rollback runbook](./production-rollback.md).
- **Database rollback is not automatic.** Forward-only migrations must be
  reverted with a documented manual down-migration if needed.
- **Ranking recovers by recompute, not DB restore:** wipe + `ranking.fullSync`
  rather than restoring the ranking database.
