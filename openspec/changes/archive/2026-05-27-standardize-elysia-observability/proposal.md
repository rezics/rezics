## Why

Rezics backend services use the same Elysia family of runtime patterns, but
their startup output, OpenAPI announcements, request timing logs, color
formatting, error logs, and production observability behavior are implemented
independently and inconsistently. This blocks reliable local diagnosis and
production operations as the deployment foundation starts treating each backend
service as an independently deployable unit.

## Problem

The current service entrypoints mix service-specific runtime composition with
ad-hoc observability behavior:

- `package/server` and `package/auth` install duplicated development-only
  console color hooks and request timing traces.
- `package/reaction`, `package/history`, `package/notify`, and
  `package/job-runner` expose different startup banners and do not share the
  same request timing behavior.
- Production logs are not specified as structured records and do not define how
  request latency, slow requests, route names, status codes, service names, or
  trace identifiers are represented.
- OpenTelemetry can be used as the telemetry pipeline, but it is not itself an
  analysis backend. Rezics needs a documented open-source backend target for
  self-hosted analysis.
- The local external-services stack still pins older development images even
  though this project is in the development stage and local service state may be
  recreated.

## Goals

- Preserve distributed service entrypoints: each package keeps its own Elysia
  app composition, port selection, routes, cluster mode, worker role, and
  readiness behavior.
- Introduce shared Elysia observability middleware/helpers for startup banners,
  request timing, error logging, local color formatting, structured production
  logs, and OpenTelemetry export setup.
- Standardize local startup output so each HTTP service prints service URL,
  OpenAPI URL when enabled, and health/readiness URLs when available.
- Standardize production logs as structured JSON records suitable for Docker log
  collection and correlation with traces.
- Standardize OpenTelemetry as the vendor-neutral telemetry contract using OTLP
  export, without coupling application code to a specific analysis backend.
- Select ClickStack as the recommended open-source self-hosted analysis backend
  for traces, logs, metrics, and profiling/session analysis.
- Update local external-services image baselines to pinned, currently usable
  latest versions, including PostgreSQL 18.4, unless validation finds a concrete
  incompatibility.

## Non-goals

- Do not replace service-specific Elysia entrypoints with a centralized runtime
  bootstrap.
- Do not force every service to expose identical route composition, CORS policy,
  worker role behavior, or readiness logic.
- Do not make OpenTelemetry Collector or ClickStack required for ordinary local
  development.
- Do not introduce a hosted observability vendor as a baseline dependency.
- Do not preserve old local Docker volumes across major infrastructure image
  upgrades; local state may be recreated during this development-stage change.

## What Changes

- Add an `elysia-observability` capability covering shared observability
  middleware/helper behavior for Rezics Elysia services.
- Add shared middleware/helpers that services may adopt while keeping their own
  runtime entrypoints.
- Replace duplicated development-only logger hooks with shared local formatting
  behavior.
- Add production structured request/error logs with common field names and slow
  request classification.
- Add OpenTelemetry configuration and OTLP export conventions for backend
  services.
- Add ClickStack as the recommended self-hosted observability analysis backend,
  with OpenTelemetry Collector as the deployment pipeline boundary.
- Modify the `external-services-docker` capability so local development
  infrastructure uses pinned current image baselines and can be recreated when
  major service versions change.

## Capabilities

### New Capabilities

- `elysia-observability`: Defines shared Elysia observability middleware,
  startup banner conventions, local color formatting, production structured
  logs, request timing, error logging, OpenTelemetry export, and the recommended
  ClickStack analysis backend boundary.

### Modified Capabilities

- `external-services-docker`: Local external services SHALL use pinned current
  image baselines, including PostgreSQL 18.4, and local data may be recreated
  for major-version upgrades during development.

## Scope

Affected packages and areas:

- `package/server`: adopt shared Elysia observability middleware/helpers and
  remove duplicated service-local logger behavior.
- `package/auth`: adopt shared Elysia observability middleware/helpers and
  remove duplicated service-local logger behavior.
- `package/reaction`: adopt shared startup, request timing, and production log
  conventions.
- `package/history`: adopt shared startup, request timing, production log, and
  outbox-related log conventions where applicable.
- `package/notify`: adopt shared startup, request timing, and production log
  conventions.
- `package/job-runner`: adopt shared observability for the HTTP role while
  preserving explicit worker-role behavior and worker logs.
- `package/preview`: adopt the same conventions if retained as a production
  Elysia service.
- `package/*/env.ts` files for backend services: add any needed environment
  validation for observability configuration.
- `tool/external-services`: update local Docker image baselines for PostgreSQL,
  Meilisearch, Sequin dependencies, and observability services when added.
- Deployment/OpenSpec documentation: align with the active production
  deployment foundation change without merging service runtime ownership.

## Impact

- Backend package services gain consistent local and production observability
  behavior without losing independent runtime ownership.
- Production logs become machine-readable JSON with stable fields for service,
  environment, request, route, timing, status, error, and trace correlation.
- Local development keeps readable colored output and clear service/OpenAPI URL
  banners.
- OpenTelemetry instrumentation and OTLP export become the app-level telemetry
  contract; ClickStack is the recommended self-hosted backend behind Collector.
- Local external-service Docker images move to current pinned baselines; local
  developers may need to recreate volumes after PostgreSQL or other major
  service upgrades.
- Backward compatibility: public HTTP APIs remain unchanged. Operational log
  formats and local Docker service versions intentionally change.
- Migration needs: local Docker volumes may be reset; production rollout must
  pin exact image tags and provide explicit smoke/health validation before
  service adoption.
