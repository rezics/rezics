# 部署指南

Production 以**獨立單元**部署：每個 backend service、每個 worker role、每個
infrastructure 元件，以及 static frontends，都有自己的部署與擴縮 lifecycle。
Backends 以 Docker images 執行，由 [Nomad](https://www.nomadproject.io/) 透過
GHCR 排程；frontends 是部署在 Cloudflare Pages 上的 static Vite SPAs。Secrets
使用 SOPS + age 管理，並在 deploy time 同步到 Nomad Variables。

## Topology

```text
GitHub Actions
  ├─ build-images.yml ──────────────────► GHCR (immutable git-SHA tags)
  ├─ deploy-production.yml (approved) ───► deploy/bin/nomad-deploy over SSH tunnel
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

## 一條命令

```bash
deploy/bin/nomad-deploy <git-sha>   # secrets → infra → configs → migrate → services → workers → backfill
```

Nomad-pack production templates 見 `deploy/prod/`。

## Reference

- [Production Runtime Inventory](/reference/production-runtime-inventory.md)
- [Production Env and Secrets](/reference/production-env-and-secrets.md)

## Runbooks

- [Bootstrap](/operations/production-bootstrap.md) — first-time host prep.
- [Release](/operations/production-release.md) — promote and roll out a revision.
- [Rollback](/operations/production-rollback.md) — per-tier rollback.
- [Troubleshooting](/operations/production-troubleshooting.md) — logs, health,
  migrations, proxy, CDC slot lag, worker queues.
- [age Key Management](/operations/age-key-management.md) — SOPS bootstrap,
  rotation, break-glass.
