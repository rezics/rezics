# development-stage-compatibility Specification

## Purpose

Defines what kinds of internal compatibility surfaces active package code is
allowed to keep while the project is still in development. Because the
repository is pre-1.0 and internal callers can be updated in the same change,
active code SHALL NOT retain forwarding surfaces (old-name exports, retired
route object exports, retired helper exports, no-op transition props, removed
query/index stubs) purely for source-level continuity. Normal runtime
fallbacks that exist for user experience, localization, SSR defaults, external
protocol behavior, or third-party package behavior are explicitly out of
scope and remain allowed.

## Requirements

### Requirement: Active Code Has No Internal Forwarding Surfaces

Active package code SHALL NOT keep internal development-stage forwarding
surfaces for old names, old route object exports, old helper exports,
no-op transition props, or removed query/index stubs.

Normal runtime fallbacks for user experience, localization, SSR defaults,
external protocol behavior, and third-party package behavior are not part of
this requirement.

#### Scenario: Internal caller uses canonical API directly

- **GIVEN** an internal caller needs a route object, query helper, permission
  helper, or UI component prop
- **WHEN** the canonical API exists
- **THEN** the caller SHALL import or call that canonical API directly
- **AND** no forwarding export or old-name wrapper SHALL be retained only
  for source-level continuity.
