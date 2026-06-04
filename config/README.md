# Production Deployment Config (Kamal + SOPS)

Production is orchestrated with [Kamal](https://kamal-deploy.org) over GHCR
images, with secrets in SOPS + age. Every backend service, worker role, and
piece of infrastructure is its own deployable unit; the frontends deploy to
Cloudflare and are not covered here.

> Hostnames/IPs in these files are placeholders (`203.0.113.10`, `*.rezics.example`)
> and MUST be replaced for a real host.

## Layout

| File | Unit |
|---|---|
| `deploy.yml` | Shared base: registry, SSH, builder, shared env, infra accessories |
| `deploy.server.yml` | `server` — public API (proxied, TLS) |
| `deploy.auth.yml` | `auth` — public auth (proxied, TLS) |
| `deploy.notify.yml` | `notify` — notifications (proxied; frontend endpoint) |
| `deploy.reaction.yml` | `reaction` — reactions (proxied; frontend endpoint) |
| `deploy.history.yml` | `history` — reading history (internal-proxied) |
| `deploy.ranking.yml` | `ranking` — internal-only (no proxy, no public CORS) |
| `deploy.job-runner.yml` | `job-runner` — HTTP intake (Sequin webhooks + enqueue API) |
| `deploy.job-runner-worker.yml` | `job-runner-worker` — default lanes (search/history/maintenance) |
| `deploy.ranking-worker.yml` | `ranking-worker` — dedicated ranking lane only |

The three `job-runner`* units share one image (`rezics/rezics-job-runner`),
role-switched by `JOB_RUNNER_ROLE` / `JOB_WORKER_LANES`, and deploy/scale
independently.

Infrastructure accessories (in `deploy.yml`): `postgres` (infra-db,
database-per-service), `meilisearch` (infra-search), `sequin` + `sequin-postgres`
+ `sequin-redis` (infra-cdc, two sources: main + reaction), `otel-collector`
(infra-observability, opt-in).

## Routing

- Public (kamal-proxy, TLS): `server`, `auth`, `notify`, `reaction`.
- Internal-proxied: `history` (server-to-server only).
- Internal (container DNS only, no proxy): `ranking`, all `job-runner` roles.

## Secrets (SOPS + age)

Per-unit encrypted env files live in `config/secrets/<unit>.enc.env`; shared and
infra secrets in `config/secrets/common.enc.env`. `.kamal/secrets-common` and
`.kamal/secrets.<unit>` decrypt them at deploy time and surface them to Kamal.

Bootstrap:

```bash
age-keygen -o sops-age.key                 # gitignored; store the PRIVATE key safely
# put the PUBLIC key (age1...) into .sops.yaml `age:`
cp config/secrets/common.env.example config/secrets/common.enc.env
$EDITOR config/secrets/common.enc.env      # fill values
sops --encrypt --in-place config/secrets/common.enc.env
# repeat for each <unit>.enc.env
export SOPS_AGE_KEY_FILE=$PWD/sops-age.key  # on CI runner / operator host
```

Only encrypted `*.enc.env` are committed; plaintext and the age private key are
gitignored. Rotate recipients with `sops updatekeys config/secrets/*.enc.env`.

## Deploy

Images are built and pushed to GHCR by CI on push to `dev`; deploy pulls the
immutable git-SHA tag and never rebuilds.

```bash
bin/deploy <git-sha>            # full sequence: validate → infra → migrate → services → workers → backfill
bin/deploy <git-sha> validate   # secret-presence gate only (fails before any mutation)
bin/deploy <git-sha> migrations  # one-shot Drizzle migrations / db:ensure
bin/deploy <git-sha> services    # backend HTTP services
bin/deploy <git-sha> workers     # job-runner web + worker + ranking-worker
bin/deploy <git-sha> backfill    # ranking Meili full-sync

# single unit:
kamal deploy -d ranking --version <sha> --skip-push
kamal deploy -d ranking-worker --version <sha> --skip-push   # scale ranking lane alone
```

Migrations run from the build-stage migrate image
(`ghcr.io/rezics/rezics-<unit>-migrate:<sha>`, built with `--target build`)
because the slim runtime images carry only the compiled binary. Migration order
follows database ownership; `ranking` is parallel-safe and `job-runner` runs
`db:ensure` instead of schema migrations.

See `docs/reference/production-runtime-inventory.md` and
`docs/reference/production-env-and-secrets.md` for the per-unit contract, and the
runbooks under `docs/` for bootstrap/release/rollback/troubleshooting.
