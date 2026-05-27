# elysia-observability Specification

## Purpose

Defines shared Elysia observability behavior for Rezics backend services:
startup banners, request timing, local human-readable (optionally colored)
output, structured production JSON logs, vendor-neutral OpenTelemetry/OTLP
export, and trace correlation. Observability is delivered as shared middleware
and helpers that each service adopts without surrendering its package-owned
runtime composition. ClickStack is the recommended open-source self-hosted
analysis backend, and Rezics-managed observability Docker images are pinned.

## Requirements

### Requirement: Services retain package-owned runtime entrypoints

Rezics Elysia observability SHALL be provided through shared middleware and
helpers that can be adopted by each backend service without centralizing service
runtime composition. Backend services SHALL retain package-owned entrypoints,
route mounting, port selection, cluster behavior, worker-role behavior, and
readiness logic.

#### Scenario: Service adopts observability without central bootstrap

- **WHEN** an Elysia backend service adopts shared observability
- **THEN** the service SHALL keep its package-owned entrypoint
- **AND** the service SHALL install shared observability through middleware or
  helper calls rather than by delegating runtime composition to a central
  bootstrap

#### Scenario: Job runner keeps role-specific runtime behavior

- **WHEN** `package/job-runner` adopts shared observability
- **THEN** the HTTP role SHALL use shared Elysia request and startup
  observability
- **AND** worker-role startup and concurrency SHALL remain explicitly owned by
  `package/job-runner`

### Requirement: Startup banners are standardized

Rezics Elysia HTTP services SHALL emit a standardized startup banner after
successful listen. The banner SHALL include the service name and service URL. If
OpenAPI is enabled for that service, the banner SHALL include the OpenAPI URL.
If health or readiness routes are available, the banner SHALL include those
URLs.

#### Scenario: Service starts with OpenAPI enabled

- **WHEN** an Elysia HTTP service starts successfully with OpenAPI enabled
- **THEN** the startup banner SHALL include the service URL
- **AND** it SHALL include the OpenAPI URL
- **AND** it SHALL use the service display name configured by that package

#### Scenario: Service starts without OpenAPI enabled

- **WHEN** an Elysia HTTP service starts successfully without OpenAPI enabled
- **THEN** the startup banner SHALL include the service URL
- **AND** it SHALL NOT print a misleading OpenAPI URL

### Requirement: Request timing is shared across Elysia services

Rezics Elysia HTTP services SHALL use shared request timing behavior for handled
requests. Request timing SHALL record method, matched route when available,
path, response status, duration in milliseconds, service name, and whether the
request exceeded the configured slow-request threshold.

#### Scenario: Request completes successfully

- **WHEN** a request handled by an instrumented Elysia service completes
- **THEN** the service SHALL emit a request timing event
- **AND** the event SHALL include method, route or path, status, duration, and
  service name

#### Scenario: Request exceeds slow threshold

- **WHEN** a request duration exceeds the configured slow-request threshold
- **THEN** the request timing event SHALL mark the request as slow
- **AND** local output SHALL visually distinguish the slow request when local
  color formatting is enabled

### Requirement: Local logs are human-readable and optionally colored

Local development output SHALL remain human-readable. Shared observability SHALL
support optional ANSI color formatting for local startup, request, slow request,
error, and database query output. Color formatting SHALL NOT be required for
correctness and SHALL be disabled when the output mode is production JSON.

#### Scenario: Development output is colorized

- **WHEN** a backend service runs in local development with color output enabled
- **THEN** startup, request timing, slow request, and error output SHALL be
  rendered as readable text
- **AND** supported fields MAY be colorized for scanning

#### Scenario: Production output does not include ANSI color

- **WHEN** a backend service runs with production structured logging enabled
- **THEN** emitted logs SHALL NOT include ANSI color escape sequences
- **AND** local-only formatting SHALL NOT mutate the JSON record fields

### Requirement: Production logs are structured JSON

Production logging for instrumented backend services SHALL emit newline-delimited
JSON records. Request and error records SHALL use stable field names for
timestamp, level, service name, environment, message, method, route, path,
status, duration, slow flag, request id, trace id, span id, and error details
when available.

#### Scenario: Production request log is emitted

- **WHEN** an instrumented production service handles an HTTP request
- **THEN** the service SHALL emit a JSON request log record
- **AND** the record SHALL contain stable request, service, status, and duration
  fields

#### Scenario: Production error log is emitted

- **WHEN** an instrumented production service handles an error
- **THEN** the service SHALL emit a JSON error log record
- **AND** the record SHALL include the error name and message when available
- **AND** the record SHALL avoid logging secrets, cookies, authorization header
  values, or internal secret header values

### Requirement: OpenTelemetry export is vendor-neutral and optional

Rezics backend observability SHALL use OpenTelemetry and OTLP as the telemetry
export contract. Application services SHALL NOT depend on ClickStack-specific,
SigNoz-specific, Grafana-specific, or other backend-specific SDKs for baseline
telemetry. Telemetry export SHALL be configurable and SHALL be disabled or
no-op-capable when no endpoint is configured.

#### Scenario: OTLP endpoint is configured

- **WHEN** a backend service starts with OTLP export enabled and an OTLP endpoint
  configured
- **THEN** the service SHALL initialize OpenTelemetry export using vendor-neutral
  OTLP configuration
- **AND** emitted telemetry SHALL identify the service name

#### Scenario: OTLP endpoint is not configured

- **WHEN** a backend service starts without an OTLP endpoint configured
- **THEN** ordinary HTTP service startup SHALL continue
- **AND** telemetry export SHALL be disabled or no-op without requiring an
  analysis backend

### Requirement: Trace correlation is available in logs

Structured request and error logs SHALL include trace correlation fields when
tracing is enabled and a request has an active trace context. The log format
SHALL preserve correlation without requiring the log analysis backend to parse
free-form messages.

#### Scenario: Request has active trace context

- **WHEN** an instrumented request is handled with an active OpenTelemetry span
- **THEN** the structured request log SHALL include trace id and span id fields
- **AND** the fields SHALL be top-level JSON fields or documented nested fields
  with stable names

### Requirement: ClickStack is the recommended self-hosted backend

Rezics observability documentation and deployment planning SHALL recommend
ClickStack as the default open-source self-hosted analysis backend for traces,
logs, metrics, and profiling/session analysis. Application services SHALL send
telemetry through OpenTelemetry Collector or another OTLP-compatible pipeline
rather than directly coupling to ClickStack APIs.

#### Scenario: Self-hosted analysis backend is documented

- **WHEN** operators follow Rezics observability documentation
- **THEN** the recommended self-hosted backend SHALL be ClickStack
- **AND** the application telemetry boundary SHALL remain OTLP-compatible

#### Scenario: Backend is replaced later

- **WHEN** operators replace ClickStack with another OTLP-compatible backend
- **THEN** backend services SHALL NOT require application code changes for
  baseline telemetry export
- **AND** only collector, deployment, or environment configuration SHOULD need
  to change

### Requirement: Observability backend images are pinned

Rezics-managed observability Docker images SHALL use exact pinned image tags.
They SHALL NOT use `latest`, `nightly`, floating major tags, or unversioned
image references.

#### Scenario: Observability Docker config is reviewed

- **WHEN** a Rezics-managed Docker configuration includes OpenTelemetry
  Collector, ClickStack, HyperDX, or ClickHouse images
- **THEN** each image reference SHALL use an exact version tag
- **AND** no image reference SHALL use a floating `latest` tag
