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
