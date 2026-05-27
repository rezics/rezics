## ADDED Requirements

### Requirement: Production deployment units are independently deployable

Production deployment SHALL separate durable infrastructure, search
infrastructure, CDC infrastructure, proxy, backend HTTP services, workers,
migration jobs, and static frontends into independently deployable units.
Production deployment MUST NOT require a single monolithic Docker Compose
project that contains all infrastructure and application services.

#### Scenario: Same host uses separate deployment units

- **WHEN** production infrastructure and application services are placed on the
  same host
- **THEN** database infrastructure, search infrastructure, CDC infrastructure,
  proxy, backend HTTP services, workers, migration jobs, and static frontends
  SHALL remain separate deployment units
- **AND** updating backend HTTP services SHALL NOT require recreating database,
  search, CDC, or proxy services

#### Scenario: Service moves to another host

- **WHEN** a deployment unit moves from the original host to another host or
  managed provider
- **THEN** dependent services SHALL connect through explicit production
  endpoints from env/config
- **AND** dependent services SHALL NOT rely on implicit container names from a
  monolithic compose project

### Requirement: Backend runtime services are Dockerized

Every package-owned backend runtime service selected for production execution
SHALL have a production Docker image built from the monorepo and published with
an immutable source revision tag. Library-only packages SHALL NOT be deployed as
standalone runtime images.

#### Scenario: Backend service image is built

- **WHEN** a production release builds backend artifacts
- **THEN** runtime services including `package/server`, `package/auth`,
  `package/notify`, `package/reaction`, `package/history`, and
  `package/job-runner` SHALL produce Docker images
- **AND** each image SHALL be tagged with the git revision used to build it

#### Scenario: Library package is not deployed directly

- **WHEN** a package is only a shared library or frontend build input
- **THEN** production deployment SHALL consume it through dependent build
  artifacts
- **AND** production deployment SHALL NOT publish or run it as an independent
  service image

### Requirement: Elysia HTTP services run compiled cluster entrypoints

Production Elysia HTTP services SHALL run compiled Linux binaries from
production entrypoints that use cluster mode. The worker count SHALL be
configurable per service.

#### Scenario: HTTP service starts in production

- **WHEN** a production Elysia HTTP service container starts
- **THEN** it SHALL run the compiled Linux binary for its production entrypoint
- **AND** the entrypoint SHALL start worker processes through cluster mode
- **AND** the number of workers SHALL be controlled by service configuration or
  a documented default

#### Scenario: Cluster worker exits

- **WHEN** an HTTP cluster worker exits unexpectedly
- **THEN** the primary process SHALL replace the worker or fail the container in
  a way that the deployment unit can restart
- **AND** the service healthcheck SHALL reflect whether the service is able to
  serve traffic

### Requirement: Worker services use explicit worker deployment semantics

Production worker services SHALL be deployed separately from HTTP services and
SHALL use explicit role, replica, and concurrency configuration. Worker services
MUST NOT inherit HTTP cluster behavior unless the worker role is explicitly
designed for clustered execution.

#### Scenario: Job runner HTTP and worker roles are deployed

- **WHEN** `package/job-runner` is deployed to production
- **THEN** its HTTP role SHALL be deployable independently from its worker role
- **AND** its worker role SHALL expose explicit concurrency or replica controls
- **AND** scaling the worker role SHALL NOT require redeploying backend HTTP
  services

### Requirement: Frontend applications deploy to Cloudflare static hosting

`package/app` and `package/admin` SHALL deploy as static Vite applications to
Cloudflare. They SHALL NOT require Docker images or SSR runtime services.

#### Scenario: Public app is released

- **WHEN** a production release includes `package/app`
- **THEN** the release SHALL build the static Vite output
- **AND** it SHALL deploy that output to the configured Cloudflare application
- **AND** runtime API/service endpoints SHALL come from the frontend production
  environment configuration

#### Scenario: Admin app is released

- **WHEN** a production release includes `package/admin`
- **THEN** the release SHALL build the static Vite output
- **AND** it SHALL deploy that output to the configured Cloudflare application
- **AND** it SHALL NOT build or publish an admin Docker runtime image

### Requirement: Production env and secrets are schema-driven

Production deployment SHALL define required env/config values per deployment
unit, including ownership and secret classification. Actual production secret
values SHALL come from an auditable encrypted file workflow or secret manager,
not manually maintained plaintext files as the source of truth.

#### Scenario: Env is validated before service rollout

- **WHEN** a production deployment updates a deployment unit
- **THEN** required env/config for that unit SHALL be validated before the unit
  starts
- **AND** missing required values SHALL fail the deployment before mutating the
  running service

#### Scenario: Secret source is audited

- **WHEN** an operator or CI job materializes production secrets for deployment
- **THEN** the source of those values SHALL be encrypted or provider-managed
- **AND** plaintext generated env files SHALL be treated as deployment outputs,
  not as the canonical source of truth

### Requirement: Database migrations are explicit release jobs

Production database migrations SHALL run as explicit one-shot release jobs
before dependent runtime services are updated. Runtime service startup SHALL NOT
implicitly run schema migrations.

#### Scenario: Migration succeeds before rollout

- **WHEN** a release includes database schema changes
- **THEN** migration jobs SHALL run for the affected package-owned databases
  before dependent services are updated
- **AND** dependent services SHALL only roll out after required migrations
  succeed

#### Scenario: Migration fails

- **WHEN** a migration job fails during release
- **THEN** the release SHALL stop before updating dependent runtime services
- **AND** the failure SHALL be visible in release logs/status

### Requirement: Release automation supports targeted rollout and rollback

Production release automation SHALL support deploying and rolling back backend
HTTP services, workers, infrastructure units, proxy, and Cloudflare static
frontends as separate targets. Backend rollouts SHALL use immutable image tags.

#### Scenario: Backend service is updated

- **WHEN** a release updates backend HTTP services
- **THEN** the deployment SHALL pull the selected immutable image tags
- **AND** it SHALL update only the targeted service deployment unit
- **AND** it SHALL run health verification after rollout

#### Scenario: Backend service is rolled back

- **WHEN** an operator rolls back a backend service deployment unit
- **THEN** the deployment SHALL be able to select a previous immutable image tag
- **AND** it SHALL restart only the affected deployment unit
- **AND** it SHALL NOT require rolling back Cloudflare frontends or durable
  infrastructure

#### Scenario: Infrastructure update is requested

- **WHEN** a production release updates only application code
- **THEN** infrastructure deployment units SHALL NOT be recreated or upgraded
  automatically
- **AND** infrastructure updates SHALL require an explicit infrastructure
  deployment target

### Requirement: Production services expose health checks

Production runtime services SHALL expose health checks suitable for deployment
automation and proxy routing. Health checks SHALL fail when a service cannot
serve its intended production role.

#### Scenario: HTTP service health is checked

- **WHEN** deployment automation updates a backend HTTP service
- **THEN** it SHALL verify the service health endpoint before considering the
  rollout complete
- **AND** failed health verification SHALL fail the deployment

#### Scenario: Worker role health is checked

- **WHEN** deployment automation updates a worker deployment unit
- **THEN** it SHALL verify that the worker role can connect to required queue,
  database, search, or CDC dependencies
- **AND** failed dependency readiness SHALL fail the deployment

### Requirement: Production runbooks document operations

Production deployment SHALL include operator documentation for bootstrap,
release, rollback, logs, health checks, secret rotation, migration handling, and
moving deployment units between hosts or providers.

#### Scenario: Operator deploys a release

- **WHEN** an operator follows the production release runbook
- **THEN** the runbook SHALL identify the required deployment targets, expected
  commands or CI jobs, health checks, and rollback path
- **AND** it SHALL distinguish application deployment from infrastructure
  deployment
