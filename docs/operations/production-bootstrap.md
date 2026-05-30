# Production Bootstrap Runbook

One-time preparation of a fresh production host before the first deploy.
Production runs as independent Kamal units (Docker images on a VPS) with secrets
in SOPS + age; see [`config/README.md`](https://github.com/rezics/rezics/blob/dev/config/README.md)
for the unit topology.

## 1. Host prep

- Provision a Linux host (amd64) with Docker installed and an SSH user
  (`deploy`) with Docker access.
- Open only the public proxy ports (80/443). Postgres/Meili/Sequin bind to
  `127.0.0.1` (see accessory `port:` mappings) and are reached over the private
  Docker network, not the public interface.
- Install Kamal where deploys run (CI runner or operator laptop), not the host:
  `gem install kamal`.

## 2. Registry credentials (GHCR)

- Create a GHCR token with `read:packages` (host pulls) and grant CI
  `packages: write` (push).
- `KAMAL_REGISTRY_PASSWORD` is sourced from SOPS (`common.enc.env`); in CI it is
  the `GITHUB_TOKEN`.

## 3. age key + SOPS secrets

Follow [age key management](./age-key-management.md) to generate the key and
encrypt each `config/secrets/<unit>.enc.env`. The deploy runner needs
`SOPS_AGE_KEY` (or `SOPS_AGE_KEY_FILE`) to decrypt.

## 4. Infrastructure accessories

Boot the self-hosted infra units (idempotent, stable container names):

```bash
kamal accessory boot postgres
kamal accessory boot meilisearch
kamal accessory boot sequin-postgres
kamal accessory boot sequin-redis
kamal accessory boot sequin
# optional analysis backend:
kamal accessory boot otel-collector
```

- **PostgreSQL (`infra-db`)** — one instance, database-per-service. On first
  boot `infra/postgres/init/10-databases.sh` creates `rezics_server`,
  `rezics_auth`, `rezics_notify`, `rezics_reaction`, `rezics_history`,
  `rezics_ranking`, and `rezics_job`. Set `<SERVICE>_DB_PASSWORD` in the
  postgres accessory env to also create per-service owner roles.
- **Meilisearch (`infra-search`)** — `MEILI_MASTER_KEY` from SOPS.
- **Sequin (`infra-cdc`)** — two sources (main + reaction) defined in
  `package/job-runner/sequin/sequin.yml`; each owns its own publication and
  replication slot. Confirm both slots are active before enabling workers.
- **OTel Collector (`infra-observability`)** — opt-in. When absent, services
  still emit JSON logs to the container log stream.

## 5. kamal-proxy

`kamal-proxy` is installed automatically on first `kamal deploy` of a proxied
unit. Point DNS for the public hosts (`api`, `auth`, `notify`, `reaction`) at
the host; the proxy provisions TLS and health-gates swaps on `/health`.

## 6. First deploy

```bash
bin/deploy <git-sha>     # validate → infra → migrate → services → workers → backfill
```

Then deploy the frontends (after backends — see
[release runbook](./production-release.md)).

## Verification

- `kamal app details -d server` (and each unit) shows running containers.
- `/health` and `/ready` return 200 on each backend.
- Both Sequin replication slots report active with low lag (see
  [troubleshooting](./production-troubleshooting.md)).
