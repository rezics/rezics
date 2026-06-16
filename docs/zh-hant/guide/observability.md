# 後端可觀測性

Rezics backend services 保留 package-owned Elysia entrypoints。Shared
observability 放在 `@rezics/shared/observability`，因為它是可重用的 runtime
helper，而不是 service bootstrap。每個 package 仍然擁有自己的 route mounting、
CORS policy、port、OpenAPI choice、readiness behavior 與 worker role behavior。

## Service Inventory

| Service | Entrypoint | OpenAPI | Health | Readiness | Notes |
| --- | --- | --- | --- | --- | --- |
| Main server | `package/server/src/index.ts` | Development only at `/openapi` | `/health` | None | 擁有 route composition 與 startup cache hydration。 |
| Auth | `package/auth/src/index.ts` | Development only at `/openapi` | `/health` | None | 保留 `coreInstance()` ownership 與 auth route mounting。 |
| Reaction | `package/reaction/src/index.ts` | `/openapi` | `/health` | None | 保留 reaction 與 internal APIs。 |
| History | `package/history/src/index.ts` | `/openapi` | `/health` | `/ready` | 服務 history reads；job-runner 擁有 outbox ingestion。 |
| Notify | `package/notify/src/index.ts` | `/openapi` | `/health` | None | 保留 production Rezics origin predicate。 |
| Job runner HTTP role | `package/job-runner/src/index.ts` | `/openapi` | `/health` | `/ready` | Worker role startup 與 shutdown 保持明確。 |
| Preview | `package/preview/src/index.ts` | Development only at `/openapi` | `/health` | None | Retained service 現在使用 shared timing plugin。 |

在這次標準化之前，`server`、`auth` 和 `preview` 使用 local request timing hooks
與 console monkey patches。其他 services 使用 package-specific startup banners，
且沒有共用 request timing behavior。

## Metadata Shape

每個 service 會把這些 metadata 傳給 shared helper：

- `key`：穩定 service key，例如 `server` 或 `job-runner`
- `displayName`：logs 與 startup output 使用的人類可讀 service name
- `environment`：runtime environment
- `port`：HTTP listen port
- `serviceUrl`：optional externally visible URL；預設為 `http://localhost:<port>`
- `openApiPath`：啟用時的 OpenAPI UI path
- `healthPath`：可用時的 health route
- `readyPath`：可用時的 readiness route
- `slowRequestThresholdMs`：slow classification 的 request duration threshold

## Runtime Settings

Backend service env files 驗證這些 optional values：

| Variable | Purpose |
| --- | --- |
| `OBSERVABILITY_LOG_FORMAT` | `local` 或 `json`；production 預設 JSON，其他情況預設 local text。 |
| `OBSERVABILITY_COLOR` | 啟用或停用 local text output 的 ANSI color。 |
| `OBSERVABILITY_SLOW_REQUEST_MS` | Slow request threshold，以 milliseconds 計。 |
| `OBSERVABILITY_TELEMETRY` | `auto`、`disabled`、`enabled` 或 `required`。 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Telemetry export 啟用時使用的 OTLP HTTP endpoint。 |

如果省略 `OTEL_EXPORTER_OTLP_ENDPOINT`，application startup 會繼續，並停用
telemetry export。如果 telemetry initialization 失敗，startup 會繼續，除非
`OBSERVABILITY_TELEMETRY=required`。

## Log Contract

Local mode 會為 startup、requests、slow requests 與 errors 輸出精簡文字。
Production mode 會輸出 newline-delimited JSON，且不含 ANSI escape sequences。
Structured request/error records 包含穩定的 service、environment、request、
route/path、status、duration、slow flag、request id，以及存在 active
OpenTelemetry span 時的 trace correlation fields。

Cookies、authorization headers、internal secret headers、tokens、secrets 與類似
password 的 fields，會在 structured output 前由 shared helpers redact。

## OpenTelemetry Boundary

Application services 使用 OpenTelemetry 與 OTLP 作為 telemetry contract。它們
不 import ClickStack、HyperDX、SigNoz、Grafana 或其他 backend-specific SDKs。
Operators 可以透過變更 collector、deployment 或 env configuration 來替換 analysis
backend，而不需要修改 service code。

Local Nomad infrastructure 包含 opt-in OTel Collector job（`deploy/prod/`
infra-otel target）。

OpenTelemetry Collector 在 `4317` 和 `4318` 接收 OTLP，並透過
`CLICKSTACK_OTLP_ENDPOINT` 匯出到 ClickStack。ClickStack 被 pin 用於
local/evaluation use，並在 `8080` 暴露 HyperDX UI。

對於 persistent production operations，請優先使用分離的 ClickStack/ClickHouse 與
Collector services，而不是 all-in-one image。保持 application boundary 為 OTLP，
讓 OTLP-compatible backend 之後可以替換 ClickStack。
