## Context

Rezics has several Bun/Elysia backend services that are independently composed:
`package/server`, `package/auth`, `package/reaction`, `package/history`,
`package/notify`, `package/job-runner`, and possibly `package/preview`. This is
the right ownership model because each service has its own routes, CORS policy,
port, readiness semantics, cluster/worker behavior, and package-specific
startup work.

The problem is not distributed runtime ownership. The problem is duplicated and
inconsistent observability behavior inside those distributed entrypoints:

- `server` and `auth` duplicate a development-only `logger-hook` that monkey
  patches `console` and colorizes string-matched output.
- `server` and `auth` have request timing traces only in development.
- `reaction`, `history`, `notify`, and `job-runner` use different startup
  banners and have no shared request timing convention.
- Production logging has no stable structured format, no trace correlation
  contract, and no analysis backend target.
- Local Docker service images include old baselines such as PostgreSQL 16 and
  Meilisearch v1.13 even though local development services may be recreated.

The active production deployment foundation change is already defining service
images, health checks, deployment units, and runbooks. This change complements
that work by defining what each service emits and how telemetry flows; it does
not redefine deployment ownership.

## Goals / Non-Goals

**Goals:**

- Keep each backend service entrypoint distributed and package-owned.
- Provide shared observability middleware/helpers that every Elysia service can
  adopt.
- Standardize local startup banners, OpenAPI URL announcements, request timing,
  slow request output, and error output.
- Standardize production logs as structured JSON records.
- Use OpenTelemetry and OTLP as the application telemetry contract.
- Recommend ClickStack as the default self-hosted open-source analysis backend.
- Update local development Docker image baselines to pinned current versions,
  including PostgreSQL 18.4.

**Non-Goals:**

- Do not replace package-owned runtime entrypoints with one centralized service
  bootstrap.
- Do not force all services to enable OpenAPI in the same environments.
- Do not require ClickStack or OpenTelemetry Collector for ordinary local app
  development.
- Do not use floating Docker tags such as `latest`.
- Do not preserve local Docker volumes across major service upgrades.

## Decisions

### Decision: shared middleware/helpers, not shared runtime

Each service will keep its own `src/index.ts` and any package-specific
`src/cluster.ts` or worker entrypoint. A shared observability module will expose
small Elysia plugins/helpers that can be installed by package entrypoints.

Target shape:

```text
package/server/src/index.ts
package/auth/src/index.ts
package/reaction/src/index.ts
package/history/src/index.ts
package/notify/src/index.ts
package/job-runner/src/index.ts
        │
        └─ use shared observability middleware/helpers
             ├─ request timing
             ├─ structured production logs
             ├─ local color formatting
             ├─ startup banner rendering
             ├─ error log helper
             └─ OpenTelemetry setup/export
```

Rationale: service runtime ownership is a valid architectural boundary. The
shared part is the observable contract, not app composition.

Alternatives considered:

- **Central runtime bootstrap:** rejected because it would couple unrelated
  service composition, CORS, readiness, worker, and startup concerns.
- **Keep per-service logger hooks:** rejected because duplicated regex-based
  console patching will keep drifting and is unsuitable for production logs.

### Decision: structured production logs, colored local logs

The middleware will separate local and production outputs:

- Local development emits readable text with optional ANSI color formatting.
- Production emits newline-delimited JSON records.

Production request logs will include stable fields such as timestamp, level,
service name, environment, method, route, path, status, duration, slow flag,
request id, trace id, span id, and optional error fields. Local logs may render
the same event data as concise colored text.

Rationale: local developers need quick visual scanning, while production needs
machine-readable logs for Docker, Collector, and ClickStack ingestion.

Alternatives considered:

- **Always colorize console output:** rejected because ANSI output is poor for
  production log pipelines.
- **Adopt a full logger framework immediately:** deferred. A small structured
  logger API is enough for this change and avoids adding abstraction before the
  telemetry boundary is stable.

### Decision: OpenTelemetry is the telemetry contract, not the backend

Services will emit OpenTelemetry telemetry through OTLP where enabled.
OpenTelemetry Collector receives/processes/exports telemetry but does not store
or analyze it. Application code must depend on OTLP configuration, not on
ClickStack-specific APIs.

Target flow:

```text
Elysia service
  └─ shared observability middleware
      └─ OTLP traces / metrics / logs where enabled
          └─ OpenTelemetry Collector
              └─ ClickStack
                  ├─ ClickHouse storage
                  └─ HyperDX UI
```

Rationale: OTLP keeps Rezics backend services portable. The backend can be
ClickStack today and still be replaceable with SigNoz, Grafana, OpenSearch, or
another OTLP-compatible backend later.

Alternatives considered:

- **Direct ClickStack/HyperDX SDK integration:** rejected because it couples
  application code to one backend.
- **SigNoz as the default backend:** viable, but ClickStack is preferred for
  this project because it is modern, Docker-friendly, OTel-native, backed by
  ClickHouse, and has permissive licensing for the relevant components.
- **Grafana LGTM as the default backend:** viable but heavier to operate as a
  composed stack of Loki, Tempo, Prometheus/Mimir, Pyroscope, Grafana, and
  Alloy.

### Decision: ClickStack is the recommended self-hosted backend

ClickStack will be documented as the default recommended analysis backend for
self-hosted development/staging/production observability. The implementation
will keep app-level configuration generic through OTLP.

Recommended baseline:

- ClickStack all-in-one image for smoke/local evaluation:
  `hyperdx/hyperdx-all-in-one:2.27.0`.
- OpenTelemetry Collector contrib image:
  `otel/opentelemetry-collector-contrib:0.153.0`.
- If ClickHouse is deployed separately:
  `clickhouse:26.5.1.882-jammy`.

Production deployment assets should prefer separated services over all-in-one
once persistent operations matter. All-in-one is acceptable for local smoke
testing and early evaluation.

### Decision: local infrastructure images are upgraded in-place by config

Because Rezics is in development and local service state can be recreated,
`tool/external-services` should move directly to pinned current usable versions
unless validation discovers a concrete incompatibility.

Baseline image targets as of this proposal:

| Service | Image baseline |
| --- | --- |
| Source PostgreSQL | `postgres:18.4-trixie` or `postgres:18.4` |
| Sequin state PostgreSQL | `postgres:18.4-trixie` or `postgres:18.4` |
| Meilisearch | `getmeili/meilisearch:v1.45.0` |
| Sequin | `sequin/sequin:v0.14.6` |
| Sequin Redis | `redis:8.8.0-alpine` or `redis:8.8.0` |
| OpenTelemetry Collector | `otel/opentelemetry-collector-contrib:0.153.0` |
| ClickStack all-in-one | `hyperdx/hyperdx-all-in-one:2.27.0` |

The implementation may choose the Debian-based PostgreSQL tag over Alpine when
extension, locale, shell, or operational compatibility matters.

Rationale: local development should exercise the same major versions that
production is expected to use. Old local baselines hide integration risk.

Alternatives considered:

- **Keep local PostgreSQL 16 for compatibility:** rejected because local data may
  be reset and the desired baseline is PostgreSQL 18.4.
- **Use floating major tags:** rejected because reproducibility matters even in
  development.

## Integration Points

- Shared observability module: implementation may place it in an existing shared
  workspace package or introduce a focused internal package if that keeps
  dependencies clear. Backend packages will import explicit file-suffixed
  cross-package modules according to repo convention.
- Backend service entrypoints: install request timing/logging middleware and use
  startup banner helpers after `app.listen`.
- Env validation: add optional observability env values per service or through a
  shared schema helper without leaking env dependencies from package public
  exports.
- Docker/local tooling: update `tool/external-services/compose.yml` and service
  health checks to current pinned image baselines.
- Production deployment foundation: align service logs, health checks, and
  OpenTelemetry/ClickStack deployment docs with the deployment units defined by
  the separate production deployment change.

## Risks / Trade-offs

- [Risk] Meilisearch v1.13 to v1.45 may expose behavior or settings changes.
  -> Mitigation: validate index creation, search health, seed sync, and admin
  Meili controls after the image update.
- [Risk] PostgreSQL major-version volume reuse will fail or behave incorrectly.
  -> Mitigation: document local volume reset as the expected path and avoid
  attempting in-place local data migration.
- [Risk] Production JSON log fields drift if services bypass the shared helper.
  -> Mitigation: add tests around formatter output and adopt the helper in all
  Elysia service entrypoints in the same change.
- [Risk] OpenTelemetry libraries may add startup overhead or fail when the
  collector is unavailable.
  -> Mitigation: make export opt-in by env, keep local defaults disabled, and
  ensure failed telemetry export does not fail ordinary service startup unless a
  deployment explicitly requires it.
- [Risk] ClickStack all-in-one is convenient but not the right long-term
  production topology.
  -> Mitigation: treat all-in-one as local/evaluation and document separated
  production deployment as the preferred path.

## Migration Plan

1. Add shared observability middleware/helpers and unit tests for local and
   production formatter behavior.
2. Adopt the shared helper in each Elysia HTTP service while preserving
   package-owned entrypoints.
3. Add optional OpenTelemetry env validation and OTLP export setup.
4. Update local external-services image tags to pinned current baselines.
5. Reset or recreate local Docker volumes as needed for PostgreSQL 18.4 and
   other major service upgrades.
6. Validate service startup banners, OpenAPI links, health checks, request logs,
   slow request logs, and error logs across services.
7. Add ClickStack/Collector local smoke configuration or docs if implementation
   scope includes observability backend bootstrapping.
8. Coordinate production deployment docs with the active deployment foundation
   change.

Rollback strategy:

- Application middleware adoption can be reverted per service by removing the
  shared plugin use from that service entrypoint.
- Local external service image rollback requires recreating local volumes again
  if the downgraded service cannot read upgraded data directories.
- OpenTelemetry export can be disabled by env without changing service routes.

## Open Questions

- Should the shared observability helper live in a new `@rezics/observability`
  package, an existing shared package, or a backend-only internal package?
- Should production services enable OpenAPI routes, hide them, or keep the
  current per-service behavior? The banner helper can support all options, but
  the deployment policy should be explicit.
- Should ClickStack local smoke support be part of `tool/external-services` or a
  separate observability compose unit aligned with production deployment
  boundaries?
