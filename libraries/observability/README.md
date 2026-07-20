# `@rezics/observability`

Server-only OpenTelemetry and structured logging contract for REZICS. The package exports traces and metrics through standard OTLP/HTTP protobuf configuration and writes newline-delimited JSON logs to stdout/stderr. It has no Aspire or telemetry-backend dependency.

## Bootstrap contract

Initialize before importing Elysia, PostgreSQL, storage, or worker modules:

```ts
import { initializeObservability } from "@rezics/observability";

const observability = initializeObservability({
	service: {
		name: "rezics-main-api",
		version: "1.0.0",
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? "development",
	},
});

const { default: api } = await import("./api");
```

Repeated initialization throws. The returned owner handle exposes bounded `flush()` and idempotent `shutdown()` methods. Export, flush, or log-writer failures are diagnostic only and never fail application work.

With no OTLP endpoint, traces and metrics use no external exporter. Tests can inject `InMemorySpanExporter` and a `MetricReader`. Aspire and production collectors use the same artifact by changing only `OTEL_*` values.

Supported standard configuration includes `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`, base or signal-specific OTLP endpoints/headers/timeouts, `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`, sampling, batch queue, and metric interval settings. Only `http/protobuf`, `none`/`gzip`, and `none`/`otlp` are accepted. All environment input is validated before exporters are created.

Instrumentation groups can be disabled independently with:

- `REZICS_OBSERVABILITY_HTTP_ENABLED`
- `REZICS_OBSERVABILITY_DATABASE_ENABLED`
- `REZICS_OBSERVABILITY_STORAGE_ENABLED`
- `REZICS_OBSERVABILITY_WORKER_ENABLED`

`OTEL_SDK_DISABLED=true` disables all spans and metrics while retaining valid structured application logs.

## Privacy contract

Logs are JSON objects with timestamp, severity, message, service, environment, and active trace/span IDs. Optional stable event names, error codes, route templates, and normalized errors are supported. Production logs omit stacks.

Redaction is recursive, cycle/depth/size bounded, and covers authorization/cookie headers, credentials, tokens, sessions, bodies, signed URLs/query values, email addresses, user/Profile/Unit identifiers, object keys, and nested error causes. Span export uses an allowlist and removes raw URLs, queries, headers, SQL statements, and unexpected attributes before both production and in-memory exporters.

Do not add request/response bodies, raw paths, object keys, exception messages, or business identifiers to metrics. Dependency and worker operation names must be static reviewed literals.

## Metric cardinality bounds

| Metric dimensions    | Bound                                                 |
| -------------------- | ----------------------------------------------------- |
| HTTP method          | 8 normalized values                                   |
| HTTP route           | Compiled Elysia route-template count plus `unmatched` |
| HTTP status class    | 6 values                                              |
| Dependency name      | 5 package-defined values                              |
| Dependency operation | Static call-site literals, validated syntax           |
| Worker job           | Static call-site literals, validated syntax           |
| Readiness transition | 4 possible state pairs                                |

The OTLP metric reader limits every instrument to 128 time series and exports at most 128 metrics per batch. Trace batching defaults to a 512-span queue and 128-span export batches; all bounds are validated and capped.

Runtime gauges use Bun-supported `process.memoryUsage()`, `process.uptime()`, and a label-free active-request counter. Meilisearch outbox depth/age APIs are available for Plan 4 integration without business-ID labels.

## Verification

Run `task observability:smoke:bun` from `libraries/`. The executable smoke test loads the selected OpenTelemetry SDK/exporter packages under the supported Bun runtime and proves async context, Elysia spans, the owned PostgreSQL client wrapper, structured log correlation, metrics, flush, and shutdown.

`task observability:smoke:load` compares 3,000 baseline and 3,000 instrumented Elysia requests using the production 10% parent-based sampler. The accepted gate is at most 0.5 ms average added latency and 64 MiB heap growth with exporters disabled; exporter/collector capacity is tested separately from application overhead.
