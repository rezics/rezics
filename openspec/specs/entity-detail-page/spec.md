# entity-detail-page Specification

## Purpose

Defines the public detail page for an Entity unit. A single React component backs two route paths — `/e/:slug` (canonical, slug-resolving) and `/entity/:unitId` (id-direct fallback) — and renders an IMDb-style Hero plus conditional tab strip (`Overview`, `Works`, `About` in v1, with `Awards` and `News` scaffolded but commented out). Empty tabs hide themselves rather than relying on hard-coded kind→tab maps. Owner labels and subscribe affordances are deliberately deferred (see `content-creation-mode` and `engagement-subscription`).

## Requirements

### Requirement: Single shared component renders /e/:slug and /entity/:unitId

The entity detail page SHALL be implemented as a single React component reused by two route paths: `/e/:slug` (slug route) and `/entity/:unitId` (id route). The slug route SHALL first resolve the slug to a unitId via the `entity` typed-slug endpoint (cached through SlugRef), then delegate to the shared component using the resolved unitId. The id route SHALL render the shared component directly.

#### Scenario: /e/:slug resolves and renders

- **WHEN** a viewer navigates to `/e/liu-cixin`
- **AND** that slug exists in the entity scope
- **THEN** the slug SHALL be resolved to its unitId
- **AND** the shared detail component SHALL render with that unitId

#### Scenario: /entity/:unitId renders directly

- **WHEN** a viewer navigates to `/entity/01h8e5g6t...` (UUID)
- **AND** an ENTITY-typed Unit with that id exists
- **THEN** the shared detail component SHALL render with that unitId
- **AND** no slug-resolution step SHALL be performed

#### Scenario: Unknown slug returns 404

- **WHEN** a viewer navigates to `/e/does-not-exist`
- **THEN** the route SHALL return a 404 not-found state without falling back to the unitId route or other scopes

### Requirement: Detail page renders an IMDb-style skeleton with conditional tabs

The detail page SHALL render a Hero region (primary title, kind chip, verified badge when applicable, language switcher when multi-translation) and a tab strip beneath it. The tab strip SHALL include `Overview`, `Works`, `About` as live tabs in v1. The `Awards` and `News` tab implementations SHALL be written in the same source file but commented out, including their entry in the tab registration array. Tabs whose data source returns empty SHALL NOT render in the tablist (no hard-coded kind→tab mapping).

#### Scenario: Entity with no works hides the Works tab

- **WHEN** the entity has zero attribution rows linking it to any Work-Unit
- **THEN** the `Works` tab SHALL NOT appear in the tablist
- **AND** the default visible tab SHALL fall back to `Overview`

#### Scenario: Entity with multiple translations shows the language switcher

- **WHEN** the entity has UnitTranslation rows in two or more languages
- **THEN** a language switcher SHALL render in the Hero region
- **AND** changing the language SHALL re-render translatable text (title, summary, description) in the chosen language

#### Scenario: Verified entity displays the verified badge

- **WHEN** the entity has `verified = true`
- **THEN** a `lucide-react` BadgeCheck icon SHALL render next to the kind chip
- **AND** the badge SHALL be present in both the Hero region and EntityPicker result rows for the same entity

### Requirement: Overview tab renders entity bio

The `Overview` tab SHALL render the entity's `UnitTranslation.summary` and `UnitTranslation.description` in the current display language. If neither field has content in the current language, the tab SHALL render a neutral empty-state ("No overview available") and SHALL NOT fall back to another language silently.

#### Scenario: Overview shows bio in current language

- **WHEN** the entity has `summary = "中国科幻作家"` in zh and `summary = "Chinese SF author"` in en
- **AND** the current display language is zh
- **THEN** the Overview tab SHALL display "中国科幻作家"

#### Scenario: Overview empty state in current language

- **WHEN** the entity has translations only in zh and the current display language is en
- **THEN** the Overview tab SHALL display the neutral empty state without falling back to zh content

### Requirement: Detail page omits owner label in v1

The detail page SHALL NOT render an owner card, byline, or "created by" label in v1. The OwnerHint conditional branch (neutral "Community catalog entry" label for system-owned entities; no label for user-owned) SHALL be deferred until `content-creation-mode` lands. The render area reserved for this label SHALL remain absent from the DOM, not hidden with CSS, so introducing the label later is purely additive.

#### Scenario: Detail page renders without owner card

- **WHEN** the entity detail page renders for any v1 entity
- **THEN** no owner card, byline, or creator label SHALL appear in the page DOM

### Requirement: Detail page omits subscribe button in v1

The detail page SHALL NOT render a Subscribe / Follow button in v1. The button is deferred until `engagement-subscription` lands. The render area reserved for the button SHALL remain absent from the DOM.

#### Scenario: Detail page renders without subscribe button

- **WHEN** the entity detail page renders for any v1 entity
- **THEN** no subscribe or follow button SHALL appear in the page DOM
