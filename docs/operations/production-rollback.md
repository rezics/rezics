# Production Rollback Runbook

Rollback is per-unit and independent across the frontend, backend service,
worker, and infrastructure tiers.

## Frontend (Cloudflare)

- Re-run `deploy-frontend.yml` against the previous good commit, or roll back to
  a prior deployment in the Cloudflare Pages dashboard. Frontends are static and
  carry no migrations, so this is always safe and instant.

## Backend services

- Roll a single unit back to a previous image tag:

  ```bash
  kamal rollback -d <unit> --version <previous-sha>
  ```

- Only the affected unit swaps; other services keep their current revision.
  kamal-proxy health-gates the rollback swap the same way as a forward deploy.

## Workers

- `job-runner`, `job-runner-worker`, and `ranking-worker` roll back
  independently from HTTP services:

  ```bash
  kamal rollback -d ranking-worker --version <previous-sha>
  ```

## Database

- **Not automatic.** Migrations are forward-only; a true schema rollback needs a
  documented manual down-migration. Prefer expand → contract so a code rollback
  alone is safe without touching the schema.
- **Ranking** is exempt: it is a rebuildable projection tier. Recover by wiping
  the ranking database/index fields and re-running `ranking.fullSync`
  (`bin/deploy <sha> backfill`) rather than restoring from backup.

## Infrastructure

- Infra rollback (Postgres/Meili/Sequin/Collector) is **manual and separated**
  from app rollback. Use `kamal accessory` and the
  [troubleshooting runbook](./production-troubleshooting.md); never couple an
  accessory change to a routine app deploy.

## Decision order

1. Is it the frontend? Roll back Cloudflare — done.
2. Is it a backend/worker code regression? `kamal rollback -d <unit>`.
3. Did a migration cause it? Roll back code if forward-compatible; otherwise
   apply the manual down-migration. For ranking, recompute.
4. Is it infra? Handle separately, with its own approval.
