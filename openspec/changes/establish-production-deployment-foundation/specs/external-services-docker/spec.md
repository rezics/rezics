## ADDED Requirements

### Requirement: Production boundary is excluded from local external services

The repo-managed external-services Docker workflow SHALL remain a
local-development dependency workflow. Production deployment SHALL NOT use the
external-services compose project as the production deployment boundary for
Rezics infrastructure and application services.

#### Scenario: Production deployment is planned

- **WHEN** production deployment assets are created
- **THEN** they SHALL NOT treat `tool/external-services/compose.yml` as the
  production compose project
- **AND** they SHALL define production deployment units separately from the
  local-development external-services workflow

#### Scenario: Local services remain convenient

- **WHEN** a developer starts the repo-managed external-services workflow for
  local development
- **THEN** the workflow SHALL continue to manage its local development stack as
  one Docker Compose project
- **AND** that local topology SHALL NOT imply the production topology

#### Scenario: Observability and reaction CDC source stay local-only

- **WHEN** the local stack runs the OpenTelemetry Collector / ClickStack
  observability profile or the reaction CDC source added by
  `standardize-elysia-observability`
- **THEN** those services SHALL remain part of the local-development workflow
  only
- **AND** production deployment SHALL provide its own `infra-observability`
  unit and reaction CDC source as separate deployment units, not the local
  compose project's `otel-collector.yml` or local reaction source
- **AND** the pinned local image baselines SHALL NOT be treated as the
  production image-selection mechanism (production selects immutable GHCR tags)
