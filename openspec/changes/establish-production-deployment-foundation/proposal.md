## Why

Rezics currently has a local-development Docker workflow for external services
and ad-hoc deployment scripts, but no production deployment contract for package
services, infrastructure ownership, frontend hosting, release promotion, or
environment management. This blocks reliable production releases because app
services, workers, databases, search, CDC, proxying, migrations, and Cloudflare
static frontend deployments have different lifecycles but are not yet modeled as
independently deployable units.

## Problem

The existing `tool/external-services` compose stack is intentionally convenient
for local development, but that shape is not acceptable for production.
Production infrastructure and application services must be deployable,
upgradable, rolled back, and moved across hosts independently even when the
initial deployment happens to run on the same machine.

## Goals

- Define a production deployment foundation for Rezics that separates
  infrastructure, HTTP services, workers, proxy, migrations, frontend static
  hosting, secrets, and release automation by deployment lifecycle.
- Dockerize all package-owned backend/runtime services that need production
  execution, including Elysia services as compiled Linux binaries.
- Standardize Elysia production cluster mode for HTTP services while keeping
  worker concurrency explicit and controlled.
- Deploy `package/app` and `package/admin` as Cloudflare-hosted static Vite
  applications without SSR and without Docker images.
- Automate production release promotion, image tagging, migration execution,
  service updates, health verification, and rollback.
- Establish production environment management that is reproducible, auditable,
  and not dependent on manually maintained plaintext env files.

## Non-goals

- Do not turn the local `tool/external-services` workflow into the production
  deployment mechanism.
- Do not require Kubernetes, Docker Swarm, or another orchestration platform as
  the baseline deployment target.
- Do not Dockerize frontend static applications.
- Do not introduce SSR for `package/app` or `package/admin`.
- Do not merge infrastructure, HTTP services, workers, and proxy into a single
  production Docker Compose project.

## What Changes

- Add production deployment specifications for:
  - independent deployment units and project boundaries;
  - backend service images and compiled production entrypoints;
  - worker deployment and scaling;
  - one-shot migration jobs;
  - production environment and secret management;
  - release automation, rollback, and health verification;
  - Cloudflare static deployments for `package/app` and `package/admin`.
- Modify the existing external-services Docker capability to explicitly remain
  local-development focused and to prohibit treating its monolithic compose
  topology as the production deployment boundary.
- Replace ad-hoc production assumptions in `tool/deploy-script` with a
  repeatable release model based on immutable images, declarative deployment
  units, and explicit migrations.
- Define production deployment units that can run on the same host but are not
  coupled into the same lifecycle:
  - database infrastructure;
  - search infrastructure;
  - CDC infrastructure;
  - observability infrastructure (opt-in);
  - proxy;
  - backend HTTP services;
  - workers;
  - one-shot migrations;
  - Cloudflare static frontends.
- Integrate the runtime services and patterns introduced by the now-applied
  `standardize-elysia-observability` and `introduce-ranking-service` changes:
  the `@rezics/ranking` HTTP service and its dedicated ranking worker, the shared
  `@rezics/shared` observability helpers, a second Sequin CDC source for the
  reaction database, and an opt-in self-hosted observability analysis backend.

## Scope

Affected packages and areas:

- `package/app`: Cloudflare static build and deployment configuration.
- `package/admin`: Cloudflare static build and deployment configuration.
- `package/server`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract.
- `package/auth`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract.
- `package/notify`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract.
- `package/reaction`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract.
- `package/history`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract.
- `package/job-runner`: Docker image, HTTP and worker deployment roles,
  explicit worker concurrency, healthcheck, production env contract; second
  Sequin CDC source (reaction database) for ranking invalidations.
- `package/ranking`: Docker image, compiled cluster entrypoint, healthcheck,
  migration job, production env contract; internal-only HTTP service with a
  rebuildable projection database plus read access to the main server database
  and Meilisearch. A dedicated ranking worker role consumes the ranking job lane.
- `package/shared`: shared observability helpers (`src/observability/*`) are a
  build input for every backend image; production telemetry env contract.
- `package/preview`: classified as non-production tooling and excluded from the
  first production service set.
- `tool/external-services`: documentation/spec boundary updates only for its
  local-development purpose.
- New deployment assets under an implementation-chosen deploy/tooling location
  for compose units, Dockerfiles or generated Docker build definitions, env
  schemas, release workflows, and runbooks.

## Capabilities

### New Capabilities

- `production-deployment`: Production deployment topology, service
  Dockerization, Cloudflare frontend hosting, environment management, release
  automation, migration orchestration, health checks, and rollback.

### Modified Capabilities

- `external-services-docker`: Clarify that the existing repo-managed
  external-services compose topology is local-development only and SHALL NOT be
  used as the production deployment boundary.

## Impact

- Backend package services gain production images and compiled Linux runtime
  entrypoints. Existing local development commands remain available.
- Production deploys move from mutable host builds and direct file copying to
  immutable image tags and declarative deployment units. Orchestration uses
  Kamal over a GHCR image registry instead of hand-written deploy scripts; this
  replaces the existing systemd + SSH/rsync `tool/deploy-script` path and the
  `master`-triggered `deploy.yml` workflow.
- Backend service databases start as one self-hosted PostgreSQL instance with a
  database per service, addressed through explicit per-service connection URLs so
  any database can move to its own instance or a managed provider later.
- Production infrastructure can initially run on one host while preserving the
  ability to move database, search, CDC, workers, or proxy to separate hosts by
  changing endpoints and deployment targets.
- Production secrets and env values require a managed workflow such as encrypted
  env files or a secret manager rather than manual plaintext drift.
- Database schema changes are applied through explicit migration jobs before
  service rollout.
- Backward compatibility: local development workflows stay compatible unless
  explicitly documented otherwise; production deployment behavior is new and
  replaces only the ad-hoc deployment path.
- Migration needs: existing production hosts must be bootstrapped into the new
  deployment layout, secrets store, image registry access, Cloudflare project
  setup, and per-service env contracts before using the new release process.
