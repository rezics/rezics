## ADDED Requirements

### Requirement: Managed local service images use current pinned baselines

The repo-managed external-services workflow SHALL use exact pinned image tags
for local development infrastructure. During the development stage, local
service images SHALL be updated directly to current usable versions unless
validation identifies a concrete compatibility issue. The workflow SHALL NOT use
floating tags such as `latest`, `nightly`, or unversioned major tags.

#### Scenario: Local Docker image tags are pinned

- **WHEN** a developer inspects the repo-managed external-services Docker
  configuration
- **THEN** source PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin
  Redis, and Sequin SHALL use exact pinned image tags
- **AND** none of those images SHALL use a floating `latest` tag

#### Scenario: Local services are updated to current baselines

- **WHEN** this change updates the repo-managed external-services stack
- **THEN** the source PostgreSQL baseline SHALL be PostgreSQL 18.4
- **AND** the Sequin state PostgreSQL baseline SHALL be PostgreSQL 18.4
- **AND** Meilisearch, Sequin, and Redis SHALL be updated to current pinned
  usable versions unless validation identifies a concrete incompatibility

### Requirement: Local major-version upgrades may recreate data

The repo-managed external-services workflow SHALL allow local Docker volumes to
be removed and recreated when a managed service receives a major-version image
upgrade. The workflow SHALL treat local data recreation as acceptable during the
development stage and SHALL document reset expectations where a major-version
data directory is not compatible in place.

#### Scenario: PostgreSQL major version changes

- **WHEN** the managed source PostgreSQL or Sequin state PostgreSQL image is
  upgraded across a PostgreSQL major version
- **THEN** the workflow MAY require developers to recreate the local PostgreSQL
  volumes
- **AND** the reset path SHALL be documented or surfaced by the implementation
  when existing data directories cannot be reused

#### Scenario: Developer recreates local services

- **WHEN** a developer resets the repo-managed external-services volumes after a
  major local service upgrade
- **THEN** the managed source PostgreSQL service SHALL recreate the local
  development databases on first boot
- **AND** package Prisma migrations SHALL remain owned by existing package
  commands
