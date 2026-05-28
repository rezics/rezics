# External Services

> **Local development only.** This Docker Compose project is a developer
> convenience for running source PostgreSQL, Meilisearch, Sequin (+ its state
> Postgres/Redis), and the optional observability stack on one machine. It is
> **not** the production deployment boundary and **not** a production topology.
> Production is deployed as independent units with Kamal + SOPS over GHCR — see
> [`config/README.md`](../../config/README.md) and the runbooks under `docs/`.
> The local single-project layout does not imply how production is split.

The managed local stack uses exact image tags for reproducibility:

| Service | Image |
| --- | --- |
| Source PostgreSQL | `postgres:18.4-trixie` |
| Meilisearch | `getmeili/meilisearch:v1.45.0` |
| Sequin | `sequin/sequin:v0.14.6` |
| Sequin state PostgreSQL | `postgres:18.4-trixie` |
| Sequin Redis | `redis:8.8-m03-alpine3.23` |
| OpenTelemetry Collector | `otel/opentelemetry-collector-contrib:0.153.0` |
| ClickStack all-in-one | `hyperdx/hyperdx-all-in-one:2.27.0` |

PostgreSQL major-version upgrades may not reuse existing local data
directories. This project is still in the development stage, so recreating
local volumes is the expected reset path when a managed image upgrade is
incompatible with existing data.

Reset local managed service volumes with:

```bash
docker compose -p rezics-external-services -f tool/external-services/compose.yml down -v
bun run service:up
```

The source PostgreSQL init scripts recreate local development databases on
first boot. Package Prisma migrations remain owned by the existing package
commands.

Run health checks after startup:

```bash
bun run service:health
bun run service:source:verify
```

For the optional observability smoke stack:

```bash
docker compose -p rezics-external-services -f tool/external-services/compose.yml --profile observability up -d clickstack otel-collector
```

Set application services to export to the local Collector with:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```
