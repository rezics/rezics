# Production Bootstrap Runbook

One-time preparation of a fresh production host before the first deploy.
Production runs as independent Nomad jobs (Docker images on a VPS) with secrets
in SOPS + age synced to Nomad Variables. See `nomad/jobs/` for the job
definitions.

## 1. Host prep

- Provision a Linux host (amd64) with Docker and Nomad installed.
- Open only the public proxy ports (80/443). Postgres/Meili/Sequin bind to
  `127.0.0.1` and are reached over the Nomad network, not the public interface.
- Install `sops` and `nomad` CLI where deploys run (CI runner or operator
  laptop).

## 2. Registry credentials (GHCR)

- Create a GHCR token with `read:packages` (host pulls) and grant CI
  `packages: write` (push).
- `GHCR_TOKEN` is stored in the SOPS-encrypted `common.enc.env` and synced to
  Nomad Variables.

## 3. age key + SOPS secrets

Follow [age key management](./age-key-management.md) to generate the key and
encrypt each `config/secrets/<unit>.enc.env`. The deploy runner needs
`SOPS_AGE_KEY` (or `SOPS_AGE_KEY_FILE`) to decrypt and sync to Nomad.

## 4. Infrastructure jobs

Boot the self-hosted infra units (idempotent):

```bash
bin/nomad-deploy <git-sha> infra
# or individually:
nomad job run nomad/jobs/infra-postgres.nomad.hcl
nomad job run nomad/jobs/infra-meilisearch.nomad.hcl
nomad job run nomad/jobs/infra-sequin.nomad.hcl
nomad job run nomad/jobs/infra-rustfs.nomad.hcl
nomad job run nomad/jobs/infra-otel.nomad.hcl
```

- **PostgreSQL (`infra-postgres`)** — one instance, database-per-service. On
  first boot, init scripts create `rezics_server`, `rezics_auth`,
  `rezics_notify`, `rezics_reaction`, `rezics_history`, `rezics_ranking`, and
  `rezics_job`.
- **Meilisearch (`infra-meilisearch`)** — `MEILI_MASTER_KEY` from Nomad
  Variables.
- **Sequin (`infra-sequin`)** — two sources (main + reaction) defined in
  `package/job-runner/sequin/sequin.yml`; each owns its own publication and
  replication slot. Confirm both slots are active before enabling workers.
- **OTel Collector (`infra-otel`)** — opt-in. When absent, services still emit
  JSON logs.

## 5. Reverse proxy (TLS)

Configure Caddy (or equivalent) to route public hosts (`api`, `auth`, `notify`,
`reaction`) with TLS. Point DNS at the host.

## 6. First deploy

```bash
bin/nomad-deploy <git-sha>   # secrets → infra → configs → migrate → services → workers → backfill
```

Then deploy the frontends (after backends — see
[release runbook](./production-release.md)).

## Verification

- `nomad job status <job>` shows running allocations for each service.
- `/health` and `/ready` return 200 on each backend.
- Both Sequin replication slots report active with low lag (see
  [troubleshooting](./production-troubleshooting.md)).
