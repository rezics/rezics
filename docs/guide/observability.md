# Backend Observability

Rezics backend services keep package-owned Elysia entrypoints. Shared
observability lives in `@rezics/shared/observability` because it is a reusable
runtime helper, not a service bootstrap. Each package still owns its route
mounting, CORS policy, port, OpenAPI choice, readiness behavior, and worker
role behavior.

## Service Inventory

| Service | Entrypoint | OpenAPI | Health | Readiness | Notes |
| --- | --- | --- | --- | --- | --- |
| Main server | `package/server/src/index.ts` | Development only at `/openapi` | `/health` | None | Owns route composition and startup cache hydration. |
| Auth | `package/auth/src/index.ts` | Development only at `/openapi` | `/health` | None | Keeps `coreInstance()` ownership and auth route mounting. |
| Reaction | `package/reaction/src/index.ts` | `/openapi` | `/health` | None | Keeps reaction and internal APIs. |
| History | `package/history/src/index.ts` | `/openapi` | `/health` | `/ready` | Keeps outbox poller fallback behavior. |
| Notify | `package/notify/src/index.ts` | `/openapi` | `/health` | None | Keeps production Rezics origin predicate. |
| Job runner HTTP role | `package/job-runner/src/index.ts` | `/openapi` | `/health` | `/ready` | Worker role startup and shutdown remain explicit. |
| Preview | `package/preview/src/index.ts` | Development only at `/openapi` | `/health` | None | Retained service now uses the shared timing plugin. |

Before this standardization, `server`, `auth`, and `preview` used local
request timing hooks and console monkey patches. Other services used
package-specific startup banners and did not share request timing behavior.

## Metadata Shape

Each service passes this metadata to the shared helper:

- `key`: stable service key such as `server` or `job-runner`
- `displayName`: human-readable service name for logs and startup output
- `environment`: runtime environment
- `port`: HTTP listen port
- `serviceUrl`: optional externally visible URL; defaults to
  `http://localhost:<port>`
- `openApiPath`: OpenAPI UI path when enabled
- `healthPath`: health route when available
- `readyPath`: readiness route when available
- `slowRequestThresholdMs`: request duration threshold for slow classification

## Runtime Settings

Backend service env files validate these optional values:

| Variable | Purpose |
| --- | --- |
| `OBSERVABILITY_LOG_FORMAT` | `local` or `json`; defaults to JSON in production and local text otherwise. |
| `OBSERVABILITY_COLOR` | Enables or disables ANSI color in local text output. |
| `OBSERVABILITY_SLOW_REQUEST_MS` | Slow request threshold in milliseconds. |
| `OBSERVABILITY_TELEMETRY` | `auto`, `disabled`, `enabled`, or `required`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP endpoint used when telemetry export is enabled. |

If `OTEL_EXPORTER_OTLP_ENDPOINT` is omitted, application startup continues with
telemetry export disabled. If telemetry initialization fails, startup continues
unless `OBSERVABILITY_TELEMETRY=required`.

## Log Contract

Local mode emits concise text for startup, requests, slow requests, and errors.
Production mode emits newline-delimited JSON without ANSI escape sequences.
Structured request/error records include stable service, environment, request,
route/path, status, duration, slow flag, request id, and trace correlation
fields when an active OpenTelemetry span exists.

Cookies, authorization headers, internal secret headers, tokens, secrets, and
password-like fields are redacted by shared helpers before structured output.

## OpenTelemetry Boundary

Application services use OpenTelemetry and OTLP as the telemetry contract. They
do not import ClickStack, HyperDX, SigNoz, Grafana, or other backend-specific
SDKs. Operators can replace the analysis backend by changing collector,
deployment, or env configuration without changing service code.

The repo-managed local stack includes an opt-in Collector/ClickStack smoke
profile:

```bash
docker compose -p rezics-dev-external-services -f tool/dev-external-services/compose.yml --profile observability up -d clickstack otel-collector
```

The OpenTelemetry Collector receives OTLP on `4317` and `4318` and exports to
ClickStack through `CLICKSTACK_OTLP_ENDPOINT`. ClickStack all-in-one is pinned
for local/evaluation use and exposes the HyperDX UI on `8080`.

For persistent production operations, prefer separated ClickStack/ClickHouse
and Collector services over the all-in-one image. Keep the application boundary
as OTLP so an OTLP-compatible backend can replace ClickStack later.
