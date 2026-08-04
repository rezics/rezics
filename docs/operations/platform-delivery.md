# Platform delivery

This runbook-level capability map joins local development, persistence,
installation, API contracts, health, observability, secrets, CI, production
delivery, and recovery. Detailed commands and provider-specific procedures
remain in `README.md`, `docs/operations/production-deployment.md`, service
READMEs, Taskfiles, and deployment scripts.

Planning context:

- [Outline: CI](https://outline.rezics.com/doc/ci-8zD0BS0R1U)
- [Outline: database review](https://outline.rezics.com/doc/database-me0eXGCrEl)
- [Outline: Mainland China edge policy](https://outline.rezics.com/doc/ban-cn-ip-baTGYDFOSd)

## Development and data

```progress
id: operations.reproducible-local-platform
status: open
goal: Give a contributor one reproducible, diagnosable local platform from clean setup through normal stop and repair.
depends:
  - tooling.progress-protocol
accept:
  - The pinned environment provides every required CLI and the documented setup starts PostgreSQL, object storage, Search, Sequin, API, worker, web, and Aspire Dashboard.
  - Setup and normal development are idempotent and do not rewrite product-owned data after installation.
  - Missing prerequisites, unhealthy dependencies, stale search, interrupted setup, stop, reset, and repair paths are explicit and safe.
verify:
  - Run `devenv test`, `task local:setup`, `task aspire:doctor`, `task aspire:describe`, and the documented health checks from a clean local state.
  - Force one dependency and one stale-search failure, follow the documented recovery, and confirm preserved and intentionally reset data.
```

```progress
id: data.migration-integrity
status: open
goal: Keep the v1 PostgreSQL schema, migrations, privileges, and application contracts synchronized from an empty database onward.
depends: []
accept:
  - Drizzle is desired state, Atlas owns the v1 baseline and later migrations, and manual database objects have explicit owners.
  - Replay, checksum, schema comparison, application-role privileges, transaction behavior, and supported upgrade paths are deterministic.
  - Database constraints protect cross-kind, cross-owner, tree, state, time, count, and identity invariants that cannot safely rely on callers.
verify:
  - Run `task db:check`, database schema tests, migration contract tests, and application-role privilege checks against vanilla PostgreSQL 18.
  - Exercise an empty installation, one later migration, a checksum mismatch, a schema mismatch, and an unauthorized application-role write.
```

```progress
id: operations.platform-installation
status: open
goal: Install one immutable factory platform bundle exactly once and verify permanent platform identities without reconciling live product data.
depends:
  - data.migration-integrity
accept:
  - Empty-database installation applies migrations, privileges, the versioned factory bundle, required media, and initial platform credentials atomically or recoverably.
  - Recurring preparation verifies permanent platform identities without rewriting live localizations, policies, navigation, themes, content, or search state.
  - Already-installed, partially installed, occupied, interrupted, missing-media, and credential-rotation states have explicit operator paths.
verify:
  - Run the installation manifest, bootstrap service, platform verification, installation contract, and credential-rotation tests.
  - Exercise fresh install, safe rerun, occupied refusal, interrupted recovery, verification failure, and explicit credential rotation.
```

The requested split between professional demonstration data and destructive
coverage scenarios remains tracked by `seed.separate-scenario-programs` beside
the Seed contracts.

```progress
id: developer.openapi-and-sdk
status: open
goal: Keep the main API, OpenAPI document, generated clients, public SDK, errors, and compatibility policy as one versioned contract.
depends:
  - data.migration-integrity
accept:
  - Every supported endpoint publishes exact request, response, error, authentication, pagination, and effect schemas.
  - Generated Fetch, TanStack Query, and public API clients reproduce the committed contract without hand edits.
  - V1 public and persisted compatibility changes follow SemVer and do not restore pre-v1 aliases, routes, or schemas.
verify:
  - Run `task openapi:check`, API index and validation tests, generated-client typechecks, and public SDK tests.
  - Exercise representative success, validation, authentication, authorization, conflict, rate-limit, and unavailable responses through each client.
```

## Runtime trust and visibility

```progress
id: operations.health-and-readiness
status: open
goal: Give every deployed process truthful startup, liveness, readiness, degradation, and rollout signals.
depends:
  - data.migration-integrity
accept:
  - API and worker health paths follow the shared timing and dependency contract without turning optional degradation into false unavailability.
  - PostgreSQL is readiness-required while object storage, recommendation freshness, Search, and other optional dependencies report bounded degradation.
  - Aspire, CI, Nomad, deployment waits, restarts, and operator diagnostics consume the same meanings.
verify:
  - Run API readiness, health model, observability, worker health, Aspire integration, Nomad contract, and deployment wait tests.
  - Force each dependency unavailable or stale and compare process, Aspire, Nomad, and operator-visible states.
```

```progress
id: observability.runtime-signals
status: open
goal: Provide privacy-safe logs, metrics, traces, and operation context across API, worker, migration, search, and deployment boundaries.
depends:
  - operations.health-and-readiness
accept:
  - Request, actor, operation, release, and trace context propagate across supported process and asynchronous boundaries.
  - Sensitive data is redacted, metric cardinality is bounded, logs are structured, and telemetry failure cannot break the product path.
  - Critical auth, access, content, projection, worker, deployment, and recovery operations expose actionable success and failure signals.
verify:
  - Run observability configuration, redaction, runtime, Elysia, Aspire, Bun smoke, and load smoke tests.
  - Trace one successful and one failed request through API, database, worker or projection, and deployment-visible diagnostics.
```

```progress
id: operations.secrets-and-service-identity
status: open
goal: Keep human credentials, service identities, provider tokens, and production variables least-privileged, rotatable, and absent from builds and logs.
depends:
  - access.unit-collaboration
accept:
  - GitHub OIDC, Nomad variables, database roles, Cloudflare, object storage, Search, Sequin, email, and application secrets have explicit owners and scopes.
  - Bootstrap, distribution, use, rotation, revocation, expiry, redaction, and recovery never require committing or printing reusable secrets.
  - Build artifacts, CI logs, API responses, telemetry, backups, and temporary files are checked for secret exposure.
verify:
  - Run Nomad variable-template, build-context, redaction, OIDC claim, and secret-scanning checks.
  - Rotate one credential for each production trust boundary and verify old-credential refusal and uninterrupted recovery.
```

## CI, release, and recovery

```progress
id: release.advisory-check
status: open
goal: Keep one truthful advisory GitHub check for Progress, formatting, contracts, types, tests, builds, and deployment static checks.
depends:
  - developer.openapi-and-sdk
accept:
  - The Check workflow runs the same repository commands maintainers use locally and preserves useful diagnostics.
  - Progress validation runs before expensive checks and deterministic failures remain visible without becoming a release dependency.
  - Cancellation, timeout, cache, external-service, and retry behavior cannot turn an unverified result into green.
verify:
  - Run `deploy/scripts/run-github-check.sh` in the supported runner environment.
  - Exercise a Progress failure, formatting failure, test failure, cancellation, and successful run and inspect the GitHub conclusions.
```

```progress
id: release.production-delivery
status: open
goal: Deliver tagged v1 releases to the correct production components with verified promotion, safe dependency order, and rollback.
depends:
  - release.component-planning
  - release.manual-component-dispatch
  - operations.platform-installation
  - operations.health-and-readiness
  - observability.runtime-signals
  - operations.secrets-and-service-identity
accept:
  - Stable tags authorize one release entry, component planning selects changed inputs, and database, API, worker, web, About, and infrastructure follow safe dependency order.
  - Each component validates the new version before traffic promotion and has an explicit bounded rollback or stop condition.
  - Normal unchanged, partial, full, failed, retried, forced, and superseded releases remain auditable and idempotent.
verify:
  - Run release planning, artifact, Nomad, database-operation, Search-operation, Cloudflare deployment, and workflow contract checks.
  - Execute canary partial, full, failed validation, automatic rollback, manual retry, and safe force scenarios in a production-like environment.
```

```progress
id: operations.production-recovery
status: open
goal: Restore every production state owner and public service within approved recovery objectives.
depends:
  - operations.backup-recovery
  - release.production-delivery
accept:
  - PostgreSQL, object storage, Search projections, Sequin state, Nomad variables, configuration, and release artifacts have declared recovery ownership and order.
  - Canonical data restores before rebuildable projections, and restored services remain isolated until integrity and access checks pass.
  - Loss, corruption, unavailable provider, leaked credential, partial restore, rollback, communication, and post-incident follow-up have runbooks.
verify:
  - Complete the backup and restore drill in `docs/operations/production-deployment.md` against an isolated environment.
  - Measure recovery point and recovery time, verify integrity and access, rebuild projections, rotate exposed credentials, and record the drill result.
```

## Delivery milestone

```progress
id: operations.v1-delivery
status: open
goal: Make the v1 platform reproducible, contract-checked, deployable, observable, secure, and recoverable.
depends:
  - operations.reproducible-local-platform
  - data.migration-integrity
  - operations.platform-installation
  - seed.separate-scenario-programs
  - developer.openapi-and-sdk
  - operations.health-and-readiness
  - observability.runtime-signals
  - operations.secrets-and-service-identity
  - release.advisory-check
  - release.production-delivery
  - operations.production-recovery
  - operations.mainland-china-edge-policy
accept:
  - A clean environment can build, install, verify, deploy, observe, roll back, and restore every supported v1 component.
  - Local, CI, staging, and production contracts differ only where documented environment ownership requires it.
  - Operators can diagnose and recover every critical failure without undocumented access or destructive guesswork.
verify:
  - Run all repository, release, deployment, security, health, observability, backup, and recovery checks referenced by the owning runbooks.
  - Complete a release and disaster-recovery rehearsal from a clean supported baseline and retain the operator evidence.
```
