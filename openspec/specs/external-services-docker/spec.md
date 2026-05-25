# external-services-docker Specification

## Purpose

Defines the repo-managed Docker Compose v2 lifecycle for local development
external dependencies: source PostgreSQL, Meilisearch, Sequin, and Sequin's own
state Postgres and Redis. The goal is a single, supported workflow that brings
up Sequin-ready dependencies from first boot, so source Postgres preparation
(publication and replication slot setup) is reserved for verification and
exceptional repair rather than the happy path. User-managed external services
remain out of scope for this workflow; developers may still point package env
files at host-managed services manually, but the repo-managed workflow does not
discover, start, stop, or mutate them.

## Requirements

### Requirement: Docker Compose v2 runtime

The repo-managed external-services workflow SHALL use Docker Compose v2 as its
only supported container runtime. The workflow SHALL NOT support Podman,
podman-compose, or Docker Compose v1.

#### Scenario: Docker Compose v2 is available

- **WHEN** a developer starts the managed external-services workflow on a
  machine with `docker compose` available
- **THEN** the workflow SHALL use `docker compose` to manage the stack
- **AND** it SHALL NOT attempt Podman or podman-compose detection

#### Scenario: Docker Compose v2 is unavailable

- **WHEN** a developer starts the managed external-services workflow without
  Docker Compose v2 available
- **THEN** the workflow SHALL fail before mutating service state
- **AND** the error SHALL state that Docker Compose v2 is required

### Requirement: Managed service topology

The repo-managed external-services workflow SHALL manage source PostgreSQL,
Meilisearch, Sequin state PostgreSQL, Sequin Redis, and Sequin as one Docker
Compose project for local development.

#### Scenario: Start managed dependencies

- **WHEN** a developer runs the managed service start command
- **THEN** source PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin
  Redis, and Sequin SHALL be created or started through the repo Docker Compose
  project
- **AND** the command SHALL be safe to run when those repo-managed containers
  already exist

#### Scenario: Stop managed dependencies

- **WHEN** a developer runs the managed service stop command
- **THEN** the workflow SHALL stop the repo-managed external-services stack
- **AND** it SHALL NOT stop unrelated user-managed containers or host services

### Requirement: Source Postgres starts Sequin-ready

The repo-managed source PostgreSQL service SHALL start with logical replication
settings required by Sequin. The managed happy path SHALL NOT require
`ALTER SYSTEM` to enable Sequin CDC on a fresh source Postgres volume.

#### Scenario: Fresh managed Postgres starts with logical WAL

- **WHEN** the managed source PostgreSQL service is created from an empty volume
- **THEN** Postgres SHALL start with `wal_level=logical`
- **AND** it SHALL start with `max_replication_slots` greater than or equal to
  `10`
- **AND** it SHALL start with `max_wal_senders` greater than or equal to `10`

#### Scenario: Managed setup avoids repair in happy path

- **WHEN** the managed external-services stack is started from a fresh volume
- **THEN** source PostgreSQL SHALL be ready for Sequin publication and logical
  replication slot setup without running a repair command

### Requirement: Local database bootstrap

The repo-managed source PostgreSQL service SHALL initialize the local
development databases required by package env examples when its data volume is
empty. Schema creation and migrations SHALL remain owned by existing package
Prisma workflows.

#### Scenario: First-run database initialization

- **WHEN** the managed source PostgreSQL service initializes an empty data
  volume
- **THEN** it SHALL create local databases for main server, auth, job-runner,
  history, notify, and reaction package development
- **AND** it SHALL NOT run package Prisma migrations as part of container
  initialization

#### Scenario: Existing data volume skips init scripts

- **WHEN** the managed source PostgreSQL service starts with an existing data
  volume
- **THEN** first-run initialization scripts SHALL NOT be treated as having run
  again
- **AND** the workflow SHALL rely on explicit verification or repair commands
  for missing databases or broken CDC state

### Requirement: Service health and diagnostics

The repo-managed external-services workflow SHALL provide commands to inspect
health, status, and logs for managed services.

#### Scenario: Health check reports managed services

- **WHEN** a developer runs the managed service health command
- **THEN** the workflow SHALL check source PostgreSQL readiness
- **AND** it SHALL check Meilisearch health
- **AND** it SHALL check Sequin health when Sequin is part of the running stack

#### Scenario: Logs command follows managed services

- **WHEN** a developer runs the managed service logs command
- **THEN** the workflow SHALL stream logs from the repo-managed Docker Compose
  project
- **AND** it SHALL NOT require developers to know individual container names

### Requirement: User-managed services remain external

The repo-managed Docker workflow SHALL NOT discover, start, stop, or mutate
user-managed Postgres, Meilisearch, Redis, or Sequin services. External
services MAY still be used by configuring package env files manually.

#### Scenario: External service mode is manual

- **WHEN** a developer chooses to use a host-managed Postgres or Meilisearch
  instance
- **THEN** they SHALL configure package env files manually
- **AND** the repo-managed Docker workflow SHALL NOT take ownership of that
  external service

#### Scenario: Port conflict is reported

- **WHEN** a repo-managed service cannot start because a default host port is
  already in use
- **THEN** the workflow SHALL report the likely conflict
- **AND** it SHALL NOT stop or reconfigure the process or container using that
  port

### Requirement: Source database verification and repair

The external-services workflow SHALL expose explicit verification and repair
commands for Sequin source database readiness. These commands SHALL be separate
from the normal fresh managed setup path.

#### Scenario: Verify managed source database

- **WHEN** a developer runs source database verification after managed services
  start
- **THEN** the command SHALL report logical replication settings
- **AND** it SHALL report Sequin publication and replication slot readiness

#### Scenario: Repair is explicit

- **WHEN** a developer runs source database repair
- **THEN** the command SHALL require an explicit repair mode
- **AND** it SHALL be documented as intended for existing, external, or broken
  databases rather than fresh managed setup
