## 1. Inventory and Placement

- [x] 1.1 Inventory Elysia HTTP entrypoints in `package/server`, `package/auth`, `package/reaction`, `package/history`, `package/notify`, `package/job-runner`, and `package/preview` if retained.
- [x] 1.2 Decide the shared observability module location and document why it belongs there.
- [x] 1.3 Inventory current startup banners, OpenAPI enablement, health/readiness routes, request timing hooks, and service-local logger hooks for each backend service.
- [x] 1.4 Define the shared service metadata shape: service key, display name, environment, port, service URL, OpenAPI path, health path, ready path, and slow request threshold.

## 2. Shared Observability Helpers

- [x] 2.1 Add the shared observability module with typed service metadata and output mode configuration.
- [x] 2.2 Implement startup banner rendering for service URL, OpenAPI URL, health URL, and readiness URL.
- [x] 2.3 Implement request timing event creation for method, path, matched route, status, duration, slow flag, and service name.
- [x] 2.4 Implement local human-readable formatting with optional color support.
- [x] 2.5 Implement production newline-delimited JSON formatting with stable request and error fields.
- [x] 2.6 Implement redaction for cookies, authorization headers, internal secret headers, and other configured sensitive fields.
- [x] 2.7 Add unit tests for startup banner formatting, local request formatting, production JSON formatting, slow request classification, and redaction.

## 3. Elysia Middleware Adoption

- [x] 3.1 Add shared Elysia request timing middleware/plugin support.
- [x] 3.2 Adopt shared observability in `package/server/src/index.ts` while preserving its package-owned route composition and startup work.
- [x] 3.3 Adopt shared observability in `package/auth/src/index.ts` while preserving `coreInstance()` ownership and auth-specific routes.
- [x] 3.4 Adopt shared observability in `package/reaction/src/index.ts` while preserving its OpenAPI documentation configuration.
- [x] 3.5 Adopt shared observability in `package/history/src/index.ts` while preserving outbox poller behavior and readiness route behavior.
- [x] 3.6 Adopt shared observability in `package/notify/src/index.ts` while preserving its production CORS origin predicate.
- [x] 3.7 Adopt shared observability in `package/job-runner/src/index.ts` for the HTTP role while preserving explicit worker role startup and shutdown.
- [x] 3.8 Remove duplicated service-local logger hooks from `package/server` and `package/auth` after adoption.
- [x] 3.9 Search the repo for remaining service-local startup banner and request timing patterns and migrate internal Elysia service callsites in scope.

## 4. OpenTelemetry Integration

- [x] 4.1 Add optional OpenTelemetry dependencies needed for Bun/Elysia service tracing and OTLP export.
- [x] 4.2 Add shared OpenTelemetry initialization that uses service name, environment, resource attributes, sampler, and OTLP endpoint configuration.
- [x] 4.3 Add env validation for observability settings without leaking env dependencies through public package exports.
- [x] 4.4 Ensure service startup succeeds when telemetry export is not configured.
- [x] 4.5 Ensure service startup does not fail when the collector is unavailable unless an explicit required-telemetry mode is configured.
- [x] 4.6 Include active trace id and span id in structured request and error logs when tracing is enabled.
- [x] 4.7 Add tests or smoke coverage for disabled telemetry, configured telemetry, and trace/log correlation formatting.

## 5. ClickStack and Collector Configuration

- [x] 5.1 Add documentation for OpenTelemetry Collector as the telemetry pipeline boundary and ClickStack as the recommended self-hosted analysis backend.
- [x] 5.2 Add a local or deployment-aligned Collector configuration that receives OTLP telemetry and exports to ClickStack.
- [x] 5.3 Add a ClickStack smoke configuration or runbook using pinned image tags, with all-in-one limited to local/evaluation use.
- [x] 5.4 Document the separated production topology preference for ClickStack/ClickHouse/Collector when persistent operations matter.
- [x] 5.5 Document how to replace ClickStack with another OTLP-compatible backend without changing application service code.

## 6. Local External Services Image Baselines

- [x] 6.1 Update `tool/external-services/compose.yml` source PostgreSQL image to a pinned PostgreSQL 18.4 tag.
- [x] 6.2 Update `tool/external-services/compose.yml` Sequin state PostgreSQL image to a pinned PostgreSQL 18.4 tag.
- [x] 6.3 Update `tool/external-services/compose.yml` Meilisearch image to a pinned current usable tag.
- [x] 6.4 Verify `tool/external-services/compose.yml` Sequin image remains pinned to the latest validated Sequin release.
- [x] 6.5 Update `tool/external-services/compose.yml` Sequin Redis image to a pinned current usable tag.
- [x] 6.6 Update health checks or startup settings when required by the upgraded images.
- [x] 6.7 Document local volume reset expectations for PostgreSQL major-version upgrades and other incompatible local service upgrades.

## 7. Validation

- [x] 7.1 Run formatter and convention checks for changed files.
- [x] 7.2 Run targeted unit tests for the shared observability helpers.
- [ ] 7.3 Start each instrumented Elysia service in development mode and verify startup banner output, OpenAPI URL output where enabled, and request timing output.
- [ ] 7.4 Start at least one instrumented service in production-like mode and verify JSON request/error logs are valid newline-delimited JSON without ANSI escape sequences.
- [ ] 7.5 Start the repo-managed local external-services stack from fresh volumes and verify source PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin Redis, and Sequin health.
- [ ] 7.6 Verify source PostgreSQL starts with logical replication settings required by Sequin after the PostgreSQL 18.4 update.
- [ ] 7.7 Verify Meilisearch index initialization and seed sync still work after the Meilisearch image update.
- [ ] 7.8 Verify OpenTelemetry export against the local Collector/ClickStack smoke setup if that configuration is implemented in this change.
- [x] 7.9 Run `bun run check:convention` and any targeted package tests affected by service entrypoint or local service changes.
