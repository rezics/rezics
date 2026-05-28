# Deployment Guide

Production is deployed as **independent units** — each backend service, each
worker role, each piece of infrastructure, and the static frontends all deploy
and scale on their own lifecycle. Backends run as Docker images on a host
orchestrated by [Kamal](https://kamal-deploy.org) over GHCR; the frontends are
static Vite SPAs on Cloudflare Pages. Secrets are managed with SOPS + age.

> The previous systemd + Nginx single-host path is retired. The authoritative
> deploy assets live in `config/` (Kamal) and `.github/workflows/`.

## Topology

```text
GitHub Actions
  ├─ build-images.yml ──────────────────► GHCR (immutable git-SHA tags)
  ├─ deploy-production.yml (approved) ───► kamal deploy over SSH
  └─ deploy-frontend.yml ───────────────► Cloudflare Pages (app, admin)

production host (Kamal units)
  kamal-proxy (TLS)
    → server, auth, notify, reaction        (public/proxied)
    → history                               (internal-proxied)
  ranking, job-runner, job-runner-worker,
  ranking-worker                            (internal; container DNS only)
  accessories: postgres (db-per-service), meilisearch,
               sequin + redis (2 CDC sources), otel-collector (opt-in)
```

## One command

```bash
bin/deploy <git-sha>   # validate → infra → migrate → services → workers → backfill
```

See [`config/README.md`](https://github.com/rezics/rezics/blob/dev/config/README.md)
for the per-unit config, routing, and secrets layout.

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
