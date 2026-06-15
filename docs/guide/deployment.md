# Deployment Guide

Production is deployed as **independent units** — each backend service, each
worker role, each piece of infrastructure, and the static frontends all deploy
and scale on their own lifecycle. Backends run as Docker images scheduled by
[Nomad](https://www.nomadproject.io/) over GHCR; the frontends are static Vite
SPAs on Cloudflare Pages. Secrets are managed with SOPS + age, synced to Nomad
Variables at deploy time.

## Topology

```text
GitHub Actions
  ├─ build-images.yml ──────────────────► GHCR (immutable git-SHA tags)
  ├─ deploy-production.yml (approved) ───► bin/nomad-deploy over SSH tunnel
  ├─ deploy-infra.yml (approved) ────────► nomad job run (infra jobs)
  └─ deploy-frontend.yml ───────────────► Cloudflare Pages (app, admin)

production host (Nomad)
  Caddy (TLS reverse proxy)
    → server, auth, notify, reaction        (public/proxied)
    → history                               (internal-proxied)
  ranking, job-runner-http, job-runner-worker,
  ranking-worker                            (internal; Nomad service discovery)
  infra jobs: postgres (db-per-service), meilisearch, rustfs,
              sequin (2 CDC sources), otel-collector (opt-in)
```

## One command

```bash
bin/nomad-deploy <git-sha>   # secrets → infra → configs → migrate → services → workers → backfill
```

See `nomad/jobs/` for the per-unit job definitions.

## Reference

- [Production Runtime Inventory](../reference/production-runtime-inventory.md)
- [Production Env and Secrets](../reference/production-env-and-secrets.md)

## Runbooks

- [Bootstrap](../operations/production-bootstrap.md) — first-time host prep.
- [Release](../operations/production-release.md) — promote and roll out a revision.
- [Rollback](../operations/production-rollback.md) — per-tier rollback.
- [Troubleshooting](../operations/production-troubleshooting.md) — logs, health,
  migrations, proxy, CDC slot lag, worker queues.
- [age Key Management](../operations/age-key-management.md) — SOPS bootstrap,
  rotation, break-glass.
