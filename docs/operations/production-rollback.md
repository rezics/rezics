# Production Rollback Runbook

Rollback is per-unit and independent across the frontend, backend service,
worker, and infrastructure tiers.

## Frontend (Cloudflare)

- Re-run `deploy-frontend.yml` against the previous good commit, or roll back to
  a prior deployment in the Cloudflare Pages dashboard. Frontends are static and
  carry no migrations, so this is always safe and instant.

## Backend services

- Nomad deployments with `auto_revert = true` automatically roll back on failed
  health checks. For manual rollback, redeploy with the previous image tag:

  ```bash
  bin/nomad-deploy <previous-sha> services
  ```

- Or fail a specific deployment to trigger auto-revert:

  ```bash
  nomad deployment fail <deployment-id>
  ```

- Only the affected unit swaps; other services keep their current revision.

## Workers

- `job-runner-http`, `job-runner-worker`, and `ranking-worker` roll back
  independently from HTTP services:

  ```bash
  bin/nomad-deploy <previous-sha> workers
  ```

## Database

- **Not automatic.** Migrations are forward-only; a true schema rollback needs a
  documented manual down-migration. Prefer expand → contract so a code rollback
  alone is safe without touching the schema.
- **Ranking** is exempt: it is a rebuildable projection tier. Recover by wiping
  the ranking database/index fields and re-running `ranking.fullSync`
  (`bin/nomad-deploy <sha> backfill`) rather than restoring from backup.

## Infrastructure

- Infra rollback (Postgres/Meili/Sequin/Collector) is **manual and separated**
  from app rollback. Use `nomad job stop`/`nomad job run` and the
  [troubleshooting runbook](./production-troubleshooting.md); never couple an
  infra change to a routine app deploy.

## Decision order

1. Is it the frontend? Roll back Cloudflare — done.
2. Is it a backend/worker code regression? `bin/nomad-deploy <previous-sha>`.
3. Did a migration cause it? Roll back code if forward-compatible; otherwise
   apply the manual down-migration. For ranking, recompute.
4. Is it infra? Handle separately, with its own approval.
